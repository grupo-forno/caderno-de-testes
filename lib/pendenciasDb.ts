import { sql } from "@/lib/db";
import type { SituacaoPendencia } from "@/lib/pendencias";
import type { CenarioSnap } from "@/lib/rodadas";

export type LinhaPendencia = {
  id: string;
  situacao: SituacaoPendencia;
  responsavel: string;
  issueUrl: string | null;
  atribuicaoId: string;
  rodadaCenarioId: string;
  passo: string;
  n: number; // posição do passo no cenário (1, 2, 3...)
  cenario: string;
  modulo: string;
  validador: string;
  criado: string;
  atualizado: string;
};

// Pendências de uma rodada, já com o cenário, o módulo e o validador
export async function listarPendencias(rodadaId: string): Promise<LinhaPendencia[]> {
  const rows = await sql`
    select p.id, p.situacao, p.responsavel, p.issue_url, p.atribuicao_id, p.passo, p.criado, p.atualizado, rc.id as rc, rc.snapshot, v.nome as validador
    from pendencias p join rodada_atribuicoes a on a.id = p.atribuicao_id join rodada_cenarios rc on rc.id = a.rodada_cenario_id
    join rodada_validadores v on v.id = a.validador_id
    where p.rodada_id = ${rodadaId} order by p.criado desc, p.id`;
  return rows.map((r) => {
    const s = r.snapshot as CenarioSnap;
    const i = s.passos.findIndex((x) => x.id === r.passo);
    return {
      id: r.id,
      situacao: r.situacao,
      responsavel: r.responsavel,
      issueUrl: r.issue_url,
      atribuicaoId: r.atribuicao_id,
      rodadaCenarioId: r.rc,
      passo: r.passo,
      n: i + 1,
      cenario: s.titulo,
      modulo: s.passos[i]?.tela?.modulo ?? s.modulos[0] ?? "Sem módulo",
      validador: r.validador,
      criado: new Date(r.criado).toISOString(),
      atualizado: new Date(r.atualizado).toISOString(),
    };
  });
}

// Bloqueios (Não consegui testar) enviados, no envio original e nos retestes: aparecem como impedimento, sem virar defeito
export async function listarBloqueios(rodadaId: string) {
  const orig = await sql`
    select x.atualizado, x.obs, rc.snapshot, x.passo, v.nome as validador
    from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id and a.enviado_em is not null
    join rodada_cenarios rc on rc.id = a.rodada_cenario_id join rodada_validadores v on v.id = a.validador_id
    where rc.rodada_id = ${rodadaId} and x.resultado = 'nao_consegui'`;
  const rt = await sql`
    select x.atualizado, x.obs, rc.snapshot, x.passo, v.nome as validador, t.numero, p.id as pendencia
    from respostas_reteste x join pendencia_retestes t on t.id = x.reteste_id and t.status = 'enviado'
    join pendencias p on p.id = t.pendencia_id join rodada_atribuicoes a on a.id = t.atribuicao_id
    join rodada_cenarios rc on rc.id = a.rodada_cenario_id join rodada_validadores v on v.id = a.validador_id
    where p.rodada_id = ${rodadaId} and x.resultado = 'nao_consegui'`;
  const linha = (r: (typeof orig)[number], origem: string, pendencia: string | null) => {
    const s = r.snapshot as CenarioSnap;
    const i = s.passos.findIndex((p) => p.id === r.passo);
    return { quando: new Date(r.atualizado).getTime(), cenario: s.titulo, n: i + 1, modulo: s.passos[i]?.tela?.modulo ?? s.modulos[0] ?? "Sem módulo", validador: r.validador as string, obs: r.obs as string, origem, pendencia };
  };
  return [...orig.map((r) => linha(r, "Envio original", null)), ...rt.map((r) => linha(r, `Reteste ${r.numero}`, r.pendencia as string))].sort((a, b) => b.quando - a.quando);
}

export const dataHoraBR = (d: string | Date) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
