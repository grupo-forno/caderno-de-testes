import { sql } from "@/lib/db";
import { progresso, somar, type CenarioSnap, type Progresso } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";

export type AtribAcomp = { id: string; rcId: string; validadorId: string; enviadoEm: string | null; prog: Progresso };
export type Falha = { atribuicao: string; validador: string; cenario: string; n: number; fazer: string; esperado: string; perfil: string; resultado: "diferente" | "nao_consegui"; obs: string; anexos: string[]; enviado: boolean; pendenciaId: string | null };

// Acompanhamento de uma rodada publicada: progresso por pessoa, por cenário e as falhas/bloqueios com o contexto do passo.
export async function acompanhar(rodadaId: string) {
  const validadores = await sql`select id, nome, email, nota, chave_versao from rodada_validadores where rodada_id = ${rodadaId} order by nome`;
  const rcs = await sql`select id, cenario_id, ordem, snapshot from rodada_cenarios where rodada_id = ${rodadaId} order by ordem, id`;
  const as = await sql`select a.id, a.rodada_cenario_id, a.validador_id, a.enviado_em from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;
  const rs = await sql`select x.atribuicao_id, x.passo, x.resultado, x.obs, x.anexos from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;

  const pend = new Map((await sql`select id, atribuicao_id, passo from pendencias where rodada_id = ${rodadaId}`).map((p) => [`${p.atribuicao_id}|${p.passo}`, p.id as string]));
  const snap = new Map(rcs.map((r) => [r.id as string, r.snapshot as CenarioSnap | null]));
  const respDe = new Map<string, Record<string, RespPasso>>();
  for (const x of rs) {
    const m = respDe.get(x.atribuicao_id) ?? {};
    m[x.passo] = { resultado: x.resultado, obs: x.obs, anexos: x.anexos };
    respDe.set(x.atribuicao_id, m);
  }
  const nomeDe = new Map(validadores.map((v) => [v.id as string, v.nome as string]));
  const atribuicoes: AtribAcomp[] = [];
  const falhas: Falha[] = [];
  for (const a of as) {
    const s = snap.get(a.rodada_cenario_id);
    if (!s) continue;
    const resp = respDe.get(a.id) ?? {};
    atribuicoes.push({ id: a.id, rcId: a.rodada_cenario_id, validadorId: a.validador_id, enviadoEm: a.enviado_em ? new Date(a.enviado_em).toISOString() : null, prog: progresso(s.passos.map((p) => p.id), resp, !!a.enviado_em) });
    s.passos.forEach((p, i) => {
      const r = resp[p.id];
      if (r && (r.resultado === "diferente" || r.resultado === "nao_consegui")) {
        falhas.push({ atribuicao: a.id, validador: nomeDe.get(a.validador_id) ?? "", cenario: s.titulo, n: i + 1, fazer: p.fazer, esperado: p.esperado, perfil: p.perfil, resultado: r.resultado, obs: r.obs, anexos: r.anexos, enviado: !!a.enviado_em, pendenciaId: pend.get(`${a.id}|${p.id}`) ?? null });
      }
    });
  }
  return { validadores, rcs: rcs.map((r) => ({ id: r.id as string, snapshot: r.snapshot as CenarioSnap | null })), atribuicoes, falhas, respDe };
}

// Resumo curto para a lista de rodadas
export async function progressoDaRodada(rodadaId: string): Promise<{ atribuicoes: number; enviadas: number; geral: Progresso }> {
  const a = await acompanhar(rodadaId);
  return { atribuicoes: a.atribuicoes.length, enviadas: a.atribuicoes.filter((x) => x.enviadoEm).length, geral: somar(a.atribuicoes.map((x) => x.prog)) };
}
