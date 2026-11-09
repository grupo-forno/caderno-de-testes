import { conviteDoPedido, validadorDoConvite } from "@/lib/convite";
import { sql } from "@/lib/db";
import { pendentes, type CenarioSnap } from "@/lib/rodadas";
import type { RespPasso } from "@/lib/tipos";

const erro = (msg: string, status: number, extra: object = {}) => Response.json({ erro: msg, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

// "Enviar meus resultados": fecha as respostas da pessoa. Falhas e bloqueios podem ser enviados.
// Passo sem resposta (ou sem a explicação obrigatória) impede o envio e vem na resposta, para a tela levar a pessoa até ele.
export async function POST(req: Request) {
  const v = await validadorDoConvite(conviteDoPedido(req)).catch(() => null);
  if (!v) return erro("Este link de acesso não vale mais. Peça um novo link a quem preparou a rodada.", 401, { codigo: "sem_permissao" });
  try {
    const atrib = await sql`
      select a.id, a.enviado_em, rc.snapshot from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id
      where a.validador_id = ${v.id}`;
    if (!atrib.length) return erro("Você não tem testes atribuídos.", 400);
    const resp = await sql`select x.atribuicao_id, x.passo, x.resultado, x.obs, x.anexos from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id where a.validador_id = ${v.id}`;
    const faltam: { atribuicao: string; passo: string }[] = [];
    for (const a of atrib) {
      if (a.enviado_em) continue;
      const mapa: Record<string, RespPasso> = {};
      for (const x of resp) if (x.atribuicao_id === a.id) mapa[x.passo] = { resultado: x.resultado, obs: x.obs, anexos: x.anexos };
      for (const p of pendentes((a.snapshot as CenarioSnap).passos.map((p) => p.id), mapa)) faltam.push({ atribuicao: a.id, passo: `${a.id}_${p}` });
    }
    if (faltam.length) return erro(`Ainda há ${faltam.length} ${faltam.length === 1 ? "passo" : "passos"} sem resposta ou sem explicação. Responda antes de enviar.`, 409, { codigo: "pendentes", pendentes: faltam });

    // idempotente: reenviar não muda nada (só as atribuições ainda abertas são fechadas, e cada uma ganha um registro)
    const aEnviar = atrib.filter((a) => !a.enviado_em);
    if (aEnviar.length) {
      await sql.transaction([
        ...aEnviar.map((a) => sql`insert into rodada_eventos (atribuicao_id, tipo) select ${a.id}::uuid, 'envio' where exists (select 1 from rodada_atribuicoes where id = ${a.id}::uuid and enviado_em is null)`),
        sql`update rodada_atribuicoes set enviado_em = now() where validador_id = ${v.id} and enviado_em is null`,
      ]);
    }
    return Response.json({ ok: true, enviadas: aEnviar.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("POST /api/rodada/enviar", e);
    return erro("Não conseguimos enviar agora. Seus resultados continuam salvos; tente de novo em instantes.", 500);
  }
}
