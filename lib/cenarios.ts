// Regras da biblioteca de cenários, sem banco e sem React.
// @ts-expect-error o node (usado em scripts/teste-cenarios.ts) pede a extensão .ts; o tsc do projeto não
import { lerPassos } from "./passos.ts";
import type { Passo } from "@/lib/tipos";

export type TipoCenario = "desenho" | "funcional";
export type SituacaoCenario = "ativo" | "arquivado";
export const ROTULO_TIPO: Record<TipoCenario, string> = { desenho: "Revisão de desenho", funcional: "Teste funcional" };
export const TIPOS = Object.keys(ROTULO_TIPO) as TipoCenario[];

// Um passo do cenário: o mesmo do roteiro (fazer e esperado), mais onde (tela) e quem (perfil) executa
export type PassoCenario = Passo & { telaId: string | null; perfil: string };

export type Cenario = {
  id: string;
  titulo: string;
  objetivo: string;
  tipo: TipoCenario;
  preRequisitos: string;
  dadosTeste: string;
  telaId: string | null; // tela principal: vale para os passos que não indicam outra
  passos: PassoCenario[];
  situacao: SituacaoCenario;
  atualizado: string;
};

export const MAX_PERFIL = 60;

// Lê os passos que vieram do formulário. Cada passo precisa de "O que fazer" e "O que deve acontecer" (mesma regra do roteiro).
// Tela que não é do caderno vira "sem tela". Devolve null se o texto estiver inválido.
export function lerPassosCenario(json: string, telasValidas: Set<string>, novoId: () => string, ehId: (v: string) => boolean): PassoCenario[] | null {
  const base = lerPassos(json, novoId, ehId);
  if (base === null) return null;
  const bruto = base.length ? (JSON.parse(json) as Record<string, unknown>[]) : [];
  return base.map((p, i) => {
    const telaId = typeof bruto[i]?.telaId === "string" && telasValidas.has(bruto[i].telaId as string) ? (bruto[i].telaId as string) : null;
    const perfil = typeof bruto[i]?.perfil === "string" ? (bruto[i].perfil as string).trim().slice(0, MAX_PERFIL) : "";
    return { ...p, telaId, perfil };
  });
}

// Tela de um passo: a dele, ou a principal do cenário
export const telaDoPasso = (c: Pick<Cenario, "telaId">, p: PassoCenario) => p.telaId ?? c.telaId;

// Módulos (ids, na ordem em que aparecem) e perfis (nomes, sem repetir) que o cenário atravessa
export function contextoDoCenario(c: Pick<Cenario, "telaId" | "passos">, moduloDaTela: Map<string, string>): { modulos: string[]; perfis: string[] } {
  const modulos = new Set<string>();
  const perfis = new Set<string>();
  const tela = (id: string | null) => {
    const m = id ? moduloDaTela.get(id) : undefined;
    if (m) modulos.add(m);
  };
  tela(c.telaId);
  for (const p of c.passos) {
    tela(p.telaId);
    if (p.perfil) perfis.add(p.perfil);
  }
  return { modulos: [...modulos], perfis: [...perfis] };
}

export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Cenários que envolvem uma tela (a principal ou a de algum passo)
export const envolveTela = (c: Pick<Cenario, "telaId" | "passos">, telaId: string) => c.telaId === telaId || c.passos.some((p) => p.telaId === telaId);
