// Roda com: node scripts/teste-passos.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { anexosDoItem, estadoPasso, lerPassos, observacaoDoItem, passoCompleto, resultadoDoItem } from "../lib/passos.ts";

const passos = [
  { id: "a", fazer: "F1", esperado: "E1" },
  { id: "b", fazer: "F2", esperado: "E2" },
];
const R = (resultado: string, obs = "", anexos: string[] = []) => ({ resultado, obs, anexos });
const com = (m: Record<string, ReturnType<typeof R>>) => (id: string) => m[id] as never;

// resultado da funcionalidade
assert.equal(resultadoDoItem(passos, com({})), "nao_testado");
assert.equal(resultadoDoItem(passos, com({ a: R("funcionou") })), "nao_testado"); // falta o outro
assert.equal(resultadoDoItem(passos, com({ a: R("funcionou"), b: R("funcionou") })), "ok");
assert.equal(resultadoDoItem(passos, com({ a: R("funcionou"), b: R("diferente", "x") })), "nao_ok");
assert.equal(resultadoDoItem(passos, com({ a: R("diferente", "x") })), "nao_ok"); // um problema já basta
assert.equal(resultadoDoItem(passos, com({ a: R("funcionou"), b: R("nao_consegui", "sem acesso") })), "nao_testado"); // bloqueado não é OK
assert.equal(resultadoDoItem([], com({})), "nao_testado");

// passo completo e estado
assert.equal(passoCompleto(undefined), false);
assert.equal(passoCompleto(R("funcionou") as never), true);
assert.equal(passoCompleto(R("diferente", "  ") as never), false); // sem explicação não conta
assert.equal(estadoPasso(undefined), "sem_resposta");
assert.equal(estadoPasso(R("diferente") as never), "falta_texto");
assert.equal(estadoPasso(R("diferente", "x") as never), "diferente");
assert.equal(estadoPasso(R("nao_consegui", "x") as never), "bloqueado");

// observação e prints da funcionalidade: só o que não funcionou, sem repetir prints
const m = { a: R("funcionou", "ok", ["u1"]), b: R("diferente", "quebrou", ["u1", "u2"]) };
assert.equal(observacaoDoItem(passos, com(m)), "Passo 2 (Deu diferente): quebrou");
assert.deepEqual(anexosDoItem(passos, com(m)), ["u1", "u2"]);

// leitura do formulário: os dois campos são obrigatórios e os ids se mantêm
const id = () => "novo";
const ehId = (v: string) => v === "fixo";
assert.deepEqual(lerPassos("", id, ehId), []);
assert.deepEqual(lerPassos(JSON.stringify([{ id: "fixo", fazer: " a ", esperado: "b" }, { fazer: "c", esperado: "d" }]), id, ehId), [
  { id: "fixo", fazer: "a", esperado: "b" },
  { id: "novo", fazer: "c", esperado: "d" },
]);
assert.equal(lerPassos(JSON.stringify([{ fazer: "a", esperado: "" }]), id, ehId), null); // falta o resultado esperado
assert.equal(lerPassos(JSON.stringify([{ fazer: "", esperado: "b" }]), id, ehId), null);
assert.equal(lerPassos("não é json", id, ehId), null);

console.log("passos: tudo certo");
