"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { montarSnapshot, conferirPublicacao, type TelaSnap } from "@/lib/rodadas";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const txt = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const base = (cadernoId: string) => `/admin/${cadernoId}/rodadas`;
// Valor único em cada confirmação de salvamento: sem isso, salvar duas vezes na mesma página manda para o mesmo endereço e o Next não recarrega os dados
const salvo = () => Date.now().toString(36);

// Toda ação confere a permissão no servidor (exigirAdmin) e que a rodada é do caderno informado
async function daRodada(cadernoId: string, rodadaId: string) {
  if (!ehUuid(cadernoId) || !ehUuid(rodadaId)) redirect(`${base(cadernoId)}?erro=rodada`);
  const [r] = await sql`select *, prazo::text as prazo_txt from rodadas where id = ${rodadaId} and caderno_id = ${cadernoId}`;
  if (!r) redirect(`${base(cadernoId)}?erro=rodada`);
  return r;
}
async function rascunhoDe(cadernoId: string, rodadaId: string) {
  const r = await daRodada(cadernoId, rodadaId);
  if (r.situacao !== "rascunho") redirect(`${base(cadernoId)}/${rodadaId}?erro=publicada`);
  return r;
}
const urlOk = (v: string) => {
  try {
    return /^https?:$/.test(new URL(v).protocol);
  } catch {
    return false;
  }
};

export async function criarRodada(cadernoId: string, f: FormData) {
  await exigirAdmin();
  const [c] = ehUuid(cadernoId) ? await sql`select versao, ambiente_url from cadernos where id = ${cadernoId}` : [];
  if (!c) redirect("/admin");
  const nome = txt(f, "nome", 200);
  if (!nome) redirect(`${base(cadernoId)}?erro=nome`);
  const versao = txt(f, "versao", 60) || c.versao;
  // Clique repetido (a criação pode demorar): reaproveita o rascunho em branco criado há instantes em vez de fazer outro
  const [recente] = await sql`
    select r.id from rodadas r
    where r.caderno_id = ${cadernoId} and r.situacao = 'rascunho' and r.nome = ${nome} and r.criado > now() - interval '30 seconds'
      and not exists (select 1 from rodada_cenarios rc where rc.rodada_id = r.id)
    order by r.criado desc limit 1`;
  if (recente) redirect(`${base(cadernoId)}/${recente.id}`);
  const [r] = await sql`insert into rodadas (caderno_id, nome, versao, ambiente_url) values (${cadernoId}, ${nome}, ${versao}, ${c.ambiente_url}) returning id`;
  redirect(`${base(cadernoId)}/${r.id}`);
}

// Só rascunho pode ser excluído: rodada publicada tem respostas e histórico dos validadores, que ficam guardados
export async function excluirRodada(cadernoId: string, rodadaId: string) {
  await exigirAdmin();
  await rascunhoDe(cadernoId, rodadaId);
  await sql`delete from rodadas where id = ${rodadaId} and caderno_id = ${cadernoId} and situacao = 'rascunho'`;
  redirect(`${base(cadernoId)}?excluida=1`);
}

// Rascunho: todos os dados. Publicada: só o prazo e o endereço do ambiente (o resto ficou registrado na publicação).
export async function salvarDadosRodada(cadernoId: string, rodadaId: string, f: FormData) {
  await exigirAdmin();
  const r = await daRodada(cadernoId, rodadaId);
  const aqui = `${base(cadernoId)}/${rodadaId}`;
  const ambiente = txt(f, "ambiente_url", 500) || null;
  if (ambiente && !urlOk(ambiente)) redirect(`${aqui}?erro=ambiente#campo-ambiente`);
  const prazo = txt(f, "prazo", 10) || null;
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) redirect(`${aqui}?erro=prazo#campo-prazo`);
  if (r.situacao === "em_validacao") {
    await sql`update rodadas set ambiente_url = ${ambiente}, prazo = ${prazo}::date, atualizado = now() where id = ${rodadaId}`;
    redirect(`${aqui}?salvo=${salvo()}`);
  }
  const nome = txt(f, "nome", 200);
  if (!nome) redirect(`${aqui}?erro=nome#campo-nome`);
  await sql`
    update rodadas set nome = ${nome}, versao = ${txt(f, "versao", 60)}, ambiente_url = ${ambiente}, prazo = ${prazo}::date,
      resumo = ${txt(f, "resumo")}, instrucoes = ${txt(f, "instrucoes")}, fora_escopo = ${txt(f, "fora_escopo")}, atualizado = now()
    where id = ${rodadaId} and situacao = 'rascunho'`;
  redirect(`${aqui}?salvo=${salvo()}`);
}

