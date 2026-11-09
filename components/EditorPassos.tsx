"use client";

import type { ReactNode } from "react";
import { btn2, campo } from "@/components/estilos";

export type PassoEditavel = { id?: string; fazer: string; esperado: string; k: number }; // k só serve para o React não misturar os passos ao mexer na lista
let proxK = 1000000;
export const novoPassoEditavel = <P extends Partial<PassoEditavel>>(p?: P): PassoEditavel & P => ({ fazer: "", esperado: "", ...p, k: proxK++ }) as PassoEditavel & P;

// Lista de passos (O que fazer / O que deve acontecer) com adicionar, remover e reordenar.
// Usado no roteiro de uma funcionalidade e nos cenários da biblioteca. "extra" põe campos a mais em cada passo (tela, perfil).
export default function EditorPassos<P extends PassoEditavel>({ passos, aoMudar, novo, extra, cabecalho }: {
  passos: P[];
  aoMudar: (lista: P[]) => void;
  novo: () => P;
  extra?: (p: P, mudar: (patch: Partial<P>) => void) => ReactNode;
  cabecalho?: (p: P, n: number) => ReactNode; // texto ao lado do "Passo N"
}) {
  const mudar = (k: number, patch: Partial<P>) => aoMudar(passos.map((s) => (s.k === k ? { ...s, ...patch } : s)));
  const mover = (de: number, dir: -1 | 1) => {
    const para = de + dir;
    if (para < 0 || para >= passos.length) return;
    const l = [...passos];
    [l[de], l[para]] = [l[para], l[de]];
    aoMudar(l);
  };

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
