import Link from "next/link";
import { notFound } from "next/navigation";
import AdminBar from "@/components/AdminBar";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROTULO: Record<string, string> = { ok: "OK", nao_ok: "NÃO OK", nao_testado: "NÃO TESTADO" };
const COR: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  nao_ok: "bg-rose-100 text-rose-800",
  nao_testado: "bg-slate-200 text-slate-700",
};

export default async function Page({ params, searchParams }: PageProps<"/admin/[id]/respostas">) {
  await exigirAdmin();
  const { id } = await params;
  const { rodada: rq } = await searchParams;
  const [c] = await sql`select slug, titulo, rodada from cadernos where id::text = ${id}`;
  if (!c) notFound();
  const rodada = Math.min(Math.max(Number(rq) || c.rodada, 1), c.rodada);
  const todas = await sql`select id, titulo, pai_id from telas where caderno_id = ${id} order by ordem`;
  // cada tela principal seguida dos pop-ups dela
  const telas = todas.filter((t) => !t.pai_id).flatMap((t) => [t, ...todas.filter((f) => f.pai_id === t.id)]);
  const rs = await sql`select nome, email, tela, resultado, obs, anexos, atualizado from respostas where caderno = ${c.slug} and rodada = ${rodada} order by nome, email`;

  const pessoas = new Map<string, { nome: string; email: string; porTela: Map<string, (typeof rs)[number]> }>();
  for (const r of rs) {
    if (!pessoas.has(r.email)) pessoas.set(r.email, { nome: r.nome, email: r.email, porTela: new Map() });
    pessoas.get(r.email)!.porTela.set(r.tela, r);
  }

  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/admin/${id}`} className="text-sm text-indigo-700 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-2xl font-semibold">Respostas: {c.titulo}</h1>
        {c.rodada > 1 && (
          <nav aria-label="Rodadas" className="mt-3 flex flex-wrap gap-2 text-sm">
            {Array.from({ length: c.rodada }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={`/admin/${id}/respostas?rodada=${n}`} className={`rounded-md border px-3 py-1 ${n === rodada ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-800" : "border-slate-300 hover:bg-slate-50"}`}>
                Rodada {n}
              </Link>
            ))}
          </nav>
        )}

        {pessoas.size === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Ninguém respondeu nesta rodada ainda. Quando o cliente começar, as respostas aparecem aqui.</p>
        ) : (
          [...pessoas.values()].map((p) => (
            <section key={p.email} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">{p.nome} <span className="text-sm font-normal text-slate-600">{p.email}</span></h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {telas.map((t) => {
                  const r = p.porTela.get(t.id);
                  const res = r?.resultado ?? "nao_testado";
                  return (
                    <li key={t.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className={t.pai_id ? "ml-5 font-medium" : "font-medium"}>{t.pai_id && "↳ Pop-up: "}{t.titulo}</span>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COR[res]}`}>{ROTULO[res]}</span>
                      </div>
                      {r?.obs && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.obs}</p>}
                      {r && r.anexos.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {(r.anexos as string[]).map((u) => (
                            <li key={u}>
                              <a href={u} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={u} alt="Print anexado pelo cliente" className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
    </>
  );
}
