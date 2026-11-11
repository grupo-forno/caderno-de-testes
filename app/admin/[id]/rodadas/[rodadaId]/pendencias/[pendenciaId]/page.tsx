import Link from "next/link";
import BotaoEnviar from "@/components/BotaoEnviar";
import { notFound } from "next/navigation";
import AbasRodada from "@/components/AbasRodada";
import { btn, campo } from "@/components/estilos";
import { Confirmar } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { COR_RESULTADO, ROTULO_RESULTADO } from "@/lib/formatar";
import { COR_PENDENCIA, podeSolicitarReteste, ROTULO_PENDENCIA, type SituacaoPendencia } from "@/lib/pendencias";
import { dataHoraBR } from "@/lib/pendenciasDb";
import type { CenarioSnap } from "@/lib/rodadas";
import { atribuirPendencia, iniciarCorrecao, registrarCorrecao, solicitarReteste, vincularIssue } from "../../../../../pendencia-actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const TIPO_EVENTO: Record<string, string> = {
  aberta: "Falha registrada pelo validador",
  atribuida: "Responsável definido",
  em_correcao: "Correção iniciada",
  correcao: "Correção registrada",
  issue: "Issue externa",
  reteste_solicitado: "Reteste solicitado",
  reteste_enviado: "Reteste enviado pelo validador",
  reaberta: "Voltou para Aberta (a falha continua)",
  resolvida: "Resolvida no reteste",
  bloqueada: "Reteste bloqueado (sem nova falha)",
};
const ERROS: Record<string, string> = {
  nota: "Escreva o que foi feito para corrigir.",
  corrigido: "Diga o que foi corrigido.",
  versao: "Informe em qual versão ou build a correção está.",
  issue: "O endereço da issue precisa começar com https:// (ou http://).",
  resolvida: "Esta pendência já está resolvida.",
  aprovada: "A rodada está aprovada e bloqueada. Para pedir um novo reteste, reabra a rodada na aba Aceite.",
  pendencia: "Não foi possível concluir. Recarregue a página e tente de novo.",
};

