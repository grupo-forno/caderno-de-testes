import type { InputHTMLAttributes } from "react";
import { campo } from "@/components/estilos";

// Campo de formulário: rótulo visível acima, ajuda curta, erro junto do campo. O placeholder fica só para exemplo.
export default function Campo({ rotulo, nome, ajuda, erro, obrigatorio, ...resto }: { rotulo: string; nome: string; ajuda?: string; erro?: string | null; obrigatorio?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "required">) {
  const id = `campo-${nome}`;
  const descritoPor = [ajuda && `${id}-ajuda`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {rotulo} {obrigatorio && <span className="font-normal text-slate-600">(obrigatório)</span>}
      </label>
      {ajuda && <p id={`${id}-ajuda`} className="mt-0.5 text-xs text-slate-700">{ajuda}</p>}
      <input id={id} name={nome} required={obrigatorio} aria-invalid={erro ? true : undefined} aria-describedby={descritoPor} autoComplete="off" className={`${campo} min-h-11 sm:min-h-10 ${erro ? "border-rose-600" : ""}`} {...resto} />
      {erro && <p id={`${id}-erro`} role="alert" className="mt-1 text-sm text-rose-800">{erro}</p>}
    </div>
  );
}
