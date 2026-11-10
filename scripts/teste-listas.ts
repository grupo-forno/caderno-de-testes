// Roda com: node scripts/teste-listas.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { juntarInstrucoes, semDuplicados, separarInstrucoes } from "../lib/listas.ts";

// duplicata por maiúsculas, acento e espaço; a ordem é mantida e o ignorado é informado
let r = semDuplicados(["Financeiro", "financeiro", "  RH ", "Gestão", "Gestao", "", "Compras"], ["rh"]);
assert.deepEqual(r.novos, ["Financeiro", "Gestão", "Compras"]);
assert.deepEqual(r.ignorados, ["financeiro", "RH", "Gestao"]);
assert.deepEqual(semDuplicados([]).novos, []);

// instruções: a ordem de hoje é a ordem do texto; linhas vazias somem
assert.deepEqual(separarInstrucoes("Um computador.\n\n  Cerca de 30 minutos.  \n"), ["Um computador.", "Cerca de 30 minutos."]);
assert.equal(juntarInstrucoes(["  b ", "", "a   c"]), "b\na c");
assert.equal(juntarInstrucoes(separarInstrucoes("x\ny")), "x\ny"); // ida e volta não muda nada

console.log("listas: tudo certo");
