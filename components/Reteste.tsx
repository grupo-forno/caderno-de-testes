"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Execucao, { ChipEstado, type PassoFila } from "@/components/Execucao";
import Imagem from "@/components/Imagem";
import { estadoPasso } from "@/lib/passos";
import { avaliarReteste, ROTULO_PENDENCIA, type SituacaoPendencia } from "@/lib/pendencias";
import type { PassoSnap } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";
import { usePassos } from "@/lib/usePassos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const TEMPO = 15000;
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type RetesteDados = {
  id: string;
  numero: number;
  corrigido: string;
  versao: string;
  solicitadoPor: string;
  solicitadoEm: string;
  status: "solicitado" | "enviado";
  resultado: "resolvida" | "falhou" | "bloqueado" | null;
  enviadoEm: string | null;
  pendenciaSituacao: SituacaoPendencia;
  cenario: { titulo: string; objetivo: string; preRequisitos: string; dadosTeste: string; perfis: string[]; modulos: string[] };
  passos: (PassoSnap & { falhou: boolean })[]; // ids no formato "<reteste>_<passo>"
  falhaOriginal: { passoId: string; obs: string; anexos: string[] } | null;
};

const MENSAGEM_RESULTADO = {
  resolvida: "Tudo funcionou. A pendência foi marcada como Resolvida.",
  falhou: "Algum passo ainda falhou. A pendência voltou para Aberta e a equipe vai ver o seu novo relato, junto com a falha original.",
  bloqueado: "Você não conseguiu testar algum passo. A pendência continua em Aguardando reteste e a equipe vê o motivo do bloqueio. Depois de resolver o impedimento, ela pode pedir uma nova tentativa.",
} as const;

