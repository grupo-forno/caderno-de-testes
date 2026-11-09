"use client";

import { useEffect, useRef, useState } from "react";
import Imagem from "@/components/Imagem";
import LinkTela from "@/components/LinkTela";
import { ChipStatus, COR_ICONE, IconeStatus } from "@/components/StatusBadge";
import { ROTULO_STATUS, type ResumoTela } from "@/lib/status";
import { ROTULO_SEVERIDADE, SEVERIDADES, type Evento, type Item, type Resp, type Resultado, type Tela } from "@/lib/tipos";

export const OPCOES: { v: Resultado; label: string; dica: string }[] = [
  { v: "ok", label: "OK", dica: "Testei e está aprovado." },
  { v: "nao_ok", label: "NÃO OK", dica: "Testei e algo não está certo. Conte o que mudar." },
  { v: "nao_testado", label: "NÃO TESTADO", dica: "Ainda não consegui testar." },
];
const ROTULO: Record<string, string> = { ok: "OK", nao_ok: "NÃO OK", nao_testado: "NÃO TESTADO" };

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const MAX_PRINTS = 10;
const MAX_OBS = 5000;

const ATIVO: Record<Resultado, string> = {
  ok: "border-emerald-600 bg-emerald-50 text-emerald-950",
  nao_ok: "border-rose-600 bg-rose-50 text-rose-950",
  nao_testado: "border-slate-600 bg-slate-100 text-slate-900",
};
const CHIP: Record<Resultado, string> = {
  ok: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  nao_ok: "bg-rose-100 text-rose-900 ring-rose-300",
  nao_testado: "bg-slate-100 text-slate-700 ring-slate-300",
};
const BARRA: Record<Resultado, string> = { ok: "border-l-emerald-600", nao_ok: "border-l-rose-600", nao_testado: "border-l-slate-400" };

