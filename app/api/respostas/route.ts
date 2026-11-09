import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

const erro = (msg: string, status: number) => Response.json({ erro: msg }, { status });
const email = (v: unknown) => String(v ?? "").trim().toLowerCase();

// Devolve as respostas de uma pessoa: { tela: { resultado, obs } }
export async function GET(req: NextRequest) {
  const caderno = req.nextUrl.searchParams.get("caderno");
  const e = email(req.nextUrl.searchParams.get("email"));
  if (!caderno || !e) return erro("Informe o caderno e o e-mail.", 400);
  try {
    const rows = await sql`select tela, resultado, obs from respostas where caderno = ${caderno} and email = ${e}`;
    return Response.json(Object.fromEntries(rows.map((r) => [r.tela, { resultado: r.resultado, obs: r.obs }])));
  } catch {
    return erro("Não conseguimos carregar suas respostas. Recarregue a página e tente de novo.", 500);
  }
}

// Grava a resposta de uma tela
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const e = email(b?.email);
  const nome = String(b?.nome ?? "").trim();
  if (!b?.caderno || !b?.tela || !e || !nome) return erro("Faltam dados para salvar.", 400);
  if (!["ok", "nao_ok", "nao_testado"].includes(b.resultado)) return erro("Resultado inválido.", 400);
  try {
    await sql`
      insert into respostas (caderno, email, nome, tela, resultado, obs)
      values (${b.caderno}, ${e}, ${nome}, ${b.tela}, ${b.resultado}, ${String(b.obs ?? "").slice(0, 5000)})
      on conflict (caderno, email, tela)
      do update set nome = excluded.nome, resultado = excluded.resultado, obs = excluded.obs, atualizado = now()`;
    return Response.json({ ok: true });
  } catch {
    return erro("Não conseguimos salvar agora. Sua resposta continua na tela; tente de novo em instantes.", 500);
  }
}
