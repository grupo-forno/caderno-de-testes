"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Dialogo from "@/components/Dialogo";
import { botao, botaoIcone, FOCO } from "@/components/estilos";

function BotoesConfirmar({ perigo, ok, aoCancelar }: { perigo?: boolean; ok: string; aoCancelar: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <button type="button" disabled={pending} onClick={aoCancelar} className={botao("secundario")}>Cancelar</button>
      <button type="submit" disabled={pending} aria-busy={pending} className={botao(perigo ? "destrutivo" : "primario")}>
        {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
        {pending ? "Aguarde…" : ok}
      </button>
    </div>
  );
}

// o ícone vem como elemento (<History />), não como componente: uma página de servidor não pode passar funções a um componente de cliente
// Uma opção é navegação (href) ou uma ação do servidor (acao), com confirmação opcional e destaque para as que apagam
type Item = { rotulo: string; icone?: ReactNode; perigo?: boolean; desabilitada?: boolean } & ({ href: string; acao?: never; confirmar?: never } | { href?: never; acao: () => void | Promise<void>; confirmar?: string });

// Menu de ações secundárias de uma linha da lista. O botão tem nome acessível e dica; as opções são links de navegação.
// Teclado: Enter ou Espaço abre, setas movem, Esc fecha e devolve o foco ao botão, Tab sai.
export default function MenuAcoes({ rotulo, itens }: { rotulo: string; itens: Item[] }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState<Item | null>(null);
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
          {itens.map((it) => {
            const cor = it.perigo ? "text-rose-800 hover:bg-rose-50 focus-visible:bg-rose-50" : "text-slate-900 hover:bg-slate-100 focus-visible:bg-slate-100";
            const classe = `flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 ${cor} ${FOCO}`;
            const conteudo = (
              <>
                <span aria-hidden="true" className="[&>svg]:size-4 [&>svg]:shrink-0">{it.icone}</span>
                {it.rotulo}
              </>
            );
            return (
              <li key={it.rotulo} role="none">
                {it.href !== undefined ? (
                  <Link role="menuitem" tabIndex={-1} href={it.href} onClick={() => setAberto(false)} className={classe}>{conteudo}</Link>
                ) : (
                  it.confirmar ? (
                    <button type="button" role="menuitem" tabIndex={-1} disabled={it.desabilitada} aria-haspopup="dialog" onClick={() => { setAberto(false); setConfirmando(it); }} className={classe}>{conteudo}</button>
                  ) : (
                    <form action={it.acao} onSubmit={() => setTimeout(() => setAberto(false), 0)}>
                      <button type="submit" role="menuitem" tabIndex={-1} disabled={it.desabilitada} className={classe}>{conteudo}</button>
                    </form>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialogo aberto={!!confirmando} aoFechar={() => setConfirmando(null)} titulo={(confirmando?.confirmar ?? "").split("?")[0] + "?"}>
        {confirmando && (
          <form action={confirmando.acao}>
            <p className="text-sm text-slate-800">{(confirmando.confirmar ?? "").split("?").slice(1).join("?").trim()}</p>
            <BotoesConfirmar perigo={confirmando.perigo} ok={confirmando.perigo ? "Excluir" : "Confirmar"} aoCancelar={() => setConfirmando(null)} />
          </form>
        )}
      </Dialogo>
    </div>
  );
}
