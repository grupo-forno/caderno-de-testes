"use client";

import { Fragment } from "react";
import LinkTela from "@/components/LinkTela";
import { COR_ICONE, IconeStatus } from "@/components/StatusBadge";
import { ROTULO_STATUS, type ResumoTela } from "@/lib/status";
import type { Modulo, Tela } from "@/lib/tipos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Props = {
  instancia: string; // o mesmo menu aparece duas vezes (lateral e painel do celular): os ids precisam ser diferentes
  modulos: Modulo[];
  principaisDoModulo: (id: string) => Tela[];
  filhosDe: (id: string) => Tela[];
  numeros: Record<string, string>;
  resumos: Record<string, ResumoTela>;
  resumosMod: Record<string, ResumoTela>;
  geral: ResumoTela;
  ativa: string;
  moduloAtivo: string | null;
  aoIr: (id: string) => void;
  abertos: Record<string, boolean>; // compartilhado entre as duas instâncias
  definirAberto: (id: string, aberto: boolean) => void;
};

function Contagem({ r }: { r: ResumoTela }) {
  if (r.status === "em_preparacao") return <>{ROTULO_STATUS[r.status]}</>;
  return (
    <span className="tabular-nums">
      {ROTULO_STATUS[r.status]} · {r.ok} de {r.total} OK
      {r.naoOk > 0 && <span className="font-semibold text-rose-800"> · {r.naoOk} NÃO OK</span>}
    </span>
  );
}

function LinhaTela({ t, nome, recuo, resumo, ativa, aoIr }: { t: Tela; nome: string; recuo: boolean; resumo: ResumoTela; ativa: boolean; aoIr: (id: string) => void }) {
  return (
    <li>
      <LinkTela
        id={t.id}
        aoIr={aoIr}
        ariaCurrent={ativa}
        className={`flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 py-2 pr-3 text-left text-sm ${FOCO} ${recuo ? "pl-9" : "pl-5"} ${
          ativa ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-950" : "border-transparent text-slate-800 hover:bg-slate-100"
        }`}
      >
        <span className={COR_ICONE[resumo.status]}>
          <IconeStatus status={resumo.status} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words">{nome}</span>
          <span className="block text-xs font-normal text-slate-700">
            <Contagem r={resumo} />
          </span>
        </span>
      </LinkTela>
    </li>
  );
}

export default function MenuTelas({ instancia, modulos, principaisDoModulo, filhosDe, numeros, resumos, resumosMod, geral, ativa, moduloAtivo, aoIr, abertos, definirAberto }: Props) {
  const estaAberto = (id: string) => abertos[id] ?? id === moduloAtivo;
  const pct = geral.total ? Math.round((geral.ok / geral.total) * 100) : 0;

  return (
    <div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {geral.total === 0 ? (
          <p className="text-sm font-semibold">Nenhuma funcionalidade pronta para testar ainda.</p>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums">
              {geral.ok} de {geral.total} funcionalidades OK
            </p>
            {geral.naoOk > 0 && <p className="text-xs font-semibold tabular-nums text-rose-800">{geral.naoOk} NÃO OK</p>}
            <div
              role="progressbar"
              aria-label="Funcionalidades aprovadas"
              aria-valuemin={0}
              aria-valuemax={geral.total}
              aria-valuenow={geral.ok}
              aria-valuetext={`${geral.ok} de ${geral.total} funcionalidades OK`}
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      <nav aria-label="Módulos e telas do sistema" className="mt-4">
        <ul className="space-y-2">
          {modulos.map((m) => {
            const rm = resumosMod[m.id];
            const aberto = estaAberto(m.id);
            const principais = principaisDoModulo(m.id);
            const ativoAqui = ativa === m.id;
            const idLista = `${instancia}-m-${m.id}`;
            return (
              <li key={m.id}>
                <div className="flex items-stretch gap-1">
                  <LinkTela
                    id={m.id}
                    aoIr={(id) => {
                      aoIr(id);
                      definirAberto(m.id, true);
                    }}
                    ariaCurrent={ativoAqui}
                    className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md border-l-4 py-2 pl-3 pr-2 text-left text-sm ${FOCO} ${
                      ativoAqui ? "border-indigo-600 bg-indigo-50 text-indigo-950" : "border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <span className={COR_ICONE[rm.status]}>
                      <IconeStatus status={rm.status} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold">{numeros[m.id]}. {m.titulo}</span>
                      <span className="block text-xs font-normal text-slate-700">
                        <Contagem r={rm} />
                      </span>
                    </span>
                  </LinkTela>
                  <button
                    type="button"
                    onClick={() => definirAberto(m.id, !aberto)}
                    aria-expanded={aberto}
                    aria-controls={idLista}
                    aria-label={`Telas de ${m.titulo}`}
                    className={`flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 ${FOCO}`}
                  >
                    <svg viewBox="0 0 20 20" className={`h-5 w-5 transition-transform motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                {/* sempre no DOM, para o aria-controls apontar para algo que existe */}
                <ul id={idLista} hidden={!aberto} className="mt-1 space-y-1">
                  {principais.length === 0 && <li className="py-1 pl-5 text-xs text-slate-700">Nenhuma tela cadastrada ainda.</li>}
                  {principais.map((t) => (
                    <Fragment key={t.id}>
                      <LinhaTela t={t} nome={`${numeros[t.id]} ${t.titulo}`} recuo={false} resumo={resumos[t.id]} ativa={ativa === t.id} aoIr={aoIr} />
                      {filhosDe(t.id).map((f) => (
                        <LinhaTela key={f.id} t={f} nome={`${numeros[f.id]} Pop-up: ${f.titulo}`} recuo resumo={resumos[f.id]} ativa={ativa === f.id} aoIr={aoIr} />
                      ))}
                    </Fragment>
                  ))}
                </ul>
              </li>
            );
          })}
          <li className="pt-1">
            <LinkTela
              id="resumo"
              aoIr={aoIr}
              ariaCurrent={ativa === "resumo"}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md border-l-4 px-3 py-2 text-left text-sm font-medium ${FOCO} ${
                ativa === "resumo" ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-950" : "border-transparent hover:bg-slate-100"
              }`}
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 3h10v14H5zM8 7h4M8 10h4M8 13h2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Resumo geral
            </LinkTela>
          </li>
        </ul>
      </nav>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800">
        <p className="mb-2 font-semibold">Como ler as cores</p>
        <ul className="space-y-1.5">
          {(["nao_iniciada", "em_andamento", "finalizada", "em_preparacao"] as const).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className={COR_ICONE[s]}>
                <IconeStatus status={s} className="h-4 w-4" />
              </span>
              {s === "nao_iniciada" && "Cinza: ainda não começou"}
              {s === "em_andamento" && "Amarelo: começou, falta algo ficar OK"}
              {s === "finalizada" && "Verde: tudo está OK"}
              {s === "em_preparacao" && "Tracejado quadrado: ainda em preparação"}
            </li>
          ))}
        </ul>
        <p className="mt-2 font-semibold text-rose-800">Vermelho: funcionalidade NÃO OK</p>
      </div>
    </div>
  );
}
