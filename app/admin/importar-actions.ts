"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { parseCsv } from "@/lib/csv";
import { aceiteVigente } from "@/lib/aceite";
import { sql } from "@/lib/db";
import { chaveDe, ESTADO_INICIAL, planejar, semNovidade, type EstadoImportacao, type Existente, type Plano } from "@/lib/importacao";

const MAX_BYTES = 1_000_000;
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const erroGeral = (texto: string, mensagem: string): EstadoImportacao => ({ ...ESTADO_INICIAL, fase: "erro", quando: Date.now(), textoVerificado: texto, mensagem });

// Lê o que o cliente mandou, confere tamanho e tipo no servidor e monta o plano contra o que já existe (uma consulta por tabela)
async function preparar(cadernoId: string, f: FormData): Promise<{ texto: string; plano: Plano | null; existente: Existente | null; erro: EstadoImportacao | null }> {
  const bruto = f.get("texto");
  const texto = typeof bruto === "string" ? bruto : "";
  if (!ehUuid(cadernoId)) return { texto, plano: null, existente: null, erro: erroGeral(texto, "Caderno não encontrado. Volte à lista de cadernos e abra de novo.") };
  if (!texto.trim()) return { texto, plano: null, existente: null, erro: erroGeral(texto, "Escolha o arquivo ou cole o texto da planilha antes de verificar.") };
  if (new TextEncoder().encode(texto).length > MAX_BYTES) return { texto, plano: null, existente: null, erro: erroGeral(texto, "A planilha passou de 1 MB. Divida em duas planilhas e importe uma de cada vez.") };

  const [c] = await sql`select 1 from cadernos where id = ${cadernoId}`;
  if (!c) return { texto, plano: null, existente: null, erro: erroGeral(texto, "Caderno não encontrado. Volte à lista de cadernos e abra de novo.") };
  const modulos = await sql`select id, titulo from modulos where caderno_id = ${cadernoId} order by ordem, id`;
  const telas = await sql`select id, modulo_id, titulo, pai_id, itens from telas where caderno_id = ${cadernoId} order by ordem, id`;
  const existente: Existente = {
    modulos: modulos.map((m) => ({ id: m.id as string, titulo: m.titulo as string })),
    telas: telas.map((t) => ({
      id: t.id as string,
      moduloId: t.modulo_id as string,
      titulo: t.titulo as string,
      paiId: (t.pai_id as string | null) ?? null,
      itens: ((t.itens ?? []) as { nome: string }[]).map((i) => i.nome),
    })),
  };
  return { texto, plano: planejar(parseCsv(texto), existente), existente, erro: null };
}

const comErros = (texto: string, p: Plano): EstadoImportacao => ({
  fase: "erro",
  quando: Date.now(),
  textoVerificado: texto,
  mensagem: "A planilha tem problemas. Corrija o texto abaixo (ou o arquivo) e verifique de novo. Nada foi gravado.",
  erros: p.erros,
  totalErros: p.totalErros,
  resumo: null,
});

// Se o banco falhar, a pessoa continua na página com o texto da planilha preservado (nada de página de erro)
async function prepararSeguro(cadernoId: string, f: FormData): ReturnType<typeof preparar> {
  try {
    return await preparar(cadernoId, f);
  } catch (e) {
    console.error("importação: preparar", e);
    const bruto = f.get("texto");
    const texto = typeof bruto === "string" ? bruto : "";
    return { texto, plano: null, existente: null, erro: erroGeral(texto, "Não conseguimos conferir a planilha agora. O texto continua aqui. Clique em Verificar planilha para tentar de novo.") };
  }
}

// Fase 1: só confere e mostra a prévia. Não grava nada.
export async function verificarImportacao(cadernoId: string, _anterior: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  await exigirAdmin();
  const { texto, plano, erro } = await prepararSeguro(cadernoId, f);
  if (erro || !plano) return erro!;
  if (plano.totalErros) return comErros(texto, plano);
  if (semNovidade(plano.resumo)) return erroGeral(texto, "Não há nada novo para importar: tudo o que está na planilha já existe neste caderno.");
  return { ...ESTADO_INICIAL, fase: "previa", quando: Date.now(), textoVerificado: texto, resumo: plano.resumo };
}

