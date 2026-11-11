import Link from "next/link";
import { notFound } from "next/navigation";
import CenarioForm, { type InicialCenario } from "@/components/CenarioForm";
import { exigirAdmin } from "@/lib/admin";
import { type PassoCenario } from "@/lib/cenarios";
import { sql } from "@/lib/db";
import { salvarCenario } from "../../../cenario-actions";

export const dynamic = "force-dynamic";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/biblioteca/[cenarioId]">) {
  await exigirAdmin();
  const { id, cenarioId } = await params;
  const { erro, copia } = await searchParams;
  if (!ehUuid(id)) notFound();
  const nova = cenarioId === "novo";
  if (!nova && !ehUuid(cenarioId)) notFound();

  const [c] = await sql`select titulo from cadernos where id = ${id}`;
  if (!c) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const telas = await sql`select id, titulo, modulo_id, pai_id, imagem_url, link_url, itens from telas where caderno_id = ${id} order by ordem`;
  const nomeModulo = new Map(modulos.map((m) => [m.id as string, m.titulo as string]));
  const todos = await sql`select passos from cenarios where caderno_id = ${id}`;
  const perfis = [...new Set(todos.flatMap((x) => (x.passos as PassoCenario[]).map((p) => p.perfil)).filter(Boolean))].sort();

  let inicial: InicialCenario = { titulo: "", objetivo: "", tipo: "funcional", preRequisitos: "", dadosTeste: "", telaId: null, passos: [], origemItem: null };
  let aviso: string | undefined;
  let situacao = "ativo";
  if (!nova) {
    const [x] = await sql`select * from cenarios where id = ${cenarioId} and caderno_id = ${id}`;
    if (!x) notFound();
    situacao = x.situacao;
    inicial = { titulo: x.titulo, objetivo: x.objetivo, tipo: x.tipo, preRequisitos: x.pre_requisitos, dadosTeste: x.dados_teste, telaId: x.tela_id, passos: x.passos, origemItem: x.origem_item };
    if (copia === "1") aviso = "Esta é uma cópia editável. Ajuste o que precisar e salve.";
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/admin/${id}/biblioteca`} className="text-sm text-indigo-800 hover:underline">← Biblioteca de testes</Link>
        <h1 className="mt-2 text-2xl font-semibold">{nova ? "Novo cenário" : "Editar cenário"}</h1>
        {situacao === "arquivado" && <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">Este cenário está arquivado. Ele não aparece na lista padrão. Para reativar, use o filtro “Arquivados” na biblioteca.</p>}
        <div className="mt-5">
          <CenarioForm
            key={cenarioId}
            acao={salvarCenario.bind(null, id, nova ? null : cenarioId)}
            inicial={inicial}
            telas={telas.map((t) => ({ id: t.id, titulo: (t.pai_id ? "Pop-up: " : "") + t.titulo, modulo: nomeModulo.get(t.modulo_id) ?? "Sem módulo" }))}
            perfis={perfis}
            erro={typeof erro === "string" ? erro : undefined}
            textoAviso={aviso}
          />
        </div>
      </main>
    </>
  );
}
