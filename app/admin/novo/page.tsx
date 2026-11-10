import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Campo from "@/components/Campo";
import ListaInstrucoes from "@/components/ListaInstrucoes";
import ListaModulos from "@/components/ListaModulos";
import Secao from "@/components/Secao";
import { botao } from "@/components/estilos";
import { ehAdmin } from "@/lib/admin";
import { criarCaderno } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/admin/novo">) {
  if (!(await ehAdmin())) redirect("/admin");
  const { erro } = await searchParams;

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <CabecalhoPagina
          voltar={{ href: "/admin", rotulo: "Voltar aos cadernos" }}
          titulo="Novo caderno"
          descricao="Um caderno é o sistema inteiro. Dentro dele ficam os módulos (Financeiro, RH, Compras…) e, em cada módulo, as telas. Só o nome é obrigatório: o resto dá para completar depois."
        />

        <form action={criarCaderno} className="space-y-6">
          <Secao id="t-basico" titulo="Dados básicos">
            <div className="space-y-4">
              <Campo rotulo="Nome do sistema" nome="titulo" obrigatorio autoFocus placeholder="Ex.: Sistema de gestão" erro={erro === "titulo" ? "Escreva o nome do caderno para continuar." : null} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Versão" nome="versao" defaultValue="1.0" />
                <Campo rotulo="Preparado por" nome="preparado_por" />
              </div>
            </div>
          </Secao>

          <Secao id="t-modulos" titulo="Módulos" opcional descricao="Cada módulo é uma área do sistema. Você pode adicionar mais, renomear e reordenar depois.">
            <ListaModulos campo="modulos" />
          </Secao>

          <Secao id="t-antes" titulo="Antes de começar" opcional>
            <ListaInstrucoes campo="antes" inicial={[]} />
          </Secao>

          <div className="flex flex-wrap gap-3">
            <BotaoEnviar pendente="Criando…">Criar caderno</BotaoEnviar>
            <Link href="/admin" className={botao("secundario")}>Cancelar</Link>
          </div>
        </form>
      </main>
    </>
  );
}
