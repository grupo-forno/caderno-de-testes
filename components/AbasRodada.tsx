import Link from "next/link";

// Abas de uma rodada publicada: visão geral, pendências e aceite
export default function AbasRodada({ cadernoId, rodadaId, ativa, abertas, situacaoAceite }: { cadernoId: string; rodadaId: string; ativa: "geral" | "pendencias" | "aceite"; abertas: number; situacaoAceite?: string }) {
  const base = `/admin/${cadernoId}/rodadas/${rodadaId}`;
  const aba = (on: boolean) => `inline-flex min-h-11 items-center rounded-t-md border-b-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${on ? "border-indigo-700 text-indigo-900" : "border-transparent text-slate-700 hover:bg-slate-100"}`;
  return (
    <nav aria-label="Abas da rodada" className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
      <Link href={base} aria-current={ativa === "geral" ? "page" : undefined} className={aba(ativa === "geral")}>Visão geral</Link>
      <Link href={`${base}/pendencias`} aria-current={ativa === "pendencias" ? "page" : undefined} className={aba(ativa === "pendencias")}>
        Pendências{abertas > 0 && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-900">{abertas} para tratar</span>}
      </Link>
      <Link href={`${base}/aceite`} aria-current={ativa === "aceite" ? "page" : undefined} className={aba(ativa === "aceite")}>
        Aceite{situacaoAceite && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">{situacaoAceite}</span>}
      </Link>
    </nav>
  );
}
