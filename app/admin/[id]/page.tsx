import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminBar from "@/components/AdminBar";
import { btn, btn2, campo, Confirmar, CopiarLink } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { situacao } from "@/lib/rodada";
import { abrirProximaRodada, alternarRefazer, excluirCaderno, excluirTela, moverTela, salvarCaderno } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]">) {
  await exigirAdmin();
  const { id } = await params;
  const { erro, salvo } = await searchParams;
  const [c] = await sql`select * from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const telas = await sql`select id, titulo, imagem_url, link_url, pdf_url, refazer, jsonb_array_length(itens)::int as n from telas where caderno_id = ${id} order by ordem`;
  const sit = await situacao(c.slug, c.rodada);
  const tudoAprovado = telas.length > 0 && telas.every((x) => sit[x.id]?.aprovada);
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/c/${c.slug}`;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/admin" className="text-sm text-indigo-700 hover:underline">← Todos os cadernos</Link>
        <h1 className="mt-2 text-2xl font-semibold">{c.titulo}</h1>
        {salvo && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Salvo.</p>}

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Link para o cliente</h2>
          <p className="mt-1 text-sm text-slate-600">Quem tiver este link abre o caderno. Envie para o cliente.</p>
          <div className="mt-3"><CopiarLink url={url} /></div>
          <div className="mt-3 flex gap-2">
            <a href={`/c/${c.slug}`} target="_blank" className={btn2}>Ver como o cliente vê</a>
            <Link href={`/admin/${id}/respostas`} className={btn2}>Ver respostas</Link>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Rodada {c.rodada}</h2>
          {tudoAprovado ? (
            <p className="mt-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Todas as telas estão aprovadas. Este caderno está concluído.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                Quando o cliente terminar, abra a próxima rodada. As telas aprovadas (pelo menos um OK e nenhum NÃO OK) ficam recolhidas, e as outras voltam para teste, no topo.
              </p>
              <form action={abrirProximaRodada.bind(null, id)} className="mt-3">
                <Confirmar className={btn} texto={`Abrir a rodada ${c.rodada + 1}? As telas aprovadas ficam recolhidas para o cliente e as demais voltam para teste. Não dá para voltar atrás.`}>
                  Abrir rodada {c.rodada + 1}
                </Confirmar>
              </form>
            </>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Telas ({telas.length})</h2>
            <Link href={`/admin/${id}/tela/nova`} className={btn}>Adicionar tela</Link>
          </div>
          {telas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Nenhuma tela ainda. Clique em “Adicionar tela” para começar.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {telas.map((t, i) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {t.imagem_url ? "Imagem ✓" : "Sem imagem"} · {t.pdf_url ? "PDF ✓" : t.n > 0 ? "PDF gerado pela lista" : "Sem PDF"} · {t.link_url ? "Link ✓" : "Sem link"} · {t.n} {t.n === 1 ? "item" : "itens"}
                    </p>
                    <p className="text-xs">
                      {!t.refazer && <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">Aprovada antes</span>}
                      <span className="text-slate-500">
                        Rodada {c.rodada}: {sit[t.id] ? `${sit[t.id].ok} OK · ${sit[t.id].naoOk} NÃO OK · ${sit[t.id].naoTestado} NÃO TESTADO` : "sem respostas"}
                      </span>
                    </p>
                  </div>
                  <form action={moverTela.bind(null, id, t.id, -1)}><button disabled={i === 0} aria-label="Subir" className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-30">↑</button></form>
                  <form action={moverTela.bind(null, id, t.id, 1)}><button disabled={i === telas.length - 1} aria-label="Descer" className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-30">↓</button></form>
                  {c.rodada > 1 && (
                    <form action={alternarRefazer.bind(null, id, t.id)}>
                      <button className="text-sm text-slate-600 underline">{t.refazer ? "Marcar como aprovada" : "Voltar para teste"}</button>
                    </form>
                  )}
                  <Link href={`/admin/${id}/tela/${t.id}`} className={btn2}>Editar</Link>
                  <form action={excluirTela.bind(null, id, t.id)}><Confirmar texto={`Excluir a tela “${t.titulo}”? Não dá para desfazer.`}>Excluir</Confirmar></form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Dados do caderno</h2>
          <form action={salvarCaderno.bind(null, id)} className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">Nome<input name="titulo" required defaultValue={c.titulo} className={campo} /></label>
            {erro === "titulo" && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">Escreva o nome do caderno.</p>}
            <label className="block text-sm font-medium">Versão<input name="versao" defaultValue={c.versao} className={campo} /></label>
            <label className="block text-sm font-medium">Preparado por<input name="preparado_por" defaultValue={c.preparado_por} className={campo} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Antes de começar (um item por linha)<textarea name="antes" rows={3} defaultValue={c.antes} className={campo} /></label>
            <div className="sm:col-span-2"><button className={btn}>Salvar</button></div>
          </form>
          <form action={excluirCaderno.bind(null, id)} className="mt-6 border-t border-slate-100 pt-4">
            <Confirmar texto="Excluir este caderno inteiro, com as telas e as respostas dos clientes? Não dá para desfazer.">Excluir caderno</Confirmar>
          </form>
        </section>
      </main>
    </>
  );
}
