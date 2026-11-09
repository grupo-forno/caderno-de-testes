"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import type { Caderno as C, Resultado, Tela } from "@/lib/tipos";

type Resp = { resultado: Resultado; obs: string; anexos: string[] };

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
  const [anterior, setAnterior] = useState<Record<string, Resp>>({});
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
      const d = await r.json();
      setResp(d.atual);
      setAnterior(d.anterior);
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

  const res = (id: string): Resp => (resp[id] ? { ...resp[id], anexos: resp[id].anexos ?? [] } : { resultado: "nao_testado", obs: "", anexos: [] });
  // Telas a testar nesta rodada (no topo) e telas já aprovadas antes (recolhidas, só para consulta)
  const ativas = caderno.telas.filter((t) => t.refazer);
  const total = ativas.length;
  const avaliadas = ativas.filter((t) => res(t.id).resultado !== "nao_testado").length;
  const contagem = (r: Resultado) => ativas.filter((t) => res(t.id).resultado === r).length;
  const semObs = ativas.filter((t) => res(t.id).resultado === "nao_ok" && !res(t.id).obs.trim());

  const [enviando, setEnviando] = useState<string | null>(null);
  const [erroAnexo, setErroAnexo] = useState<{ id: string; msg: string } | null>(null);

  async function anexar(id: string, files: FileList) {
    setErroAnexo(null);
    const novos: string[] = [];
    setEnviando(id);
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) {
        setErroAnexo({ id, msg: `“${f.name}” não foi enviado. Use uma imagem (PNG, JPG ou WebP) de até 5 MB.` });
        continue;
      }
      try {
        const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload", clientPayload: slug });
        novos.push(b.url);
      } catch {
        setErroAnexo({ id, msg: `Não conseguimos enviar “${f.name}”. Confira sua internet e tente de novo.` });
      }
    }
    setEnviando(null);
    if (novos.length) atualizar(id, { anexos: [...res(id).anexos, ...novos].slice(0, 10) });
  }

  // Telas principais e pop-ups. Cada pop-up aparece dentro do cartão da tela pai.
  const principais = caderno.telas.filter((t) => !t.paiId);
  const filhosDe = (id: string) => caderno.telas.filter((t) => t.paiId === id);
  const grupoAtivo = (t: Tela) => t.refazer || filhosDe(t.id).some((f) => f.refazer);
  const gruposAtivos = principais.filter(grupoAtivo);
  const aprovadasLinhas = principais.filter((t) => !grupoAtivo(t)).flatMap((t) => [t, ...filhosDe(t.id)]);
  const ordenadas = principais.flatMap((t) => [t, ...filhosDe(t.id)]); // para o resumo de impressão

  const blocoFilhos = (t: Tela, num: string): ReactNode => {
    const fs = filhosDe(t.id);
    if (!fs.length) return null;
    return (
      <div className="space-y-3 rounded-md border-l-4 border-indigo-300 bg-indigo-50/50 p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-indigo-900">Pop-ups e janelas desta tela ({fs.length})</h3>
        {fs.map((f, j) =>
          f.refazer ? (
            cartao(f, `${num}.${j + 1}`, t.titulo)
          ) : (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
              <span><span className="font-medium">{num}.{j + 1}</span> {f.titulo}</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">APROVADO</span>
            </div>
          ),
        )}
      </div>
    );
  };

  const cartao = (t: Tela, num: string, popupDe?: string): ReactNode => {
    const r = res(t.id);
    return (
      <details key={t.id} className={`group rounded-lg border bg-white ${popupDe ? "border-indigo-200" : "border-slate-200"}`}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5">
          <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-sm font-medium">{num}</span>
          <span className="flex-1 font-medium">
            {popupDe && <span className="mr-2 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800">Pop-up de “{popupDe}”</span>}
            {t.titulo}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${CHIP[r.resultado]}`}>
            {OPCOES.find((o) => o.v === r.resultado)!.label}
          </span>
        </summary>

        <div className="space-y-5 border-t border-slate-100 px-4 py-4 sm:px-5">
          {t.imagem && <Imagem src={t.imagem} alt={`Imagem ${popupDe ? "do pop-up" : "da tela"} ${t.titulo}`} className="w-full rounded-md border border-slate-200" />}

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
              {t.itens.map((it, k) => (
                <li key={k} className="py-2">
                  <span className="whitespace-pre-wrap font-medium">{it.nome}:</span> <span className="whitespace-pre-wrap text-slate-700">{it.faz}</span>
                  {it.imagem && <Imagem src={it.imagem} alt={`Imagem do item ${it.nome}`} className="mt-2 max-h-72 rounded-md border border-slate-200" />}
                </li>
              ))}
            </ul>
          </div>

          {anterior[t.id] && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium">Na rodada anterior você marcou {OPCOES.find((o) => o.v === anterior[t.id].resultado)?.label}.</p>
              {anterior[t.id].obs && <p className="mt-1 whitespace-pre-wrap text-slate-700">{anterior[t.id].obs}</p>}
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-semibold">Resultado{popupDe ? " deste pop-up" : ""}</legend>
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
            <div className="mt-3 no-print">
              <label className="inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
                Anexar print
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) void anexar(t.id, e.target.files); e.target.value = ""; }} />
              </label>
              {enviando === t.id && <span className="ml-2 text-sm text-slate-600">Enviando…</span>}
              {erroAnexo?.id === t.id && <p role="alert" className="mt-1 text-sm text-rose-700">{erroAnexo.msg}</p>}
              {r.anexos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {r.anexos.map((u) => (
                    <li key={u} className="relative">
                      <a href={u} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Print anexado" className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
                      </a>
                      <button type="button" aria-label="Remover print" onClick={() => atualizar(t.id, { anexos: r.anexos.filter((x) => x !== u) })} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {!popupDe && blocoFilhos(t, num)}
        </div>
      </details>
    );
  };

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
        <p className="mt-1 hidden text-sm print:block">Respondido por {pessoa.nome} ({pessoa.email}) em {new Date().toLocaleString("pt-BR")}</p>
      </header>

      {caderno.rodada > 1 && (
        <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 print:hidden">
          <strong>Rodada {caderno.rodada}.</strong> Teste só as telas abaixo, que precisam ser refeitas. As que já foram aprovadas ficam guardadas no final da página.
        </div>
      )}

      <div className="mt-5 rounded-lg border border-amber-300 print:hidden bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Ambiente de teste.</strong> Nada do que você fizer aqui afeta o sistema real.
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 print:hidden">
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
        {caderno.antesDeComecar.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Antes de começar</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              {caderno.antesDeComecar.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </>
        )}
      </section>

      <div className="sticky top-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur no-print">
        <p className="text-sm font-medium">{avaliadas} de {total} telas avaliadas</p>
        <p className="text-xs text-slate-500" aria-live="polite">{salvo ? `Salvo às ${salvo}` : "Salva sozinho"}</p>
      </div>
      {erro && <p role="alert" className="mt-3 rounded-md print:hidden bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}

      <div className="mt-4 space-y-3 print:hidden">
        {ativas.length === 0 && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Não há telas para testar nesta rodada. Tudo já foi aprovado.</p>}
        {gruposAtivos.map((t) => {
          const num = String(principais.indexOf(t) + 1);
          if (t.refazer) return cartao(t, num);
          // tela principal já aprovada, mas com pop-up para refazer: fica só como contexto
          return (
            <div key={t.id} className="rounded-lg border border-emerald-200 bg-white p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-sm font-medium">{num}</span>
                <span className="flex-1 font-medium">{t.titulo}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">APROVADA</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">Esta tela já foi aprovada. Só os pop-ups abaixo precisam ser refeitos.</p>
              <div className="mt-3">{blocoFilhos(t, num)}</div>
            </div>
          );
        })}
      </div>

      {aprovadasLinhas.length > 0 && (
        <details className="mt-6 rounded-lg border border-emerald-200 bg-white print:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-emerald-900 sm:px-5">
            Já aprovadas em rodadas anteriores ({aprovadasLinhas.length})
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {aprovadasLinhas.map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5 ${t.paiId ? "pl-8 sm:pl-10" : ""}`}>
                <span className="font-medium">{t.paiId && "↳ Pop-up: "}{t.titulo}</span>
                <span className="flex items-center gap-3">
                  {t.pdf && <a href={t.pdf} target="_blank" rel="noreferrer" className="text-indigo-700 underline">PDF</a>}
                  {t.link && <a href={t.link} target="_blank" rel="noreferrer" className="text-indigo-700 underline">Abrir tela</a>}
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">APROVADA</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

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
            <table className="mt-4 hidden w-full border-collapse text-sm print:table">
              <thead><tr className="border-b border-slate-400 text-left"><th className="py-1 pr-3">Tela</th><th className="py-1 pr-3">Resultado</th><th className="py-1">Observações</th></tr></thead>
              <tbody>
                {ordenadas.map((t) => (
                  <tr key={t.id} className="border-b border-slate-200 align-top">
                    <td className="py-1 pr-3 font-medium">{t.paiId && "↳ Pop-up: "}{t.titulo}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{t.refazer ? OPCOES.find((o) => o.v === res(t.id).resultado)!.label : "APROVADA ANTES"}</td>
                    <td className="py-1 whitespace-pre-wrap">{res(t.id).obs}{res(t.id).anexos.length > 0 && ` (${res(t.id).anexos.length} print${res(t.id).anexos.length > 1 ? "s" : ""} anexado${res(t.id).anexos.length > 1 ? "s" : ""})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-2 no-print">
              <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
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

function Imagem({ src, alt, className }: { src: string; alt: string; className: string }) {
  const janela = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => janela.current?.showModal()} aria-label="Ampliar imagem" className="block cursor-zoom-in text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      <dialog ref={janela} onClick={() => janela.current?.close()} className="m-auto max-h-[92vh] max-w-[92vw] rounded-lg p-2 backdrop:bg-black/70">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[88vh] max-w-full cursor-zoom-out" />
      </dialog>
    </>
  );
}
