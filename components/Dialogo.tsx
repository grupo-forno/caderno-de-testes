"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { botaoIcone } from "@/components/estilos";

// Diálogo modal nativo (<dialog>): o navegador prende o foco, fecha com Esc e devolve o foco a quem abriu.
// Clicar fora também fecha.
export default function Dialogo({ aberto, aoFechar, titulo, children, largo }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={aoFechar}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className={`m-auto max-h-[92vh] w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/60 ${largo ? "max-w-5xl" : "max-w-lg"}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <h2 id={idTitulo} className="min-w-0 truncate text-base font-semibold">{titulo}</h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" title="Fechar" className={botaoIcone("discreto")}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[calc(92vh-3.5rem)] overflow-auto overscroll-contain p-4">{aberto && children}</div>
    </dialog>
  );
}
