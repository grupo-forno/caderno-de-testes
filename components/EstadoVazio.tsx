import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Quando não há nada para mostrar: explica o que falta e oferece a ação para resolver.
export default function EstadoVazio({ icone: Icone, titulo, children, acao }: { icone?: LucideIcon; titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      {Icone && <Icone aria-hidden="true" className="mx-auto size-8 text-slate-500" />}
      <p className="mt-2 font-semibold">{titulo}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-700">{children}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
