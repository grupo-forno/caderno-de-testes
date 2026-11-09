// Dados de exemplo do passo 2. Depois vêm do banco.
export type Resultado = "ok" | "nao_ok" | "nao_testado";

export type Tela = {
  id: string;
  titulo: string;
  imagem: string;
  link?: string; // preenchido quando a tela já estiver programada
  pdf?: string;
  itens: { nome: string; faz: string }[];
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

export const exemplo: Caderno = {
  titulo: "Módulo de exemplo",
  versao: "1.0",
  data: "09/11/2026",
  preparadoPor: "Equipe de tecnologia",
  rodada: 1,
  antesDeComecar: [
    "Um computador ou celular com internet.",
    "Cerca de 30 minutos livres.",
  ],
  telas: [
    {
      id: "t1",
      titulo: "Lista de cadastros",
      imagem: "/tela-exemplo.svg",
      pdf: "#",
      itens: [
        { nome: "Campo Buscar", faz: "Filtra a lista enquanto a pessoa digita." },
        { nome: "Botão Novo", faz: "Abre a tela de novo cadastro." },
        { nome: "Linha da lista", faz: "Ao clicar, abre o cadastro para edição." },
      ],
    },
    {
      id: "t2",
      titulo: "Novo cadastro",
      imagem: "/tela-exemplo.svg",
      link: "https://example.com",
      pdf: "#",
      itens: [
        { nome: "Campo Nome", faz: "Obrigatório. Aceita até 80 letras." },
        { nome: "Botão Salvar", faz: "Grava o cadastro e volta para a lista." },
        { nome: "Botão Cancelar", faz: "Volta para a lista sem gravar." },
      ],
    },
    {
      id: "t3",
      titulo: "Relatório mensal",
      imagem: "/tela-exemplo.svg",
      pdf: "#",
      itens: [
        { nome: "Seletor de mês", faz: "Escolhe o mês que será exibido." },
        { nome: "Botão Exportar", faz: "Baixa o relatório em planilha." },
      ],
    },
  ],
};
