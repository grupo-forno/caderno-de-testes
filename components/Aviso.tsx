import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type Tom = "info" | "sucesso" | "alerta" | "erro";
const ESTILO: Record<Tom, { caixa: string; Icone: typeof Info }> = {
  info: { caixa: "border-slate-300 bg-slate-50 text-slate-900", Icone: Info },
  sucesso: { caixa: "border-emerald-300 bg-emerald-50 text-emerald-950", Icone: CheckCircle2 },
  alerta: { caixa: "border-amber-300 bg-amber-50 text-amber-950", Icone: AlertTriangle },
  erro: { caixa: "border-rose-300 bg-rose-50 text-rose-950", Icone: XCircle },
};

// Mensagem junto do conteúdo afetado: o ícone e o texto dizem o que houve (a cor sozinha não basta).
// Erro vira "alert" (o leitor de tela avisa na hora); os outros são "status".
export default function Aviso({ tom = "info", titulo, children, acoes, className = "" }: { tom?: Tom; titulo?: string; children?: ReactNode; acoes?: ReactNode; className?: string }) {
  const { caixa, Icone } = ESTILO[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`flex gap-3 rounded-md border px-4 py-3 text-sm ${caixa} ${className}`}>
      <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? "mt-1" : ""}>{children}</div>}
        {acoes && <div className="mt-2 flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </div>
  );
}
