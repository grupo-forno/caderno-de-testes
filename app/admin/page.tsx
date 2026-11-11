import Link from "next/link";
import { BookOpen, ClipboardList, LogIn, Plus } from "lucide-react";
import Logo from "@/components/Logo";
import AdminBar from "@/components/AdminBar";
import Aviso from "@/components/Aviso";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Campo from "@/components/Campo";
import EstadoVazio from "@/components/EstadoVazio";
import MenuAcoes from "@/components/MenuAcoes";
import { botao } from "@/components/estilos";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { entrar } from "./actions";

export const dynamic = "force-dynamic";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function Page({ searchParams }: PageProps<"/admin">) {
  const { erro } = await searchParams;

  if (!(await ehAdmin())) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Logo sub tamanho="size-12" className="mb-8" />
        <h1 className="text-xl font-semibold">Área de quem monta os cadernos</h1>
        <form action={entrar} className="mt-5 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <Campo rotulo="Senha" nome="senha" type="password" autoComplete="current-password" obrigatorio autoFocus />
          {erro === "espere" ? (
            <Aviso tom="erro">Muitas tentativas seguidas. Espere 15 minutos e tente de novo.</Aviso>
          ) : erro ? (
            <Aviso tom="erro">Senha incorreta. Confira e tente de novo.</Aviso>
          ) : null}
          <BotaoEnviar pendente="Entrando…" className="w-full">
            <LogIn aria-hidden="true" />
            Entrar
          </BotaoEnviar>
        </form>
      </main>
    );
  }

  const cadernos = await sql`
    select c.id, c.titulo, c.versao, c.atualizado,
      (select count(*) from modulos m where m.caderno_id = c.id)::int as modulos,
      (select count(*) from telas t where t.caderno_id = c.id)::int as telas,
      (select coalesce(sum(jsonb_array_length(t.itens)), 0) from telas t where t.caderno_id = c.id)::int as funcionalidades
    from cadernos c order by c.atualizado desc`;

  const novo = (
    <Link href="/admin/novo" className={botao("primario")}>
      <Plus aria-hidden="true" />
      Novo caderno
    </Link>
  );

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <CabecalhoPagina titulo="Seus cadernos" acoes={novo} />
        {cadernos.length === 0 ? (
          <EstadoVazio icone={BookOpen} titulo="Você ainda não tem nenhum caderno." acao={novo}>
            Um caderno é o sistema inteiro. Dentro dele ficam os módulos (Financeiro, RH, Compras…) e, em cada módulo, as telas.
          </EstadoVazio>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {cadernos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-64">
                  <Link href={`/admin/${c.id}`} className="break-words font-semibold text-brand-900 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    {c.titulo}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-700">
                    Versão {c.versao} · {plural(c.modulos, "módulo", "módulos")} · {plural(c.telas, "tela", "telas")} · {plural(c.funcionalidades, "funcionalidade", "funcionalidades")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <MenuAcoes
                    rotulo={`Mais ações do caderno ${c.titulo}`}
                    itens={[
                      { rotulo: "Rodadas de homologação", href: `/admin/${c.id}/rodadas`, icone: <ClipboardList /> },
                      { rotulo: "Fluxos entre telas", href: `/admin/${c.id}/biblioteca`, icone: <BookOpen /> },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
