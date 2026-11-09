"use client";

// Página de erro para qualquer falha inesperada (por exemplo, o banco fora do ar)
export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-balance text-xl font-semibold">Algo deu errado.</h1>
      <p className="mt-2 text-sm text-slate-700">Tente de novo. Se continuar, avise quem preparou o caderno.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-5 min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Tentar de novo
      </button>
      {digest && <p className="mt-4 text-xs text-slate-600">Código do erro: {digest}</p>}
    </main>
  );
}
