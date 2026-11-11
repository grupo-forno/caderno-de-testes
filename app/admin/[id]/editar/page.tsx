import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import Aviso from "@/components/Aviso";
import BotaoEnviar from "@/components/BotaoEnviar";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Campo from "@/components/Campo";
import Secao from "@/components/Secao";
import { botao } from "@/components/estilos";
import { Confirmar } from "@/components/ui";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { excluirCaderno, salvarCaderno } from "../../actions";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/editar">) {
  await exigirAdmin();
  const { id } = await params;
  const { erro, salvo } = await searchParams;
  const [c] = await sql`select * from cadernos where id::text = ${id}`;
  if (!c) notFound();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <CabecalhoPagina migalhas={[{ rotulo: "Seus cadernos", href: "/admin" }, { rotulo: c.titulo, href: `/admin/${id}` }, { rotulo: "Editar caderno" }]} titulo="Editar caderno" descricao="Dados gerais, endereço do ambiente e instruções que o cliente lê antes de começar." />
        {salvo && <Aviso tom="sucesso" className="mb-4">Alterações salvas.</Aviso>}

        <form action={salvarCaderno.bind(null, id)} className="space-y-6">
          <Secao id="t-dados" titulo="Dados gerais">
            <div className="space-y-4">
              <Campo rotulo="Nome do sistema" nome="titulo" obrigatorio defaultValue={c.titulo} erro={erro === "titulo" ? "Escreva o nome do caderno para continuar." : null} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Versão" nome="versao" defaultValue={c.versao} />
                <Campo rotulo="Preparado por" nome="preparado_por" defaultValue={c.preparado_por} />
              </div>
            </div>
          </Secao>

          <Secao id="t-ambiente" titulo="Ambiente de homologação" opcional descricao="O validador vê o botão “Abrir ambiente de teste” logo na entrada do caderno, e as telas usam este endereço junto com o caminho no menu.">
            <Campo rotulo="Endereço do ambiente" nome="ambiente_url" type="url" defaultValue={c.ambiente_url ?? ""} placeholder="https://" erro={erro === "ambiente" ? "O endereço precisa começar com https:// (ou http://). Confira e salve de novo." : null} />
          </Secao>

          <div className="flex flex-wrap gap-3">
            <BotaoEnviar>Salvar alterações</BotaoEnviar>
            <Link href={`/admin/${id}`} className={botao("secundario")}>Voltar à visão geral</Link>
          </div>
        </form>

        <div className="mt-8">
          <Secao id="t-risco" titulo="Excluir caderno" descricao="Apaga o caderno inteiro, com os módulos, as telas, as respostas dos clientes e o histórico. Não dá para desfazer.">
            <form action={excluirCaderno.bind(null, id)}>
              <Confirmar ok="Excluir caderno" perigo texto="Excluir este caderno inteiro, com os módulos, as telas, as respostas dos clientes e o histórico? Não dá para desfazer." className={botao("destrutivo")}>
                <Trash2 aria-hidden="true" />
                Excluir caderno
              </Confirmar>
            </form>
          </Secao>
        </div>
      </div>
    </main>
  );
}
