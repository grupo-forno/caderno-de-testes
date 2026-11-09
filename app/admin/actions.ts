"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { lerPassos } from "@/lib/passos";
import type { Item } from "@/lib/tipos";
import { hashDaChave, novaChave } from "@/lib/validador";
import { aceiteVigente } from "@/lib/aceite";
import { exigirAdmin, marcarEntrada, sairDoAdmin, senhaCorreta } from "@/lib/admin";

// Com a homologação concluída, o que foi aprovado não pode mudar de baixo do termo: reabra antes.
async function naoSeConcluido(cadernoId: string) {
  const [c] = await sql`select slug from cadernos where id::text = ${cadernoId}`;
  if (c && (await aceiteVigente(c.slug))) redirect(`/admin/${cadernoId}?erro=travado`);
}

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opc = (f: FormData, k: string) => txt(f, k) || null;
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
// uma linha = um título (para criar vários módulos ou telas de uma vez)
const linhas = (f: FormData, k: string) => txt(f, k).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 100);

const MAX_TENTATIVAS = 8; // senhas erradas por endereço (IP) a cada 15 minutos

export async function entrar(f: FormData) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  const [{ n }] = await sql`select count(*)::int as n from tentativas_login where ip = ${ip} and criado > now() - interval '15 minutes'`;
  if (n >= MAX_TENTATIVAS) redirect("/admin?erro=espere");
  if (!senhaCorreta(txt(f, "senha"))) {
    await sql`insert into tentativas_login (ip) values (${ip})`;
    redirect("/admin?erro=1");
  }
  await sql`delete from tentativas_login where ip = ${ip}`;
  await marcarEntrada();
  redirect("/admin");
}

export async function sair() {
  await sairDoAdmin();
  redirect("/admin");
}

function gerarSlug(titulo: string) {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "caderno";
  // sufixo aleatório e longo (80 bits): o link é aberto, então não pode ser adivinhado
  return `${base}-${randomBytes(10).toString("hex")}`;
}

export async function criarCaderno(f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect("/admin?erro=titulo");
  const [c] = await sql`
    insert into cadernos (slug, titulo, versao, preparado_por, antes)
    values (${gerarSlug(titulo)}, ${titulo}, ${txt(f, "versao") || "1.0"}, ${txt(f, "preparado_por")}, ${txt(f, "antes")})
    returning id`;
  // módulos já cadastrados na criação (opcional): um por linha
  const mods = linhas(f, "modulos");
  if (mods.length) await sql.transaction(mods.map((m, i) => sql`insert into modulos (caderno_id, ordem, titulo) values (${c.id}, ${i + 1}, ${m})`));
  redirect(`/admin/${c.id}`);
}

export async function salvarCaderno(id: string, f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect(`/admin/${id}?erro=titulo`);
  // endereço do ambiente de teste: opcional, só http(s)
  const ambiente = opc(f, "ambiente_url");
  if (ambiente && !/^https?:$/.test((() => { try { return new URL(ambiente).protocol; } catch { return ""; } })())) redirect(`/admin/${id}?erro=ambiente`);
  await sql`update cadernos set titulo = ${titulo}, versao = ${txt(f, "versao") || "1.0"}, preparado_por = ${txt(f, "preparado_por")}, antes = ${txt(f, "antes")}, ambiente_url = ${ambiente}, atualizado = now() where id = ${id}`;
  redirect(`/admin/${id}?salvo=1`);
}

export async function excluirCaderno(id: string) {
  await exigirAdmin();
  await naoSeConcluido(id);
  const [c] = await sql`select slug from cadernos where id = ${id}`;
  if (c) {
    // tudo ou nada: não sobram respostas (com e-mails de clientes) nem histórico de um caderno que já não existe
    await sql.transaction([
      sql`delete from historico where caderno = ${c.slug}`,
      sql`delete from respostas_item where caderno = ${c.slug}`,
      sql`delete from aceites where caderno = ${c.slug}`, // termos: nome, e-mail e IP de quem aceitou
      sql`delete from respostas where caderno = ${c.slug}`, // tabela antiga, por tela
      sql`delete from respostas_passo where caderno = ${c.slug}`, // respostas aos passos do roteiro
      sql`delete from validadores where caderno = ${c.slug}`, // nome, e-mail e chave de quem validou
      sql`delete from cadernos where id = ${id}`, // apaga junto os módulos e as telas
    ]);
  }
  redirect("/admin");
}

