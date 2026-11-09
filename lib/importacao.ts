// Planejamento da importação por planilha. Função pura, sem banco: recebe as linhas lidas do CSV e o que já existe
// no caderno, e devolve o que seria criado e os erros por linha. A mesma função serve para "verificar" e "importar".
// Formato: cada linha é UMA funcionalidade. Colunas: Módulo; Tela; Pop-up de; Funcionalidade; O que faz.

export const LIMITE_LINHAS = 2000;
export const MAX_ERROS = 50;
const MAX_TITULO = 200;
const MAX_DESCRICAO = 2000;

export type Existente = {
  modulos: { id: string; titulo: string }[];
  telas: { id: string; moduloId: string; titulo: string; paiId: string | null; itens: string[] }[]; // itens = nomes
};

export type TelaPlano = {
  chave: string; // módulo|tela ou módulo|tela|pai (já sem maiúsculas)
  paiChave: string | null; // chave da tela pai, se for pop-up
  moduloChave: string;
  titulo: string;
  existenteId: string | null; // null = tela nova
  itens: { nome: string; faz: string }[]; // só as funcionalidades novas
};

export type Resumo = {
  modulosNovos: number;
  modulosExistentes: number;
  telasNovas: number;
  telasExistentes: number;
  popupsNovos: number;
  popupsExistentes: number;
  funcsNovas: number;
  funcsIgnoradas: number;
};

export type Plano = {
  erros: string[]; // no máximo MAX_ERROS
  totalErros: number;
  modulosNovos: { chave: string; titulo: string }[];
  telas: TelaPlano[]; // na ordem da planilha
  paisExistentes: Record<string, string>; // chave -> id das telas principais que já existem (para o pop-up achar o pai)
  resumo: Resumo;
};

// O que a tela mostra entre "Verificar" e "Importar"
export type EstadoImportacao = {
  fase: "inicio" | "previa" | "erro";
  quando: number;
  textoVerificado: string;
  mensagem: string;
  erros: string[];
  totalErros: number;
  resumo: Resumo | null;
};
export const ESTADO_INICIAL: EstadoImportacao = { fase: "inicio", quando: 0, textoVerificado: "", mensagem: "", erros: [], totalErros: 0, resumo: null };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const cabecalho = (s: string) => semAcento(s).toLowerCase().replace(/[\s\-_]+/g, " ").trim();
// comparação simples: sem diferenciar maiúsculas nem espaços sobrando
export const chaveDe = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

const VAZIO: Resumo = { modulosNovos: 0, modulosExistentes: 0, telasNovas: 0, telasExistentes: 0, popupsNovos: 0, popupsExistentes: 0, funcsNovas: 0, funcsIgnoradas: 0 };
const falha = (msg: string): Plano => ({ erros: [msg], totalErros: 1, modulosNovos: [], telas: [], paisExistentes: {}, resumo: { ...VAZIO } });
const pedaco = (s: string) => (s.length > 30 ? `${s.slice(0, 30)}…` : s);

