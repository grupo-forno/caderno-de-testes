// Roda com: node scripts/teste-rodadas.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { conferirPublicacao, montarSnapshot, pendentes, progresso, somar } from "../lib/rodadas.ts";

const R = (resultado: string, obs = "") => ({ resultado, obs, anexos: [] }) as never;

// snapshot: cópia com tela, módulos na ordem e perfis sem repetir
const telas = new Map([
  ["t1", { id: "t1", titulo: "Solicitação", modulo: "Compras", imagem: null, link: null }],
  ["t2", { id: "t2", titulo: "Conferência", modulo: "Financeiro", imagem: "img", link: "https://x" }],
]);
const cen = {
  id: "c1", titulo: "Fluxo", objetivo: "o", tipo: "funcional" as const, preRequisitos: "p", dadosTeste: "d", telaId: "t1",
  passos: [
    { id: "a", fazer: "f1", esperado: "e1", telaId: null, perfil: "Comprador" }, // herda a tela principal
    { id: "b", fazer: "f2", esperado: "e2", telaId: "t2", perfil: "Financeiro" },
    { id: "c", fazer: "f3", esperado: "e3", telaId: "t2", perfil: "Comprador" },
  ],
};
const snap = montarSnapshot(cen, telas);
assert.deepEqual(snap.modulos, ["Compras", "Financeiro"]);
assert.deepEqual(snap.perfis, ["Comprador", "Financeiro"]);
assert.equal(snap.passos[0].tela?.titulo, "Solicitação");
// a cópia não muda se o cenário original mudar depois
cen.passos[0].fazer = "ALTERADO";
assert.equal(snap.passos[0].fazer, "f1");

// progresso: falha e bloqueio não são "enviado"
const ids = ["a", "b", "c"];
assert.equal(progresso(ids, {}, false).estado, "sem_resposta");
const parcial = progresso(ids, { a: R("funcionou") }, false);
assert.equal(parcial.estado, "em_andamento");
assert.equal(parcial.semResposta, 2);
const completo = progresso(ids, { a: R("funcionou"), b: R("diferente", "quebrou"), c: R("nao_consegui", "sem acesso") }, false);
assert.deepEqual([completo.funcionou, completo.diferente, completo.bloqueado, completo.semResposta], [1, 1, 1, 0]);
assert.equal(completo.estado, "em_andamento"); // falhas e bloqueios não significam enviado
assert.equal(progresso(ids, { a: R("funcionou") }, true).estado, "enviado");
assert.equal(progresso(ids, { a: R("diferente", "") }, false).semResposta, 3); // sem explicação não conta como respondido
assert.deepEqual(pendentes(ids, { a: R("funcionou"), b: R("diferente", "") }), ["b", "c"]);
assert.equal(somar([completo, parcial]).total, 6);

// publicação: o que impede e a âncora do campo
const ok = conferirPublicacao({ nome: "R1", versao: "1.0", ambienteUrl: "https://x", cenarios: [{ titulo: "A", arquivadoOuSumiu: false, passos: 2, atribuidos: 1 }], validadores: [{ nome: "Ana", atribuicoes: 1 }] });
assert.deepEqual(ok, { impedem: [], avisos: [] });
const ruim = conferirPublicacao({ nome: " ", versao: "", ambienteUrl: null, cenarios: [{ titulo: "B", arquivadoOuSumiu: true, passos: 0, atribuidos: 0 }], validadores: [{ nome: "Rui", atribuicoes: 0 }] });
assert.deepEqual(ruim.impedem.map((i: { ancora: string }) => i.ancora), ["campo-nome", "campo-versao", "campo-ambiente", "secao-cenarios", "secao-validadores"]);
assert.equal(ruim.avisos.length, 1);
assert.equal(conferirPublicacao({ nome: "R", versao: "1", ambienteUrl: "u", cenarios: [], validadores: [] }).impedem.length, 2);

console.log("rodadas: tudo certo");