// ---------- módulos ----------

export async function criarModulos(cadernoId: string, f: FormData) {
  await exigirAdmin();
  await naoSeConcluido(cadernoId);
  const titulos = linhas(f, "titulos");
  if (!titulos.length) redirect(`/admin/${cadernoId}?erro=modulos`);
  const [{ n }] = await sql`select coalesce(max(ordem), 0)::int as n from modulos where caderno_id = ${cadernoId}`;
  await sql.transaction(titulos.map((t, i) => sql`insert into modulos (caderno_id, ordem, titulo) values (${cadernoId}, ${n + i + 1}, ${t})`));
  redirect(`/admin/${cadernoId}?salvo=1`);
}

export async function renomearModulo(cadernoId: string, moduloId: string, f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect(`/admin/${cadernoId}?erro=modulo_nome`);
  await sql`update modulos set titulo = ${titulo} where id = ${moduloId} and caderno_id = ${cadernoId}`;
  redirect(`/admin/${cadernoId}?salvo=1`);
}

export async function moverModulo(cadernoId: string, moduloId: string, dir: -1 | 1) {
  await exigirAdmin();
  const m = await sql`select id, ordem from modulos where caderno_id = ${cadernoId} order by ordem`;
  const i = m.findIndex((x) => x.id === moduloId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= m.length) return;
  await sql`update modulos set ordem = case id when ${m[i].id}::uuid then ${m[j].ordem}::int else ${m[i].ordem}::int end where id in (${m[i].id}, ${m[j].id})`;
  revalidatePath(`/admin/${cadernoId}`);
}

export async function excluirModulo(cadernoId: string, moduloId: string) {
  await exigirAdmin();
  await naoSeConcluido(cadernoId);
  const [c] = await sql`select slug from cadernos where id = ${cadernoId}`;
  if (c) {
    // apaga as telas do módulo (e pop-ups), as respostas e o histórico das funcionalidades delas. Tudo ou nada.
    await sql.transaction([
      sql`delete from historico where caderno = ${c.slug} and item in (select e->>'id' from telas t, jsonb_array_elements(t.itens) e where t.modulo_id = ${moduloId} and t.caderno_id = ${cadernoId})`,
      sql`delete from respostas_item where caderno = ${c.slug} and item in (select e->>'id' from telas t, jsonb_array_elements(t.itens) e where t.modulo_id = ${moduloId} and t.caderno_id = ${cadernoId})`,
      sql`delete from respostas_passo where caderno = ${c.slug} and item in (select e->>'id' from telas t, jsonb_array_elements(t.itens) e where t.modulo_id = ${moduloId} and t.caderno_id = ${cadernoId})`,
      sql`delete from modulos where id = ${moduloId} and caderno_id = ${cadernoId}`, // apaga junto as telas
    ]);
  }
  redirect(`/admin/${cadernoId}?salvo=1`);
}

// ---------- telas ----------

// Cria várias telas só com o título (ficam "Em preparação" até a autora cadastrar as funcionalidades)
export async function criarTelasEmLote(cadernoId: string, moduloId: string, f: FormData) {
  await exigirAdmin();
  await naoSeConcluido(cadernoId);
  const titulos = linhas(f, "titulos");
  if (!titulos.length) redirect(`/admin/${cadernoId}?erro=telas`);
  const [m] = await sql`select 1 from modulos where id = ${moduloId} and caderno_id = ${cadernoId}`;
  if (!m) redirect(`/admin/${cadernoId}?erro=modulo`);
  const [{ n }] = await sql`select coalesce(max(ordem), 0)::int as n from telas where caderno_id = ${cadernoId}`;
  await sql.transaction(titulos.map((t, i) => sql`insert into telas (caderno_id, modulo_id, ordem, titulo, itens) values (${cadernoId}, ${moduloId}, ${n + i + 1}, ${t}, '[]'::jsonb)`));
  redirect(`/admin/${cadernoId}?salvo=1`);
}

