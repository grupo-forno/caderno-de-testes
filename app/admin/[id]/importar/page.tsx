import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import ImportarForm from "@/components/ImportarForm";
import { btn2 } from "@/components/estilos";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/admin/[id]/importar">) {
  await exigirAdmin();
  const { id } = await params;
  const [c] = await sql`select titulo from cadernos where id::text = ${id}`;
  if (!c) notFound();

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-800 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">Importar de uma planilha</h1>
        <p className="mt-1 text-sm text-slate-700">Caderno: {c.titulo}</p>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Como preencher</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            <li>Baixe o modelo, abra no Excel ou no Google Planilhas e preencha. <strong>Cada linha é uma funcionalidade.</strong></li>
            <li>As colunas são: <strong>Módulo</strong>, <strong>Tela</strong>, <strong>Pop-up de</strong>, <strong>Funcionalidade</strong> e <strong>O que faz</strong>.</li>
            <li>Para um <strong>pop-up</strong>, escreva o nome do pop-up em “Tela” e o nome da tela onde ele abre em “Pop-up de” (no mesmo módulo).</li>
            <li>Linha só com Módulo e Tela cria a tela vazia, que aparece para o cliente como “Em preparação”. Linha só com Módulo cria o módulo.</li>
            <li>Salve como CSV, escolha o arquivo aqui e clique em “Verificar planilha”. Só depois de conferir você importa.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-800">Pode importar mais de uma vez: o que já existe é reconhecido pelo nome (sem diferenciar maiúsculas) e <strong>não é repetido, apagado nem alterado</strong>.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/admin/${id}/importar/modelo`} download className={`${btn2} inline-flex min-h-11 items-center`}>Baixar o modelo (CSV)</a>
            <a href={`/admin/${id}/exportar`} download className={`${btn2} inline-flex min-h-11 items-center`}>Baixar o caderno atual (CSV)</a>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5" aria-labelledby="titulo-enviar">
          <h2 id="titulo-enviar" className="font-semibold">Enviar a planilha</h2>
          <div className="mt-3">
            <ImportarForm cadernoId={id} />
          </div>
        </section>
      </main>
    </>
  );
}
