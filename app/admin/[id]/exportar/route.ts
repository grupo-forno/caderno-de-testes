import { ehAdmin } from "@/lib/admin";
import { gerarCsv } from "@/lib/csv";
import { sql } from "@/lib/db";
import { dataHora, ROTULO_RESULTADO } from "@/lib/formatar";
import { ROTULO_SEVERIDADE, type Severidade } from "@/lib/tipos";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const texto = (s: string, status: number) => new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

type Resposta = { nome: string; email: string; resultado: string; severidade: string | null; obs: string; anexos: string[]; atualizado: Date };

// Planilha com tudo: uma linha por funcionalidade e por pessoa que respondeu. Mesmas colunas de início da importação.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return texto("Entre como autora para baixar a planilha.", 401);
  const { id } = await params;
  if (!ehUuid(id)) return texto("Caderno não encontrado. Volte à lista de cadernos e abra de novo.", 404);

  const [c] = await sql`select slug from cadernos where id = ${id}`;
  if (!c) return texto("Caderno não encontrado. Volte à lista de cadernos e abra de novo.", 404);
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${id} order by ordem`;
  const telas = await sql`select id, modulo_id, titulo, pai_id, itens from telas where caderno_id = ${id} order by ordem`;
  const respostas = await sql`select item, nome, email, resultado, severidade, obs, anexos, atualizado from respostas_item where caderno = ${c.slug} order by nome, email`;

  const porItem = new Map<string, Resposta[]>();
  for (const r of respostas) {
    const l = porItem.get(r.item as string) ?? [];
    l.push({ nome: r.nome, email: r.email, resultado: r.resultado, severidade: r.severidade, obs: r.obs, anexos: (r.anexos ?? []) as string[], atualizado: r.atualizado });
    porItem.set(r.item as string, l);
  }

  const linhas: string[][] = [["Módulo", "Tela", "Pop-up de", "Funcionalidade", "O que faz", "Pessoa", "E-mail", "Resultado", "Gravidade", "Observação", "Prints", "Atualizado em"]];
  for (const m of modulos) {
    // cada tela principal seguida dos pop-ups dela
    const doModulo = telas.filter((t) => t.modulo_id === m.id);
    const ordem = doModulo.filter((t) => !t.pai_id).flatMap((t) => [t, ...doModulo.filter((f) => f.pai_id === t.id)]);
    for (const t of ordem) {
      const pai = t.pai_id ? (telas.find((x) => x.id === t.pai_id)?.titulo ?? "") : "";
      const itens = (t.itens ?? []) as { id: string; nome: string; faz: string }[];
      if (!itens.length) {
        linhas.push([m.titulo, t.titulo, pai, "", "", "", "", "EM PREPARAÇÃO", "", "", "", ""]);
        continue;
      }
      for (const i of itens) {
        const base = [m.titulo, t.titulo, pai, i.nome, i.faz ?? ""];
        const rs = porItem.get(i.id);
        if (!rs?.length) {
          linhas.push([...base, "", "", ROTULO_RESULTADO.nao_testado, "", "", "", ""]);
          continue;
        }
        for (const r of rs) {
          linhas.push([
            ...base,
            r.nome,
            r.email,
            ROTULO_RESULTADO[r.resultado] ?? r.resultado,
            r.severidade ? (ROTULO_SEVERIDADE[r.severidade as Severidade] ?? "") : "",
            r.obs,
            r.anexos.join(" "),
            dataHora(r.atualizado),
          ]);
        }
      }
    }
  }

  return new Response(gerarCsv(linhas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="homologacao-${c.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