// Fase 2: confere de novo (o caderno pode ter mudado) e grava TUDO numa transação só. Se algo falhar, nada é gravado.
export async function confirmarImportacao(cadernoId: string, _anterior: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  await exigirAdmin();
  const { texto, plano, existente, erro } = await prepararSeguro(cadernoId, f);
  if (erro || !plano || !existente) return erro!;
  // com a homologação concluída o caderno não pode crescer por baixo do termo: reabra antes
  const [cad] = await sql`select slug from cadernos where id = ${cadernoId}`;
  if (cad && (await aceiteVigente(cad.slug))) return erroGeral(texto, "A homologação está concluída, então nada foi importado. Reabra a homologação na página do caderno e importe de novo.");
  if (plano.totalErros) return comErros(texto, plano);
  if (semNovidade(plano.resumo)) return erroGeral(texto, "Não há nada novo para importar: tudo o que está na planilha já existe neste caderno.");

  // ids novos já aqui, para as linhas da transação poderem se referir umas às outras
  const idModulo = new Map<string, string>();
  for (const m of existente.modulos) {
    const k = chaveDe(m.titulo);
    if (!idModulo.has(k)) idModulo.set(k, m.id);
  }
  const [{ ordemModulo }] = await sql`select coalesce(max(ordem), 0)::int as "ordemModulo" from modulos where caderno_id = ${cadernoId}`;
  const [{ ordemTela }] = await sql`select coalesce(max(ordem), 0)::int as "ordemTela" from telas where caderno_id = ${cadernoId}`;

  const comandos = [];
  plano.modulosNovos.forEach((m, i) => {
    const id = randomUUID();
    idModulo.set(m.chave, id);
    comandos.push(sql`insert into modulos (id, caderno_id, ordem, titulo) values (${id}, ${cadernoId}, ${ordemModulo + i + 1}, ${m.titulo})`);
  });

  const idTela = new Map<string, string>(); // chave da tela -> id (existente ou novo)
  const novas = plano.telas.filter((t) => !t.existenteId);
  for (const t of plano.telas) idTela.set(t.chave, t.existenteId ?? randomUUID());
  const ordemDe = new Map(novas.map((t, i) => [t.chave, ordemTela + i + 1])); // ordem da planilha
  // telas principais primeiro, para o pop-up já encontrar a tela pai gravada
  for (const t of [...novas.filter((t) => !t.paiChave), ...novas.filter((t) => t.paiChave)]) {
    const itens = JSON.stringify(t.itens.map((i) => ({ id: randomUUID(), nome: i.nome, faz: i.faz })));
    const paiId = t.paiChave ? (idTela.get(t.paiChave) ?? plano.paisExistentes[t.paiChave] ?? null) : null;
    comandos.push(
      sql`insert into telas (id, caderno_id, modulo_id, ordem, titulo, itens, pai_id)
          values (${idTela.get(t.chave)!}, ${cadernoId}, ${idModulo.get(t.moduloChave)!}, ${ordemDe.get(t.chave)!}, ${t.titulo}, ${itens}::jsonb, ${paiId}::uuid)`,
    );
  }
  // telas que já existiam só RECEBEM funcionalidades novas no fim da lista: nada é apagado nem alterado
  for (const t of plano.telas.filter((t) => t.existenteId && t.itens.length)) {
    const itens = JSON.stringify(t.itens.map((i) => ({ id: randomUUID(), nome: i.nome, faz: i.faz })));
    comandos.push(sql`update telas set itens = itens || ${itens}::jsonb where id = ${t.existenteId!} and caderno_id = ${cadernoId}`);
  }
  comandos.push(sql`update cadernos set atualizado = now() where id = ${cadernoId}`);

  try {
    await sql.transaction(comandos);
  } catch (e) {
    console.error("confirmarImportacao", e);
    return erroGeral(texto, "Não conseguimos gravar a planilha agora, e nada foi alterado. Clique em Verificar planilha e tente importar de novo. Se continuar, avise quem cuida do sistema.");
  }
  redirect(`/admin/${cadernoId}/estrutura?importado=1`);
}
