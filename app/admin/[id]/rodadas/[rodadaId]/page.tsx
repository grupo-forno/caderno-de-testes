import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AbasRodada from "@/components/AbasRodada";
import { btn, btn2, campo } from "@/components/estilos";
import SelecaoCenarios from "@/components/SelecaoCenarios";
import { Confirmar, CopiarLink } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { contextoDoCenario, ROTULO_TIPO, type PassoCenario } from "@/lib/cenarios";
import { tokenDoValidador } from "@/lib/convite";
import { sql } from "@/lib/db";
import { dataHora } from "@/lib/formatar";
import { conferirPublicacao, ROTULO_ESTADO_ATRIBUICAO, ROTULO_SITUACAO, somar } from "@/lib/rodadas";
import { acompanhar } from "@/lib/rodadasDb";
import { adicionarValidador, novaRodadaAPartirDe, novoLinkDeConvite, publicarRodada, removerValidador, salvarAtribuicoes, salvarCenariosDaRodada, salvarDadosRodada } from "../../../rodada-actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const dia = (d: string | null) => (d ? d.split("-").reverse().join("/") : "Sem prazo");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const COR_ESTADO = { sem_resposta: "bg-white text-slate-800 ring-slate-400", em_andamento: "bg-amber-100 text-amber-950 ring-amber-300", enviado: "bg-indigo-100 text-indigo-900 ring-indigo-300" } as const;

