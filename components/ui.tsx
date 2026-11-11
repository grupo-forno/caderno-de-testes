"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Dialogo from "@/components/Dialogo";
import { botao, btn2, campo } from "@/components/estilos";

// Botão que pede confirmação num diálogo antes de enviar o formulário em que está.
// O título é a primeira frase do texto (até o "?"); `ok` é o rótulo do botão de confirmar e `perigo` pinta de vermelho.
export function Confirmar({ texto, children, className = btn2, ok = "Confirmar", perigo = false, desabilitado = false }: { texto: string; children: React.ReactNode; className?: string; ok?: string; perigo?: boolean; desabilitado?: boolean }) {
  const { pending } = useFormStatus(); // enquanto o servidor trabalha, não deixa clicar de novo
  const [aberto, setAberto] = useState(false);
  const eraPendente = useRef(false);
  const corte = texto.indexOf("?");
  const titulo = corte > 0 ? texto.slice(0, corte + 1) : "Confirmar";
  const detalhe = corte > 0 ? texto.slice(corte + 1).trim() : texto;

  // se o servidor terminar sem sair da página (erro), o diálogo fecha
  useEffect(() => {
    if (eraPendente.current && !pending) setAberto(false);
    eraPendente.current = pending;
  }, [pending]);

  return (
    <>
      <button type="button" className={className + " disabled:opacity-60"} disabled={pending || desabilitado} aria-busy={pending} aria-haspopup="dialog" onClick={(e) => { if (e.currentTarget.form && !e.currentTarget.form.reportValidity()) return; setAberto(true); }}>
        {children}
      </button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={titulo}>
        {detalhe && <p className="text-sm text-slate-800">{detalhe}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={pending} onClick={() => setAberto(false)} className={botao("secundario")}>Cancelar</button>
          <button type="submit" disabled={pending} aria-busy={pending} className={botao(perigo ? "destrutivo" : "primario")}>
            {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {pending ? "Aguarde…" : ok}
          </button>
        </div>
      </Dialogo>
    </>
  );
}

export function CopiarLink({ url }: { url: string }) {
  return (
    <div className="flex gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={campo + " mt-0"} />
      <button type="button" className={btn2} onClick={() => navigator.clipboard.writeText(url)}>Copiar</button>
    </div>
  );
}
