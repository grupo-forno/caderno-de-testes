"use client";

import type { ReactNode } from "react";

// Link de verdade para uma tela (#id). O clique normal navega dentro da página;
// Ctrl, Cmd, Shift ou o botão do meio deixam o navegador abrir em outra aba.
export default function LinkTela({ id, aoIr, className, children, ariaCurrent, ariaLabel }: {
  id: string;
  aoIr: (id: string) => void;
  className: string;
  children: ReactNode;
  ariaCurrent?: boolean;
  ariaLabel?: string;
}) {
  return (
    <a
      href={`#${id}`}
      className={className}
      aria-current={ariaCurrent ? "page" : undefined}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        aoIr(id);
      }}
    >
      {children}
    </a>
  );
}
