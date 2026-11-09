import { ROTULO_STATUS, type StatusTela } from "@/lib/status";

// Cinza = não iniciada, amarelo = em andamento, verde = finalizada, tracejado quadrado = em preparação.
// Nunca só a cor: cada status tem um desenho diferente e o texto.
const ESTILO: Record<StatusTela, string> = {
  em_preparacao: "bg-white text-slate-700 ring-slate-400",
  nao_iniciada: "bg-slate-100 text-slate-700 ring-slate-300",
  em_andamento: "bg-amber-100 text-amber-900 ring-amber-300",
  finalizada: "bg-emerald-100 text-emerald-900 ring-emerald-300",
};

export function IconeStatus({ status, className = "h-5 w-5" }: { status: StatusTela; className?: string }) {
  const comum = { viewBox: "0 0 20 20", className: `${className} shrink-0`, "aria-hidden": true as const, fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (status === "finalizada")
    return (
      <svg {...comum}>
        <circle cx="10" cy="10" r="8" fill="currentColor" stroke="none" opacity="0.18" />
        <circle cx="10" cy="10" r="8" />
        <path d="M6.5 10.3l2.4 2.4 4.6-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "em_andamento")
    return (
      <svg {...comum}>
        <circle cx="10" cy="10" r="8" />
        <path d="M10 2a8 8 0 010 16z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (status === "em_preparacao")
    return (
      <svg {...comum}>
        <rect x="3" y="3" width="14" height="14" rx="3" strokeDasharray="2.4 2.4" />
        <path d="M7 10h6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...comum}>
      <circle cx="10" cy="10" r="8" strokeDasharray="2.4 2.4" />
    </svg>
  );
}

export function ChipStatus({ status, className = "" }: { status: StatusTela; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${ESTILO[status]} ${className}`}>
      <IconeStatus status={status} className="h-4 w-4" />
      {ROTULO_STATUS[status]}
    </span>
  );
}

export const COR_ICONE: Record<StatusTela, string> = {
  em_preparacao: "text-slate-500",
  nao_iniciada: "text-slate-500",
  em_andamento: "text-amber-700",
  finalizada: "text-emerald-600",
};
