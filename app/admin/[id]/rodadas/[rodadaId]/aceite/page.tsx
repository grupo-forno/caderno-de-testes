import Link from "next/link";
import { notFound } from "next/navigation";
import AbasRodada from "@/components/AbasRodada";
import FormDecisao, { FormReabrir } from "@/components/FormDecisao";
import { exigirAdmin } from "@/lib/admin";
import { ROTULO_DECISAO, ROTULO_SITUACAO_ACEITE, type ItemAceite, type Ref } from "@/lib/aceiteRodada";
import { carregarAceite } from "@/lib/aceiteRodadaDb";
import { sql } from "@/lib/db";
import { dataHoraBR } from "@/lib/pendenciasDb";
import { registrarDecisao, reabrirRodada } from "../../../../aceite-rodada-actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const ERROS: Record<string, string> = {
  regra: "A decisão não atende às regras: confira a justificativa e os itens em aberto.",
  mudou: "Os resultados mudaram enquanto você decidia. Revise o resumo atualizado abaixo e registre de novo.",
  aprovada: "Esta rodada já está aprovada. Para decidir de novo, reabra a rodada primeiro.",
  naoaprovada: "A rodada não está aprovada, então não há o que reabrir.",
  motivo: "Escreva o motivo da reabertura (pelo menos 5 letras).",
  autor: "Escreva o seu nome: ele fica registrado.",
  token: "Não foi possível registrar. Recarregue a página e tente de novo.",
  rascunho: "A rodada ainda é um rascunho: não há o que decidir.",
};
const COR_SIT: Record<string, string> = {
  aguardando: "bg-slate-100 text-slate-900 ring-slate-300",
  aprovada: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  correcoes: "bg-amber-100 text-amber-950 ring-amber-300",
  reaberta: "bg-indigo-100 text-indigo-900 ring-indigo-300",
};

