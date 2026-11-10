// Roda com: node scripts/teste-aceite-rodada.ts
import assert from "node:assert/strict";
// @ts-expect-error o node pede a extensão .ts; o tsc do projeto não
import { avaliarAceite, impressao, montarRetrato, situacaoDoAceite, validarDecisao } from "../lib/aceiteRodada.ts";

const R = (resultado: string, obs = "") => ({ resultado, obs, anexos: [] }) as never;
const atrib = (id: string, enviado: boolean, passos: Record<string, ReturnType<typeof R>>) => ({
  id, validadorId: "v" + id, validador: "Ana", cenario: "Fluxo", rcId: "rc1", enviado,
  passos: Object.entries(passos).map(([pid, resp], i) => ({ id: pid, n: i + 1, resp })),
});

// tudo funcionou e enviado: aprova
let r = avaliarAceite([atrib("a1", true, { p1: R("funcionou"), p2: R("funcionou", "só um comentário") })], []);
assert.equal(r.podeAprovar, true);
assert.equal(r.porAtribuicao.concluidas, 1);
assert.equal(validarDecisao("aprovada", "", r), null);
assert.match(validarDecisao("aprovada_ressalvas", "ok ok", r)!, /Não há ressalvas/); // sem desvios, não há o que ressalvar

// falha resolvida em reteste: aprova e mostra o build; resolve só o passo retestado
r = avaliarAceite(
  [atrib("a1", true, { p1: R("diferente", "x"), p2: R("funcionou") })],
  [{ id: "pd1", atribuicaoId: "a1", passo: "p1", situacao: "resolvida", retesteAberto: false, build: "2.4.1" }],
);
assert.equal(r.podeAprovar, true);
assert.deepEqual(r.builds, ["2.4.1"]);
assert.equal(r.falhasResolvidas.length, 1);
assert.equal(r.porPasso.falhasResolvidas, 1);

// falha aberta: bloqueia a aprovação, vira ressalva, reteste em andamento é listado
r = avaliarAceite(
  [atrib("a1", true, { p1: R("diferente", "x"), p2: R("diferente", "y") })],
  [
    { id: "pd1", atribuicaoId: "a1", passo: "p1", situacao: "aguardando_reteste", retesteAberto: true, build: null },
    { id: "pd2", atribuicaoId: "a1", passo: "p2", situacao: "aberta", retesteAberto: false, build: null },
  ],
);
assert.equal(r.podeAprovar, false);
assert.equal(r.pendenciasAbertas.length, 2);
assert.equal(r.retestesEmAndamento.length, 1);
assert.equal(r.porAtribuicao.comFalhas, 1);
assert.match(validarDecisao("aprovada", "", r)!, /não pode ser aprovada/);
assert.match(validarDecisao("aprovada_ressalvas", "", r)!, /justificativa/);
assert.equal(validarDecisao("aprovada_ressalvas", "aceito os desvios", r), null);

// bloqueio: impede a aprovação sem ressalvas, mas não vira defeito (não é pendência)
r = avaliarAceite([atrib("a1", true, { p1: R("funcionou"), p2: R("nao_consegui", "sem acesso") })], []);
assert.equal(r.podeAprovar, false);
assert.equal(r.pendenciasAbertas.length, 0);
assert.equal(r.bloqueios.length, 1);
assert.equal(r.porAtribuicao.bloqueadas, 1);
assert.equal(validarDecisao("aprovada_ressalvas", "aceito o bloqueio", r), null);

// rascunho (respostas salvas, não enviadas) é diferente de enviado e de sem resposta
r = avaliarAceite([atrib("a1", false, { p1: R("funcionou") }), atrib("a2", false, {})], []);
assert.equal(r.porAtribuicao.rascunho, 1);
assert.equal(r.porAtribuicao.semResposta, 1);
assert.equal(r.podeAprovar, false);
assert.equal(r.lacunas.length, 2);

// correções exigem justificativa
assert.match(validarDecisao("correcoes", "", r)!, /justificativa/);
assert.equal(validarDecisao("correcoes", "faltam ajustes", r), null);
assert.match(validarDecisao("qualquer", "x", r)!, /Escolha/);

// cenário vale pelo pior estado entre as pessoas
r = avaliarAceite([atrib("a1", true, { p1: R("funcionou") }), { ...atrib("a2", true, { p1: R("diferente", "x") }), validadorId: "vb" }], [{ id: "pd", atribuicaoId: "a2", passo: "p1", situacao: "aberta", retesteAberto: false, build: null }]);
assert.equal(r.porCenario.total, 1);
assert.equal(r.porCenario.comFalhas, 1);
assert.equal(r.porAtribuicao.total, 2);

// a impressão muda quando o resumo muda; o retrato guarda o que foi considerado
const antes = avaliarAceite([atrib("a1", true, { p1: R("funcionou") })], []);
const depois = avaliarAceite([atrib("a1", true, { p1: R("nao_consegui", "x") })], []);
assert.notEqual(impressao(antes), impressao(depois));
assert.equal(impressao(antes), impressao(avaliarAceite([atrib("a1", true, { p1: R("funcionou") })], [])));
const ret = montarRetrato(depois, { versao: "2.4", ambiente: null, escopo: [{ titulo: "Fluxo", validadores: ["Ana"] }], relacionadas: [] });
assert.equal(ret.ressalvas.length, 1);

// situação a partir do último registro
assert.equal(situacaoDoAceite(undefined), "aguardando");
assert.equal(situacaoDoAceite({ tipo: "aprovada_ressalvas" }), "aprovada");
assert.equal(situacaoDoAceite({ tipo: "correcoes" }), "correcoes");
assert.equal(situacaoDoAceite({ tipo: "reabertura" }), "reaberta");

console.log("aceite-rodada: tudo certo");
