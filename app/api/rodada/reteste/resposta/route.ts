import { URL_ANEXO, MAX_PRINTS } from "@/lib/anexos";
import { conviteDoPedido, validadorDoConvite } from "@/lib/convite";
import { sql } from "@/lib/db";
import { RESULTADOS_PASSO } from "@/lib/passos";
import type { ResultadoPasso } from "@/lib/tipos";

const MAX_OBS = 5000;
const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status, headers: { "Cache-Control": "no-store" } });

// Grava a resposta de UM passo de UMA tentativa de reteste. Só para o validador dono da atribuição e só enquanto o reteste está aberto.
export async function PUT(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);
  const v = await validadorDoConvite(conviteDoPedido(req)).catch(() => null);
  if (!v) return erro("Este link de acesso não vale mais. Peça um novo link a quem preparou a rodada.", 401, "sem_permissao");

  const reteste = typeof b.item === "string" ? b.item : "";
  const composto = typeof b.passo === "string" ? b.passo : "";
  const passoId = composto.startsWith(`${reteste}_`) ? composto.slice(reteste.length + 1) : "";
  if (!/^[0-9a-f-]{36}$/i.test(reteste) || !passoId) return erro("Faltam dados para salvar. Recarregue a página e tente de novo.", 400);
  if (!RESULTADOS_PASSO.includes(b.resultado)) return erro("Resultado inválido. Escolha Funcionou, Deu diferente ou Não consegui testar.", 400);
  const resultado = b.resultado as ResultadoPasso;
  const obs = typeof b.obs === "string" ? b.obs : "";
  if (obs.length > MAX_OBS) return erro(`O texto passou de ${MAX_OBS} letras. Encurte e tente de novo.`, 400);
  const anexos: unknown = b.anexos ?? [];
  if (!Array.isArray(anexos) || anexos.length > MAX_PRINTS) return erro(`Cada passo aceita no máximo ${MAX_PRINTS} prints. Remova alguns e tente de novo.`, 400);
  if (!anexos.every((u) => typeof u === "string" && URL_ANEXO.test(u))) return erro("Um dos prints não foi enviado direito. Remova-o e anexe de novo.", 400);
  const anexosJson = JSON.stringify(anexos);

  try {
    // o reteste tem que ser de uma atribuição DESTA pessoa
    const [t] = await sql`
      select t.status, t.passos from pendencia_retestes t join rodada_atribuicoes a on a.id = t.atribuicao_id
      where t.id = ${reteste} and a.validador_id = ${v.id}`;
    if (!t) return erro("Este reteste não foi pedido para você.", 403, "sem_permissao");
    if (t.status !== "solicitado") return erro("Você já enviou este reteste. Se precisar refazer, peça um novo pedido a quem preparou a rodada.", 409, "enviado");
    if (!(t.passos as string[]).includes(passoId)) return erro("Este passo não faz parte do reteste. Recarregue a página e tente de novo.", 400);

    // um print não pode ser reaproveitado de outra pessoa (nem de outra tentativa que não seja esta)
    for (const u of anexos as string[]) {
      const [uso] = await sql`
        select 1 from (
          select anexos from respostas_atribuicao x join rodada_atribuicoes a on a.id = x.atribuicao_id where a.validador_id <> ${v.id}
          union all
          select anexos from respostas_reteste x join pendencia_retestes r on r.id = x.reteste_id join rodada_atribuicoes a on a.id = r.atribuicao_id where a.validador_id <> ${v.id}
        ) u where jsonb_exists(anexos, ${u}) limit 1`;
      if (uso) return erro("Um dos prints não é seu. Remova-o e anexe de novo.", 400);
    }

    const r = await sql`
      insert into respostas_reteste (reteste_id, passo, resultado, obs, anexos)
      select ${reteste}::uuid, ${passoId}, ${resultado}, ${obs}, ${anexosJson}::jsonb
      where exists (select 1 from pendencia_retestes where id = ${reteste}::uuid and status = 'solicitado')
      on conflict (reteste_id, passo)
      do update set resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, atualizado = now()
      returning passo`;
    if (!r.length) return erro("Você já enviou este reteste.", 409, "enviado");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("PUT /api/rodada/reteste/resposta", e);
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}
