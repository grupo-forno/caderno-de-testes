import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { validadorDaChave } from "@/lib/validador";

const IMAGENS = ["image/png", "image/jpeg", "image/webp"];

// Erro de validação: o pedido está errado e repetir não adianta (responde 400 com texto fixo)
class Recusa extends Error {}

function lerPayload(p: string | null): { caderno: string; chave: string | null } {
  if (p?.startsWith("{")) {
    try {
      const j = JSON.parse(p);
      return { caderno: typeof j.caderno === "string" ? j.caderno : "", chave: typeof j.chave === "string" && j.chave ? j.chave : null };
    } catch {}
  }
  return { caderno: p ?? "", chave: null };
}

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
        // Prints dos passos: o payload traz a chave de quem valida, conferida no servidor.
        // Payload só com o endereço do caderno é o modelo antigo (funcionalidades sem roteiro).
        const pedido = lerPayload(payload);
        if (pedido.chave) {
          if (!(await validadorDaChave(pedido.chave, pedido.caderno))) throw new Recusa("chave");
        } else {
          const [c] = pedido.caderno ? await sql`select 1 from cadernos where slug = ${pedido.caderno}` : [];
          if (!c) throw new Recusa("caderno");
        }
        return { allowedContentTypes: IMAGENS, maximumSizeInBytes: 5 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(r);
  } catch (e) {
    if (e instanceof Recusa && e.message === "chave") return Response.json({ erro: "Não reconhecemos você neste caderno. Abra de novo o link para continuar que você recebeu." }, { status: 401 });
    if (e instanceof Recusa) return Response.json({ erro: "Não encontramos este caderno. Confira se o link está completo." }, { status: 400 });
    console.error("POST /api/upload", e);
    return Response.json({ erro: "Não conseguimos enviar o arquivo agora. Tente de novo em instantes. Se continuar, avise quem preparou o caderno." }, { status: 500 });
  }
}
