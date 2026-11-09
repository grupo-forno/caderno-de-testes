import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

// Convite individual: o link de acesso de um validador. Não guardamos o link em lugar nenhum:
// ele é recalculado a partir do id do validador, da versão da chave e da senha da área interna (ADMIN_PASSWORD).
// A equipe consegue copiar o link de novo quando quiser, e "Gerar novo link" aumenta a versão e invalida o anterior.
const segredo = () => process.env.ADMIN_PASSWORD ?? "";
const assinar = (id: string, versao: number) => createHmac("sha256", segredo()).update(`convite:${id}:${versao}`).digest("hex").slice(0, 40);

export const tokenDoValidador = (id: string, versao: number) => `${id}.${assinar(id, versao)}`;

export type ValidadorAutenticado = { id: string; rodadaId: string; cadernoId: string; nome: string; email: string };

// Quem é o dono do convite? Só vale se a rodada estiver publicada (em validação).
export async function validadorDoConvite(token: string | null | undefined): Promise<ValidadorAutenticado | null> {
  if (!segredo() || !token || token.length > 120) return null;
  const [id, assinatura] = token.split(".");
  if (!id || !assinatura || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [v] = await sql`
    select v.id, v.rodada_id, v.nome, v.email, v.chave_versao, r.caderno_id
    from rodada_validadores v join rodadas r on r.id = v.rodada_id
    where v.id = ${id} and r.situacao = 'em_validacao'`;
  if (!v) return null;
  const esperado = Buffer.from(assinar(v.id, v.chave_versao));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  return { id: v.id, rodadaId: v.rodada_id, cadernoId: v.caderno_id, nome: v.nome, email: v.email };
}

export const conviteDoPedido = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || null;
