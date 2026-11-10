import { notFound } from "next/navigation";
import EditorTela, { type DadosTela } from "@/components/EditorTela";
import { exigirAdmin } from "@/lib/admin";
import { modoDaTela } from "@/lib/acesso";
import { envolveTela, type Cenario } from "@/lib/cenarios";
import { sql } from "@/lib/db";
import { salvarTela } from "../../../actions";

export const dynamic = "force-dynamic";

const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/tela/[telaId]">) {
  await exigirAdmin();
  const { id, telaId } = await params;
  const sp = await searchParams;
  const nova = telaId === "nova";
  const [cad] = await sql`select ambiente_url from cadernos where id::text = ${id}`;
  if (!cad) notFound();
  const modulos = await sql`select id, titulo from modulos where caderno_id::text = ${id} order by ordem`;
  let inicial: DadosTela = { titulo: "", moduloId: "", paiId: null, modo: "funcional", link: "", caminho: "", imagem: "", pdf: "", itens: [] };
  let temFilhos = false;
  if (!nova) {
    const [t] = await sql`select * from telas where id::text = ${telaId} and caderno_id::text = ${id}`;
    if (!t) notFound();
    inicial = {
      titulo: t.titulo,
      moduloId: t.modulo_id ?? "",
      paiId: t.pai_id,
      modo: modoDaTela({ modo: t.modo_teste, link: t.link_url }),
      link: t.link_url ?? "",
      caminho: t.caminho_menu ?? "",
      imagem: t.imagem_url ?? "",
      pdf: t.pdf_url ?? "",
      itens: t.itens,
    };
    temFilhos = (await sql`select 1 from telas where pai_id = ${t.id} limit 1`).length > 0;
  } else if (modulos.some((m) => m.id === um(sp.modulo))) {
    inicial.moduloId = um(sp.modulo); // vindo do botão "Adicionar tela" de um módulo
  }
  const principais = await sql`select id, titulo, modulo_id from telas where caderno_id::text = ${id} and pai_id is null and id::text <> ${nova ? "" : telaId} order by ordem`;
  // vindo do botão "Adicionar pop-up" de uma tela: já chega com a tela pai escolhida
  if (nova && principais.some((p) => p.id === um(sp.pai))) inicial.paiId = um(sp.pai);

  // cenários da biblioteca que envolvem esta tela (a principal ou a de algum passo); sem a biblioteca atualizada no banco, a lista fica vazia
  const cs = nova ? [] : await sql`select id, titulo, tela_id, passos, situacao from cenarios where caderno_id::text = ${id} order by titulo`;
  const cenarios = cs
    .filter((c) => envolveTela({ telaId: c.tela_id, passos: c.passos } as Pick<Cenario, "telaId" | "passos">, telaId))
    .map((c) => ({ id: c.id as string, titulo: c.titulo as string, arquivado: c.situacao === "arquivado" }));

  const aba = ["dados", "funcionalidades", "previa"].includes(um(sp.aba)) ? (um(sp.aba) as "dados" | "funcionalidades" | "previa") : "dados";
  const volta = um(sp.volta);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <EditorTela
        key={`${telaId}-${um(sp.salvo)}`}
        cadernoId={id}
        telaId={nova ? null : telaId}
        inicial={inicial}
        modulos={modulos.map((m) => ({ id: m.id, titulo: m.titulo }))}
        principais={principais.map((p) => ({ id: p.id, titulo: p.titulo, moduloId: p.modulo_id }))}
        temFilhos={temFilhos}
        ambienteUrl={cad.ambiente_url ?? null}
        cenarios={cenarios}
        acao={salvarTela.bind(null, id, nova ? null : telaId, volta)}
        voltaQs={volta}
        salvo={!!sp.salvo}
        criada={!!sp.criada}
        abaInicial={aba}
      />
    </main>
  );
}
