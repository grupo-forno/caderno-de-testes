import type { NextRequest } from "next/server";
import { aceiteVigente } from "@/lib/aceite";
import { sql } from "@/lib/db";
import { SEVERIDADES, type Severidade } from "@/lib/tipos";
import { chaveDoPedido, validadorDaChave } from "@/lib/validador";

const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status, headers: { "Cache-Control": "no-store" } });

// Grava a gravidade de uma funcionalidade com falha (roteiro de passos). É o mesmo campo que o modelo antigo usa
// (respostas_item.severidade), e a mudança entra no histórico. O passo grava o resultado; aqui só se classifica a falha.
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);
  const caderno = typeof b.caderno === "string" ? b.caderno : "";
  const itemId = typeof b.item === "string" ? b.item : "";
  const v = await validadorDaChave(chaveDoPedido(req), caderno).catch(() => null);
  if (!v) return erro("Não reconhecemos você neste caderno. Abra de novo o link para continuar que você recebeu, ou peça um novo a quem preparou o caderno.", 401, "sem_permissao");
  if (!itemId || !(SEVERIDADES as string[]).includes(b.severidade)) return erro("Escolha uma das opções de gravidade.", 400);
  const severidade = b.severidade as Severidade;

  try {
    const aceite = await aceiteVigente(caderno);
    if (aceite) {
      const dia = new Date(aceite.criado).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return erro(`A homologação foi concluída em ${dia} por ${aceite.nome}. Para mudar algo, peça para quem preparou o caderno reabrir.`, 409, "aceito");
    }
    const [atual] = await sql`select tela, resultado, obs, anexos, severidade from respostas_item where caderno = ${caderno} and email = ${v.email} and item = ${itemId}`;
    // a falha ainda pode estar sendo salva: a tela tenta de novo em alguns segundos
    if (!atual || atual.resultado !== "nao_ok") return erro("Esta funcionalidade ainda não tem uma falha registrada. Espere o passo terminar de salvar e tente de novo.", 409, "sem_falha");
    const mudou = atual.severidade !== severidade;
    await sql.transaction([
      sql`
        insert into historico (caderno, tela, item, ator, email, nome, tipo, para, obs, anexos, severidade)
        select ${caderno}, ${atual.tela}, ${itemId}, 'cliente', ${v.email}, ${v.nome}, 'observacao', 'nao_ok', ${atual.obs}, ${JSON.stringify(atual.anexos ?? [])}::jsonb, ${severidade}
        where ${mudou}::boolean and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
      sql`
        update respostas_item set severidade = ${severidade}, atualizado = now()
        where caderno = ${caderno} and email = ${v.email} and item = ${itemId} and resultado = 'nao_ok'
          and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
    ]);
    return Response.json({ ok: true, gravidade: severidade }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("PUT /api/passos/gravidade", e);
    return erro("Não conseguimos salvar agora. Sua escolha continua na tela; tente de novo em instantes.", 500);
  }
}
