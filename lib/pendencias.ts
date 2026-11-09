// Regras das pendências e do reteste, sem banco e sem React.
// @ts-expect-error o node (usado em scripts/teste-pendencias.ts) pede a extensão .ts; o tsc do projeto não
import { passoCompleto } from "./passos.ts";
import type { RespPasso } from "@/lib/tipos";

export type SituacaoPendencia = "aberta" | "em_correcao" | "aguardando_reteste" | "resolvida";
export const SITUACOES: SituacaoPendencia[] = ["aberta", "em_correcao", "aguardando_reteste", "resolvida"];
export const ROTULO_PENDENCIA: Record<SituacaoPendencia, string> = { aberta: "Aberta", em_correcao: "Em correção", aguardando_reteste: "Aguardando reteste", resolvida: "Resolvida" };
export const COR_PENDENCIA: Record<SituacaoPendencia, string> = {
  aberta: "bg-rose-100 text-rose-900 ring-rose-300",
  em_correcao: "bg-amber-100 text-amber-950 ring-amber-300",
  aguardando_reteste: "bg-indigo-100 text-indigo-900 ring-indigo-300",
  resolvida: "bg-emerald-100 text-emerald-900 ring-emerald-300",
};

export type ResultadoReteste = "resolvida" | "falhou" | "bloqueado";

// Avalia as respostas de um reteste. Falha vence bloqueio, e bloqueio vence sucesso.
// "pendentes" são os passos pedidos ainda sem resposta (ou sem a explicação obrigatória): com eles o envio não é permitido.
export function avaliarReteste(passoIds: string[], resp: Record<string, RespPasso | undefined>): { pendentes: string[]; resultado: ResultadoReteste | null } {
  const pendentes = passoIds.filter((id) => !passoCompleto(resp[id]));
  if (pendentes.length) return { pendentes, resultado: null };
  const rs = passoIds.map((id) => resp[id]!.resultado);
  const resultado: ResultadoReteste = rs.includes("diferente") ? "falhou" : rs.includes("nao_consegui") ? "bloqueado" : "resolvida";
  return { pendentes, resultado };
}

// Situação da pendência depois de um reteste enviado. Bloqueio sem nova falha não muda nada: continua aguardando reteste.
export const situacaoAposReteste = (r: ResultadoReteste): SituacaoPendencia => (r === "resolvida" ? "resolvida" : r === "falhou" ? "aberta" : "aguardando_reteste");

// Pode pedir reteste quando a pendência não está resolvida e não há outro pedido esperando resposta
export const podeSolicitarReteste = (situacao: SituacaoPendencia, temPedidoAberto: boolean) => situacao !== "resolvida" && !temPedidoAberto;

// Passos do pedido: o passo que falhou sempre entra, os outros são opcionais e só valem se forem do mesmo cenário. Mantém a ordem do cenário.
export function passosDoPedido(falhou: string, escolhidos: string[], doCenario: string[]): string[] {
  const querer = new Set([falhou, ...escolhidos]);
  return doCenario.filter((id) => querer.has(id));
}
