import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AceiteAdmin from "@/components/AceiteAdmin";
import AdminBar from "@/components/AdminBar";
import Aviso from "@/components/Aviso";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import FerramentasPlanilha from "@/components/FerramentasPlanilha";
import ListaInstrucoes from "@/components/ListaInstrucoes";
import ListaModulos from "@/components/ListaModulos";
import { ChipStatus } from "@/components/StatusBadge";
import { btn, btn2, botao, campo } from "@/components/estilos";
import { FileUp, ListPlus, Plus } from "lucide-react";
import { Confirmar, CopiarLink } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { consolidado } from "@/lib/consolidado";
import { sql } from "@/lib/db";
import { dataHora } from "@/lib/formatar";
import { separarInstrucoes } from "@/lib/listas";
import { juntar, resumoTela, type ResumoTela } from "@/lib/status";
import type { Resultado, Tela } from "@/lib/tipos";
import { criarModulos, criarTelasEmLote, excluirCaderno, excluirModulo, excluirTela, marcarCorrigido, moverModulo, moverTela, renomearModulo, salvarCaderno } from "../actions";
import { ROTULO_SEVERIDADE, SEVERIDADES, type Severidade } from "@/lib/tipos";

// mais grave primeiro; sem gravidade informada vai depois
const pesoSeveridade = (s: Severidade | null) => (s ? SEVERIDADES.indexOf(s) : SEVERIDADES.length);

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const seta = `min-h-11 min-w-11 rounded border border-slate-400 bg-white px-2 text-sm hover:bg-slate-50 disabled:opacity-30 ${FOCO}`;
const link = `inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`;

