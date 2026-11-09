import { sql } from "@/lib/db";
import type { Caderno } from "@/lib/tipos";

export async function buscarCaderno(slug: string): Promise<{ id: string; caderno: Caderno } | null> {
  const [c] = await sql`select * from cadernos where slug = ${slug}`;
  if (!c) return null;
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${c.id} order by ordem`;
  const telas = await sql`select * from telas where caderno_id = ${c.id} order by ordem`;
  return {
    id: c.id,
    caderno: {
      titulo: c.titulo,
      versao: c.versao,
      data: new Date(c.atualizado).toLocaleDateString("pt-BR"),
      preparadoPor: c.preparado_por,
      antesDeComecar: String(c.antes).split("\n").map((s) => s.trim()).filter(Boolean),
      modulos: modulos.map((m) => ({ id: m.id, titulo: m.titulo })),
      telas: telas.map((t) => ({
        id: t.id,
        moduloId: t.modulo_id,
        titulo: t.titulo,
        imagem: t.imagem_url,
        link: t.link_url,
        pdf: t.pdf_url ?? (t.itens.length ? `/api/pdf/${t.id}` : null),
        itens: t.itens,
        paiId: t.pai_id,
      })),
    },
  };
}
