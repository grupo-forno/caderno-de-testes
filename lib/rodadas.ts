// Regras das rodadas de homologação, sem banco e sem React.
// @ts-expect-error o node (usado em scripts/teste-rodadas.ts) pede a extensão .ts; o tsc do projeto não
import { estadoPasso, passoCompleto } from "./passos.ts";
import type { RespPasso } from "@/lib/tipos";

export type SituacaoRodada = "rascunho" | "em_validacao";
export const ROTULO_SITUACAO: Record<SituacaoRodada, string> = { rascunho: "Rascunho", em_validacao: "Em validação" };

// Cópia do cenário guardada ao publicar. Daqui em diante a biblioteca pode mudar sem afetar a rodada.
export type TelaSnap = { id: string | null; titulo: string; modulo: string; imagem: string | null; link: string | null };
export type PassoSnap = { id: string; fazer: string; esperado: string; perfil: string; tela: TelaSnap | null };
export type CenarioSnap = {
  cenarioId: string | null;
  titulo: string;
  objetivo: string;
  tipo: "desenho" | "funcional";
  preRequisitos: string;
  dadosTeste: string;
  modulos: string[]; // nomes, na ordem do fluxo
  perfis: string[]; // perfis de acesso usados, sem repetir
  passos: PassoSnap[];
};

type CenarioBase = {
  id: string;
  titulo: string;
  objetivo: string;
  tipo: "desenho" | "funcional";
  preRequisitos: string;
  dadosTeste: string;
  telaId: string | null;
  passos: { id: string; fazer: string; esperado: string; telaId: string | null; perfil: string }[];
};

// Monta a cópia do cenário: cada passo guarda a tela (a dele ou a principal) com o que o validador precisa ver
export function montarSnapshot(c: CenarioBase, telas: Map<string, TelaSnap>): CenarioSnap {
  const passos: PassoSnap[] = c.passos.map((p) => ({
    id: p.id,
    fazer: p.fazer,
    esperado: p.esperado,
    perfil: p.perfil,
    tela: telas.get(p.telaId ?? c.telaId ?? "") ?? null,
  }));
  const modulos = [...new Set(passos.map((p) => p.tela?.modulo).filter((m): m is string => !!m))];
  if (c.telaId && !modulos.length) {
    const t = telas.get(c.telaId);
    if (t) modulos.push(t.modulo);
  }
  return {
    cenarioId: c.id,
    titulo: c.titulo,
    objetivo: c.objetivo,
    tipo: c.tipo,
    preRequisitos: c.preRequisitos,
    dadosTeste: c.dadosTeste,
    modulos,
    perfis: [...new Set(passos.map((p) => p.perfil).filter(Boolean))],
    passos,
  };
}

export type EstadoAtribuicao = "sem_resposta" | "em_andamento" | "enviado";
export const ROTULO_ESTADO_ATRIBUICAO: Record<EstadoAtribuicao, string> = { sem_resposta: "Sem resposta", em_andamento: "Em andamento", enviado: "Enviado" };

export type Progresso = {
  total: number;
  funcionou: number;
  diferente: number;
  bloqueado: number;
  semResposta: number; // inclui o passo respondido sem a explicação obrigatória
  respondidos: number; // passos completos
  estado: EstadoAtribuicao;
};

// Progresso de uma atribuição. Falhas (diferente) e bloqueios são contados à parte e nunca se confundem com "enviado".
export function progresso(passoIds: string[], resp: Record<string, RespPasso | undefined>, enviado: boolean): Progresso {
  const p: Progresso = { total: passoIds.length, funcionou: 0, diferente: 0, bloqueado: 0, semResposta: 0, respondidos: 0, estado: "sem_resposta" };
  let algum = false;
  for (const id of passoIds) {
    if (resp[id]) algum = true;
    const e = estadoPasso(resp[id]);
    if (e === "funcionou") p.funcionou++;
    else if (e === "diferente") p.diferente++;
    else if (e === "bloqueado") p.bloqueado++;
    else p.semResposta++;
    if (passoCompleto(resp[id])) p.respondidos++;
  }
  p.estado = enviado ? "enviado" : algum ? "em_andamento" : "sem_resposta";
  return p;
}

export const somar = (ps: Progresso[]): Progresso =>
  ps.reduce(
    (s, p) => ({ ...s, total: s.total + p.total, funcionou: s.funcionou + p.funcionou, diferente: s.diferente + p.diferente, bloqueado: s.bloqueado + p.bloqueado, semResposta: s.semResposta + p.semResposta, respondidos: s.respondidos + p.respondidos }),
    { total: 0, funcionou: 0, diferente: 0, bloqueado: 0, semResposta: 0, respondidos: 0, estado: "sem_resposta" } as Progresso,
  );

// Passos que ainda impedem o envio (sem resposta, ou "Deu diferente"/"Não consegui" sem texto)
export const pendentes = (passoIds: string[], resp: Record<string, RespPasso | undefined>) => passoIds.filter((id) => !passoCompleto(resp[id]));

export type Impedimento = { texto: string; ancora: string };

// O que impede de publicar (e o que só merece atenção), com a âncora do campo para corrigir
export function conferirPublicacao(r: {
  nome: string;
  versao: string;
  ambienteUrl: string | null;
  cenarios: { titulo: string; arquivadoOuSumiu: boolean; passos: number; atribuidos: number }[];
  validadores: { nome: string; atribuicoes: number }[];
}): { impedem: Impedimento[]; avisos: string[] } {
  const impedem: Impedimento[] = [];
  const avisos: string[] = [];
  if (!r.nome.trim()) impedem.push({ texto: "Dê um nome à entrega.", ancora: "campo-nome" });
  if (!r.versao.trim()) impedem.push({ texto: "Informe a versão da entrega.", ancora: "campo-versao" });
  if (!r.ambienteUrl) impedem.push({ texto: "Informe o endereço do ambiente de teste.", ancora: "campo-ambiente" });
  if (!r.cenarios.length) impedem.push({ texto: "Escolha pelo menos um cenário da biblioteca.", ancora: "secao-cenarios" });
  for (const c of r.cenarios) {
    if (c.arquivadoOuSumiu) impedem.push({ texto: `O cenário “${c.titulo}” está arquivado ou foi removido da biblioteca. Tire-o da rodada ou reative-o.`, ancora: "secao-cenarios" });
    else if (c.passos === 0) impedem.push({ texto: `O cenário “${c.titulo}” não tem passos. Escreva os passos na biblioteca.`, ancora: "secao-cenarios" });
    if (c.atribuidos === 0) impedem.push({ texto: `O cenário “${c.titulo}” não está atribuído a nenhum validador.`, ancora: "secao-validadores" });
  }
  if (!r.validadores.length) impedem.push({ texto: "Cadastre pelo menos um validador.", ancora: "secao-validadores" });
  for (const v of r.validadores) if (v.atribuicoes === 0) avisos.push(`${v.nome} não tem nenhum teste atribuído.`);
  return { impedem, avisos };
}
