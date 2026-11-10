import Link from "next/link";
import AdminBar from "@/components/AdminBar";
import { btn, campo } from "@/components/estilos";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { entrar } from "./actions";

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Seus cadernos</h1>
          <Link href="/admin/novo" className={btn + " inline-flex min-h-11 items-center"}>+ Novo caderno</Link>
        </div>
        {cadernos.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold">Você ainda não tem nenhum caderno.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-700">Um caderno é o sistema inteiro. Dentro dele ficam os módulos (Financeiro, RH, Compras…) e, em cada módulo, as telas.</p>
            <Link href="/admin/novo" className={btn + " mt-4 inline-flex min-h-11 items-center"}>+ Novo caderno</Link>
          </div>
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
      </main>
    </>
  );
}
