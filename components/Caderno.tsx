"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import Execucao, { idPasso, type PassoFila } from "@/components/Execucao";
import Inicio from "@/components/Inicio";
import MenuTelas from "@/components/MenuTelas";
import ModuloView from "@/components/ModuloView";
import Resumo from "@/components/Resumo";
import { COR_ICONE, IconeStatus } from "@/components/StatusBadge";
import TelaView, { OPCOES } from "@/components/TelaView";
import { dataHora } from "@/lib/formatar";
import { anexosDoItem, estadoPasso, observacaoDoItem, passoCompleto, resultadoDoItem, temRoteiro } from "@/lib/passos";
import { usePassos } from "@/lib/usePassos";
import { juntar, resumoTela, ROTULO_STATUS } from "@/lib/status";
import type { Caderno as C, Evento, Item, Resp, Tela } from "@/lib/tipos";

type Pessoa = { nome: string; email: string; chave?: string }; // a chave prova quem é a pessoa; o e-mail digitado não prova
type Aceite = { nome: string; criado: string; token: string | null }; // o termo só vem para quem aceitou
type Fase = "inicio" | "carregando" | "erro" | "ok";

const VAZIA: Resp = { resultado: "nao_testado", obs: "", anexos: [], severidade: null };
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];
const MAX_PRINTS = 10;
const ESPERAS = [1000, 3000, 6000]; // entre as tentativas de salvar quando a rede falha
const TEMPO = 15000; // uma chamada que passa disso é tratada como falha de rede
const TRANSITORIOS = [408, 425, 429]; // 4xx que passam sozinhos: tenta de novo, como nos 5xx
const MSG_DEMOROU = "Demorou demais. Confira sua internet e tente de novo.";
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const demorou = (e: unknown) => e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
const focarTitulo = () => document.getElementById("titulo-tela")?.focus({ preventScroll: true });

