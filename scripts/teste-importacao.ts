// Roda com: node scripts/teste-importacao.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { parseCsv } from "../lib/csv.ts";
// @ts-expect-error mesma razão: extensão .ts só para o node
import { planejar, semNovidade, LIMITE_LINHAS } from "../lib/importacao.ts";

type Ex = { modulos: { id: string; titulo: string }[]; telas: { id: string; moduloId: string; titulo: string; paiId: string | null; itens: string[] }[] };
const VAZIO: Ex = { modulos: [], telas: [] };
const plano = (csv: string, ex = VAZIO) => planejar(parseCsv(csv), ex);
const CAB = "Módulo;Tela;Pop-up de;Funcionalidade;O que faz\n";

// sem título de colunas
let p = plano("Financeiro;Relatório;;Filtrar;x");
assert.equal(p.totalErros, 1);
assert.match(p.erros[0], /títulos das colunas/);

// vazio e só título
assert.match(plano("").erros[0], /vazia/);
assert.match(plano(CAB).erros[0], /só tem a linha de títulos/);

// plano feliz: módulo, tela, funcionalidades, pop-up, tela vazia, só módulo
p = plano(
  CAB +
    "Financeiro;Relatório de pedidos;;Aplicar filtros;Gera o relatório\n" +
    "Financeiro;Relatório de pedidos;;Exportar;Baixa CSV\n" +
    "Financeiro;Resumo de entregas;Relatório de pedidos;Botão Exportar;Baixa o resumo\n" +
    "RH;Funcionários;;;\n" +
    "Compras;;;;\n",
);
assert.equal(p.totalErros, 0);
assert.deepEqual(p.resumo, { modulosNovos: 3, modulosExistentes: 0, telasNovas: 2, telasExistentes: 0, popupsNovos: 1, popupsExistentes: 0, funcsNovas: 3, funcsIgnoradas: 0 });
assert.deepEqual(p.telas.map((t: { titulo: string }) => t.titulo), ["Relatório de pedidos", "Resumo de entregas", "Funcionários"]); // ordem da planilha
assert.equal(p.telas[1].paiChave, "financeiro|relatório de pedidos");

// o pop-up pode vir antes da tela pai
p = plano(CAB + "Financeiro;Resumo;Relatório;Botão;x\nFinanceiro;Relatório;;Filtrar;y\n");
assert.equal(p.totalErros, 0);

// pop-up apontando para tela que não existe, com o número certo da linha (linha 1 = títulos; linha vazia conta)
p = plano(CAB + "Financeiro;Relatório;;Filtrar;x\n;;;;\nFinanceiro;Resumo;Inexistente;Botão;x\n");
assert.equal(p.totalErros, 1);
assert.match(p.erros[0], /^Linha 4: o pop-up “Resumo” aponta para a tela “Inexistente”/);

// erros por linha: sem módulo, sem tela, descrição sem funcionalidade, textos longos
p = plano(
  CAB + `;Tela;;Func;x\nFin;;;Func;x\nFin;Tela;;;só descrição\nFin;${"a".repeat(201)};;f;x\nFin;T;;f;${"b".repeat(2001)}\n`,
);
assert.equal(p.totalErros, 5);
assert.match(p.erros[0], /^Linha 2: falta o nome do módulo/);
assert.match(p.erros[1], /^Linha 3: falta o nome da tela/);
assert.match(p.erros[2], /^Linha 4: tem descrição mas falta o nome da funcionalidade/);
assert.match(p.erros[3], /^Linha 5: .*passou de 200 letras/);
assert.match(p.erros[4], /^Linha 6: a descrição passou de 2000 letras/);

// no máximo 50 erros listados, mas o total é contado
p = plano(CAB + Array.from({ length: 80 }, () => ";Tela;;F;x").join("\n"));
assert.equal(p.erros.length, 50);
assert.equal(p.totalErros, 80);

// limite de linhas
p = plano(CAB + Array.from({ length: LIMITE_LINHAS + 1 }, (_, i) => `M;T;;F${i};x`).join("\n"));
assert.match(p.erros[0], /limite é 2000/);

// reimportar não duplica nada: tudo existe, nada é novo, nomes ignorados sem diferenciar maiúscula
const existente: Ex = {
  modulos: [{ id: "m1", titulo: "Financeiro" }],
  telas: [
    { id: "t1", moduloId: "m1", titulo: "Relatório de pedidos", paiId: null, itens: ["Aplicar filtros"] },
    { id: "t2", moduloId: "m1", titulo: "Resumo de entregas", paiId: "t1", itens: [] },
  ],
};
p = plano(CAB + "financeiro;relatório de pedidos;;APLICAR FILTROS;x\nFinanceiro;Relatório de pedidos;;Exportar;y\nFinanceiro;Resumo de entregas;Relatório de pedidos;Botão;z\n", existente);
assert.equal(p.totalErros, 0);
assert.deepEqual(p.resumo, { modulosNovos: 0, modulosExistentes: 1, telasNovas: 0, telasExistentes: 1, popupsNovos: 0, popupsExistentes: 1, funcsNovas: 2, funcsIgnoradas: 1 });
assert.equal(p.telas[0].existenteId, "t1");
assert.deepEqual(p.telas[0].itens, [{ nome: "Exportar", faz: "y" }]);
p = plano(CAB + "Financeiro;Relatório de pedidos;;Aplicar filtros;x\n", existente);
assert.ok(semNovidade(p.resumo));

// repetida na própria planilha também é ignorada
p = plano(CAB + "M;T;;F;x\nM;T;;f;y\n");
assert.equal(p.resumo.funcsNovas, 1);
assert.equal(p.resumo.funcsIgnoradas, 1);

// aceita ";" ou ",", ordem de colunas livre e título sem acento
p = plano("funcionalidade,modulo,tela\nFiltrar,Fin,Relatório\n");
assert.equal(p.totalErros, 0);
assert.equal(p.telas[0].itens[0].nome, "Filtrar");

// pop-up novo de uma tela que já existe (a planilha só cita o pai): o plano diz qual é o id do pai
p = plano(CAB + "Financeiro;Novo pop-up;Relatório de pedidos;Botão;x\n", existente);
assert.equal(p.totalErros, 0);
assert.equal(p.paisExistentes["financeiro|relatório de pedidos"], "t1");
assert.equal(p.telas[0].paiChave, "financeiro|relatório de pedidos");
assert.equal(p.telas[0].existenteId, null);
// pop-up de pop-up não vale: o pai precisa ser tela principal
p = plano(CAB + "Financeiro;Outro;Resumo de entregas;Botão;x\n", existente);
assert.equal(p.totalErros, 1);

console.log("teste-importacao: tudo certo");
