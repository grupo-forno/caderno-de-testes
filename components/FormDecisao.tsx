"use client";

import { useEffect, useState } from "react";
import { btn, btn2, campo } from "@/components/estilos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
type Link = { texto: string; href: string | null };

export type PropsDecisao = {
  acao: (f: FormData) => void;
  chaveRascunho: string;
  limparRascunho: boolean; // a decisão foi salva: o rascunho guardado pode sair
  versao: string;
  impressao: string;
  podeAprovar: boolean;
  impedimentos: Link[]; // por que a aprovação sem ressalvas não está disponível, com o link do item
  ressalvas: { titulo: string; detalhe: string; href: string | null }[];
  pendencias: { id: string; titulo: string }[]; // para "Solicitar correções"
  cobertura: string[]; // frases curtas: o que foi coberto
};

const ROTULOS = {
  aprovada: "Aprovar entrega",
  aprovada_ressalvas: "Aprovar com ressalvas",
  correcoes: "Solicitar correções",
} as const;
type Decisao = keyof typeof ROTULOS;

// Registrar a decisão: escolhe, justifica, REVISA o que será gravado e só então confirma.
// O rascunho (decisão, justificativa e nome) fica guardado neste navegador para não se perder se der erro.
export default function FormDecisao(p: PropsDecisao) {
  const [decisao, setDecisao] = useState<Decisao | "">("");
  const [justificativa, setJustificativa] = useState("");
  const [autor, setAutor] = useState("");
  const [relacionadas, setRelacionadas] = useState<Set<string>>(() => new Set(p.pendencias.map((x) => x.id)));
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [token, setToken] = useState("");
  const [erroLocal, setErroLocal] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setToken(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    try {
      if (p.limparRascunho) sessionStorage.removeItem(p.chaveRascunho);
      else {
        const r = JSON.parse(sessionStorage.getItem(p.chaveRascunho) ?? "null");
        if (r) {
          if (r.decisao in ROTULOS) setDecisao(r.decisao);
          setJustificativa(String(r.justificativa ?? ""));
          setAutor(String(r.autor ?? ""));
        }
      }
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (decisao || justificativa || autor) sessionStorage.setItem(p.chaveRascunho, JSON.stringify({ decisao, justificativa, autor }));
    } catch {}
  }, [decisao, justificativa, autor, p.chaveRascunho]);

  const precisaJust = decisao === "aprovada_ressalvas" || decisao === "correcoes";

  function revisar() {
    if (!decisao) return setErroLocal("Escolha uma decisão.");
    if (!autor.trim()) return setErroLocal("Escreva o seu nome: ele fica registrado na decisão.");
    if (precisaJust && justificativa.trim().length < 5) return setErroLocal("Escreva a justificativa (pelo menos 5 letras).");
    if (decisao === "aprovada" && !p.podeAprovar) return setErroLocal("A entrega não pode ser aprovada sem ressalvas. Veja o que falta abaixo.");
    if (decisao === "aprovada_ressalvas" && p.ressalvas.length === 0) return setErroLocal("Não há ressalvas a registrar. Use “Aprovar entrega”.");
    setErroLocal("");
    setRevisando(true);
  }

  const opcao = (v: Decisao, desc: string, desabilitada = false) => (
    <label key={v} className={`flex min-h-11 items-start gap-3 rounded-md border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${desabilitada ? "border-slate-200 bg-slate-50 text-slate-600" : decisao === v ? "border-indigo-600 bg-indigo-50" : "cursor-pointer border-slate-300 bg-white"}`}>
      <input type="radio" name="decisao" value={v} disabled={desabilitada} checked={decisao === v} onChange={() => { setDecisao(v); setErroLocal(""); }} className="mt-1 h-5 w-5" />
      <span><strong>{ROTULOS[v]}</strong>{desabilitada && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">Indisponível</span>}<span className="block text-slate-700">{desc}</span></span>
    </label>
  );

  return (
    <form action={p.acao} onSubmit={() => setEnviando(true)} className="mt-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="impressao" value={p.impressao} />
      <div hidden={revisando}>
        <fieldset>
          <legend className="text-sm font-semibold">Qual é a decisão?</legend>
          <div className="mt-2 grid gap-2">
            {opcao("aprovada", "Todos os testes foram enviados, sem falhas ou bloqueios em aberto.", !p.podeAprovar)}
            {opcao("aprovada_ressalvas", "Há desvios conhecidos que você aceita. Eles ficam registrados na decisão.")}
            {opcao("correcoes", "A entrega ainda precisa de ajustes. A rodada continua aberta para pendências e retestes.")}
          </div>
        </fieldset>
        {!p.podeAprovar && (
          <div role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">Por que “Aprovar entrega” está indisponível:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">{p.impedimentos.map((i, k) => <li key={k}>{i.texto} {i.href && <a href={i.href} className="font-medium underline">Ir ao item</a>}</li>)}</ul>
          </div>
        )}
        <label className="mt-4 block text-sm font-medium">Seu nome (responsável pelo aceite) <span className="font-normal text-slate-600">(obrigatório)</span>
          <input name="autor" value={autor} onChange={(e) => setAutor(e.target.value)} maxLength={120} className={campo + " min-h-11"} />
        </label>
        <label className="mt-3 block text-sm font-medium">Justificativa {precisaJust ? <span className="font-normal text-slate-600">(obrigatória)</span> : <span className="font-normal text-slate-600">(opcional)</span>}
          <textarea name="justificativa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} maxLength={3000} className={campo + " field-sizing-content"} />
        </label>
        {decisao === "correcoes" && p.pendencias.length > 0 && (
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Pendências relacionadas a esta decisão</legend>
            <ul className="mt-1 space-y-1">
              {p.pendencias.map((x) => (
                <li key={x.id}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="pendencia" value={x.id} checked={relacionadas.has(x.id)} onChange={(e) => setRelacionadas((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} className="h-5 w-5" />{x.titulo}</label></li>
              ))}
            </ul>
          </fieldset>
        )}
        {erroLocal && <p role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{erroLocal}</p>}
        <button type="button" onClick={revisar} className={`${btn} mt-4 min-h-11 ${FOCO}`}>Revisar decisão</button>
      </div>

      {revisando && decisao && (
        <section aria-labelledby="t-rev" className="rounded-lg border-2 border-indigo-400 bg-indigo-50 p-4 text-sm text-indigo-950">
          <h3 id="t-rev" className="text-base font-semibold">Confirme o que será registrado</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">Decisão</dt><dd><strong>{ROTULOS[decisao]}</strong></dd>
            <dt className="font-medium">Versão</dt><dd>{p.versao}</dd>
            <dt className="font-medium">Responsável</dt><dd>{autor}</dd>
            <dt className="font-medium">Cobertura</dt><dd>{p.cobertura.join(" · ")}</dd>
            {justificativa.trim() && (<><dt className="font-medium">Justificativa</dt><dd className="whitespace-pre-wrap">{justificativa}</dd></>)}
          </dl>
          {decisao === "aprovada_ressalvas" && (
            <div className="mt-3"><p className="font-semibold">Ressalvas que ficam registradas ({p.ressalvas.length}):</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{p.ressalvas.map((r, k) => <li key={k}><strong>{r.titulo}</strong>. {r.detalhe}</li>)}</ul></div>
          )}
          {decisao === "correcoes" && <p className="mt-3">{relacionadas.size} {relacionadas.size === 1 ? "pendência relacionada" : "pendências relacionadas"}. A rodada continua aberta para correções e retestes.</p>}
          {decisao !== "correcoes" && <p className="mt-3 font-medium">Depois de aprovar, as respostas ficam bloqueadas até alguém reabrir a rodada.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={enviando || !token} className={`${btn} min-h-11 disabled:opacity-60 ${FOCO}`}>{enviando ? "Registrando…" : "Confirmar decisão"}</button>
            <button type="button" disabled={enviando} onClick={() => setRevisando(false)} className={`${btn2} min-h-11 ${FOCO}`}>Voltar e editar</button>
          </div>
        </section>
      )}
    </form>
  );
}

// Reabrir uma rodada aprovada: motivo obrigatório. O aceite anterior continua no histórico.
export function FormReabrir({ acao, chaveRascunho, limpar }: { acao: (f: FormData) => void; chaveRascunho: string; limpar: boolean }) {
  const [token, setToken] = useState("");
  const [motivo, setMotivo] = useState("");
  const [autor, setAutor] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setToken(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    try {
      if (limpar) sessionStorage.removeItem(chaveRascunho);
      else {
        const r = JSON.parse(sessionStorage.getItem(chaveRascunho) ?? "null");
        if (r) {
          setMotivo(String(r.motivo ?? ""));
          setAutor(String(r.autor ?? ""));
        }
      }
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (motivo || autor) sessionStorage.setItem(chaveRascunho, JSON.stringify({ motivo, autor }));
    } catch {}
  }, [motivo, autor, chaveRascunho]);
  return (
    <form action={acao} onSubmit={(e) => { if (!confirm("Reabrir esta rodada? As respostas voltam a poder mudar e será preciso uma nova decisão. O aceite anterior continua no histórico.")) e.preventDefault(); else setEnviando(true); }} className="mt-3">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-medium">Seu nome <span className="font-normal text-slate-600">(obrigatório)</span>
        <input name="autor" required value={autor} onChange={(e) => setAutor(e.target.value)} maxLength={120} className={campo + " min-h-11"} />
      </label>
      <label className="mt-3 block text-sm font-medium">Motivo da reabertura <span className="font-normal text-slate-600">(obrigatório)</span>
        <textarea name="motivo" required minLength={5} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={3000} className={campo + " field-sizing-content"} />
      </label>
      <button disabled={enviando || !token} className={`${btn2} mt-3 min-h-11 disabled:opacity-60 ${FOCO}`}>{enviando ? "Reabrindo…" : "Reabrir rodada"}</button>
    </form>
  );
}
