import type { NextRequest } from "next/server";
import { aceiteVigente } from "@/lib/aceite";
import { URL_ANEXO, MAX_PRINTS } from "@/lib/anexos";
import { sql } from "@/lib/db";
import { anexosDoItem, observacaoDoItem, resultadoDoItem, RESULTADOS_PASSO } from "@/lib/passos";
import type { Item, RespPasso, ResultadoPasso } from "@/lib/tipos";
import { chaveDoPedido, validadorDaChave } from "@/lib/validador";

const JUNTAR_OBSERVACOES_EM_MIN = 10; // várias edições de texto seguidas viram um registro só
const MAX_OBS = 5000;

const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status, headers: { "Cache-Control": "no-store" } });
const SEM_PERMISSAO = "Não reconhecemos você neste caderno. Abra de novo o link para continuar que você recebeu, ou peça um novo a quem preparou o caderno.";

// Respostas aos passos de quem está logado (pela chave, nunca pelo e-mail)
export async function GET(req: NextRequest) {
  const caderno = req.nextUrl.searchParams.get("caderno") ?? "";
  const v = await validadorDaChave(chaveDoPedido(req), caderno).catch(() => null);
  if (!v) return erro(SEM_PERMISSAO, 401, "sem_permissao");
  try {
    const rows = await sql`select passo, resultado, obs, anexos from respostas_passo where caderno = ${caderno} and email = ${v.email}`;
    const aceite = await aceiteVigente(caderno);
    return Response.json(
      {
        passos: Object.fromEntries(rows.map((x) => [x.passo, { resultado: x.resultado, obs: x.obs, anexos: x.anexos }])),
        aceite: aceite ? { nome: aceite.nome, criado: aceite.criado } : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("GET /api/passos", e);
    return erro("Não conseguimos carregar suas respostas. Recarregue a página e tente de novo.", 500);
  }
}

// Grava a resposta de UM passo. O servidor também recalcula o resultado da funcionalidade (OK, NÃO OK ou NÃO TESTADO)
// e registra tudo no histórico, na mesma transação.
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);
  const caderno = typeof b.caderno === "string" ? b.caderno : "";
  const itemId = typeof b.item === "string" ? b.item : "";
  const passoId = typeof b.passo === "string" ? b.passo : "";

  const v = await validadorDaChave(chaveDoPedido(req), caderno).catch(() => null);
  if (!v) return erro(SEM_PERMISSAO, 401, "sem_permissao");

  if (!itemId || !passoId) return erro("Faltam dados para salvar. Recarregue a página e tente de novo.", 400);
  if (!RESULTADOS_PASSO.includes(b.resultado)) return erro("Resultado inválido. Escolha Funcionou, Deu diferente ou Não consegui testar.", 400);
  const resultado = b.resultado as ResultadoPasso;
  const obs = typeof b.obs === "string" ? b.obs : "";
  if (obs.length > MAX_OBS) return erro(`O texto passou de ${MAX_OBS} letras. Encurte e tente de novo.`, 400);
  const anexos: unknown = b.anexos ?? [];
  if (!Array.isArray(anexos) || anexos.length > MAX_PRINTS) return erro(`Cada passo aceita no máximo ${MAX_PRINTS} prints. Remova alguns e tente de novo.`, 400);
  if (!anexos.every((u) => typeof u === "string" && URL_ANEXO.test(u))) return erro("Um dos prints não foi enviado direito. Remova-o e anexe de novo.", 400);
  const anexosJson = JSON.stringify(anexos);

  try {
    const aceite = await aceiteVigente(caderno);
    if (aceite) return aceito(aceite);

    // o passo tem que ser da funcionalidade, e a funcionalidade de uma tela deste caderno
    const [t] = await sql`
      select t.id, t.itens from telas t join cadernos c on c.id = t.caderno_id
      where c.slug = ${caderno} and t.itens @> jsonb_build_array(jsonb_build_object('id', ${itemId}::text))`;
    const item = (t?.itens as Item[] | undefined)?.find((i) => i.id === itemId);
    const passos = item?.passos ?? [];
    if (!t || !passos.some((p) => p.id === passoId)) return erro("Esse passo não existe mais. Recarregue a página e tente de novo.", 400);

    // o que já estava gravado, para saber o que mudou e recalcular a funcionalidade
    const atuais = await sql`select passo, resultado, obs, anexos from respostas_passo where caderno = ${caderno} and email = ${v.email} and item = ${itemId}`;
    const mapa = new Map<string, RespPasso>(atuais.map((x) => [x.passo as string, { resultado: x.resultado, obs: x.obs, anexos: x.anexos }]));
    const antes = mapa.get(passoId);
    const mudouResultado = antes?.resultado !== resultado;
    const mudouTexto = !!antes && !mudouResultado && (antes.obs !== obs || JSON.stringify(antes.anexos) !== anexosJson);
    mapa.set(passoId, { resultado, obs, anexos: anexos as string[] });
    const resp = (id: string) => mapa.get(id);
    const derivado = resultadoDoItem(passos, resp);
    const obsItem = observacaoDoItem(passos, resp);
    const anexosItem = JSON.stringify(anexosDoItem(passos, resp));
    const [antesItem] = await sql`select resultado from respostas_item where caderno = ${caderno} and email = ${v.email} and item = ${itemId}`;
    const itemAntes = (antesItem?.resultado as string | undefined) ?? "nao_testado";
    const deAntes = antes?.resultado ?? null;

    // (o texto "not exists (...)" se repete de propósito: o driver não aceita juntar pedaços de comando)
    const r = await sql.transaction([
      // 1) o resultado do passo mudou (ou é a primeira resposta): registro novo no histórico
      sql`
        insert into historico (caderno, tela, item, passo, ator, email, nome, tipo, de, para, obs, anexos)
        select ${caderno}, ${t.id}, ${itemId}, ${passoId}, 'cliente', ${v.email}, ${v.nome}, 'resultado', ${deAntes}::text, ${resultado}, ${obs}, ${anexosJson}::jsonb
        where ${mudouResultado}::boolean and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
      // 2) só o texto ou os prints mudaram: junta com a edição anterior da mesma pessoa neste passo se for dentro de 10 minutos
      sql`
        with ult as (select id, tipo, email, criado from historico where caderno = ${caderno} and item = ${itemId} and passo = ${passoId} order by id desc limit 1),
        junta as (
          update historico h set obs = ${obs}, anexos = ${anexosJson}::jsonb, criado = now() from ult
          where ${mudouTexto}::boolean and h.id = ult.id and ult.tipo = 'observacao' and ult.email = ${v.email}
            and ult.criado > now() - make_interval(mins => ${JUNTAR_OBSERVACOES_EM_MIN}) and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)
          returning h.id
        )
        insert into historico (caderno, tela, item, passo, ator, email, nome, tipo, para, obs, anexos)
        select ${caderno}, ${t.id}, ${itemId}, ${passoId}, 'cliente', ${v.email}, ${v.nome}, 'observacao', ${resultado}, ${obs}, ${anexosJson}::jsonb
        where ${mudouTexto}::boolean and not exists (select 1 from junta) and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
      // 3) a resposta do passo
      sql`
        insert into respostas_passo (caderno, email, nome, tela, item, passo, resultado, obs, anexos)
        select ${caderno}, ${v.email}, ${v.nome}, ${t.id}, ${itemId}, ${passoId}, ${resultado}, ${obs}, ${anexosJson}::jsonb
        where not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)
        on conflict (caderno, email, passo)
        do update set nome = excluded.nome, resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, atualizado = now()
        returning passo`,
      // 4) a funcionalidade muda de resultado: registro no histórico dela (é o que alimenta os alertas de correção)
      sql`
        insert into historico (caderno, tela, item, ator, email, nome, tipo, de, para, obs, anexos)
        select ${caderno}, ${t.id}, ${itemId}, 'cliente', ${v.email}, ${v.nome}, 'resultado', ${itemAntes}::text, ${derivado}::text, ${obsItem}, ${anexosItem}::jsonb
        where ${itemAntes}::text <> ${derivado}::text and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
      // 5) o resultado da funcionalidade em si: o resto do sistema (status, aceite, planilha) lê daqui
      sql`
        insert into respostas_item (caderno, email, nome, tela, item, resultado, obs, anexos, severidade)
        select ${caderno}, ${v.email}, ${v.nome}, ${t.id}, ${itemId}, ${derivado}, ${obsItem}, ${anexosItem}::jsonb, null
        where not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)
        on conflict (caderno, email, item)
        do update set nome = excluded.nome, tela = excluded.tela, resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, severidade = null, atualizado = now()
        returning item`,
    ]);

    // o aceite foi concluído entre a conferência e a gravação: nada foi gravado
    if ((r[2] as unknown[]).length === 0) {
      const agora = await aceiteVigente(caderno);
      if (agora) return aceito(agora);
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("PUT /api/passos", e);
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}

function aceito(aceite: { nome: string; criado: string }) {
  const dia = new Date(aceite.criado).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return erro(`A homologação foi concluída em ${dia} por ${aceite.nome}. Para mudar algo, peça para quem preparou o caderno reabrir.`, 409, "aceito");
}
