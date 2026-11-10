"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { botao, botaoIcone, campo } from "@/components/estilos";
import { juntarInstrucoes } from "@/lib/listas";

type Linha = { k: number; v: string };

// "Antes de começar": uma lista ordenada de instruções, cada uma num campo. Vai no formulário de quem usa
// num campo escondido, uma instrução por linha (o formato que sempre foi guardado), na ordem da lista.
export default function ListaInstrucoes({ campo: nomeCampo, inicial }: { campo: string; inicial: string[] }) {
  const id = useId();
  const proximo = useRef(inicial.length);
  const [linhas, setLinhas] = useState<Linha[]>(() => inicial.map((v, k) => ({ k, v })));
  const [aviso, setAviso] = useState("");
  const focar = useRef<string | null>(null); // o que recebe o foco depois da próxima mudança

  const alvo = (k: number, o: "campo" | "sobe" | "desce") => `${k}-${o}`;
  const aoMontar = (chave: string) => (el: HTMLElement | null) => {
    if (el && focar.current === chave) {
      focar.current = null;
      el.focus();
    }
  };

  function adicionar(depoisDe?: number) {
    const k = proximo.current++;
    focar.current = alvo(k, "campo");
    setLinhas((l) => {
      const i = depoisDe === undefined ? l.length : l.findIndex((x) => x.k === depoisDe) + 1;
      return [...l.slice(0, i), { k, v: "" }, ...l.slice(i)];
    });
    setAviso("Instrução adicionada. Escreva o texto.");
  }
  function mover(i: number, dir: -1 | 1) {
    const k = linhas[i].k;
    const j = i + dir;
    // se o botão usado ficar desabilitado (chegou ao fim da lista), o foco vai para o outro
    focar.current = alvo(k, j === 0 ? "desce" : j === linhas.length - 1 ? "sobe" : dir < 0 ? "sobe" : "desce");
    setLinhas((l) => {
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setAviso(`Instrução movida para a posição ${j + 1} de ${linhas.length}.`);
  }
  function remover(i: number) {
    const vizinha = linhas[i + 1] ?? linhas[i - 1];
    focar.current = vizinha ? alvo(vizinha.k, "campo") : null;
    setLinhas((l) => l.filter((_, n) => n !== i));
    setAviso(`Instrução ${i + 1} removida.`);
  }

  return (
    <div>
      <input type="hidden" name={nomeCampo} value={juntarInstrucoes(linhas.map((l) => l.v))} />
      <p className="text-sm text-slate-700">Aparecem para o cliente, nesta ordem, na entrada do caderno. Linhas em branco são ignoradas ao salvar.</p>
      {linhas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-700">Nenhuma instrução ainda.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {linhas.map((l, i) => (
            <li key={l.k} className="rounded-md border border-slate-200 bg-white p-3">
              <label htmlFor={`${id}-${l.k}`} className="block text-sm font-medium">Instrução {i + 1}</label>
              <input
                id={`${id}-${l.k}`}
                ref={aoMontar(alvo(l.k, "campo"))}
                value={l.v}
                maxLength={300}
                onChange={(e) => setLinhas((x) => x.map((y) => (y.k === l.k ? { ...y, v: e.target.value } : y)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // Enter abre a próxima instrução; não envia o formulário
                    adicionar(l.k);
                  }
                }}
                placeholder="Ex.: Um computador ou celular com internet."
                className={campo + " min-h-11 sm:min-h-10"}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" ref={aoMontar(alvo(l.k, "sobe"))} disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Mover a instrução ${i + 1} para cima`} title="Mover para cima" className={botaoIcone("secundario")}>
                  <ArrowUp aria-hidden="true" />
                </button>
                <button type="button" ref={aoMontar(alvo(l.k, "desce"))} disabled={i === linhas.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover a instrução ${i + 1} para baixo`} title="Mover para baixo" className={botaoIcone("secundario")}>
                  <ArrowDown aria-hidden="true" />
                </button>
                <button type="button" onClick={() => remover(i)} aria-label={`Remover a instrução ${i + 1}`} className={botao("destrutivo")}>
                  <Trash2 aria-hidden="true" />
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => adicionar()} className={botao("secundario", "mt-3")}>
        <Plus aria-hidden="true" />
        Adicionar instrução
      </button>
      <p role="status" className="mt-1 min-h-5 text-sm text-slate-800">{aviso}</p>
    </div>
  );
}
