import { sql } from "@/lib/db";

export type Situacao = { ok: number; naoOk: number; naoTestado: number; aprovada: boolean };

// Situação de cada tela (por id) na rodada. Aprovada = pelo menos um OK e nenhum NÃO OK.
export async function situacao(slug: string, rodada: number): Promise<Record<string, Situacao>> {
  const rows = await sql`
    select tela,
      count(*) filter (where resultado = 'ok')::int as ok,
      count(*) filter (where resultado = 'nao_ok')::int as nao_ok,
      count(*) filter (where resultado = 'nao_testado')::int as nao_testado
    from respostas where caderno = ${slug} and rodada = ${rodada} group by tela`;
  return Object.fromEntries(
    rows.map((r) => [r.tela, { ok: r.ok, naoOk: r.nao_ok, naoTestado: r.nao_testado, aprovada: r.ok > 0 && r.nao_ok === 0 }]),
  );
}