const ERROS: Record<string, string> = {
  tela: "Esta tela foi excluída em outro lugar, então não foi possível salvar. Confira a lista de telas abaixo.",
  modulos: "Escreva pelo menos um nome de módulo e clique em Adicionar antes de salvar.",
  modulos_repetidos: "Todos esses nomes já existem neste caderno, então nada foi criado.",
  modulo_nome: "Escreva o novo nome do módulo.",
  modulo: "Esse módulo não existe mais. Recarregue a página e confira a lista.",
  telas: "Escreva pelo menos um nome de tela (um por linha).",
  item: "Essa funcionalidade não existe mais. Recarregue a página e confira a lista.",
  ambiente: "O endereço do ambiente de teste precisa começar com https:// (ou http://). Confira e salve de novo.",
  travado: "A homologação está concluída, então nada foi alterado ou apagado. Reabra a homologação (caixa “Aceite da homologação”) antes de mudar a estrutura.",
};

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]">) {
  await exigirAdmin();
  const { id } = await params;
  const { erro, salvo, reaberta, criado, ignorados } = await searchParams;
  const nomesIgnorados = typeof ignorados === "string" ? ignorados.split("\n").filter(Boolean).slice(0, 10) : [];
  const erroModulos = erro === "modulos" || erro === "modulos_repetidos"; // aparece junto do campo, não no topo
  const [c] = await sql`select * from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const rows = await sql`select * from telas where caderno_id = ${id} order by ordem`;
  const resultados = await consolidado(c.slug);
  const resultado = (itemId: string): Resultado => resultados[itemId] ?? "nao_testado";
  const telas: Tela[] = rows.map((x) => ({ id: x.id, moduloId: x.modulo_id, titulo: x.titulo, imagem: x.imagem_url, link: x.link_url, pdf: x.pdf_url, itens: x.itens, paiId: x.pai_id }));
  const resumos: Record<string, ResumoTela> = Object.fromEntries(telas.map((t) => [t.id, resumoTela(t, resultado)]));
  const geral = juntar(telas.map((t) => resumos[t.id]));

  // Funcionalidades que existem hoje: nome, tela e módulo (para os alertas)
  const moduloDe = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const doItem = new Map<string, { nome: string; tela: string; modulo: string }>();
  for (const t of telas) for (const i of t.itens) doItem.set(i.id, { nome: i.nome, tela: t.titulo, modulo: moduloDe.get(t.moduloId) ?? "" });

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
  const aguardando = alertas.filter((a) => !a.corrigido).length;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const url = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}/c/${c.slug}` : null; // sem endereço, não mostra link quebrado

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <CabecalhoPagina migalhas={[{ rotulo: "Seus cadernos", href: "/admin" }, { rotulo: c.titulo }]} titulo={c.titulo} />
        {criado && (
          <Aviso
            tom="sucesso"
            titulo="Caderno criado."
            className="mb-3"
            acoes={
              modulos.length === 0 ? (
                <>
                  <a href="#adicionar-modulos" className={botao("primario")}>
                    <Plus aria-hidden="true" />
                    Adicionar primeiro módulo
                  </a>
                  <Link href={`/admin/${id}/importar`} className={botao("secundario")}>
                    <FileUp aria-hidden="true" />
                    Importar estrutura
                  </Link>
                </>
              ) : undefined
            }
          >
            {modulos.length === 0 ? "Próximo passo: monte a estrutura do sistema." : "Próximo passo: cadastre as telas de cada módulo, ou importe a estrutura de uma planilha."}
          </Aviso>
        )}
        {salvo && <Aviso tom="sucesso" className="mb-3">Salvo.</Aviso>}
        {nomesIgnorados.length > 0 && <Aviso tom="alerta" className="mb-3">{nomesIgnorados.length === 1 ? "Este nome já existia e foi ignorado" : "Estes nomes já existiam e foram ignorados"}: {nomesIgnorados.join(", ")}.</Aviso>}
        {typeof erro === "string" && !erroModulos && ERROS[erro] && <Aviso tom="erro" className="mb-3">{ERROS[erro]}</Aviso>}

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Link para o cliente</h2>
          <p className="mt-1 text-sm text-slate-700">Quem tiver este link abre o caderno inteiro, com todos os módulos. Envie para o cliente.</p>
          <div className="mt-3">
            {url ? <CopiarLink url={url} /> : <p className="text-sm text-rose-800">Não conseguimos montar o endereço completo. Use o botão “Ver como o cliente vê” e copie o endereço da barra do navegador.</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/c/${c.slug}`} target="_blank" className={btn2 + " inline-flex min-h-11 items-center"}>Ver como o cliente vê<span className="sr-only"> (abre em nova aba)</span></a>
            <Link href={`/admin/${id}/respostas`} className={btn2 + " inline-flex min-h-11 items-center"}>Ver respostas</Link>
            <Link href={`/admin/${id}/historico`} className={btn2 + " inline-flex min-h-11 items-center"}>Ver histórico</Link>
            <Link href={`/admin/${id}/biblioteca`} className={btn2 + " inline-flex min-h-11 items-center"}>Biblioteca de testes</Link>
            <Link href={`/admin/${id}/rodadas`} className={btn2 + " inline-flex min-h-11 items-center"}>Rodadas</Link>
          </div>
          <FerramentasPlanilha cadernoId={id} />
        </section>

        <AceiteAdmin cadernoId={id} slug={c.slug} erro={typeof erro === "string" ? erro : undefined} reaberta={reaberta === "1"} />

        {alertas.length > 0 && (
          <section aria-labelledby="titulo-alertas" className="mt-6 rounded-lg border border-rose-300 bg-rose-50 p-5">
            <h2 id="titulo-alertas" className="font-semibold text-rose-950">Para corrigir ({alertas.length})</h2>
            <p className="mt-1 text-sm text-rose-950">
              {aguardando > 0 ? `${aguardando} ${aguardando === 1 ? "aguarda" : "aguardam"} correção.` : "Tudo já foi corrigido e aguarda o reteste do cliente."} Depois de ajustar, clique em “Marcar como corrigido”: o cliente vê o aviso, testa de novo e o registro fica no histórico.
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
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${a.corrigido ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-rose-100 text-rose-900 ring-rose-300"}`}>
                      {a.corrigido ? "Corrigido, aguardando reteste do cliente" : "Aguardando correção"}
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
                      <input name="nota" maxLength={2000} placeholder="Ex.: o botão agora aparece na tela" className={campo + " min-h-11"} />
                    </label>
                    <button className={btn + " min-h-11"}>{a.corrigido ? "Registrar nova correção" : "Marcar como corrigido"}</button>
                  </form>
                  <Link href={`/admin/${id}/historico?item=${a.item}`} className={link}>Ver histórico desta funcionalidade</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Módulos e telas</h2>
            <ChipStatus status={geral.status} />
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {geral.total === 0
              ? "Ainda não há funcionalidades cadastradas."
              : `${geral.ok} de ${geral.total} funcionalidades OK${geral.naoOk > 0 ? ` · ${geral.naoOk} NÃO OK` : ""}.`}{" "}
            Dá para cadastrar todos os módulos e telas de uma vez, só com o nome. Eles aparecem no menu do cliente como “Em preparação” até você cadastrar as funcionalidades de cada tela.
          </p>

          <details id="adicionar-modulos" className="mt-4 scroll-mt-4" open={modulos.length === 0 || erroModulos}>
            <summary className={botao("secundario", "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              <ListPlus aria-hidden="true" />
              Adicionar módulos
            </summary>
            <form action={criarModulos.bind(null, id)} className="mt-2 space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
              <ListaModulos campo="titulos" existentes={modulos.map((m) => m.titulo as string)} />
              {erroModulos && typeof erro === "string" && <Aviso tom="erro">{ERROS[erro]}</Aviso>}
              <BotaoEnviar pendente="Salvando módulos…">Salvar módulos</BotaoEnviar>
            </form>
          </details>

          {modulos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-700">Nenhum módulo ainda. Adicione os módulos acima para começar a cadastrar as telas.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {modulos.map((m, mi) => {
                const doModulo = telas.filter((t) => t.moduloId === m.id);
                const principais = doModulo.filter((t) => !t.paiId);
                const rm = juntar(doModulo.map((t) => resumos[t.id]));
                const nPop = doModulo.length - principais.length;
                return (
                  <article key={m.id} aria-labelledby={`m-${m.id}`} className="rounded-lg border border-slate-300">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-t-lg bg-slate-50 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <h3 id={`m-${m.id}`} className="break-words text-base font-semibold">
                          <span className="mr-2 text-slate-600">{mi + 1}.</span>
                          {m.titulo}
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                          <ChipStatus status={rm.status} />
                          <span>
                            {principais.length} {principais.length === 1 ? "tela" : "telas"}
                            {nPop > 0 ? ` e ${nPop} ${nPop === 1 ? "pop-up" : "pop-ups"}` : ""}
                            {rm.total > 0 ? ` · ${rm.ok} de ${rm.total} funcionalidades OK` : ""}
                            {rm.naoOk > 0 && <strong className="text-rose-800"> · {rm.naoOk} NÃO OK</strong>}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={moverModulo.bind(null, id, m.id, -1)}><button disabled={mi === 0} aria-label={`Subir o módulo ${m.titulo}`} className={seta}>↑</button></form>
                        <form action={moverModulo.bind(null, id, m.id, 1)}><button disabled={mi === modulos.length - 1} aria-label={`Descer o módulo ${m.titulo}`} className={seta}>↓</button></form>
                        <Link href={`/admin/${id}/tela/nova?modulo=${m.id}`} className={btn + " inline-flex min-h-11 items-center"}>Adicionar tela</Link>
                      </div>
                    </div>

                    <div className="space-y-3 px-4 py-3">
                      {principais.length === 0 ? (
                        <p className="text-sm text-slate-700">Nenhuma tela neste módulo ainda.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {principais.flatMap((t, ti) => {
                            const filhos = doModulo.filter((f) => f.paiId === t.id);
                            return [
                              { t, num: String(ti + 1), nivel: 0, pos: ti, total: principais.length, filhos: filhos.length, paiTitulo: "" },
                              ...filhos.map((f, fi) => ({ t: f, num: `${ti + 1}.${fi + 1}`, nivel: 1, pos: fi, total: filhos.length, filhos: 0, paiTitulo: t.titulo })),
                            ];
                          }).map(({ t, num, nivel, pos, total, filhos, paiTitulo }) => {
                            const r = resumos[t.id];
                            return (
                              <li key={t.id} className={`flex flex-wrap items-center gap-3 py-3 ${nivel ? "ml-6 border-l-2 border-indigo-200 pl-4 sm:ml-10" : ""}`}>
                                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-sm font-medium">{num}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">
                                    {nivel > 0 && <span className="mr-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-900">Pop-up de “{paiTitulo}”</span>}
                                    {t.titulo}
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    {t.imagem ? "Imagem ✓" : "Sem imagem"} · {t.pdf ? "PDF ✓" : t.itens.length > 0 ? "PDF gerado pela lista" : "Sem PDF"} · {t.itens.length} {t.itens.length === 1 ? "funcionalidade" : "funcionalidades"}
                                  </p>
                                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                    {t.link ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-300">Programada: o validador abre o link para testar</span>
                                    ) : (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-800 ring-1 ring-inset ring-slate-300">Só desenho: o validador revisa a imagem</span>
                                    )}
                                    {t.itens.length > 0 && (() => {
                                      const sem = t.itens.filter((i) => !i.passos?.length).length;
                                      return sem > 0
                                        ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950 ring-1 ring-inset ring-amber-300">Falta o roteiro detalhado em {sem} {sem === 1 ? "funcionalidade" : "funcionalidades"}</span>
                                        : <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-900 ring-1 ring-inset ring-indigo-300">Roteiro completo</span>;
                                    })()}
                                  </p>
                                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
                                    <ChipStatus status={r.status} />
                                    {r.total > 0 && (
                                      <span>
                                        {r.ok} de {r.total} OK
                                        {r.naoOk > 0 && <strong className="text-rose-800"> · {r.naoOk} NÃO OK</strong>}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <form action={moverTela.bind(null, id, t.id, -1)}><button disabled={pos === 0} aria-label={`Subir ${t.titulo}`} className={seta}>↑</button></form>
                                <form action={moverTela.bind(null, id, t.id, 1)}><button disabled={pos === total - 1} aria-label={`Descer ${t.titulo}`} className={seta}>↓</button></form>
                                {nivel === 0 && <Link href={`/admin/${id}/tela/nova?pai=${t.id}`} className={link}>Adicionar pop-up</Link>}
                                <Link href={`/admin/${id}/tela/${t.id}`} className={btn2 + " inline-flex min-h-11 items-center"}>Editar<span className="sr-only"> {t.titulo}</span></Link>
                                <form action={excluirTela.bind(null, id, t.id)}>
                                  <Confirmar texto={`Excluir ${nivel ? "o pop-up" : "a tela"} “${t.titulo}”${filhos ? ` e os ${filhos} pop-ups dela` : ""}? Não dá para desfazer. As respostas dos clientes às funcionalidades ${filhos ? "dessas telas" : "dela"} continuam guardadas e passam a aparecer em “Respostas de funcionalidades removidas”.`} className={btn2 + " min-h-11"}>
                                    Excluir<span className="sr-only"> {t.titulo}</span>
                                  </Confirmar>
                                </form>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                        <details className="min-w-0 flex-1 basis-64 rounded-md border border-slate-300">
                          <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Criar várias telas de uma vez</summary>
                          <form action={criarTelasEmLote.bind(null, id, m.id)} className="space-y-3 border-t border-slate-200 p-3">
                            <label className="block text-sm font-medium">
                              Uma tela por linha (só o nome)
                              <textarea name="titulos" rows={4} required placeholder={"Relatório de pedidos\nCadastro de clientes"} className={campo} />
                            </label>
                            <button className={btn + " min-h-11"}>Criar telas</button>
                          </form>
                        </details>
                        <details className="min-w-0 flex-1 basis-64 rounded-md border border-slate-300">
                          <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Renomear ou excluir o módulo</summary>
                          <div className="space-y-3 border-t border-slate-200 p-3">
                            <form action={renomearModulo.bind(null, id, m.id)} className="flex flex-wrap items-end gap-2">
                              <label className="min-w-0 flex-1 text-sm font-medium">
                                Novo nome
                                <input name="titulo" required defaultValue={m.titulo} className={campo + " min-h-11"} />
                              </label>
                              <button className={btn2 + " min-h-11"}>Renomear</button>
                            </form>
                            <form action={excluirModulo.bind(null, id, m.id)}>
                              <Confirmar texto={`Excluir o módulo “${m.titulo}”, com as ${doModulo.length} telas e pop-ups dele, e também as respostas e o histórico dos clientes dessas telas? Não dá para desfazer.`} className={btn2 + " min-h-11 text-rose-800"}>
                                Excluir módulo e tudo dentro dele
                              </Confirmar>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Dados do caderno</h2>
          <form action={salvarCaderno.bind(null, id)} className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">Nome do sistema<input name="titulo" required defaultValue={c.titulo} className={campo} /></label>
            {erro === "titulo" && <p role="alert" className="text-sm text-rose-800 sm:col-span-2">Escreva o nome do caderno.</p>}
            <label className="block text-sm font-medium">Versão<input name="versao" defaultValue={c.versao} className={campo} /></label>
            <label className="block text-sm font-medium">Preparado por<input name="preparado_por" defaultValue={c.preparado_por} className={campo} /></label>
            <label className="block text-sm font-medium sm:col-span-2">
              Endereço do ambiente de teste (opcional)
              <input name="ambiente_url" type="url" defaultValue={c.ambiente_url ?? ""} placeholder="https://" className={campo} />
              <span className="mt-1 block text-xs font-normal text-slate-600">Se preencher, o validador vê o botão “Abrir ambiente de teste” logo na entrada do caderno.</span>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Antes de começar</legend>
              <div className="mt-1"><ListaInstrucoes campo="antes" inicial={separarInstrucoes(String(c.antes ?? ""))} /></div>
            </fieldset>
            <div className="sm:col-span-2"><BotaoEnviar>Salvar</BotaoEnviar></div>
          </form>
          <form action={excluirCaderno.bind(null, id)} className="mt-6 border-t border-slate-100 pt-4">
            <Confirmar texto="Excluir este caderno inteiro, com os módulos, as telas, as respostas dos clientes e o histórico? Não dá para desfazer." className={btn2 + " min-h-11"}>Excluir caderno</Confirmar>
          </form>
        </section>
      </main>
    </>
  );
}
