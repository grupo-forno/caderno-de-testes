import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { botao } from "@/components/estilos";

type Migalha = { rotulo: string; href?: string };

// Cabeçalho de página: caminho (ou "Voltar"), título, descrição curta e as ações da página agrupadas à direita.
export default function CabecalhoPagina({ titulo, descricao, migalhas, voltar, acoes }: {
  titulo: ReactNode;
  descricao?: ReactNode;
  migalhas?: Migalha[]; // quando há hierarquia: Seus cadernos › Caderno › Página
  voltar?: { href: string; rotulo: string }; // página de um passo só (criar, editar): volta para a lista
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {voltar && (
        <Link href={voltar.href} className={botao("discreto", "-ml-3 min-h-11 sm:min-h-9")}>
          <ArrowLeft aria-hidden="true" />
          {voltar.rotulo}
        </Link>
      )}
      {migalhas && (
        <nav aria-label="Caminho até esta página">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-700">
            {migalhas.map((m, i) => (
              <li key={m.rotulo} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden="true" className="size-4 text-slate-500" />}
                {m.href ? <Link href={m.href} className="inline-flex min-h-11 items-center rounded px-1 text-indigo-800 underline underline-offset-2 hover:text-indigo-950 focus-visible:outline-2 focus-visible:outline-indigo-600 sm:min-h-8">{m.rotulo}</Link> : <span aria-current="page" className="inline-flex min-h-11 items-center px-1 font-medium text-slate-900 sm:min-h-8">{m.rotulo}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-balance break-words text-2xl font-semibold">{titulo}</h1>
          {descricao && <p className="mt-1 max-w-2xl text-sm text-slate-700">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
