import Link from "next/link";
import { notFound } from "next/navigation";
import AbasRodada from "@/components/AbasRodada";
import { btn2, campo } from "@/components/estilos";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { COR_PENDENCIA, ROTULO_PENDENCIA, SITUACOES, type SituacaoPendencia } from "@/lib/pendencias";
import { dataHoraBR, listarBloqueios, listarPendencias } from "@/lib/pendenciasDb";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas/[rodadaId]/pendencias">) {
  await exigirAdmin();
  const { id, rodadaId } = await params;
  if (!ehUuid(id) || !ehUuid(rodadaId)) notFound();
  const sp = await searchParams;
  const [r] = await sql`select nome, versao, situacao from rodadas where id = ${rodadaId} and caderno_id = ${id}`;
  if (!r) notFound();
  const todas = r.situacao === "em_validacao" ? await listarPendencias(rodadaId) : [];
  const bloqueios = r.situacao === "em_validacao" ? await listarBloqueios(rodadaId) : [];

  const fModulo = um(sp.modulo);
  const fCenario = um(sp.cenario);
  const fResp = um(sp.responsavel);
  const fSit = SITUACOES.includes(um(sp.situacao) as SituacaoPendencia) ? um(sp.situacao) : um(sp.situacao) === "tratar" || !sp.situacao ? "tratar" : "todas";
  const modulos = [...new Set(todas.map((p) => p.modulo))].sort();
  const cenarios = [...new Set(todas.map((p) => p.cenario))].sort();
  const responsaveis = [...new Set(todas.map((p) => p.responsavel).filter(Boolean))].sort();
  const lista = todas.filter(
    (p) =>
      (fSit === "todas" || (fSit === "tratar" ? p.situacao !== "resolvida" : p.situacao === fSit)) &&
      (!fModulo || p.modulo === fModulo) &&
      (!fCenario || p.cenario === fCenario) &&
      (!fResp || (fResp === "_nenhum" ? !p.responsavel : p.responsavel === fResp)),
  );
  const filtrando = !!(fModulo || fCenario || fResp || (sp.situacao && fSit !== "tratar"));
  const paraTratar = todas.filter((p) => p.situacao !== "resolvida").length;
  const base = `/admin/${id}/rodadas/${rodadaId}`;

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}/rodadas`} className="text-sm text-indigo-800 hover:underline">← Rodadas</Link>
        <h1 className="mt-2 text-2xl font-semibold">{r.nome} <span className="text-base font-normal text-slate-700">versão {r.versao}</span></h1>
        {r.situacao === "em_validacao" && <AbasRodada cadernoId={id} rodadaId={rodadaId} ativa="pendencias" abertas={paraTratar} />}
        {sp.erro === "pendencia" && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Essa pendência não existe mais. Confira a lista abaixo.</p>}

        {r.situacao !== "em_validacao" ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-800">As pendências aparecem depois que a rodada é publicada e os validadores enviam resultados. Esta rodada ainda é um rascunho.</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-700">Cada falha (“Deu diferente”) enviada por um validador vira uma pendência. Atribua, registre a correção e peça o reteste.</p>
            <form method="get" role="search" aria-label="Filtrar pendências" className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-medium">Situação
                <select name="situacao" defaultValue={fSit} className={campo + " min-h-11"}>
                  <option value="tratar">Para tratar (não resolvidas)</option>
                  <option value="todas">Todas</option>
                  {SITUACOES.map((s) => <option key={s} value={s}>{ROTULO_PENDENCIA[s]}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Módulo
                <select name="modulo" defaultValue={fModulo} className={campo + " min-h-11"}><option value="">Todos</option>{modulos.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
              <label className="block text-sm font-medium">Cenário
                <select name="cenario" defaultValue={fCenario} className={campo + " min-h-11"}><option value="">Todos</option>{cenarios.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
              <label className="block text-sm font-medium">Responsável
                <select name="responsavel" defaultValue={fResp} className={campo + " min-h-11"}><option value="">Todos</option><option value="_nenhum">Sem responsável</option>{responsaveis.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <button className={btn2 + " min-h-11"}>Filtrar</button>
                {filtrando && <Link href={`${base}/pendencias`} className={`inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`}>Limpar filtros</Link>}
              </div>
            </form>

            <p role="status" className="mt-4 text-sm text-slate-700">{lista.length === 1 ? "1 pendência" : `${lista.length} pendências`}{filtrando || fSit !== "tratar" ? " com estes filtros" : " para tratar"}.</p>
            {lista.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-800">
                {todas.length === 0 ? <><p className="font-semibold">Nenhuma pendência até agora.</p><p className="mt-1">Quando um validador enviar um passo como “Deu diferente”, ele aparece aqui.</p></> : <p>Nenhuma pendência com estes filtros. Tire algum filtro ou veja “Todas”.</p>}
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {lista.map((p) => (
                  <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="min-w-0 break-words text-base font-semibold">
                        <Link href={`${base}/pendencias/${p.id}`} className={`rounded text-indigo-900 hover:underline ${FOCO}`}>{p.cenario} · passo {p.n}</Link>
                      </h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_PENDENCIA[p.situacao]}`}>{ROTULO_PENDENCIA[p.situacao]}</span>
                    </div>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                      <dt className="font-medium text-slate-700">Módulo</dt><dd>{p.modulo}</dd>
                      <dt className="font-medium text-slate-700">Validador</dt><dd>{p.validador}</dd>
                      <dt className="font-medium text-slate-700">Responsável</dt><dd>{p.responsavel || <span className="text-rose-800">Ninguém atribuído</span>}</dd>
                      <dt className="font-medium text-slate-700">Registrada em</dt><dd>{dataHoraBR(p.criado)}</dd>
                    </dl>
                    <Link href={`${base}/pendencias/${p.id}`} className={btn2 + " mt-3 inline-flex min-h-11 items-center"}>Abrir pendência<span className="sr-only"> de {p.cenario}, passo {p.n}</span></Link>
                  </li>
                ))}
              </ul>
            )}

            <section aria-labelledby="t-bloq" className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-5">
              <h2 id="t-bloq" className="font-semibold text-amber-950">Impedimentos: passos bloqueados ({bloqueios.length})</h2>
              <p className="mt-1 text-sm text-amber-950">Passos que o validador não conseguiu testar. Não são defeitos: resolva o impedimento (acesso, dado, ambiente) e peça nova tentativa, se for o caso.</p>
              {bloqueios.length === 0 ? <p className="mt-2 text-sm text-amber-950">Nenhum bloqueio enviado.</p> : (
                <ul className="mt-3 space-y-2">
                  {bloqueios.map((b, i) => (
                    <li key={i} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                      <p className="font-semibold">{b.cenario} · passo {b.n} <span className="font-normal text-slate-700">({b.modulo})</span></p>
                      <p className="text-xs text-slate-700">{b.validador} · {b.origem}{b.pendencia && <> · <Link href={`${base}/pendencias/${b.pendencia}`} className="font-medium text-indigo-800 underline">Ver pendência</Link></>}</p>
                      <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">Motivo:</span> {b.obs || "sem explicação"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
