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
  const [t] = await sql`select t.titulo, t.imagem_url, t.itens, c.titulo as caderno, c.versao, p.titulo as pai, m.titulo as modulo from telas t join cadernos c on c.id = t.caderno_id left join telas p on p.id = t.pai_id left join modulos m on m.id = t.modulo_id where t.id = ${telaId}`;
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

  // desenha uma imagem (PNG ou JPG; outros formatos ficam de fora) no máximo com a largura e altura dadas
  const desenharImagem = async (url: string, larguraMax: number, alturaMax: number) => {
    try {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      const img = /\.png($|\?)/i.test(url) ? await doc.embedPng(bytes) : /\.jpe?g($|\?)/i.test(url) ? await doc.embedJpg(bytes) : null;
      if (!img) return;
      const esc = Math.min(larguraMax / img.width, alturaMax / img.height, 1);
      const w = img.width * esc, h = img.height * esc;
      espaco(h + 10);
      pag.drawImage(img, { x: M, y: y - h, width: w, height: h });
      y -= h + 12;
    } catch {
      // sem a imagem, o PDF sai só com o texto
    }
  };

  texto(`${t.caderno}${t.modulo ? ` · ${t.modulo}` : ""} · versão ${t.versao}`, normal, 10, rgb(0.4, 0.4, 0.5));
  if (t.pai) texto(`Pop-up da tela: ${t.pai}`, negrito, 11, rgb(0.3, 0.25, 0.7));
  y -= 4;
  texto(t.titulo, negrito, 20);
  y -= 10;

  if (t.imagem_url) {
    await desenharImagem(t.imagem_url, largura, 280);
    y -= 4;
  }

  const itens = (t.itens as { nome: string; faz: string; imagem?: string; passos?: { fazer: string; esperado: string }[] }[]) ?? [];
  if (!itens.length) texto("Esta tela ainda está em preparação.", normal, 11);
  else {
    texto("O que cada item faz", negrito, 13);
    y -= 4;
  }
  for (const it of itens) {
    espaco(34);
    texto(it.nome, negrito, 11);
    texto(it.faz || "—", normal, 11, rgb(0.25, 0.25, 0.3), 12);
    if (it.passos?.length) {
      y -= 4;
      texto("Roteiro de teste", negrito, 10, rgb(0.3, 0.25, 0.7), 12);
      it.passos.forEach((p, n) => {
        texto(`${n + 1}. O que fazer: ${p.fazer}`, normal, 10, rgb(0.1, 0.1, 0.15), 18);
        texto(`O que deve acontecer: ${p.esperado}`, normal, 10, rgb(0.05, 0.35, 0.2), 26);
      });
    }
    if (it.imagem) {
      y -= 4;
      await desenharImagem(it.imagem, 320, 200);
    }
    y -= 6;
  }

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="funcionalidades.pdf"` },
  });
}