const data = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function IconeResultado({ v }: { v: Resultado }) {
  const p = { viewBox: "0 0 20 20", className: "h-4 w-4 shrink-0", "aria-hidden": true as const, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (v === "ok") return <svg {...p}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>;
  if (v === "nao_ok") return <svg {...p}><path d="M5 5l10 10M15 5L5 15" /></svg>;
  return <svg {...p}><path d="M5 10h10" /></svg>;
}

// Se a pessoa marcou NÃO OK e quem monta o caderno corrigiu depois, o cliente precisa testar de novo
function correcaoNova(historico: Evento[], r: Resp): Evento | null {
  if (r.resultado !== "nao_ok") return null;
  const meus = historico.filter((e) => e.ator === "cliente");
  const ultimoMeu = meus.length ? meus[meus.length - 1].criado : "";
  const corrigidos = historico.filter((e) => e.tipo === "correcao" && e.criado > ultimoMeu);
  return corrigidos.length ? corrigidos[corrigidos.length - 1] : null;
}

function descreve(e: Evento): string {
  if (e.tipo === "correcao") return `${e.nome} marcou como corrigido${e.obs ? `: ${e.obs}` : "."}`;
  if (e.tipo === "resultado") {
    const antes = e.de && e.de !== "nao_testado" ? ` (antes: ${ROTULO[e.de] ?? e.de})` : "";
    const grave = e.severidade ? ` Gravidade: ${ROTULO_SEVERIDADE[e.severidade]}.` : "";
    return `Você marcou ${ROTULO[e.para ?? ""] ?? e.para}${antes}.${grave}`;
  }
  return "Você editou a observação ou os prints.";
}

type Props = {
  tela: Tela;
  numero: string;
  pai: Tela | null;
  filhos: { tela: Tela; numero: string }[];
  resumos: Record<string, ResumoTela>;
  res: (id: string) => Resp;
  historico: Record<string, Evento[]>;
  aoMudar: (tela: Tela, item: Item, patch: Partial<Resp>) => void;
  aoIr: (id: string) => void;
  voltar: { id: string; rotulo: string } | null;
  avancar: { id: string; rotulo: string } | null;
  aoAnexar: (tela: Tela, item: Item, files: FileList) => void;
  enviando: Record<string, number>;
  erroAnexo: { id: string; msg: string } | null;
  okAnexo: { id: string; msg: string } | null;
  somenteLeitura: boolean; // homologação concluída: ninguém muda mais nada
};

function Funcionalidade({ tela, item, indice, r, eventos, aberto, aoAlternar, aoMudar, aoAnexar, enviando, erroAnexo, okAnexo, somenteLeitura }: {
  tela: Tela; item: Item; indice: number; r: Resp; eventos: Evento[]; aberto: boolean; aoAlternar: () => void;
  aoMudar: Props["aoMudar"]; aoAnexar: Props["aoAnexar"]; enviando: boolean; erroAnexo: string | null; okAnexo: string | null; somenteLeitura: boolean;
}) {
  const idNome = `f-${item.id}`;
  const idCorpo = `c-${item.id}`;
  const faltaObs = r.resultado === "nao_ok" && !r.obs.trim();
  const corrigido = correcaoNova(eventos, r);
  const botaoTitulo = useRef<HTMLButtonElement>(null);
  const focoPendente = useRef<string | null>(null);
  const anexosAntes = useRef(r.anexos.length);

  // Quando o elemento que tinha o foco some (print removido, campo de anexar que vira texto), o foco vai para um vizinho.
  // Só age quando a quantidade de prints muda, nunca ao abrir a tela.
  useEffect(() => {
    const antes = anexosAntes.current;
    anexosAntes.current = r.anexos.length;
    if (focoPendente.current) {
      document.getElementById(focoPendente.current)?.focus();
      focoPendente.current = null;
    } else if (antes < MAX_PRINTS && r.anexos.length >= MAX_PRINTS && (!document.activeElement || document.activeElement === document.body)) {
      botaoTitulo.current?.focus();
    }
  }, [r.anexos.length]);

  function remover(u: string, k: number) {
    const resto = r.anexos.filter((x) => x !== u);
    focoPendente.current = resto.length ? `p-${item.id}-${Math.min(k, resto.length - 1)}` : `a-${item.id}`;
    aoMudar(tela, item, { anexos: resto });
  }

  const miniaturas = r.anexos.length > 0 && (
    <ul className="mt-3 flex flex-wrap gap-4">
      {r.anexos.map((u, k) => (
        <li key={u} className="relative">
          <a id={`p-${item.id}-${k}`} href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} de “${item.nome}” em nova aba`} className={`block rounded-md ${FOCO}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Print ${k + 1} de “${item.nome}”`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" loading="lazy" decoding="async" />
          </a>
          {!somenteLeitura && (
            <button type="button" aria-label={`Remover print ${k + 1} de “${item.nome}”`} onClick={() => remover(u, k)} className={`absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full ${FOCO}`}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm text-white">×</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <article aria-labelledby={idNome} className={`scroll-mt-28 rounded-lg border border-slate-200 border-l-4 bg-white ${BARRA[r.resultado]}`}>
      <h4 id={idNome} className="m-0">
        <button
          ref={botaoTitulo}
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberto}
          aria-controls={idCorpo}
          className={`flex min-h-11 w-full flex-wrap items-start gap-x-3 gap-y-2 rounded-lg p-4 text-left sm:px-5 ${FOCO}`}
        >
          <span className="min-w-[12rem] flex-1 whitespace-pre-wrap break-words text-base font-semibold">
            <span className="mr-2 text-slate-600">{indice}.</span>
            {item.nome}
          </span>
          {corrigido && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-900 ring-1 ring-inset ring-indigo-300">Corrigido: teste de novo</span>}
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${CHIP[r.resultado]}`}>
            <IconeResultado v={r.resultado} />
            {ROTULO[r.resultado]}
          </span>
          <svg viewBox="0 0 20 20" className={`mt-0.5 h-5 w-5 shrink-0 text-slate-600 transition-transform motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h4>

      {/* sempre no DOM, escondido quando fechado: o aria-controls aponta para algo que existe */}
      <div id={idCorpo} hidden={!aberto} className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {item.faz && <p className="whitespace-pre-wrap text-sm text-slate-700">{item.faz}</p>}
        {item.imagem && <div className="mt-3"><Imagem src={item.imagem} alt={`Print da funcionalidade “${item.nome}”`} className="max-h-72 rounded-md border border-slate-200" /></div>}

        <div role="status">
          {corrigido && (
            <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
              <p className="font-semibold">Corrigido em {data(corrigido.criado)}.</p>
              {corrigido.obs && <p className="mt-1 whitespace-pre-wrap">{corrigido.obs}</p>}
              <p className="mt-1">Teste de novo e escolha o novo resultado.</p>
              <p className="mt-1">Se continua com problema, escreva na observação o que ainda acontece.</p>
            </div>
          )}
        </div>

        {somenteLeitura ? (
          <div className="mt-4 text-sm">
            <p><span className="font-semibold">Resultado:</span> {ROTULO[r.resultado]}</p>
            {r.resultado === "nao_ok" && r.severidade && <p className="mt-1"><span className="font-semibold">Gravidade:</span> {ROTULO_SEVERIDADE[r.severidade]}</p>}
            <p className="mt-1 whitespace-pre-wrap"><span className="font-semibold">Observações:</span> {r.obs.trim() ? r.obs : "Sem observações."}</p>
            {miniaturas}
          </div>
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">
                Seu resultado<span className="sr-only"> para {item.nome}</span>
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {OPCOES.map((o) => (
                  <label
                    key={o.v}
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
                      r.resultado === o.v ? ATIVO[o.v] : "border-slate-400 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input type="radio" name={`r-${item.id}`} className="sr-only" checked={r.resultado === o.v} onChange={() => aoMudar(tela, item, { resultado: o.v })} />
                    <IconeResultado v={o.v} />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {r.resultado === "nao_ok" && (
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold">
                  Quão grave é?<span className="sr-only"> ({item.nome})</span>
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {SEVERIDADES.map((sv) => (
                    <label
                      key={sv}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
                        r.severidade === sv ? "border-rose-600 bg-rose-50 text-rose-950" : "border-slate-400 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input type="radio" name={`s-${item.id}`} className="sr-only" checked={r.severidade === sv} onChange={() => aoMudar(tela, item, { severidade: sv })} />
                      {ROTULO_SEVERIDADE[sv]}
                    </label>
                  ))}
                </div>
                {r.severidade === null && <p className="mt-2 text-sm text-slate-700">Escolha a gravidade. Sem escolher, conta como “Impede de usar”.</p>}
              </fieldset>
            )}

            <div className="mt-4">
              <label htmlFor={`o-${item.id}`} className="text-sm font-semibold">
                Observações
                {r.resultado === "nao_ok" && <span className="ml-1 font-normal text-rose-800">(conte o que precisa mudar)</span>}
              </label>
              <textarea
                id={`o-${item.id}`}
                rows={2}
                maxLength={MAX_OBS}
                value={r.obs}
                aria-invalid={faltaObs || undefined}
                aria-describedby={`e-${item.id}`}
                onChange={(e) => aoMudar(tela, item, { obs: e.target.value })}
                placeholder="Ex.: o botão Salvar não responde…"
                className="field-sizing-content mt-2 min-h-16 w-full scroll-mt-28 resize-y rounded-md border border-slate-500 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm"
              />
              <div id={`e-${item.id}`} className="mt-1 text-sm">
                {faltaObs && <p className="text-rose-800">Escreva o que precisa mudar para quem monta o caderno conseguir corrigir.</p>}
                {r.obs.length > MAX_OBS - 500 && <p className="text-slate-700">{r.obs.length} de {MAX_OBS} letras.</p>}
              </div>

              <div className="mt-2">
                {r.anexos.length < MAX_PRINTS ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-medium hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600">
                    Anexar print
                    <input id={`a-${item.id}`} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) aoAnexar(tela, item, e.target.files); e.target.value = ""; }} />
                  </label>
                ) : (
                  <p className="text-sm text-slate-700">Limite de {MAX_PRINTS} prints nesta funcionalidade. Remova um para anexar outro.</p>
                )}
                {/* região sempre presente: só o texto muda, para o leitor de tela anunciar */}
                <span role="status" className="ml-2 text-sm text-slate-700">{enviando ? "Enviando…" : okAnexo ?? ""}</span>
                <div role="alert">{erroAnexo && <p className="mt-1 text-sm text-rose-800">{erroAnexo}</p>}</div>
                {miniaturas}
              </div>
            </div>
          </>
        )}

        {eventos.length > 0 && (
          <details className="mt-4 rounded-md border border-slate-200 bg-slate-50">
            <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Histórico desta funcionalidade ({eventos.length})</summary>
            <ol className="space-y-2 border-t border-slate-200 px-3 py-2 text-sm">
              {eventos.map((e, k) => (
                <li key={k}>
                  <span className="text-xs text-slate-700">{data(e.criado)}</span>
                  <p className="whitespace-pre-wrap">{descreve(e)}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  );
}

type Filtro = "todas" | "nao_ok" | "pendentes" | "ok";

export default function TelaView({ tela, numero, pai, filhos, resumos, res, historico, aoMudar, aoIr, voltar, avancar, aoAnexar, enviando, erroAnexo, okAnexo, somenteLeitura }: Props) {
  const itens = tela.itens;
  const resumo = resumos[tela.id];
  const pop = !!pai;
  const [filtro, setFiltro] = useState<Filtro>("todas");
  // As que já estão OK começam recolhidas; a pessoa abre e fecha como quiser
  const [fechadas, setFechadas] = useState<Set<string>>(() => new Set(itens.filter((i) => res(i.id).resultado === "ok").map((i) => i.id)));
  const alternar = (id: string) => setFechadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const visiveis = itens.filter((i) => {
    const r = res(i.id).resultado;
    return filtro === "todas" || (filtro === "nao_ok" && r === "nao_ok") || (filtro === "pendentes" && r === "nao_testado") || (filtro === "ok" && r === "ok");
  });
  const FILTROS: { v: Filtro; label: string; n: number }[] = [
    { v: "todas", label: "Todas", n: itens.length },
    { v: "nao_ok", label: "NÃO OK", n: resumo.naoOk },
    { v: "pendentes", label: "Para testar", n: resumo.naoTestado },
    { v: "ok", label: "OK", n: resumo.ok },
  ];

  return (
    <div>
      {pai && (
        <LinkTela id={pai.id} aoIr={aoIr} className={`mb-2 inline-flex min-h-11 items-center rounded-md text-left text-sm font-medium text-indigo-800 underline ${FOCO}`}>
          <span aria-hidden="true">← </span>Este pop-up faz parte de “{pai.titulo}”
        </LinkTela>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="titulo-tela" tabIndex={-1} className="min-w-0 flex-1 break-words text-balance text-2xl font-semibold focus:outline-none">
          <span className="mr-2 text-slate-600">{numero}</span>
          {tela.titulo}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {somenteLeitura && <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">Somente leitura</span>}
          <ChipStatus status={resumo.status} />
        </div>
      </div>
      {resumo.status !== "em_preparacao" && (
        <p className="mt-1 text-sm tabular-nums text-slate-700">
          {resumo.ok} de {resumo.total} {resumo.total === 1 ? "funcionalidade" : "funcionalidades"} OK
          {resumo.naoOk > 0 && <span className="font-semibold text-rose-800"> · {resumo.naoOk} NÃO OK</span>}
        </p>
      )}

      {(tela.link || tela.pdf) && (
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {tela.link && (
            <a href={tela.link} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
              Abrir a tela para testar<span className="sr-only"> (abre em nova aba)</span>
            </a>
          )}
          {tela.pdf && (
            <a href={tela.pdf} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
              Ver PDF das funcionalidades<span className="sr-only"> (abre em nova aba)</span>
            </a>
          )}
        </div>
      )}

      {tela.imagem && (
        <div className="mt-5">
          <Imagem prioridade src={tela.imagem} alt={`Imagem ${pop ? "do pop-up" : "da tela"} “${tela.titulo}”`} className="w-full rounded-lg border border-slate-200" />
        </div>
      )}

      <section aria-labelledby="titulo-func" className="mt-8">
        <h3 id="titulo-func" className="text-lg font-semibold">Funcionalidades</h3>

        {itens.length === 0 ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-800">
            Esta tela ainda está sendo preparada. As funcionalidades aparecem aqui quando estiverem prontas para testar.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-700">
              {somenteLeitura ? "A homologação foi concluída: você pode ver os resultados, mas não mudar." : "Dê um resultado para cada uma. A tela só fica verde quando todas estiverem OK."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mostrar funcionalidades">
                {FILTROS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    aria-pressed={filtro === f.v}
                    onClick={() => setFiltro(f.v)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-medium tabular-nums ${FOCO} ${
                      filtro === f.v ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-400 bg-white text-slate-900 hover:bg-slate-50"
                    } ${f.v === "nao_ok" && f.n > 0 && filtro !== f.v ? "border-rose-600 text-rose-900" : ""}`}
                  >
                    {f.label} ({f.n})
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Abrir ou fechar todas as funcionalidades">
                <button type="button" onClick={() => setFechadas(new Set())} className={`min-h-11 rounded-md px-3 text-sm font-medium text-indigo-800 underline ${FOCO}`}>Abrir todas</button>
                <button type="button" onClick={() => setFechadas(new Set(itens.map((i) => i.id)))} className={`min-h-11 rounded-md px-3 text-sm font-medium text-indigo-800 underline ${FOCO}`}>Fechar todas</button>
              </div>
            </div>

            <div role="status">
              {visiveis.length === 0 && <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">Nenhuma funcionalidade neste filtro.</p>}
            </div>
            <div className="mt-4 space-y-3">
              {visiveis.map((it) => (
                <Funcionalidade
                  key={it.id}
                  tela={tela}
                  item={it}
                  indice={itens.indexOf(it) + 1}
                  r={res(it.id)}
                  eventos={historico[it.id] ?? []}
                  aberto={!fechadas.has(it.id)}
                  aoAlternar={() => alternar(it.id)}
                  aoMudar={aoMudar}
                  aoAnexar={aoAnexar}
                  enviando={(enviando[it.id] ?? 0) > 0}
                  erroAnexo={erroAnexo?.id === it.id ? erroAnexo.msg : null}
                  okAnexo={okAnexo?.id === it.id ? okAnexo.msg : null}
                  somenteLeitura={somenteLeitura}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {filhos.length > 0 && (
        <section aria-labelledby="titulo-popups" className="mt-8 rounded-lg border-l-4 border-indigo-300 bg-indigo-50/60 p-4">
          <h3 id="titulo-popups" className="text-base font-semibold text-indigo-950">Pop-ups e janelas desta tela ({filhos.length})</h3>
          <p className="mt-1 text-sm text-indigo-900">Cada um tem as suas próprias funcionalidades e o seu resultado.</p>
          <ul className="mt-3 space-y-2">
            {filhos.map(({ tela: f, numero: n }) => (
              <li key={f.id}>
                <LinkTela id={f.id} aoIr={aoIr} className={`flex min-h-11 w-full items-center gap-3 rounded-md border border-indigo-200 bg-white px-3 py-2 text-left text-sm hover:bg-indigo-50 ${FOCO}`}>
                  <span className={COR_ICONE[resumos[f.id].status]}><IconeStatus status={resumos[f.id].status} /></span>
                  <span className="flex-1 font-medium">{n} {f.titulo}</span>
                  <span className="text-xs tabular-nums text-slate-700">
                    {ROTULO_STATUS[resumos[f.id].status]}
                    {resumos[f.id].status !== "em_preparacao" && ` · ${resumos[f.id].ok} de ${resumos[f.id].total} OK`}
                  </span>
                </LinkTela>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Anterior e próxima" className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 print:hidden">
        {voltar ? (
          <LinkTela id={voltar.id} aoIr={aoIr} className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
            <span aria-hidden="true">← </span>Anterior: {voltar.rotulo}
          </LinkTela>
        ) : <span />}
        {avancar && (
          <LinkTela id={avancar.id} aoIr={aoIr} className={`inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
            Próxima: {avancar.rotulo}<span aria-hidden="true"> →</span>
          </LinkTela>
        )}
      </nav>
    </div>
  );
}
