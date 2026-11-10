"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { botaoIcone, FOCO } from "@/components/estilos";

// o ícone vem como elemento (<History />), não como componente: uma página de servidor não pode passar funções a um componente de cliente
type Item = { rotulo: string; href: string; icone?: ReactNode };

// Menu de ações secundárias de uma linha da lista. O botão tem nome acessível e dica; as opções são links de navegação.
// Teclado: Enter ou Espaço abre, setas movem, Esc fecha e devolve o foco ao botão, Tab sai.
export default function MenuAcoes({ rotulo, itens }: { rotulo: string; itens: Item[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const id = useId();

  const opcoes = () => Array.from(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!aberto) return;
    opcoes()[0]?.focus();
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function aoTeclar(e: KeyboardEvent) {
    if (!aberto) return;
    const lista = opcoes();
    const i = lista.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      setAberto(false);
      gatilho.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      lista[(i + 1) % lista.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      lista[(i - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      lista[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      lista[lista.length - 1]?.focus();
    } else if (e.key === "Tab") setAberto(false);
  }

  return (
    <div ref={raiz} onKeyDown={aoTeclar} className="relative">
      <button
        ref={gatilho}
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => setAberto((a) => !a)}
        className={botaoIcone("secundario")}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {aberto && (
        <ul id={id} role="menu" aria-label={rotulo} className="absolute right-0 top-full z-20 mt-1 min-w-56 rounded-md border border-slate-300 bg-white p-1 shadow-lg">
          {itens.map(({ rotulo: r, href, icone }) => (
            <li key={href} role="none">
              <Link role="menuitem" tabIndex={-1} href={href} onClick={() => setAberto(false)} className={`flex min-h-11 items-center gap-2 rounded px-3 text-sm text-slate-900 hover:bg-slate-100 focus-visible:bg-slate-100 sm:min-h-10 ${FOCO}`}>
                <span aria-hidden="true" className="text-slate-600 [&>svg]:size-4 [&>svg]:shrink-0">{icone}</span>
                {r}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
