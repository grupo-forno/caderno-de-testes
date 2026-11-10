import type { ReactNode } from "react";

// Grupo de campos ou de conteúdo por tarefa (por exemplo, "Dados básicos"), com título, texto curto e ações próprias.
export default function Secao({ id, titulo, opcional, descricao, acoes, children }: { id: string; titulo: string; opcional?: boolean; descricao?: ReactNode; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={id} className="font-semibold">
          {titulo} {opcional && <span className="text-sm font-normal text-slate-600">(opcional)</span>}
        </h2>
        {acoes}
      </div>
      {descricao && <p className="mb-3 mt-1 text-sm text-slate-700">{descricao}</p>}
      <div className={descricao ? "" : "mt-3"}>{children}</div>
    </section>
  );
}
