import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronRight, CircleCheck, FileUp, Hourglass, LayoutList, Pencil, Plus } from "lucide-react";
import Aviso from "@/components/Aviso";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Secao from "@/components/Secao";
import { botao, FOCO } from "@/components/estilos";
import { exigirAdmin } from "@/lib/admin";
import { sql, tabelasFaltando } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]">) {
  await exigirAdmin();
  const { id } = await params;
  const { salvo, criado } = await searchParams;
  const [c] = await sql`select * from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const telas = await sql`select id, titulo, itens from telas where caderno_id = ${id}`;
  const nModulos = (await sql`select count(*)::int as n from modulos where caderno_id = ${id}`)[0].n as number;

  // Pendências das homologações (só se o banco já tem as tabelas)
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
  const destinoCorrigir = pend.rodadaCorrigir ? `${base}/rodadas/${pend.rodadaCorrigir}/pendencias` : `${base}/rodadas`;
  const destinoReteste = pend.rodadaReteste ? `${base}/rodadas/${pend.rodadaReteste}/pendencias?situacao=aguardando_reteste` : `${base}/rodadas`;

  // Próximos passos: só o que ainda falta, cada um com o caminho para resolver
  const semFuncionalidade = telas.filter((t) => !(t.itens as unknown[]).length).length;
  const semRoteiro = telas.reduce((s, t) => s + (t.itens as { passos?: unknown[] }[]).filter((i) => !i.passos?.length).length, 0);
  const passos: { texto: string; href: string }[] = [];
  if (nModulos === 0) passos.push({ texto: "Adicionar o primeiro módulo", href: `${base}/estrutura#adicionar-modulos` });
  else if (telas.length === 0) passos.push({ texto: "Cadastrar a primeira tela", href: `${base}/tela/nova` });
  if (semFuncionalidade > 0 && telas.length > 0) passos.push({ texto: `${semFuncionalidade} ${semFuncionalidade === 1 ? "tela ainda está" : "telas ainda estão"} em preparação: cadastrar as funcionalidades`, href: `${base}/estrutura` });
  if (semRoteiro > 0) passos.push({ texto: `${semRoteiro} ${semRoteiro === 1 ? "funcionalidade está" : "funcionalidades estão"} sem roteiro de teste: escrever os passos`, href: `${base}/estrutura` });
  if (telas.length > 0 && pend.rodadas === 0 && !(await tabelasFaltando(["rodadas"])).length) passos.push({ texto: "Criar a primeira homologação e enviar aos validadores", href: `${base}/rodadas` });

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

        <section aria-label="Indicadores do caderno" className="flex flex-wrap divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:divide-x sm:divide-y-0">
          {indicador(`${base}/estrutura`, telas.length, "Telas cadastradas", `${nModulos} ${nModulos === 1 ? "módulo" : "módulos"}`, <LayoutList />, "bg-slate-100 text-slate-700")}
          {indicador(destinoCorrigir, pend.corrigir, "Para corrigir", pend.corrigir ? "Falhas esperando ajuste da equipe" : "Nada esperando ajuste", <AlertTriangle />, pend.corrigir ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")}
          {indicador(destinoReteste, pend.reteste, "Aguardando reteste", pend.reteste ? "Corrigido, falta o validador testar de novo" : "Nada esperando reteste", <Hourglass />, pend.reteste ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-700")}
        </section>

        <div className="mt-6">
          <Secao id="t-proximos" titulo="Próximos passos">
            {passos.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-800"><CircleCheck aria-hidden="true" className="size-4 text-emerald-700" />Tudo preparado por enquanto.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {passos.map((p) => (
                  <li key={p.texto}>
                    <Link href={p.href} className={`flex min-h-11 items-center justify-between gap-3 rounded text-sm hover:text-brand-900 ${FOCO}`}>
                      <span>{p.texto}</span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </main>
  );
}
