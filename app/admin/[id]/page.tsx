import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AlertTriangle, ChevronRight, CircleCheck, Download, ExternalLink, FileUp, History, Hourglass, LayoutList, MessageSquareText, Pencil, Plus } from "lucide-react";
import AceiteAdmin from "@/components/AceiteAdmin";
import Aviso from "@/components/Aviso";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Secao from "@/components/Secao";
import { botao, campo, FOCO } from "@/components/estilos";
import { CopiarLink } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { sql, tabelasFaltando } from "@/lib/db";
import { dataHora } from "@/lib/formatar";
import { ROTULO_SEVERIDADE, SEVERIDADES, type Severidade } from "@/lib/tipos";
import { marcarCorrigido } from "../actions";

// mais grave primeiro; sem gravidade informada vai depois
const pesoSeveridade = (s: Severidade | null) => (s ? SEVERIDADES.indexOf(s) : SEVERIDADES.length);

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  item: "Essa funcionalidade não existe mais. Recarregue a página e confira a lista.",
  travado: "A homologação está concluída, então nada foi alterado ou apagado. Reabra a homologação (caixa “Aceite da homologação”) antes de mudar a estrutura.",
};

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]">) {
  await exigirAdmin();
  const { id } = await params;
  const { erro, salvo, reaberta, criado } = await searchParams;
  const [c] = await sql`select * from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const telas = await sql`select id, titulo, itens from telas where caderno_id = ${id}`;
  const nModulos = (await sql`select count(*)::int as n from modulos where caderno_id = ${id}`)[0].n as number;

  // Funcionalidades que existem hoje: nome, tela e módulo (para os alertas)
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id}`;
  const moduloDe = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const moduloDaTela = new Map((await sql`select id, modulo_id from telas where caderno_id = ${id}`).map((t) => [t.id as string, t.modulo_id as string]));
  const doItem = new Map<string, { nome: string; tela: string; modulo: string }>();
  for (const t of telas) for (const i of t.itens as { id: string; nome: string }[]) doItem.set(i.id, { nome: i.nome, tela: t.titulo, modulo: moduloDe.get(moduloDaTela.get(t.id) ?? "") ?? "" });

  // Alertas: quem marcou NÃO OK. "Corrigido" = a autora registrou uma correção depois de a pessoa marcar NÃO OK.
  const alertasBrutos = await sql`
    select r.item, r.nome, r.obs, r.anexos, r.severidade, r.atualizado,
      coalesce((select max(h.criado) from historico h where h.caderno = r.caderno and h.item = r.item and h.email = r.email and h.tipo = 'resultado' and h.para = 'nao_ok'), r.atualizado) as marcou_em
    from respostas_item r
    where r.caderno = ${c.slug} and r.resultado = 'nao_ok'`;
  const corrigidos = await sql`select item, max(criado) as em from historico where caderno = ${c.slug} and tipo = 'correcao' group by item`;
  const ultimaCorrecao = new Map(corrigidos.map((x) => [x.item as string, new Date(x.em).getTime()]));
  const alertas = alertasBrutos
    .filter((a) => doItem.has(a.item))
    .map((a) => ({
      item: a.item as string,
      nome: a.nome as string,
      obs: a.obs as string,
      anexos: (a.anexos ?? []) as string[],
      severidade: (a.severidade ?? null) as Severidade | null,
      marcouEm: new Date(a.marcou_em),
      // só vale como "corrigido" se a correção veio DEPOIS da última mudança da pessoa (inclusive uma observação
      // nova depois do reteste: "continua com problema" volta o alerta para "aguardando correção")
      corrigido: (ultimaCorrecao.get(a.item) ?? 0) > new Date(a.atualizado).getTime(),
    }))
    .sort((a, b) => Number(a.corrigido) - Number(b.corrigido) || pesoSeveridade(a.severidade) - pesoSeveridade(b.severidade) || a.marcouEm.getTime() - b.marcouEm.getTime());
  const aguardandoCorrecao = alertas.filter((a) => !a.corrigido).length;
  const aguardandoReteste = alertas.length - aguardandoCorrecao;

  // Pendências das homologações (só se o banco já tem as tabelas): somam aos alertas do caderno
  let pend = { corrigir: 0, reteste: 0, rodadaCorrigir: null as string | null, rodadaReteste: null as string | null, rodadas: 0 };
  if (!(await tabelasFaltando(["pendencias", "rodadas"])).length) {
    const linhas = await sql`
      select r.id as rodada, p.situacao, count(*)::int as n
      from pendencias p join rodadas r on r.id = p.rodada_id
      where r.caderno_id = ${id} and p.situacao <> 'resolvida' group by r.id, p.situacao`;
    const corrigir = linhas.filter((l) => l.situacao !== "aguardando_reteste");
    const reteste = linhas.filter((l) => l.situacao === "aguardando_reteste");
    const unica = (l: typeof linhas) => (new Set(l.map((x) => x.rodada)).size === 1 ? (l[0].rodada as string) : null);
    pend = {
      corrigir: corrigir.reduce((s, l) => s + l.n, 0),
      reteste: reteste.reduce((s, l) => s + l.n, 0),
      rodadaCorrigir: unica(corrigir),
      rodadaReteste: unica(reteste),
      rodadas: (await sql`select count(*)::int as n from rodadas where caderno_id = ${id}`)[0].n as number,
    };
  }
  const base = `/admin/${id}`;
  const paraCorrigir = aguardandoCorrecao + pend.corrigir;
  const paraReteste = aguardandoReteste + pend.reteste;
  const destinoCorrigir = aguardandoCorrecao > 0 || !pend.corrigir ? "#para-corrigir" : pend.rodadaCorrigir ? `${base}/rodadas/${pend.rodadaCorrigir}/pendencias` : `${base}/rodadas`;
  const destinoReteste = aguardandoReteste > 0 || !pend.reteste ? "#para-corrigir" : pend.rodadaReteste ? `${base}/rodadas/${pend.rodadaReteste}/pendencias?situacao=aguardando_reteste` : `${base}/rodadas`;

  // Próximos passos: só o que ainda falta, cada um com o caminho para resolver
  const semFuncionalidade = telas.filter((t) => !(t.itens as unknown[]).length).length;
  const semRoteiro = telas.reduce((s, t) => s + (t.itens as { passos?: unknown[] }[]).filter((i) => !i.passos?.length).length, 0);
  const passos: { texto: string; href: string }[] = [];
  if (nModulos === 0) passos.push({ texto: "Adicionar o primeiro módulo", href: `${base}/estrutura#adicionar-modulos` });
  else if (telas.length === 0) passos.push({ texto: "Cadastrar a primeira tela", href: `${base}/tela/nova` });
  if (semFuncionalidade > 0 && telas.length > 0) passos.push({ texto: `${semFuncionalidade} ${semFuncionalidade === 1 ? "tela ainda está" : "telas ainda estão"} em preparação: cadastrar as funcionalidades`, href: `${base}/estrutura` });
  if (semRoteiro > 0) passos.push({ texto: `${semRoteiro} ${semRoteiro === 1 ? "funcionalidade está" : "funcionalidades estão"} sem roteiro de teste: escrever os passos`, href: `${base}/estrutura` });
  if (telas.length > 0 && pend.rodadas === 0 && !(await tabelasFaltando(["rodadas"])).length) passos.push({ texto: "Criar a primeira homologação e enviar aos validadores", href: `${base}/rodadas` });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const url = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}/c/${c.slug}` : null; // sem endereço, não mostra link quebrado

  const indicador = (href: string, valor: number, rotulo: string, dica: string, icone: React.ReactNode, tom: string) => (
    <Link href={href} className={`group flex min-h-16 flex-1 basis-48 items-center gap-3 px-4 py-3 hover:bg-slate-50 ${FOCO}`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-md [&>svg]:size-4 ${tom}`} aria-hidden="true">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-semibold leading-none tabular-nums">{valor}</span>
        <span className="mt-1 block text-sm font-medium">{rotulo}</span>
        <span className="block text-xs text-slate-700">{dica}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500 group-hover:text-slate-800" />
    </Link>
  );

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <CabecalhoPagina
          migalhas={[{ rotulo: "Seus cadernos", href: "/admin" }, { rotulo: c.titulo }]}
          titulo={c.titulo}
          descricao={`Versão ${c.versao}${c.preparado_por ? ` · preparado por ${c.preparado_por}` : ""}`}
          acoes={
            <>
              <Link href={`${base}/editar`} className={botao("secundario")}>
                <Pencil aria-hidden="true" />
                Editar caderno
              </Link>
              <Link href={`${base}/tela/nova`} className={botao("primario")}>
                <Plus aria-hidden="true" />
                Nova tela
              </Link>
            </>
          }
        />

        {criado && (
          <Aviso
            tom="sucesso"
            titulo="Caderno criado."
            className="mb-4"
            acoes={
              nModulos === 0 ? (
                <>
                  <Link href={`${base}/estrutura#adicionar-modulos`} className={botao("primario")}>
                    <Plus aria-hidden="true" />
                    Adicionar primeiro módulo
                  </Link>
                  <Link href={`${base}/importar`} className={botao("secundario")}>
                    <FileUp aria-hidden="true" />
                    Importar estrutura
                  </Link>
                </>
              ) : undefined
            }
          >
            {nModulos === 0 ? "Próximo passo: monte a estrutura do sistema." : "Próximo passo: cadastre as telas de cada módulo, ou importe a estrutura de uma planilha."}
          </Aviso>
        )}
        {salvo && <Aviso tom="sucesso" className="mb-4">Salvo.</Aviso>}
        {typeof erro === "string" && ERROS[erro] && <Aviso tom="erro" className="mb-4">{ERROS[erro]}</Aviso>}

        <section aria-label="Indicadores do caderno" className="flex flex-wrap divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:divide-x sm:divide-y-0">
          {indicador(`${base}/estrutura`, telas.length, "Telas cadastradas", `${nModulos} ${nModulos === 1 ? "módulo" : "módulos"}`, <LayoutList />, "bg-slate-100 text-slate-700")}
          {indicador(destinoCorrigir, paraCorrigir, "Para corrigir", paraCorrigir ? "Falhas esperando ajuste da equipe" : "Nada esperando ajuste", <AlertTriangle />, paraCorrigir ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")}
          {indicador(destinoReteste, paraReteste, "Aguardando reteste", paraReteste ? "Corrigido, falta o validador testar de novo" : "Nada esperando reteste", <Hourglass />, paraReteste ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700")}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Secao id="t-proximos" titulo="Próximos passos">
            {passos.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-800"><CircleCheck aria-hidden="true" className="size-4 text-emerald-700" />Tudo preparado por enquanto.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {passos.map((p) => (
                  <li key={p.texto}>
                    <Link href={p.href} className={`flex min-h-11 items-center justify-between gap-3 rounded text-sm hover:text-indigo-900 ${FOCO}`}>
                      <span>{p.texto}</span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao id="t-cliente" titulo="Link para o cliente" descricao="Quem tiver este link abre o caderno inteiro, com todos os módulos.">
            {url ? <CopiarLink url={url} /> : <p className="text-sm text-rose-800">Não conseguimos montar o endereço completo. Use o botão abaixo e copie o endereço da barra do navegador.</p>}
            <div className="mt-3">
              <a href={`/c/${c.slug}`} target="_blank" className={botao("secundario", "w-fit")}>
                <ExternalLink aria-hidden="true" />
                Ver como o cliente vê<span className="sr-only"> (abre em nova aba)</span>
              </a>
            </div>
          </Secao>
        </div>

        <div className="mt-6 space-y-6">
        <Secao id="t-respostas" titulo="Respostas e histórico do caderno" descricao="O que os clientes responderam direto no caderno, antes das homologações." >
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/respostas`} className={botao("secundario")}>
              <MessageSquareText aria-hidden="true" />
              Ver respostas
            </Link>
            <Link href={`${base}/historico`} className={botao("secundario")}>
              <History aria-hidden="true" />
              Ver histórico
            </Link>
            <a href={`${base}/exportar`} download className={botao("secundario")}>
              <Download aria-hidden="true" />
              Baixar em planilha (CSV)
            </a>
          </div>
        </Secao>

        <AceiteAdmin cadernoId={id} slug={c.slug} erro={typeof erro === "string" ? erro : undefined} reaberta={reaberta === "1"} />

        {alertas.length > 0 && (
          <section id="para-corrigir" aria-labelledby="titulo-alertas" className="scroll-mt-4 rounded-lg border border-rose-300 bg-rose-50 p-5">
            <h2 id="titulo-alertas" className="font-semibold text-rose-950">Para corrigir ({alertas.length})</h2>
            <p className="mt-1 text-sm text-rose-950">
              {aguardandoCorrecao > 0 ? `${aguardandoCorrecao} ${aguardandoCorrecao === 1 ? "aguarda" : "aguardam"} correção.` : "Tudo já foi corrigido e aguarda o reteste do cliente."} Depois de ajustar, clique em “Marcar como corrigido”: o cliente vê o aviso, testa de novo e o registro fica no histórico.
            </p>
            <ul className="mt-4 space-y-3">
              {alertas.map((a) => (
                <li key={`${a.item}-${a.nome}`} className="rounded-lg border border-rose-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap font-medium">{doItem.get(a.item)!.nome}</p>
                      {a.severidade && <p className="mt-0.5 text-xs font-semibold text-rose-900">Gravidade: {ROTULO_SEVERIDADE[a.severidade]}</p>}
                      <p className="text-xs text-slate-700">
                        {doItem.get(a.item)!.modulo} › {doItem.get(a.item)!.tela} · marcado por {a.nome} em {dataHora(a.marcouEm)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${a.corrigido ? "bg-indigo-50 text-indigo-900 ring-indigo-300" : "bg-rose-100 text-rose-900 ring-rose-300"}`}>
                      {a.corrigido ? <Hourglass aria-hidden="true" className="size-3.5" /> : <AlertTriangle aria-hidden="true" className="size-3.5" />}
                      {a.corrigido ? "Aguardando reteste do cliente" : "Para corrigir"}
                    </span>
                  </div>
                  {a.obs && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{a.obs}</p>}
                  {a.anexos.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {a.anexos.map((u, k) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noreferrer" aria-label={`Abrir print ${k + 1} em nova aba`} className={`block rounded-md ${FOCO}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt={`Print ${k + 1} anexado pelo cliente`} className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={marcarCorrigido.bind(null, id, a.item)} className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                      O que foi ajustado (opcional)
                      <input name="nota" maxLength={2000} placeholder="Ex.: o botão agora aparece na tela" className={campo + " min-h-11 sm:min-h-10"} />
                    </label>
                    <BotaoEnviar pendente="Registrando…">{a.corrigido ? "Registrar nova correção" : "Marcar como corrigido"}</BotaoEnviar>
                  </form>
                  <Link href={`${base}/historico?item=${a.item}`} className={`mt-2 inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`}>Ver histórico desta funcionalidade</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </div>
    </main>
  );
}
