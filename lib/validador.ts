import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

// Chave de quem valida: guardamos só o hash. O e-mail digitado nunca prova quem é a pessoa nos passos e prints.
export const hashDaChave = (chave: string) => createHash("sha256").update(chave).digest("hex");
export const novaChave = () => randomBytes(24).toString("base64url");

export type Validador = { caderno: string; email: string; nome: string };

// Quem está pedindo? Lê "Authorization: Bearer <chave>" e confere no banco. Só vale para o caderno informado.
export async function validadorDaChave(chave: string | null | undefined, caderno: string): Promise<Validador | null> {
  if (!chave || chave.length < 20 || chave.length > 200 || !caderno) return null;
  const [v] = await sql`select caderno, email, nome from validadores where token_hash = ${hashDaChave(chave)} and caderno = ${caderno}`;
  return v ? { caderno: v.caderno, email: v.email, nome: v.nome } : null;
}

export const chaveDoPedido = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || null;
