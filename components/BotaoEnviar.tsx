"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { botao, type Variante } from "@/components/estilos";

// Botão de enviar formulário (ação do servidor): enquanto salva mostra o texto de andamento e não deixa enviar de novo.
export default function BotaoEnviar({ children, pendente = "Salvando…", variante = "primario", className = "" }: { children: ReactNode; pendente?: string; variante?: Variante; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={botao(variante, className)}>
      {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
      {pending ? pendente : children}
    </button>
  );
}
