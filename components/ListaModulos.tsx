"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import Aviso from "@/components/Aviso";
import { botao, botaoIcone, campo } from "@/components/estilos";
import { MODULOS_SUGERIDOS, semDuplicados } from "@/lib/listas";

// Módulos montados aos poucos: nome + "Adicionar" (ou Enter), atalhos, lista com remover e reordenar, e "Colar lista" como opção.
// Nada é salvo aqui: a lista vai no formulário de quem usa, num campo escondido com um nome por linha.
export default function ListaModulos({ campo: nomeCampo, existentes = [] }: { campo: string; existentes?: string[] }) {
  const id = useId();
  const [nomes, setNomes] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [colado, setColado] = useState("");
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "alerta"; texto: string } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  function adicionar(novos: string[]) {
    const r = semDuplicados(novos, [...existentes, ...nomes]);
    if (r.novos.length) setNomes((n) => [...n, ...r.novos]);
    if (r.ignorados.length) setAviso({ tom: "alerta", texto: `${r.ignorados.length === 1 ? "Este nome já existia e foi ignorado" : "Estes nomes já existiam e foram ignorados"}: ${r.ignorados.join(", ")}.` });
    else if (r.novos.length) setAviso({ tom: "sucesso", texto: `${r.novos.length === 1 ? "Módulo adicionado" : `${r.novos.length} módulos adicionados`}.` });
    else setAviso(null);
    return r.novos.length;
  }
  function adicionarDigitado() {
    if (!texto.trim()) return setAviso({ tom: "alerta", texto: "Escreva o nome do módulo antes de adicionar." });
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
      <p className="mt-0.5 text-xs text-slate-700">Escreva o nome e aperte Enter, ou use o botão Adicionar.</p>
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
          className={campo + " mt-0 min-h-11 min-w-0 flex-1 sm:min-h-10"}
        />
        <button type="button" onClick={adicionarDigitado} className={botao("secundario")}>
          <Plus aria-hidden="true" />
          Adicionar
        </button>
      </div>
      <div className="mt-2 min-h-5">{aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}</div>

      {sugestoes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-slate-700">Atalhos: toque para adicionar</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => adicionar([s])} className={botao("secundario", "rounded-full")}>
                  <Plus aria-hidden="true" />
                  {s}
                </button>
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
                <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Mover o módulo ${n} para cima`} title="Mover para cima" className={botaoIcone("secundario")}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button type="button" disabled={i === nomes.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover o módulo ${n} para baixo`} title="Mover para baixo" className={botaoIcone("secundario")}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button type="button" onClick={() => { setNomes((x) => x.filter((y) => y !== n)); setAviso({ tom: "sucesso", texto: `“${n}” foi removido da lista.` }); }} aria-label={`Remover o módulo ${n}`} className={botao("destrutivo")}>
                  <Trash2 aria-hidden="true" />
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <details className="group mt-3">
        <summary className={botao("discreto", "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
          <ClipboardPaste aria-hidden="true" />
          Colar lista (um nome por linha)
        </summary>
        <div className="mt-2 space-y-2 rounded-md border border-slate-300 bg-slate-50 p-3">
          <label htmlFor={`${id}-colar`} className="block text-sm font-medium">Cole vários nomes de uma vez</label>
          <textarea id={`${id}-colar`} value={colado} onChange={(e) => setColado(e.target.value)} rows={4} placeholder={"Menu inicial\nFinanceiro\nRH"} className={campo + " mt-0"} />
          <button type="button" onClick={() => { if (adicionar(colado.split("\n")) || !colado.trim()) setColado(""); }} className={botao("primario")}>
            <Plus aria-hidden="true" />
            Adicionar à lista
          </button>
        </div>
      </details>
    </div>
  );
}
