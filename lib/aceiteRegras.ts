// Regras do termo de aceite, sem banco: o servidor decide de verdade, a tela só mostra o mesmo cálculo.

export type ContagemAceite = {
  total: number; // funcionalidades prontas para testar
  ok: number;
  naoOk: number;
  naoTestado: number;
  emPreparacao: number; // telas ainda sem funcionalidades
  impedem: number; // NÃO OK que impedem o uso ou ficaram sem gravidade informada
};

export type Criterio = { texto: string; ok: boolean };

// Critérios de saída em palavras. Se algum não estiver ok, não dá para concluir.
export function criterios(c: ContagemAceite): Criterio[] {
  const testadas = c.ok + c.naoOk;
  return [
    {
      // quem não testou nada não pode declarar que testou
      texto:
        c.total === 0
          ? "Ainda não há funcionalidades prontas para testar"
          : testadas === 0
            ? "Você ainda não testou nenhuma funcionalidade. Teste pelo menos uma antes de concluir"
            : `${testadas} de ${c.total} funcionalidades testadas`,
      ok: c.total > 0 && testadas > 0,
    },
    {
      texto:
        c.impedem === 0
          ? "Nenhuma funcionalidade NÃO OK que impeça o uso"
          : `${c.impedem} ${c.impedem === 1 ? "funcionalidade NÃO OK impede" : "funcionalidades NÃO OK impedem"} o uso ou está sem gravidade. Peça a correção ou informe a gravidade`,
      ok: c.impedem === 0,
    },
  ];
}

export const faltaAlgo = (cs: Criterio[]) => cs.some((c) => !c.ok);

export function declaracaoTexto(c: ContagemAceite): string {
  return `Declaro que testei este sistema em ambiente de homologação e aceito o resultado: ${c.ok} OK, ${c.naoOk} NÃO OK, ${c.naoTestado} não testadas, ${c.emPreparacao} ${c.emPreparacao === 1 ? "área" : "áreas"} em preparação.`;
}
