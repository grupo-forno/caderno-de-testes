import ShellCaderno from "@/components/ShellCaderno";
import { ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Tudo que fica dentro de um caderno (visão geral, estrutura, editor, biblioteca, homologações) ganha o mesmo menu lateral.
// Cada página continua conferindo o login e a existência do caderno por conta própria.
export default async function Layout({ children, params }: LayoutProps<"/admin/[id]">) {
  const { id } = await params;
  if (!ehUuid(id) || !(await ehAdmin())) return children;
  const [c] = await sql`select titulo from cadernos where id = ${id}`;
  if (!c) return children;
  return <ShellCaderno cadernoId={id} nome={c.titulo}>{children}</ShellCaderno>;
}
