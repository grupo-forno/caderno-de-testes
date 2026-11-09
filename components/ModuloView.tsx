"use client";

import LinkTela from "@/components/LinkTela";
import { ChipStatus } from "@/components/StatusBadge";
import { type ResumoTela } from "@/lib/status";
import type { Modulo, Tela } from "@/lib/tipos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

// Visão de um módulo: todas as telas dele e como está cada uma
export default function ModuloView({ modulo, numero, resumo, telas, resumos, aoIr }: {
  modulo: Modulo;
  numero: string;
  resumo: ResumoTela;
  telas: { tela: Tela; numero: string }[];
  resumos: Record<string, ResumoTela>;
  aoIr: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="titulo-tela" tabIndex={-1} className="min-w-0 flex-1 break-words text-balance text-2xl font-semibold focus:outline-none">
          <span className="mr-2 text-slate-600">{numero}</span>
          {modulo.titulo}
        </h2>
        <ChipStatus status={resumo.status} />
      </div>
      {resumo.total > 0 ? (
        <p className="mt-1 text-sm tabular-nums text-slate-700">
          {resumo.ok} de {resumo.total} funcionalidades OK
          {resumo.naoOk > 0 && <span className="font-semibold text-rose-800"> · {resumo.naoOk} NÃO OK</span>}
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-700">Este módulo ainda está sendo preparado.</p>
      )}

      <h3 className="mt-6 text-lg font-semibold">Telas deste módulo</h3>
      {telas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-700">Nenhuma tela cadastrada ainda. Volte mais tarde.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {telas.map(({ tela, numero: n }) => {
            const r = resumos[tela.id];
            return (
              <li key={tela.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${tela.paiId ? "pl-8 sm:pl-10" : ""}`}>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">
                  <span className="mr-1 text-slate-600">{n}</span>
                  {tela.paiId && "Pop-up: "}
                  {tela.titulo}
                </span>
                {r.status !== "em_preparacao" && (
                  <span className="text-xs tabular-nums text-slate-700">
                    {r.ok} de {r.total} OK
                    {r.naoOk > 0 && <span className="font-semibold text-rose-800"> · {r.naoOk} NÃO OK</span>}
                  </span>
                )}
                <ChipStatus status={r.status} />
                <LinkTela id={tela.id} aoIr={aoIr} ariaLabel={`Abrir ${tela.paiId ? "o pop-up" : "a tela"} ${tela.titulo}`} className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
                  Abrir
                </LinkTela>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
