"use client";

import { useEffect, useRef, useState } from "react";
import type { Caderno as C, Resultado } from "@/lib/sample";

type Resp = { resultado: Resultado; obs: string };

const OPCOES: { v: Resultado; label: string; dica: string; cor: string }[] = [
  { v: "ok", label: "OK", dica: "Testei tudo e está aprovado.", cor: "emerald" },
  { v: "nao_ok", label: "NÃO OK", dica: "Testei tudo, mas algo não está certo. Conte o que mudar nas observações.", cor: "rose" },
  { v: "nao_testado", label: "NÃO TESTADO", dica: "Ainda não consegui testar.", cor: "slate" },
];

const CHIP: Record<Resultado, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  nao_ok: "bg-rose-100 text-rose-800",
  nao_testado: "bg-slate-200 text-slate-700",
};
const ATIVO: Record<string, string> = {
  emerald: "border-emerald-600 bg-emerald-50 text-emerald-900",
  rose: "border-rose-600 bg-rose-50 text-rose-900",
  slate: "border-slate-500 bg-slate-100 text-slate-900",
};

type Pessoa = { nome: string; email: string };

export default function Caderno({ caderno, slug }: { caderno: C; slug: string }) {
  const [resp, setResp] = useState<Record<string, Resp>>({});
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [final, setFinal] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function carregar(p: Pessoa) {
    try {
      const r = await fetch(`/api/respostas?caderno=${encodeURIComponent(slug)}&email=${encodeURIComponent(p.email)}`);
      if (!r.ok) throw new Error();
      setResp(await r.json());
      setErro(null);
    } catch {
      setErro("Não conseguimos carregar suas respostas salvas. Recarregue a página para tentar de novo.");
    }
  }

  useEffect(() => {
    let p: Pessoa | null = null;
    try {
      p = JSON.parse(localStorage.getItem("pessoa") ?? "null");
    } catch {}
    /* eslint-disable react-hooks/set-state-in-effect */
    setPessoa(p);
    setPronto(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (p) void carregar(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function entrar(p: Pessoa) {
    try {
      localStorage.setItem("pessoa", JSON.stringify(p));
    } catch {}
    setPessoa(p);
    void carregar(p);
  }

  async function gravar(id: string, r: Resp) {
    try {
      const x = await fetch("/api/respostas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caderno: slug, tela: id, ...pessoa, ...r }),
      });
      if (!x.ok) throw new Error();
      setErro(null);
      setSalvo(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setErro("Não conseguimos salvar agora. Sua resposta continua na tela; ela tenta de novo na próxima alteração.");
    }
  }

  function atualizar(id: string, p: Partial<Resp>) {
    const nova = { ...res(id), ...p };
    setResp({ ...resp, [id]: nova });
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => gravar(id, nova), 600);
  }

  const res = (id: string): Resp => resp[id] ?? { resultado: "nao_testado", obs: "" };
  const total = caderno.telas.length;
  const avaliadas = caderno.telas.filter((t) => res(t.id).resultado !== "nao_testado").length;
  const contagem = (r: Resultado) => caderno.telas.filter((t) => res(t.id).resultado === r).length;
  const semObs = caderno.telas.filter((t) => res(t.id).resultado === "nao_ok" && !res(t.id).obs.trim());

  function imprimir() {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    window.print();
  }

  if (!pronto) return null;
  if (!pessoa) return <Entrada titulo={caderno.titulo} onEntrar={entrar} />;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header>
        <p className="text-sm font-medium text-indigo-700">Rodada {caderno.rodada}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{caderno.titulo}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versão {caderno.versao} · {caderno.data} · Preparado por {caderno.preparadoPor}
        </p>
      </header>

      <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Ambiente de teste.</strong> Nada do que você fizer aqui afeta o sistema real.
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Como usar</h2>
        <p className="mt-1 text-sm text-slate-600">
          Abra cada tela, veja a imagem, leia o que ela faz e escolha um resultado:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {OPCOES.map((o) => (
            <li key={o.v} className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CHIP[o.v]}`}>{o.label}</span>
              <span className="text-slate-700">{o.dica}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-semibold">Antes de começar</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
          {caderno.antesDeComecar.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>

      <div className="sticky top-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur no-print">
        <p className="text-sm font-medium">{avaliadas} de {total} telas avaliadas</p>
        <p className="text-xs text-slate-500" aria-live="polite">{salvo ? `Salvo às ${salvo}` : "Salva sozinho"}</p>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}

      <div className="mt-4 space-y-3">
        {caderno.telas.map((t, i) => {
          const r = res(t.id);
          return (
            <details key={t.id} className="group rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">{i + 1}</span>
                <span className="flex-1 font-medium">{t.titulo}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CHIP[r.resultado]}`}>
                  {OPCOES.find((o) => o.v === r.resultado)!.label}
                </span>
              </summary>

              <div className="space-y-5 border-t border-slate-100 px-4 py-4 sm:px-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.imagem} alt={`Imagem da tela ${t.titulo}`} className="w-full rounded-md border border-slate-200" />

                <div className="flex flex-wrap gap-2 no-print">
                  {t.link && (
                    <a href={t.link} target="_blank" rel="noreferrer" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      Abrir a tela para testar
                    </a>
                  )}
                  {t.pdf && (
                    <a href={t.pdf} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                      Ver PDF das funcionalidades
                    </a>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold">O que cada item faz</h3>
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {t.itens.map((it) => (
                      <li key={it.nome} className="py-2">
                        <span className="font-medium">{it.nome}:</span> <span className="text-slate-700">{it.faz}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold">Resultado</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {OPCOES.map((o) => (
                      <label key={o.v} className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-semibold ${r.resultado === o.v ? ATIVO[o.cor] : "border-slate-300 hover:bg-slate-50"}`}>
                        <input type="radio" name={`r-${t.id}`} className="sr-only" checked={r.resultado === o.v} onChange={() => atualizar(t.id, { resultado: o.v })} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor={`o-${t.id}`} className="text-sm font-semibold">
                    Observações {r.resultado === "nao_ok" && <span className="font-normal text-rose-700">(conte o que precisa mudar)</span>}
                  </label>
                  <textarea
                    id={`o-${t.id}`}
                    rows={3}
                    value={r.obs}
                    onChange={(e) => atualizar(t.id, { obs: e.target.value })}
                    placeholder="Escreva aqui o que achou, dúvidas ou o que precisa mudar."
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Resultado final</h2>
        {!final ? (
          <>
            <p className="mt-1 text-sm text-slate-600">Quando terminar, clique em finalizar para ver o resumo.</p>
            <button onClick={() => setFinal(true)} className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 no-print">
              Finalizar
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm">
              <strong>{contagem("ok")}</strong> OK · <strong>{contagem("nao_ok")}</strong> NÃO OK · <strong>{contagem("nao_testado")}</strong> NÃO TESTADO
            </p>
            {semObs.length > 0 && (
              <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                Falta contar o que mudar em: {semObs.map((t) => t.titulo).join(", ")}. Abra a tela e escreva nas observações.
              </p>
            )}
            {contagem("nao_testado") > 0 && (
              <p className="mt-2 text-sm text-slate-600">Ainda há telas não testadas. Você pode voltar e continuar depois, usando este mesmo link.</p>
            )}
            <div className="mt-3 flex gap-2 no-print">
              <button onClick={imprimir} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                Imprimir ou salvar em PDF
              </button>
              <button onClick={() => setFinal(false)} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Voltar
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Entrada({ titulo, onEntrar }: { titulo: string; onEntrar: (p: Pessoa) => void }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const campo = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Para começar, diga quem é você. Assim suas respostas ficam salvas e você pode continuar depois, em qualquer aparelho, com o mesmo e-mail.
      </p>
      <form
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onEntrar({ nome: nome.trim(), email: email.trim().toLowerCase() });
        }}
      >
        <label className="block text-sm font-medium">
          Seu nome
          <input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={campo} />
        </label>
        <label className="block text-sm font-medium">
          Seu e-mail
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={campo} />
        </label>
        <button className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Começar</button>
      </form>
    </main>
  );
}
