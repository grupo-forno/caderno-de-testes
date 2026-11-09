import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import type { ContagemAceite } from "@/lib/aceiteRegras";
import type { Severidade } from "@/lib/tipos";

export type NaoOkAceito = { tela: string; item: string; gravidade: Severidade | null; obs: string };
export type ResumoAceite = ContagemAceite & { naoOkLista: NaoOkAceito[] };

export type AceiteVigente = { token: string; nome: string; email: string; criado: string };

// O caderno está travado quando existe um aceite que não foi reaberto
export async function aceiteVigente(slug: string): Promise<AceiteVigente | null> {
  const [a] = await sql`select token, nome, email, criado from aceites where caderno = ${slug} and reaberto_em is null order by criado desc limit 1`;
  return a ? { token: a.token, nome: a.nome, email: a.email, criado: new Date(a.criado).toISOString() } : null;
}

// Conta as respostas DESSA pessoa (e-mail) sobre o que existe hoje no caderno
export async function resumoDaPessoa(slug: string, email: string): Promise<ResumoAceite> {
  const telas = await sql`select t.titulo, t.itens from telas t join cadernos c on c.id = t.caderno_id where c.slug = ${slug}`;
  const rows = await sql`select item, resultado, obs, severidade from respostas_item where caderno = ${slug} and email = ${email}`;
  const resp = new Map(rows.map((r) => [r.item as string, r]));
  const r: ResumoAceite = { total: 0, ok: 0, naoOk: 0, naoTestado: 0, emPreparacao: 0, impedem: 0, naoOkLista: [] };
  for (const t of telas) {
    const itens = (t.itens ?? []) as { id: string; nome: string }[];
    if (itens.length === 0) {
      r.emPreparacao++;
      continue;
    }
    for (const i of itens) {
      r.total++;
      const x = resp.get(i.id);
      if (x?.resultado === "ok") r.ok++;
      else if (x?.resultado === "nao_ok") {
        r.naoOk++;
        const gravidade = (x.severidade ?? null) as Severidade | null;
        if (gravidade === null || gravidade === "impede") r.impedem++;
        r.naoOkLista.push({ tela: t.titulo, item: i.nome, gravidade, obs: x.obs ?? "" });
      } else r.naoTestado++;
    }
  }
  return r;
}

// JSON com as chaves em ordem fixa, para o mesmo conteúdo dar sempre o mesmo hash
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export const hashDoAceite = (conteudo: unknown) => createHash("sha256").update(canonico(conteudo)).digest("hex");
