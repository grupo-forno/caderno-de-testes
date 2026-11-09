"use client";

export const campo = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";
export const btn = "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700";
export const btn2 = "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";

// Botão que pede confirmação antes de enviar o formulário
export function Confirmar({ texto, children, className = btn2 }: { texto: string; children: React.ReactNode; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(texto)) e.preventDefault(); }}>
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
