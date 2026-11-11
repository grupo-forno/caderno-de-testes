"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Dentro de um caderno (/admin/<id>/...) mostra o caminho para a Fluxos entre telas dele
export default function AdminNav() {
  const id = usePathname().match(/^\/admin\/([0-9a-f-]{36})/i)?.[1];
  if (!id) return null;
  return (
    <nav aria-label="Área interna" className="flex items-center gap-4 text-sm">
      <Link href={`/admin/${id}`} className="min-h-11 content-center hover:underline">Caderno</Link>
      <Link href={`/admin/${id}/biblioteca`} className="min-h-11 content-center font-medium text-indigo-800 hover:underline">Biblioteca de testes</Link>
      <Link href={`/admin/${id}/rodadas`} className="min-h-11 content-center font-medium text-indigo-800 hover:underline">Rodadas</Link>
    </nav>
  );
}
