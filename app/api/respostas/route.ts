import type { NextRequest } from "next/server";
import { aceiteVigente } from "@/lib/aceite";
import { URL_ANEXO } from "@/lib/anexos";
import { sql } from "@/lib/db";
import { SEVERIDADES, type Evento, type Severidade } from "@/lib/tipos";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HISTORICO_POR_ITEM = 30;
const JUNTAR_OBSERVACOES_EM_MIN = 10; // várias edições de texto seguidas viram um registro só

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status });

// funcionalidades do caderno que têm roteiro de teste
async function idsComRoteiro(caderno: string): Promise<Set<string>> {
  const rows = await sql`
    select e->>'id' as id from telas t join cadernos c on c.id = t.caderno_id, jsonb_array_elements(t.itens) e
    where c.slug = ${caderno} and jsonb_typeof(e->'passos') = 'array' and jsonb_array_length(e->'passos') > 0`;
  return new Set(rows.map((x) => x.id as string));
}
const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Devolve as respostas de uma pessoa e o histórico delas (e das correções feitas por quem monta o caderno):
// { respostas: {itemId: {resultado, obs, anexos}}, historico: {itemId: Evento[]} }
export async function GET(req: NextRequest) {
  const caderno = req.nextUrl.searchParams.get("caderno");
  const e = texto(req.nextUrl.searchParams.get("email")).toLowerCase();
  if (!caderno || !e) return erro("Informe o caderno e o e-mail.", 400);
  try {
    const [c] = await sql`select 1 from cadernos where slug = ${caderno}`;
    if (!c) return erro("Não encontramos este caderno. Confira se o link está completo.", 404);
    const aceite = await aceiteVigente(caderno);
    // itens com roteiro só se consultam com a chave (GET /api/passos): o e-mail sozinho não prova quem é a pessoa
    const comRoteiro = await idsComRoteiro(caderno);
    const rows = (await sql`select item, resultado, obs, anexos, severidade from respostas_item where caderno = ${caderno} and email = ${e}`).filter((x) => !comRoteiro.has(x.item));
    const ev = await sql`
      select item, tipo, ator, nome, de, para, obs, anexos, severidade, criado from historico
      where caderno = ${caderno} and item <> '' and (email = ${e} or tipo = 'correcao') order by criado, id`;
    const historico: Record<string, Evento[]> = {};
    for (const x of ev) {
      if (comRoteiro.has(x.item)) continue;
      const lista = (historico[x.item] ??= []);
      lista.push({ tipo: x.tipo, ator: x.ator, nome: x.nome, de: x.de, para: x.para, obs: x.obs, anexos: x.anexos, severidade: x.severidade, criado: new Date(x.criado).toISOString() });
      if (lista.length > MAX_HISTORICO_POR_ITEM) lista.shift();
    }
    return Response.json({
      respostas: Object.fromEntries(rows.map((x) => [x.item, { resultado: x.resultado, obs: x.obs, anexos: x.anexos, severidade: x.severidade }])),
      historico,
      // o termo (com nome e e-mail de quem aceitou) só é entregue a quem aceitou
      aceite: aceite ? { nome: aceite.nome, criado: aceite.criado, token: aceite.email === e ? aceite.token : null } : null,
    });
  } catch (err) {
    console.error("GET /api/respostas", err);
    return erro("Não conseguimos carregar suas respostas. Recarregue a página e tente de novo.", 500);
  }
}

