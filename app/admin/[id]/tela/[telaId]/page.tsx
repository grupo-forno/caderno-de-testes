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
  const { erro, pai } = await searchParams;
  const nova = telaId === "nova";
  let inicial = { titulo: "", imagem: null as string | null, link: null as string | null, pdf: null as string | null, itens: [] as { nome: string; faz: string; imagem?: string }[], paiId: null as string | null };
  let temFilhos = false;
  if (!nova) {
    const [t] = await sql`select * from telas where id::text = ${telaId} and caderno_id::text = ${id}`;
    if (!t) notFound();
    inicial = { titulo: t.titulo, imagem: t.imagem_url, link: t.link_url, pdf: t.pdf_url, itens: t.itens, paiId: t.pai_id };
    temFilhos = (await sql`select 1 from telas where pai_id = ${t.id} limit 1`).length > 0;
  }
  const principais = await sql`select id, titulo from telas where caderno_id::text = ${id} and pai_id is null and id::text <> ${nova ? "" : telaId} order by ordem`;
  // vindo do botão "Adicionar pop-up" de uma tela: já chega com a tela pai escolhida
  if (nova && typeof pai === "string" && principais.some((p) => p.id === pai)) inicial.paiId = pai;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-700 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">{nova ? (inicial.paiId ? "Novo pop-up" : "Nova tela") : "Editar tela"}</h1>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <TelaForm
            acao={salvarTela.bind(null, id, nova ? null : telaId)}
            inicial={inicial}
            erro={typeof erro === "string" ? erro : undefined}
            principais={principais.map((p) => ({ id: p.id, titulo: p.titulo }))}
            temFilhos={temFilhos}
          />
        </div>
      </main>
    </>
  );
}