const ERROS: Record<string, string> = {
  nome: "Escreva o nome da entrega.",
  ambiente: "O endereço do ambiente precisa começar com https:// (ou http://).",
  prazo: "O prazo não está numa data válida.",
  val_nome: "Escreva o nome do validador.",
  val_email: "O e-mail do validador não parece certo. Confira e tente de novo.",
  val_repetido: "Já existe um validador com esse e-mail nesta rodada.",
  publicada: "Esta rodada já foi publicada e não pode mais ser alterada. Use “Preparar nova rodada a partir desta”.",
  impedimentos: "Ainda há itens que impedem a publicação. Resolva a lista abaixo.",
};

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas/[rodadaId]">) {
  await exigirAdmin();
  const { id, rodadaId } = await params;
  if (!ehUuid(id) || !ehUuid(rodadaId)) notFound();
  const sp = await searchParams;
  const [r] = await sql`select *, prazo::text as prazo_txt from rodadas where id = ${rodadaId} and caderno_id = ${id}`;
  if (!r) notFound();
  const [cad] = await sql`select titulo from cadernos where id = ${id}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origem = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : "";
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] : null;
  const aqui = `/admin/${id}/rodadas/${rodadaId}`;

  const topo = (
    <>
      <Link href={`/admin/${id}/rodadas`} className="text-sm text-indigo-800 hover:underline">← Rodadas</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold">{r.nome}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${r.situacao === "rascunho" ? "bg-slate-100 text-slate-800 ring-slate-300" : "bg-indigo-100 text-indigo-900 ring-indigo-300"}`}>{ROTULO_SITUACAO[r.situacao as "rascunho" | "em_validacao"]}</span>
      </div>
      <p className="text-sm text-slate-700">{cad.titulo} · versão {r.versao}{r.publicada_em ? ` · publicada em ${dataHora(r.publicada_em)}` : ""}</p>
      {sp.salvo && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Salvo.</p>}
      {sp.publicada && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Rodada publicada. Copie o link de acesso de cada validador abaixo e envie para ele.</p>}
      {sp.nova && <p role="status" className="mt-3 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">Nova rodada preparada a partir de “{r.nome.replace(/ \(nova\)$/, "")}”, com os mesmos cenários, validadores e atribuições. Ajuste e publique.</p>}
      {erro && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">{erro}</p>}
    </>
  );

  // =============== RODADA PUBLICADA: acompanhamento ===============
  if (r.situacao === "em_validacao") {
    const a = await acompanhar(rodadaId);
    const geral = somar(a.atribuicoes.map((x) => x.prog));
    const nAtrib = { sem_resposta: 0, em_andamento: 0, enviado: 0 };
    for (const x of a.atribuicoes) nAtrib[x.prog.estado]++;
    return (
      <>
        <main className="mx-auto max-w-4xl px-4 py-8">
          {topo}
          <AbasRodada cadernoId={id} rodadaId={rodadaId} ativa="geral" abertas={(await sql`select count(*)::int as n from pendencias where rodada_id = ${rodadaId} and situacao <> 'resolvida'`)[0].n} />
          {sp.novolink && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Novo link gerado. O anterior deixou de funcionar. Copie o link atualizado na lista de validadores.</p>}

          <section aria-labelledby="t-entrega" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-entrega" className="font-semibold">Entrega</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-slate-700">Versão</dt><dd>{r.versao}</dd>
              <dt className="font-medium text-slate-700">Ambiente</dt><dd>{r.ambiente_url ? <a href={r.ambiente_url} target="_blank" rel="noreferrer" className="text-indigo-800 underline">{r.ambiente_url}</a> : "Não informado"}</dd>
              <dt className="font-medium text-slate-700">Prazo</dt><dd>{dia(r.prazo_txt)}</dd>
            </dl>
            <details className="mt-3 rounded-md border border-slate-200">
              <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Mudar prazo ou endereço do ambiente</summary>
              <form action={salvarDadosRodada.bind(null, id, rodadaId)} className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">Endereço do ambiente<input name="ambiente_url" type="url" defaultValue={r.ambiente_url ?? ""} className={campo} /></label>
                <label className="block text-sm font-medium">Prazo<input name="prazo" type="date" defaultValue={r.prazo_txt ?? ""} className={campo} /></label>
                <div className="sm:col-span-2"><button className={btn2 + " min-h-11"}>Salvar</button></div>
              </form>
            </details>
          </section>

          <section aria-labelledby="t-prog" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-prog" className="font-semibold">Progresso</h2>
            <p className="mt-1 text-sm text-slate-700">Testes atribuídos: <strong>{a.atribuicoes.length}</strong>. O estado do envio e o resultado dos passos são separados.</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3" aria-label="Testes por estado">
              {(["sem_resposta", "em_andamento", "enviado"] as const).map((e) => (
                <li key={e} className="rounded-lg border border-slate-200 p-3"><p className="text-2xl font-semibold tabular-nums">{nAtrib[e]}</p><p className="text-sm">{ROTULO_ESTADO_ATRIBUICAO[e]}</p></li>
              ))}
            </ul>
            <ul className="mt-3 grid gap-3 sm:grid-cols-4" aria-label="Passos por resultado">
              {([["Funcionou", geral.funcionou, "text-emerald-800"], ["Deu diferente", geral.diferente, "text-rose-800"], ["Bloqueado", geral.bloqueado, "text-amber-900"], ["Sem resposta", geral.semResposta, "text-slate-800"]] as const).map(([t, n, cor]) => (
                <li key={t} className="rounded-lg border border-slate-200 p-3"><p className={`text-2xl font-semibold tabular-nums ${cor}`}>{n}</p><p className="text-sm">{t}</p></li>
              ))}
            </ul>
          </section>

          <section id="secao-acesso" aria-labelledby="t-pessoas" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-pessoas" className="font-semibold">Validadores e links de acesso</h2>
            <p className="mt-1 text-sm text-slate-700">Cada validador tem um link próprio e só vê os testes atribuídos a ele. Quem tiver o link entra como essa pessoa.</p>
            <ul className="mt-3 space-y-4">
              {a.validadores.map((v) => {
                const minhas = a.atribuicoes.filter((x) => x.validadorId === v.id);
                const p = somar(minhas.map((x) => x.prog));
                return (
                  <li key={v.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-semibold">{v.nome} <span className="text-sm font-normal text-slate-700">{v.email}</span></p>
                    <p className="mt-1 text-sm tabular-nums">
                      {plural(minhas.length, "teste atribuído", "testes atribuídos")} · {minhas.filter((x) => x.enviadoEm).length} enviados · {p.respondidos} de {p.total} passos respondidos
                      {p.diferente > 0 && <span className="font-semibold text-rose-800"> · {p.diferente} deu diferente</span>}
                      {p.bloqueado > 0 && <span className="font-semibold text-amber-900"> · {p.bloqueado} bloqueado</span>}
                    </p>
                    <div className="mt-2"><CopiarLink url={`${origem}/meus-testes#k=${tokenDoValidador(v.id, v.chave_versao)}`} /></div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`${aqui}/previa?validador=${v.id}`} className={btn2 + " inline-flex min-h-11 items-center"}>Ver como {v.nome} vê<span className="sr-only"> (consulta, sem alterar)</span></Link>
                      <form action={novoLinkDeConvite.bind(null, id, rodadaId, v.id)}>
                        <Confirmar texto={`Gerar um novo link para ${v.nome}? O link antigo deixa de funcionar.`} className={btn2 + " min-h-11"}>Gerar novo link</Confirmar>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="t-cen" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-cen" className="font-semibold">Por cenário</h2>
            <ul className="mt-3 space-y-3">
              {a.rcs.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold">{c.snapshot?.titulo}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {a.atribuicoes.filter((x) => x.rcId === c.id).map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-[8rem] font-medium">{a.validadores.find((v) => v.id === x.validadorId)?.nome}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR_ESTADO[x.prog.estado]}`}>{ROTULO_ESTADO_ATRIBUICAO[x.prog.estado]}</span>
                        <span className="tabular-nums text-slate-700">{x.prog.respondidos} de {x.prog.total} passos</span>
                        {x.prog.diferente > 0 && <span className="font-semibold text-rose-800">{x.prog.diferente} deu diferente</span>}
                        {x.prog.bloqueado > 0 && <span className="font-semibold text-amber-900">{x.prog.bloqueado} bloqueado</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="t-falhas" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5">
            <h2 id="t-falhas" className="font-semibold text-rose-950">Falhas e bloqueios ({a.falhas.length})</h2>
            {a.falhas.length === 0 ? (
              <p className="mt-1 text-sm text-rose-950">Nenhuma falha ou bloqueio registrado até agora.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {a.falhas.map((f, i) => (
                  <li key={i} className="rounded-lg border border-rose-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{f.cenario} · passo {f.n}</p>
                      <span className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${f.resultado === "diferente" ? "bg-rose-100 text-rose-900 ring-rose-300" : "bg-amber-100 text-amber-950 ring-amber-400"}`}>{f.resultado === "diferente" ? "Deu diferente" : "Bloqueado"}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${f.enviado ? COR_ESTADO.enviado : COR_ESTADO.em_andamento}`}>{f.enviado ? "Enviado" : "Ainda não enviado"}</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{f.validador}{f.perfil ? ` · perfil ${f.perfil}` : ""}{f.pendenciaId && <> · <Link href={`${aqui}/pendencias/${f.pendenciaId}`} className="font-medium text-indigo-800 underline">Ver pendência</Link></>}</p>
                    <p className="mt-2 whitespace-pre-wrap"><span className="font-medium">O que fazer:</span> {f.fazer}</p>
                    <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">O que deveria acontecer:</span> {f.esperado}</p>
                    <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">{f.resultado === "diferente" ? "O que o validador viu:" : "Por que não conseguiu testar:"}</span> {f.obs || "sem explicação"}</p>
                    {f.anexos.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {f.anexos.map((u, k) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt={`Print ${k + 1} do passo`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="t-pub" className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-pub" className="font-semibold">Roteiro publicado</h2>
            <p className="mt-1 text-sm text-slate-700">Esta é a cópia que os validadores executam. Mudar ou arquivar um cenário na biblioteca não altera esta rodada. Para mudar o roteiro, prepare uma nova rodada.</p>
            <details className="mt-3 rounded-md border border-slate-200">
              <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Ver os {a.rcs.length} cenários publicados</summary>
              <ul className="space-y-4 border-t border-slate-200 p-3">
                {a.rcs.map((c) => (
                  <li key={c.id}>
                    <p className="font-semibold">{c.snapshot?.titulo}</p>
                    <ol className="mt-1 list-decimal space-y-2 pl-5 text-sm">
                      {c.snapshot?.passos.map((p) => (
                        <li key={p.id}>
                          <span className="whitespace-pre-wrap">{p.fazer}</span>
                          <span className="block whitespace-pre-wrap text-emerald-900">Deve acontecer: {p.esperado}</span>
                          <span className="block text-xs text-slate-700">{p.perfil ? `Perfil: ${p.perfil}` : "Sem perfil indicado"}{p.tela ? ` · Tela: ${p.tela.modulo} › ${p.tela.titulo}` : ""}</span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </details>
            <form action={novaRodadaAPartirDe.bind(null, id, rodadaId)} className="mt-3">
              <Confirmar texto="Preparar uma nova rodada (rascunho) com os mesmos cenários, validadores e atribuições? Esta rodada continua como está." className={btn + " min-h-11"}>Preparar nova rodada a partir desta</Confirmar>
            </form>
          </section>
        </main>
      </>
    );
  }

  // =============== RASCUNHO: preparação ===============
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const telas = await sql`select id, modulo_id from telas where caderno_id = ${id}`;
  const moduloDaTela = new Map(telas.map((t) => [t.id as string, t.modulo_id as string]));
  const nomeModulo = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const cens = await sql`select id, titulo, tipo, tela_id, passos, situacao from cenarios where caderno_id = ${id} order by titulo`;
  const rcs = await sql`select id, cenario_id from rodada_cenarios where rodada_id = ${rodadaId} order by ordem, id`;
  const escolhidos = new Set(rcs.map((x) => x.cenario_id as string));
  const vals = await sql`select id, nome, email, nota from rodada_validadores where rodada_id = ${rodadaId} order by nome`;
  const atrs = await sql`select a.rodada_cenario_id, a.validador_id from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id where rc.rodada_id = ${rodadaId}`;
  const atribuido = new Set(atrs.map((x) => `${x.rodada_cenario_id}|${x.validador_id}`));

  const info = (c: (typeof cens)[number]) => {
    const ctx = contextoDoCenario({ telaId: c.tela_id, passos: c.passos as PassoCenario[] }, moduloDaTela);
    return { modulos: ctx.modulos.map((m) => nomeModulo.get(m) ?? ""), perfis: ctx.perfis };
  };
  const opcoes = cens.filter((c) => c.situacao === "ativo" || escolhidos.has(c.id)).map((c) => ({ id: c.id as string, titulo: c.titulo as string, tipo: ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO], passos: (c.passos as unknown[]).length, ...info(c), marcado: escolhidos.has(c.id) }));
  const todosModulos = [...new Set(opcoes.flatMap((o) => o.modulos))].sort();
  const todosPerfis = [...new Set(opcoes.flatMap((o) => o.perfis))].sort();
  const cenarioDoRc = new Map(rcs.map((x) => [x.id as string, cens.find((c) => c.id === x.cenario_id)]));

  const { impedem, avisos } = conferirPublicacao({
    nome: r.nome,
    versao: r.versao,
    ambienteUrl: r.ambiente_url,
    cenarios: rcs.map((x) => {
      const c = cenarioDoRc.get(x.id);
      return { titulo: c?.titulo ?? "removido", arquivadoOuSumiu: !c || c.situacao === "arquivado", passos: ((c?.passos as unknown[]) ?? []).length, atribuidos: atrs.filter((a) => a.rodada_cenario_id === x.id).length };
    }),
    validadores: vals.map((v) => ({ nome: v.nome, atribuicoes: atrs.filter((a) => a.validador_id === v.id).length })),
  });
  const secao = "mt-6 rounded-lg border border-slate-200 bg-white p-5 scroll-mt-4";

  return (
    <>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {topo}
        <p className="mt-3 text-sm text-slate-700">Esta rodada é um rascunho: nada foi enviado aos validadores. Preencha os três blocos e publique.</p>

        <section id="secao-dados" aria-labelledby="t-dados" className={secao}>
          <h2 id="t-dados" className="text-lg font-semibold">1. Dados da entrega</h2>
          <form action={salvarDadosRodada.bind(null, id, rodadaId)} className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">Nome da entrega<input id="campo-nome" name="nome" required defaultValue={r.nome} className={campo} /></label>
            <label className="block text-sm font-medium">Versão<input id="campo-versao" name="versao" required defaultValue={r.versao} className={campo} /></label>
            <label className="block text-sm font-medium">Prazo (opcional)<input id="campo-prazo" name="prazo" type="date" defaultValue={r.prazo_txt ?? ""} className={campo} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Endereço do ambiente de teste<input id="campo-ambiente" name="ambiente_url" type="url" required defaultValue={r.ambiente_url ?? ""} placeholder="https://" className={campo} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Resumo do que mudou<textarea name="resumo" rows={3} defaultValue={r.resumo} className={campo + " field-sizing-content"} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Instruções gerais<textarea name="instrucoes" rows={3} defaultValue={r.instrucoes} placeholder="Não escreva senhas aqui" className={campo + " field-sizing-content"} /></label>
            <label className="block text-sm font-medium sm:col-span-2">O que ficou fora do escopo<textarea name="fora_escopo" rows={2} defaultValue={r.fora_escopo} className={campo + " field-sizing-content"} /></label>
            <div className="sm:col-span-2"><button className={btn + " min-h-11"}>Salvar dados</button></div>
          </form>
        </section>

        <section id="secao-cenarios" aria-labelledby="t-cen" className={secao}>
          <h2 id="t-cen" className="text-lg font-semibold">2. Cenários</h2>
          <p className="mt-1 text-sm text-slate-700">Escolha da <Link href={`/admin/${id}/biblioteca`} className="text-indigo-800 underline">Biblioteca de testes</Link> os cenários desta entrega. Cenários arquivados não aparecem para escolha.</p>
          <SelecaoCenarios acao={salvarCenariosDaRodada.bind(null, id, rodadaId)} cenarios={opcoes} modulos={todosModulos} perfis={todosPerfis} />
        </section>

        <section id="secao-validadores" aria-labelledby="t-val" className={secao}>
          <h2 id="t-val" className="text-lg font-semibold">3. Validadores</h2>
          <p className="mt-1 text-sm text-slate-700"><strong>Validador</strong> é a pessoa que executa o teste. <strong>Perfil de acesso</strong> é a conta ou função usada no sistema em teste (por exemplo, Comprador ou Financeiro) e fica em cada passo do cenário. Uma pessoa pode usar mais de um perfil no mesmo cenário.</p>
          {vals.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
              {vals.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span><strong>{v.nome}</strong> · {v.email}{v.nota && <span className="block text-xs text-slate-700">Orientação: {v.nota}</span>}</span>
                  <span className="flex flex-wrap gap-2">
                    <Link href={`${aqui}/previa?validador=${v.id}`} className={btn2 + " inline-flex min-h-11 items-center"}>Prévia como {v.nome}</Link>
                    <form action={removerValidador.bind(null, id, rodadaId, v.id)}><Confirmar texto={`Remover ${v.nome} da rodada? As atribuições dessa pessoa também saem.`} className={btn2 + " min-h-11"}>Remover<span className="sr-only"> {v.nome}</span></Confirmar></form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form action={adicionarValidador.bind(null, id, rodadaId)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Nome<input name="nome" required className={campo} /></label>
            <label className="block text-sm font-medium">E-mail<input name="email" type="email" required className={campo} /></label>
            <label className="block text-sm font-medium sm:col-span-2">Orientação para esta pessoa (opcional)<input name="nota" maxLength={1000} placeholder="Ex.: use as contas de teste que enviamos por outro canal. Sem senhas aqui" className={campo} /></label>
            <div className="sm:col-span-2"><button className={btn2 + " min-h-11"}>Adicionar validador</button></div>
          </form>

          <h3 className="mt-6 font-semibold">Quem executa cada cenário</h3>
          {rcs.length === 0 || vals.length === 0 ? (
            <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">{rcs.length === 0 ? "Escolha e salve os cenários no bloco 2." : "Cadastre pelo menos um validador acima."} Depois volte aqui para atribuir.</p>
          ) : (
            <form action={salvarAtribuicoes.bind(null, id, rodadaId)} className="mt-2">
              <p className="text-sm text-slate-700">O cenário inteiro é a unidade de atribuição. Marque quem executa cada um (pode ser mais de uma pessoa: cada uma terá o seu próprio progresso).</p>
              <ul className="mt-3 space-y-3">
                {rcs.map((x) => {
                  const c = cenarioDoRc.get(x.id);
                  const ctx = c ? info(c) : { modulos: [], perfis: [] };
                  return (
                    <li key={x.id} className="rounded-lg border border-slate-200 p-3">
                      <fieldset>
                        <legend className="font-semibold">{c?.titulo ?? "Cenário removido da biblioteca"}</legend>
                        <p className="text-xs text-slate-700">Módulos: {ctx.modulos.join(", ") || "nenhum indicado"} · Perfis de acesso: {ctx.perfis.join(", ") || "nenhum indicado"}</p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                          {vals.map((v) => (
                            <label key={v.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="atrib" value={`${x.id}|${v.id}`} defaultChecked={atribuido.has(`${x.id}|${v.id}`)} className="h-5 w-5" /> {v.nome}</label>
                          ))}
                        </div>
                      </fieldset>
                    </li>
                  );
                })}
              </ul>
              <button className={btn + " mt-3 min-h-11"}>Salvar atribuições</button>
            </form>
          )}
        </section>

        <section id="secao-publicar" aria-labelledby="t-publicar" className={secao}>
          <h2 id="t-publicar" className="text-lg font-semibold">Publicar</h2>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium text-slate-700">Entrega</dt><dd>{r.nome} · versão {r.versao} · prazo: {dia(r.prazo_txt)}</dd>
            <dt className="font-medium text-slate-700">Cenários</dt><dd>{rcs.length}</dd>
            <dt className="font-medium text-slate-700">Validadores</dt><dd>{vals.length}</dd>
            <dt className="font-medium text-slate-700">Testes atribuídos</dt><dd>{atrs.length}</dd>
          </dl>
          {impedem.length > 0 ? (
            <div role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">
              <p className="font-semibold">{plural(impedem.length, "item impede a publicação", "itens impedem a publicação")}:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{impedem.map((i, k) => <li key={k}>{i.texto} <a href={`#${i.ancora}`} className="font-medium underline">Ir para o campo</a></li>)}</ul>
            </div>
          ) : (
            <p role="status" className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">Tudo certo para publicar.</p>
          )}
          {avisos.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">{avisos.map((x) => <li key={x}>{x}</li>)}</ul>}
          <p className="mt-3 text-sm text-slate-700">Ao publicar, a rodada passa para “Em validação” e o roteiro é copiado: mudar ou arquivar cenários na biblioteca depois não altera esta rodada.</p>
          <form action={publicarRodada.bind(null, id, rodadaId)} className="mt-3">
            {impedem.length > 0 ? (
              <button disabled className={btn + " min-h-11 disabled:opacity-50"}>Publicar rodada</button>
            ) : (
              <Confirmar texto="Publicar esta rodada? O roteiro será copiado e os links de acesso passam a funcionar. Depois disso a rodada não pode ser editada." className={btn + " min-h-11"}>Publicar rodada</Confirmar>
            )}
          </form>
        </section>
      </main>
    </>
  );
}
