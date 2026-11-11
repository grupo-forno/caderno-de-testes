import { sql } from "@/lib/db";
import type { Item } from "@/lib/tipos";

// Roteiro de uma funcionalidade = um cenário "vinculado". O texto fica só na tela: este cenário é refeito a partir dela
// (ao escolher na rodada e de novo ao publicar), então nunca existe uma segunda cópia para manter.
export const PREFIXO_ROTEIRO = "roteiro:";
export const ehRoteiro = (origem: string | null | undefined) => !!origem && origem.startsWith(PREFIXO_ROTEIRO);

// Cria ou atualiza o cenário vinculado de cada funcionalidade informada (ids de item). Devolve itemId -> id do cenário.
export async function sincronizarRoteiros(cadernoId: string, itemIds: string[]): Promise<Map<string, string>> {
  const feito = new Map<string, string>();
  if (!itemIds.length) return feito;
  const quer = new Set(itemIds);
  const telas = await sql`select t.id, t.titulo, t.link_url, t.modo_teste, t.itens, coalesce(m.titulo, 'Sem módulo') as modulo from telas t left join modulos m on m.id = t.modulo_id where t.caderno_id = ${cadernoId}`;
  const existentes = await sql`select id, origem_item from cenarios where caderno_id = ${cadernoId} and origem_item = any(${itemIds.map((i) => PREFIXO_ROTEIRO + i)}::text[])`;
  const idDe = new Map(existentes.map((c) => [c.origem_item as string, c.id as string]));
  for (const t of telas) {
    for (const it of t.itens as Item[]) {
      if (!quer.has(it.id) || !it.passos?.length) continue;
      const origem = PREFIXO_ROTEIRO + it.id;
      const titulo = `${t.modulo} › ${t.titulo} › ${it.nome}`.slice(0, 200);
      const tipo = (t.modo_teste ?? (t.link_url ? "funcional" : "desenho")) === "desenho" ? "desenho" : "funcional";
      const passos = JSON.stringify(it.passos.map((p) => ({ id: p.id, fazer: p.fazer, esperado: p.esperado, telaId: null, perfil: "" })));
      const atual = idDe.get(origem);
      if (atual) {
        await sql`update cenarios set titulo = ${titulo}, objetivo = ${it.faz ?? ""}, tipo = ${tipo}, tela_id = ${t.id}::uuid, passos = ${passos}::jsonb, situacao = 'ativo', atualizado = now() where id = ${atual}`;
        feito.set(it.id, atual);
      } else {
        const [novo] = await sql`insert into cenarios (caderno_id, titulo, objetivo, tipo, tela_id, passos, origem_item) values (${cadernoId}, ${titulo}, ${it.faz ?? ""}, ${tipo}, ${t.id}::uuid, ${passos}::jsonb, ${origem}) returning id`;
        feito.set(it.id, novo.id as string);
      }
    }
  }
  return feito;
}
