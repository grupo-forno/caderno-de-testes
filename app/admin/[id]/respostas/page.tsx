import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import NovoLink from "@/components/NovoLink";
import { Confirmar } from "@/components/ui";
import { COR_RESULTADO, ROTULO_RESULTADO } from "@/lib/formatar";
import type { Passo } from "@/lib/tipos";
import { novoLinkDeValidador } from "../../actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/respostas">) {
  await exigirAdmin();
  const { id } = await params;
  const { novo, erro } = await searchParams;
  const [c] = await sql`select slug, titulo from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const todas = await sql`select id, titulo, modulo_id, pai_id, itens from telas where caderno_id = ${id} order by ordem`;
  const rs = await sql`select nome, email, item, resultado, obs, anexos from respostas_item where caderno = ${c.slug} order by nome, email`;

  // respostas aos passos dos roteiros: por pessoa e passo
  const rp = await sql`select email, passo, resultado, obs, anexos from respostas_passo where caderno = ${c.slug}`;
  const porPasso = new Map(rp.map((x) => [`${x.email}|${x.passo}`, x]));
  const comChave = new Set((await sql`select email from validadores where caderno = ${c.slug}`).map((x) => x.email as string));

  // por pessoa: resposta de cada funcionalidade (pela chave do item)
  const pessoas = new Map<string, { nome: string; email: string; porItem: Map<string, (typeof rs)[number]> }>();
  for (const r of rs) {
    if (!pessoas.has(r.email)) pessoas.set(r.email, { nome: r.nome, email: r.email, porItem: new Map() });
    pessoas.get(r.email)!.porItem.set(r.item, r);
  }

  // cada módulo com suas telas (principal seguida dos pop-ups). Tela sem funcionalidades não tem o que mostrar.
  const arvore = modulos
    .map((m) => {
      const doModulo = todas.filter((t) => t.modulo_id === m.id);
      const telas = doModulo.filter((t) => !t.pai_id).flatMap((t) => [t, ...doModulo.filter((f) => f.pai_id === t.id)]).filter((t) => (t.itens as unknown[]).length > 0);
      return { modulo: m, telas };
    })
    .filter((g) => g.telas.length > 0);
  const validos = new Set(todas.flatMap((t) => (t.itens as { id: string }[]).map((i) => i.id)));

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-800 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">Respostas: {c.titulo}</h1>
        <Link href={`/admin/${id}/historico`} className={`inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`}>Ver o histórico de mudanças</Link>

        {typeof erro === "string" && erro === "validador" && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Essa pessoa não usa link para continuar (só respondeu pelo modelo antigo), então não há link para gerar.</p>}

        {pessoas.size === 0 ? (
          <p className="mt-4 text-sm text-slate-700">Ninguém respondeu ainda. Quando o cliente começar, as respostas aparecem aqui.</p>
        ) : (
          [...pessoas.values()].map((p) => {
            const removidas = [...p.porItem.values()].filter((r) => !validos.has(r.item));
            return (
              <section key={p.email} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">{p.nome} <span className="text-sm font-normal text-slate-700">{p.email}</span></h2>
                {novo === p.email && <NovoLink slug={c.slug} nome={p.nome} />}
                {comChave.has(p.email) && (
                  <form action={novoLinkDeValidador.bind(null, id, p.email)} className="mt-1">
                    <Confirmar texto={`Gerar um novo link para continuar para ${p.nome}? O link antigo deixa de funcionar. Faça isso se a pessoa perdeu o link ou se outra pessoa usou o e-mail dela.`} className={`min-h-11 rounded text-xs text-indigo-800 underline ${FOCO}`}>
                      Gerar novo link para continuar
                    </Confirmar>
                  </form>
                )}
                <div className="mt-3 space-y-6">
                  {arvore.map(({ modulo, telas }) => (
                    <div key={modulo.id}>
                      <h3 className="border-b border-slate-200 pb-1 text-base font-semibold">{modulo.titulo}</h3>
                      <div className="mt-3 space-y-5">
                        {telas.map((t) => (
                          <div key={t.id} className={t.pai_id ? "ml-5 border-l-2 border-indigo-200 pl-4" : ""}>
                            <h4 className="text-sm font-semibold text-slate-900">
                              {t.pai_id && <span className="mr-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-900">Pop-up</span>}
                              {t.titulo}
                            </h4>
                            <ul className="mt-1 divide-y divide-slate-100">
                              {(t.itens as { id: string; nome: string; passos?: Passo[] }[]).map((it) => {
                                const r = p.porItem.get(it.id);
                                const res = r?.resultado ?? "nao_testado";
                                return (
                                  <li key={it.id} className="py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="whitespace-pre-wrap text-sm font-medium">{it.nome}</span>
                                      <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO[res]}`}>{ROTULO_RESULTADO[res]}</span>
                                    </div>
                                    {it.passos?.length ? (
                                      <ol className="mt-2 space-y-2">
                                        {it.passos.map((ps, n) => {
                                          const x = porPasso.get(`${p.email}|${ps.id}`);
                                          return (
                                            <li key={ps.id} className={`rounded-md border p-3 text-sm ${x?.resultado === "diferente" ? "border-rose-300 bg-rose-50" : x?.resultado === "nao_consegui" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                                              <div className="flex flex-wrap items-start justify-between gap-2">
                                                <p className="font-semibold">Passo {n + 1}</p>
                                                {x ? (
                                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO[x.resultado]}`}>{ROTULO_RESULTADO[x.resultado]}</span>
                                                ) : (
                                                  <span className="text-xs font-semibold text-slate-700">Sem resposta</span>
                                                )}
                                              </div>
                                              <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">O que fazer:</span> {ps.fazer}</p>
                                              <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">O que deveria acontecer:</span> {ps.esperado}</p>
                                              {x && x.resultado !== "funcionou" && (
                                                <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">{x.resultado === "diferente" ? "O que o validador viu:" : "Por que não conseguiu testar:"}</span> {x.obs || "sem explicação"}</p>
                                              )}
                                              {x && x.resultado === "funcionou" && x.obs && <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">Comentário:</span> {x.obs}</p>}
                                              {x && <Anexos anexos={x.anexos} />}
                                            </li>
                                          );
                                        })}
                                      </ol>
                                    ) : (
                                      <>
                                        {r?.obs && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.obs}</p>}
                                        {r && <Anexos anexos={r.anexos} />}
                                      </>
                                    )}
                                    {r && (
                                      <Link href={`/admin/${id}/historico?item=${it.id}`} className={`inline-flex min-h-11 items-center text-xs text-indigo-800 underline ${FOCO}`}>
                                        Ver histórico
                                      </Link>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {removidas.length > 0 && (
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-900">Respostas de funcionalidades removidas</h3>
                      <p className="text-xs text-slate-700">Estas funcionalidades foram excluídas da tela depois de respondidas. As respostas continuam guardadas aqui.</p>
                      <ul className="mt-1 divide-y divide-slate-100">
                        {removidas.map((r) => (
                          <li key={r.item} className="py-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-sm font-medium">Funcionalidade removida</span>
                              <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO[r.resultado]}`}>{ROTULO_RESULTADO[r.resultado]}</span>
                            </div>
                            {r.obs && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{r.obs}</p>}
                            <Anexos anexos={r.anexos} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>
    </>
  );
}

function Anexos({ anexos }: { anexos: string[] }) {
  if (!anexos?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {anexos.map((u, k) => (
        <li key={u}>
          <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Print ${k + 1} anexado pelo cliente`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
