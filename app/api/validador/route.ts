import { sql } from "@/lib/db";
import { hashDaChave, novaChave, validadorDaChave } from "@/lib/validador";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const erro = (msg: string, status: number, codigo?: string) => Response.json({ erro: msg, codigo }, { status });
const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Entrar no caderno como validador.
// - Com "chave" (link para continuar): confere a chave e devolve quem é a pessoa.
// - Sem chave: cria a pessoa e devolve uma chave nova, que só aparece agora. Se o e-mail já começou o teste, não entrega a chave:
//   quem digitar o e-mail de outra pessoa não consegue entrar no lugar dela.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return erro("Não entendemos o que foi enviado. Recarregue a página e tente de novo.", 400);
  const caderno = texto(b.caderno);
  if (!caderno) return erro("Faltam dados para entrar. Recarregue a página e tente de novo.", 400);

  try {
    if (typeof b.chave === "string" && b.chave) {
      const v = await validadorDaChave(b.chave, caderno);
      if (!v) return erro("Este link para continuar não vale mais. Peça um novo a quem preparou o caderno.", 401, "chave_invalida");
      return Response.json({ nome: v.nome, email: v.email });
    }

    const nome = texto(b.nome);
    const email = texto(b.email).toLowerCase();
    if (!nome) return erro("Escreva seu nome.", 400);
    if (!EMAIL.test(email)) return erro("O e-mail informado não parece certo. Confira e tente de novo.", 400);
    const [c] = await sql`select 1 from cadernos where slug = ${caderno}`;
    if (!c) return erro("Não encontramos este caderno. Confira se o link está completo.", 404);

    const chave = novaChave();
    const criado = await sql`
      insert into validadores (caderno, email, nome, token_hash) values (${caderno}, ${email}, ${nome}, ${hashDaChave(chave)})
      on conflict (caderno, email) do nothing returning email`;
    if (!criado.length) {
      return erro("Este e-mail já começou o teste neste caderno. Para continuar, abra o link para continuar que apareceu na primeira vez. Se não tem mais esse link, peça um novo a quem preparou o caderno.", 409, "ja_existe");
    }
    return Response.json({ nome, email, chave });
  } catch (e) {
    console.error("POST /api/validador", e);
    return erro("Não conseguimos entrar agora. Confira sua internet e tente de novo.", 500);
  }
}
