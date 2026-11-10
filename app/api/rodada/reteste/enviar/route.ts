import { MSG_APROVADA, rodadaAprovada } from "@/lib/aceiteRodadaDb";
import { conviteDoPedido, validadorDoConvite } from "@/lib/convite";
import { sql } from "@/lib/db";
import { avaliarReteste, situacaoAposReteste, ROTULO_PENDENCIA } from "@/lib/pendencias";
import { ROTULO_PASSO } from "@/lib/passos";
import type { RespPasso } from "@/lib/tipos";

const erro = (msg: string, status: number, extra: object = {}) => Response.json({ erro: msg, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

// "Enviar reteste": fecha a tentativa e decide o destino da pendência.
// Todos os passos pedidos funcionaram: Resolvida. Algum falhou: volta para Aberta. Só bloqueio: continua Aguardando reteste.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const reteste = typeof b?.reteste === "string" ? b.reteste : "";
  const v = await validadorDoConvite(conviteDoPedido(req)).catch(() => null);
  if (!v) return erro("Este link de acesso não vale mais. Peça um novo link a quem preparou a rodada.", 401, { codigo: "sem_permissao" });
  const aprovada = await rodadaAprovada(v.rodadaId);
  if (aprovada) return erro(MSG_APROVADA(aprovada), 409, { codigo: "aceito" });
  if (!/^[0-9a-f-]{36}$/i.test(reteste)) return erro("Faltam dados para enviar. Recarregue a página e tente de novo.", 400);

  try {
    const [t] = await sql`
      select t.id, t.pendencia_id, t.numero, t.versao, t.passos, t.status, t.resultado, p.situacao
      from pendencia_retestes t join pendencias p on p.id = t.pendencia_id join rodada_atribuicoes a on a.id = t.atribuicao_id
      where t.id = ${reteste} and a.validador_id = ${v.id}`;
    if (!t) return erro("Este reteste não foi pedido para você.", 403, { codigo: "sem_permissao" });
    // reenvio do mesmo reteste: devolve o que já foi decidido, sem mudar nem duplicar nada
    if (t.status === "enviado") return Response.json({ ok: true, repetido: true, resultado: t.resultado, situacao: t.situacao, situacaoRotulo: ROTULO_PENDENCIA[t.situacao as keyof typeof ROTULO_PENDENCIA] }, { headers: { "Cache-Control": "no-store" } });

    const rs = await sql`select passo, resultado, obs, anexos from respostas_reteste where reteste_id = ${reteste}`;
    const resp: Record<string, RespPasso> = Object.fromEntries(rs.map((x) => [x.passo, { resultado: x.resultado, obs: x.obs, anexos: x.anexos }]));
    const { pendentes, resultado } = avaliarReteste(t.passos as string[], resp);
    if (!resultado) {
      return erro(`Ainda há ${pendentes.length} ${pendentes.length === 1 ? "passo" : "passos"} sem resposta ou sem explicação. Responda antes de enviar.`, 409, { codigo: "pendentes", pendentes: pendentes.map((p) => `${reteste}_${p}`) });
    }
    const nova = situacaoAposReteste(resultado);
    const autor = `Validador: ${v.nome}`;
    // resumo do que foi relatado nos passos que falharam ou ficaram bloqueados (vai para o histórico)
    const relato = (t.passos as string[])
      .map((id, n) => ({ id, n, r: resp[id] }))
      .filter((x) => x.r.resultado !== "funcionou")
      .map((x) => `Passo ${x.n + 1} (${ROTULO_PASSO[x.r.resultado]}): ${x.r.obs}`)
      .join("\n");

    // tudo numa transação. Só a primeira instrução "acerta" se o pedido ainda estiver aberto: as outras só valem
    // quando essa mesma transação foi quem enviou (enviado_em = now()), então clique repetido não duplica nada.
    await sql.transaction([
      sql`update pendencia_retestes set status = 'enviado', resultado = ${resultado}, enviado_em = now() where id = ${reteste} and status = 'solicitado'`,
      sql`
        update pendencias set situacao = ${nova}, atualizado = now()
        where id = ${t.pendencia_id}::uuid and exists (select 1 from pendencia_retestes where id = ${reteste}::uuid and enviado_em = now())`,
      sql`
        insert into pendencia_eventos (pendencia_id, tipo, autor, obs, dados)
        select ${t.pendencia_id}::uuid, 'reteste_enviado', ${autor}, ${relato}, ${JSON.stringify({ reteste, numero: t.numero, versao: t.versao, resultado })}::jsonb
        where exists (select 1 from pendencia_retestes where id = ${reteste}::uuid and enviado_em = now())`,
      sql`
        insert into pendencia_eventos (pendencia_id, tipo, autor, obs, dados)
        select ${t.pendencia_id}::uuid, ${resultado === "resolvida" ? "resolvida" : resultado === "falhou" ? "reaberta" : "bloqueada"}, ${autor}, ${relato}, ${JSON.stringify({ reteste, numero: t.numero })}::jsonb
        where exists (select 1 from pendencia_retestes where id = ${reteste}::uuid and enviado_em = now())`,
    ]);
    const [depois] = await sql`select t.resultado, p.situacao from pendencia_retestes t join pendencias p on p.id = t.pendencia_id where t.id = ${reteste}`;
    return Response.json(
      { ok: true, resultado: depois.resultado, situacao: depois.situacao, situacaoRotulo: ROTULO_PENDENCIA[depois.situacao as keyof typeof ROTULO_PENDENCIA] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("POST /api/rodada/reteste/enviar", e);
    return erro("Não conseguimos enviar agora. Suas respostas continuam salvas; tente de novo em instantes.", 500);
  }
}
