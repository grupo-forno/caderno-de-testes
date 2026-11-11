import { useId } from "react";

// Ícone do caderno com o visto. Os vazios (visto e folga das argolas) são recortes, então funciona sobre qualquer fundo.
export function IconeCaderno({ className = "size-8", cor = "#EF780A" }: { className?: string; cor?: string }) {
  const id = useId();
  const argolas = [355, 415, 477];
  return (
    <svg viewBox="193 310 228 228" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="193" y="310" width="228" height="228">
          <rect x="193" y="310" width="228" height="228" fill="#fff" />
          {argolas.map((y) => <rect key={y} x="205" y={y} width="50" height="24" rx="12" fill="#000" stroke="#000" strokeWidth="14" />)}
          <polygon points="271,412 289,404 318,433 386,360 386,399 318,472" fill="#000" />
        </mask>
      </defs>
      <rect x="230" y="315" width="181" height="218" rx="28" fill={cor} mask={`url(#${id})`} />
      {argolas.map((y) => <rect key={y} x="205" y={y} width="50" height="24" rx="12" fill={cor} />)}
    </svg>
  );
}

// Marca do sistema: ícone + nome. `sub` mostra "Grupo Forno" embaixo do nome.
export default function Logo({ className = "", sub = false, tamanho = "size-8" }: { className?: string; sub?: boolean; tamanho?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <IconeCaderno className={`${tamanho} shrink-0`} />
      <span className="flex flex-col leading-tight">
        <span className="font-semibold tracking-tight text-slate-950">Caderno de testes</span>
        {sub && <span className="text-[0.65rem] font-medium tracking-[0.28em] text-slate-700 uppercase">Grupo Forno</span>}
      </span>
    </span>
  );
}
