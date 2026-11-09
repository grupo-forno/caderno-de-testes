import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import TelaForm from "@/components/TelaForm";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { salvarTela } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/tela/[telaId]">) {
  await exigirAdmin();
  const { id, telaId } = await params;
  const { erro } = await searchParams;
  const nova = telaId === "nova";
  let inicial = { titulo: "", imagem: null as string | null, link: null as string | null, pdf: null as string | null, itens: [] as { nome: string; faz: string }[] };
  if (!nova) {
    const [t] = await sql`select * from telas where id::text = ${telaId} and caderno_id::text = ${id}`;
    if (!t) notFound();
    inicial = { titulo: t.titulo, imagem: t.imagem_url, link: t.link_url, pdf: t.pdf_url, itens: t.itens };
  }

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-700 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">{nova ? "Nova tela" : "Editar tela"}</h1>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <TelaForm acao={salvarTela.bind(null, id, nova ? null : telaId)} inicial={inicial} erro={erro === "titulo"} />
        </div>
      </main>
    </>
  );
}
