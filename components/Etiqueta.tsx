import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tom = "neutro" | "info" | "sucesso" | "alerta" | "erro";
const COR: Record<Tom, string> = {
  neutro: "bg-slate-100 text-slate-800 ring-slate-300",
  info: "bg-indigo-50 text-indigo-900 ring-indigo-300",
  sucesso: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  alerta: "bg-amber-100 text-amber-950 ring-amber-400",
  erro: "bg-rose-100 text-rose-900 ring-rose-300",
};

// Estado em texto (com ícone e cor): quem não distingue as cores ainda entende. Se o estado pede uma ação, o verbo vem em um link ou botão ao lado.
export default function Etiqueta({ tom = "neutro", icone: Icone, children }: { tom?: Tom; icone?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${COR[tom]}`}>
      {Icone && <Icone aria-hidden="true" className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}
