"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Imagem from "@/components/Imagem";
import LinkTela from "@/components/LinkTela";
import { acessoDaTela } from "@/lib/acesso";
import { estadoPasso, passoCompleto, ROTULO_PASSO, RESULTADOS_PASSO, type EstadoPasso } from "@/lib/passos";
import { ROTULO_SEVERIDADE, SEVERIDADES, type Item, type Modulo, type Passo, type RespPasso, type ResultadoPasso, type Severidade, type Tela } from "@/lib/tipos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const MAX_PRINTS = 10;
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

// Um passo na fila do teste, já com o lugar onde ele está (módulo, tela, funcionalidade)
export type PassoFila = {
  passo: Passo;
  indice: number; // 1, 2, 3... dentro da funcionalidade
  total: number; // passos da funcionalidade
  item: Item;
  tela: Tela;
  numeroTela: string;
  modulo: Modulo;
  numeroModulo: string;
  perfil?: string; // perfil de acesso que executa este passo (cenários de rodada)
  perfilAnterior?: string | null; // perfil do passo anterior, para avisar a troca
  paiTitulo?: string | null; // quando a tela é um pop-up: a tela em que ele abre
};

export const idPasso = (id: string) => `p:${id}`;

export const ROTULO_ESTADO: Record<EstadoPasso, string> = {
  sem_resposta: "Sem resposta",
  funcionou: "Funcionou",
  diferente: "Deu diferente",
  bloqueado: "Não consegui testar",
  falta_texto: "Falta explicar",
};
export const COR_ESTADO: Record<EstadoPasso, string> = {
  sem_resposta: "bg-white text-slate-800 ring-slate-400",
  funcionou: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  diferente: "bg-rose-100 text-rose-900 ring-rose-300",
  bloqueado: "bg-amber-100 text-amber-950 ring-amber-400",
  falta_texto: "bg-amber-50 text-amber-950 ring-amber-400",
};

