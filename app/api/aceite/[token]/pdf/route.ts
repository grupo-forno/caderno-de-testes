import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { NaoOkAceito } from "@/lib/aceite";
import type { ContagemAceite } from "@/lib/aceiteRegras";
import { sql } from "@/lib/db";
import { dataHora } from "@/lib/formatar";
import { ROTULO_SEVERIDADE } from "@/lib/tipos";

// Quebra o texto em linhas que cabem na largura
function linhas(texto: string, fonte: PDFFont, tam: number, largura: number) {
  const out: string[] = [];
  for (const par of texto.split("\n")) {
    let atual = "";
    for (const palavra of par.split(/\s+/).filter(Boolean)) {
      const t = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(t, tam) > largura && atual) { out.push(atual); atual = palavra; } else atual = t;
    }
    out.push(atual);
  }
  return out;
}

// Troca caracteres que a fonte padrão do PDF não tem
const limpar = (s: string) =>
  s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?");

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) return new Response("Termo não encontrado.", { status: 404 });
  const [a] = await sql`
    select a.nome, a.email, a.declaracao, a.resumo, a.hash, a.criado, a.reaberto_em, a.reaberto_por, a.reaberto_motivo, c.titulo, c.versao
    from aceites a join cadernos c on c.slug = a.caderno where a.token = ${token}`;
  if (!a) return new Response("Termo não encontrado.", { status: 404 });
  const r = a.resumo as ContagemAceite & { naoOkLista: NaoOkAceito[] };

  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50, largura = W - 2 * M;
  let pag = doc.addPage([W, H]);
  let y = H - M;
  const espaco = (h: number) => { if (y - h < M) { pag = doc.addPage([W, H]); y = H - M; } };
  const texto = (s: string, fonte: PDFFont, tam: number, cor = rgb(0.1, 0.1, 0.15), recuo = 0) => {
    for (const l of linhas(limpar(s), fonte, tam, largura - recuo)) {
      espaco(tam + 4);
      pag.drawText(l, { x: M + recuo, y: y - tam, size: tam, font: fonte, color: cor });
      y -= tam + 4;
    }
  };

  texto("HOMOLOGAÇÃO - ambiente de teste", negrito, 10, rgb(0.6, 0.35, 0));
  y -= 4;
  texto("Termo de aceite de homologação", negrito, 20);
  y -= 8;
  texto(`Sistema: ${a.titulo} (versão ${a.versao})`, normal, 12);
  texto(`Aceite por: ${a.nome} (${a.email})`, normal, 12);
  texto(`Data e hora: ${dataHora(a.criado)} (horário de São Paulo)`, normal, 12);
  y -= 10;

  texto("Declaração", negrito, 13);
  texto(a.declaracao, normal, 11, rgb(0.15, 0.15, 0.2), 0);
  y -= 8;

  texto("Resumo", negrito, 13);
  texto(`Funcionalidades OK: ${r.ok}`, normal, 11);
  texto(`Funcionalidades NÃO OK: ${r.naoOk}`, normal, 11);
  texto(`Funcionalidades não testadas: ${r.naoTestado}`, normal, 11);
  texto(`Áreas em preparação (telas sem funcionalidades): ${r.emPreparacao}`, normal, 11);
  y -= 8;

  texto(`NÃO OK aceitos (${r.naoOkLista.length})`, negrito, 13);
  if (r.naoOkLista.length === 0) texto("Nenhum.", normal, 11);
  for (const n of r.naoOkLista) {
    espaco(36);
    texto(`${n.item} (tela: ${n.tela})`, negrito, 11);
    texto(`Gravidade: ${n.gravidade ? ROTULO_SEVERIDADE[n.gravidade] : "não informada"}`, normal, 10, rgb(0.25, 0.25, 0.3), 12);
    if (n.obs) texto(n.obs, normal, 10, rgb(0.25, 0.25, 0.3), 12);
    y -= 4;
  }
  y -= 8;

  if (a.reaberto_em) {
    texto(`ATENÇÃO: este aceite foi reaberto em ${dataHora(a.reaberto_em)} por ${a.reaberto_por ?? "Equipe"}. Motivo: ${a.reaberto_motivo ?? ""}`, negrito, 10, rgb(0.7, 0.1, 0.1));
    y -= 8;
  }

  texto("Código de verificação (SHA-256)", negrito, 10, rgb(0.3, 0.3, 0.35));
  texto(a.hash, normal, 8, rgb(0.3, 0.3, 0.35));
  y -= 6;
  texto("Declaração feita em ambiente de homologação. O e-mail informado não foi verificado.", normal, 9, rgb(0.3, 0.3, 0.35));

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="termo-de-aceite.pdf"`, "Cache-Control": "private, no-store" },
  });
}
