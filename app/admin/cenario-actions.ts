"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";
import { lerPassosCenario, TIPOS, type TipoCenario } from "@/lib/cenarios";

const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const txt = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const voltar = (cadernoId: string) => `/admin/${cadernoId}/biblioteca`;

// Toda ação confere a permissão no servidor (exigirAdmin) e que o cenário é do caderno informado
async function doCaderno(cadernoId: string, cenarioId: string) {
  if (!ehUuid(cadernoId) || !ehUuid(cenarioId)) redirect(`${voltar(cadernoId)}?erro=cenario`);
  const [c] = await sql`select * from cenarios where id = ${cenarioId} and caderno_id = ${cadernoId}`;
  if (!c) redirect(`${voltar(cadernoId)}?erro=cenario`);
  return c;
}

export async function salvarCenario(cadernoId: string, cenarioId: string | null, f: FormData) {
  await exigirAdmin();
  const aqui = `${voltar(cadernoId)}/${cenarioId ?? "novo"}`;
  const [cad] = ehUuid(cadernoId) ? await sql`select 1 from cadernos where id = ${cadernoId}` : [];
  if (!cad) redirect("/admin");
  if (cenarioId) await doCaderno(cadernoId, cenarioId);

  const titulo = txt(f, "titulo", 200);
  if (!titulo) redirect(`${aqui}?erro=titulo`);
  const tipo = txt(f, "tipo") as TipoCenario;
  if (!TIPOS.includes(tipo)) redirect(`${aqui}?erro=tipo`);

  const telas = await sql`select id from telas where caderno_id = ${cadernoId}`;
  const validas = new Set(telas.map((t) => t.id as string));
  const passos = lerPassosCenario(txt(f, "passos", 200000), validas, randomUUID, ehUuid);
  if (passos === null) redirect(`${aqui}?erro=passo`);
  const telaId = validas.has(txt(f, "tela_id")) ? txt(f, "tela_id") : null;
  const origem = txt(f, "origem_item", 64) || null;

  const dados = JSON.stringify(passos);
  if (cenarioId) {
    await sql`
      update cenarios set titulo = ${titulo}, objetivo = ${txt(f, "objetivo")}, tipo = ${tipo}, pre_requisitos = ${txt(f, "pre_requisitos")}, dados_teste = ${txt(f, "dados_teste")},
        tela_id = ${telaId}::uuid, passos = ${dados}::jsonb, atualizado = now()
      where id = ${cenarioId} and caderno_id = ${cadernoId}`;
  } else {
    await sql`
      insert into cenarios (caderno_id, titulo, objetivo, tipo, pre_requisitos, dados_teste, tela_id, passos, origem_item)
      values (${cadernoId}, ${titulo}, ${txt(f, "objetivo")}, ${tipo}, ${txt(f, "pre_requisitos")}, ${txt(f, "dados_teste")}, ${telaId}::uuid, ${dados}::jsonb, ${origem})`;
  }
  redirect(`${voltar(cadernoId)}?salvo=1`);
}

// Cria uma cópia editável (com ids de passo novos) e abre o editor dela
export async function duplicarCenario(cadernoId: string, cenarioId: string) {
  await exigirAdmin();
  const c = await doCaderno(cadernoId, cenarioId);
  const passos = (c.passos as { id: string }[]).map((p) => ({ ...p, id: randomUUID() }));
  const [copia] = await sql`
    insert into cenarios (caderno_id, titulo, objetivo, tipo, pre_requisitos, dados_teste, tela_id, passos, origem_item)
    values (${cadernoId}, ${`Cópia de ${c.titulo}`.slice(0, 200)}, ${c.objetivo}, ${c.tipo}, ${c.pre_requisitos}, ${c.dados_teste}, ${c.tela_id}::uuid, ${JSON.stringify(passos)}::jsonb, ${c.origem_item})
    returning id`;
  redirect(`${voltar(cadernoId)}/${copia.id}?copia=1`);
}

// Arquivar tira o cenário da lista padrão sem apagar nada. Reativar traz de volta.
export async function mudarSituacaoCenario(cadernoId: string, cenarioId: string, situacao: "ativo" | "arquivado") {
  await exigirAdmin();
  await doCaderno(cadernoId, cenarioId);
  await sql`update cenarios set situacao = ${situacao}, atualizado = now() where id = ${cenarioId} and caderno_id = ${cadernoId}`;
  redirect(`${voltar(cadernoId)}?${situacao === "arquivado" ? "arquivado=1" : "reativado=1"}`);
}
