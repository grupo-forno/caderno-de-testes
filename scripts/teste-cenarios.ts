// Roda com: node scripts/teste-cenarios.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { contextoDoCenario, envolveTela, lerPassosCenario, semAcento } from "../lib/cenarios.ts";

const id = () => "novo";
const ehId = (v: string) => v === "fixo";
const telas = new Set(["t1", "t2"]);
const j = (a: unknown) => JSON.stringify(a);

// passos: os dois campos continuam obrigatórios, tela inválida vira "sem tela", perfil é aparado
assert.deepEqual(lerPassosCenario("", telas, id, ehId), []);
assert.deepEqual(lerPassosCenario(j([{ id: "fixo", fazer: "a", esperado: "b", telaId: "t1", perfil: "  Comprador " }, { fazer: "c", esperado: "d", telaId: "de-outro-caderno" }]), telas, id, ehId), [
  { id: "fixo", fazer: "a", esperado: "b", telaId: "t1", perfil: "Comprador" },
  { id: "novo", fazer: "c", esperado: "d", telaId: null, perfil: "" },
]);
assert.equal(lerPassosCenario(j([{ fazer: "a", esperado: "" }]), telas, id, ehId), null);
assert.equal(lerPassosCenario("quebrado", telas, id, ehId), null);

// módulos e perfis atravessados, na ordem do fluxo e sem repetir
const modulo = new Map([["t1", "compras"], ["t2", "financeiro"]]);
const c = { telaId: null, passos: [
  { id: "1", fazer: "a", esperado: "b", telaId: "t1", perfil: "Comprador" },
  { id: "2", fazer: "a", esperado: "b", telaId: "t2", perfil: "Financeiro" },
  { id: "3", fazer: "a", esperado: "b", telaId: "t2", perfil: "Comprador" },
] };
assert.deepEqual(contextoDoCenario(c, modulo), { modulos: ["compras", "financeiro"], perfis: ["Comprador", "Financeiro"] });
assert.deepEqual(contextoDoCenario({ telaId: "t2", passos: [] }, modulo), { modulos: ["financeiro"], perfis: [] }); // cenário de uma tela só
assert.equal(envolveTela(c, "t2"), true);
assert.equal(envolveTela(c, "t9"), false);
assert.equal(semAcento("Conferência"), "conferencia");

console.log("cenarios: tudo certo");