type Retrato = { contagens?: { porAtribuicao: Record<string, number>; porCenario: Record<string, number>; porPasso: Record<string, number> }; ressalvas?: ItemAceite[]; falhasResolvidas?: ItemAceite[]; builds?: string[]; pendenciasRelacionadas?: string[]; escopo?: { titulo: string; validadores: string[] }[]; ambiente?: string | null };

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas/[rodadaId]/aceite">) {
  await exigirAdmin();
  const { id, rodadaId } = await params;
  if (!ehUuid(id) || !ehUuid(rodadaId)) notFound();
  const sp = await searchParams;
  const [r] = await sql`select nome, versao, ambiente_url, situacao, publicada_em from rodadas where id = ${rodadaId} and caderno_id = ${id}`;
  if (!r) notFound();
  const base = `/admin/${id}/rodadas/${rodadaId}`;
  const ref = (x: Ref | null) => (!x ? null : x.tipo === "pendencia" ? `${base}/pendencias/${x.id}` : `${base}/previa?validador=${x.id}`);
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] : null;

  if (r.situacao !== "em_validacao") {
    return (
      <>
        <main className="mx-auto max-w-4xl px-4 py-8">
          <Link href={`/admin/${id}/rodadas`} className="text-sm text-indigo-800 hover:underline">← Rodadas</Link>
          <h1 className="mt-2 text-2xl font-semibold">{r.nome}</h1>
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-800">O aceite acontece depois que a rodada é publicada e os validadores enviam os resultados. Esta rodada ainda é um rascunho.</p>
        </main>
      </>
    );
  }

  const d = await carregarAceite(rodadaId);
  const s = d.resumo;
  const [{ n: abertas }] = await sql`select count(*)::int as n from pendencias where rodada_id = ${rodadaId} and situacao <> 'resolvida'`;
  const travada = d.situacao === "aprovada";
  const ultimo = d.ultimo as { tipo: string; autor: string; justificativa: string; versao: string; criado: string } | undefined;
  const ultimaDecisao = d.historico.find((h) => h.tipo !== "reabertura");
  const card = "mt-6 rounded-lg border border-slate-200 bg-white p-5 scroll-mt-4";

  const lista = (titulo: string, vazio: string, itens: ItemAceite[], id2: string, rotuloLink = "Ver evidência") => (
    <div className="mt-4">
      <h3 id={id2} className="text-sm font-semibold">{titulo} ({itens.length})</h3>
      {itens.length === 0 ? <p className="mt-1 text-sm text-slate-700">{vazio}</p> : (
        <ul aria-labelledby={id2} className="mt-1 space-y-2">
          {itens.map((i, k) => (
            <li key={k} className="rounded-md border border-slate-200 p-3 text-sm">
              <span className="font-semibold">{i.titulo}</span> <span className="text-slate-700">{i.detalhe}</span>{" "}
              {ref(i.ref) && <Link href={ref(i.ref)!} className={`font-medium text-indigo-800 underline ${FOCO}`}>{rotuloLink}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const c = (rot: string, v: Record<string, number>) => (
    <li className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold">{rot}</p>
      <p className="mt-1 text-sm tabular-nums">Total: {v.total}</p>
      <ul className="mt-1 space-y-0.5 text-sm tabular-nums">
        <li>Concluídas: {v.concluidas}</li><li>Com falhas: {v.comFalhas}</li><li>Bloqueadas: {v.bloqueadas}</li><li>Rascunho (não enviado): {v.rascunho}</li><li>Sem resposta: {v.semResposta}</li>
      </ul>
    </li>
  );
  const ps = s.porPasso;

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}/rodadas`} className="text-sm text-indigo-800 hover:underline">← Rodadas</Link>
        <h1 className="mt-2 text-2xl font-semibold">{r.nome} <span className="text-base font-normal text-slate-700">versão {r.versao}</span></h1>
        <AbasRodada cadernoId={id} rodadaId={rodadaId} ativa="aceite" abertas={abertas} situacaoAceite={ROTULO_SITUACAO_ACEITE[d.situacao]} />
        {sp.decisao && ultimo && ultimo.tipo !== "reabertura" && (
          <div role="status" className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-semibold">Decisão registrada: {ROTULO_DECISAO[ultimo.tipo as keyof typeof ROTULO_DECISAO]}.</p>
            <p className="mt-1">{ultimo.tipo === "correcoes" ? "Próxima ação: acompanhe as correções na aba Pendências. Quando o validador enviar os retestes, volte aqui para decidir de novo." : "A rodada está bloqueada para alterações. Se precisar continuar a validação, use “Reabrir rodada” mais abaixo."}</p>
          </div>
        )}
        {sp.reaberta && <p role="status" className="mt-3 rounded-md border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-950"><strong>Rodada reaberta.</strong> As respostas voltaram a poder mudar. Próxima ação: conclua a validação e registre uma nova decisão.</p>}
        {erro && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-900">{erro}</p>}

        <section aria-labelledby="t-entrega" className={card}>
          <h2 id="t-entrega" className="text-lg font-semibold">1. Entrega e escopo publicado</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium text-slate-700">Entrega</dt><dd>{r.nome}</dd>
            <dt className="font-medium text-slate-700">Versão</dt><dd>{r.versao}</dd>
            <dt className="font-medium text-slate-700">Ambiente</dt><dd>{r.ambiente_url ? <a href={r.ambiente_url} target="_blank" rel="noreferrer" className="text-indigo-800 underline">{r.ambiente_url}</a> : "Não informado"}</dd>
            <dt className="font-medium text-slate-700">Publicada em</dt><dd>{r.publicada_em ? dataHoraBR(r.publicada_em) : "—"}</dd>
            <dt className="font-medium text-slate-700">Builds em reteste</dt><dd>{s.builds.length ? s.builds.join(", ") : "Nenhum reteste concluído com sucesso ainda."}</dd>
          </dl>
          <h3 className="mt-3 text-sm font-semibold">Cenários do escopo (todos obrigatórios)</h3>
          <ul className="mt-1 list-disc pl-5 text-sm">{d.escopo.map((e) => <li key={e.titulo}>{e.titulo} <span className="text-slate-700">· {e.validadores.join(", ")}</span></li>)}</ul>
          <p className="mt-2 text-xs text-slate-600">Neste módulo todas as atribuições publicadas contam como obrigatórias.</p>
        </section>

        <section aria-labelledby="t-resumo" className={card}>
          <h2 id="t-resumo" className="text-lg font-semibold">2. Resumo dos resultados</h2>
          <p className="mt-1 text-sm text-slate-700">Contagens por atribuição (um cenário executado por uma pessoa), por cenário (vale o pior estado entre as pessoas) e por passo. Resultado salvo e ainda não enviado é rascunho e não conta como concluído.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="Contagens">
            {c("Por atribuição", s.porAtribuicao)}
            {c("Por cenário", s.porCenario)}
          </ul>
          <p className="mt-3 text-sm tabular-nums"><strong>Por passo:</strong> {ps.total} no total · {ps.funcionou} funcionaram · {ps.falhasResolvidas} falhas resolvidas em reteste · {ps.falhasAbertas} falhas em aberto · {ps.bloqueados} bloqueados · {ps.semResposta} sem resposta ou sem envio</p>
        </section>

        <section aria-labelledby="t-itens" className={card}>
          <h2 id="t-itens" className="text-lg font-semibold">3. O que ainda está em aberto</h2>
          {lista("Pendências abertas", "Nenhuma pendência aberta.", s.pendenciasAbertas, "t-pa", "Ver pendência e evidência original")}
          {lista("Retestes em andamento", "Nenhum reteste esperando resposta.", s.retestesEmAndamento, "t-ra", "Ver pendência")}
          {lista("Falhas resolvidas em reteste", "Nenhuma falha resolvida ainda.", s.falhasResolvidas, "t-fr", "Ver pendência e tentativas")}
          {lista("Bloqueios (passos que não puderam ser testados)", "Nenhum bloqueio.", s.bloqueios, "t-bl", "Ver resultado do validador")}
          {lista("Lacunas de cobertura (testes não enviados)", "Todos os testes foram enviados.", s.lacunas, "t-lc", "Ver o que foi salvo")}
        </section>

        <section aria-labelledby="t-atual" className={card}>
          <h2 id="t-atual" className="text-lg font-semibold">4. Decisão atual</h2>
          <p className="mt-2"><span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${COR_SIT[d.situacao]}`}>{ROTULO_SITUACAO_ACEITE[d.situacao]}</span></p>
          {d.situacao === "aguardando" ? (
            <p className="mt-2 text-sm text-slate-800">Ninguém decidiu ainda. Quem tem acesso à área interna pode registrar a decisão no bloco abaixo. O validador só envia resultados: ele não decide.</p>
          ) : ultimaDecisao ? (
            <p className="mt-2 text-sm text-slate-800">
              Última decisão: <strong>{ROTULO_DECISAO[ultimaDecisao.tipo as keyof typeof ROTULO_DECISAO]}</strong> por {ultimaDecisao.autor} em {dataHoraBR(ultimaDecisao.criado)} (versão {ultimaDecisao.versao}).
              {ultimaDecisao.justificativa && <span className="block whitespace-pre-wrap">Justificativa: {ultimaDecisao.justificativa}</span>}
              {d.situacao === "reaberta" && <span className="block font-medium">Depois disso a rodada foi reaberta e aguarda nova decisão.</span>}
            </p>
          ) : null}
        </section>

        <section id="decisao" aria-labelledby="t-reg" className={card}>
          {travada ? (
            <>
              <h2 id="t-reg" className="text-lg font-semibold">5. Reabrir rodada</h2>
              <p className="mt-1 text-sm text-slate-700">A rodada está aprovada e as respostas estão bloqueadas. Para continuar a validação, reabra com um motivo. O aceite atual continua no histórico.</p>
              <FormReabrir acao={reabrirRodada.bind(null, id, rodadaId)} chaveRascunho={`reabrir-${rodadaId}`} limpar={!!sp.reaberta} />
            </>
          ) : (
            <>
              <h2 id="t-reg" className="text-lg font-semibold">5. Registrar decisão</h2>
              <p className="mt-1 text-sm text-slate-700">Quem registra a decisão é o responsável pelo aceite, mesmo que seja a mesma pessoa que também validou. Você revisa tudo antes de confirmar.</p>
              <FormDecisao
                acao={registrarDecisao.bind(null, id, rodadaId)}
                chaveRascunho={`decisao-${rodadaId}`}
                limparRascunho={!!sp.decisao}
                versao={r.versao}
                impressao={d.impressao}
                podeAprovar={s.podeAprovar}
                impedimentos={s.impedimentos.map((i) => ({ texto: i.texto, href: ref(i.ref) }))}
                ressalvas={s.ressalvas.map((x) => ({ titulo: x.titulo, detalhe: x.detalhe, href: ref(x.ref) }))}
                pendencias={s.pendenciasAbertas.map((x) => ({ id: x.ref.id, titulo: x.titulo }))}
                cobertura={[`${s.porAtribuicao.concluidas} de ${s.porAtribuicao.total} atribuições concluídas`, `${s.porAtribuicao.comFalhas} com falhas`, `${s.porAtribuicao.bloqueadas} bloqueadas`, `${s.porAtribuicao.rascunho + s.porAtribuicao.semResposta} sem envio`]}
              />
            </>
          )}
        </section>

        <section aria-labelledby="t-hist" className={card}>
          <h2 id="t-hist" className="text-lg font-semibold">6. Histórico de decisões</h2>
          <p className="mt-1 text-xs text-slate-600">Só cresce. Cada decisão guarda o resumo daquele momento e não muda com o que acontece depois.</p>
          {d.historico.length === 0 ? <p className="mt-2 text-sm text-slate-800">Nenhuma decisão ou reabertura registrada ainda.</p> : (
            <ol className="mt-3 space-y-3">
              {d.historico.map((h) => {
                const rt = (h.retrato ?? {}) as Retrato;
                return (
                  <li key={h.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                    <p className="font-semibold">{ROTULO_DECISAO[h.tipo as keyof typeof ROTULO_DECISAO]}{h.versao ? ` · versão ${h.versao}` : ""}</p>
                    <p className="text-xs text-slate-700"><time dateTime={new Date(h.criado).toISOString()}>{dataHoraBR(h.criado)}</time> · {h.autor}</p>
                    {h.justificativa && <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">{h.tipo === "reabertura" ? "Motivo:" : "Justificativa:"}</span> {h.justificativa}</p>}
                    {h.tipo !== "reabertura" && rt.contagens && (
                      <details className="mt-2 rounded-md border border-slate-200">
                        <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 font-medium ${FOCO}`}>Ver o resumo registrado nesta decisão</summary>
                        <div className="space-y-2 border-t border-slate-200 p-3">
                          <p className="tabular-nums">Atribuições: {rt.contagens.porAtribuicao.concluidas} concluídas, {rt.contagens.porAtribuicao.comFalhas} com falhas, {rt.contagens.porAtribuicao.bloqueadas} bloqueadas, {rt.contagens.porAtribuicao.rascunho + rt.contagens.porAtribuicao.semResposta} sem envio (de {rt.contagens.porAtribuicao.total}).</p>
                          <p className="tabular-nums">Passos: {rt.contagens.porPasso.funcionou} funcionaram, {rt.contagens.porPasso.falhasResolvidas} falhas resolvidas, {rt.contagens.porPasso.falhasAbertas} falhas em aberto, {rt.contagens.porPasso.bloqueados} bloqueados.</p>
                          {rt.builds && rt.builds.length > 0 && <p>Builds conferidos em reteste: {rt.builds.join(", ")}.</p>}
                          {rt.ressalvas && rt.ressalvas.length > 0 && (<div><p className="font-medium">Ressalvas e itens em aberto na época ({rt.ressalvas.length}):</p><ul className="list-disc pl-5">{rt.ressalvas.map((x, k) => <li key={k}>{x.titulo}. {x.detalhe}</li>)}</ul></div>)}
                          {rt.pendenciasRelacionadas && rt.pendenciasRelacionadas.length > 0 && (<p>Pendências relacionadas: {rt.pendenciasRelacionadas.map((p, k) => <span key={p}>{k > 0 && ", "}<Link href={`${base}/pendencias/${p}`} className="text-indigo-800 underline">pendência {k + 1}</Link></span>)}.</p>)}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
