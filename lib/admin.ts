import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const NOME = "admin";
// ponytail: senha única da autora; o cookie é um HMAC dela. Várias autoras com login próprio só se precisar.
const token = () => createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update("admin").digest("hex");

export function senhaCorreta(s: string) {
  const a = Buffer.from(createHmac("sha256", "x").update(s).digest());
  const b = Buffer.from(createHmac("sha256", "x").update(process.env.ADMIN_PASSWORD ?? "").digest());
  return !!process.env.ADMIN_PASSWORD && timingSafeEqual(a, b);
}

export async function marcarEntrada() {
  (await cookies()).set(NOME, token(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function sairDoAdmin() {
  (await cookies()).delete(NOME);
}

export async function ehAdmin() {
  const c = (await cookies()).get(NOME)?.value;
  if (!c || !process.env.ADMIN_PASSWORD) return false;
  const a = Buffer.from(c), b = Buffer.from(token());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exigirAdmin() {
  if (!(await ehAdmin())) redirect("/admin");
}
