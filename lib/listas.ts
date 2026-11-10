// Listas de nomes (módulos) e de instruções ("Antes de começar"), sem banco e sem React: servidor e tela usam a mesma regra.

export const MODULOS_SUGERIDOS = ["Menu inicial", "Financeiro", "RH", "Compras", "Estoque"];

// Dois nomes são o mesmo se só mudam maiúsculas, acentos ou espaços repetidos
export const chaveNome = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Separa o que é novo do que já existe (na própria lista ou entre os já salvos). Mantém a ordem e devolve o que foi ignorado.
export function semDuplicados(nomes: string[], existentes: string[] = []): { novos: string[]; ignorados: string[] } {
  const vistos = new Set(existentes.map(chaveNome));
  const novos: string[] = [];
  const ignorados: string[] = [];
  for (const bruto of nomes) {
    const n = bruto.replace(/\s+/g, " ").trim();
    if (!n) continue;
    const k = chaveNome(n);
    if (vistos.has(k)) ignorados.push(n);
    else {
      vistos.add(k);
      novos.push(n);
    }
  }
  return { novos, ignorados };
}

// "Antes de começar" fica guardado como texto, uma instrução por linha (o formato que sempre existiu). O cliente já vê nesta ordem.
export const separarInstrucoes = (texto: string) => texto.split("\n").map((s) => s.trim()).filter(Boolean);
export const juntarInstrucoes = (lista: string[]) => lista.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
