"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { exigirAdmin, marcarEntrada, sairDoAdmin, senhaCorreta } from "@/lib/admin";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opc = (f: FormData, k: string) => txt(f, k) || null;

export async function entrar(f: FormData) {
  if (!senhaCorreta(txt(f, "senha"))) redirect("/admin?erro=1");
  await marcarEntrada();
  redirect("/admin");
}

export async function sair() {
  await sairDoAdmin();
  redirect("/admin");
}

function gerarSlug(titulo: string) {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "caderno";
  // sufixo aleatório: o link é aberto, então fica difícil de adivinhar
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function criarCaderno(f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect("/admin?erro=titulo");
  const [c] = await sql`
    insert into cadernos (slug, titulo, versao, preparado_por, antes)
    values (${gerarSlug(titulo)}, ${titulo}, ${txt(f, "versao") || "1.0"}, ${txt(f, "preparado_por")}, ${txt(f, "antes")})
    returning id`;
  redirect(`/admin/${c.id}`);
}

export async function salvarCaderno(id: string, f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect(`/admin/${id}?erro=titulo`);
  await sql`update cadernos set titulo = ${titulo}, versao = ${txt(f, "versao") || "1.0"}, preparado_por = ${txt(f, "preparado_por")}, antes = ${txt(f, "antes")}, atualizado = now() where id = ${id}`;
  redirect(`/admin/${id}?salvo=1`);
}

export async function excluirCaderno(id: string) {
  await exigirAdmin();
  const [c] = await sql`delete from cadernos where id = ${id} returning slug`;
  if (c) await sql`delete from respostas where caderno = ${c.slug}`;
  redirect("/admin");
}

export async function salvarTela(cadernoId: string, telaId: string | null, f: FormData) {
  await exigirAdmin();
  const titulo = txt(f, "titulo");
  if (!titulo) redirect(`/admin/${cadernoId}/tela/${telaId ?? "nova"}?erro=titulo`);
  const nomes = f.getAll("itemNome").map(String);
  const fazs = f.getAll("itemFaz").map(String);
  const itens = nomes.map((nome, i) => ({ nome: nome.trim(), faz: (fazs[i] ?? "").trim() })).filter((i) => i.nome);
  const dados = { titulo, imagem: opc(f, "imagem_url"), link: opc(f, "link_url"), pdf: opc(f, "pdf_url"), itens: JSON.stringify(itens) };
  if (telaId) {
    await sql`update telas set titulo = ${dados.titulo}, imagem_url = ${dados.imagem}, link_url = ${dados.link}, pdf_url = ${dados.pdf}, itens = ${dados.itens}::jsonb where id = ${telaId} and caderno_id = ${cadernoId}`;
  } else {
    await sql`
      insert into telas (caderno_id, ordem, titulo, imagem_url, link_url, pdf_url, itens)
      values (${cadernoId}, (select coalesce(max(ordem), 0) + 1 from telas where caderno_id = ${cadernoId}), ${dados.titulo}, ${dados.imagem}, ${dados.link}, ${dados.pdf}, ${dados.itens}::jsonb)`;
  }
  await sql`update cadernos set atualizado = now() where id = ${cadernoId}`;
  redirect(`/admin/${cadernoId}?salvo=1`);
}

export async function excluirTela(cadernoId: string, telaId: string) {
  await exigirAdmin();
  await sql`delete from telas where id = ${telaId} and caderno_id = ${cadernoId}`;
  revalidatePath(`/admin/${cadernoId}`);
}

// Quem está em "aprovada": pelo menos um OK e nenhum NÃO OK na rodada. As outras voltam para a próxima rodada.
export async function abrirProximaRodada(id: string) {
  await exigirAdmin();
  const [c] = await sql`select slug, rodada from cadernos where id = ${id}`;
  if (!c) return;
  await sql.transaction([
    sql`update telas set refazer = not (
      exists (select 1 from respostas r where r.caderno = ${c.slug} and r.rodada = ${c.rodada} and r.tela = telas.id::text and r.resultado = 'ok')
      and not exists (select 1 from respostas r where r.caderno = ${c.slug} and r.rodada = ${c.rodada} and r.tela = telas.id::text and r.resultado = 'nao_ok')
    ) where caderno_id = ${id}`,
    sql`update cadernos set rodada = rodada + 1, atualizado = now() where id = ${id}`,
  ]);
  redirect(`/admin/${id}?salvo=1`);
}

export async function alternarRefazer(cadernoId: string, telaId: string) {
  await exigirAdmin();
  await sql`update telas set refazer = not refazer where id = ${telaId} and caderno_id = ${cadernoId}`;
  revalidatePath(`/admin/${cadernoId}`);
}

export async function moverTela(cadernoId: string, telaId: string, dir: -1 | 1) {
  await exigirAdmin();
  const t = await sql`select id, ordem from telas where caderno_id = ${cadernoId} order by ordem`;
  const i = t.findIndex((x) => x.id === telaId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.length) return;
  await sql`update telas set ordem = case id when ${t[i].id} then ${t[j].ordem} else ${t[i].ordem} end where id in (${t[i].id}, ${t[j].id})`;
  revalidatePath(`/admin/${cadernoId}`);
}
