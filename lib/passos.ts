// Regras do roteiro de teste, sem banco e sem React: servidor e tela usam o mesmo cálculo.
import type { Item, Passo, RespPasso, Resultado, ResultadoPasso } from "@/lib/tipos";

export const ROTULO_PASSO: Record<ResultadoPasso, string> = {
  funcionou: "Funcionou",
  diferente: "Deu diferente",
  nao_consegui: "Não consegui testar",
};
export const RESULTADOS_PASSO = Object.keys(ROTULO_PASSO) as ResultadoPasso[];
export const MAX_TEXTO_PASSO = 2000;

export const temRoteiro = (i: Item): i is Item & { passos: Passo[] } => Array.isArray(i.passos) && i.passos.length > 0;

// "Deu diferente" e "Não consegui testar" só contam como respondidos quando a pessoa explicou (descrição ou motivo)
export const passoCompleto = (r?: RespPasso) => !!r && (r.resultado === "funcionou" || r.obs.trim().length > 0);

// Estado de um passo na tela: sem resposta, respondido, com problema, bloqueado, ou faltando a explicação
export type EstadoPasso = "sem_resposta" | "funcionou" | "diferente" | "bloqueado" | "falta_texto";
export function estadoPasso(r?: RespPasso): EstadoPasso {
  if (!r) return "sem_resposta";
  if (!passoCompleto(r)) return "falta_texto";
  return r.resultado === "funcionou" ? "funcionou" : r.resultado === "diferente" ? "diferente" : "bloqueado";
}

// Resultado da funcionalidade a partir dos passos: qualquer "Deu diferente" = NÃO OK; todos "Funcionou" = OK; o resto = NÃO TESTADO.
// É isso que alimenta o status das telas, o termo de aceite, a planilha e os alertas.
export function resultadoDoItem(passos: Passo[], resp: (passoId: string) => RespPasso | undefined): Resultado {
  let funcionou = 0;
  for (const p of passos) {
    const r = resp(p.id);
    if (r?.resultado === "diferente") return "nao_ok";
    if (r?.resultado === "funcionou") funcionou++;
  }
  return passos.length > 0 && funcionou === passos.length ? "ok" : "nao_testado";
}

// Texto que fica na observação da funcionalidade (o que a equipe vê nos alertas e na planilha): só o que não funcionou
export function observacaoDoItem(passos: Passo[], resp: (passoId: string) => RespPasso | undefined): string {
  const linhas: string[] = [];
  passos.forEach((p, n) => {
    const r = resp(p.id);
    if (r && r.resultado !== "funcionou") linhas.push(`Passo ${n + 1} (${ROTULO_PASSO[r.resultado]}): ${r.obs.trim() || "sem explicação"}`);
  });
  return linhas.join("\n");
}

// Junta os prints dos passos, sem repetir e no máximo 10 (o mesmo limite da funcionalidade)
export function anexosDoItem(passos: Passo[], resp: (passoId: string) => RespPasso | undefined): string[] {
  const todos = passos.flatMap((p) => resp(p.id)?.anexos ?? []);
  return [...new Set(todos)].slice(0, 10);
}

// Lê o roteiro que veio do formulário (texto JSON). Cada passo precisa dos dois campos: devolve null se algum estiver vazio.
export function lerPassos(json: string, novoId: () => string, ehId: (v: string) => boolean): Passo[] | null {
  if (!json.trim()) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(bruto) || bruto.length > 50) return null;
  const passos: Passo[] = [];
  for (const p of bruto) {
    const o = (p ?? {}) as Record<string, unknown>;
    const fazer = typeof o.fazer === "string" ? o.fazer.trim() : "";
    const esperado = typeof o.esperado === "string" ? o.esperado.trim() : "";
    if (!fazer || !esperado || fazer.length > MAX_TEXTO_PASSO || esperado.length > MAX_TEXTO_PASSO) return null;
    passos.push({ id: typeof o.id === "string" && ehId(o.id) ? o.id : novoId(), fazer, esperado });
  }
  return passos;
}