function Icone({ estado }: { estado: EstadoPasso }) {
  const p = { viewBox: "0 0 20 20", className: "h-4 w-4 shrink-0", "aria-hidden": true as const, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (estado === "funcionou") return <svg {...p}><path d="M4 10.5l4 4 8-9" /></svg>;
  if (estado === "diferente") return <svg {...p}><path d="M5 5l10 10M15 5L5 15" /></svg>;
  if (estado === "bloqueado") return <svg {...p}><circle cx="10" cy="10" r="7" /><path d="M5 15L15 5" /></svg>;
  if (estado === "falta_texto") return <svg {...p}><path d="M10 6v5M10 14.5v.5" /></svg>;
  return <svg {...p} strokeDasharray="2 3"><circle cx="10" cy="10" r="7" /></svg>;
}

export function ChipEstado({ estado }: { estado: EstadoPasso }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${COR_ESTADO[estado]}`}>
      <Icone estado={estado} />
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

const ATIVO: Record<ResultadoPasso, string> = {
  funcionou: "border-emerald-600 bg-emerald-50 text-emerald-950",
  diferente: "border-rose-600 bg-rose-50 text-rose-950",
  nao_consegui: "border-amber-600 bg-amber-50 text-amber-950",
};
const DICA: Record<ResultadoPasso, string> = {
  funcionou: "Aconteceu o que está em “O que deve acontecer”.",
  diferente: "Aconteceu outra coisa. Conte o que viu.",
  nao_consegui: "Não deu para fazer o passo. Diga o motivo.",
};

type Props = {
  atual: PassoFila;
  fila: PassoFila[];
  posicao: number; // lugar do passo atual na fila geral (0 = primeiro)
  resp: Record<string, RespPasso>;
  chave: string;
  slug: string;
  somenteLeitura: boolean;
  payloadUpload?: string; // texto enviado ao /api/upload para provar quem está anexando (padrão: caderno e chave)
  rotuloItem?: string; // como chamar a unidade do teste: "Funcionalidade" (padrão) ou "Cenário"
  semLinkTela?: boolean; // dentro de uma rodada a tela não é uma página navegável
  salvamento: { texto: string; tipo: "ok" | "salvando" | "erro" };
  aoMudar: (itemId: string, passoId: string, patch: Partial<RespPasso>) => void;
  aoIr: (id: string) => void;
  aoSair: () => void;
  gravidade?: Record<string, Severidade>; // gravidade da falha de cada funcionalidade (só no caderno; as rodadas não usam)
  aoGravidade?: (itemId: string, sev: Severidade) => void;
  erroGravidade?: string | null;
  ambienteUrl?: string | null; // endereço do ambiente de homologação do caderno (para telas que se abrem pelo menu)
  previa?: boolean; // prévia interna de quem prepara o teste: só leitura, nada é gravado
};

export default function Execucao({ atual, fila, posicao, resp, chave, slug, somenteLeitura, payloadUpload, rotuloItem = "Funcionalidade", semLinkTela, salvamento, aoMudar, aoIr, aoSair, gravidade, aoGravidade, erroGravidade, ambienteUrl, previa }: Props) {
  const { passo, item, tela, modulo } = atual;
  const r = resp[passo.id];
  const estado = estadoPasso(r);
  const [enviando, setEnviando] = useState(0);
  const [erroAnexo, setErroAnexo] = useState("");
  const [okAnexo, setOkAnexo] = useState("");
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const imagem = item.imagem ?? tela.imagem;
  const acesso = acessoDaTela(tela, ambienteUrl ?? null, atual.paiTitulo);

  // passos da mesma funcionalidade (para pular entre eles)
  const irmaos = fila.filter((f) => f.item.id === item.id);
  const anterior = posicao > 0 ? fila[posicao - 1] : null;
  const proximo = posicao < fila.length - 1 ? fila[posicao + 1] : null;
  const respondidos = fila.filter((f) => passoCompleto(resp[f.passo.id])).length;
  const precisaTexto = !!r && r.resultado !== "funcionou";
  const faltaTexto = precisaTexto && !r.obs.trim();

  async function anexar(files: File[]) {
    setErroAnexo("");
    setOkAnexo("");
    const jaTem = r?.anexos.length ?? 0;
    const novos: string[] = [];
    const avisos: string[] = [];
    setEnviando((n) => n + 1);
    for (const f of files) {
      if (jaTem + novos.length >= MAX_PRINTS) {
        avisos.push(`Limite de ${MAX_PRINTS} prints por passo. “${f.name}” não foi enviado.`);
        continue;
      }
      if (!TIPOS_IMAGEM.includes(f.type)) {
        avisos.push(`“${f.name}” não é aceito. Use uma imagem PNG, JPG ou WebP.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        avisos.push(`“${f.name}” passou de 5 MB. Reduza o tamanho e tente de novo.`);
        continue;
      }
      try {
        const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload", clientPayload: payloadUpload ?? JSON.stringify({ caderno: slug, chave }) });
        novos.push(b.url);
      } catch {
        avisos.push(`Não conseguimos enviar “${f.name}”. Confira sua internet e tente de novo. Se continuar, avise quem preparou o caderno.`);
      }
    }
    setEnviando((n) => Math.max(0, n - 1));
    if (avisos.length) setErroAnexo(avisos.join(" "));
    if (novos.length) {
      aoMudar(item.id, passo.id, { anexos: [...(r?.anexos ?? []), ...novos].slice(0, MAX_PRINTS) });
      setOkAnexo(novos.length === 1 ? "1 print anexado" : `${novos.length} prints anexados`);
    }
  }

  const aoColar = (e: React.ClipboardEvent) => {
    const imagens = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (!imagens.length || somenteLeitura) return;
    e.preventDefault();
    void anexar(imagens);
  };

  const miniaturas = (r?.anexos.length ?? 0) > 0 && (
    <ul className="mt-3 flex flex-wrap gap-4">
      {r!.anexos.map((u, k) => (
        <li key={u} className="relative">
          <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Print ${k + 1} deste passo`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" loading="lazy" decoding="async" />
          </a>
          {!somenteLeitura && (
            <button type="button" aria-label={`Remover print ${k + 1}`} onClick={() => aoMudar(item.id, passo.id, { anexos: r!.anexos.filter((x) => x !== u) })} className={`absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full ${FOCO}`}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm text-white">×</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      {/* onde estou: módulo, tela, funcionalidade */}
      <nav aria-label="Onde você está" className="text-sm text-slate-700">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>Módulo {atual.numeroModulo} · {modulo.titulo}</li>
          <li aria-hidden="true">›</li>
          <li>
            {semLinkTela ? <span>Tela · {tela.titulo}</span> : (
              <LinkTela id={tela.id} aoIr={aoIr} className={`rounded underline ${FOCO}`}>
                Tela {atual.numeroTela} · {tela.titulo}
              </LinkTela>
            )}
          </li>
        </ol>
      </nav>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h2 id="titulo-tela" tabIndex={-1} className="min-w-0 flex-1 break-words text-balance text-2xl font-semibold focus:outline-none">
          <span className="block text-sm font-medium text-slate-700">{rotuloItem}</span>
          <span className="whitespace-pre-wrap">{item.nome}</span>
        </h2>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">Passo {atual.indice} de {atual.total}</p>
          <p className="text-xs tabular-nums text-slate-700">{respondidos} de {fila.length} passos respondidos no caderno</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Passos respondidos no caderno" aria-valuemin={0} aria-valuemax={fila.length} aria-valuenow={respondidos}>
        <div className="h-full bg-indigo-600 transition-[width] motion-reduce:transition-none" style={{ width: `${fila.length ? (respondidos / fila.length) * 100 : 0}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {acesso.tipo === "link" && (
          <>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300">Tela programada: teste de verdade</span>
            <a href={acesso.url} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
              Abrir a tela para testar<span className="sr-only"> (abre em nova aba)</span>
            </a>
          </>
        )}
        {acesso.tipo === "menu" && (
          <>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300">Teste de verdade: abra pelo menu</span>
            {acesso.url && (
              <a href={acesso.url} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
                Abrir o ambiente de teste<span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
            <p className="basis-full text-sm text-slate-800"><span className="font-semibold">Caminho no menu:</span> {acesso.caminho}</p>
          </>
        )}
        {acesso.tipo === "desenho" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-inset ring-slate-300">Só desenho: confira pela imagem, não há tela para abrir</span>}
        {acesso.tipo === "pop-up" && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-950 ring-1 ring-inset ring-violet-300">Pop-up de “{atual.paiTitulo}”: abre dentro dessa tela, como o passo explica</span>}
        {acesso.tipo === "incompleto" && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-inset ring-amber-400">Quem preparou ainda não explicou como abrir esta tela. Avise a equipe.</span>}
        {tela.pdf && (
          <a href={tela.pdf} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
            Ver PDF das funcionalidades<span className="sr-only"> (abre em nova aba)</span>
          </a>
        )}
      </div>

      {/* passos desta funcionalidade */}
      <ol aria-label="Passos desta funcionalidade" className="mt-4 flex flex-wrap gap-2">
        {irmaos.map((s) => {
          const e = estadoPasso(resp[s.passo.id]);
          const aqui = s.passo.id === passo.id;
          return (
            <li key={s.passo.id}>
              <LinkTela
                id={idPasso(s.passo.id)}
                aoIr={aoIr}
                ariaCurrent={aqui}
                ariaLabel={`Passo ${s.indice}: ${ROTULO_ESTADO[e]}`}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-3 text-sm font-semibold tabular-nums ${FOCO} ${aqui ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-400 bg-white hover:bg-slate-50"}`}
              >
                {s.indice}
                {!aqui && <Icone estado={e} />}
              </LinkTela>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* instrução e resultado esperado, com a imagem por perto */}
        <div className="space-y-4">
          {atual.perfil && (
            <section aria-label="Perfil de acesso" className="rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm text-violet-950">
              <p><strong>Perfil de acesso para este passo:</strong> {atual.perfil}</p>
              {atual.perfilAnterior && atual.perfilAnterior !== atual.perfil && <p className="mt-1 font-semibold">Troque de perfil: no passo anterior era {atual.perfilAnterior}. Entre no sistema de teste com a conta ou função {atual.perfil}.</p>}
              <p className="mt-1 text-xs">Perfil é a conta ou função usada no sistema em teste. Se não tiver a conta, avise quem preparou a rodada. Nunca escreva senhas aqui.</p>
            </section>
          )}
          <section aria-labelledby="t-fazer" className="rounded-lg border border-slate-300 bg-white p-4">
            <h3 id="t-fazer" className="text-sm font-semibold uppercase tracking-wide text-indigo-900">O que fazer</h3>
            <p className="mt-2 whitespace-pre-wrap text-base">{passo.fazer}</p>
          </section>
          <section aria-labelledby="t-esperado" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <h3 id="t-esperado" className="text-sm font-semibold uppercase tracking-wide text-emerald-900">O que deve acontecer</h3>
            <p className="mt-2 whitespace-pre-wrap text-base text-emerald-950">{passo.esperado}</p>
          </section>
          {imagem && (
            <figure>
              <Imagem src={imagem} alt={`Imagem de referência: ${item.imagem ? `funcionalidade “${item.nome}”` : `tela “${tela.titulo}”`}`} className="max-h-96 w-full rounded-lg border border-slate-200 object-contain" />
              <figcaption className="mt-1 text-xs text-slate-700">Imagem de referência. Clique para ampliar.</figcaption>
            </figure>
          )}
          {item.faz && (
            <details className="rounded-md border border-slate-200 bg-white">
              <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Para que serve esta funcionalidade</summary>
              <p className="whitespace-pre-wrap border-t border-slate-100 px-3 py-2 text-sm text-slate-800">{item.faz}</p>
            </details>
          )}
        </div>

        {/* a resposta */}
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Sua resposta</h3>
            <div role="status"><ChipEstado estado={estado} /></div>
          </div>

          {previa ? (
            <div className="mt-3 text-sm">
              <p className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900">Prévia interna: é aqui que o validador responde. Nada digitado ou escolhido é gravado.</p>
              <ul className="mt-3 space-y-2" aria-label="Opções de resposta do validador">
                {RESULTADOS_PASSO.map((v) => (
                  <li key={v} className="flex items-start gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 opacity-80">
                    <span className="mt-0.5 text-slate-800"><Icone estado={v === "funcionou" ? "funcionou" : v === "diferente" ? "diferente" : "bloqueado"} /></span>
                    <span>
                      <span className="block text-sm font-semibold">{ROTULO_PASSO[v]}</span>
                      <span className="block text-xs text-slate-700">{DICA[v]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-700">Quem testa também escreve o que aconteceu, anexa prints como evidência e informa a gravidade quando algo deu diferente.</p>
            </div>
          ) : somenteLeitura ? (
            <div className="mt-3 text-sm">
              <p><span className="font-semibold">Resultado:</span> {r ? ROTULO_PASSO[r.resultado] : "Sem resposta"}</p>
              {r?.obs && <p className="mt-1 whitespace-pre-wrap"><span className="font-semibold">Texto:</span> {r.obs}</p>}
              {miniaturas}
              <p className="mt-3 text-slate-700">A homologação foi concluída: você pode ver as respostas, mas não mudar.</p>
            </div>
          ) : (
            <>
              <fieldset className="mt-3">
                <legend className="sr-only">Resultado do passo {atual.indice}</legend>
                <div className="grid gap-2">
                  {RESULTADOS_PASSO.map((v) => (
                    <label
                      key={v}
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${r?.resultado === v ? ATIVO[v] : "border-slate-400 bg-white hover:bg-slate-50"}`}
                    >
                      <input type="radio" name={`res-${passo.id}`} className="sr-only" checked={r?.resultado === v} onChange={() => { aoMudar(item.id, passo.id, { resultado: v }); setOkAnexo(""); }} />
                      <span className="mt-0.5 text-slate-800"><Icone estado={v === "funcionou" ? "funcionou" : v === "diferente" ? "diferente" : "bloqueado"} /></span>
                      <span>
                        <span className="block text-sm font-semibold">{ROTULO_PASSO[v]}</span>
                        <span className="block text-xs text-slate-700">{DICA[v]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {r && (
                <div className="mt-4">
                  <label htmlFor={`obs-${passo.id}`} className="text-sm font-semibold">
                    {r.resultado === "funcionou" ? "Comentário (opcional)" : r.resultado === "diferente" ? "O que aconteceu? (obrigatório)" : "Por que não conseguiu testar? (obrigatório)"}
                  </label>
                  <textarea
                    id={`obs-${passo.id}`}
                    ref={campoTexto}
                    rows={3}
                    maxLength={5000}
                    value={r.obs}
                    aria-invalid={faltaTexto || undefined}
                    aria-describedby={`ajuda-${passo.id}`}
                    onChange={(e) => aoMudar(item.id, passo.id, { obs: e.target.value })}
                    onPaste={r.resultado !== "funcionou" ? aoColar : undefined}
                    placeholder={r.resultado === "diferente" ? "Ex.: ao clicar em Salvar apareceu um erro vermelho e o cadastro não foi criado" : r.resultado === "nao_consegui" ? "Ex.: o botão Novo cadastro não aparece para o meu usuário" : "Ex.: tudo certo, só achei o texto do botão pequeno"}
                    className="field-sizing-content mt-2 min-h-24 w-full resize-y rounded-md border border-slate-500 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                  />
                  <div id={`ajuda-${passo.id}`} className="mt-1 text-sm">
                    {faltaTexto && <p className="text-rose-800">{r.resultado === "diferente" ? "Descreva o que aconteceu para a equipe conseguir corrigir. Enquanto estiver vazio, o passo não conta como respondido." : "Escreva o motivo. Enquanto estiver vazio, o passo não conta como respondido."}</p>}
                  </div>

                  {r.resultado !== "funcionou" && (
                    <div className="mt-3">
                      {r.anexos.length < MAX_PRINTS ? (
                        <div>
                          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-medium hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600">
                            Anexar print
                            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) void anexar(Array.from(e.target.files)); e.target.value = ""; }} />
                          </label>
                          <span role="status" className="ml-2 text-sm text-slate-700">{enviando > 0 ? "Enviando…" : okAnexo}</span>
                          <p className="mt-1 text-xs text-slate-700">Dica: copie a imagem e cole no campo de texto acima (Ctrl+V ou Cmd+V).</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700">Limite de {MAX_PRINTS} prints neste passo. Remova um para anexar outro.</p>
                      )}
                      <div role="alert">{erroAnexo && <p className="mt-1 text-sm text-rose-800">{erroAnexo}</p>}</div>
                      {miniaturas}
                    </div>
                  )}

                  {r.resultado === "diferente" && aoGravidade && (
                    <fieldset className="mt-5 rounded-md border border-rose-200 bg-rose-50/50 p-3">
                      <legend className="px-1 text-sm font-semibold">Quão grave é esta falha?</legend>
                      <p className="text-xs text-slate-700">Vale para a funcionalidade “{item.nome}” inteira. Sem escolher, conta como “Impede de usar” e a homologação não pode ser concluída.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {SEVERIDADES.map((sv) => (
                          <label
                            key={sv}
                            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 ${
                              gravidade?.[item.id] === sv ? "border-rose-600 bg-rose-50 text-rose-950" : "border-slate-400 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <input type="radio" name={`grav-${item.id}`} className="sr-only" checked={gravidade?.[item.id] === sv} onChange={() => aoGravidade(item.id, sv)} />
                            {ROTULO_SEVERIDADE[sv]}
                          </label>
                        ))}
                      </div>
                      <p role="status" className="mt-2 text-sm text-slate-800">
                        {erroGravidade ? <span className="font-semibold text-rose-800">{erroGravidade}</span> : gravidade?.[item.id] ? `Gravidade escolhida: ${ROTULO_SEVERIDADE[gravidade[item.id]]}.` : "Gravidade ainda não informada."}
                      </p>
                    </fieldset>
                  )}
                </div>
              )}
              {!r && <p className="mt-3 text-sm text-slate-700">Faça o passo e escolha o que aconteceu. Se ainda não deu para fazer, escolha “Não consegui testar”.</p>}
            </>
          )}
        </div>
      </div>

      <p role="status" className={`mt-6 text-sm ${salvamento.tipo === "erro" ? "font-semibold text-rose-800" : "text-slate-700"}`}>{salvamento.texto}</p>

      <nav aria-label="Passo anterior e próximo" className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        {anterior ? (
          <LinkTela id={idPasso(anterior.passo.id)} aoIr={aoIr} className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
            <span aria-hidden="true">← </span>Passo anterior
          </LinkTela>
        ) : <span />}
        {!previa && <button type="button" onClick={aoSair} className={`min-h-11 rounded-md px-3 text-sm font-medium text-indigo-800 underline ${FOCO}`}>Sair do teste (o que você fez fica salvo)</button>}
        {proximo ? (
          <LinkTela id={idPasso(proximo.passo.id)} aoIr={aoIr} className={`inline-flex min-h-11 items-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
            {proximo.item.id === item.id ? "Próximo passo" : `Próximo ${rotuloItem.toLowerCase()}`}<span aria-hidden="true"> →</span>
          </LinkTela>
        ) : previa ? <span /> : (
          <button type="button" onClick={aoSair} className={`min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>Terminar e ver o resumo</button>
        )}
      </nav>
    </div>
  );
}
