"use client";

import { useEffect, useState } from "react";
import { CopiarLink } from "@/components/ui";

// Mostra o link para continuar recém-gerado. A chave vem no "#k=" do endereço: nunca passa pelo servidor nem fica em registro de acesso.
export default function NovoLink({ slug, nome }: { slug: string; nome: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const k = window.location.hash.match(/^#k=([\w-]+)$/)?.[1];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (k) setUrl(`${window.location.origin}/c/${slug}#k=${k}`);
  }, [slug]);
  if (!url) return null;
  return (
    <div role="status" className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950">
      <p className="font-semibold">Novo link para continuar, de {nome}</p>
      <p className="mt-1">Envie só para essa pessoa. O link antigo já não funciona. Este link não aparece de novo: copie agora.</p>
      <div className="mt-2"><CopiarLink url={url} /></div>
    </div>
  );
}
