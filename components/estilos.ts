// Classes de estilo compartilhadas. Fica fora do ui.tsx (que é "use client"): páginas de servidor não conseguem ler texto exportado de lá.
export const campo = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200";
export const btn = "rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700";
export const btn2 = "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";

// ---------- Design system: botões e links com aparência de botão ----------
// Uma só fonte para <button> e <Link>. Navegação usa link; salvar, abrir, adicionar e mudar estado usam botão.
// Tamanho: 44 px no celular (toque) e 40 px no computador. O ícone (Lucide) dentro do botão já sai na escala certa.
export const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
export type Variante = "primario" | "secundario" | "discreto" | "destrutivo";

const baseBotao = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium whitespace-nowrap select-none transition-colors sm:min-h-10 [&>svg]:size-4 [&>svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${FOCO}`;
const variantes: Record<Variante, string> = {
  primario: "border-brand-600 bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secundario: "border-slate-400 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100",
  discreto: "border-transparent bg-transparent text-brand-800 hover:bg-brand-50 active:bg-brand-100",
  destrutivo: "border-rose-700 bg-white text-rose-800 hover:bg-rose-50 active:bg-rose-100",
};
export const botao = (v: Variante = "secundario", extra = "") => `${baseBotao} ${variantes[v]} ${extra}`.trim();
// botão só com ícone: quadrado, sempre com aria-label (e title) onde é usado
export const botaoIcone = (v: Variante = "secundario", extra = "") => botao(v, `size-11 px-0 sm:size-10 ${extra}`);
