import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleDashed, CornerDownRight, FileUp, LayoutList, ListPlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Aviso from "@/components/Aviso";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import EstadoVazio from "@/components/EstadoVazio";
import Etiqueta from "@/components/Etiqueta";
import ListaModulos from "@/components/ListaModulos";
import MenuAcoes from "@/components/MenuAcoes";
import { botao, campo } from "@/components/estilos";
import { Confirmar } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { acessoDaTela, modoDaTela } from "@/lib/acesso";
import { semAcento } from "@/lib/cenarios";
import { sql } from "@/lib/db";
import type { Tela } from "@/lib/tipos";
import { criarModulos, criarTelasEmLote, excluirModulo, excluirTela, moverModulo, moverTela, renomearModulo } from "../../actions";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  modulos: "Escreva pelo menos um nome de módulo e clique em Adicionar antes de salvar.",
  modulos_repetidos: "Todos esses nomes já existem neste caderno, então nada foi criado.",
  modulo_nome: "Escreva o novo nome do módulo.",
  modulo: "Esse módulo não existe mais. Recarregue a página e confira a lista.",
  telas: "Escreva pelo menos um nome de tela (um por linha).",
  tela: "Esta tela foi excluída em outro lugar, então não foi possível salvar. Confira a lista abaixo.",
};
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/estrutura">) {
  await exigirAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const [c] = await sql`select slug, titulo, ambiente_url from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const rows = await sql`select * from telas where caderno_id = ${id} order by ordem`;
  const telas: Tela[] = rows.map((x) => ({ id: x.id, moduloId: x.modulo_id, titulo: x.titulo, imagem: x.imagem_url, link: x.link_url, pdf: x.pdf_url, itens: x.itens, paiId: x.pai_id, caminho: x.caminho_menu ?? "", modo: x.modo_teste ?? undefined }));

  const q = um(sp.q).trim();
  const fModulo = modulos.some((m) => m.id === um(sp.modulo)) ? um(sp.modulo) : "";
  const filtrando = !!(q || fModulo);
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(fModulo ? { modulo: fModulo } : {}) }).toString(); // o editor leva isto de volta para cá
  // links para o editor levam a busca e o filtro atuais, para o editor voltar para esta mesma lista
  const comVolta = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(extra);
    if (qs) p.set("volta", qs);
    return p.size ? `?${p}` : "";
  };
  const bate = (t: Tela) => !q || semAcento(t.titulo).includes(semAcento(q));
  const erro = um(sp.erro);
  const erroModulos = erro === "modulos" || erro === "modulos_repetidos";
  const ignorados = um(sp.ignorados).split("\n").filter(Boolean).slice(0, 10);
  const base = `/admin/${id}`;

  // o que aparece: tela que bate com a busca, com os pop-ups dela; ou tela que só tem pop-up que bate (para dar contexto)
  const visiveis = modulos
    .filter((m) => !fModulo || m.id === fModulo)
    .map((m) => {
      const doModulo = telas.filter((t) => t.moduloId === m.id);
      const principais = doModulo.filter((t) => !t.paiId);
      const linhas = principais.flatMap((t, ti) => {
        const filhos = doModulo.filter((f) => f.paiId === t.id);
        const mostrados = bate(t) ? filhos : filhos.filter(bate);
        if (!bate(t) && !mostrados.length) return [];
        return [
          { t, nivel: 0, pos: ti, total: principais.length, filhos: filhos.length, pai: "" },
          ...mostrados.map((f) => ({ t: f, nivel: 1, pos: filhos.indexOf(f), total: filhos.length, filhos: 0, pai: t.titulo })),
        ];
      });
      return { m, linhas, principais: principais.length, popups: doModulo.length - principais.length };
    })
    .filter((x) => !q || x.linhas.length > 0);

  const novaHref = `${base}/tela/nova${comVolta(fModulo ? { modulo: fModulo } : {})}`;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <CabecalhoPagina
          migalhas={[{ rotulo: "Seus cadernos", href: "/admin" }, { rotulo: c.titulo, href: base }, { rotulo: "Estrutura" }]}
          titulo="Estrutura"
          descricao="Módulos, telas e pop-ups do caderno. Abra uma tela para preparar os testes dela."
          acoes={
            <>
              <Link href={`${base}/importar`} className={botao("secundario")}>
                <FileUp aria-hidden="true" />
                Importar CSV
              </Link>
              <Link href={novaHref} className={botao("primario")}>
                <Plus aria-hidden="true" />
                Nova tela
              </Link>
            </>
          }
        />

        {sp.salvo && <Aviso tom="sucesso" className="mb-4">Salvo.</Aviso>}
        {sp.importado && <Aviso tom="sucesso" className="mb-4">Planilha importada.</Aviso>}
        {ignorados.length > 0 && <Aviso tom="alerta" className="mb-4">{ignorados.length === 1 ? "Este nome já existia e foi ignorado" : "Estes nomes já existiam e foram ignorados"}: {ignorados.join(", ")}.</Aviso>}
        {erro && !erroModulos && ERROS[erro] && <Aviso tom="erro" className="mb-4">{ERROS[erro]}</Aviso>}

        <form key={qs} method="get" role="search" aria-label="Buscar e filtrar telas" className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="busca" className="block text-xs font-medium text-slate-700">Buscar tela</label>
            <div className="relative mt-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input id="busca" type="search" name="q" defaultValue={q} placeholder="Ex.: Pedidos" className={`${campo} mt-0 min-h-11 pl-9 sm:min-h-10`} />
            </div>
          </div>
          <div>
            <label htmlFor="filtro-modulo" className="block text-xs font-medium text-slate-700">Módulo</label>
            <select id="filtro-modulo" name="modulo" defaultValue={fModulo} className={`${campo} mt-1 min-h-11 sm:min-h-10`}>
              <option value="">Todos os módulos</option>
              {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </div>
          <button className={botao("secundario")}>Filtrar</button>
          {filtrando && (
            <Link href={`${base}/estrutura`} className={botao("discreto")}>
              <X aria-hidden="true" />
              Limpar filtros
            </Link>
          )}
        </form>

        <details id="adicionar-modulos" className="mt-4 scroll-mt-4" open={modulos.length === 0 || erroModulos}>
          <summary className={botao("secundario", "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <ListPlus aria-hidden="true" />
            Adicionar módulos
          </summary>
          <form action={criarModulos.bind(null, id)} className="mt-2 space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
            <ListaModulos campo="titulos" existentes={modulos.map((m) => m.titulo as string)} />
            {erroModulos && <Aviso tom="erro">{ERROS[erro]}</Aviso>}
            <BotaoEnviar pendente="Salvando módulos…">Salvar módulos</BotaoEnviar>
          </form>
        </details>

        {modulos.length === 0 ? (
          <div className="mt-6">
            <EstadoVazio icone={LayoutList} titulo="Este caderno ainda não tem módulos." acao={<a href="#adicionar-modulos" className={botao("primario")}><Plus aria-hidden="true" />Adicionar primeiro módulo</a>}>
              Os módulos são as áreas do sistema (Financeiro, RH, Compras…). As telas ficam dentro deles.
            </EstadoVazio>
          </div>
        ) : visiveis.length === 0 ? (
          <div className="mt-6">
            <EstadoVazio icone={Search} titulo="Nenhuma tela encontrada." acao={<Link href={`${base}/estrutura`} className={botao("secundario")}>Limpar filtros</Link>}>
              Nenhuma tela bate com {q ? `“${q}”` : "o filtro escolhido"}.
            </EstadoVazio>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {visiveis.map(({ m, linhas, principais, popups }, mi) => (
              <article key={m.id} aria-labelledby={`m-${m.id}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <h2 id={`m-${m.id}`} className="break-words text-base font-semibold">{m.titulo}</h2>
                    <p className="text-xs text-slate-700">{plural(principais, "tela", "telas")}{popups > 0 ? ` e ${plural(popups, "pop-up", "pop-ups")}` : ""}</p>
                  </div>
                  <Link href={`${base}/tela/nova${comVolta({ modulo: m.id })}`} className={botao("secundario")}>
                    <Plus aria-hidden="true" />
                    Adicionar tela
                  </Link>
                  <MenuAcoes
                    rotulo={`Mais ações do módulo ${m.titulo}`}
                    itens={[
                      { rotulo: "Mover para cima", icone: <ArrowUp />, acao: moverModulo.bind(null, id, m.id, -1), desabilitada: mi === 0 && !filtrando },
                      { rotulo: "Mover para baixo", icone: <ArrowDown />, acao: moverModulo.bind(null, id, m.id, 1), desabilitada: mi === visiveis.length - 1 && !filtrando },
                    ]}
                  />
                </div>

                {linhas.length === 0 ? (
                  <div className="px-4 py-6">
                    <EstadoVazio icone={LayoutList} titulo="Este módulo ainda não tem telas." acao={<Link href={`${base}/tela/nova${comVolta({ modulo: m.id })}`} className={botao("primario")}><Plus aria-hidden="true" />Adicionar tela</Link>}>
                      Cadastre a primeira tela ou crie várias de uma vez, só com o nome.
                    </EstadoVazio>
                  </div>
                ) : (
                  <>
                    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_auto] gap-4 border-b border-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 md:grid">
                      <span>Tela</span>
                      <span>Funcionalidades e testes</span>
                      <span className="w-[8.5rem]" />
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {linhas.map(({ t, nivel, pos, total, filhos, pai }) => {
                                        const semRoteiro = t.itens.filter((i) => !i.passos?.length).length;
                        const passos = t.itens.reduce((s, i) => s + (i.passos?.length ?? 0), 0);
                        const acesso = acessoDaTela(t, c.ambiente_url, pai || null);
                        const editar = `${base}/tela/${t.id}${comVolta()}`;
                        return (
                          <li key={t.id} className="grid items-center gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_auto]">
                            <div className={`min-w-0 ${nivel ? "pl-5" : ""}`}>
                              <p className="flex items-start gap-1.5 break-words font-medium">
                                {nivel > 0 && <CornerDownRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-500" />}
                                <Link href={editar} className="rounded text-indigo-900 underline decoration-indigo-300 underline-offset-4 hover:decoration-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{t.titulo}</Link>
                              </p>
                              <p className="mt-0.5 text-xs text-slate-700">
                                {nivel > 0 ? `Pop-up de “${pai}”` : modoDaTela(t) === "funcional" ? "Teste funcional" : "Revisão de desenho"}
                                {acesso.tipo === "incompleto" && <span className="font-medium text-amber-900"> · falta explicar como abrir</span>}
                                {!t.imagem && <span> · sem imagem</span>}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              {t.itens.length === 0 ? (
                                <Etiqueta icone={CircleDashed}>Em preparação</Etiqueta>
                              ) : semRoteiro > 0 ? (
                                <Etiqueta tom="alerta" icone={AlertTriangle}>Sem roteiro em {semRoteiro}</Etiqueta>
                              ) : (
                                <Etiqueta tom="sucesso" icone={CheckCircle2}>Roteiro completo</Etiqueta>
                              )}
                              <span className="text-xs text-slate-700">{plural(t.itens.length, "funcionalidade", "funcionalidades")} · {plural(passos, "passo", "passos")}</span>
                            </div>
                            <div className="flex items-center gap-2 md:justify-end">
                              <Link href={editar} className={botao("secundario")}>
                                <Pencil aria-hidden="true" />
                                Editar<span className="sr-only"> {t.titulo}</span>
                              </Link>
                              <MenuAcoes
                                rotulo={`Mais ações de ${t.titulo}`}
                                itens={[
                                  ...(nivel === 0 ? [{ rotulo: "Adicionar pop-up", icone: <Plus />, href: `${base}/tela/nova${comVolta({ pai: t.id })}` }] : []),
                                  { rotulo: "Mover para cima", icone: <ArrowUp />, acao: moverTela.bind(null, id, t.id, -1), desabilitada: pos === 0 },
                                  { rotulo: "Mover para baixo", icone: <ArrowDown />, acao: moverTela.bind(null, id, t.id, 1), desabilitada: pos === total - 1 },
                                  {
                                    rotulo: nivel ? "Excluir pop-up" : "Excluir tela",
                                    icone: <Trash2 />,
                                    perigo: true,
                                    acao: excluirTela.bind(null, id, t.id),
                                    confirmar: `Excluir ${nivel ? "o pop-up" : "a tela"} “${t.titulo}”${filhos ? ` e os ${filhos} pop-ups dela` : ""}? Não dá para desfazer. As respostas dos clientes às funcionalidades ${filhos ? "dessas telas" : "dela"} continuam guardadas e passam a aparecer em “Respostas de funcionalidades removidas”.`,
                                  },
                                ]}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3">
                  <details className="min-w-0 flex-1 basis-64">
                    <summary className={botao("discreto", "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
                      <ListPlus aria-hidden="true" />
                      Criar várias telas de uma vez
                    </summary>
                    <form action={criarTelasEmLote.bind(null, id, m.id)} className="mt-2 space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
                      <label className="block text-sm font-medium">
                        Uma tela por linha (só o nome)
                        <textarea name="titulos" rows={4} required placeholder={"Relatório de pedidos\nCadastro de clientes"} className={campo} />
                      </label>
                      <BotaoEnviar pendente="Criando telas…">Criar telas</BotaoEnviar>
                    </form>
                  </details>
                  <details className="min-w-0 flex-1 basis-64">
                    <summary className={botao("discreto", "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
                      <Pencil aria-hidden="true" />
                      Renomear ou excluir o módulo
                    </summary>
                    <div className="mt-2 space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
                      <form action={renomearModulo.bind(null, id, m.id)} className="flex flex-wrap items-end gap-2">
                        <label className="min-w-0 flex-1 text-sm font-medium">
                          Novo nome
                          <input name="titulo" required defaultValue={m.titulo} className={`${campo} min-h-11 sm:min-h-10`} />
                        </label>
                        <BotaoEnviar variante="secundario" pendente="Renomeando…">Renomear</BotaoEnviar>
                      </form>
                      <form action={excluirModulo.bind(null, id, m.id)}>
                        <Confirmar ok="Excluir módulo" perigo texto={`Excluir o módulo “${m.titulo}”, com as ${popups + principais} telas e pop-ups dele, e também as respostas e o histórico dos clientes dessas telas? Não dá para desfazer.`} className={botao("destrutivo")}>
                          <Trash2 aria-hidden="true" />
                          Excluir módulo e tudo dentro dele
                        </Confirmar>
                      </form>
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