// Grava o resultado de uma funcionalidade e registra a mudança no histórico
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);

  const caderno = typeof b.caderno === "string" ? b.caderno : "";
  const tela = typeof b.tela === "string" ? b.tela : "";
  const item = typeof b.item === "string" ? b.item : "";
  const nome = texto(b.nome);
  const e = texto(b.email).toLowerCase();
  if (!caderno || !tela || !item || !nome) return erro("Faltam dados para salvar. Recarregue a página e entre de novo com seu nome e e-mail.", 400);
  if (!EMAIL.test(e)) return erro("O e-mail informado não parece certo. Recarregue a página e entre de novo.", 400);
  if (!["ok", "nao_ok", "nao_testado"].includes(b.resultado)) return erro("Resultado inválido. Escolha OK, NÃO OK ou NÃO TESTADO.", 400);

  const obs = typeof b.obs === "string" ? b.obs : "";
  if (obs.length > 5000) return erro("A observação passou de 5000 letras. Encurte o texto.", 400);

  const anexos: unknown = b.anexos ?? [];
  if (!Array.isArray(anexos) || anexos.length > 10) return erro("Cada funcionalidade aceita no máximo 10 prints. Remova alguns e tente de novo.", 400);
  if (!anexos.every((u) => typeof u === "string" && URL_ANEXO.test(u))) return erro("Um dos prints não foi enviado direito. Remova-o e anexe de novo.", 400);
  const anexosJson = JSON.stringify(anexos);

  // a gravidade só vale para NÃO OK
  const informada = typeof b.severidade === "string" && (SEVERIDADES as string[]).includes(b.severidade) ? (b.severidade as Severidade) : null;
  const severidade: Severidade | null = b.resultado === "nao_ok" ? informada : null;

  if (!ehUuid(tela)) return erro("Essa tela não existe mais. Recarregue a página e tente de novo.", 400);

  try {
    // depois do aceite o caderno fica só para leitura, até a autora reabrir
    const aceite = await aceiteVigente(caderno);
    if (aceite) return aceito(aceite);

    // a funcionalidade tem que ser da tela, e a tela do caderno
    const [ok] = await sql`
      select 1 from telas t join cadernos c on c.id = t.caderno_id
      where c.slug = ${caderno} and t.id = ${tela}::uuid
        and t.itens @> jsonb_build_array(jsonb_build_object('id', ${item}::text))`;
    if (!ok) return erro("Essa funcionalidade não existe mais. Recarregue a página e tente de novo.", 400);
    if ((await idsComRoteiro(caderno)).has(item)) return erro("Esta funcionalidade agora tem um roteiro de teste passo a passo. Recarregue a página e responda pelos passos.", 409, "roteiro");

    // TUDO NUMA TRANSAÇÃO SÓ: a resposta e o histórico entram juntos ou não entra nada.
    // Os dois registros do histórico olham a resposta ANTERIOR (por isso vêm antes de gravar a nova).
    const resultados = await sql.transaction([
      // 1) o resultado mudou: novo registro de acréscimo (só acrescenta, nunca reescreve)
      sql`
        insert into historico (caderno, tela, item, ator, email, nome, tipo, de, para, obs, anexos, severidade)
        select ${caderno}, ${tela}, ${item}, 'cliente', ${e}, ${nome}, 'resultado', coalesce(r.resultado, 'nao_testado'), ${b.resultado}, ${obs}, ${anexosJson}::jsonb, ${severidade}
        from (select 1) x
        left join respostas_item r on r.caderno = ${caderno} and r.email = ${e} and r.item = ${item}
        where coalesce(r.resultado, 'nao_testado') <> ${b.resultado}
          and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)`,
      // 2) só o texto mudou: junta com a edição de texto anterior da MESMA pessoa se for dentro de 10 minutos
      //    e ela for o último registro da funcionalidade (nada de outro autor no meio, mesma gravidade e mesmos prints)
      sql`
        with ult as (
          select id, tipo, email, severidade, anexos, criado from historico
          where caderno = ${caderno} and item = ${item} order by id desc limit 1
        ), mudou as (
          select 1 from (select 1) x
          left join respostas_item r on r.caderno = ${caderno} and r.email = ${e} and r.item = ${item}
          where coalesce(r.resultado, 'nao_testado') = ${b.resultado}
            and (coalesce(r.obs, '') <> ${obs} or coalesce(r.anexos, '[]'::jsonb) <> ${anexosJson}::jsonb or r.severidade is distinct from ${severidade})
            and not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)
        ), junta as (
          update historico h set obs = ${obs}, criado = now()
          from ult, mudou
          where h.id = ult.id and ult.tipo = 'observacao' and ult.email = ${e}
            and ult.criado > now() - make_interval(mins => ${JUNTAR_OBSERVACOES_EM_MIN})
            and ult.severidade is not distinct from ${severidade} and ult.anexos = ${anexosJson}::jsonb
          returning h.id
        )
        insert into historico (caderno, tela, item, ator, email, nome, tipo, para, obs, anexos, severidade)
        select ${caderno}, ${tela}, ${item}, 'cliente', ${e}, ${nome}, 'observacao', ${b.resultado}, ${obs}, ${anexosJson}::jsonb, ${severidade}
        from mudou where not exists (select 1 from junta)`,
      // 3) a resposta em si (não grava se o aceite foi concluído nesse meio-tempo)
      sql`
        insert into respostas_item (caderno, email, nome, tela, item, resultado, obs, anexos, severidade)
        select ${caderno}, ${e}, ${nome}, ${tela}, ${item}, ${b.resultado}, ${obs}, ${anexosJson}::jsonb, ${severidade}
        where not exists (select 1 from aceites a where a.caderno = ${caderno} and a.reaberto_em is null)
        on conflict (caderno, email, item)
        do update set nome = excluded.nome, tela = excluded.tela, resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, severidade = excluded.severidade, atualizado = now()
        returning item`,
    ]);

    // o aceite foi concluído entre a conferência e a gravação: nada foi gravado
    if (resultados[2].length === 0) {
      const agora = await aceiteVigente(caderno);
      if (agora) return aceito(agora);
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/respostas", err);
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}

function aceito(aceite: { nome: string; criado: string }) {
  const dia = new Date(aceite.criado).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return Response.json({ erro: `A homologação foi concluída em ${dia} por ${aceite.nome}. Para mudar algo, peça para quem preparou o caderno reabrir.`, codigo: "aceito" }, { status: 409 });
}
