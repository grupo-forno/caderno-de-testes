// Regras do aceite de uma rodada, sem banco e sem React: o servidor decide de verdade, a tela mostra o mesmo cálculo.
// Neste módulo todas as atribuições publicadas são obrigatórias (o projeto ainda não distingue obrigatório de opcional).
// @ts-expect-error o node (usado em scripts/teste-aceite-rodada.ts) pede a extensão .ts; o tsc do projeto não
import { passoCompleto } from "./passos.ts";
import type { RespPasso } from "@/lib/tipos";

export type TipoDecisao = "aprovada" | "aprovada_ressalvas" | "correcoes";
export const ROTULO_DECISAO: Record<TipoDecisao | "reabertura", string> = {
  aprovada: "Entrega aprovada",
  aprovada_ressalvas: "Entrega aprovada com ressalvas",
  correcoes: "Correções solicitadas",
  reabertura: "Rodada reaberta",
};
export const DECISOES: TipoDecisao[] = ["aprovada", "aprovada_ressalvas", "correcoes"];
export const APROVACOES = ["aprovada", "aprovada_ressalvas"];

// Uma referência a algo que a tela consegue abrir: a pendência (com a evidência original) ou o resultado de um validador
export type Ref = { tipo: "pendencia"; id: string } | { tipo: "validador"; id: string };
export type ItemAceite = { titulo: string; detalhe: string; ref: Ref; build?: string };

export type EntradaAtribuicao = {
  id: string;
  validadorId: string;
  validador: string;
  cenario: string;
  rcId: string;
  enviado: boolean;
  passos: { id: string; n: number; resp?: RespPasso }[];
};
export type EntradaPendencia = { id: string; atribuicaoId: string; passo: string; situacao: "aberta" | "em_correcao" | "aguardando_reteste" | "resolvida"; retesteAberto: boolean; build: string | null };

export type Contagem = { total: number; concluidas: number; comFalhas: number; bloqueadas: number; rascunho: number; semResposta: number };
const vazio = (): Contagem => ({ total: 0, concluidas: 0, comFalhas: 0, bloqueadas: 0, rascunho: 0, semResposta: 0 });
type Estado = "concluidas" | "comFalhas" | "bloqueadas" | "rascunho" | "semResposta";

export type ResumoAceite = {
  porAtribuicao: Contagem;
  porCenario: Contagem;
  porPasso: { total: number; funcionou: number; falhasResolvidas: number; falhasAbertas: number; bloqueados: number; semResposta: number };
  pendenciasAbertas: ItemAceite[];
  retestesEmAndamento: ItemAceite[];
  falhasResolvidas: ItemAceite[];
  bloqueios: ItemAceite[];
  lacunas: ItemAceite[];
  ressalvas: ItemAceite[]; // o que ficaria registrado numa aprovação com ressalvas
  impedimentos: { texto: string; ref: Ref | null }[]; // por que a aprovação sem ressalvas não está disponível
  podeAprovar: boolean;
  builds: string[]; // versões ou builds conferidos em reteste
};

const ordem: Estado[] = ["comFalhas", "bloqueadas", "rascunho", "semResposta", "concluidas"];

