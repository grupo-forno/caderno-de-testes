import { URL_ANEXO, MAX_PRINTS } from "@/lib/anexos";
import { conviteDoPedido, validadorDoConvite } from "@/lib/convite";
import { sql } from "@/lib/db";
import { RESULTADOS_PASSO } from "@/lib/passos";
import type { CenarioSnap } from "@/lib/rodadas";
import type { ResultadoPasso } from "@/lib/tipos";

const MAX_OBS = 5000;
const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status, headers: { "Cache-Control": "no-store" } });

// Grava a resposta de UM passo de UMA atribuição. Só funciona para atribuições da própria pessoa (conferido no servidor)
// e só enquanto os resultados não foram enviados.
export async function PUT(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);
  const v = await validadorDoConvite(conviteDoPedido(req)).catch(() => null);
  if (!v) return erro("Este link de acesso não vale mais. Peça um novo link a quem preparou a rodada.", 401, "sem_permissao");

  const atribuicao = typeof b.item === "string" ? b.item : "";
  const composto = typeof b.passo === "string" ? b.passo : "";
  const passoId = composto.startsWith(`${atribuicao}_`) ? composto.slice(atribuicao.length + 1) : "";
  if (!/^[0-9a-f-]{36}$/i.test(atribuicao) || !passoId) return erro("Faltam dados para salvar. Recarregue a página e tente de novo.", 400);
  if (!RESULTADOS_PASSO.includes(b.resultado)) return erro("Resultado inválido. Escolha Funcionou, Deu diferente ou Não consegui testar.", 400);
  const resultado = b.resultado as ResultadoPasso;
  const obs = typeof b.obs === "string" ? b.obs : "";
  if (obs.length > MAX_OBS) return erro(`O texto passou de ${MAX_OBS} letras. Encurte e tente de novo.`, 400);
  const anexos: unknown = b.anexos ?? [];
  if (!Array.isArray(anexos) || anexos.length > MAX_PRINTS) return erro(`Cada passo aceita no máximo ${MAX_PRINTS} prints. Remova alguns e tente de novo.`, 400);
  if (!anexos.every((u) => typeof u === "string" && URL_ANEXO.test(u))) return erro("Um dos prints não foi enviado direito. Remova-o e anexe de novo.", 400);
  const anexosJson = JSON.stringify(anexos);

  try {
    // a atribuição tem que ser DESTA pessoa
    const [a] = await sql`
      select a.enviado_em, rc.snapshot from rodada_atribuicoes a join rodada_cenarios rc on rc.id = a.rodada_cenario_id
      where a.id = ${atribuicao} and a.validador_id = ${v.id}`;
    if (!a) return erro("Este teste não está atribuído a você.", 403, "sem_permissao");
    if (a.enviado_em) return erro("Você já enviou seus resultados. Para mudar algo, peça a quem preparou a rodada.", 409, "enviado");
    if (!(a.snapshot as CenarioSnap).passos.some((p) => p.id === passoId)) return erro("Esse passo não existe mais. Recarregue a página e tente de novo.", 400);

    // um print não pode ser reaproveitado de outra pessoa
    for (const u of anexos as string[]) {
      const [uso] = await sql`select 1 from respostas_atribuicao where atribuicao_id <> ${atribuicao} and jsonb_exists(anexos, ${u}) limit 1`;
      if (uso) return erro("Um dos prints não é seu. Remova-o e anexe de novo.", 400);
    }

    const [antes] = await sql`select resultado from respostas_atribuicao where atribuicao_id = ${atribuicao} and passo = ${passoId}`;
    const mudou = antes?.resultado !== resultado;
    const deAntes = (antes?.resultado as string | undefined) ?? null;
    const r = await sql.transaction([
      sql`
        insert into rodada_eventos (atribuicao_id, passo, tipo, de, para, obs)
        select ${atribuicao}::uuid, ${passoId}, 'resultado', ${deAntes}::text, ${resultado}, ${obs}
        where ${mudou}::boolean and exists (select 1 from rodada_atribuicoes where id = ${atribuicao}::uuid and enviado_em is null)`,
      sql`
        insert into respostas_atribuicao (atribuicao_id, passo, resultado, obs, anexos)
        select ${atribuicao}::uuid, ${passoId}, ${resultado}, ${obs}, ${anexosJson}::jsonb
        where exists (select 1 from rodada_atribuicoes where id = ${atribuicao}::uuid and enviado_em is null)
        on conflict (atribuicao_id, passo)
        do update set resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, atualizado = now()
        returning passo`,
    ]);
    if ((r[1] as unknown[]).length === 0) return erro("Você já enviou seus resultados. Para mudar algo, peça a quem preparou a rodada.", 409, "enviado");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("PUT /api/rodada/resposta", e);
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}
