// Roda com: node scripts/teste-aceite.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { criterios, declaracaoTexto, faltaAlgo } from "../lib/aceiteRegras.ts";

const base = { total: 10, ok: 8, naoOk: 0, naoTestado: 2, emPreparacao: 0, impedem: 0 };

// sem nenhuma funcionalidade pronta: não dá para concluir
assert.equal(faltaAlgo(criterios({ ...base, total: 0, ok: 0, naoTestado: 0 })), true);

// tudo certo, mesmo com NÃO TESTADO sobrando: pode concluir (a pessoa fica ciente)
assert.equal(faltaAlgo(criterios(base)), false);

// NÃO OK que impede (ou sem gravidade) bloqueia
const um = criterios({ ...base, ok: 7, naoOk: 1, impedem: 1 });
assert.equal(faltaAlgo(um), true);
assert.match(um[1].texto, /1 funcionalidade NÃO OK impede/);
const dois = criterios({ ...base, ok: 6, naoOk: 2, impedem: 2 });
assert.match(dois[1].texto, /2 funcionalidades NÃO OK impedem/);

// NÃO OK de gravidade menor (impedem = 0) não bloqueia
assert.equal(faltaAlgo(criterios({ ...base, ok: 7, naoOk: 1, impedem: 0 })), false);

// texto dos critérios
assert.equal(criterios(base)[0].texto, "8 de 10 funcionalidades testadas");
assert.equal(criterios(base)[1].texto, "Nenhuma funcionalidade NÃO OK que impeça o uso");

// declaração cita os números, com singular e plural certos
assert.equal(
  declaracaoTexto({ ...base, naoOk: 0, emPreparacao: 1 }),
  "Declaro que testei este sistema em ambiente de homologação e aceito o resultado: 8 OK, 0 NÃO OK, 2 não testadas, 1 área em preparação.",
);
assert.match(declaracaoTexto({ ...base, emPreparacao: 3 }), /3 áreas em preparação\.$/);

console.log("teste-aceite: tudo certo");
