"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { rodadaAprovada } from "@/lib/aceiteRodadaDb";
import { passosDoPedido } from "@/lib/pendencias";
import type { CenarioSnap } from "@/lib/rodadas";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const txt = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const AUTOR = "Equipe";
// Valor único em cada confirmação: sem isso, salvar duas vezes na mesma página manda para o mesmo endereço e o Next não recarrega os dados
const salvo = () => Date.now().toString(36);
const voltar = (c: string, r: string, p: string) => `/admin/${c}/rodadas/${r}/pendencias/${p}`;

// Toda ação confere a permissão no servidor (exigirAdmin) e que a pendência é da rodada e do caderno informados
async function daPendencia(cadernoId: string, rodadaId: string, pendenciaId: string) {
  if (![cadernoId, rodadaId, pendenciaId].every(ehUuid)) redirect(`/admin/${cadernoId}/rodadas/${rodadaId}/pendencias?erro=pendencia`);
  const [p] = await sql`
    select p.*, rc.snapshot from pendencias p join rodadas r on r.id = p.rodada_id
    join rodada_atribuicoes a on a.id = p.atribuicao_id join rodada_cenarios rc on rc.id = a.rodada_cenario_id
    where p.id = ${pendenciaId} and p.rodada_id = ${rodadaId} and r.caderno_id = ${cadernoId}`;
  if (!p) redirect(`/admin/${cadernoId}/rodadas/${rodadaId}/pendencias?erro=pendencia`);
  return p;
}

export async function atribuirPendencia(cadernoId: string, rodadaId: string, pendenciaId: string, f: FormData) {
  await exigirAdmin();
  const p = await daPendencia(cadernoId, rodadaId, pendenciaId);
  const quem = txt(f, "responsavel", 120);
  if (quem === p.responsavel) redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?salvo=${salvo()}`);
  await sql.transaction([
    sql`update pendencias set responsavel = ${quem}, atualizado = now() where id = ${pendenciaId}`,
    sql`insert into pendencia_eventos (pendencia_id, tipo, autor, obs, dados) values (${pendenciaId}, 'atribuida', ${AUTOR}, ${quem ? `Responsável: ${quem}` : "Responsável removido"}, ${JSON.stringify({ de: p.responsavel, para: quem })}::jsonb)`,
  ]);
  redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?salvo=${salvo()}`);
}

// Aberta -> Em correção (só sai de Aberta: clique repetido não faz nada)
export async function iniciarCorrecao(cadernoId: string, rodadaId: string, pendenciaId: string) {
  await exigirAdmin();
  await daPendencia(cadernoId, rodadaId, pendenciaId);
  await sql.transaction([
    sql`update pendencias set situacao = 'em_correcao', atualizado = now() where id = ${pendenciaId} and situacao = 'aberta'`,
    sql`insert into pendencia_eventos (pendencia_id, tipo, autor, obs) select ${pendenciaId}::uuid, 'em_correcao', ${AUTOR}, 'Correção iniciada' where exists (select 1 from pendencias where id = ${pendenciaId}::uuid and situacao = 'em_correcao' and atualizado = now())`,
  ]);
  redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?salvo=${salvo()}`);
}

// Anota o que foi feito para corrigir. Não muda a situação: quem muda é o pedido de reteste.
export async function registrarCorrecao(cadernoId: string, rodadaId: string, pendenciaId: string, f: FormData) {
  await exigirAdmin();
  const p = await daPendencia(cadernoId, rodadaId, pendenciaId);
  const nota = txt(f, "nota", 3000);
  if (!nota) redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?erro=nota#correcao`);
  if (p.situacao === "resolvida") redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?erro=resolvida`);
  await sql.transaction([
    sql`update pendencias set situacao = case when situacao = 'aberta' then 'em_correcao' else situacao end, atualizado = now() where id = ${pendenciaId}`,
    sql`insert into pendencia_eventos (pendencia_id, tipo, autor, obs) values (${pendenciaId}, 'correcao', ${AUTOR}, ${nota})`,
  ]);
  redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?salvo=${salvo()}`);
}

