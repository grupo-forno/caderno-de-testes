"use client";

import { useId, useRef, useState } from "react";
import { btn, btn2, campo } from "@/components/estilos";
import { MODULOS_SUGERIDOS, semDuplicados } from "@/lib/listas";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const seta = `min-h-11 min-w-11 rounded border border-slate-400 bg-white px-2 text-sm hover:bg-slate-50 disabled:opacity-30 ${FOCO}`;

// Módulos montados aos poucos: nome + "Adicionar" (ou Enter), atalhos, lista com remover e reordenar, e "Colar lista" como opção.
// Nada é salvo aqui: a lista vai no formulário de quem usa, num campo escondido com um nome por linha.
export default function ListaModulos({ campo: nomeCampo, existentes = [] }: { campo: string; existentes?: string[] }) {
  const id = useId();
  const [nomes, setNomes] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [colado, setColado] = useState("");
  const [aviso, setAviso] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  function adicionar(novos: string[]) {
    const r = semDuplicados(novos, [...existentes, ...nomes]);
    if (r.novos.length) setNomes((n) => [...n, ...r.novos]);
    setAviso(
      r.ignorados.length
        ? `${r.ignorados.length === 1 ? "Este nome já existia e foi ignorado" : "Estes nomes já existiam e foram ignorados"}: ${r.ignorados.join(", ")}.`
        : r.novos.length ? `${r.novos.length === 1 ? "Módulo adicionado" : `${r.novos.length} módulos adicionados`}.` : "",
    );
    return r.novos.length;
  }
  function adicionarDigitado() {
    if (!texto.trim()) return setAviso("Escreva o nome do módulo antes de adicionar.");
    adicionar([texto]);
    setTexto("");
    entrada.current?.focus();
  }
  function mover(i: number, dir: -1 | 1) {
    setNomes((n) => {
      const c = [...n];
      [c[i], c[i + dir]] = [c[i + dir], c[i]];
      return c;
    });
  }
  const sugestoes = MODULOS_SUGERIDOS.filter((s) => !semDuplicados([s], [...existentes, ...nomes]).ignorados.length);
  // o que está digitado e ainda não foi adicionado também vai no envio, para nada se perder. Repetidos o servidor ignora e avisa.
  const aEnviar = [...nomes, texto].map((n) => n.trim()).filter(Boolean);

  return (
    <div>
      <input type="hidden" name={nomeCampo} value={aEnviar.join("\n")} />
      <label htmlFor={`${id}-nome`} className="block text-sm font-medium">Nome do módulo</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          id={`${id}-nome`}
          ref={entrada}
          value={texto}
          maxLength={120}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // Enter adiciona o módulo; não envia o formulário
              adicionarDigitado();
            }
          }}
          placeholder="Ex.: Financeiro"
          aria-describedby={`${id}-aviso`}
          className={campo + " mt-0 min-h-11 min-w-0 flex-1"}
        />
        <button type="button" onClick={adicionarDigitado} className={`${btn2} min-h-11 ${FOCO}`}>Adicionar</button>
      </div>
      <p id={`${id}-aviso`} role="status" className="mt-1 min-h-5 text-sm text-slate-800">{aviso}</p>

      {sugestoes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-slate-700">Atalhos: toque para adicionar</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => adicionar([s])} className={`min-h-11 rounded-full border border-slate-400 bg-white px-3 text-sm hover:bg-slate-50 ${FOCO}`}>+ {s}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-4 text-sm font-semibold">{nomes.length ? `Módulos que serão criados (${nomes.length})` : "Módulos que serão criados"}</h3>
      {nomes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-700">Nenhum ainda. Você pode criar o caderno sem módulos e adicioná-los depois.</p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {nomes.map((n, i) => (
            <li key={n} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
              <span className="w-6 text-sm text-slate-600">{i + 1}.</span>
              <span className="min-w-[9rem] flex-1 break-words text-sm font-medium">{n}</span>
              <div className="flex gap-2">
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${n}`} className={seta}>↑</button>
              <button type="button" disabled={i === nomes.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer ${n}`} className={seta}>↓</button>
              <button type="button" onClick={() => { setNomes((x) => x.filter((y) => y !== n)); setAviso(`“${n}” foi removido da lista.`); }} aria-label={`Remover ${n}`} className={`min-h-11 rounded border border-slate-400 bg-white px-3 text-sm text-rose-800 hover:bg-rose-50 ${FOCO}`}>Remover</button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <details className="mt-3 rounded-md border border-slate-300 bg-slate-50">
        <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Colar lista (um nome por linha)</summary>
        <div className="space-y-2 border-t border-slate-200 p-3">
          <label htmlFor={`${id}-colar`} className="block text-sm font-medium">Cole vários nomes de uma vez</label>
          <textarea id={`${id}-colar`} value={colado} onChange={(e) => setColado(e.target.value)} rows={4} placeholder={"Menu inicial\nFinanceiro\nRH"} className={campo + " mt-0"} />
          <button type="button" onClick={() => { if (adicionar(colado.split("\n")) || !colado.trim()) setColado(""); }} className={`${btn} min-h-11 ${FOCO}`}>Adicionar à lista</button>
        </div>
      </details>
    </div>
  );
}
