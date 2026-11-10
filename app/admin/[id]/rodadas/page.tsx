import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import { btn } from "@/components/estilos";
import { exigirAdmin } from "@/lib/admin";
import BancoDesatualizado from "@/components/BancoDesatualizado";
import { sql, tabelasFaltando } from "@/lib/db";
import { ROTULO_SITUACAO } from "@/lib/rodadas";
import { progressoDaRodada } from "@/lib/rodadasDb";
import { criarRodada } from "../../rodada-actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const dia = (d: string | null) => (d ? d.split("-").reverse().join("/") : "Sem prazo");

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas">) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const sp = await searchParams;
  const [cad] = await sql`select titulo from cadernos where id = ${id}`;
  if (!cad) notFound();
  const faltando = await tabelasFaltando(["cenarios", "rodadas", "rodada_cenarios", "rodada_validadores", "rodada_atribuicoes", "respostas_atribuicao", "pendencias"]);
  if (faltando.length) return <BancoDesatualizado cadernoId={id} pagina="As Rodadas" faltando={faltando} />;
  const rodadas = await sql`select id, nome, versao, prazo::text as prazo, situacao, publicada_em from rodadas where caderno_id = ${id} order by criado desc`;
  const progressos = await Promise.all(rodadas.map((r) => (r.situacao === "em_validacao" ? progressoDaRodada(r.id) : null)));

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-800 hover:underline">← {cad.titulo}</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Rodadas de homologação</h1>
          <form action={criarRodada.bind(null, id)}><button className={btn + " min-h-11"}>Nova rodada</button></form>
        </div>
        <p className="mt-1 text-sm text-slate-700">Cada rodada é uma entrega: você escolhe os cenários da biblioteca, atribui aos validadores e acompanha a execução.</p>
        {sp.erro === "rodada" && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Essa rodada não existe mais. Confira a lista abaixo.</p>}

        {rodadas.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-800">
            <p className="font-semibold">Nenhuma rodada ainda.</p>
            <p className="mt-1">Clique em “Nova rodada” para preparar a primeira entrega.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rodadas.map((r, i) => {
              const p = progressos[i];
              const pct = p && p.geral.total ? Math.round((p.geral.respondidos / p.geral.total) * 100) : 0;
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words text-base font-semibold">
                      <Link href={`/admin/${id}/rodadas/${r.id}`} className={`rounded text-indigo-900 hover:underline ${FOCO}`}>{r.nome}</Link>
                      <span className="ml-2 text-sm font-normal text-slate-700">versão {r.versao}</span>
                    </h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.situacao === "rascunho" ? "bg-slate-100 text-slate-800 ring-slate-300" : "bg-indigo-100 text-indigo-900 ring-indigo-300"}`}>{ROTULO_SITUACAO[r.situacao as "rascunho" | "em_validacao"]}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">Prazo: {dia(r.prazo)}</p>
                  {p ? (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Passos respondidos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} /></div>
                      <p className="mt-1 text-sm tabular-nums text-slate-800">
                        {p.geral.respondidos} de {p.geral.total} passos respondidos · {p.enviadas} de {p.atribuicoes} testes enviados
                        {p.geral.diferente > 0 && <span className="font-semibold text-rose-800"> · {p.geral.diferente} deu diferente</span>}
                        {p.geral.bloqueado > 0 && <span className="font-semibold text-amber-900"> · {p.geral.bloqueado} bloqueado</span>}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">Ainda em preparação: nada foi enviado aos validadores.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
