"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { FOCO } from "@/components/estilos";

export type AbaDef = { id: string; rotulo: string; icone?: ReactNode; aviso?: string }; // aviso: texto curto de atenção (ex.: "2 pendências")

// Abas horizontais com ícone, texto e sublinhado na ativa. Setas, Home e End trocam de aba; só a ativa entra na ordem do Tab.
// Os painéis ficam sempre montados (use PainelAba): trocar de aba não perde o que foi preenchido.
export function Abas({ abas, ativa, aoMudar, rotulo }: { abas: AbaDef[]; ativa: string; aoMudar: (id: string) => void; rotulo: string }) {
  const lista = useRef<HTMLDivElement>(null);

  function aoTeclar(e: KeyboardEvent) {
    const i = abas.findIndex((a) => a.id === ativa);
    const ir = e.key === "ArrowRight" ? (i + 1) % abas.length : e.key === "ArrowLeft" ? (i - 1 + abas.length) % abas.length : e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : -1;
    if (ir < 0) return;
    e.preventDefault();
    aoMudar(abas[ir].id);
    lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[ir]?.focus();
  }

  return (
    <div ref={lista} role="tablist" aria-label={rotulo} onKeyDown={aoTeclar} className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {abas.map((a) => {
        const on = a.id === ativa;
        return (
          <button
            key={a.id}
            id={`aba-${a.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`painel-${a.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm sm:min-h-10 [&>svg]:size-4 ${FOCO} ${on ? "border-indigo-600 font-semibold text-indigo-900" : "border-transparent text-slate-700 hover:border-slate-300 hover:text-slate-900"}`}
          >
            {a.icone}
            {a.rotulo}
            {a.aviso && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-inset ring-amber-300">{a.aviso}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PainelAba({ id, ativa, children }: { id: string; ativa: string; children: ReactNode }) {
  return (
    <div id={`painel-${id}`} role="tabpanel" aria-labelledby={`aba-${id}`} hidden={ativa !== id} tabIndex={0} className={FOCO}>
      {children}
    </div>
  );
}