// Cenários da rodada: os marcados ficam, os desmarcados saem (com as atribuições deles)
export async function salvarCenariosDaRodada(cadernoId: string, rodadaId: string, f: FormData) {
  await exigirAdmin();
  await rascunhoDe(cadernoId, rodadaId);
  const quer = f.getAll("cenario").map(String).filter(ehUuid);
  const validos = await sql`select id from cenarios where caderno_id = ${cadernoId}`;
  const permitidos = new Set(validos.map((c) => c.id as string));
  const escolhidos = [...new Set(quer.filter((id) => permitidos.has(id)))];
  const atuais = await sql`select cenario_id from rodada_cenarios where rodada_id = ${rodadaId}`;
  const jaTem = new Set(atuais.map((x) => x.cenario_id as string));
  const [{ n }] = await sql`select coalesce(max(ordem), 0)::int as n from rodada_cenarios where rodada_id = ${rodadaId}`;
  const novos = escolhidos.filter((id) => !jaTem.has(id));
  const tira = [...jaTem].filter((id) => id && !escolhidos.includes(id));
  await sql.transaction([
    sql`delete from rodada_cenarios where rodada_id = ${rodadaId} and cenario_id = any(${tira}::uuid[])`,
    ...novos.map((id, i) => sql`insert into rodada_cenarios (rodada_id, cenario_id, ordem) values (${rodadaId}, ${id}, ${n + i + 1}) on conflict (rodada_id, cenario_id) do nothing`),
  ]);
  redirect(`${base(cadernoId)}/${rodadaId}?salvo=${salvo()}#secao-validadores`);
}

export async function adicionarValidador(cadernoId: string, rodadaId: string, f: FormData) {
  await exigirAdmin();
  await rascunhoDe(cadernoId, rodadaId);
  const aqui = `${base(cadernoId)}/${rodadaId}`;
  const nome = txt(f, "nome", 120);
  const email = txt(f, "email", 200).toLowerCase();
  if (!nome) redirect(`${aqui}?erro=val_nome#secao-validadores`);
  if (!EMAIL.test(email)) redirect(`${aqui}?erro=val_email#secao-validadores`);
  const feito = await sql`insert into rodada_validadores (rodada_id, nome, email, nota) values (${rodadaId}, ${nome}, ${email}, ${txt(f, "nota", 1000)}) on conflict (rodada_id, email) do nothing returning id`;
  if (!feito.length) redirect(`${aqui}?erro=val_repetido#secao-validadores`);
  redirect(`${aqui}?salvo=${salvo()}#secao-validadores`);
}

export async function removerValidador(cadernoId: string, rodadaId: string, validadorId: string) {
  await exigirAdmin();
  await rascunhoDe(cadernoId, rodadaId);
  await sql`delete from rodada_validadores where id = ${validadorId} and rodada_id = ${rodadaId}`;
  redirect(`${base(cadernoId)}/${rodadaId}?salvo=${salvo()}#secao-validadores`);
}

// Atribuições: cada caixa marcada liga um cenário da rodada a um validador. Reenviar o mesmo formulário não duplica nada.
export async function salvarAtribuicoes(cadernoId: string, rodadaId: string, f: FormData) {
  await exigirAdmin();
  await rascunhoDe(cadernoId, rodadaId);
  const rcs = new Set((await sql`select id from rodada_cenarios where rodada_id = ${rodadaId}`).map((x) => x.id as string));
  const vals = new Set((await sql`select id from rodada_validadores where rodada_id = ${rodadaId}`).map((x) => x.id as string));
  const quer: { rc: string; v: string }[] = [];
  for (const chave of f.getAll("atrib").map(String)) {
    const [rc, v] = chave.split("|");
    if (rcs.has(rc) && vals.has(v)) quer.push({ rc, v });
  }
  const atuais = await sql`select a.id, a.rodada_cenario_id, a.validador_id from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;
  const desejadas = new Set(quer.map((q) => `${q.rc}|${q.v}`));
  const sobra = atuais.filter((a) => !desejadas.has(`${a.rodada_cenario_id}|${a.validador_id}`)).map((a) => a.id as string);
  await sql.transaction([
    sql`delete from rodada_atribuicoes where id = any(${sobra}::uuid[])`,
    ...quer.map((q) => sql`insert into rodada_atribuicoes (rodada_cenario_id, validador_id) values (${q.rc}, ${q.v}) on conflict (rodada_cenario_id, validador_id) do nothing`),
  ]);
  redirect(`${base(cadernoId)}/${rodadaId}?salvo=${salvo()}#secao-publicar`);
}

