"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import { botao, botaoIcone, btn2, campo, FOCO } from "@/components/estilos";

// k só serve para o React não misturar os passos ao mexer na lista. "aberto" é só da tela (modo recolhível) e nunca vai para o banco.
export type PassoEditavel = { id?: string; fazer: string; esperado: string; k: number; aberto?: boolean };
let proxK = 1000000;
export const novoPassoEditavel = <P extends Partial<PassoEditavel>>(p?: P): PassoEditavel & P => ({ fazer: "", esperado: "", ...p, k: proxK++ }) as PassoEditavel & P;

export type ErrosPasso = Record<number, { fazer?: string; esperado?: string }>;

// Lista de passos (O que fazer / O que deve acontecer) com adicionar, remover e reordenar.
// Usado no roteiro de uma funcionalidade e nos cenários da biblioteca. "extra" põe campos a mais em cada passo (tela, perfil).
// recolhiveis: cada passo mostra número e resumo e abre para editar (editor de tela). Sem isso, todos aparecem abertos (biblioteca).
export default function EditorPassos<P extends PassoEditavel>({ passos, aoMudar, novo, extra, cabecalho, recolhiveis, prefixo = "passo", erros = {} }: {
  passos: P[];
  aoMudar: (lista: P[]) => void;
  novo: () => P;
  extra?: (p: P, mudar: (patch: Partial<P>) => void) => ReactNode;
  cabecalho?: (p: P, n: number) => ReactNode; // texto ao lado do "Passo N"
  recolhiveis?: boolean;
  prefixo?: string; // identifica os campos na página (o editor usa para levar o foco ao passo com problema)
  erros?: ErrosPasso;
}) {
  const mudar = (k: number, patch: Partial<P>) => aoMudar(passos.map((s) => (s.k === k ? { ...s, ...patch } : s)));
  const mover = (de: number, dir: -1 | 1) => {
    const para = de + dir;
    if (para < 0 || para >= passos.length) return;
    const l = [...passos];
    [l[de], l[para]] = [l[para], l[de]];
    aoMudar(l);
  };

  if (recolhiveis) {
    return (
      <>
        <ol className="mt-3 space-y-2">
          {passos.map((p, n) => {
            const e = erros[p.k] ?? {};
            const aberto = !!p.aberto || !!e.fazer || !!e.esperado;
            const resumo = p.fazer.trim() || "Sem texto ainda";
            return (
              <li key={p.k} className={`rounded-md border bg-white ${e.fazer || e.esperado ? "border-rose-400" : "border-slate-200"}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    aria-expanded={aberto}
                    aria-controls={`${prefixo}-${p.k}-corpo`}
                    onClick={() => mudar(p.k, { aberto: !aberto } as Partial<P>)}
                    className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-sm sm:min-h-9 ${FOCO}`}
                  >
                    <ChevronRight aria-hidden="true" className={`size-4 shrink-0 text-slate-600 transition-transform motion-reduce:transition-none ${aberto ? "rotate-90" : ""}`} />
                    <span className="shrink-0 font-semibold">Passo {n + 1}</span>
                    {cabecalho?.(p, n)}
                    {!aberto && <span className="truncate text-slate-700">{resumo}</span>}
                  </button>
                  <button type="button" disabled={n === 0} onClick={() => mover(n, -1)} aria-label={`Mover o passo ${n + 1} para cima`} title="Mover para cima" className={botaoIcone("secundario")}>
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button type="button" disabled={n === passos.length - 1} onClick={() => mover(n, 1)} aria-label={`Mover o passo ${n + 1} para baixo`} title="Mover para baixo" className={botaoIcone("secundario")}>
                    <ArrowDown aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => aoMudar(passos.filter((s) => s.k !== p.k))} aria-label={`Remover o passo ${n + 1}`} title="Remover o passo" className={botaoIcone("destrutivo")}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
                <div id={`${prefixo}-${p.k}-corpo`} hidden={!aberto} className="border-t border-slate-200 px-3 py-3">
                  {extra?.(p, (patch) => mudar(p.k, patch))}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor={`${prefixo}-${p.k}-fazer`} className="block text-sm font-medium">O que fazer <span className="font-normal text-slate-600">(obrigatório)</span></label>
                      <p className="text-xs text-slate-700">A ação que quem testa executa.</p>
                      <textarea id={`${prefixo}-${p.k}-fazer`} rows={3} maxLength={2000} value={p.fazer} aria-invalid={e.fazer ? true : undefined} aria-describedby={e.fazer ? `${prefixo}-${p.k}-fazer-e` : undefined} onChange={(ev) => mudar(p.k, { fazer: ev.target.value } as Partial<P>)} placeholder="Ex.: Selecione um período com pedidos e clique em Aplicar filtros" className={`${campo} field-sizing-content min-h-20 resize-y text-slate-900 ${e.fazer ? "border-rose-600" : ""}`} />
                      {e.fazer && <p id={`${prefixo}-${p.k}-fazer-e`} role="alert" className="mt-1 text-sm text-rose-800">{e.fazer}</p>}
                    </div>
                    <div>
                      <label htmlFor={`${prefixo}-${p.k}-esperado`} className="block text-sm font-medium">O que deve acontecer <span className="font-normal text-slate-600">(obrigatório)</span></label>
                      <p className="text-xs text-slate-700">O resultado que ela deve ver.</p>
                      <textarea id={`${prefixo}-${p.k}-esperado`} rows={3} maxLength={2000} value={p.esperado} aria-invalid={e.esperado ? true : undefined} aria-describedby={e.esperado ? `${prefixo}-${p.k}-esperado-e` : undefined} onChange={(ev) => mudar(p.k, { esperado: ev.target.value } as Partial<P>)} placeholder="Ex.: A lista mostra somente os pedidos do período escolhido" className={`${campo} field-sizing-content min-h-20 resize-y text-slate-900 ${e.esperado ? "border-rose-600" : ""}`} />
                      {e.esperado && <p id={`${prefixo}-${p.k}-esperado-e`} role="alert" className="mt-1 text-sm text-rose-800">{e.esperado}</p>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={() => aoMudar([...passos, { ...novo(), aberto: true }])} className={botao("secundario", "mt-3")}>
          <Plus aria-hidden="true" />
          Adicionar passo
        </button>
      </>
    );
  }

  return (
    <>
      <ol className="mt-3 space-y-3">
        {passos.map((p, n) => (
          <li key={p.k} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Passo {n + 1}{cabecalho?.(p, n)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={n === 0} onClick={() => mover(n, -1)} aria-label={`Subir o passo ${n + 1}`} className={btn2 + " min-h-11 px-3 disabled:opacity-30"}>↑</button>
                <button type="button" disabled={n === passos.length - 1} onClick={() => mover(n, 1)} aria-label={`Descer o passo ${n + 1}`} className={btn2 + " min-h-11 px-3 disabled:opacity-30"}>↓</button>
                <button type="button" onClick={() => aoMudar(passos.filter((s) => s.k !== p.k))} className="min-h-11 px-2 text-sm text-slate-600 underline">Remover<span className="sr-only"> o passo {n + 1}</span></button>
              </div>
            </div>
            {extra?.(p, (patch) => mudar(p.k, patch))}
            <label className="mt-2 block text-xs font-medium text-slate-600">
              O que fazer <span className="font-normal">(obrigatório)</span>
              <textarea required rows={2} maxLength={2000} value={p.fazer} onChange={(e) => mudar(p.k, { fazer: e.target.value } as Partial<P>)} placeholder="Ex.: Clique em Novo cadastro, preencha o nome e clique em Salvar" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
            </label>
            <label className="mt-2 block text-xs font-medium text-slate-600">
              O que deve acontecer <span className="font-normal">(obrigatório)</span>
              <textarea required rows={2} maxLength={2000} value={p.esperado} onChange={(e) => mudar(p.k, { esperado: e.target.value } as Partial<P>)} placeholder="Ex.: A tela volta para a lista e o novo cadastro aparece no topo" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
            </label>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => aoMudar([...passos, novo()])} className={btn2 + " mt-3 min-h-11"}>Adicionar passo</button>
    </>
  );
}
