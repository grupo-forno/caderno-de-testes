import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import ListaInstrucoes from "@/components/ListaInstrucoes";
import ListaModulos from "@/components/ListaModulos";
import { btn, btn2, campo } from "@/components/estilos";
import { ehAdmin } from "@/lib/admin";
import { criarCaderno } from "../actions";

export const dynamic = "force-dynamic";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default async function Page({ searchParams }: PageProps<"/admin/novo">) {
  if (!(await ehAdmin())) redirect("/admin");
  const { erro } = await searchParams;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/admin" className="text-sm text-indigo-800 hover:underline">← Voltar aos cadernos</Link>
        <h1 className="mt-2 text-2xl font-semibold">Novo caderno</h1>
        <p className="mt-1 text-sm text-slate-700">Um caderno é o sistema inteiro. Dentro dele ficam os módulos (Financeiro, RH, Compras…) e, em cada módulo, as telas. Só o nome é obrigatório: o resto dá para completar depois.</p>

        <form action={criarCaderno} className="mt-5 space-y-6">
          <section aria-labelledby="t-basico" className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-basico" className="font-semibold">Dados básicos</h2>
            <label className="block text-sm font-medium">
              Nome do sistema <span className="font-normal text-slate-600">(obrigatório)</span>
              <input name="titulo" required autoFocus aria-invalid={erro === "titulo" || undefined} aria-describedby={erro === "titulo" ? "erro-titulo" : undefined} placeholder="Ex.: Sistema de gestão" className={campo + " min-h-11"} />
            </label>
            {erro === "titulo" && <p id="erro-titulo" role="alert" className="text-sm text-rose-800">Escreva o nome do caderno para continuar.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Versão
                <input name="versao" defaultValue="1.0" className={campo + " min-h-11"} />
              </label>
              <label className="block text-sm font-medium">
                Preparado por
                <input name="preparado_por" className={campo + " min-h-11"} />
              </label>
            </div>
          </section>

          <section aria-labelledby="t-modulos" className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-modulos" className="font-semibold">Módulos <span className="text-sm font-normal text-slate-600">(opcional)</span></h2>
            <p className="mb-3 mt-1 text-sm text-slate-700">Cada módulo é uma área do sistema. Você pode adicionar mais, renomear e reordenar depois.</p>
            <ListaModulos campo="modulos" />
          </section>

          <section aria-labelledby="t-antes" className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 id="t-antes" className="font-semibold">Antes de começar <span className="text-sm font-normal text-slate-600">(opcional)</span></h2>
            <div className="mt-1">
              <ListaInstrucoes campo="antes" inicial={[]} />
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button className={`${btn} min-h-11 ${FOCO}`}>Criar caderno</button>
            <Link href="/admin" className={`${btn2} inline-flex min-h-11 items-center ${FOCO}`}>Cancelar</Link>
          </div>
        </form>
      </main>
    </>
  );
}
