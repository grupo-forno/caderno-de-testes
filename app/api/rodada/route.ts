import { MSG_APROVADA, rodadaAprovada } from "@/lib/aceiteRodadaDb";
import { sql } from "@/lib/db";
import { conviteDoPedido, validadorDoConvite } from "@/lib/convite";
import type { CenarioSnap } from "@/lib/rodadas";

const SEM_PERMISSAO = "Este link de acesso não vale mais ou a rodada ainda não foi publicada. Peça um novo link a quem preparou a rodada.";
const NO_STORE = { "Cache-Control": "no-store" };

// "Meus testes": devolve SÓ o que foi atribuído a quem tem o convite. O servidor confere o convite em toda chamada.
// Os ids dos passos saem como "<atribuição>_<passo>", assim dois cenários com passos de mesmo id nunca se misturam.
export async function GET(req: Request) {
  const v = await validadorDoConvite(conviteDoPedido(req)).catch(() => null);
  if (!v) return Response.json({ erro: SEM_PERMISSAO, codigo: "sem_permissao" }, { status: 401, headers: NO_STORE });
  try {
    const [r] = await sql`
      select r.nome, r.versao, r.ambiente_url, r.prazo::text as prazo, r.resumo, r.instrucoes, r.fora_escopo, c.titulo as sistema
      from rodadas r join cadernos c on c.id = r.caderno_id where r.id = ${v.rodadaId}`;
    const [pessoa] = await sql`select nome, nota from rodada_validadores where id = ${v.id}`;
    const atrib = await sql`
      select a.id, a.enviado_em, rc.snapshot from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id
      where a.validador_id = ${v.id} order by rc.ordem, rc.id`;
    const resp = await sql`
      select x.atribuicao_id, x.passo, x.resultado, x.obs, x.anexos from respostas_atribuicao x
      join rodada_atribuicoes a on a.id = x.atribuicao_id where a.validador_id = ${v.id}`;
    const aprovada = await rodadaAprovada(v.rodadaId);
    const composto = (a: string, p: string) => `${a}_${p}`;

    // retestes pedidos pela equipe para esta pessoa (abertos e já enviados, para consulta), cada um com a tentativa original da falha
    const rts = await sql`
      select t.id, t.numero, t.corrigido, t.versao, t.passos, t.solicitado_por, t.solicitado_em, t.status, t.resultado, t.enviado_em,
        p.id as pendencia_id, p.passo as passo_falho, p.situacao, p.atribuicao_id, rc.snapshot
      from pendencia_retestes t join pendencias p on p.id = t.pendencia_id
      join rodada_atribuicoes a on a.id = t.atribuicao_id join rodada_cenarios rc on rc.id = a.rodada_cenario_id
      where a.validador_id = ${v.id} order by t.solicitado_em, t.numero`;
    const respRt = await sql`
      select x.reteste_id, x.passo, x.resultado, x.obs, x.anexos from respostas_reteste x
      join pendencia_retestes t on t.id = x.reteste_id join rodada_atribuicoes a on a.id = t.atribuicao_id where a.validador_id = ${v.id}`;
    const retestes = rts.map((t) => {
      const s = t.snapshot as CenarioSnap;
      const original = resp.find((x) => x.atribuicao_id === t.atribuicao_id && x.passo === t.passo_falho);
      const pedidos = new Set(t.passos as string[]);
      return {
        id: t.id,
        numero: t.numero,
        corrigido: t.corrigido,
        versao: t.versao,
        solicitadoPor: t.solicitado_por,
        solicitadoEm: new Date(t.solicitado_em).toISOString(),
        status: t.status,
        resultado: t.resultado,
        enviadoEm: t.enviado_em ? new Date(t.enviado_em).toISOString() : null,
        pendenciaSituacao: t.situacao,
        cenario: { titulo: s.titulo, objetivo: s.objetivo, preRequisitos: s.preRequisitos, dadosTeste: s.dadosTeste, perfis: s.perfis, modulos: s.modulos },
        passos: s.passos.filter((p) => pedidos.has(p.id)).map((p) => ({ ...p, id: composto(t.id, p.id), falhou: p.id === t.passo_falho })),
        falhaOriginal: original ? { passoId: composto(t.id, t.passo_falho), obs: original.obs, anexos: original.anexos } : null,
      };
    });
    const respostasReteste = Object.fromEntries(respRt.map((x) => [composto(x.reteste_id, x.passo), { resultado: x.resultado, obs: x.obs, anexos: x.anexos }]));
    return Response.json(
      {
        rodada: { sistema: r.sistema, nome: r.nome, versao: r.versao, ambienteUrl: r.ambiente_url, prazo: r.prazo, resumo: r.resumo, instrucoes: r.instrucoes, foraEscopo: r.fora_escopo },
        validador: { nome: pessoa.nome, nota: pessoa.nota },
        atribuicoes: atrib.map((a) => {
          const s = a.snapshot as CenarioSnap;
          return { id: a.id, enviadoEm: a.enviado_em ? new Date(a.enviado_em).toISOString() : null, cenario: { ...s, passos: s.passos.map((p) => ({ ...p, id: composto(a.id, p.id) })) } };
        }),
        aprovada: aprovada ? { em: aprovada.em, mensagem: MSG_APROVADA(aprovada) } : null,
        retestes,
        respostasReteste,
        respostas: Object.fromEntries(resp.map((x) => [composto(x.atribuicao_id, x.passo), { resultado: x.resultado, obs: x.obs, anexos: x.anexos }])),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error("GET /api/rodada", e);
    return Response.json({ erro: "Não conseguimos carregar seus testes. Recarregue a página e tente de novo." }, { status: 500, headers: NO_STORE });
  }
}