export function avaliarAceite(atribs: EntradaAtribuicao[], pends: EntradaPendencia[]): ResumoAceite {
  const pend = new Map(pends.map((p) => [`${p.atribuicaoId}|${p.passo}`, p]));
  const r: ResumoAceite = {
    porAtribuicao: vazio(), porCenario: vazio(),
    porPasso: { total: 0, funcionou: 0, falhasResolvidas: 0, falhasAbertas: 0, bloqueados: 0, semResposta: 0 },
    pendenciasAbertas: [], retestesEmAndamento: [], falhasResolvidas: [], bloqueios: [], lacunas: [], ressalvas: [], impedimentos: [], podeAprovar: false, builds: [],
  };
  const estadoDoCenario = new Map<string, Estado[]>();

  for (const a of atribs) {
    let falhas = 0, bloq = 0, algumaResposta = false;
    for (const p of a.passos) {
      r.porPasso.total++;
      if (p.resp) algumaResposta = true;
      const pd = pend.get(`${a.id}|${p.id}`);
      const titulo = `${a.cenario} · passo ${p.n}`;
      if (!a.enviado) { r.porPasso.semResposta++; continue; }
      if (!passoCompleto(p.resp)) { r.porPasso.semResposta++; continue; }
      const res = p.resp!.resultado;
      if (res === "funcionou") r.porPasso.funcionou++;
      else if (res === "diferente") {
        if (pd?.situacao === "resolvida") {
          r.porPasso.falhasResolvidas++;
          r.falhasResolvidas.push({ titulo, detalhe: `${a.validador}. Resolvida em reteste${pd.build ? ` (versão ${pd.build})` : ""}.`, ref: { tipo: "pendencia", id: pd.id }, build: pd.build ?? undefined });
          if (pd.build && !r.builds.includes(pd.build)) r.builds.push(pd.build);
        } else {
          falhas++;
          r.porPasso.falhasAbertas++;
          if (pd) {
            const item = { titulo, detalhe: `${a.validador}. Situação: ${pd.situacao === "aberta" ? "Aberta" : pd.situacao === "em_correcao" ? "Em correção" : "Aguardando reteste"}.`, ref: { tipo: "pendencia", id: pd.id } as Ref };
            r.pendenciasAbertas.push(item);
            if (pd.retesteAberto) r.retestesEmAndamento.push({ ...item, detalhe: `${a.validador}. Reteste esperando resposta.` });
          }
        }
      } else {
        bloq++;
        r.porPasso.bloqueados++;
        r.bloqueios.push({ titulo, detalhe: `${a.validador}. ${p.resp!.obs || "Sem motivo informado."}`, ref: { tipo: "validador", id: a.validadorId } });
      }
    }
    // estado da atribuição: falha aberta > bloqueio > (sem envio) rascunho ou sem resposta > concluída
    let e: Estado;
    if (!a.enviado) e = algumaResposta ? "rascunho" : "semResposta";
    else e = falhas > 0 ? "comFalhas" : bloq > 0 ? "bloqueadas" : "concluidas";
    r.porAtribuicao.total++;
    r.porAtribuicao[e]++;
    estadoDoCenario.set(a.rcId, [...(estadoDoCenario.get(a.rcId) ?? []), e]);
    if (!a.enviado) {
      r.lacunas.push({ titulo: a.cenario, detalhe: algumaResposta ? `${a.validador} salvou respostas, mas ainda não enviou (rascunho).` : `${a.validador} ainda não respondeu.`, ref: { tipo: "validador", id: a.validadorId } });
    }
  }
  // um cenário vale pelo pior estado entre as pessoas que o executam
  for (const estados of estadoDoCenario.values()) {
    r.porCenario.total++;
    r.porCenario[ordem.find((o) => estados.includes(o)) ?? "semResposta"]++;
  }

  // pendências abertas que não têm passo correspondente na lista (não deveria acontecer) também contam
  r.ressalvas = [...r.pendenciasAbertas, ...r.bloqueios, ...r.lacunas];

  for (const l of r.lacunas) r.impedimentos.push({ texto: `Falta enviar: ${l.titulo} (${l.detalhe})`, ref: l.ref });
  for (const p of r.pendenciasAbertas) r.impedimentos.push({ texto: `Pendência em aberto: ${p.titulo}`, ref: p.ref });
  for (const b of r.bloqueios) r.impedimentos.push({ texto: `Passo bloqueado: ${b.titulo}`, ref: b.ref });
  if (!atribs.length) r.impedimentos.push({ texto: "A rodada não tem testes atribuídos.", ref: null });
  r.podeAprovar = r.impedimentos.length === 0;
  return r;
}

// Regra do servidor: o que cada decisão exige
export function validarDecisao(decisao: string, justificativa: string, resumo: ResumoAceite): string | null {
  if (!(DECISOES as string[]).includes(decisao)) return "Escolha uma decisão.";
  if (decisao === "aprovada" && !resumo.podeAprovar) return "A entrega não pode ser aprovada sem ressalvas: ainda há itens em aberto no escopo obrigatório.";
  if (decisao !== "aprovada" && justificativa.trim().length < 5) return "Escreva a justificativa (pelo menos 5 letras).";
  if (decisao === "aprovada_ressalvas" && resumo.ressalvas.length === 0) return "Não há ressalvas a registrar. Use “Aprovar entrega”.";
  return null;
}

// Retrato guardado na decisão: tudo que foi considerado, congelado
export function montarRetrato(resumo: ResumoAceite, extra: { versao: string; ambiente: string | null; escopo: { titulo: string; validadores: string[] }[]; relacionadas: string[] }) {
  return {
    versao: extra.versao,
    ambiente: extra.ambiente,
    escopo: extra.escopo,
    contagens: { porAtribuicao: resumo.porAtribuicao, porCenario: resumo.porCenario, porPasso: resumo.porPasso },
    pendenciasAbertas: resumo.pendenciasAbertas,
    retestesEmAndamento: resumo.retestesEmAndamento,
    falhasResolvidas: resumo.falhasResolvidas,
    bloqueios: resumo.bloqueios,
    lacunas: resumo.lacunas,
    ressalvas: resumo.ressalvas,
    builds: resumo.builds,
    pendenciasRelacionadas: extra.relacionadas,
  };
}

// Impressão digital do que o responsável viu: se mudar antes de confirmar, ele precisa revisar de novo
export function impressao(resumo: ResumoAceite): string {
  const base = JSON.stringify({ c: resumo.porAtribuicao, p: resumo.porPasso, r: resumo.ressalvas.map((x) => x.titulo + x.detalhe), f: resumo.falhasResolvidas.map((x) => x.titulo + (x.build ?? "")) });
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(h, 31) + base.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// Situação da rodada a partir do último registro de decisão ou reabertura
export type SituacaoAceite = "aguardando" | "aprovada" | "correcoes" | "reaberta";
export function situacaoDoAceite(ultimo: { tipo: string } | undefined): SituacaoAceite {
  if (!ultimo) return "aguardando";
  if (ultimo.tipo === "aprovada" || ultimo.tipo === "aprovada_ressalvas") return "aprovada";
  if (ultimo.tipo === "correcoes") return "correcoes";
  return "reaberta";
}
export const ROTULO_SITUACAO_ACEITE: Record<SituacaoAceite, string> = { aguardando: "Aguardando decisão", aprovada: "Aprovada", correcoes: "Correções solicitadas", reaberta: "Reaberta, aguardando nova decisão" };
