import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

const IMAGENS = ["image/png", "image/jpeg", "image/webp"];

// Erro de validação: o pedido está errado e repetir não adianta (responde 400 com texto fixo)
class Recusa extends Error {}

// Autora: imagens (até 10 MB) e PDFs (até 20 MB).
// Cliente (link aberto): só imagens até 5 MB, e só se o caderno existir.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody;
    const admin = await ehAdmin();
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_nome, payload) => {
        if (admin) return { allowedContentTypes: [...IMAGENS, "application/pdf"], maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true };
        const [c] = payload ? await sql`select 1 from cadernos where slug = ${payload}` : [];
        if (!c) throw new Recusa("caderno");
        return { allowedContentTypes: IMAGENS, maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(r);
  } catch (e) {
    if (e instanceof Recusa) return Response.json({ erro: "Não encontramos este caderno. Confira se o link está completo." }, { status: 400 });
    console.error("POST /api/upload", e);
    return Response.json({ erro: "Não conseguimos enviar o arquivo agora. Tente de novo em instantes. Se continuar, avise quem preparou o caderno." }, { status: 500 });
  }
}