// Publicar: confere de novo no servidor, grava a cópia (snapshot) de cada cenário e passa para "Em validação".
// Se o pedido for reenviado, a rodada já está publicada e nada é refeito (nem duplicado).
export async function publicarRodada(cadernoId: string, rodadaId: string) {
  await exigirAdmin();
  const r = await daRodada(cadernoId, rodadaId);
  const aqui = `${base(cadernoId)}/${rodadaId}`;
  if (r.situacao === "em_validacao") redirect(`${aqui}?publicada=1`);

  const rcs = await sql`
    select rc.id, rc.cenario_id, c.titulo, c.objetivo, c.tipo, c.pre_requisitos, c.dados_teste, c.tela_id, c.passos, c.situacao as sit,
      (select count(*)::int from rodada_atribuicoes a where a.rodada_cenario_id = rc.id) as atribuidos
    from rodada_cenarios rc left join cenarios c on c.id = rc.cenario_id where rc.rodada_id = ${rodadaId} order by rc.ordem`;
  const vals = await sql`select v.nome, (select count(*)::int from rodada_atribuicoes a where a.validador_id = v.id) as n from rodada_validadores v where v.rodada_id = ${rodadaId}`;
  const { impedem } = conferirPublicacao({
    nome: r.nome,
    versao: r.versao,
    ambienteUrl: r.ambiente_url,
    cenarios: rcs.map((c) => ({ titulo: c.titulo ?? "removido", arquivadoOuSumiu: !c.titulo || c.sit === "arquivado", passos: (c.passos ?? []).length, atribuidos: c.atribuidos })),
    validadores: vals.map((v) => ({ nome: v.nome, atribuicoes: v.n })),
  });
  if (impedem.length) redirect(`${aqui}?erro=impedimentos#secao-publicar`);

  const telas = await sql`select t.id, t.titulo, t.imagem_url, t.link_url, coalesce(m.titulo, 'Sem módulo') as modulo from telas t left join modulos m on m.id = t.modulo_id where t.caderno_id = ${cadernoId}`;
  const mapa = new Map<string, TelaSnap>(telas.map((t) => [t.id as string, { id: t.id, titulo: t.titulo, modulo: t.modulo, imagem: t.imagem_url, link: t.link_url }]));
  const snaps = rcs.map((c) => ({
    id: c.id as string,
    snap: montarSnapshot({ id: c.cenario_id, titulo: c.titulo, objetivo: c.objetivo, tipo: c.tipo, preRequisitos: c.pre_requisitos, dadosTeste: c.dados_teste, telaId: c.tela_id, passos: c.passos }, mapa),
  }));

  // tudo ou nada: a primeira instrução só acerta se a rodada ainda for rascunho. As cópias só entram onde ainda não existe cópia.
  await sql.transaction([
    sql`update rodadas set situacao = 'em_validacao', publicada_em = now(), atualizado = now() where id = ${rodadaId} and situacao = 'rascunho'`,
    ...snaps.map((s) => sql`update rodada_cenarios set snapshot = ${JSON.stringify(s.snap)}::jsonb where id = ${s.id} and snapshot is null and exists (select 1 from rodadas where id = ${rodadaId} and situacao = 'em_validacao' and publicada_em > now() - interval '1 minute')`),
  ]);
  redirect(`${aqui}?publicada=1`);
}

// Quem perdeu o link: gera um novo e o antigo deixa de valer
export async function novoLinkDeConvite(cadernoId: string, rodadaId: string, validadorId: string) {
  await exigirAdmin();
  await daRodada(cadernoId, rodadaId);
  await sql`update rodada_validadores set chave_versao = chave_versao + 1 where id = ${validadorId} and rodada_id = ${rodadaId}`;
  redirect(`${base(cadernoId)}/${rodadaId}?novolink=${salvo()}#secao-acesso`);
}

// A rodada publicada não muda. Para ajustar o roteiro, prepara-se uma nova rodada (rascunho) com os mesmos cenários, validadores e atribuições.
export async function novaRodadaAPartirDe(cadernoId: string, rodadaId: string) {
  await exigirAdmin();
  const r = await daRodada(cadernoId, rodadaId);
  const [n] = await sql`insert into rodadas (caderno_id, nome, versao, ambiente_url, prazo, resumo, instrucoes, fora_escopo, origem_rodada) values (${cadernoId}, ${`${r.nome} (nova)`.slice(0, 200)}, ${r.versao}, ${r.ambiente_url}, ${r.prazo_txt}::date, ${r.resumo}, ${r.instrucoes}, ${r.fora_escopo}, ${rodadaId}) returning id`;
  const rcs = await sql`select id, cenario_id, ordem from rodada_cenarios where rodada_id = ${rodadaId} and cenario_id is not null order by ordem`;
  const vals = await sql`select id, nome, email, nota from rodada_validadores where rodada_id = ${rodadaId}`;
  const atrib = await sql`select a.rodada_cenario_id, a.validador_id from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;
  const rcNovo = new Map<string, string>();
  for (const x of rcs) {
    const [c] = await sql`insert into rodada_cenarios (rodada_id, cenario_id, ordem) select ${n.id}, id, ${x.ordem} from cenarios where id = ${x.cenario_id} returning id`;
    if (c) rcNovo.set(x.id, c.id);
  }
  const valNovo = new Map<string, string>();
  for (const v of vals) {
    const [x] = await sql`insert into rodada_validadores (rodada_id, nome, email, nota) values (${n.id}, ${v.nome}, ${v.email}, ${v.nota}) returning id`;
    valNovo.set(v.id, x.id);
  }
  for (const a of atrib) {
    const rc = rcNovo.get(a.rodada_cenario_id);
    const v = valNovo.get(a.validador_id);
    if (rc && v) await sql`insert into rodada_atribuicoes (rodada_cenario_id, validador_id) values (${rc}, ${v}) on conflict do nothing`;
  }
  redirect(`${base(cadernoId)}/${n.id}?nova=1`);
}
