"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

// Reabre a homologação: libera o cliente para editar de novo. O motivo é obrigatório e fica registrado.
export async function reabrirHomologacao(cadernoId: string, f: FormData) {
  await exigirAdmin();
  const motivo = String(f.get("motivo") ?? "").trim().slice(0, 1000);
  if (motivo.length < 5) redirect(`/admin/${cadernoId}?erro=motivo`);
  const [c] = await sql`select slug from cadernos where id::text = ${cadernoId}`;
  if (!c) redirect("/admin");
  // um comando só: a reabertura e o registro dela no histórico acontecem juntos ou não acontece nada
  const feito = await sql`
    with r as (
      update aceites set reaberto_em = now(), reaberto_por = 'Equipe', reaberto_motivo = ${motivo}
      where caderno = ${c.slug} and reaberto_em is null returning id
    )
    insert into historico (caderno, tela, item, ator, nome, tipo, obs)
    select ${c.slug}, '', '', 'autora', 'Equipe', 'reabertura', ${motivo} from r
    returning id`;
  if (feito.length === 0) redirect(`/admin/${cadernoId}?erro=aceite`);
  redirect(`/admin/${cadernoId}?reaberta=1`);
}
