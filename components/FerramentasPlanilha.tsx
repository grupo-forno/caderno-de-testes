"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { btn2 } from "@/components/ui";

// Aviso depois de importar. Fica aqui dentro para a página do caderno não precisar mudar.
function Aviso() {
  const importado = useSearchParams().get("importado");
  if (!importado) return null;
  return <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Planilha importada.</p>;
}

// Importar e exportar o caderno por planilha (CSV)
export default function FerramentasPlanilha({ cadernoId }: { cadernoId: string }) {
  return (
    <>
      <Suspense fallback={null}>
        <Aviso />
      </Suspense>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/admin/${cadernoId}/importar`} className={`${btn2} inline-flex min-h-11 items-center`}>Importar de uma planilha</Link>
        <a href={`/admin/${cadernoId}/exportar`} download className={`${btn2} inline-flex min-h-11 items-center`}>Baixar em planilha (CSV)</a>
      </div>
    </>
  );
}
