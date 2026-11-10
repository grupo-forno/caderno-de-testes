"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { montarRetrato, validarDecisao, type TipoDecisao } from "@/lib/aceiteRodada";
import { carregarAceite } from "@/lib/aceiteRodadaDb";
import { sql } from "@/lib/db";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const txt = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const salvo = () => Date.now().toString(36);
const aqui = (c: string, r: string) => `/admin/${c}/rodadas/${r}/aceite`;

// Quem registra decisão ou reabre é a área interna: a permissão é conferida aqui, no servidor, em toda ação.
// O validador (que só tem o link de convite) nunca chega até estas ações.
async function daRodada(cadernoId: string, rodadaId: string) {
  await exigirAdmin();
  if (!ehUuid(cadernoId) || !ehUuid(rodadaId)) redirect("/admin");
  const [r] = await sql`select id, versao, ambiente_url, situacao from rodadas where id = ${rodadaId} and caderno_id = ${cadernoId}`;
  if (!r) redirect(`/admin/${cadernoId}/rodadas?erro=rodada`);
  if (r.situacao !== "em_validacao") redirect(`${aqui(cadernoId, rodadaId)}?erro=rascunho`);
  return r;
}

// Registra a decisão. O servidor refaz o cálculo e só grava se o resumo ainda for o que o responsável viu (impressão),
// e o token garante que clique repetido ou reenvio não cria uma segunda decisão.
export async function registrarDecisao(cadernoId: string, rodadaId: string, f: FormData) {
  const r = await daRodada(cadernoId, rodadaId);
  const base = aqui(cadernoId, rodadaId);
  const token = txt(f, "token", 80);
  if (!token) redirect(`${base}?erro=token`);
  const autor = txt(f, "autor", 120);
  if (!autor) redirect(`${base}?erro=autor`);
  const decisao = txt(f, "decisao") as TipoDecisao;
  const justificativa = txt(f, "justificativa", 3000);

  const dados = await carregarAceite(rodadaId);
  // já existe um registro com este token? Foi um reenvio: mostra o resultado e não grava de novo
  const [repetido] = await sql`select 1 from rodada_aceites where rodada_id = ${rodadaId} and token = ${token}`;
  if (repetido) redirect(`${base}?decisao=${salvo()}`);
  if (dados.situacao === "aprovada") redirect(`${base}?erro=aprovada`);
  if (txt(f, "impressao", 40) !== dados.impressao) redirect(`${base}?erro=mudou`);
  const erro = validarDecisao(decisao, justificativa, dados.resumo);
  if (erro) redirect(`${base}?erro=regra`);

  // pendências relacionadas (só para "Solicitar correções"): precisam ser desta rodada
  let relacionadas: string[] = [];
  if (decisao === "correcoes") {
    const quer = f.getAll("pendencia").map(String).filter(ehUuid);
    const ok = quer.length ? await sql`select id from pendencias where rodada_id = ${rodadaId} and id = any(${quer}::uuid[])` : [];
    relacionadas = ok.map((x) => x.id as string);
  }
  const retrato = montarRetrato(dados.resumo, { versao: r.versao, ambiente: r.ambiente_url, escopo: dados.escopo, relacionadas });
  await sql`
    insert into rodada_aceites (rodada_id, tipo, autor, justificativa, versao, retrato, token)
    values (${rodadaId}, ${decisao}, ${autor}, ${justificativa}, ${r.versao}, ${JSON.stringify(retrato)}::jsonb, ${token})
    on conflict (rodada_id, token) do nothing`;
  redirect(`${base}?decisao=${salvo()}`);
}

// Reabre uma rodada aprovada, com motivo obrigatório. O aceite anterior continua no histórico, sem mudança.
export async function reabrirRodada(cadernoId: string, rodadaId: string, f: FormData) {
  await daRodada(cadernoId, rodadaId);
  const base = aqui(cadernoId, rodadaId);
  const token = txt(f, "token", 80);
  if (!token) redirect(`${base}?erro=token`);
  const autor = txt(f, "autor", 120);
  if (!autor) redirect(`${base}?erro=autor`);
  const motivo = txt(f, "motivo", 3000);
  if (motivo.length < 5) redirect(`${base}?erro=motivo`);
  const dados = await carregarAceite(rodadaId);
  const [repetido] = await sql`select 1 from rodada_aceites where rodada_id = ${rodadaId} and token = ${token}`;
  if (repetido) redirect(`${base}?reaberta=${salvo()}`);
  if (dados.situacao !== "aprovada") redirect(`${base}?erro=naoaprovada`);
  await sql`
    insert into rodada_aceites (rodada_id, tipo, autor, justificativa, retrato, token)
    values (${rodadaId}, 'reabertura', ${autor}, ${motivo}, ${JSON.stringify({ reabre: dados.ultimo.id })}::jsonb, ${token})
    on conflict (rodada_id, token) do nothing`;
  redirect(`${base}?reaberta=${salvo()}`);
}

