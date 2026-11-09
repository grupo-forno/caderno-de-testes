import type { Resultado, Tela } from "@/lib/tipos";

export type StatusTela = "em_preparacao" | "nao_iniciada" | "em_andamento" | "finalizada";

export type ResumoTela = {
  status: StatusTela;
  total: number; // funcionalidades
  ok: number;
  naoOk: number;
  naoTestado: number;
};

export const ROTULO_STATUS: Record<StatusTela, string> = {
  em_preparacao: "Em preparação",
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
};

const VAZIO: ResumoTela = { status: "em_preparacao", total: 0, ok: 0, naoOk: 0, naoTestado: 0 };

// Cinza: nada avaliado. Amarelo: começou e ainda há algo que não está OK. Verde: tudo OK.
// Tela sem funcionalidades ainda está em preparação (não dá para testar).
export function resumoTela(t: Tela, resultado: (itemId: string) => Resultado): ResumoTela {
  if (!t.itens.length) return VAZIO;
  let ok = 0, naoOk = 0, naoTestado = 0;
  for (const i of t.itens) {
    const r = resultado(i.id);
    if (r === "ok") ok++;
    else if (r === "nao_ok") naoOk++;
    else naoTestado++;
  }
  const total = t.itens.length;
  const status: StatusTela = ok === total ? "finalizada" : ok + naoOk > 0 ? "em_andamento" : "nao_iniciada";
  return { status, total, ok, naoOk, naoTestado };
}

// Junta várias telas (um módulo, ou o sistema todo).
// Só fica verde quando nenhuma tela está em preparação e tudo está OK.
export function juntar(rs: ResumoTela[]): ResumoTela {
  const prontas = rs.filter((r) => r.status !== "em_preparacao");
  if (!prontas.length) return VAZIO;
  const soma = prontas.reduce(
    (s, r) => ({ total: s.total + r.total, ok: s.ok + r.ok, naoOk: s.naoOk + r.naoOk, naoTestado: s.naoTestado + r.naoTestado }),
    { total: 0, ok: 0, naoOk: 0, naoTestado: 0 },
  );
  const faltaPreparar = prontas.length < rs.length;
  const status: StatusTela = !faltaPreparar && soma.ok === soma.total ? "finalizada" : soma.ok + soma.naoOk > 0 ? "em_andamento" : "nao_iniciada";
  return { status, ...soma };
}
