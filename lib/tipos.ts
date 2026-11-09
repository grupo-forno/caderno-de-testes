export type Resultado = "ok" | "nao_ok" | "nao_testado";

export type Tela = {
  id: string;
  titulo: string;
  imagem: string | null;
  link: string | null; // preenchido quando a tela já estiver programada
  pdf: string | null;
  itens: { nome: string; faz: string; imagem?: string }[];
  paiId: string | null; // preenchido quando é um pop-up ou parte de outra tela
  refazer: boolean; // false = já aprovada em rodada anterior
};

export type Caderno = {
  titulo: string;
  versao: string;
  data: string;
  preparadoPor: string;
  rodada: number;
  antesDeComecar: string[];
  telas: Tela[];
};
