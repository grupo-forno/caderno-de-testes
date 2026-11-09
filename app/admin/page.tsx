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
          {erro && <p role="alert" className="text-sm text-rose-700">Senha incorreta. Confira e tente de novo.</p>}
          <button className={btn + " w-full"}>Entrar</button>
        </form>
      </main>
    );
  }

  const cadernos = await sql`
    select c.id, c.titulo, c.versao, c.rodada, c.atualizado,
      (select count(*) from telas t where t.caderno_id = c.id)::int as telas,
      (select count(distinct r.email) from respostas r where r.caderno = c.slug)::int as pessoas
    from cadernos c order by c.atualizado desc`;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Seus cadernos</h1>
        {cadernos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Você ainda não tem nenhum caderno. Crie o primeiro abaixo.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {cadernos.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium">{c.titulo}</span>
                  <span className="text-sm text-slate-600">
                    Versão {c.versao} · Rodada {c.rodada} · {c.telas} {c.telas === 1 ? "tela" : "telas"} · {c.pessoas} {c.pessoas === 1 ? "pessoa respondeu" : "pessoas responderam"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-lg font-semibold">Novo caderno</h2>
        <form action={criarCaderno} className="mt-3 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">
            Nome do caderno
            <input name="titulo" required placeholder="Ex.: Módulo financeiro" className={campo} />
          </label>
          {erro === "titulo" && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">Escreva o nome do caderno.</p>}
          <label className="block text-sm font-medium">
            Versão
            <input name="versao" defaultValue="1.0" className={campo} />
          </label>
          <label className="block text-sm font-medium">
            Preparado por
            <input name="preparado_por" className={campo} />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Antes de começar (um item por linha)
            <textarea name="antes" rows={3} placeholder={"Um computador ou celular com internet.\nCerca de 30 minutos livres."} className={campo} />
          </label>
          <div className="sm:col-span-2"><button className={btn}>Criar caderno</button></div>
        </form>
      </main>
    </>
  );
}
