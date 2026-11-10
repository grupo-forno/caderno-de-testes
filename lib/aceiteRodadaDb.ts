import { sql } from "@/lib/db";
import { avaliarAceite, impressao, situacaoDoAceite, type EntradaAtribuicao, type EntradaPendencia, type SituacaoAceite } from "@/lib/aceiteRodada";
import type { CenarioSnap } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";

// Último registro de decisão ou reabertura da rodada
export async function ultimoRegistro(rodadaId: string) {
  const [u] = await sql`select id, tipo, autor, justificativa, versao, criado from rodada_aceites where rodada_id = ${rodadaId} order by criado desc, id desc limit 1`;
  return u as { id: string; tipo: string; autor: string; justificativa: string; versao: string; criado: string } | undefined;
}

// A rodada está aprovada e travada? Depois de uma aprovação ninguém muda as respostas que embasaram a decisão, até reabrir.
export async function rodadaAprovada(rodadaId: string): Promise<{ em: string; autor: string } | null> {
  const u = await ultimoRegistro(rodadaId);
  return u && situacaoDoAceite(u) === "aprovada" ? { em: new Date(u.criado).toISOString(), autor: u.autor } : null;
}

export const MSG_APROVADA = (a: { em: string }) =>
  `Esta rodada foi aprovada em ${new Date(a.em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} e está só para leitura. Para continuar, peça a quem preparou a rodada para reabri-la.`;

// Tudo que a tela de aceite precisa, já calculado
export async function carregarAceite(rodadaId: string) {
  const atribs = await sql`
    select a.id, a.validador_id, a.enviado_em, rc.id as rc, rc.snapshot, v.nome as validador
    from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id join rodada_validadores v on v.id = a.validador_id
    where rc.rodada_id = ${rodadaId} order by rc.ordem, v.nome`;
  const rs = await sql`select x.atribuicao_id, x.passo, x.resultado, x.obs, x.anexos from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;
  const resp = new Map<string, RespPasso>(rs.map((x) => [`${x.atribuicao_id}|${x.passo}`, { resultado: x.resultado, obs: x.obs, anexos: x.anexos }]));
  const entradaA: EntradaAtribuicao[] = atribs.map((a) => ({
    id: a.id,
    validadorId: a.validador_id,
    validador: a.validador,
    cenario: (a.snapshot as CenarioSnap).titulo,
    rcId: a.rc,
    enviado: !!a.enviado_em,
    passos: (a.snapshot as CenarioSnap).passos.map((p, i) => ({ id: p.id, n: i + 1, resp: resp.get(`${a.id}|${p.id}`) })),
  }));
  const ps = await sql`
    select p.id, p.atribuicao_id, p.passo, p.situacao,
      exists (select 1 from pendencia_retestes t where t.pendencia_id = p.id and t.status = 'solicitado') as reteste_aberto,
      (select t.versao from pendencia_retestes t where t.pendencia_id = p.id and t.resultado = 'resolvida' order by t.numero desc limit 1) as build
    from pendencias p where p.rodada_id = ${rodadaId}`;
  const entradaP: EntradaPendencia[] = ps.map((p) => ({ id: p.id, atribuicaoId: p.atribuicao_id, passo: p.passo, situacao: p.situacao, retesteAberto: p.reteste_aberto, build: p.build }));
  const resumo = avaliarAceite(entradaA, entradaP);

  // escopo publicado: cada cenário com quem o executa
  const escopo: { titulo: string; validadores: string[] }[] = [];
  for (const a of atribs) {
    const t = (a.snapshot as CenarioSnap).titulo;
    const e = escopo.find((x) => x.titulo === t);
    if (e) e.validadores.push(a.validador);
    else escopo.push({ titulo: t, validadores: [a.validador] });
  }
  const historico = await sql`select id, tipo, autor, justificativa, versao, retrato, criado from rodada_aceites where rodada_id = ${rodadaId} order by criado desc, id desc`;
  const ultimo = historico[0];
  const situacao: SituacaoAceite = situacaoDoAceite(ultimo as { tipo: string } | undefined);
  return { resumo, escopo, historico, ultimo, situacao, impressao: impressao(resumo) };
}
