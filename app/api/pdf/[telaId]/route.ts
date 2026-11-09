import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { sql } from "@/lib/db";

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
    .replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?");

export async function GET(_req: Request, { params }: { params: Promise<{ telaId: string }> }) {
  const { telaId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(telaId)) return new Response("Tela não encontrada.", { status: 404 });
  const [t] = await sql`select t.titulo, t.imagem_url, t.itens, c.titulo as caderno, c.versao from telas t join cadernos c on c.id = t.caderno_id where t.id = ${telaId}`;
  if (!t) return new Response("Tela não encontrada.", { status: 404 });

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

  texto(`${t.caderno} · versão ${t.versao}`, normal, 10, rgb(0.4, 0.4, 0.5));
  y -= 4;
  texto(t.titulo, negrito, 20);
  y -= 10;

  // imagem da tela (PNG ou JPG; outros formatos ficam de fora)
  if (t.imagem_url) {
    try {
      const bytes = new Uint8Array(await (await fetch(t.imagem_url)).arrayBuffer());
      const img = /\.png($|\?)/i.test(t.imagem_url) ? await doc.embedPng(bytes) : /\.jpe?g($|\?)/i.test(t.imagem_url) ? await doc.embedJpg(bytes) : null;
      if (img) {
        const esc = Math.min(largura / img.width, 280 / img.height, 1);
        const w = img.width * esc, h = img.height * esc;
        espaco(h + 10);
        pag.drawImage(img, { x: M, y: y - h, width: w, height: h });
        y -= h + 16;
      }
    } catch {
      // sem a imagem, o PDF sai só com o texto
    }
  }

  texto("O que cada item faz", negrito, 13);
  y -= 4;
  const itens = (t.itens as { nome: string; faz: string }[]) ?? [];
  if (!itens.length) texto("Nenhum item cadastrado.", normal, 11);
  for (const it of itens) {
    espaco(34);
    texto(it.nome, negrito, 11);
    texto(it.faz || "—", normal, 11, rgb(0.25, 0.25, 0.3), 12);
    y -= 6;
  }

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="funcionalidades.pdf"` },
  });
}
