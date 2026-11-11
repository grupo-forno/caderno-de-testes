"use client";

import { useFormStatus } from "react-dom";
import { btn2, campo } from "@/components/estilos";


// Botão que pede confirmação antes de enviar o formulário
export function Confirmar({ texto, children, className = btn2 }: { texto: string; children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus(); // enquanto o servidor trabalha, não deixa clicar de novo
  return (
    <button className={className + " disabled:opacity-60"} disabled={pending} aria-busy={pending} onClick={(e) => { if (!confirm(texto)) e.preventDefault(); }}>
      {children}
    </button>
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
