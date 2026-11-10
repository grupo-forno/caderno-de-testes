"use client";

import { useEffect, useMemo, useState } from "react";
import Execucao, { ChipEstado, type PassoFila } from "@/components/Execucao";
import Reteste, { type RetesteDados } from "@/components/Reteste";
import { estadoPasso, passoCompleto } from "@/lib/passos";
import { pendentes as passosPendentes, progresso, ROTULO_ESTADO_ATRIBUICAO, somar, type CenarioSnap } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";
import { usePassos } from "@/lib/usePassos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const TEMPO = 15000;
const CHAVE_LOCAL = "convite-rodada";

export type DadosRodada = {
  rodada: { sistema: string; nome: string; versao: string; ambienteUrl: string | null; prazo: string | null; resumo: string; instrucoes: string; foraEscopo: string };
  validador: { nome: string; nota: string };
  atribuicoes: { id: string; enviadoEm: string | null; cenario: CenarioSnap }[]; // ids dos passos já vêm como "<atribuição>_<passo>"
  respostas: Record<string, RespPasso>;
  aprovada?: { em: string; mensagem: string } | null; // a rodada foi aprovada: tudo vira só leitura
  retestes?: RetesteDados[]; // pedidos de reteste desta pessoa (abertos e enviados)
  respostasReteste?: Record<string, RespPasso>; // ids no formato "<reteste>_<passo>"
};

const dia = (iso: string) => iso.split("-").reverse().join("/");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const grupoDe = (c: CenarioSnap) => (c.modulos.length > 1 ? `Fluxo entre módulos: ${c.modulos.join(" → ")}` : c.modulos[0] ? `Módulo ${c.modulos[0]}` : "Sem módulo indicado");
const COR_ESTADO_ATRIB = { sem_resposta: "bg-white text-slate-800 ring-slate-400", em_andamento: "bg-amber-100 text-amber-950 ring-amber-300", enviado: "bg-indigo-100 text-indigo-900 ring-indigo-300" } as const;

// Página de quem valida: entra pelo convite (#k=...), guarda o convite neste aparelho e busca SÓ os testes atribuídos a essa pessoa
export default function MeusTestesAoVivo() {
  const [token, setToken] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosRodada | null>(null);
  const [fase, setFase] = useState<"carregando" | "sem_acesso" | "erro" | "pronto">("carregando");
  const [msg, setMsg] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let t: string | null = null;
    const k = window.location.hash.match(/^#k=([\w.-]+)$/)?.[1];
    if (k) {
      t = k;
      try {
        localStorage.setItem(CHAVE_LOCAL, k);
        window.history.replaceState(null, "", window.location.pathname); // o convite sai do endereço depois de lido
      } catch {}
    } else {
      try {
        t = localStorage.getItem(CHAVE_LOCAL);
      } catch {}
    }
    if (!t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFase("sem_acesso");
      return;
    }
    setToken(t);
    setFase("carregando");
    fetch("/api/rodada", { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(TEMPO), cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.status === 401) {
          try {
            localStorage.removeItem(CHAVE_LOCAL);
          } catch {}
          setMsg(j?.erro ?? "");
          return setFase("sem_acesso");
        }
        if (!r.ok || !j?.rodada) {
          setMsg(j?.erro ?? "");
          return setFase("erro");
        }
        setDados(j as DadosRodada);
        setFase("pronto");
      })
      .catch(() => {
        setMsg("");
        setFase("erro");
      });
  }, [tentativa]);

  if (fase === "carregando") return <main className="mx-auto max-w-2xl px-4 py-10"><p role="status" className="text-sm text-slate-700">Carregando seus testes…</p></main>;
  if (fase === "sem_acesso")
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Meus testes</h1>
        <p role="alert" className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm">{msg || "Para ver seus testes, abra o link de acesso que você recebeu. Digitar o e-mail não é suficiente."}</p>
        <p className="mt-3 text-sm text-slate-700">Se perdeu o link ou ele parou de funcionar, peça um novo a quem preparou a rodada.</p>
      </main>
    );
  if (fase === "erro")
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Meus testes</h1>
        <div role="alert" className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="font-semibold">Não conseguimos carregar seus testes.</p>
          <p className="mt-1">{msg || "Confira sua internet e tente de novo."}</p>
          <button type="button" onClick={() => setTentativa((n) => n + 1)} className={`mt-3 min-h-11 rounded-md bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800 ${FOCO}`}>Tentar de novo</button>
        </div>
      </main>
    );
  return <MeusTestes dados={dados!} token={token} />;
}

