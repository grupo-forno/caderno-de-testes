import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ehAdmin } from "@/lib/admin";
import { validadorDoConvite } from "@/lib/convite";

const IMAGENS = ["image/png", "image/jpeg", "image/webp"];

// Pedido sem permissão: repetir não adianta (responde 401 com texto fixo)
class Recusa extends Error {}

function lerConvite(p: string | null): string | null {
  if (p?.startsWith("{")) {
    try {
      const j = JSON.parse(p);
      return typeof j.convite === "string" && j.convite ? j.convite : null;
    } catch {}
  }
  return null;
}

// Autora: imagens e PDFs (até 20 MB).
// Validador de rodada: só imagens até 5 MB, com o convite conferido no servidor.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HandleUploadBody;
    const admin = await ehAdmin();
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_nome, payload) => {
        if (admin) return { allowedContentTypes: [...IMAGENS, "application/pdf"], maximumSizeInBytes: 20 * 1024 * 1024, addRandomSuffix: true };
        const convite = lerConvite(payload);
        if (!convite || !(await validadorDoConvite(convite))) throw new Recusa("chave");
        return { allowedContentTypes: IMAGENS, maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(r);
  } catch (e) {
    if (e instanceof Recusa) return Response.json({ erro: "Não reconhecemos você nesta rodada. Abra de novo o link de acesso que você recebeu." }, { status: 401 });
    console.error("POST /api/upload", e);
    return Response.json({ erro: "Não conseguimos enviar o arquivo agora. Tente de novo em instantes. Se continuar, avise quem preparou o caderno." }, { status: 500 });
  }
}