// Link para uma issue externa (só guarda o endereço: não existe integração)
export async function vincularIssue(cadernoId: string, rodadaId: string, pendenciaId: string, f: FormData) {
  await exigirAdmin();
  await daPendencia(cadernoId, rodadaId, pendenciaId);
  const url = txt(f, "issue_url", 500);
  if (url) {
    let ok = false;
    try {
      ok = /^https?:$/.test(new URL(url).protocol);
    } catch {}
    if (!ok) redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?erro=issue#issue`);
  }
  await sql.transaction([
    sql`update pendencias set issue_url = ${url || null}, atualizado = now() where id = ${pendenciaId}`,
    sql`insert into pendencia_eventos (pendencia_id, tipo, autor, obs) values (${pendenciaId}, 'issue', ${AUTOR}, ${url ? `Issue vinculada: ${url}` : "Issue desvinculada"})`,
  ]);
  redirect(`${voltar(cadernoId, rodadaId, pendenciaId)}?salvo=${salvo()}`);
}

// Pede um reteste: o validador ganha uma nova tentativa com os passos escolhidos. O passo que falhou sempre entra.
// Só existe um pedido aberto por pendência (o banco garante), então clique repetido não cria dois pedidos.
export async function solicitarReteste(cadernoId: string, rodadaId: string, pendenciaId: string, f: FormData) {
  await exigirAdmin();
  const p = await daPendencia(cadernoId, rodadaId, pendenciaId);
  const aqui = voltar(cadernoId, rodadaId, pendenciaId);
  const corrigido = txt(f, "corrigido", 3000);
  const versao = txt(f, "versao", 120);
  if (!corrigido) redirect(`${aqui}?erro=corrigido#reteste`);
  if (!versao) redirect(`${aqui}?erro=versao#reteste`);
  if (p.situacao === "resolvida") redirect(`${aqui}?erro=resolvida`);
  if (await rodadaAprovada(rodadaId)) redirect(`${aqui}?erro=aprovada`);

  const doCenario = (p.snapshot as CenarioSnap).passos.map((x) => x.id);
  if (!doCenario.includes(p.passo)) redirect(`${aqui}?erro=pendencia`);
  const passos = passosDoPedido(p.passo, f.getAll("passo").map(String), doCenario);
  const passosJson = JSON.stringify(passos);

  await sql.transaction([
    sql`
      insert into pendencia_retestes (pendencia_id, atribuicao_id, numero, corrigido, versao, passos, solicitado_por)
      select ${pendenciaId}::uuid, ${p.atribuicao_id}::uuid, coalesce(max(numero), 0) + 1, ${corrigido}, ${versao}, ${passosJson}::jsonb, ${AUTOR}
      from pendencia_retestes where pendencia_id = ${pendenciaId}::uuid
      having not exists (select 1 from pendencia_retestes where pendencia_id = ${pendenciaId}::uuid and status = 'solicitado')
         and exists (select 1 from pendencias where id = ${pendenciaId}::uuid and situacao <> 'resolvida')
      on conflict do nothing`,
    sql`
      update pendencias set situacao = 'aguardando_reteste', atualizado = now()
      where id = ${pendenciaId}::uuid and exists (select 1 from pendencia_retestes where pendencia_id = ${pendenciaId}::uuid and status = 'solicitado' and solicitado_em = now())`,
    sql`
      insert into pendencia_eventos (pendencia_id, tipo, autor, obs, dados)
      select ${pendenciaId}::uuid, 'reteste_solicitado', ${AUTOR}, ${corrigido}, jsonb_build_object('reteste', t.id, 'numero', t.numero, 'versao', t.versao, 'passos', t.passos)
      from pendencia_retestes t where t.pendencia_id = ${pendenciaId}::uuid and t.status = 'solicitado' and t.solicitado_em = now()`,
  ]);
  redirect(`${aqui}?salvo=${salvo()}`);
}