type Vista = { t: "inicio" } | { t: "passo"; id: string } | { t: "resumo" } | { t: "reteste"; id: string };

// A tela inteira. Em "previa" (equipe, rodada em rascunho) mostra igual, mas nada é salvo nem enviado.
export function MeusTestes({ dados, token, previa = false }: { dados: DadosRodada; token?: string | null; previa?: boolean }) {
  const [vista, setVista] = useState<Vista>({ t: "inicio" });
  const [enviados, setEnviados] = useState<Record<string, string | null>>(() => Object.fromEntries(dados.atribuicoes.map((a) => [a.id, a.enviadoEm])));
  const [envio, setEnvio] = useState<{ fase: "parado" | "enviando"; erro: string | null }>({ fase: "parado", erro: null });
  const [confirmando, setConfirmando] = useState(false);
  const [retestes, setRetestes] = useState<RetesteDados[]>(dados.retestes ?? []);
  const [respRt, setRespRt] = useState<Record<string, RespPasso>>(dados.respostasReteste ?? {});
  const cred = token && !previa ? { caderno: "", chave: token, api: "/api/rodada/resposta" } : null;
  const ps = usePassos(cred);
  const { definir } = ps;

  useEffect(() => {
    definir(dados.respostas, dados.aprovada?.mensagem ?? null);
  }, [dados, definir]);

  const resp = ps.resp;
  const todosEnviados = dados.atribuicoes.length > 0 && dados.atribuicoes.every((a) => enviados[a.id]);

  // todos os passos do validador, na ordem, para o executor do Módulo 1
  const fila = useMemo(() => {
    const f: PassoFila[] = [];
    dados.atribuicoes.forEach((a, ai) => {
      const c = a.cenario;
      c.passos.forEach((p, n) => {
        const moduloNome = p.tela?.modulo ?? c.modulos[0] ?? "Sem módulo";
        f.push({
          passo: { id: p.id, fazer: p.fazer, esperado: p.esperado },
          indice: n + 1,
          total: c.passos.length,
          item: { id: a.id, nome: c.titulo, faz: c.objetivo },
          tela: { id: p.tela?.id ?? "", moduloId: moduloNome, titulo: p.tela?.titulo ?? "Sem tela indicada", imagem: p.tela?.imagem ?? null, link: p.tela?.link ?? null, pdf: null, itens: [], paiId: null },
          numeroTela: "",
          modulo: { id: moduloNome, titulo: moduloNome },
          numeroModulo: String(ai + 1),
          perfil: p.perfil || undefined,
          perfilAnterior: n > 0 ? c.passos[n - 1].perfil || null : null,
        });
      });
    });
    return f;
  }, [dados]);

  const prog = (a: DadosRodada["atribuicoes"][number]) => progresso(a.cenario.passos.map((p) => p.id), resp, !!enviados[a.id]);
  const geral = somar(dados.atribuicoes.map(prog));
  const iniciou = Object.keys(resp).length > 0 || todosEnviados;
  const idsPendentes = dados.atribuicoes.flatMap((a) => (enviados[a.id] ? [] : passosPendentes(a.cenario.passos.map((p) => p.id), resp)));
  const ocupado = ps.ocupado > 0 || ps.falhas > 0;

  const irPara = (id: string) => setVista({ t: "passo", id });
  const retestesAbertos = retestes.filter((t) => t.status === "solicitado");
  const retestesEnviados = retestes.filter((t) => t.status === "enviado");
  const primeiroPendente = (ids?: string[]) => (ids ?? fila.map((f) => f.passo.id)).find((id) => !passoCompleto(resp[id])) ?? (ids ?? fila.map((f) => f.passo.id))[0];

  async function enviar() {
    if (!token || previa) return;
    setEnvio({ fase: "enviando", erro: null });
    try {
      const r = await fetch("/api/rodada/enviar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TEMPO) });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setConfirmando(false);
        return setEnvio({ fase: "parado", erro: j?.erro ?? "Não conseguimos enviar agora. Seus resultados continuam salvos; tente de novo." });
      }
      const agora = new Date().toISOString();
      setEnviados(Object.fromEntries(dados.atribuicoes.map((a) => [a.id, enviados[a.id] ?? agora])));
      setConfirmando(false);
      setEnvio({ fase: "parado", erro: null });
    } catch {
      setConfirmando(false);
      setEnvio({ fase: "parado", erro: "Não conseguimos enviar agora. Confira sua internet; seus resultados continuam salvos." });
    }
  }

  useEffect(() => {
    document.getElementById("titulo-tela")?.focus({ preventScroll: true });
  }, [vista]);

  const salvamento: { texto: string; tipo: "ok" | "salvando" | "erro" } = previa
    ? { texto: "Prévia: nada é salvo.", tipo: "ok" }
    : ps.bloqueio
      ? { texto: ps.bloqueio, tipo: "erro" }
      : ps.falhas > 0
        ? { texto: "Há respostas sem salvar. Elas continuam na tela: confira a internet e tente de novo.", tipo: "erro" }
        : ps.ocupado > 0
          ? { texto: "Salvando…", tipo: "salvando" }
          : { texto: ps.salvo ? `Salvo às ${ps.salvo}` : "Suas respostas são salvas sozinhas", tipo: "ok" };

  const cab = (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-800">Meus testes · {dados.rodada.sistema}</p>
          <h1 className="break-words text-xl font-semibold sm:text-2xl">{dados.rodada.nome} <span className="text-base font-normal text-slate-700">versão {dados.rodada.versao}</span></h1>
        </div>
        <div className="text-xs text-slate-700">
          <p aria-live="polite">{salvamento.texto}</p>
          <p className="mt-0.5">{dados.validador.nome}{vista.t !== "inicio" && <> · <button type="button" onClick={() => setVista({ t: "inicio" })} className={`rounded underline ${FOCO}`}>Início</button></>}</p>
        </div>
      </div>
    </header>
  );

  const aviso = (
    <div className="space-y-3">
      {dados.aprovada && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><strong>Rodada aprovada.</strong> {dados.aprovada.mensagem}</p>}
      {previa && <p role="status" className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-950"><strong>Prévia como validador.</strong> É assim que {dados.validador.nome} vai ver. Nada é salvo nem enviado aqui.</p>}
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

  // ---------- reteste ----------
  if (vista.t === "reteste") {
    const t = retestes.find((x) => x.id === vista.id);
    if (t) {
      const respostas: Record<string, RespPasso> = {};
      for (const p of t.passos) if (respRt[p.id]) respostas[p.id] = respRt[p.id];
      return (
        <Reteste
          key={t.id}
          reteste={t}
          respostas={respostas}
          token={token}
          previa={previa}
          aprovada={dados.aprovada?.mensagem ?? null}
          aoVoltar={() => setVista({ t: "inicio" })}
          aoAtualizar={(m) => setRespRt((x) => ({ ...x, ...m }))}
          aoEnviado={(id, resultado, situacao) => setRetestes((l) => l.map((x) => (x.id === id ? { ...x, status: "enviado", resultado, pendenciaSituacao: situacao, enviadoEm: new Date().toISOString() } : x)))}
        />
      );
    }
  }

  // ---------- passo ----------
  if (vista.t === "passo") {
    const pos = fila.findIndex((f) => f.passo.id === vista.id);
    if (pos >= 0) {
      const atual = fila[pos];
      return (
        <div className="min-h-screen">
          {cab}
          <main className="mx-auto max-w-5xl px-4 py-5">
            {aviso}
            <div className="mt-3">
              <Execucao
                key={atual.passo.id}
                atual={atual}
                fila={fila}
                posicao={pos}
                resp={resp}
                chave={token ?? ""}
                slug=""
                payloadUpload={JSON.stringify({ convite: token })}
                rotuloItem="Cenário"
                semLinkTela
                somenteLeitura={previa || !!enviados[atual.item.id] || !!ps.concluido}
                salvamento={salvamento}
                aoMudar={previa ? () => {} : ps.mudar}
                aoIr={(id) => irPara(id.replace(/^p:/, ""))}
                aoSair={() => setVista(pos === fila.length - 1 ? { t: "resumo" } : { t: "inicio" })}
              />
            </div>
          </main>
        </div>
      );
    }
  }

  // ---------- resumo e envio ----------
  if (vista.t === "resumo") {
    const sentido = (estado: ReturnType<typeof estadoPasso>) => (estado === "funcionou" ? "Funcionou" : estado === "diferente" ? "Deu diferente" : estado === "bloqueado" ? "Não consegui testar" : "Sem resposta");
    return (
      <div className="min-h-screen">
        {cab}
        <main className="mx-auto max-w-3xl px-4 py-6">
          {aviso}
          <h2 id="titulo-tela" tabIndex={-1} className="mt-3 text-2xl font-semibold focus:outline-none">{todosEnviados ? "Resultados enviados" : "Resumo antes de enviar"}</h2>
          {todosEnviados && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><strong>Pronto, seus resultados foram enviados.</strong> Obrigado! A equipe já pode ver o que você registrou. Você pode consultar tudo abaixo, mas não mudar.</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-4" aria-label="Totais">
            {[["Funcionou", geral.funcionou, "text-emerald-800"], ["Deu diferente", geral.diferente, "text-rose-800"], ["Bloqueado", geral.bloqueado, "text-amber-900"], ["Sem resposta", geral.semResposta, "text-slate-800"]].map(([t, n, cor]) => (
              <li key={t as string} className="rounded-lg border border-slate-200 bg-white p-3"><p className={`text-2xl font-semibold tabular-nums ${cor}`}>{n}</p><p className="text-sm">{t}</p></li>
            ))}
          </ul>

          {!todosEnviados && idsPendentes.length > 0 && (
            <section aria-labelledby="t-pend" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 id="t-pend" className="font-semibold text-amber-950">{plural(idsPendentes.length, "passo ainda precisa de resposta", "passos ainda precisam de resposta")}</h3>
              <p className="mt-1 text-sm text-amber-950">Para enviar, responda todos. “Deu diferente” e “Não consegui testar” também precisam da explicação. Falhas e bloqueios podem ser enviados.</p>
              <ul className="mt-3 space-y-2">
                {idsPendentes.map((id) => {
                  const f = fila.find((x) => x.passo.id === id)!;
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => irPara(id)} className={`flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 ${FOCO}`}>
                        <span className="font-semibold">{f.item.nome} · passo {f.indice}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{f.passo.fazer}</span>
                        <ChipEstado estado={estadoPasso(resp[id])} />
                        <span aria-hidden="true" className="underline">Ir para este passo</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <ul className="mt-5 space-y-3">
            {dados.atribuicoes.map((a) => {
              const p = prog(a);
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold">{a.cenario.titulo}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_ESTADO_ATRIB[p.estado]}`}>{ROTULO_ESTADO_ATRIBUICAO[p.estado]}</span>
                  </div>
                  <ol className="mt-2 space-y-1 text-sm">
                    {a.cenario.passos.map((s, n) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => irPara(s.id)} className={`min-h-11 rounded text-left underline ${FOCO}`}>Passo {n + 1}</button>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{s.fazer}</span>
                        <ChipEstado estado={estadoPasso(resp[s.id])} />
                        <span className="sr-only">{sentido(estadoPasso(resp[s.id]))}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>

          {envio.erro && <p role="alert" className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{envio.erro}</p>}
          {!todosEnviados && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!confirmando ? (
                <button type="button" disabled={previa || idsPendentes.length > 0 || ocupado || !!dados.aprovada} onClick={() => setConfirmando(true)} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 ${FOCO}`}>
                  {ocupado ? "Aguarde: salvando…" : "Enviar meus resultados"}
                </button>
              ) : (
                <div role="alertdialog" aria-label="Confirmar envio" className="w-full rounded-lg border border-indigo-300 bg-indigo-50 p-4 text-sm text-indigo-950">
                  <p className="font-semibold">Enviar agora?</p>
                  <p className="mt-1">Depois de enviar, você não muda mais as respostas. {geral.diferente + geral.bloqueado > 0 ? `Serão enviados ${plural(geral.diferente, "passo que deu diferente", "passos que deram diferente")} e ${plural(geral.bloqueado, "bloqueado", "bloqueados")}.` : "Tudo funcionou."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={envio.fase === "enviando"} onClick={enviar} className={`min-h-11 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 ${FOCO}`}>{envio.fase === "enviando" ? "Enviando…" : "Sim, enviar"}</button>
                    <button type="button" onClick={() => setConfirmando(false)} className={`min-h-11 rounded-md border border-slate-400 bg-white px-5 text-sm font-medium ${FOCO}`}>Voltar</button>
                  </div>
                </div>
              )}
              {idsPendentes.length > 0 && <p className="text-sm text-slate-700">Responda os passos pendentes para liberar o envio.</p>}
            </div>
          )}
          <p className="mt-6"><button type="button" onClick={() => setVista({ t: "inicio" })} className={`min-h-11 rounded text-sm font-medium text-indigo-800 underline ${FOCO}`}>Voltar ao início</button></p>
        </main>
      </div>
    );
  }

  // ---------- início ----------
  const grupos = new Map<string, DadosRodada["atribuicoes"]>();
  for (const a of dados.atribuicoes) grupos.set(grupoDe(a.cenario), [...(grupos.get(grupoDe(a.cenario)) ?? []), a]);
  const nEnviadas = dados.atribuicoes.filter((a) => enviados[a.id]).length;

  return (
    <div className="min-h-screen">
      {cab}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {aviso}
        <h2 id="titulo-tela" tabIndex={-1} className="mt-3 text-2xl font-semibold focus:outline-none">Meus testes</h2>
        <p className="mt-2 text-base text-slate-800">
          Olá, {dados.validador.nome}. Você vai validar a entrega <strong>{dados.rodada.nome}</strong> (versão {dados.rodada.versao}) de {dados.rodada.sistema}
          {dados.rodada.prazo && <>, <strong>até {dia(dados.rodada.prazo)}</strong></>}.
        </p>
        {dados.rodada.resumo && <section className="mt-3"><h3 className="text-sm font-semibold">O que mudou nesta entrega</h3><p className="whitespace-pre-wrap text-sm text-slate-800">{dados.rodada.resumo}</p></section>}
        {dados.rodada.instrucoes && <section className="mt-3"><h3 className="text-sm font-semibold">Instruções gerais</h3><p className="whitespace-pre-wrap text-sm text-slate-800">{dados.rodada.instrucoes}</p></section>}
        {dados.rodada.foraEscopo && <section className="mt-3"><h3 className="text-sm font-semibold">Fora do escopo desta rodada</h3><p className="whitespace-pre-wrap text-sm text-slate-800">{dados.rodada.foraEscopo}</p></section>}
        {dados.validador.nota && <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><strong>Orientação para você:</strong> {dados.validador.nota}</p>}

        {retestesAbertos.length > 0 && (
          <section aria-labelledby="t-retestes" className="mt-5 rounded-lg border-2 border-violet-400 bg-violet-50 p-4">
            <h3 id="t-retestes" className="text-lg font-semibold text-violet-950">Retestes pendentes ({retestesAbertos.length})</h3>
            <p className="mt-1 text-sm text-violet-950">A equipe corrigiu o que você relatou e pediu para conferir de novo.</p>
            <ul className="mt-3 space-y-2">
              {retestesAbertos.map((t) => (
                <li key={t.id} className="rounded-md border border-violet-200 bg-white p-3 text-sm">
                  <p className="font-semibold">{t.cenario.titulo} <span className="font-normal text-slate-700">· reteste {t.numero} · versão {t.versao}</span></p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800"><span className="font-medium">Corrigido:</span> {t.corrigido}</p>
                  <p className="text-xs text-slate-700">{plural(t.passos.length, "passo para refazer", "passos para refazer")} · pedido por {t.solicitadoPor}</p>
                  <button type="button" onClick={() => setVista({ t: "reteste", id: t.id })} className={`mt-2 min-h-11 rounded-md bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800 ${FOCO}`}>
                    {t.passos.some((p) => respRt[p.id]) ? "Continuar reteste" : "Começar reteste"}<span className="sr-only"> de {t.cenario.titulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-950">
            {todosEnviados ? "Você já enviou todos os seus resultados." : iniciou ? `Você respondeu ${geral.respondidos} de ${geral.total} passos. Suas respostas são salvas sozinhas.` : `${plural(dados.atribuicoes.length, "teste atribuído", "testes atribuídos")} a você, com ${plural(geral.total, "passo", "passos")} no total.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {todosEnviados ? (
              <button type="button" onClick={() => setVista({ t: "resumo" })} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 ${FOCO}`}>Consultar o que enviei</button>
            ) : (
              <button type="button" disabled={!fila.length} onClick={() => irPara(primeiroPendente())} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 ${FOCO}`}>
                {iniciou ? "Continuar de onde parei" : "Começar meus testes"}
              </button>
            )}
            {dados.rodada.ambienteUrl && (
              <a href={dados.rodada.ambienteUrl} target="_blank" rel="noreferrer" className={`inline-flex min-h-12 items-center rounded-md border border-indigo-700 bg-white px-5 text-base font-medium text-indigo-900 hover:bg-indigo-100 ${FOCO}`}>
                Abrir ambiente de teste<span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </div>
          {dados.rodada.ambienteUrl && <p className="mt-2 text-xs text-indigo-950">O ambiente de teste abre em outra aba. Volte aqui para responder.</p>}
        </div>

        {dados.atribuicoes.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-800">Nenhum teste foi atribuído a você nesta rodada. Se isso parece errado, avise quem preparou a rodada.</p>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-700">{nEnviadas} de {dados.atribuicoes.length} testes enviados.</p>
            {[...grupos.entries()].map(([grupo, lista]) => (
              <section key={grupo} aria-label={grupo} className="mt-3">
                <h3 className="text-base font-semibold">{grupo}</h3>
                <ul className="mt-2 space-y-3">
                  {lista.map((a) => {
                    const p = prog(a);
                    const ids = a.cenario.passos.map((s) => s.id);
                    return (
                      <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h4 className="min-w-0 break-words font-semibold">{a.cenario.titulo}</h4>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_ESTADO_ATRIB[p.estado]}`}>{ROTULO_ESTADO_ATRIBUICAO[p.estado]}</span>
                        </div>
                        <p className="mt-1 text-sm tabular-nums text-slate-700">{p.respondidos} de {p.total} passos respondidos{p.diferente > 0 && <span className="font-semibold text-rose-800"> · {plural(p.diferente, "deu diferente", "deram diferente")}</span>}{p.bloqueado > 0 && <span className="font-semibold text-amber-900"> · {plural(p.bloqueado, "bloqueado", "bloqueados")}</span>}</p>
                        {a.cenario.objetivo && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{a.cenario.objetivo}</p>}
                        <dl className="mt-2 space-y-1 text-sm">
                          {a.cenario.perfis.length > 0 && <div><dt className="inline font-medium">Perfis de acesso: </dt><dd className="inline">{a.cenario.perfis.join(", ")}<span className="block text-xs text-slate-600">Perfil é a conta ou função usada no sistema em teste. Cada passo diz qual usar. As senhas não ficam aqui.</span></dd></div>}
                          {a.cenario.preRequisitos && <div><dt className="inline font-medium">Antes de começar: </dt><dd className="inline whitespace-pre-wrap">{a.cenario.preRequisitos}</dd></div>}
                          {a.cenario.dadosTeste && <div><dt className="inline font-medium">Dados de teste: </dt><dd className="inline whitespace-pre-wrap">{a.cenario.dadosTeste}</dd></div>}
                        </dl>
                        <button type="button" onClick={() => irPara(primeiroPendente(ids))} className={`mt-3 min-h-11 rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
                          {enviados[a.id] ? "Consultar" : p.estado === "sem_resposta" ? "Começar este teste" : "Continuar este teste"}<span className="sr-only"> {a.cenario.titulo}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {retestesEnviados.length > 0 && (
              <section aria-labelledby="t-rt-env" className="mt-6">
                <h3 id="t-rt-env" className="text-base font-semibold">Retestes enviados</h3>
                <ul className="mt-2 space-y-2">
                  {retestesEnviados.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <span className="min-w-0 flex-1">{t.cenario.titulo} · reteste {t.numero} · versão {t.versao}</span>
                      <button type="button" onClick={() => setVista({ t: "reteste", id: t.id })} className={`min-h-11 rounded-md border border-slate-400 bg-white px-4 font-medium hover:bg-slate-50 ${FOCO}`}>Consultar<span className="sr-only"> reteste {t.numero} de {t.cenario.titulo}</span></button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setVista({ t: "resumo" })} className={`min-h-11 rounded-md border border-indigo-700 bg-white px-5 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 ${FOCO}`}>
                {todosEnviados ? "Ver resumo" : "Enviar meus resultados"}
              </button>
              <p className="mt-1 text-xs text-slate-700">Você ainda confere o resumo antes de enviar.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
