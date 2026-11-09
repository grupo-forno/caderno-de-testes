"use client";

import Link from "next/link";

// Falha inesperada na área de quem monta os cadernos (por exemplo, o banco fora do ar ao salvar)
export default function ErroAdmin({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-balance text-xl font-semibold">Algo deu errado ao salvar.</h1>
      <p role="alert" className="mt-2 text-sm text-slate-700">
        O que você digitou pode não ter sido gravado. Volte, confira e tente de novo.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Tentar de novo
        </button>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Voltar aos cadernos
        </Link>
      </div>
      {digest && <p className="mt-4 text-xs text-slate-600">Código do erro: {digest}</p>}
    </main>
  );
}