function Anexos({ anexos }: { anexos: string[] }) {
  if (!anexos?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {anexos.map((u, k) => (
        <li key={u}>
          <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Print ${k + 1}`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas/[rodadaId]/pendencias/[pendenciaId]">) {
  await exigirAdmin();
  const { id, rodadaId, pendenciaId } = await params;
  if (![id, rodadaId, pendenciaId].every(ehUuid)) notFound();
  const sp = await searchParams;
  const [p] = await sql`
    select p.*, r.nome as rodada, r.versao as rodada_versao, r.ambiente_url, rc.snapshot, v.nome as validador, v.email
    from pendencias p join rodadas r on r.id = p.rodada_id join rodada_atribuicoes a on a.id = p.atribuicao_id
    join rodada_cenarios rc on rc.id = a.rodada_cenario_id join rodada_validadores v on v.id = a.validador_id
    where p.id = ${pendenciaId} and p.rodada_id = ${rodadaId} and r.caderno_id = ${id}`;
  if (!p) notFound();
  const snap = p.snapshot as CenarioSnap;
  const i = snap.passos.findIndex((x) => x.id === p.passo);
  const passo = snap.passos[i];
  const [original] = await sql`select resultado, obs, anexos, atualizado from respostas_atribuicao where atribuicao_id = ${p.atribuicao_id} and passo = ${p.passo}`;
  const retestes = await sql`select * from pendencia_retestes where pendencia_id = ${pendenciaId} order by numero`;
  const respReteste = retestes.length ? await sql`select x.reteste_id, x.passo, x.resultado, x.obs, x.anexos from respostas_reteste x join pendencia_retestes t on t.id = x.reteste_id where t.pendencia_id = ${pendenciaId}` : [];
  const eventos = await sql`select tipo, autor, obs, dados, criado from pendencia_eventos where pendencia_id = ${pendenciaId} order by criado, id`;
  const [{ n: paraTratar }] = await sql`select count(*)::int as n from pendencias where rodada_id = ${rodadaId} and situacao <> 'resolvida'`;
  const situacao = p.situacao as SituacaoPendencia;
  const pedidoAberto = retestes.find((t) => t.status === "solicitado");
  const base = `/admin/${id}/rodadas/${rodadaId}`;
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] : null;
  const card = "mt-6 rounded-lg border border-slate-200 bg-white p-5 scroll-mt-4";

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`${base}/pendencias`} className="text-sm text-brand-800 hover:underline">← Pendências da rodada</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold">{snap.titulo} · passo {i + 1}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_PENDENCIA[situacao]}`}>{ROTULO_PENDENCIA[situacao]}</span>
        </div>
        <AbasRodada cadernoId={id} rodadaId={rodadaId} ativa="pendencias" abertas={paraTratar} />
        {sp.salvo && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Salvo.</p>}
        {erro && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">{erro}</p>}

        <section aria-labelledby="t-ctx" className={card}>
          <h2 id="t-ctx" className="font-semibold">Contexto</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium text-slate-700">Rodada</dt><dd>{p.rodada} · versão {p.rodada_versao}</dd>
            <dt className="font-medium text-slate-700">Ambiente</dt><dd>{p.ambiente_url ? <a href={p.ambiente_url} target="_blank" rel="noreferrer" className="text-brand-800 underline">{p.ambiente_url}</a> : "Não informado"}</dd>
            <dt className="font-medium text-slate-700">Cenário</dt><dd>{snap.titulo}</dd>
            <dt className="font-medium text-slate-700">Passo</dt><dd>{i + 1} de {snap.passos.length}{passo?.tela ? ` · ${passo.tela.modulo} › ${passo.tela.titulo}` : ""}{passo?.perfil ? ` · perfil ${passo.perfil}` : ""}</dd>
            <dt className="font-medium text-slate-700">Validador</dt><dd>{p.validador} ({p.email})</dd>
          </dl>
        </section>

        <section aria-labelledby="t-falha" className={card}>
          <h2 id="t-falha" className="font-semibold">A falha (tentativa 1)</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm"><span className="font-medium">O que foi feito:</span> {passo?.fazer}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm"><span className="font-medium">O que era esperado:</span> {passo?.esperado}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm"><span className="font-medium">O que aconteceu:</span> {original?.obs || "sem relato"}</p>
          <Anexos anexos={original?.anexos ?? []} />
          <p className="mt-2 text-xs text-slate-700">Roteiro publicado da rodada: não muda, mesmo que o cenário da biblioteca seja editado.</p>
        </section>

        <section aria-labelledby="t-gestao" className={card}>
          <h2 id="t-gestao" className="font-semibold">Correção</h2>
          <form action={atribuirPendencia.bind(null, id, rodadaId, pendenciaId)} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium">Responsável pela correção
              <input name="responsavel" defaultValue={p.responsavel} maxLength={120} placeholder="Nome de quem vai corrigir" className={campo + " min-h-11"} />
            </label>
            <BotaoEnviar variante="secundario">Salvar responsável</BotaoEnviar>
          </form>
          {situacao === "aberta" && (
            <form action={iniciarCorrecao.bind(null, id, rodadaId, pendenciaId)} className="mt-3"><BotaoEnviar variante="secundario">Marcar como “Em correção”</BotaoEnviar></form>
          )}
          {situacao !== "resolvida" && (
            <form id="correcao" action={registrarCorrecao.bind(null, id, rodadaId, pendenciaId)} className="mt-4 scroll-mt-4">
              <label className="block text-sm font-medium">Registrar o ajuste feito
                <textarea name="nota" rows={3} required maxLength={3000} placeholder="Ex.: corrigida a validação do campo valor" className={campo + " field-sizing-content"} />
              </label>
              <BotaoEnviar variante="secundario" className="mt-2">Registrar correção</BotaoEnviar>
            </form>
          )}
          <form id="issue" action={vincularIssue.bind(null, id, rodadaId, pendenciaId)} className="mt-4 flex flex-wrap items-end gap-2 scroll-mt-4">
            <label className="min-w-0 flex-1 text-sm font-medium">Issue externa (opcional)
              <input name="issue_url" type="url" defaultValue={p.issue_url ?? ""} placeholder="https://" className={campo + " min-h-11"} />
              <span className="mt-1 block text-xs font-normal text-slate-600">Só guarda o link. Não há integração com outras ferramentas.</span>
            </label>
            <BotaoEnviar variante="secundario">Salvar link</BotaoEnviar>
          </form>
          {p.issue_url && <p className="mt-2 text-sm"><a href={p.issue_url} target="_blank" rel="noreferrer" className="text-brand-800 underline">Abrir issue<span className="sr-only"> (abre em nova aba)</span></a></p>}
        </section>

        <section id="reteste" aria-labelledby="t-reteste" className={card}>
          <h2 id="t-reteste" className="font-semibold">Reteste</h2>
          {situacao === "resolvida" ? (
            <p className="mt-2 text-sm text-slate-800">Esta pendência foi resolvida no reteste. Não há mais nada a pedir.</p>
          ) : pedidoAberto ? (
            <p role="status" className="mt-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-950">O reteste {pedidoAberto.numero} está esperando {p.validador} (pedido em {dataHoraBR(pedidoAberto.solicitado_em)}, versão {pedidoAberto.versao}). Quando ele enviar, o resultado aparece aqui.</p>
          ) : podeSolicitarReteste(situacao, false) ? (
            <form action={solicitarReteste.bind(null, id, rodadaId, pendenciaId)} className="mt-2">
              <p className="text-sm text-slate-700">{retestes.length ? "Peça uma nova tentativa depois de resolver o impedimento ou a falha." : "Depois de corrigir, peça ao validador para refazer o passo."}</p>
              <label className="mt-3 block text-sm font-medium">O que foi corrigido <span className="font-normal text-slate-600">(obrigatório)</span>
                <textarea name="corrigido" rows={3} required maxLength={3000} className={campo + " field-sizing-content"} />
              </label>
              <label className="mt-3 block text-sm font-medium">Em qual versão ou build <span className="font-normal text-slate-600">(obrigatório)</span>
                <input name="versao" required maxLength={120} placeholder="Ex.: 2.4.1 ou build 318" className={campo + " min-h-11"} />
              </label>
              <fieldset className="mt-3">
                <legend className="text-sm font-medium">Passos que o validador vai refazer</legend>
                <p className="text-xs text-slate-600">O passo que falhou já vem marcado. Inclua outros passos do cenário se forem necessários para preparar ou confirmar o teste.</p>
                <ul className="mt-2 space-y-1">
                  {snap.passos.map((s, n) => (
                    <li key={s.id}>
                      <label className="flex min-h-11 items-start gap-3 rounded-md border border-slate-200 p-2 text-sm">
                        {s.id === p.passo ? (
                          <>
                            <input type="checkbox" checked disabled className="mt-1 h-5 w-5" aria-label={`Passo ${n + 1}, o que falhou, sempre incluído`} />
                            <input type="hidden" name="passo" value={s.id} />
                          </>
                        ) : (
                          <input type="checkbox" name="passo" value={s.id} className="mt-1 h-5 w-5" />
                        )}
                        <span><strong>Passo {n + 1}</strong>{s.id === p.passo && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-900">Falhou</span>}<span className="block whitespace-pre-wrap text-slate-700">{s.fazer}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <Confirmar texto="Solicitar o reteste agora? O validador vai encontrar o pedido em “Meus testes”." className={btn + " mt-3 min-h-11"}>Solicitar reteste</Confirmar>
            </form>
          ) : null}
        </section>

        <section aria-labelledby="t-tent" className={card}>
          <h2 id="t-tent" className="font-semibold">Tentativas</h2>
          <ol className="mt-3 space-y-4">
            <li className="rounded-lg border border-slate-200 p-4 text-sm">
              <p className="font-semibold">Tentativa 1 · envio original <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO.diferente}`}>{ROTULO_RESULTADO.diferente}</span></p>
              <p className="mt-1 whitespace-pre-wrap">{original?.obs || "sem relato"}</p>
              <Anexos anexos={original?.anexos ?? []} />
            </li>
            {retestes.map((t) => {
              const respostas = respReteste.filter((x) => x.reteste_id === t.id);
              return (
                <li key={t.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">Tentativa {t.numero + 1} · reteste {t.numero} · versão {t.versao}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${t.status === "solicitado" ? "bg-brand-100 text-brand-900 ring-brand-300" : t.resultado === "resolvida" ? COR_PENDENCIA.resolvida : t.resultado === "falhou" ? COR_PENDENCIA.aberta : COR_PENDENCIA.em_correcao}`}>
                      {t.status === "solicitado" ? "Aguardando o validador" : t.resultado === "resolvida" ? "Funcionou" : t.resultado === "falhou" ? "Falhou de novo" : "Bloqueado"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">Pedido por {t.solicitado_por} em {dataHoraBR(t.solicitado_em)}{t.enviado_em ? ` · enviado em ${dataHoraBR(t.enviado_em)}` : ""}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">O que foi corrigido:</span> {t.corrigido}</p>
                  <ol className="mt-3 space-y-2">
                    {(t.passos as string[]).map((pid) => {
                      const n = snap.passos.findIndex((s) => s.id === pid);
                      const x = respostas.find((r) => r.passo === pid);
                      return (
                        <li key={pid} className={`rounded-md border p-3 ${x?.resultado === "diferente" ? "border-rose-300 bg-rose-50" : x?.resultado === "nao_consegui" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                          <p className="flex flex-wrap items-center gap-2"><strong>Passo {n + 1}</strong>
                            {x ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_RESULTADO[x.resultado]}`}>{ROTULO_RESULTADO[x.resultado]}</span> : <span className="text-xs font-semibold text-slate-700">Sem resposta</span>}
                          </p>
                          <p className="whitespace-pre-wrap text-slate-700">{snap.passos[n]?.fazer}</p>
                          {x?.obs && <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">{x.resultado === "nao_consegui" ? "Motivo do bloqueio:" : "Relato:"}</span> {x.obs}</p>}
                          {x && <Anexos anexos={x.anexos} />}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="t-hist" className={card}>
          <h2 id="t-hist" className="font-semibold">Histórico</h2>
          <p className="mt-1 text-xs text-slate-600">Só cresce: nada é apagado nem editado.</p>
          <ol className="mt-3 space-y-3">
            {eventos.map((e, k) => {
              const d = (e.dados ?? {}) as { versao?: string; numero?: number };
              return (
                <li key={k} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p><time dateTime={new Date(e.criado).toISOString()} className="text-slate-700">{dataHoraBR(e.criado)}</time> · <strong>{e.autor}</strong> · {TIPO_EVENTO[e.tipo] ?? e.tipo}{d.numero ? ` (reteste ${d.numero}${d.versao ? `, versão ${d.versao}` : ""})` : ""}</p>
                  {e.obs && <p className="mt-1 whitespace-pre-wrap text-slate-800">{e.obs}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </>
  );
}
