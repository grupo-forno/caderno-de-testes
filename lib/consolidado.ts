import { sql } from "@/lib/db";
import type { Resultado } from "@/lib/tipos";

// Resultado de cada funcionalidade (por id do item) somando as respostas de todas as pessoas:
// qualquer NÃO OK pesa mais, depois OK, depois NÃO TESTADO.
export async function consolidado(slug: string): Promise<Record<string, Resultado>> {
  const rows = await sql`
    select item,
      bool_or(resultado = 'nao_ok') as tem_nao_ok,
      bool_or(resultado = 'ok') as tem_ok
    from respostas_item where caderno = ${slug} group by item`;
  return Object.fromEntries(
    rows.map((r) => [r.item, (r.tem_nao_ok ? "nao_ok" : r.tem_ok ? "ok" : "nao_testado") as Resultado]),
  );
}
