"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, ExternalLink, Eye, FileText, ListChecks, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { Abas, PainelAba } from "@/components/Abas";
import Aviso from "@/components/Aviso";
import CabecalhoPagina from "@/components/CabecalhoPagina";
import Campo from "@/components/Campo";
import CampoArquivo from "@/components/CampoArquivo";
import EditorPassos, { novoPassoEditavel, type ErrosPasso, type PassoEditavel } from "@/components/EditorPassos";
import EstadoVazio from "@/components/EstadoVazio";
import Etiqueta from "@/components/Etiqueta";
import PreviaTela from "@/components/PreviaTela";
import Secao from "@/components/Secao";
import { botao, campo, FOCO } from "@/components/estilos";
import { acessoDaTela, pendenciasDaTela, type Modo } from "@/lib/acesso";
import type { EstadoTela } from "@/app/admin/actions";

type ItemInicial = { id?: string; nome: string; faz: string; imagem?: string; passos?: { id?: string; fazer: string; esperado: string }[] };
export type DadosTela = { titulo: string; moduloId: string; paiId: string | null; modo: Modo; link: string; caminho: string; imagem: string; pdf: string; itens: ItemInicial[] };
type ItemL = { k: number; id?: string; nome: string; faz: string; imagem: string; passos: PassoEditavel[]; aberto: boolean };
type Aba = "dados" | "funcionalidades" | "previa";
type Problema = { aba: Aba; campo: string; mensagem: string };

let proxK = 1;
const novoItem = (i?: ItemInicial): ItemL => ({ k: proxK++, id: i?.id, nome: i?.nome ?? "", faz: i?.faz ?? "", imagem: i?.imagem ?? "", aberto: !i, passos: (i?.passos ?? []).map((p) => novoPassoEditavel(p)) });

type Valores = { titulo: string; moduloId: string; ehPopup: boolean; paiId: string; modo: Modo; link: string; caminho: string; imagem: string; pdfProprio: boolean; pdf: string; itens: ItemL[] };
// Só o que muda o que vai para o banco: serve para saber se há alteração não salva (abrir e fechar passos não conta)
const serializar = (v: Valores) => JSON.stringify({ ...v, itens: v.itens.map((i) => ({ id: i.id, nome: i.nome, faz: i.faz, imagem: i.imagem, passos: i.passos.map((p) => ({ id: p.id, fazer: p.fazer, esperado: p.esperado })) })) });

const MENSAGEM_SERVIDOR: Record<string, { texto: string; aba?: Aba; campo?: string }> = {
  titulo: { texto: "Escreva o nome da tela.", aba: "dados", campo: "campo-titulo" },
  pai: { texto: "Não foi possível ligar este pop-up à tela escolhida. Escolha outra tela principal.", aba: "dados", campo: "campo-pai_id" },
  modulo: { texto: "Escolha o módulo da tela. Se ainda não existe nenhum, crie os módulos em Estrutura.", aba: "dados", campo: "campo-modulo_id" },
  passo: { texto: "Algum passo do roteiro está incompleto. Cada passo precisa de “O que fazer” e “O que deve acontecer”.", aba: "funcionalidades" },
  url: { texto: "Um dos endereços não é aceito. O link da tela deve começar com https:// e as imagens e PDFs devem ser enviados pelo botão “Selecionar”.", aba: "dados", campo: "campo-link_url" },
  travado: { texto: "A homologação está concluída, então nada foi alterado. Reabra a homologação (na Visão geral) antes de mudar a estrutura." },
  banco: { texto: "O banco de dados deste ambiente ainda não recebeu a atualização que guarda o caminho no menu. Peça a quem cuida do sistema para rodar npm run db:setup. O que você digitou continua aqui." },
  falha: { texto: "Não foi possível salvar agora. O que você digitou continua aqui: confira a conexão e tente de novo." },
};

function OpcaoRadio({ nome, valor, atual, aoMudar, titulo, texto, desabilitada }: { nome: string; valor: string; atual: string; aoMudar: (v: string) => void; titulo: string; texto: string; desabilitada?: boolean }) {
  const on = atual === valor;
  return (
    <label className={`flex gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${desabilitada ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-600" : on ? "cursor-pointer border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "cursor-pointer border-slate-300 bg-white hover:bg-slate-50"}`}>
      <input type="radio" name={nome} value={valor} checked={on} disabled={desabilitada} onChange={() => aoMudar(valor)} className="mt-1 size-4 shrink-0 accent-brand-600" />
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-slate-700">{texto}</span>
      </span>
    </label>
  );
}

