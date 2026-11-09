import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import { btn, btn2, campo } from "@/components/estilos";
import { Confirmar } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { contextoDoCenario, envolveTela, ROTULO_TIPO, semAcento, type Cenario } from "@/lib/cenarios";
import { sql } from "@/lib/db";
import { duplicarCenario, mudarSituacaoCenario } from "../../cenario-actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/biblioteca">) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const sp = await searchParams;
  const q = um(sp.q).trim();
  const fModulo = um(sp.modulo);
  const fPerfil = um(sp.perfil);
  const fTela = um(sp.tela);
  const fSituacao = ["ativo", "arquivado", "todos"].includes(um(sp.situacao)) ? um(sp.situacao) : "ativo";

  const [cad] = await sql`select titulo from cadernos where id = ${id}`;
  if (!cad) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const telas = await sql`select id, titulo, modulo_id from telas where caderno_id = ${id}`;
  const rows = await sql`select id, titulo, objetivo, tipo, tela_id, passos, situacao, atualizado from cenarios where caderno_id = ${id} order by atualizado desc`;

  const moduloDaTela = new Map(telas.map((t) => [t.id as string, t.modulo_id as string]));
  const nomeModulo = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const nomeTela = new Map(telas.map((t) => [t.id as string, t.titulo as string]));
  const todos = rows.map((r) => {
    const c = { id: r.id as string, titulo: r.titulo as string, tipo: r.tipo, telaId: r.tela_id as string | null, passos: r.passos, situacao: r.situacao } as Pick<Cenario, "titulo" | "tipo" | "telaId" | "passos" | "situacao"> & { id: string };
    return { ...c, ...contextoDoCenario(c, moduloDaTela) };
  });
  const perfisDoCaderno = [...new Set(todos.flatMap((c) => c.perfis))].sort();
  const lista = todos.filter(
    (c) =>
      (fSituacao === "todos" || c.situacao === fSituacao) &&
      (!q || semAcento(c.titulo).includes(semAcento(q))) &&
      (!fModulo || c.modulos.includes(fModulo)) &&
      (!fPerfil || c.perfis.includes(fPerfil)) &&
      (!fTela || envolveTela(c, fTela)),
  );
  const filtrando = !!(q || fModulo || fPerfil || fTela || fSituacao !== "ativo");
  const aviso = sp.salvo ? "Cenário salvo." : sp.arquivado ? "Cenário arquivado. Para vê-lo, filtre por situação “Arquivados”." : sp.reativado ? "Cenário reativado." : null;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-800 hover:underline">← {cad.titulo}</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Biblioteca de testes</h1>
          <Link href={`/admin/${id}/biblioteca/novo`} className={btn + " inline-flex min-h-11 items-center"}>Novo cenário</Link>
        </div>
        <p className="mt-1 text-sm text-slate-700">Cenários de teste para reutilizar: de uma tela só ou de um fluxo que passa por módulos e perfis diferentes.</p>

        {aviso && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{aviso}</p>}
        {sp.erro === "cenario" && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">Esse cenário não existe mais. Confira a lista abaixo.</p>}

        <form method="get" className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Buscar cenários">
          <label className="block text-sm font-medium sm:col-span-2 lg:col-span-4">
            Buscar pelo título
            <input type="search" name="q" defaultValue={q} placeholder="Ex.: compra" className={campo + " min-h-11"} />
          </label>
          <label className="block text-sm font-medium">
            Módulo
            <select name="modulo" defaultValue={fModulo} className={campo + " min-h-11"}>
              <option value="">Todos</option>
              {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Perfil
            <select name="perfil" defaultValue={fPerfil} className={campo + " min-h-11"}>
              <option value="">Todos</option>
              {perfisDoCaderno.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Situação
            <select name="situacao" defaultValue={fSituacao} className={campo + " min-h-11"}>
              <option value="ativo">Ativos</option>
              <option value="arquivado">Arquivados</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className={btn2 + " min-h-11"}>Filtrar</button>
            {filtrando && <Link href={`/admin/${id}/biblioteca`} className={`inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`}>Limpar filtros</Link>}
          </div>
          {fTela && <input type="hidden" name="tela" value={fTela} />}
        </form>
        {fTela && <p className="mt-2 text-sm text-slate-700">Só os cenários que usam a tela “{nomeTela.get(fTela) ?? "removida"}”.</p>}

        <p role="status" className="mt-4 text-sm text-slate-700">{lista.length === 1 ? "1 cenário" : `${lista.length} cenários`}{filtrando ? " com estes filtros" : ""}.</p>

        {lista.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-800">
            {todos.length === 0 ? (
              <>
                <p className="font-semibold">A biblioteca ainda está vazia.</p>
                <p className="mt-1">Crie o primeiro cenário, ou abra o editor de uma tela que já tem roteiro e use “Criar cenário a partir deste roteiro”.</p>
                <Link href={`/admin/${id}/biblioteca/novo`} className={btn + " mt-3 inline-flex min-h-11 items-center"}>Novo cenário</Link>
              </>
            ) : (
              <p>Nenhum cenário encontrado com estes filtros. Tire algum filtro ou busque por outra palavra.</p>
            )}
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {lista.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words text-base font-semibold">
                    <Link href={`/admin/${id}/biblioteca/${c.id}`} className={`rounded text-indigo-900 hover:underline ${FOCO}`}>{c.titulo}</Link>
                  </h2>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.situacao === "ativo" ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : "bg-slate-100 text-slate-700 ring-slate-300"}`}>
                    {c.situacao === "ativo" ? "Ativo" : "Arquivado"}
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="font-medium text-slate-700">Tipo</dt>
                  <dd>{ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO]} · {c.passos.length} {c.passos.length === 1 ? "passo" : "passos"}</dd>
                  <dt className="font-medium text-slate-700">Módulos</dt>
                  <dd>{c.modulos.length ? c.modulos.map((m) => nomeModulo.get(m)).join(", ") : "Nenhum indicado"}</dd>
                  <dt className="font-medium text-slate-700">Perfis</dt>
                  <dd>{c.perfis.length ? c.perfis.join(", ") : "Nenhum indicado"}</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/${id}/biblioteca/${c.id}`} className={btn2 + " inline-flex min-h-11 items-center"}>Editar<span className="sr-only"> {c.titulo}</span></Link>
                  <form action={duplicarCenario.bind(null, id, c.id)}><button className={btn2 + " min-h-11"}>Duplicar<span className="sr-only"> {c.titulo}</span></button></form>
                  {c.situacao === "ativo" ? (
                    <form action={mudarSituacaoCenario.bind(null, id, c.id, "arquivado")}>
                      <Confirmar texto={`Arquivar “${c.titulo}”? Ele sai da lista padrão, mas nada é apagado e dá para reativar.`} className={btn2 + " min-h-11"}>Arquivar<span className="sr-only"> {c.titulo}</span></Confirmar>
                    </form>
                  ) : (
                    <form action={mudarSituacaoCenario.bind(null, id, c.id, "ativo")}><button className={btn2 + " min-h-11"}>Reativar<span className="sr-only"> {c.titulo}</span></button></form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
