import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import { MeusTestes, type DadosRodada } from "@/components/MeusTestes";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { montarSnapshot, type CenarioSnap, type TelaSnap } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Prévia como validador (só equipe). Rascunho: mostra o que a pessoa verá, com os cenários de hoje da biblioteca.
// Publicada: mostra a cópia publicada com as respostas dessa pessoa, só para consulta. Nada é gravado.
export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/rodadas/[rodadaId]/previa">) {
  await exigirAdmin();
  const { id, rodadaId } = await params;
  const { validador } = await searchParams;
  if (!ehUuid(id) || !ehUuid(rodadaId) || typeof validador !== "string" || !ehUuid(validador)) notFound();
  const [r] = await sql`select r.*, r.prazo::text as prazo_txt, c.titulo as sistema from rodadas r join cadernos c on c.id = r.caderno_id where r.id = ${rodadaId} and r.caderno_id = ${id}`;
  const [v] = await sql`select id, nome, nota from rodada_validadores where id = ${validador} and rodada_id = ${rodadaId}`;
  if (!r || !v) notFound();

  let atribuicoes: DadosRodada["atribuicoes"] = [];
  const respostas: Record<string, RespPasso> = {};
  const compor = (atribId: string, s: CenarioSnap, enviadoEm: string | null) => ({ id: atribId, enviadoEm, cenario: { ...s, passos: s.passos.map((p) => ({ ...p, id: `${atribId}_${p.id}` })) } });

  if (r.situacao === "rascunho") {
    const telas = await sql`select t.id, t.titulo, t.imagem_url, t.link_url, coalesce(m.titulo, 'Sem módulo') as modulo from telas t left join modulos m on m.id = t.modulo_id where t.caderno_id = ${id}`;
    const mapa = new Map<string, TelaSnap>(telas.map((t) => [t.id as string, { id: t.id, titulo: t.titulo, modulo: t.modulo, imagem: t.imagem_url, link: t.link_url }]));
    const rows = await sql`
      select rc.id as rc, c.id, c.titulo, c.objetivo, c.tipo, c.pre_requisitos, c.dados_teste, c.tela_id, c.passos
      from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id join cenarios c on c.id = rc.cenario_id
      where a.validador_id = ${validador} order by rc.ordem`;
    atribuicoes = rows.map((c) => compor(c.rc, montarSnapshot({ id: c.id, titulo: c.titulo, objetivo: c.objetivo, tipo: c.tipo, preRequisitos: c.pre_requisitos, dadosTeste: c.dados_teste, telaId: c.tela_id, passos: c.passos }, mapa), null));
  } else {
    const rows = await sql`
      select a.id, a.enviado_em, rc.snapshot from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id
      where a.validador_id = ${validador} order by rc.ordem`;
    atribuicoes = rows.map((a) => compor(a.id, a.snapshot as CenarioSnap, a.enviado_em ? new Date(a.enviado_em).toISOString() : null));
    const resp = await sql`select x.atribuicao_id, x.passo, x.resultado, x.obs, x.anexos from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id where a.validador_id = ${validador}`;
    for (const x of resp) respostas[`${x.atribuicao_id}_${x.passo}`] = { resultado: x.resultado, obs: x.obs, anexos: x.anexos };
  }

  const dados: DadosRodada = {
    rodada: { sistema: r.sistema, nome: r.nome, versao: r.versao, ambienteUrl: r.ambiente_url, prazo: r.prazo_txt, resumo: r.resumo, instrucoes: r.instrucoes, foraEscopo: r.fora_escopo },
    validador: { nome: v.nome, nota: v.nota },
    atribuicoes,
    respostas,
  };

  return (
    <>
      <AdminBar />
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link href={`/admin/${id}/rodadas/${rodadaId}`} className="text-sm text-indigo-800 hover:underline">← Voltar à rodada</Link>
      </div>
      <MeusTestes dados={dados} previa />
    </>
  );
}
