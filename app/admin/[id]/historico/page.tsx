import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { COR_RESULTADO, dataHora, ROTULO_RESULTADO } from "@/lib/formatar";

export const dynamic = "force-dynamic";

const LIMITE = 300;
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/historico">) {
  await exigirAdmin();
  const { id } = await params;
  const { item: itemQ, tela: telaQ } = await searchParams;
  const item = typeof itemQ === "string" ? itemQ : null;
  const tela = typeof telaQ === "string" ? telaQ : null;
  const [c] = await sql`select slug, titulo from cadernos where id::text = ${id}`;
  if (!c) notFound();

  // nomes de hoje: funcionalidade, tela e módulo (o que foi removido aparece como "removida")
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id}`;
  const telas = await sql`select id, titulo, modulo_id, itens from telas where caderno_id = ${id}`;
  const nomeModulo = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const nomeTela = new Map(telas.map((t) => [t.id as string, { titulo: t.titulo as string, modulo: nomeModulo.get(t.modulo_id) ?? "" }]));
  const nomeItem = new Map<string, string>();
  const numeroPasso = new Map<string, number>(); // id do passo -> posição (1, 2, 3...) dentro da funcionalidade
  for (const t of telas) {
    for (const i of t.itens as { id: string; nome: string; passos?: { id: string }[] }[]) {
      nomeItem.set(i.id, i.nome);
      i.passos?.forEach((p, n) => numeroPasso.set(p.id, n + 1));
    }
  }

  const eventos = await sql`
    select id, tela, item, passo, ator, nome, tipo, de, para, obs, anexos, criado from historico
    where caderno = ${c.slug} and (${item}::text is null or item = ${item}) and (${tela}::text is null or tela = ${tela})
    order by criado desc, id desc limit ${LIMITE}`;

  const filtro = item ? `da funcionalidade “${nomeItem.get(item) ?? "removida"}”` : tela ? `da tela “${nomeTela.get(tela)?.titulo ?? "removida"}”` : null;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-800 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">Histórico: {c.titulo}</h1>
        <p className="mt-1 text-sm text-slate-700">
          Tudo que mudou de resultado ou de observação, e cada correção que você registrou. O histórico só cresce: nada é apagado ou editado, como um registro de versões.
        </p>
        {filtro && (
          <p className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm">
            <span>Mostrando só o histórico {filtro}.</span>
            <Link href={`/admin/${id}/historico`} className={`inline-flex min-h-11 items-center font-medium text-indigo-800 underline ${FOCO}`}>Ver tudo</Link>
          </p>
        )}

        {eventos.length === 0 ? (
          <p className="mt-6 text-sm text-slate-700">Nada registrado ainda. Quando alguém responder ou você marcar uma correção, aparece aqui.</p>
        ) : (
          <>
            <ol className="mt-6 space-y-3">
              {eventos.map((e) => {
                const nomeDoItem = nomeItem.get(e.item);
                const t = nomeTela.get(e.tela);
                const onde = t ? ` (tela ${t.titulo}${t.modulo ? `, módulo ${t.modulo}` : ""})` : " (funcionalidade removida)";
                const alvo = `${e.passo ? `passo ${numeroPasso.get(e.passo) ?? "removido"} de ` : ""}“${nomeDoItem ?? "Funcionalidade removida"}”${onde}`;
                return (
                  <li key={e.id} className={`rounded-lg border bg-white p-4 text-sm ${e.tipo === "correcao" ? "border-amber-300" : e.tipo === "aceite" ? "border-emerald-400" : e.tipo === "reabertura" ? "border-slate-500" : "border-slate-200"}`}>
                    <p>
                      <time dateTime={new Date(e.criado).toISOString()} className="text-slate-700">{dataHora(e.criado)}</time>
                      {" · "}
                      <strong>{e.nome}</strong>{" "}
                      {e.tipo === "resultado" && (
                        <>
                          marcou{" "}
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO[e.para] ?? COR_RESULTADO.nao_testado}`}>{ROTULO_RESULTADO[e.para] ?? e.para}</span>
                          {e.de && <span className="text-slate-700"> (antes: {ROTULO_RESULTADO[e.de] ?? e.de})</span>} em{" "}
                        </>
                      )}
                      {e.tipo === "observacao" && <>{e.passo ? "atualizou o texto do " : "atualizou a observação de "}</>}
                      {e.tipo === "correcao" && <>marcou como corrigido </>}
                      {e.tipo === "aceite" && <>concluiu a homologação.</>}
                      {e.tipo === "reabertura" && <>reabriu a homologação:</>}
                      {e.tipo !== "aceite" && e.tipo !== "reabertura" && alvo}
                      {e.tipo === "correcao" && e.obs ? ":" : ""}
                    </p>
                    {e.obs && <p className="mt-1 whitespace-pre-wrap text-slate-800">{e.obs}</p>}
                    {(e.anexos as string[])?.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {(e.anexos as string[]).map((u, k) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt={`Print ${k + 1} anexado`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!item && nomeDoItem && (
                      <Link href={`/admin/${id}/historico?item=${e.item}`} className={`inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`}>
                        Ver só esta funcionalidade
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
            {eventos.length === LIMITE && <p className="mt-4 text-sm text-slate-700">Mostrando os {LIMITE} registros mais recentes. Para ver os mais antigos, filtre por uma funcionalidade ou tela.</p>}
          </>
        )}
      </main>
    </>
  );
}
