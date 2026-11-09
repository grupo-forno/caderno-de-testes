export type Resultado = "ok" | "nao_ok" | "nao_testado";

// Um passo do roteiro de teste: o que o validador faz e o que ele deve ver acontecer
export type Passo = {
  id: string; // fixo: é a chave das respostas do passo
  fazer: string;
  esperado: string;
};

// Uma funcionalidade: campo, botão, área... É a ela que o cliente dá o resultado.
// "faz" é a descrição de referência. Sem "passos" (item antigo), o cliente responde pela descrição, como sempre foi.
export type Item = {
  id: string; // fixo: é a chave das respostas
  nome: string;
  faz: string;
  imagem?: string;
  passos?: Passo[];
};

// Resposta a um passo. "nao_consegui" = bloqueado; passo sem resposta simplesmente não existe aqui.
export type ResultadoPasso = "funcionou" | "diferente" | "nao_consegui";
export type RespPasso = { resultado: ResultadoPasso; obs: string; anexos: string[] };

// Um módulo do sistema (Financeiro, RH, Compras...). Agrupa as telas no menu.
export type Modulo = {
  id: string;
  titulo: string;
};

export type Tela = {
  id: string;
  moduloId: string;
  titulo: string;
  imagem: string | null;
  link: string | null; // preenchido quando a tela já estiver programada
  pdf: string | null;
  itens: Item[]; // sem itens = tela ainda em preparação
  paiId: string | null; // preenchido quando é um pop-up ou parte de outra tela
};

// O caderno é o sistema inteiro: módulos, e dentro deles as telas
export type Caderno = {
  titulo: string;
  versao: string;
  data: string;
  preparadoPor: string;
  antesDeComecar: string[];
  ambienteUrl: string | null; // endereço do ambiente de teste, se a autora cadastrou
  modulos: Modulo[];
  telas: Tela[];
};

// Quão grave é um NÃO OK, em linguagem simples
export type Severidade = "impede" | "contornavel" | "visual" | "sugestao";
export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  impede: "Impede de usar",
  contornavel: "Atrapalha, mas dá para contornar",
  visual: "Incômodo ou visual",
  sugestao: "Sugestão de melhoria",
};
export const SEVERIDADES = Object.keys(ROTULO_SEVERIDADE) as Severidade[];

// Resposta de uma pessoa a uma funcionalidade
export type Resp = { resultado: Resultado; obs: string; anexos: string[]; severidade: Severidade | null };

// Um registro do histórico (auditoria): só se acrescenta, nunca se apaga
export type Evento = {
  tipo: "resultado" | "observacao" | "correcao";
  ator: "cliente" | "autora";
  nome: string;
  de: string | null;
  para: string | null;
  obs: string;
  anexos: string[];
  severidade: Severidade | null;
  criado: string; // data e hora em formato ISO
};
