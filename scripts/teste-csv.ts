// Roda com: node scripts/teste-csv.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { gerarCsv, parseCsv } from "../lib/csv.ts";

// separadores
assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
assert.deepEqual(parseCsv("a;b,c\n1;2,3"), [["a", "b,c"], ["1", "2,3"]]); // ";" na primeira linha manda

// aspas, aspas duplicadas e separador dentro do campo
assert.deepEqual(parseCsv('"x;y";z\n"diz ""oi""";w'), [["x;y", "z"], ['diz "oi"', "w"]]);

// quebra de linha dentro de aspas e fim de linha do Windows
assert.deepEqual(parseCsv('a;b\r\n"linha 1\nlinha 2";c\r\n'), [["a", "b"], ["linha 1\nlinha 2", "c"]]);

// BOM e linhas vazias no fim
assert.deepEqual(parseCsv("﻿a;b\n1;2\n\n;\n"), [["a", "b"], ["1", "2"]]);

// campo vazio no fim da linha
assert.deepEqual(parseCsv("a;b;\n1;;"), [["a", "b", ""], ["1", "", ""]]);

// gerar: BOM, ";", aspas só quando precisa
const saida = gerarCsv([["Módulo", "Obs"], ["Fin;anceiro", 'diz "oi"'], ["linha1\nlinha2", "ok"]]);
assert.ok(saida.startsWith("﻿"));
assert.equal(saida, '﻿Módulo;Obs\r\n"Fin;anceiro";"diz ""oi"""\r\n"linha1\nlinha2";ok\r\n');

// ida e volta
const volta = [["a", 'b"c', "d;e", "f\ng", ""], ["1", "2", "3", "4", "5"]];
assert.deepEqual(parseCsv(gerarCsv(volta)), volta);

// injeção de fórmula
for (const perigo of ["=1+1", "+1", "-1", "@SOMA(A1)", "\tx"]) {
  const l = gerarCsv([[perigo]]).replace("﻿", "").trim();
  assert.ok(l.startsWith("'") || l.startsWith("\"'"), `não protegeu ${JSON.stringify(perigo)}`);
}
assert.equal(gerarCsv([["normal"]]), "﻿normal\r\n");

console.log("teste-csv: tudo certo");