// A mensagem do servidor traz "...concluída em DD/MM/AAAA por NOME. ..." : serve de plano B se não der para reler o aceite
function aceiteDaMensagem(msg?: string): Aceite {
  const m = msg?.match(/em (\d{2})\/(\d{2})\/(\d{4}) por (.+?)\./);
  const criado = m ? new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00-03:00`).toISOString() : new Date().toISOString();
  return { nome: m ? m[4] : "outra pessoa", criado, token: null };
}

export default function Caderno({ caderno, slug }: { caderno: C; slug: string }) {
  const [resp, setResp] = useState<Record<string, Resp>>({});
  const [historico, setHistorico] = useState<Record<string, Evento[]>>({});
  const [aceite, setAceite] = useState<Aceite | null>(null); // homologação concluída: caderno só para leitura
  const [fase, setFase] = useState<Fase>("inicio");
  const [msgCarga, setMsgCarga] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [trocou, setTrocou] = useState(false); // a pessoa acabou de clicar em "Trocar": o foco vai para o campo do nome
  const [ativa, setAtiva] = useState<string>("");
  const [abertos, setAbertos] = useState<Record<string, boolean>>({}); // módulos abertos no menu (vale para as duas cópias do menu)
  const [salvo, setSalvo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(0); // respostas esperando para serem salvas
  const [falhas, setFalhas] = useState(0); // respostas que não conseguiram salvar
  const [bloqueio, setBloqueio] = useState<string | null>(null); // erro que não se resolve tentando de novo
  const [avisoPerda, setAvisoPerda] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Record<string, number>>({});
  const [erroAnexo, setErroAnexo] = useState<{ id: string; msg: string } | null>(null);
  const [okAnexo, setOkAnexo] = useState<{ id: string; msg: string } | null>(null);
  const [erroEntrada, setErroEntrada] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const cred = pessoa?.chave ? { caderno: slug, chave: pessoa.chave } : null;
  const ps = usePassos(cred);

  // Sempre o valor mais novo, para os envios e o salvamento nunca partirem de um estado velho
  const respRef = useRef<Record<string, Resp>>({});
  const telaDoItem = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const voando = useRef<Set<string>>(new Set());
  const sujos = useRef<Set<string>>(new Set()); // mudou e o servidor ainda não confirmou
  const falhou = useRef<Set<string>>(new Set());
  const geracao = useRef(0); // sobe a cada troca de pessoa: o que ficou para trás nunca grava nem mexe na tela
  const focarAoCarregar = useRef(false);
  const okTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const primeiraTela = useRef(true);
  const painel = useRef<HTMLDialogElement>(null);
  const topo = useRef<HTMLDivElement>(null);

  // ---------- estrutura: módulos > telas > pop-ups ----------
  const principaisDoModulo = (id: string) => caderno.telas.filter((t) => t.moduloId === id && !t.paiId);
  const filhosDe = (id: string) => caderno.telas.filter((t) => t.paiId === id);
  const numeros: Record<string, string> = {};
  caderno.modulos.forEach((m, mi) => {
    numeros[m.id] = String(mi + 1);
    principaisDoModulo(m.id).forEach((t, ti) => {
      numeros[t.id] = `${mi + 1}.${ti + 1}`;
      filhosDe(t.id).forEach((f, fj) => (numeros[f.id] = `${mi + 1}.${ti + 1}.${fj + 1}`));
    });
  });
  // telas na ordem do menu, para "anterior" e "próxima"
  const ordem = caderno.modulos.flatMap((m) => principaisDoModulo(m.id).flatMap((t) => [t, ...filhosDe(t.id)])).map((t) => ({ tela: t, numero: numeros[t.id] }));

  // Funcionalidade com roteiro: o resultado vem dos passos. Sem roteiro (modelo antigo): da resposta direta.
  const itensPorId = new Map(caderno.telas.flatMap((t) => t.itens.map((i) => [i.id, i] as const)));
  const res = (id: string): Resp => {
    const it = itensPorId.get(id);
    if (it && temRoteiro(it)) {
      const rp = (pid: string) => ps.resp[pid];
      return { resultado: resultadoDoItem(it.passos, rp), obs: observacaoDoItem(it.passos, rp), anexos: anexosDoItem(it.passos, rp), severidade: ps.gravidade[id] ?? null };
    }
    return resp[id] ? { ...VAZIA, ...resp[id], anexos: resp[id].anexos ?? [] } : VAZIA;
  };
  // Para onde o resumo leva quem precisa informar a gravidade: o passo que falhou (roteiro) ou a tela da funcionalidade (modelo antigo)
  const destinoGravidade = (itemId: string, telaId: string) => {
    const it = itensPorId.get(itemId);
    const falha = it && temRoteiro(it) ? it.passos.find((p) => ps.resp[p.id]?.resultado === "diferente") : undefined;
    return falha ? idPasso(falha.id) : telaId;
  };
  // todos os passos, na ordem do menu (módulo > tela > funcionalidade > passo)
  const fila: PassoFila[] = [];
  for (const { tela, numero } of ordem) {
    const modulo = caderno.modulos.find((m) => m.id === tela.moduloId);
    if (!modulo) continue;
    for (const item of tela.itens) {
      if (!temRoteiro(item)) continue;
      item.passos.forEach((passo, n) => fila.push({ passo, indice: n + 1, total: item.passos.length, item, tela, numeroTela: numero, modulo, numeroModulo: numeros[modulo.id] }));
    }
  }
  const posPasso = ativa.startsWith("p:") ? fila.findIndex((f) => idPasso(f.passo.id) === ativa) : -1;
  const passoAtivo = posPasso >= 0 ? fila[posPasso] : null;
  const respondidos = fila.filter((f) => passoCompleto(ps.resp[f.passo.id])).length;
  const comProblema = fila.filter((f) => estadoPasso(ps.resp[f.passo.id]) === "diferente").length;
  const bloqueados = fila.filter((f) => estadoPasso(ps.resp[f.passo.id]) === "bloqueado").length;
  const todosItens = caderno.telas.flatMap((t) => t.itens);
  const resumos = Object.fromEntries(ordem.map(({ tela }) => [tela.id, resumoTela(tela, (id) => res(id).resultado)]));
  const telasDoModulo = (id: string) => principaisDoModulo(id).flatMap((t) => [t, ...filhosDe(t.id)]);
  const resumosMod = Object.fromEntries(caderno.modulos.map((m) => [m.id, juntar(telasDoModulo(m.id).map((t) => resumos[t.id]))]));
  const geral = juntar(ordem.map(({ tela }) => resumos[tela.id]));
  const jaComecou = Object.keys(ps.resp).length > 0 || Object.values(resp).some((r) => r.resultado !== "nao_testado" || r.obs || r.anexos?.length);

  const idx = ordem.findIndex((o) => o.tela.id === ativa);
  const atual = idx >= 0 ? ordem[idx] : null;
  const moduloDaAtiva = caderno.modulos.find((m) => m.id === ativa) ?? null;
  const moduloAtivo = passoAtivo ? passoAtivo.modulo.id : atual ? atual.tela.moduloId : moduloDaAtiva?.id ?? null;
  const nomeAtual = ativa === "inicio" ? "Início" : passoAtivo ? `Passo ${passoAtivo.indice} de ${passoAtivo.total} · ${passoAtivo.item.nome}` : atual ? `${atual.numero} ${atual.tela.titulo}` : moduloDaAtiva ? `${numeros[moduloDaAtiva.id]} ${moduloDaAtiva.titulo}` : "Resumo geral";

  function contar() {
    setOcupado(sujos.current.size - falhou.current.size);
    setFalhas(falhou.current.size);
  }

  // ---------- carregar ----------
  // Abre na tela do endereço (#id); senão na primeira tela que dá para testar e ainda não está finalizada
  function telaInicial(): string {
    const h = window.location.hash.slice(1);
    if (h === "inicio" || h === "resumo" || fila.some((f) => idPasso(f.passo.id) === h) || ordem.some((o) => o.tela.id === h) || caderno.modulos.some((m) => m.id === h)) return h;
    return "inicio"; // a entrada do caderno: o que será validado e o botão para começar ou continuar
  }

  // O que o botão principal da entrada faz: vai ao primeiro passo sem resposta; sem roteiro, abre a primeira tela que ainda dá para testar
  function aoComecar() {
    const pendente = fila.find((f) => !passoCompleto(ps.resp[f.passo.id])) ?? fila[0];
    if (pendente) return ir(idPasso(pendente.passo.id));
    const aberta = ordem.find(({ tela }) => {
      const s = resumoTela(tela, (id) => res(id).resultado).status;
      return s === "nao_iniciada" || s === "em_andamento";
    });
    ir(aberta?.tela.id ?? ordem[0]?.tela.id ?? "resumo");
  }

  async function buscar(p: Pessoa) {
    const r = await fetch(`/api/respostas?caderno=${encodeURIComponent(slug)}&email=${encodeURIComponent(p.email)}`, { signal: AbortSignal.timeout(TEMPO) });
    if (!r.ok) throw new Error();
    const d = await r.json();
    if (!d || typeof d.respostas !== "object" || typeof d.historico !== "object") throw new Error();
    return d as { respostas: Record<string, Resp>; historico: Record<string, Evento[]>; aceite?: Aceite | null };
  }

  async function carregar(p: Pessoa, focar = false) {
    const g = geracao.current;
    setFase("carregando");
    setMsgCarga(null);
    try {
      const [d, falhaPassos] = await Promise.all([buscar(p), ps.carregar(p.chave ? { caderno: slug, chave: p.chave } : undefined)]);
      if (g !== geracao.current) return;
      if (falhaPassos?.invalida) {
        // a chave guardada não vale mais: volta para a entrada, sem apagar nada do servidor
        try {
          localStorage.removeItem("pessoa");
        } catch {}
        setErroEntrada(falhaPassos.msg);
        setPessoa(null);
        setFase("ok");
        return;
      }
      if (falhaPassos) throw new Error(falhaPassos.msg);
      focarAoCarregar.current = focar;
      respRef.current = d.respostas;
      setResp(d.respostas);
      setHistorico(d.historico);
      setAceite(d.aceite ?? null);
      setAtiva(telaInicial());
      setFase("ok");
    } catch (e) {
      if (g !== geracao.current) return;
      setMsgCarga(demorou(e) ? MSG_DEMOROU : null);
      setFase("erro");
    }
  }

  // depois de salvar, atualiza só o histórico (as respostas na tela já estão certas)
  async function atualizarHistorico() {
    if (!pessoa) return;
    const g = geracao.current;
    try {
      const d = await buscar(pessoa);
      if (g !== geracao.current) return;
      setHistorico(d.historico);
      setAceite(d.aceite ?? null);
    } catch (e) {
      console.warn("Não foi possível atualizar o histórico agora; ele continua como estava.", e);
    }
  }

  // Entrar: cria a pessoa (ou confere a chave do link para continuar) e guarda a chave neste aparelho
  async function identificar(entrada: { nome: string; email: string } | { chave: string }): Promise<{ p: Pessoa } | { erro: string }> {
    try {
      const r = await fetch("/api/validador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caderno: slug, ...entrada }),
        signal: AbortSignal.timeout(TEMPO),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.nome) return { erro: j?.erro ?? "Não conseguimos entrar agora. Confira sua internet e tente de novo." };
      const chave: string = "chave" in entrada ? entrada.chave : j.chave;
      const p: Pessoa = { nome: j.nome, email: j.email, chave };
      try {
        localStorage.setItem("pessoa", JSON.stringify(p));
      } catch {}
      return { p };
    } catch (e) {
      return { erro: demorou(e) ? MSG_DEMOROU : "Não conseguimos entrar agora. Confira sua internet e tente de novo." };
    }
  }

  useEffect(() => {
    void (async () => {
      let p: Pessoa | null = null;
      try {
        const guardada = JSON.parse(localStorage.getItem("pessoa") ?? "null");
        if (guardada?.nome && guardada?.email) p = { nome: String(guardada.nome), email: String(guardada.email), chave: guardada.chave ? String(guardada.chave) : undefined };
      } catch {}
      // link para continuar (#k=chave): vale para esta pessoa e sai do endereço logo depois de lido
      const k = window.location.hash.match(/^#k=([\w-]+)$/)?.[1];
      if (k) {
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch {}
        const r = await identificar({ chave: k });
        if ("p" in r) p = r.p;
        else setErroEntrada(r.erro);
      }
      // pessoa guardada de antes do roteiro (sem chave): pega uma chave agora; se o e-mail já tem dono, volta para a entrada
      if (p && !p.chave) {
        const r = await identificar({ nome: p.nome, email: p.email });
        if ("p" in r) p = r.p;
        else {
          setErroEntrada(r.erro);
          try {
            localStorage.removeItem("pessoa");
          } catch {}
          p = null;
        }
      }
      setPessoa(p);
      if (!p) setFase("ok");
      else void carregar(p);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // depois de "Tentar de novo" ou "Começar", o botão some: o foco vai para o título da tela
  useEffect(() => {
    if (fase === "ok" && focarAoCarregar.current) {
      focarAoCarregar.current = false;
      focarTitulo();
    }
  }, [fase]);

  async function entrar(dados: { nome: string; email: string }) {
    setErroEntrada(null);
    setEntrando(true);
    const r = await identificar(dados);
    setEntrando(false);
    if ("erro" in r) return setErroEntrada(r.erro);
    geracao.current++;
    setTrocou(false);
    setPessoa(r.p);
    void carregar(r.p, true);
  }

  function trocarPessoa() {
    if ((sujos.current.size > 0 || ps.semSalvar() > 0) && !confirm("Ainda há respostas sem salvar. Trocar de pessoa agora pode perdê-las. Trocar mesmo assim?")) return;
    if (pessoa?.chave && !confirm("Para voltar depois como você, vai precisar do link para continuar (está na página inicial do caderno). Já guardou? Trocar de pessoa agora?")) return;
    ps.limpar();
    setErroEntrada(null);
    geracao.current++; // o que estava em andamento para a pessoa anterior para de valer
    for (const t of Object.values(timers.current)) clearTimeout(t);
    timers.current = {};
    voando.current.clear();
    telaDoItem.current = {};
    try {
      localStorage.removeItem("pessoa");
    } catch {}
    respRef.current = {};
    sujos.current.clear();
    falhou.current.clear();
    contar();
    setResp({});
    setHistorico({});
    setAceite(null);
    setSalvo(null);
    setBloqueio(null);
    setAvisoPerda(null);
    setEnviando({});
    setErroAnexo(null);
    setOkAnexo(null);
    setTrocou(true);
    setPessoa(null);
    setFase("ok");
  }

  // ---------- salvar ----------
  function corpo(tela: string, item: string, r: Resp) {
    return JSON.stringify({ caderno: slug, tela, item, ...pessoa, ...r });
  }

  // O servidor disse que a homologação foi concluída: a tela vira só leitura, mesmo que reler as respostas falhe
  async function lidarComAceito(msg: string | undefined, g: number) {
    setAceite((a) => a ?? aceiteDaMensagem(msg));
    setAvisoPerda("Sua última alteração não foi salva porque a homologação foi concluída.");
    try {
      if (pessoa) {
        const d = await buscar(pessoa);
        if (g !== geracao.current) return;
        respRef.current = d.respostas;
        setResp(d.respostas);
        setHistorico(d.historico);
        setAceite(d.aceite ?? null);
      }
    } catch (e) {
      console.warn("Não foi possível reler as respostas depois da conclusão.", e);
    }
    if (g !== geracao.current) return;
    sujos.current.clear();
    falhou.current.clear();
  }

  // Uma gravação de cada vez por funcionalidade. Tenta de novo se a rede falhar ou demorar. Se o servidor recusar (4xx), avisa e para.
  async function salvar(item: string) {
    if (voando.current.has(item) || bloqueio) return;
    const g = geracao.current;
    voando.current.add(item);
    let tentativa = 0;
    for (;;) {
      if (g !== geracao.current) return; // trocou de pessoa: abandona sem mexer em nada
      const valor: Resp = { ...VAZIA, ...respRef.current[item] };
      const enviado = JSON.stringify(valor);
      let status = 0;
      let msg: string | undefined;
      let codigo: string | undefined;
      try {
        const x = await fetch("/api/respostas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: corpo(telaDoItem.current[item], item, valor),
          signal: AbortSignal.timeout(TEMPO),
        });
        status = x.status;
        if (!x.ok) {
          const j = await x.json().catch(() => null);
          msg = j?.erro;
          codigo = j?.codigo;
        }
      } catch {
        status = 0; // sem rede ou demorou demais: trata como falha passageira
      }
      if (g !== geracao.current) return;
      if (status >= 200 && status < 300) {
        if (JSON.stringify({ ...VAZIA, ...respRef.current[item] }) !== enviado) {
          tentativa = 0;
          continue; // a pessoa mudou algo durante o envio: manda de novo
        }
        sujos.current.delete(item);
        falhou.current.delete(item);
        setSalvo(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        break;
      }
      if (status === 409 && codigo === "aceito") {
        await lidarComAceito(msg, g);
        break;
      }
      if (status >= 400 && status < 500 && !TRANSITORIOS.includes(status)) {
        setBloqueio(msg ?? "Não foi possível salvar. Recarregue a página e tente de novo.");
        break;
      }
      if (tentativa >= ESPERAS.length) {
        falhou.current.add(item);
        break;
      }
      await esperar(ESPERAS[tentativa++]);
    }
    if (g !== geracao.current) return;
    voando.current.delete(item);
    contar();
    if (sujos.current.size === 0) void atualizarHistorico();
  }

  function tentarDeNovo() {
    for (const item of Array.from(falhou.current)) {
      falhou.current.delete(item);
      void salvar(item);
    }
    contar();
    focarTitulo(); // o aviso com este botão some: o foco não pode ficar perdido
  }

  function mudar(tela: Tela, item: Item, patch: Partial<Resp>) {
    if (aceite || temRoteiro(item)) return; // depois do aceite nada muda
    const nova: Resp = { ...VAZIA, ...respRef.current[item.id], ...patch };
    if (nova.resultado !== "nao_ok") nova.severidade = null; // a gravidade só vale para NÃO OK
    respRef.current = { ...respRef.current, [item.id]: nova };
    setResp(respRef.current);
    telaDoItem.current[item.id] = tela.id;
    sujos.current.add(item.id);
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(() => {
      delete timers.current[item.id];
      void salvar(item.id);
    }, 600);
    contar();
  }

  // Se a pessoa fechar ou esconder a página, manda o que ainda estava esperando (menos o que já está sendo enviado)
  useEffect(() => {
    function descarregar() {
      if (!pessoa || bloqueio) return;
      for (const item of sujos.current) {
        const tela = telaDoItem.current[item];
        if (!tela || voando.current.has(item)) continue;
        try {
          void fetch("/api/respostas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: corpo(tela, item, { ...VAZIA, ...respRef.current[item] }), keepalive: true });
        } catch {}
      }
    }
    function aoSair(e: BeforeUnloadEvent) {
      // com falha ou bloqueio, qualquer resposta ainda sem salvar se perde ao fechar
      if ((bloqueio || falhou.current.size > 0) && sujos.current.size > 0) e.preventDefault();
    }
    const aoEsconder = () => document.visibilityState === "hidden" && descarregar();
    window.addEventListener("pagehide", descarregar);
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("pagehide", descarregar);
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("beforeunload", aoSair);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa, bloqueio]);

  // ---------- concluir a homologação ----------
  // devolve a mensagem de erro, ou null se deu certo
  async function concluir(): Promise<string | null> {
    if (!pessoa) return "Entre de novo com seu nome e e-mail.";
    try {
      const r = await fetch("/api/aceite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caderno: slug, nome: pessoa.nome, email: pessoa.email, ciente: true }),
        signal: AbortSignal.timeout(TEMPO),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        if (r.status === 409) void atualizarHistorico(); // talvez já tenha sido concluída: relê para a tela refletir
        return j?.erro ?? "Não conseguimos concluir agora. Tente de novo.";
      }
      setAceite({ nome: pessoa.nome, criado: new Date().toISOString(), token: j.token });
      return null;
    } catch (e) {
      return demorou(e) ? MSG_DEMOROU : "Não conseguimos concluir agora. Confira sua internet e tente de novo.";
    }
  }

  // ---------- anexos ----------
  async function anexar(tela: Tela, item: Item, files: FileList) {
    setErroAnexo(null);
    setOkAnexo(null);
    const novos: string[] = [];
    const avisos: string[] = [];
    setEnviando((e) => ({ ...e, [item.id]: (e[item.id] ?? 0) + 1 }));
    const jaTem = (respRef.current[item.id]?.anexos ?? []).length;
    for (const f of Array.from(files)) {
      if (jaTem + novos.length >= MAX_PRINTS) {
        avisos.push(`Limite de ${MAX_PRINTS} prints por funcionalidade. “${f.name}” não foi enviado.`);
        continue;
      }
      if (!TIPOS_IMAGEM.includes(f.type)) {
        avisos.push(`“${f.name}” não é aceito. Use uma imagem PNG, JPG ou WebP.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        avisos.push(`“${f.name}” passou de 5 MB. Reduza o tamanho e tente de novo.`);
        continue;
      }
      try {
        const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload", clientPayload: slug });
        novos.push(b.url);
      } catch {
        avisos.push(`Não conseguimos enviar “${f.name}”. Confira sua internet e tente de novo. Se continuar, avise quem preparou o caderno.`);
      }
    }
    setEnviando((e) => ({ ...e, [item.id]: Math.max(0, (e[item.id] ?? 1) - 1) }));
    if (avisos.length) setErroAnexo({ id: item.id, msg: avisos.join(" ") });
    if (novos.length) {
      // lê o estado de agora, não o de quando o envio começou
      mudar(tela, item, { anexos: [...(respRef.current[item.id]?.anexos ?? []), ...novos].slice(0, MAX_PRINTS) });
      setOkAnexo({ id: item.id, msg: novos.length === 1 ? "1 print anexado" : `${novos.length} prints anexados` });
      clearTimeout(okTimer.current);
      okTimer.current = setTimeout(() => setOkAnexo(null), 6000);
    }
  }

  // ---------- navegação ----------
  function ir(id: string) {
    setAtiva(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {}
    painel.current?.close();
    topo.current?.scrollIntoView({ block: "start" });
  }

  // Ao trocar de tela: atualiza o título da aba e leva o foco para o título novo (leitor de tela e teclado)
  useEffect(() => {
    if (!ativa) return;
    document.title = `${nomeAtual} · ${caderno.titulo}`;
    if (primeiraTela.current) {
      primeiraTela.current = false;
      return;
    }
    focarTitulo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa]);

  // O painel de telas do celular não pode ficar aberto se a janela virar larga (ex.: girar o tablet)
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const fechar = () => m.matches && painel.current?.close();
    m.addEventListener("change", fechar);
    return () => m.removeEventListener("change", fechar);
  }, []);

  if (fase === "inicio") return null;
  if (!pessoa) return <Entrada titulo={caderno.titulo} onEntrar={entrar} focarNome={trocou} erro={erroEntrada} ocupado={entrando} />;

  // salvamento: junta o modelo antigo (resultado direto) e os passos do roteiro
  const bloqueioT = bloqueio ?? ps.bloqueio;
  const falhasT = falhas + ps.falhas;
  const ocupadoT = ocupado + ps.ocupado;
  const salvoT = [salvo, ps.salvo].filter(Boolean).sort().pop() ?? null;
  const textoSalvamento: { texto: string; tipo: "ok" | "salvando" | "erro" } = bloqueioT
    ? { texto: "Recarregue a página para continuar", tipo: "erro" }
    : falhasT > 0
      ? { texto: "Há respostas sem salvar. Elas continuam na tela: confira a internet e tente salvar de novo", tipo: "erro" }
      : ocupadoT > 0
        ? { texto: "Salvando…", tipo: "salvando" }
        : { texto: salvoT ? `Salvo às ${salvoT}` : "Suas respostas são salvas sozinhas", tipo: "ok" };
  const somenteLeitura = !!aceite || !!ps.concluido;
  const linkParaContinuar = pessoa.chave ? `${window.location.origin}/c/${slug}#k=${pessoa.chave}` : null;

  const cabecalho = (
    <header className="border-b border-slate-200 bg-white print:border-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-indigo-800">Caderno de testes de homologação</p>
          <h1 className="break-words text-balance text-xl font-semibold sm:text-2xl">{caderno.titulo}</h1>
          <p className="text-sm text-slate-600">
            Versão {caderno.versao} · {caderno.data} · Preparado por {caderno.preparadoPor}
          </p>
          <p className="hidden text-sm print:block">Respondido por {pessoa.nome} ({pessoa.email}) em {new Date().toLocaleString("pt-BR")}</p>
        </div>
        <div className="text-xs text-slate-700 print:hidden">
          <p aria-live="polite">
            {textoSalvamento.texto}
          </p>
          <p className="mt-0.5">
            {pessoa.nome} ·{" "}
            <button type="button" onClick={() => ir("inicio")} className={`rounded underline ${FOCO}`}>
              Início
            </button>{" "}
            ·{" "}
            <button type="button" onClick={trocarPessoa} className={`rounded underline ${FOCO}`}>
              Não é você? Trocar
            </button>
          </p>
        </div>
      </div>
    </header>
  );

  if (fase !== "ok") {
    return (
      <div className="min-h-screen">
        {cabecalho}
        <main className="mx-auto max-w-2xl px-4 py-10">
          {fase === "carregando" ? (
            <p role="status" className="text-sm text-slate-700">Carregando suas respostas…</p>
          ) : (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
              <p className="font-semibold">Não conseguimos carregar suas respostas salvas.</p>
              {msgCarga && <p className="mt-1">{msgCarga}</p>}
              <p className="mt-1">Para não apagar nada por engano, só liberamos o caderno depois de carregar. Confira sua internet e tente de novo.</p>
              <button type="button" onClick={() => carregar(pessoa, true)} className={`mt-3 min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
                Tentar de novo
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  const rotulo = (o?: { tela: Tela; numero: string }) => (o ? `${o.numero} ${o.tela.titulo}` : "");
  const voltar = idx > 0 ? { id: ordem[idx - 1].tela.id, rotulo: rotulo(ordem[idx - 1]) } : null;
  const avancar = atual ? (idx < ordem.length - 1 ? { id: ordem[idx + 1].tela.id, rotulo: rotulo(ordem[idx + 1]) } : { id: "resumo", rotulo: "Resumo geral" }) : null;
  const pai = atual?.tela.paiId ? (caderno.telas.find((t) => t.id === atual.tela.paiId) ?? null) : null;
  const statusAtual = atual ? resumos[atual.tela.id] : moduloDaAtiva ? resumosMod[moduloDaAtiva.id] : null;
  const modulosResumo = caderno.modulos.map((m) => ({
    modulo: m,
    numero: numeros[m.id],
    resumo: resumosMod[m.id],
    telas: telasDoModulo(m.id).map((t) => ({ tela: t, numero: numeros[t.id] })),
  }));

  // o menu aparece duas vezes (lateral e painel do celular): ids diferentes, mas o mesmo estado de módulos abertos
  const menu = (instancia: string) => (
    <MenuTelas
      instancia={instancia}
      modulos={caderno.modulos}
      principaisDoModulo={principaisDoModulo}
      filhosDe={filhosDe}
      numeros={numeros}
      resumos={resumos}
      resumosMod={resumosMod}
      geral={geral}
      ativa={passoAtivo ? passoAtivo.tela.id : ativa}
      moduloAtivo={moduloAtivo}
      aoIr={ir}
      abertos={abertos}
      definirAberto={(id, v) => setAbertos((a) => ({ ...a, [id]: v }))}
    />
  );

  return (
    <div className="min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg print:hidden">
        Pular para o conteúdo
      </a>
      {cabecalho}

      <div className="mx-auto max-w-6xl px-4 py-5 print:hidden lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block" aria-label="Menu">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain pb-4">{menu("lateral")}</div>
        </aside>

        <main id="conteudo" tabIndex={-1} className="focus:outline-none">
          <div ref={topo} className="scroll-mt-4" />

          {/* Celular: botão que abre a lista de telas */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur lg:hidden">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => painel.current?.showModal()}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md border border-slate-400 bg-white px-3 py-1 text-left text-sm ${FOCO}`}
            >
              {statusAtual && <span className={COR_ICONE[statusAtual.status]}><IconeStatus status={statusAtual.status} /></span>}
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{nomeAtual}</span>
                <span className="block text-xs text-slate-700">
                  {statusAtual ? `${ROTULO_STATUS[statusAtual.status]}${statusAtual.total ? ` · ${statusAtual.ok} de ${statusAtual.total} OK` : ""} · ` : ""}
                  ver todas as telas
                </span>
              </span>
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-slate-600" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {bloqueioT && (
            <div role="alert" className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              <p className="font-semibold">{bloqueioT}</p>
              <p className="mt-1">As respostas já salvas continuam lá. Alterações que ainda não tinham sido salvas serão perdidas ao recarregar.</p>
              <button type="button" onClick={() => window.location.reload()} className={`mt-2 min-h-11 rounded-md bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800 ${FOCO}`}>
                Recarregar a página
              </button>
            </div>
          )}

          {falhasT > 0 && !bloqueioT && (
            <div role="alert" className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              <p className="font-semibold">
                {falhasT === 1 ? "1 resposta ainda não foi salva." : `${falhasT} respostas ainda não foram salvas.`}
              </p>
              <p className="mt-1">Elas continuam aqui na tela. Confira sua internet e tente de novo. Não feche a página antes disso.</p>
              <button type="button" onClick={() => { tentarDeNovo(); ps.tentarDeNovo(); }} className={`mt-2 min-h-11 rounded-md bg-rose-700 px-4 text-sm font-medium text-white hover:bg-rose-800 ${FOCO}`}>
                Tentar salvar de novo
              </button>
            </div>
          )}

          {aceite && (
            <div role="status" className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">Homologação concluída por {aceite.nome} em {dataHora(aceite.criado)}.</p>
              <p className="mt-1">O caderno está só para leitura. Para mudar algo, peça a quem preparou o caderno para reabrir.</p>
              {aceite.token && (
                <a href={`/api/aceite/${aceite.token}/pdf`} target="_blank" rel="noreferrer" className={`mt-2 inline-flex min-h-11 items-center rounded-md border border-emerald-700 bg-white px-4 font-medium text-emerald-950 hover:bg-emerald-100 ${FOCO}`}>
                  Baixar termo de aceite (PDF)<span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </div>
          )}

          {ps.concluido && !aceite && (
            <div role="status" className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">{ps.concluido}</p>
              <p className="mt-1">Para mudar algo, peça a quem preparou o caderno para reabrir.</p>
            </div>
          )}

          {avisoPerda && (
            <div role="alert" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {avisoPerda}
            </div>
          )}

          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Ambiente de homologação.</strong> Isto é um teste: nada do que você fizer aqui afeta o sistema real.
          </div>

          {ativa !== "inicio" && !passoAtivo && (
          <details open={!jaComecou} className="mt-3 rounded-lg border border-slate-200 bg-white">
            <summary className={`flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${FOCO}`}>Como usar este caderno</summary>
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
              <p>Escolha um módulo e uma tela no menu, veja a imagem e dê um resultado para cada funcionalidade dela:</p>
              <ul className="mt-2 space-y-1">
                {OPCOES.map((o) => (
                  <li key={o.v}><strong>{o.label}:</strong> {o.dica}</li>
                ))}
              </ul>
              <p className="mt-2">O que estiver NÃO OK vai como alerta para quem corrige. Quando for corrigido, você será avisado na própria funcionalidade para testar de novo. Tudo fica registrado no histórico.</p>
              {caderno.antesDeComecar.length > 0 && (
                <>
                  <p className="mt-3 font-semibold">Antes de começar</p>
                  <ul className="mt-1 list-disc pl-5">{caderno.antesDeComecar.map((a) => <li key={a}>{a}</li>)}</ul>
                </>
              )}
            </div>
          </details>
          )}

          <div className="mt-6">
            {ativa === "inicio" ? (
              <Inicio
                titulo={caderno.titulo}
                versao={caderno.versao}
                preparadoPor={caderno.preparadoPor}
                ambienteUrl={caderno.ambienteUrl}
                antesDeComecar={caderno.antesDeComecar}
                contagem={{
                  modulos: caderno.modulos.length,
                  telas: caderno.telas.length,
                  funcionalidades: todosItens.length,
                  passos: fila.length,
                  semRoteiro: todosItens.filter((i) => !temRoteiro(i)).length,
                  desenhos: caderno.telas.filter((t) => t.itens.length > 0 && !t.link).length,
                  programadas: caderno.telas.filter((t) => t.itens.length > 0 && !!t.link).length,
                }}
                progresso={{ respondidos, comProblema, bloqueados, iniciou: jaComecou }}
                linkParaContinuar={linkParaContinuar}
                aoComecar={aoComecar}
                aoVerTelas={() => ir(ordem[0]?.tela.id ?? "resumo")}
              />
            ) : passoAtivo ? (
              <Execucao
                key={passoAtivo.passo.id}
                atual={passoAtivo}
                fila={fila}
                posicao={posPasso}
                resp={ps.resp}
                chave={pessoa.chave ?? ""}
                slug={slug}
                somenteLeitura={somenteLeitura}
                salvamento={textoSalvamento}
                aoMudar={ps.mudar}
                gravidade={ps.gravidade}
                aoGravidade={ps.informarGravidade}
                erroGravidade={ps.erroGravidade}
                aoIr={ir}
                aoSair={() => ir(posPasso === fila.length - 1 ? "resumo" : "inicio")} // no último passo o botão é "Terminar e ver o resumo"
              />
            ) : atual ? (
              <TelaView
                key={atual.tela.id}
                tela={atual.tela}
                numero={atual.numero}
                pai={pai}
                filhos={filhosDe(atual.tela.id).map((f) => ({ tela: f, numero: numeros[f.id] }))}
                resumos={resumos}
                res={res}
                historico={historico}
                aoMudar={mudar}
                aoIr={ir}
                voltar={voltar}
                avancar={avancar}
                aoAnexar={anexar}
                enviando={enviando}
                erroAnexo={erroAnexo}
                okAnexo={okAnexo}
                somenteLeitura={somenteLeitura}
                respPassos={ps.resp}
              />
            ) : moduloDaAtiva ? (
              <ModuloView
                key={moduloDaAtiva.id}
                modulo={moduloDaAtiva}
                numero={numeros[moduloDaAtiva.id]}
                resumo={resumosMod[moduloDaAtiva.id]}
                telas={telasDoModulo(moduloDaAtiva.id).map((t) => ({ tela: t, numero: numeros[t.id] }))}
                resumos={resumos}
                aoIr={ir}
              />
            ) : (
              <Resumo destinoGravidade={destinoGravidade} modulos={modulosResumo} resumos={resumos} geral={geral} res={res} aoIr={ir} pendentes={ocupadoT} falhas={falhasT} bloqueado={!!bloqueioT} pessoa={pessoa} aceite={aceite} aoConcluir={concluir} />
            )}
          </div>
        </main>
      </div>

      {/* Celular: lista de telas em tela cheia */}
      <dialog
        ref={painel}
        aria-labelledby="titulo-painel"
        onClick={(e) => { if (e.target === e.currentTarget) painel.current?.close(); }}
        className="m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-slate-50 p-0 lg:hidden"
      >
        <div className="mx-auto max-w-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="titulo-painel" className="text-lg font-semibold">Módulos e telas</h2>
            <button type="button" onClick={() => painel.current?.close()} className={`min-h-11 rounded-md border border-slate-400 bg-white px-4 text-sm font-medium ${FOCO}`}>Fechar</button>
          </div>
          {menu("painel")}
        </div>
      </dialog>

      {/* Impressão: tudo numa tabela, qualquer que seja a tela aberta */}
      <section className="hidden px-4 print:block" aria-label="Resumo para impressão">
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="mb-2 text-left font-semibold">Resultado de cada funcionalidade</caption>
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th scope="col" className="py-1 pr-3">Módulo / Tela</th>
              <th scope="col" className="py-1 pr-3">Funcionalidade</th>
              <th scope="col" className="py-1 pr-3">Resultado</th>
              <th scope="col" className="py-1">Observações</th>
            </tr>
          </thead>
          <tbody>
            {caderno.modulos.flatMap((m) =>
              telasDoModulo(m.id).flatMap((tela) =>
                tela.itens.length === 0
                  ? [
                      <tr key={tela.id} className="border-b border-slate-200 align-top">
                        <td className="py-1 pr-3 font-medium">{m.titulo} / {tela.paiId ? "Pop-up: " : ""}{tela.titulo}</td>
                        <td className="py-1 pr-3" colSpan={3}>Em preparação</td>
                      </tr>,
                    ]
                  : tela.itens.map((i) => {
                      const r = res(i.id);
                      return (
                        <tr key={i.id} className="border-b border-slate-200 align-top">
                          <td className="py-1 pr-3 font-medium">{m.titulo} / {tela.paiId ? "Pop-up: " : ""}{tela.titulo}</td>
                          <td className="py-1 pr-3 whitespace-pre-wrap">{i.nome}</td>
                          <td className="py-1 pr-3 whitespace-nowrap">{OPCOES.find((o) => o.v === r.resultado)!.label}</td>
                          <td className="py-1 whitespace-pre-wrap">
                            {r.obs}
                            {r.anexos.length > 0 && ` (${r.anexos.length} ${r.anexos.length > 1 ? "prints anexados" : "print anexado"})`}
                          </td>
                        </tr>
                      );
                    }),
              ),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Entrada({ titulo, onEntrar, focarNome, erro, ocupado }: { titulo: string; onEntrar: (p: { nome: string; email: string }) => void; focarNome: boolean; erro: string | null; ocupado: boolean }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const nomeRef = useRef<HTMLInputElement>(null);
  const campo = "mt-1 w-full rounded-md border border-slate-500 px-3 py-2 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600 sm:text-sm";

  // depois de "Trocar", o botão some: o foco vai para o primeiro campo
  useEffect(() => {
    if (focarNome) nomeRef.current?.focus();
  }, [focarNome]);

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-balance text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-700">
        Para começar, diga quem é você. Suas respostas ficam salvas sozinhas. Para continuar depois em outro aparelho, você vai receber um link para continuar; só quem tem o link vê e muda as suas respostas.
      </p>
      <form
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onEntrar({ nome: nome.trim(), email: email.trim().toLowerCase() });
        }}
      >
        <label className="block text-sm font-medium">
          Seu nome <span className="font-normal text-slate-600">(obrigatório)</span>
          <input ref={nomeRef} required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={campo} />
        </label>
        <label className="block text-sm font-medium">
          Seu e-mail <span className="font-normal text-slate-600">(obrigatório)</span>
          <input required type="email" inputMode="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={campo} />
        </label>
        {erro && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{erro}</p>}
        <button disabled={ocupado} className={`min-h-11 w-full rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 ${FOCO}`}>{ocupado ? "Entrando…" : "Continuar"}</button>
      </form>
    </main>
  );
}