export function planejar(linhas: string[][], ex: Existente): Plano {
  if (!linhas.length) return falha("A planilha está vazia. Cole o texto ou escolha o arquivo e tente de novo.");

  // colunas pelo nome do título (sem diferenciar acento ou maiúscula), na ordem que estiverem
  const col: Record<string, number> = {};
  linhas[0].forEach((h, i) => {
    const n = cabecalho(h);
    if (n === "modulo") col.modulo = i;
    else if (n === "tela") col.tela = i;
    else if (n === "pop up de" || n === "popup de") col.pai = i;
    else if (n === "funcionalidade") col.func = i;
    else if (n === "o que faz" || n === "descricao") col.faz = i;
  });
  if (col.modulo === undefined || col.tela === undefined || col.func === undefined) {
    return falha("A primeira linha precisa ter os títulos das colunas: Módulo, Tela, Funcionalidade (e, se quiser, Pop-up de e O que faz). Baixe o modelo para ver o formato.");
  }
  const dados = linhas.slice(1);
  if (!dados.length) return falha("A planilha só tem a linha de títulos. Acrescente as linhas com módulos, telas e funcionalidades.");
  if (dados.length > LIMITE_LINHAS) return falha(`A planilha tem ${dados.length} linhas e o limite é ${LIMITE_LINHAS}. Divida em duas planilhas e importe uma de cada vez.`);

  const erros: string[] = [];
  let totalErros = 0;
  const erro = (n: number, msg: string) => {
    totalErros++;
    if (erros.length < MAX_ERROS) erros.push(`Linha ${n}: ${msg}`);
  };
  // a exportação põe um apóstrofo antes de = + - @ (para o Excel não tratar como fórmula); ao importar, tira de volta
  const cel = (l: string[], i: number | undefined) => (i === undefined ? "" : (l[i] ?? "").trim().replace(/^'(?=[=+\-@])/, ""));

  // módulos que já existem
  const modulos = new Map<string, { titulo: string; nova: boolean }>();
  for (const m of ex.modulos) if (!modulos.has(chaveDe(m.titulo))) modulos.set(chaveDe(m.titulo), { titulo: m.titulo, nova: false });
  const moduloDeId = new Map(ex.modulos.map((m) => [m.id, chaveDe(m.titulo)]));
  const referenciados = new Set<string>();

  // telas que já existem: principal = módulo|tela, pop-up = módulo|tela|pai
  const porChave = new Map<string, TelaPlano>();
  const nomesDe = new Map<string, Set<string>>(); // chave da tela -> nomes de funcionalidades que já existem
  const principaisValidas = new Set<string>();
  const porId = new Map(ex.telas.map((t) => [t.id, t]));
  const existentes = new Map<string, { id: string; paiChave: string | null; moduloChave: string; titulo: string; nomes: Set<string> }>();
  for (const t of ex.telas) {
    const mk = moduloDeId.get(t.moduloId);
    if (!mk) continue;
    const pai = t.paiId ? porId.get(t.paiId) : null;
    if (t.paiId && !pai) continue;
    const chave = pai ? `${mk}|${chaveDe(t.titulo)}|${chaveDe(pai.titulo)}` : `${mk}|${chaveDe(t.titulo)}`;
    if (existentes.has(chave)) continue;
    existentes.set(chave, { id: t.id, paiChave: pai ? `${mk}|${chaveDe(pai.titulo)}` : null, moduloChave: mk, titulo: t.titulo, nomes: new Set(t.itens.map(chaveDe)) });
    if (!pai) principaisValidas.add(chave);
  }

  // 1ª passada: lê e valida cada linha; registra as telas principais da planilha (um pop-up pode vir antes da tela pai)
  type Linha = { n: number; modulo: string; tela: string; pai: string; func: string; faz: string };
  const validas: Linha[] = [];
  dados.forEach((l, i) => {
    if (l.every((c) => !String(c ?? "").trim())) return;
    const n = i + 2; // linha 1 é o título das colunas
    const r: Linha = { n, modulo: cel(l, col.modulo), tela: cel(l, col.tela), pai: cel(l, col.pai), func: cel(l, col.func), faz: cel(l, col.faz) };
    if (!r.modulo) return erro(n, "falta o nome do módulo. Preencha a coluna Módulo.");
    for (const [rotulo, v] of [["módulo", r.modulo], ["tela", r.tela], ["pop-up de", r.pai], ["funcionalidade", r.func]] as const) {
      if (v.length > MAX_TITULO) return erro(n, `o nome em “${rotulo}” (“${pedaco(v)}”) passou de ${MAX_TITULO} letras. Encurte o texto.`);
    }
    if (r.faz.length > MAX_DESCRICAO) return erro(n, `a descrição passou de ${MAX_DESCRICAO} letras. Encurte o texto.`);
    if (!r.tela && (r.pai || r.func || r.faz)) return erro(n, "falta o nome da tela. Preencha a coluna Tela.");
    if (r.faz && !r.func) return erro(n, "tem descrição mas falta o nome da funcionalidade. Preencha a coluna Funcionalidade.");
    validas.push(r);
    if (r.tela && !r.pai) principaisValidas.add(`${chaveDe(r.modulo)}|${chaveDe(r.tela)}`);
  });

  // 2ª passada: monta o plano na ordem da planilha
  const modulosNovos: { chave: string; titulo: string }[] = [];
  const telas: TelaPlano[] = [];
  let funcsNovas = 0;
  let funcsIgnoradas = 0;
  for (const r of validas) {
    const mk = chaveDe(r.modulo);
    referenciados.add(mk);
    if (!modulos.has(mk)) {
      modulos.set(mk, { titulo: r.modulo, nova: true });
      modulosNovos.push({ chave: mk, titulo: r.modulo });
    }
    if (!r.tela) continue; // linha só com o módulo

    const paiChave = r.pai ? `${mk}|${chaveDe(r.pai)}` : null;
    if (paiChave && !principaisValidas.has(paiChave)) {
      erro(r.n, `o pop-up “${pedaco(r.tela)}” aponta para a tela “${pedaco(r.pai)}”, que não existe no módulo “${pedaco(r.modulo)}”. Cadastre a tela antes ou corrija o nome em “Pop-up de”.`);
      continue;
    }
    const chave = paiChave ? `${mk}|${chaveDe(r.tela)}|${chaveDe(r.pai)}` : `${mk}|${chaveDe(r.tela)}`;
    let t = porChave.get(chave);
    if (!t) {
      const e = existentes.get(chave);
      t = { chave, paiChave, moduloChave: mk, titulo: r.tela, existenteId: e?.id ?? null, itens: [] };
      porChave.set(chave, t);
      nomesDe.set(chave, new Set(e?.nomes ?? []));
      telas.push(t);
    }
    if (!r.func) continue; // linha só com módulo e tela
    const vistos = nomesDe.get(chave)!;
    if (vistos.has(chaveDe(r.func))) {
      funcsIgnoradas++;
    } else {
      vistos.add(chaveDe(r.func));
      t.itens.push({ nome: r.func, faz: r.faz });
      funcsNovas++;
    }
  }

  const resumo: Resumo = { ...VAZIO, modulosNovos: modulosNovos.length, modulosExistentes: [...referenciados].filter((k) => !modulosNovos.some((m) => m.chave === k)).length, funcsNovas, funcsIgnoradas };
  for (const t of telas) {
    const campo = t.paiChave ? (t.existenteId ? "popupsExistentes" : "popupsNovos") : t.existenteId ? "telasExistentes" : "telasNovas";
    resumo[campo]++;
  }
  const paisExistentes: Record<string, string> = {};
  for (const [chave, e] of existentes) if (!e.paiChave) paisExistentes[chave] = e.id;
  return { erros, totalErros, modulosNovos, telas, paisExistentes, resumo };
}

// Nada para gravar: tudo o que a planilha traz já existe
export const semNovidade = (r: Resumo) => r.modulosNovos + r.telasNovas + r.popupsNovos + r.funcsNovas === 0;