export async function salvarTela(cadernoId: string, telaId: string | null, f: FormData) {
  await exigirAdmin();
  await naoSeConcluido(cadernoId);
  const titulo = txt(f, "titulo");
  if (!titulo) redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=titulo`);
  if (telaId) {
    const [existe] = await sql`select 1 from telas where id = ${telaId} and caderno_id = ${cadernoId}`;
    if (!existe) redirect(`/admin/${cadernoId}?erro=tela`);
  }
  const nomes = f.getAll("itemNome").map(String);
  const fazs = f.getAll("itemFaz").map(String);
  const imagens = f.getAll("itemImagem").map(String);
  const ids = f.getAll("itemId").map(String);
  const roteiros = f.getAll("itemPassos").map(String);
  // cada item mantém o id (é a chave das respostas) e ganha um novo se for item novo.
  // Os passos do roteiro também mantêm o id. Cada passo precisa de "O que fazer" e "O que deve acontecer".
  let roteiroInvalido = false;
  const itens: Item[] = nomes
    .map((nome, i) => {
      const passos = lerPassos(roteiros[i] ?? "", randomUUID, ehUuid);
      if (passos === null && nome.trim()) roteiroInvalido = true;
      return {
        id: ehUuid(ids[i] ?? "") ? ids[i] : randomUUID(),
        nome: nome.trim(),
        faz: (fazs[i] ?? "").trim(),
        ...(imagens[i] ? { imagem: imagens[i] } : {}),
        ...(passos?.length ? { passos } : {}),
      };
    })
    .filter((i) => i.nome);
  if (roteiroInvalido) redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=passo`);

  // Pop-up: a tela pai tem que ser uma tela principal do mesmo caderno, e uma tela que já tem pop-ups não pode virar pop-up.
  // O pop-up sempre fica no módulo da tela pai. Tela principal escolhe o módulo.
  const paiId = opc(f, "pai_id");
  let moduloId: string | null = null;
  if (paiId) {
    const [pai] = await sql`select modulo_id from telas where id::text = ${paiId} and caderno_id = ${cadernoId} and pai_id is null and id::text <> ${telaId ?? ""}`;
    const [filhos] = telaId ? await sql`select 1 from telas where pai_id = ${telaId} limit 1` : [];
    if (!pai || filhos) redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=pai`);
    moduloId = pai.modulo_id;
  } else {
    const escolhido = opc(f, "modulo_id");
    const [m] = escolhido ? await sql`select 1 from modulos where id::text = ${escolhido} and caderno_id = ${cadernoId}` : [];
    if (!m) redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=modulo`);
    moduloId = escolhido;
  }

  // links e arquivos só podem ser endereços seguros: nada de javascript: nem endereços internos
  const link = opc(f, "link_url");
  const imagem = opc(f, "imagem_url");
  const pdf = opc(f, "pdf_url");
  const urlDe = (v: string | null, soBlob: boolean) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      if (soBlob) return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  };
  if (!urlDe(link, false) || !urlDe(imagem, true) || !urlDe(pdf, true) || !itens.every((i) => urlDe(i.imagem ?? null, true))) {
    redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=url`);
  }
  const dados = { titulo, imagem, link, pdf, itens: JSON.stringify(itens) };
  if (telaId) {
    const feito = await sql`update telas set titulo = ${dados.titulo}, imagem_url = ${dados.imagem}, link_url = ${dados.link}, pdf_url = ${dados.pdf}, itens = ${dados.itens}::jsonb, pai_id = ${paiId}::uuid, modulo_id = ${moduloId}::uuid where id = ${telaId} and caderno_id = ${cadernoId} returning id`;
    if (!feito.length) redirect(`/admin/${cadernoId}?erro=tela`); // a tela foi excluída enquanto você editava
    // os pop-ups acompanham a tela quando ela muda de módulo
    await sql`update telas set modulo_id = ${moduloId}::uuid where pai_id = ${telaId}`;
  } else {
    await sql`
      insert into telas (caderno_id, modulo_id, ordem, titulo, imagem_url, link_url, pdf_url, itens, pai_id)
      values (${cadernoId}, ${moduloId}::uuid, (select coalesce(max(ordem), 0) + 1 from telas where caderno_id = ${cadernoId}), ${dados.titulo}, ${dados.imagem}, ${dados.link}, ${dados.pdf}, ${dados.itens}::jsonb, ${paiId}::uuid)`;
  }
  await sql`update cadernos set atualizado = now() where id = ${cadernoId}`;
  redirect(`/admin/${cadernoId}?salvo=1`);
}

export async function excluirTela(cadernoId: string, telaId: string) {
  await exigirAdmin();
  await naoSeConcluido(cadernoId);
  await sql`delete from telas where id = ${telaId} and caderno_id = ${cadernoId}`;
  revalidatePath(`/admin/${cadernoId}`);
}

// Sobe ou desce a tela entre as irmãs (mesmo módulo e mesma tela pai)
export async function moverTela(cadernoId: string, telaId: string, dir: -1 | 1) {
  await exigirAdmin();
  const [atual] = await sql`select pai_id, modulo_id from telas where id = ${telaId} and caderno_id = ${cadernoId}`;
  if (!atual) return;
  const t = await sql`
    select id, ordem from telas
    where caderno_id = ${cadernoId} and modulo_id is not distinct from ${atual.modulo_id}::uuid and pai_id is not distinct from ${atual.pai_id}::uuid
    order by ordem`;
  const i = t.findIndex((x) => x.id === telaId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.length) return;
  await sql`update telas set ordem = case id when ${t[i].id}::uuid then ${t[j].ordem}::int else ${t[i].ordem}::int end where id in (${t[i].id}, ${t[j].id})`;
  revalidatePath(`/admin/${cadernoId}`);
}

// ---------- correção (auditada) ----------

// Quem monta o caderno avisa que ajustou uma funcionalidade que estava NÃO OK. Fica no histórico e o cliente vê "corrigido, teste de novo".
export async function marcarCorrigido(cadernoId: string, itemId: string, f: FormData) {
  await exigirAdmin();
  const [t] = await sql`
    select t.id, c.slug from telas t join cadernos c on c.id = t.caderno_id
    where t.caderno_id = ${cadernoId} and t.itens @> jsonb_build_array(jsonb_build_object('id', ${itemId}::text))`;
  if (!t) redirect(`/admin/${cadernoId}?erro=item`);
  await sql`
    insert into historico (caderno, tela, item, ator, nome, tipo, para, obs)
    values (${t.slug}, ${t.id}, ${itemId}, 'autora', 'Equipe', 'correcao', 'corrigido', ${txt(f, "nota").slice(0, 2000)})`;
  revalidatePath(`/admin/${cadernoId}`);
}

// ---------- quem valida ----------

// Gera um novo link para continuar (a chave antiga deixa de valer). Para quem perdeu o link ou usou o e-mail de outra pessoa.
export async function novoLinkDeValidador(cadernoId: string, email: string) {
  await exigirAdmin();
  const [c] = await sql`select slug from cadernos where id = ${cadernoId}`;
  if (!c) redirect(`/admin?erro=caderno`);
  const chave = novaChave();
  const feito = await sql`update validadores set token_hash = ${hashDaChave(chave)} where caderno = ${c.slug} and email = ${email} returning email`;
  if (!feito.length) redirect(`/admin/${cadernoId}/respostas?erro=validador`);
  redirect(`/admin/${cadernoId}/respostas?novo=${encodeURIComponent(email)}#k=${chave}`);
}
