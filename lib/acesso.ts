// Como o validador chega até uma tela, e o que ainda falta preparar nela. Sem banco e sem React:
// o editor, a prévia e a execução do validador usam as mesmas regras.


export type Modo = "funcional" | "desenho";

// Sem modo gravado vale o que sempre valeu: com link é teste funcional, sem link é revisão de desenho
export const modoDaTela = (t: { modo?: Modo | null; link?: string | null }): Modo => t.modo ?? (t.link ? "funcional" : "desenho");

export type Acesso =
  | { tipo: "link"; url: string; texto: string } // abre direto a tela
  | { tipo: "menu"; url: string | null; caminho: string; texto: string } // abre o ambiente e segue o caminho no menu
  | { tipo: "desenho"; texto: string } // só a imagem
  | { tipo: "pop-up"; texto: string } // a janela abre dentro de outra tela: o roteiro diz como
  | { tipo: "incompleto"; texto: string }; // teste funcional sem como abrir a tela

// A ordem é a da execução real: link direto, depois ambiente + caminho no menu
export function acessoDaTela(t: { modo?: Modo | null; link?: string | null; caminho?: string | null }, ambienteUrl: string | null, paiTitulo?: string | null): Acesso {
  if (paiTitulo) return { tipo: "pop-up", texto: `Abre dentro da tela “${paiTitulo}”. Quem testa chega à janela seguindo o roteiro.` };
  if (modoDaTela(t) === "desenho") return { tipo: "desenho", texto: "Revisão de desenho: o validador confere pela imagem, não há tela para abrir." };
  if (t.link) return { tipo: "link", url: t.link, texto: "O validador abre a tela direto pelo link." };
  const caminho = (t.caminho ?? "").trim();
  if (caminho) return { tipo: "menu", url: ambienteUrl, caminho, texto: ambienteUrl ? "O validador abre o ambiente e segue o caminho no menu." : "O validador segue o caminho no menu (o caderno ainda não tem o endereço do ambiente)." };
  return { tipo: "incompleto", texto: "Falta explicar como abrir a tela." };
}

// O que falta preparar. "bloqueia" = o servidor não salva sem isso. O resto é sugestão: a tela fica "em preparação".
export type Pendencia = { texto: string; bloqueia: boolean; aba: "dados" | "funcionalidades"; campo?: string };

export function pendenciasDaTela(t: { titulo: string; modo?: Modo | null; link?: string | null; caminho?: string | null; itens: { nome: string; passos?: unknown[] }[] }, ambienteUrl: string | null, ehPopup: boolean): Pendencia[] {
  const p: Pendencia[] = [];
  if (!t.titulo.trim()) p.push({ texto: "Escreva o nome da tela.", bloqueia: true, aba: "dados", campo: "campo-titulo" });
  if (!ehPopup && modoDaTela(t) === "funcional" && !t.link && !(t.caminho ?? "").trim()) p.push({ texto: "Falta explicar como abrir a tela: informe o link direto ou o caminho no menu.", bloqueia: false, aba: "dados", campo: "campo-link_url" });
  if (!ehPopup && modoDaTela(t) === "funcional" && !t.link && (t.caminho ?? "").trim() && !ambienteUrl) p.push({ texto: "O caderno ainda não tem o endereço do ambiente de homologação. Cadastre em Editar caderno.", bloqueia: false, aba: "dados" });
  const itens = t.itens.filter((i) => i.nome.trim());
  if (!itens.length) p.push({ texto: "Nenhuma funcionalidade cadastrada: a tela fica em preparação.", bloqueia: false, aba: "funcionalidades" });
  for (const i of itens) if (!i.passos?.length) p.push({ texto: `Sem roteiro: ${i.nome.trim()}`, bloqueia: false, aba: "funcionalidades" });
  return p;
}
