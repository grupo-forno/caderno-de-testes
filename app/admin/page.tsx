import Link from "next/link";
import AdminBar from "@/components/AdminBar";
import { btn, campo } from "@/components/ui";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { criarCaderno, entrar } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin">) {
  const { erro } = await searchParams;

  if (!(await ehAdmin())) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-xl font-semibold">Área de quem monta os cadernos</h1>
        <form action={entrar} className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <label className="block text-sm font-medium">
            Senha
            <input name="senha" type="password" required autoFocus className={campo} />
          </label>
          {erro === "espere" ? (
            <p role="alert" className="text-sm text-rose-800">Muitas tentativas seguidas. Espere 15 minutos e tente de novo.</p>
          ) : erro ? (
            <p role="alert" className="text-sm text-rose-800">Senha incorreta. Confira e tente de novo.</p>
          ) : null}
          <button className={btn + " min-h-11 w-full"}>Entrar</button>
        </form>
      </main>
    );
  }

  const cadernos = await sql`
    select c.id, c.titulo, c.versao, c.atualizado,
      (select count(*) from modulos m where m.caderno_id = c.id)::int as modulos,
      (select count(*) from telas t where t.caderno_id = c.id)::int as telas,
      (select coalesce(sum(jsonb_array_length(t.itens)), 0) from telas t where t.caderno_id = c.id)::int as funcionalidades,
      (select count(distinct r.item) from respostas_item r
         where r.caderno = c.slug and r.resultado = 'nao_ok'
           and r.item in (select e->>'id' from telas t, jsonb_array_elements(t.itens) e where t.caderno_id = c.id))::int as nao_ok,
      (select count(distinct r.email) from respostas_item r where r.caderno = c.slug)::int as pessoas
    from cadernos c order by c.atualizado desc`;

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Seus cadernos</h1>
        {cadernos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-700">Você ainda não tem nenhum caderno. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {cadernos.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/${c.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600">
                  <span className="font-medium">{c.titulo}</span>
                  <span className="text-sm text-slate-700">
                    Versão {c.versao} · {plural(c.modulos, "módulo", "módulos")} · {plural(c.telas, "tela", "telas")} · {plural(c.funcionalidades, "funcionalidade", "funcionalidades")} ·{" "}
                    {c.pessoas} {c.pessoas === 1 ? "pessoa respondeu" : "pessoas responderam"}
                    {c.nao_ok > 0 && <strong className="text-rose-800"> · {c.nao_ok} NÃO OK para corrigir</strong>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-lg font-semibold">Novo caderno</h2>
        <p className="mt-1 text-sm text-slate-700">Um caderno é o sistema inteiro. Dentro dele ficam os módulos (Financeiro, RH, Compras…) e, em cada módulo, as telas.</p>
        <form action={criarCaderno} className="mt-3 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">
            Nome do sistema
            <input name="titulo" required placeholder="Ex.: Sistema de gestão" className={campo} />
          </label>
          {erro === "titulo" && <p role="alert" className="text-sm text-rose-800 sm:col-span-2">Escreva o nome do caderno.</p>}
          <label className="block text-sm font-medium">
            Versão
            <input name="versao" defaultValue="1.0" className={campo} />
          </label>
          <label className="block text-sm font-medium">
            Preparado por
            <input name="preparado_por" className={campo} />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Módulos (um por linha, opcional)
            <textarea name="modulos" rows={4} placeholder={"Menu inicial\nFinanceiro\nRH\nCompras\nEstoque"} className={campo} />
            <span className="mt-1 block text-xs font-normal text-slate-700">Se preferir, deixe vazio e crie os módulos depois, na página do caderno.</span>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Antes de começar (um item por linha)
            <textarea name="antes" rows={3} placeholder={"Um computador ou celular com internet.\nCerca de 30 minutos livres."} className={campo} />
          </label>
          <div className="sm:col-span-2"><button className={btn + " min-h-11"}>Criar caderno</button></div>
        </form>
      </main>
    </>
  );
}