// O mesmo controle de salvamento no cabeçalho e na barra de baixo: "Salvando…", "Salvo", "Não foi possível salvar"
function Salvar({ sujo, salvo, falhou, dica }: { sujo: boolean; salvo: boolean; falhou: boolean; dica?: string }) {
  const { pending } = useFormStatus();
  const estado = pending ? "Salvando…" : falhou ? <span className="font-medium text-rose-800">Não foi possível salvar</span> : sujo ? <span className="font-medium text-amber-900">Alterações não salvas</span> : salvo ? <span className="inline-flex items-center gap-1 font-medium text-emerald-900"><CheckCircle2 aria-hidden="true" className="size-4" />Salvo</span> : null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="status" className={estado ? "text-sm text-slate-800" : "sr-only"}>{estado}</p>
      <button type="submit" disabled={pending} aria-busy={pending} title={dica} className={botao("primario")}>
        {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
        {pending ? "Salvando…" : falhou ? "Tentar novamente" : "Salvar alterações"}
      </button>
    </div>
  );
}

export default function EditorTela({ cadernoId, telaId, inicial, modulos, principais, temFilhos, ambienteUrl, cenarios, acao, voltaQs, salvo, criada, abaInicial }: {
  cadernoId: string;
  telaId: string | null;
  inicial: DadosTela;
  modulos: { id: string; titulo: string }[];
  principais: { id: string; titulo: string; moduloId: string }[]; // telas principais que podem receber um pop-up
  temFilhos: boolean;
  ambienteUrl: string | null;
  cenarios: { id: string; titulo: string; arquivado: boolean }[];
  acao: (anterior: EstadoTela, f: FormData) => Promise<EstadoTela>;
  voltaQs: string;
  salvo: boolean;
  criada: boolean;
  abaInicial: Aba;
}) {
  const [estado, formAction] = useActionState(acao, null);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [moduloId, setModuloId] = useState(inicial.moduloId || modulos[0]?.id || "");
  const [ehPopup, setEhPopup] = useState(!!inicial.paiId);
  const [paiId, setPaiId] = useState(inicial.paiId ?? principais[0]?.id ?? "");
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const [link, setLink] = useState(inicial.link);
  const [caminho, setCaminho] = useState(inicial.caminho);
  const [imagem, setImagem] = useState(inicial.imagem);
  const [pdfProprio, setPdfProprio] = useState(!!inicial.pdf);
  const [pdf, setPdf] = useState(inicial.pdf);
  const [itens, setItens] = useState<ItemL[]>(() => inicial.itens.map((i) => novoItem(i)));
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [focar, setFocar] = useState<string | null>(null);

  const podeSerPopup = !temFilhos && principais.length > 0;
  const valores: Valores = { titulo, moduloId, ehPopup, paiId, modo, link, caminho, imagem, pdfProprio, pdf, itens };
  const [base] = useState(() => serializar({ titulo: inicial.titulo, moduloId: inicial.moduloId || modulos[0]?.id || "", ehPopup: !!inicial.paiId, paiId: inicial.paiId ?? principais[0]?.id ?? "", modo: inicial.modo, link: inicial.link, caminho: inicial.caminho, imagem: inicial.imagem, pdfProprio: !!inicial.pdf, pdf: inicial.pdf, itens: inicial.itens.map((i) => novoItem(i)) }));
  const sujo = serializar(valores) !== base;

  const pai = principais.find((p) => p.id === paiId);
  const moduloAtual = ehPopup ? modulos.find((m) => m.id === pai?.moduloId) : modulos.find((m) => m.id === moduloId);
  const modoEfetivo: Modo = ehPopup ? "funcional" : modo;
  const acesso = acessoDaTela({ modo: modoEfetivo, link, caminho }, ambienteUrl, ehPopup ? pai?.titulo ?? "outra tela" : null);
  const preparo = pendenciasDaTela({ titulo, modo: modoEfetivo, link, caminho, itens: itens.map((i) => ({ nome: i.nome, passos: i.passos })) }, ambienteUrl, ehPopup);
  const semRoteiro = itens.filter((i) => i.nome.trim() && !i.passos.length).length;

  // erros do servidor (o formulário continua preenchido): leva à aba e ao campo
  const erroServidor = estado?.erro ? MENSAGEM_SERVIDOR[estado.erro] ?? MENSAGEM_SERVIDOR.falha : null;
  useEffect(() => {
    if (!erroServidor) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (erroServidor.aba) setAba(erroServidor.aba);
    if (erroServidor.campo) setFocar(erroServidor.campo);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focar) return;
    const id = window.setTimeout(() => {
      document.getElementById(focar)?.focus();
      setFocar(null);
    }, 50);
    return () => window.clearTimeout(id);
  }, [focar]);

  // depois de salvar a página recarrega os dados do servidor: devolve aberto o que estava aberto (funcionalidades e passos)
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(`editor-aberto-${telaId}`);
      if (!guardado) return;
      sessionStorage.removeItem(`editor-aberto-${telaId}`);
      const a = JSON.parse(guardado) as { itens: number[]; passos: Record<number, number[]> };
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setItens((l) => l.map((i, n) => ({ ...i, aberto: a.itens.includes(n) || i.aberto, passos: i.passos.map((p, m) => ({ ...p, aberto: a.passos[n]?.includes(m) || p.aberto })) })));
    } catch {}
  }, [telaId]);

  // alteração não salva: avisa antes de fechar a página ou de sair por um link
  useEffect(() => {
    if (!sujo) return;
    const aoFechar = (e: BeforeUnloadEvent) => e.preventDefault();
    const aoClicar = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Há alterações não salvas nesta tela. Sair e descartá-las?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", aoFechar);
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", aoFechar);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [sujo]);

  const mudarItem = (k: number, patch: Partial<ItemL>) => setItens((l) => l.map((i) => (i.k === k ? { ...i, ...patch } : i)));

  // confere antes de enviar: leva à aba, abre a funcionalidade e o passo e põe o foco no campo que precisa de atenção
  function validar(): Problema[] {
    const p: Problema[] = [];
    if (!titulo.trim()) p.push({ aba: "dados", campo: "campo-titulo", mensagem: "Escreva o nome da tela." });
    if (!ehPopup && !moduloId) p.push({ aba: "dados", campo: "campo-modulo_id", mensagem: "Escolha o módulo da tela." });
    if (ehPopup && !paiId) p.push({ aba: "dados", campo: "campo-pai_id", mensagem: "Escolha a tela em que o pop-up abre." });
    if (!ehPopup && modo === "funcional" && link.trim() && !/^https?:\/\//i.test(link.trim())) p.push({ aba: "dados", campo: "campo-link_url", mensagem: "O link da tela deve começar com https://" });
    for (const [n, i] of itens.entries()) {
      const conteudo = i.faz.trim() || i.passos.length || i.imagem;
      if (!i.nome.trim() && conteudo) p.push({ aba: "funcionalidades", campo: `nome-${i.k}`, mensagem: `Dê um nome à funcionalidade ${n + 1}: sem nome ela não é salva.` });
      if (i.nome.trim()) {
        for (const [m, s] of i.passos.entries()) {
          if (!s.fazer.trim()) p.push({ aba: "funcionalidades", campo: `passo-${s.k}-fazer`, mensagem: `Funcionalidade “${i.nome.trim()}”, passo ${m + 1}: escreva o que fazer.` });
          else if (!s.esperado.trim()) p.push({ aba: "funcionalidades", campo: `passo-${s.k}-esperado`, mensagem: `Funcionalidade “${i.nome.trim()}”, passo ${m + 1}: escreva o que deve acontecer.` });
        }
      }
    }
    return p;
  }
  const textoDe = (campo_: string) => problemas.find((p) => p.campo === campo_)?.mensagem ?? null;
  const errosPasso = (item: ItemL): ErrosPasso => {
    const e: ErrosPasso = {};
    for (const s of item.passos) {
      const f = textoDe(`passo-${s.k}-fazer`);
      const x = textoDe(`passo-${s.k}-esperado`);
      if (f || x) e[s.k] = { fazer: f ? "Escreva o que fazer." : undefined, esperado: x ? "Escreva o que deve acontecer." : undefined };
    }
    return e;
  };

  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    const p = validar();
    setProblemas(p);
    if (!p.length) {
      try {
        sessionStorage.setItem(`editor-aberto-${telaId}`, JSON.stringify({ itens: itens.flatMap((i, n) => (i.aberto ? [n] : [])), passos: Object.fromEntries(itens.map((i, n) => [n, i.passos.flatMap((x, m) => (x.aberto ? [m] : []))])) }));
      } catch {}
      return;
    }
    e.preventDefault();
    const primeiro = p[0];
    setAba(primeiro.aba);
    setItens((l) => l.map((i) => (p.some((x) => x.campo === `nome-${i.k}` || i.passos.some((s) => x.campo.startsWith(`passo-${s.k}-`))) ? { ...i, aberto: true } : i)));
    setFocar(primeiro.campo);
  }

  // a aba ativa vai para o endereço (sem recarregar): dá para recarregar ou compartilhar o link na mesma parte do editor
  function mudarAba(a: Aba) {
    setAba(a);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("aba", a);
      window.history.replaceState(window.history.state, "", u);
    } catch {}
  }
  const irPara = (a: Aba, campoId?: string) => {
    setAba(a);
    if (campoId) setFocar(campoId);
  };
  const salvarAqui = (
    <button type="submit" className={botao("primario")}>
      <FileText aria-hidden="true" />
      Salvar e visualizar
    </button>
  );

  const estruturaHref = `/admin/${cadernoId}/estrutura${voltaQs ? `?${voltaQs}` : ""}`;
  const urlValida = /^https?:\/\/\S+$/i.test(link.trim());
  const falhou = !!erroServidor && !sujo;

  const abas = [
    { id: "dados", rotulo: "Dados da tela", icone: <Settings2 aria-hidden="true" />, aviso: preparo.some((p) => p.aba === "dados") ? "Falta preparar" : undefined },
    { id: "funcionalidades", rotulo: "Funcionalidades e testes", icone: <ListChecks aria-hidden="true" />, aviso: semRoteiro ? `${semRoteiro} sem roteiro` : undefined },
    { id: "previa", rotulo: "Prévia", icone: <Eye aria-hidden="true" /> },
  ];

  return (
    <form action={formAction} onSubmit={aoEnviar} noValidate className="mx-auto max-w-6xl">
      <input type="hidden" name="aba" value={aba} />
      <CabecalhoPagina
        migalhas={[
          { rotulo: "Estrutura", href: estruturaHref },
          ...(moduloAtual ? [{ rotulo: moduloAtual.titulo, href: `/admin/${cadernoId}/estrutura?modulo=${moduloAtual.id}` }] : []),
          { rotulo: titulo.trim() || "Nova tela" },
        ]}
        titulo={titulo.trim() || "Nova tela"}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <Etiqueta>{ehPopup ? `Pop-up de “${pai?.titulo ?? "…"}”` : "Tela principal"}</Etiqueta>
            {!ehPopup && <Etiqueta>{modo === "funcional" ? "Teste funcional" : "Revisão de desenho"}</Etiqueta>}
            {preparo.length > 0 ? <Etiqueta tom="alerta" icone={AlertTriangle}>Falta preparar: {preparo.length}</Etiqueta> : <Etiqueta tom="sucesso" icone={CheckCircle2}>Pronta para o validador</Etiqueta>}
          </span>
        }
        acoes={
          <>
            <button type="button" onClick={() => setAba("previa")} className={botao("secundario")}>
              <Eye aria-hidden="true" />
              Prévia como validador
            </button>
            <Salvar sujo={sujo} salvo={salvo && !sujo} falhou={falhou} />
          </>
        }
      />

      {criada && !erroServidor && <Aviso tom="sucesso" className="mb-4">Tela criada. Continue preparando os testes dela.</Aviso>}
      {erroServidor && (
        <Aviso tom="erro" className="mb-4" titulo="Não foi possível salvar" acoes={erroServidor.campo || erroServidor.aba ? <button type="button" onClick={() => irPara(erroServidor.aba ?? aba, erroServidor.campo)} className={botao("secundario")}>Ir para o campo</button> : undefined}>
          {erroServidor.texto}
        </Aviso>
      )}
      {problemas.length > 0 && (
        <Aviso tom="erro" className="mb-4" titulo={problemas.length === 1 ? "Falta um item para salvar" : `Faltam ${problemas.length} itens para salvar`} acoes={<button type="button" onClick={() => irPara(problemas[0].aba, problemas[0].campo)} className={botao("secundario")}>Ir para o primeiro</button>}>
          <ul className="list-disc pl-5">{problemas.slice(0, 4).map((p) => <li key={p.campo}>{p.mensagem}</li>)}{problemas.length > 4 && <li>e mais {problemas.length - 4}</li>}</ul>
        </Aviso>
      )}

      <Abas abas={abas} ativa={aba} aoMudar={(a) => mudarAba(a as Aba)} rotulo="Partes do editor da tela" />

      <div className="mt-5">
        <PainelAba id="dados" ativa={aba}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="space-y-6">
              <Secao id="t-ident" titulo="Identificação">
                <div className="space-y-4">
                  <Campo rotulo="Nome da tela" nome="titulo" obrigatorio value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pedidos" erro={textoDe("campo-titulo")} />

                  <fieldset>
                    <legend className="text-sm font-medium">Tipo de tela</legend>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      <OpcaoRadio nome="tipo_tela" valor="principal" atual={ehPopup ? "popup" : "principal"} aoMudar={() => setEhPopup(false)} titulo="Tela principal" texto="Uma tela do módulo, com seu próprio acesso." />
                      <OpcaoRadio nome="tipo_tela" valor="popup" atual={ehPopup ? "popup" : "principal"} aoMudar={() => setEhPopup(true)} desabilitada={!podeSerPopup} titulo="Pop-up ou janela" texto="Abre dentro de outra tela e aparece junto dela." />
                    </div>
                    {!podeSerPopup && <p className="mt-1 text-xs text-slate-700">{temFilhos ? "Esta tela já tem pop-ups, por isso não pode ser pop-up de outra." : "Crie primeiro uma tela principal para poder ligar um pop-up a ela."}</p>}
                  </fieldset>

                  {ehPopup ? (
                    <div>
                      <label htmlFor="campo-pai_id" className="block text-sm font-medium">Abre dentro de qual tela?</label>
                      <p className="text-xs text-slate-700">O pop-up fica no mesmo módulo da tela escolhida.</p>
                      <select id="campo-pai_id" name="pai_id" value={paiId} onChange={(e) => setPaiId(e.target.value)} className={`${campo} min-h-11 sm:min-h-10`}>
                        {principais.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="campo-modulo_id" className="block text-sm font-medium">Módulo <span className="font-normal text-slate-600">(obrigatório)</span></label>
                      <select id="campo-modulo_id" name="modulo_id" value={moduloId} onChange={(e) => setModuloId(e.target.value)} aria-invalid={textoDe("campo-modulo_id") ? true : undefined} className={`${campo} min-h-11 sm:min-h-10`}>
                        {modulos.length === 0 && <option value="">Nenhum módulo criado ainda</option>}
                        {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                      </select>
                      {textoDe("campo-modulo_id") && <p role="alert" className="mt-1 text-sm text-rose-800">{textoDe("campo-modulo_id")}</p>}
                    </div>
                  )}

                  {!ehPopup && (
                    <fieldset>
                      <legend className="text-sm font-medium">Tipo de teste</legend>
                      <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        <OpcaoRadio nome="modo" valor="funcional" atual={modo} aoMudar={(v) => setModo(v as Modo)} titulo="Teste funcional" texto="O validador abre a tela, pelo link ou pelo menu, e executa o roteiro de verdade." />
                        <OpcaoRadio nome="modo" valor="desenho" atual={modo} aoMudar={(v) => setModo(v as Modo)} titulo="Revisão de desenho" texto="O validador confere a imagem de referência. Não há tela para abrir." />
                      </div>
                    </fieldset>
                  )}
                </div>
              </Secao>

              <Secao id="t-acesso" titulo="Acesso para teste" descricao={ehPopup ? undefined : modo === "funcional" ? "Como o validador chega até esta tela. Informe o link direto, o caminho no menu, ou os dois." : undefined}>
                {ehPopup ? (
                  <p className="text-sm text-slate-800">Este pop-up abre dentro de <strong>{pai?.titulo ?? "outra tela"}</strong>. O validador chega até ele pelo roteiro: descreva no primeiro passo como abrir a janela, por exemplo “Clique em Novo pedido”.</p>
                ) : modo === "desenho" ? (
                  <p className="text-sm text-slate-800">Revisão de desenho não precisa de acesso: o validador confere a imagem de referência. Se a tela já existir em código, escolha “Teste funcional” acima.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Ambiente de homologação</p>
                      {ambienteUrl ? (
                        <p className="mt-0.5 break-all text-sm">
                          <a href={ambienteUrl} target="_blank" rel="noreferrer" className="text-brand-800 underline">{ambienteUrl}<span className="sr-only"> (abre em nova aba)</span></a>
                          <span className="block text-xs text-slate-700">Herdado do caderno. <Link href={`/admin/${cadernoId}/editar`} className="text-brand-800 underline">Alterar em Editar caderno</Link></span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-slate-800">Não cadastrado. <Link href={`/admin/${cadernoId}/editar`} className="text-brand-800 underline">Cadastrar em Editar caderno</Link></p>
                      )}
                    </div>
                    <div>
                      <Campo rotulo="Link direto da tela" nome="link_url" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" ajuda="Se informado, o validador abre a tela direto por este endereço." erro={textoDe("campo-link_url")} />
                      {urlValida && (
                        <a href={link.trim()} target="_blank" rel="noreferrer" className={botao("secundario", "mt-2 w-fit")}>
                          <ExternalLink aria-hidden="true" />
                          Abrir para conferir<span className="sr-only"> (abre em nova aba)</span>
                        </a>
                      )}
                    </div>
                    <Campo rotulo="Caminho no menu" nome="caminho_menu" value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="Compras → Pedidos → Novo pedido" ajuda="Use o caminho que o validador segue no sistema, com setas entre os níveis." maxLength={200} />
                  </div>
                )}
                <p className={`mt-4 rounded-md border px-3 py-2 text-sm ${acesso.tipo === "incompleto" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-900"}`}>
                  <span className="font-medium">O que o validador verá: </span>
                  {acesso.tipo === "menu" ? <>{acesso.texto} Caminho: <strong>{acesso.caminho}</strong>.</> : acesso.texto}
                  {acesso.tipo === "menu" && acesso.url && <> <a href={acesso.url} target="_blank" rel="noreferrer" className="text-brand-800 underline">Abrir o ambiente<span className="sr-only"> (abre em nova aba)</span></a></>}
                </p>
              </Secao>
            </div>

            <div className="space-y-6">
              <Secao id="t-img" titulo="Imagem de referência">
                <CampoArquivo nome="imagem_url" rotulo={ehPopup ? "Imagem do pop-up" : "Imagem da tela"} ajuda="O validador vê esta imagem ao lado dos passos. Ela aparece inteira, sem cortes." limiteMb={10} valor={imagem} aoMudar={setImagem} descricaoAlt={`a imagem de referência de ${titulo.trim() || "esta tela"}`} />
              </Secao>

              <Secao id="t-falta" titulo="O que falta preparar">
                {preparo.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-slate-800"><CheckCircle2 aria-hidden="true" className="size-4 text-emerald-700" />Nada pendente.</p>
                ) : (
                  <ul className="space-y-2">
                    {preparo.map((p) => (
                      <li key={p.texto} className="flex flex-wrap items-start gap-2 text-sm">
                        <Etiqueta tom={p.bloqueia ? "erro" : "alerta"}>{p.bloqueia ? "Obrigatório" : "Sugestão"}</Etiqueta>
                        <span className="min-w-0 flex-1">{p.texto}</span>
                        <button type="button" onClick={() => irPara(p.aba, p.campo)} className={`rounded text-xs text-brand-800 underline ${FOCO}`}>Ir para o campo</button>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </div>
          </div>
        </PainelAba>

        <PainelAba id="funcionalidades" ativa={aba}>
          <div className="space-y-6">
            <section aria-labelledby="t-func" className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="t-func" className="font-semibold">Funcionalidades e testes</h2>
                  <p className="mt-0.5 max-w-2xl text-sm text-slate-700">Cada funcionalidade tem uma descrição de referência e um roteiro: os passos que o validador executa, um a um.</p>
                </div>
                <button type="button" onClick={() => setItens((l) => [...l, novoItem()])} className={botao("secundario")}>
                  <Plus aria-hidden="true" />
                  Adicionar funcionalidade
                </button>
              </div>

              {itens.length === 0 ? (
                <div className="mt-4">
                  <EstadoVazio icone={ListChecks} titulo="Esta tela ainda não tem funcionalidades." acao={<button type="button" onClick={() => setItens([novoItem()])} className={botao("primario")}><Plus aria-hidden="true" />Adicionar funcionalidade</button>}>
                    Enquanto não houver, a tela aparece como “Em preparação” para o cliente.
                  </EstadoVazio>
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {itens.map((it, n) => {
                    const aberto = it.aberto || !!textoDe(`nome-${it.k}`) || it.passos.some((s) => textoDe(`passo-${s.k}-fazer`) || textoDe(`passo-${s.k}-esperado`));
                    return (
                      <li key={it.k} className="rounded-lg border border-slate-300 bg-white">
                        <input type="hidden" name="itemId" value={it.id ?? ""} />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                          <button type="button" aria-expanded={aberto} aria-controls={`func-${it.k}`} onClick={() => mudarItem(it.k, { aberto: !aberto })} className={`flex min-h-11 min-w-0 flex-1 basis-60 items-center gap-2 rounded text-left sm:min-h-9 ${FOCO}`}>
                            <ChevronRight aria-hidden="true" className={`size-4 shrink-0 text-slate-600 transition-transform motion-reduce:transition-none ${aberto ? "rotate-90" : ""}`} />
                            <span className="min-w-0 truncate font-medium">{it.nome.trim() || `Nova funcionalidade ${n + 1}`}</span>
                          </button>
                          <span className="text-xs text-slate-700">{it.passos.length === 1 ? "1 passo" : `${it.passos.length} passos`}</span>
                          {it.passos.length === 0 ? <Etiqueta tom="alerta" icone={AlertTriangle}>Sem roteiro</Etiqueta> : <Etiqueta tom="sucesso" icone={CheckCircle2}>Roteiro completo</Etiqueta>}
                        </div>

                        <div id={`func-${it.k}`} hidden={!aberto} className="space-y-5 border-t border-slate-200 px-4 py-4">
                          <div>
                            <label htmlFor={`nome-${it.k}`} className="block text-sm font-medium">Nome da funcionalidade <span className="font-normal text-slate-600">(obrigatório)</span></label>
                            <p className="text-xs text-slate-700">Botão, campo ou área da tela. Ex.: Filtro por período.</p>
                            <textarea id={`nome-${it.k}`} name="itemNome" rows={1} value={it.nome} aria-invalid={textoDe(`nome-${it.k}`) ? true : undefined} onChange={(e) => mudarItem(it.k, { nome: e.target.value })} placeholder="Ex.: Botão Salvar, Campo Nome, Área de filtros" className={`${campo} field-sizing-content min-h-11 resize-y text-slate-900 sm:min-h-10 ${textoDe(`nome-${it.k}`) ? "border-rose-600" : ""}`} />
                            {textoDe(`nome-${it.k}`) && <p role="alert" className="mt-1 text-sm text-rose-800">{textoDe(`nome-${it.k}`)}</p>}
                          </div>
                          <div>
                            <label htmlFor={`faz-${it.k}`} className="block text-sm font-medium">Descrição da funcionalidade</label>
                            <p className="text-xs text-slate-700">O que ela faz, como referência para quem testa.</p>
                            <textarea id={`faz-${it.k}`} name="itemFaz" rows={2} value={it.faz} onChange={(e) => mudarItem(it.k, { faz: e.target.value })} placeholder="Ex.: Mostra na lista só os pedidos do período escolhido" className={`${campo} field-sizing-content min-h-20 resize-y text-slate-900`} />
                          </div>
                          <CampoArquivo nome="itemImagem" rotulo="Referência visual deste item (opcional)" ajuda="Use quando a funcionalidade muda a tela ou abre uma janela." limiteMb={10} valor={it.imagem} aoMudar={(u) => mudarItem(it.k, { imagem: u })} descricaoAlt={`a referência de ${it.nome.trim() || "esta funcionalidade"}`} />

                          <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3">
                            <legend className="px-1 text-sm font-semibold">Roteiro de teste</legend>
                            <input type="hidden" name="itemPassos" value={JSON.stringify(it.passos.map(({ id, fazer, esperado }) => ({ id, fazer, esperado })))} />
                            <p className="text-xs text-slate-700">Passo a passo para outra pessoa testar sozinha. Cada passo diz o que fazer e o que ela deve ver.</p>
                            {it.passos.length === 0 && <p className="mt-2 text-sm text-amber-950"><strong>Sem roteiro.</strong> O validador só verá a descrição e responderá OK, NÃO OK ou NÃO TESTADO.</p>}
                            <EditorPassos recolhiveis prefixo="passo" passos={it.passos} erros={errosPasso(it)} aoMudar={(lista) => mudarItem(it.k, { passos: lista })} novo={() => novoPassoEditavel()} />
                          </fieldset>

                          <div className="border-t border-slate-100 pt-3">
                            <button type="button" onClick={() => setItens((l) => l.filter((x) => x.k !== it.k))} className={botao("destrutivo")}>
                              <Trash2 aria-hidden="true" />
                              Remover funcionalidade<span className="sr-only"> {it.nome.trim() || n + 1}</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <details className="rounded-lg border border-slate-200 bg-white" open={pdfProprio}>
              <summary className={`flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${FOCO}`}>Opções avançadas: PDF próprio</summary>
              <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={pdfProprio} onChange={(e) => setPdfProprio(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
                  <span>
                    <span className="font-medium">Enviar um PDF meu</span>
                    <span className="block text-xs text-slate-700">Sem marcar, o PDF das funcionalidades é gerado sozinho com a lista acima.</span>
                  </span>
                </label>
                {pdfProprio && <CampoArquivo nome="pdf_url" rotulo="PDF das funcionalidades" tipo="pdf" limiteMb={20} valor={pdf} aoMudar={setPdf} />}
              </div>
            </details>

            {cenarios.length > 0 && (
              <section aria-labelledby="t-cenarios" className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 id="t-cenarios" className="font-semibold">Cenários da biblioteca que usam esta tela</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {cenarios.map((c) => (
                    <li key={c.id}>
                      <Link href={`/admin/${cadernoId}/biblioteca/${c.id}`} className="text-brand-800 underline">{c.titulo}</Link>
                      {c.arquivado && <span className="ml-2"><Etiqueta>Arquivado</Etiqueta></span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </PainelAba>

        <PainelAba id="previa" ativa={aba}>
          {aba === "previa" && (
            <PreviaTela
              tela={{ id: telaId ?? "nova", titulo, imagem: imagem || null, link: ehPopup || modo === "desenho" ? null : link.trim() || null, caminho: ehPopup ? "" : caminho, modo: modoEfetivo, pdf: null }}
              moduloTitulo={moduloAtual?.titulo ?? ""}
              paiTitulo={ehPopup ? pai?.titulo ?? "outra tela" : null}
              ambienteUrl={ambienteUrl}
              itens={itens.filter((i) => i.nome.trim()).map((i) => ({ id: i.id ?? `novo-${i.k}`, nome: i.nome.trim(), faz: i.faz.trim(), imagem: i.imagem || undefined, passos: i.passos.filter((s) => s.fazer.trim() && s.esperado.trim()).map((s, m) => ({ id: s.id ?? `novo-${i.k}-${m}`, fazer: s.fazer.trim(), esperado: s.esperado.trim() })) }))}
              sujo={sujo}
              acaoSalvar={salvarAqui}
              aoPreparar={() => setAba("funcionalidades")}
            />
          )}
        </PainelAba>
      </div>

      {sujo && (
        <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-300 bg-white/95 px-4 py-2 backdrop-blur">
          <Salvar sujo={sujo} salvo={false} falhou={falhou} />
        </div>
      )}
    </form>
  );
}