// A tela do reteste: o que foi corrigido, o que refazer, a execução (a mesma do restante) e o envio
export default function Reteste({ reteste, respostas, token, previa, aprovada, aoVoltar, aoEnviado, aoAtualizar }: {
  reteste: RetesteDados;
  respostas: Record<string, RespPasso>;
  token?: string | null;
  previa?: boolean;
  aprovada?: string | null; // rodada aprovada: só leitura
  aoVoltar: () => void;
  aoAtualizar?: (resp: Record<string, RespPasso>) => void; // avisa quem guarda as respostas, para não sumirem ao sair e voltar
  aoEnviado: (id: string, resultado: "resolvida" | "falhou" | "bloqueado", situacao: SituacaoPendencia) => void;
}) {
  const [vista, setVista] = useState<{ t: "intro" } | { t: "passo"; id: string } | { t: "resumo" }>({ t: "intro" });
  const [envio, setEnvio] = useState<{ fase: "parado" | "enviando"; erro: string | null }>({ fase: "parado", erro: null });
  const [confirmando, setConfirmando] = useState(false);
  const [feito, setFeito] = useState<{ resultado: "resolvida" | "falhou" | "bloqueado"; situacao: SituacaoPendencia } | null>(reteste.status === "enviado" && reteste.resultado ? { resultado: reteste.resultado, situacao: reteste.pendenciaSituacao } : null);
  const ps = usePassos(token && !previa ? { caderno: "", chave: token, api: "/api/rodada/reteste/resposta" } : null);
  const { definir } = ps;
  const inicial = useRef(respostas);
  useEffect(() => {
    definir(inicial.current, aprovada ?? null);
  }, [definir, aprovada]);
  const { resp: respAtual } = ps;
  useEffect(() => {
    if (!previa && Object.keys(respAtual).length) aoAtualizar?.(respAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respAtual]);
  useEffect(() => {
    document.getElementById("titulo-tela")?.focus({ preventScroll: true });
  }, [vista]);

  const enviado = reteste.status === "enviado" || !!feito;
  const resp = ps.resp;
  const ids = reteste.passos.map((p) => p.id);
  const av = avaliarReteste(ids, resp);
  const ocupado = ps.ocupado > 0 || ps.falhas > 0;
  const iniciou = Object.keys(resp).length > 0;
  const c = reteste.cenario;

  const fila: PassoFila[] = useMemo(
    () =>
      reteste.passos.map((p, n) => ({
        passo: { id: p.id, fazer: p.fazer, esperado: p.esperado },
        indice: n + 1,
        total: reteste.passos.length,
        item: { id: reteste.id, nome: `Reteste ${reteste.numero}: ${c.titulo}`, faz: c.objetivo },
        tela: { id: p.tela?.id ?? "", moduloId: p.tela?.modulo ?? "", titulo: p.tela?.titulo ?? "Sem tela indicada", imagem: p.tela?.imagem ?? null, link: p.tela?.link ?? null, pdf: null, itens: [], paiId: null },
        numeroTela: "",
        modulo: { id: p.tela?.modulo ?? "", titulo: p.tela?.modulo ?? c.modulos[0] ?? "Sem módulo" },
        numeroModulo: "1",
        perfil: p.perfil || undefined,
        perfilAnterior: n > 0 ? reteste.passos[n - 1].perfil || null : null,
      })),
    [reteste, c],
  );

  const salvamento: { texto: string; tipo: "ok" | "salvando" | "erro" } = previa
    ? { texto: "Prévia: nada é salvo.", tipo: "ok" }
    : ps.bloqueio ? { texto: ps.bloqueio, tipo: "erro" }
    : ps.falhas > 0 ? { texto: "Há respostas sem salvar. Elas continuam na tela: confira a internet e tente de novo.", tipo: "erro" }
    : ps.ocupado > 0 ? { texto: "Salvando…", tipo: "salvando" }
    : { texto: ps.salvo ? `Salvo às ${ps.salvo}` : "Suas respostas são salvas sozinhas", tipo: "ok" };

  async function enviar() {
    if (!token || previa) return;
    setEnvio({ fase: "enviando", erro: null });
    try {
      const r = await fetch("/api/rodada/reteste/enviar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ reteste: reteste.id }), signal: AbortSignal.timeout(TEMPO) });
      const j = await r.json().catch(() => null);
      setConfirmando(false);
      if (!r.ok) return setEnvio({ fase: "parado", erro: j?.erro ?? "Não conseguimos enviar agora. Suas respostas continuam salvas; tente de novo." });
      setFeito({ resultado: j.resultado, situacao: j.situacao });
      aoEnviado(reteste.id, j.resultado, j.situacao);
      setEnvio({ fase: "parado", erro: null });
    } catch {
      setConfirmando(false);
      setEnvio({ fase: "parado", erro: "Não conseguimos enviar agora. Confira sua internet; suas respostas continuam salvas." });
    }
  }

  const topo = (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4">
        <div className="min-w-0"><p className="text-sm font-medium text-violet-800">Reteste {reteste.numero}</p><h1 className="break-words text-xl font-semibold">{c.titulo}</h1></div>
        <div className="text-xs text-slate-700"><p aria-live="polite">{salvamento.texto}</p><p className="mt-0.5"><button type="button" onClick={aoVoltar} className={`rounded underline ${FOCO}`}>Voltar para Meus testes</button></p></div>
      </div>
    </header>
  );
  const erros = (
    <div className="space-y-3">
      {previa && <p role="status" className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-950"><strong>Prévia.</strong> Nada é salvo nem enviado aqui.</p>}
      {ps.bloqueio && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950"><strong>{ps.bloqueio}</strong> Recarregue a página para continuar.</p>}
      {ps.falhas > 0 && !ps.bloqueio && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-semibold">{plural(ps.falhas, "resposta ainda não foi salva", "respostas ainda não foram salvas")}.</p>
          <p className="mt-1">Elas continuam aqui na tela. Confira sua internet e tente de novo. Não feche a página antes disso.</p>
          <button type="button" onClick={ps.tentarDeNovo} className={`mt-2 min-h-11 rounded-md bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800 ${FOCO}`}>Tentar salvar de novo</button>
        </div>
      )}
    </div>
  );

  // ---------- execução ----------
  if (vista.t === "passo") {
    const pos = fila.findIndex((f) => f.passo.id === vista.id);
    if (pos >= 0) {
      return (
        <div className="min-h-screen">
          {topo}
          <main className="mx-auto max-w-5xl px-4 py-5">
            {erros}
            <div className="mt-3">
              <Execucao
                key={fila[pos].passo.id}
                atual={fila[pos]}
                fila={fila}
                posicao={pos}
                resp={resp}
                chave={token ?? ""}
                slug=""
                payloadUpload={JSON.stringify({ convite: token })}
                rotuloItem="Reteste"
                semLinkTela
                somenteLeitura={previa || enviado || !!ps.concluido}
                salvamento={salvamento}
                aoMudar={previa ? () => {} : ps.mudar}
                aoIr={(id) => setVista({ t: "passo", id: id.replace(/^p:/, "") })}
                aoSair={() => setVista(pos === fila.length - 1 ? { t: "resumo" } : { t: "intro" })}
              />
            </div>
          </main>
        </div>
      );
    }
  }

  // ---------- resumo e envio ----------
  if (vista.t === "resumo") {
    return (
      <div className="min-h-screen">
        {topo}
        <main className="mx-auto max-w-3xl px-4 py-6">
          {erros}
          <h2 id="titulo-tela" tabIndex={-1} className="mt-3 text-2xl font-semibold focus:outline-none">{enviado ? "Reteste enviado" : "Resumo antes de enviar o reteste"}</h2>
          {feito && (
            <div role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">Reteste enviado. Situação da pendência: {ROTULO_PENDENCIA[feito.situacao]}.</p>
              <p className="mt-1">{MENSAGEM_RESULTADO[feito.resultado]}</p>
            </div>
          )}
          {!enviado && av.pendentes.length > 0 && (
            <section aria-labelledby="t-pend" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 id="t-pend" className="font-semibold text-amber-950">{plural(av.pendentes.length, "passo pedido ainda precisa de resposta", "passos pedidos ainda precisam de resposta")}</h3>
              <p className="mt-1 text-sm text-amber-950">Responda todos os passos do pedido para enviar. “Deu diferente” e “Não consegui testar” precisam da explicação.</p>
              <ul className="mt-3 space-y-2">
                {av.pendentes.map((id) => {
                  const f = fila.find((x) => x.passo.id === id)!;
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => setVista({ t: "passo", id })} className={`flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 ${FOCO}`}>
                        <span className="font-semibold">Passo {f.indice}</span><span className="min-w-0 flex-1 truncate text-slate-700">{f.passo.fazer}</span>
                        <ChipEstado estado={estadoPasso(resp[id])} /><span aria-hidden="true" className="underline">Ir para este passo</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <ol className="mt-4 space-y-2">
            {reteste.passos.map((p, n) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <button type="button" onClick={() => setVista({ t: "passo", id: p.id })} className={`min-h-11 rounded text-left underline ${FOCO}`}>Passo {n + 1}</button>
                <span className="min-w-0 flex-1 truncate text-slate-700">{p.fazer}</span>
                <ChipEstado estado={estadoPasso(resp[p.id])} />
              </li>
            ))}
          </ol>
          {envio.erro && <p role="alert" className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{envio.erro}</p>}
          {!enviado && (
            <div className="mt-5">
              {!confirmando ? (
                <button type="button" disabled={previa || av.pendentes.length > 0 || ocupado || !!aprovada} onClick={() => setConfirmando(true)} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 ${FOCO}`}>
                  {ocupado ? "Aguarde: salvando…" : "Enviar reteste"}
                </button>
              ) : (
                <div role="alertdialog" aria-label="Confirmar envio do reteste" className="rounded-lg border border-indigo-300 bg-indigo-50 p-4 text-sm text-indigo-950">
                  <p className="font-semibold">Enviar o reteste agora?</p>
                  <p className="mt-1">Depois de enviar, você não muda mais estas respostas. A tentativa anterior continua guardada.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={envio.fase === "enviando"} onClick={enviar} className={`min-h-11 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 ${FOCO}`}>{envio.fase === "enviando" ? "Enviando…" : "Sim, enviar"}</button>
                    <button type="button" onClick={() => setConfirmando(false)} className={`min-h-11 rounded-md border border-slate-400 bg-white px-5 text-sm font-medium ${FOCO}`}>Voltar</button>
                  </div>
                </div>
              )}
              {av.pendentes.length > 0 && <p className="mt-2 text-sm text-slate-700">Responda os passos pendentes para liberar o envio.</p>}
            </div>
          )}
          <p className="mt-6"><button type="button" onClick={aoVoltar} className={`min-h-11 rounded text-sm font-medium text-indigo-800 underline ${FOCO}`}>Voltar para Meus testes</button></p>
        </main>
      </div>
    );
  }

  // ---------- apresentação do pedido ----------
  const primeiro = av.pendentes[0] ?? ids[0];
  return (
    <div className="min-h-screen">
      {topo}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {erros}
        <h2 id="titulo-tela" tabIndex={-1} className="mt-3 text-2xl font-semibold focus:outline-none">{enviado ? "Reteste enviado" : "Reteste pedido pela equipe"}</h2>
        <section aria-labelledby="t-corr" className="mt-3 rounded-lg border border-violet-300 bg-violet-50 p-4">
          <h3 id="t-corr" className="font-semibold text-violet-950">O que foi corrigido</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-violet-950">{reteste.corrigido}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">Versão a conferir</dt><dd>{reteste.versao}</dd>
            <dt className="font-medium">Pedido por</dt><dd>{reteste.solicitadoPor}, em {dataHora(reteste.solicitadoEm)}</dd>
            {enviado && reteste.enviadoEm && (<><dt className="font-medium">Enviado em</dt><dd>{dataHora(reteste.enviadoEm)}</dd></>)}
          </dl>
        </section>
        {feito && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><strong>Situação da pendência: {ROTULO_PENDENCIA[feito.situacao]}.</strong> {MENSAGEM_RESULTADO[feito.resultado]}</p>}

        <section aria-labelledby="t-refazer" className="mt-5">
          <h3 id="t-refazer" className="text-base font-semibold">Passos para refazer ({reteste.passos.length})</h3>
          <ol className="mt-2 space-y-2">
            {reteste.passos.map((p, n) => (
              <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2"><strong>Passo {n + 1}</strong>{p.falhou ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-900">Foi o que falhou</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">Para preparar ou confirmar</span>}<ChipEstado estado={estadoPasso(resp[p.id])} /></p>
                <p className="mt-1 whitespace-pre-wrap">{p.fazer}</p>
                {p.perfil && <p className="text-xs text-slate-700">Perfil de acesso: {p.perfil}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-700">Os outros passos do cenário mantêm os resultados que você já enviou.</p>
        </section>

        {(c.preRequisitos || c.dadosTeste || c.perfis.length > 0) && (
          <dl className="mt-4 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            {c.perfis.length > 0 && <div><dt className="inline font-medium">Perfis de acesso: </dt><dd className="inline">{c.perfis.join(", ")}. As senhas não ficam aqui.</dd></div>}
            {c.preRequisitos && <div><dt className="inline font-medium">Antes de começar: </dt><dd className="inline whitespace-pre-wrap">{c.preRequisitos}</dd></div>}
            {c.dadosTeste && <div><dt className="inline font-medium">Dados de teste: </dt><dd className="inline whitespace-pre-wrap">{c.dadosTeste}</dd></div>}
          </dl>
        )}

        {reteste.falhaOriginal && (
          <details className="mt-5 rounded-lg border border-slate-200 bg-white">
            <summary className={`flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${FOCO}`}>Ver a tentativa anterior (a falha que você relatou)</summary>
            <div className="border-t border-slate-100 px-4 py-3 text-sm">
              <p className="whitespace-pre-wrap">{reteste.falhaOriginal.obs || "Sem relato."}</p>
              {reteste.falhaOriginal.anexos.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{reteste.falhaOriginal.anexos.map((u, k) => <li key={u}><Imagem src={u} alt={`Print ${k + 1} da tentativa anterior`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" /></li>)}</ul>}
            </div>
          </details>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
          <button type="button" onClick={() => setVista({ t: "passo", id: primeiro })} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 ${FOCO}`}>
            {enviado ? "Consultar o que enviei" : iniciou ? "Continuar reteste" : "Começar reteste"}
          </button>
          {!enviado && <button type="button" onClick={() => setVista({ t: "resumo" })} className={`min-h-11 rounded-md border border-indigo-700 bg-white px-5 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 ${FOCO}`}>Enviar reteste</button>}
          {enviado && <button type="button" onClick={() => setVista({ t: "resumo" })} className={`min-h-11 rounded-md border border-slate-400 bg-white px-5 text-sm font-medium ${FOCO}`}>Ver resumo</button>}
          <button type="button" onClick={aoVoltar} className={`min-h-11 rounded px-3 text-sm font-medium text-indigo-800 underline ${FOCO}`}>Voltar para Meus testes</button>
        </div>
      </main>
    </div>
  );
}
