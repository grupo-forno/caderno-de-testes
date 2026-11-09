// Roda com: node scripts/teste-pendencias.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { avaliarReteste, passosDoPedido, podeSolicitarReteste, situacaoAposReteste } from "../lib/pendencias.ts";

const R = (resultado: string, obs = "") => ({ resultado, obs, anexos: [] }) as never;
const ids = ["a", "b"];

// passo pedido sem resposta (ou sem explicação) impede o envio e é apontado
assert.deepEqual(avaliarReteste(ids, { a: R("funcionou") }), { pendentes: ["b"], resultado: null });
assert.deepEqual(avaliarReteste(ids, { a: R("funcionou"), b: R("diferente", "") }).pendentes, ["b"]);

// sucesso, falha recorrente e bloqueio
assert.equal(avaliarReteste(ids, { a: R("funcionou"), b: R("funcionou") }).resultado, "resolvida");
assert.equal(avaliarReteste(ids, { a: R("funcionou"), b: R("diferente", "de novo") }).resultado, "falhou");
assert.equal(avaliarReteste(ids, { a: R("funcionou"), b: R("nao_consegui", "sem acesso") }).resultado, "bloqueado");
assert.equal(avaliarReteste(ids, { a: R("diferente", "x"), b: R("nao_consegui", "y") }).resultado, "falhou"); // falha vence bloqueio

// o que acontece com a pendência
assert.equal(situacaoAposReteste("resolvida"), "resolvida");
assert.equal(situacaoAposReteste("falhou"), "aberta");
assert.equal(situacaoAposReteste("bloqueado"), "aguardando_reteste");

// quando dá para pedir reteste
assert.equal(podeSolicitarReteste("aberta", false), true);
assert.equal(podeSolicitarReteste("aguardando_reteste", false), true); // nova tentativa depois de um bloqueio
assert.equal(podeSolicitarReteste("aguardando_reteste", true), false); // já há um pedido esperando resposta
assert.equal(podeSolicitarReteste("resolvida", false), false);

// passos do pedido: o que falhou sempre entra, extras só do mesmo cenário, na ordem do cenário
assert.deepEqual(passosDoPedido("c", [], ["a", "b", "c", "d"]), ["c"]);
assert.deepEqual(passosDoPedido("c", ["a", "x"], ["a", "b", "c", "d"]), ["a", "c"]);

console.log("pendencias: tudo certo");
