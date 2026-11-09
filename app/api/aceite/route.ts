import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { aceiteVigente, hashDoAceite, resumoDaPessoa } from "@/lib/aceite";
import { criterios, declaracaoTexto } from "@/lib/aceiteRegras";
import { sql } from "@/lib/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const erro = (msg: string, status: number) => Response.json({ erro: msg }, { status });
const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Conclui a homologação: grava o aceite (nome, e-mail, data, declaração e números) e trava o caderno
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);

  const caderno = typeof b.caderno === "string" ? b.caderno : "";
  const nome = texto(b.nome);
  const email = texto(b.email).toLowerCase();
  if (!caderno || !nome) return erro("Faltam dados. Recarregue a página e entre de novo com seu nome e e-mail.", 400);
  if (!EMAIL.test(email)) return erro("O e-mail informado não parece certo. Recarregue a página e entre de novo.", 400);
  if (b.ciente !== true) return erro("Marque “Estou ciente” para concluir a homologação.", 400);

  try {
    const [c] = await sql`select titulo, versao from cadernos where slug = ${caderno}`;
    if (!c) return erro("Não encontramos este caderno. Confira se o link está completo.", 404);
    if (await aceiteVigente(caderno)) return erro("A homologação já foi concluída. Recarregue a página para ver.", 409);

    // quem decide é o servidor, com as respostas gravadas (não o que a tela mostra)
    const resumo = await resumoDaPessoa(caderno, email);
    const falta = criterios(resumo).filter((x) => !x.ok);
    if (falta.length) return erro(`Ainda não dá para concluir: ${falta.map((x) => x.texto).join(". ")}.`, 409);

    const declaracao = declaracaoTexto(resumo);
    const token = randomUUID();
    const hash = hashDoAceite({ caderno, sistema: c.titulo, versao: c.versao, nome, email, declaracao, resumo });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
    const agente = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;

    try {
      // o aceite e o registro no histórico entram juntos ou não entra nada
      await sql.transaction([
        sql`
          insert into aceites (token, caderno, nome, email, declaracao, resumo, hash, ip, agente)
          values (${token}, ${caderno}, ${nome}, ${email}, ${declaracao}, ${JSON.stringify(resumo)}::jsonb, ${hash}, ${ip}, ${agente})`,
        sql`
          insert into historico (caderno, tela, item, ator, email, nome, tipo, obs)
          values (${caderno}, '', '', 'cliente', ${email}, ${nome}, 'aceite', ${declaracao})`,
      ]);
    } catch (e) {
      // o índice único barra dois aceites ao mesmo tempo
      if ((e as { code?: string }).code === "23505") return erro("A homologação já foi concluída. Recarregue a página para ver.", 409);
      throw e;
    }
    return Response.json({ ok: true, token });
  } catch (err) {
    console.error("POST /api/aceite", err);
    return erro("Não conseguimos registrar agora. Confira sua internet e tente de novo. Suas respostas continuam salvas.", 500);
  }
}
