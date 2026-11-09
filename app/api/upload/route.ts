import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

const IMAGENS = ["image/png", "image/jpeg", "image/webp"];

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
        if (!c) throw new Error("Caderno não encontrado.");
        return { allowedContentTypes: IMAGENS, maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(r);
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 400 });
  }
}
