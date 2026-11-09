import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

// só aceita arquivos que vieram do nosso armazenamento
const anexosValidos = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map(String).filter((u) => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(u)).slice(0, 10);

const erro = (msg: string, status: number) => Response.json({ erro: msg }, { status });
const email = (v: unknown) => String(v ?? "").trim().toLowerCase();

// A rodada vale a do caderno no servidor, nunca a que o navegador disser
async function rodadaAtual(slug: string): Promise<number | null> {
  const [c] = await sql`select rodada from cadernos where slug = ${slug}`;
  return c ? c.rodada : null;
}

// Devolve as respostas de uma pessoa: { atual: {tela: {...}}, anterior: {tela: {...}} }
export async function GET(req: NextRequest) {
  const caderno = req.nextUrl.searchParams.get("caderno");
  const e = email(req.nextUrl.searchParams.get("email"));
  if (!caderno || !e) return erro("Informe o caderno e o e-mail.", 400);
  try {
    const rodada = await rodadaAtual(caderno);
    if (rodada === null) return erro("Caderno não encontrado.", 404);
    const rows = await sql`select tela, rodada, resultado, obs, anexos from respostas where caderno = ${caderno} and email = ${e} and rodada in (${rodada}, ${rodada - 1})`;
    const por = (r: number) =>
      Object.fromEntries(rows.filter((x) => x.rodada === r).map((x) => [x.tela, { resultado: x.resultado, obs: x.obs, anexos: x.anexos }]));
    return Response.json({ atual: por(rodada), anterior: por(rodada - 1) });
  } catch {
    return erro("Não conseguimos carregar suas respostas. Recarregue a página e tente de novo.", 500);
  }
}

// Grava a resposta de uma tela na rodada atual
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const e = email(b?.email);
  const nome = String(b?.nome ?? "").trim();
  if (!b?.caderno || !b?.tela || !e || !nome) return erro("Faltam dados para salvar.", 400);
  if (!["ok", "nao_ok", "nao_testado"].includes(b.resultado)) return erro("Resultado inválido.", 400);
  try {
    const rodada = await rodadaAtual(b.caderno);
    if (rodada === null) return erro("Caderno não encontrado.", 404);
    await sql`
      insert into respostas (caderno, email, nome, tela, rodada, resultado, obs, anexos)
      values (${b.caderno}, ${e}, ${nome}, ${b.tela}, ${rodada}, ${b.resultado}, ${String(b.obs ?? "").slice(0, 5000)}, ${JSON.stringify(anexosValidos(b.anexos))}::jsonb)
      on conflict (caderno, email, tela, rodada)
      do update set nome = excluded.nome, resultado = excluded.resultado, obs = excluded.obs, anexos = excluded.anexos, atualizado = now()`;
    return Response.json({ ok: true });
  } catch {
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}
