import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

// Quais destas tabelas ainda não existem neste banco (o schema novo não foi aplicado)?
export async function tabelasFaltando(nomes: string[]): Promise<string[]> {
  const r = await sql`select n from unnest(${nomes}::text[]) as n where to_regclass('public.' || n) is null`;
  return r.map((x) => x.n as string);
}

// Só o endereço do servidor do banco (sem usuário nem senha), para conferir se é o mesmo onde a atualização foi aplicada
export function enderecoDoBanco(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname || "desconhecido";
  } catch {
    return "desconhecido";
  }
}
