// Data e hora no fuso de São Paulo, ex.: "12/11/2026 14:03"
export function dataHora(d: Date | string): string {
  return new Date(d)
    .toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(", ", " ");
}

export const ROTULO_RESULTADO: Record<string, string> = { ok: "OK", nao_ok: "NÃO OK", nao_testado: "NÃO TESTADO" };
export const COR_RESULTADO: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  nao_ok: "bg-rose-100 text-rose-900 ring-rose-300",
  nao_testado: "bg-slate-100 text-slate-700 ring-slate-300",
};
