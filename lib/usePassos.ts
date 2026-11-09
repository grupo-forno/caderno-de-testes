"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RespPasso } from "@/lib/tipos";

const ESPERAS = [1000, 3000, 6000]; // entre as tentativas de salvar quando a rede falha
const TEMPO = 15000;
const TRANSITORIOS = [408, 425, 429];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// api: endereço para gravar cada passo. Padrão é o do caderno (/api/passos). As rodadas usam /api/rodada/resposta.
export type Credencial = { caderno: string; chave: string; api?: string };

// Respostas aos passos do roteiro: guarda na tela, salva sozinho (com nova tentativa se a rede falhar) e nunca descarta o que a pessoa escreveu.
// Toda chamada leva a chave de quem valida; o e-mail não vale como prova.
export function usePassos(cred: Credencial | null) {
  const [resp, setResp] = useState<Record<string, RespPasso>>({});
  const [salvo, setSalvo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(0); // esperando para salvar ou salvando
  const [falhas, setFalhas] = useState(0); // não conseguiram salvar (rede)
  const [bloqueio, setBloqueio] = useState<string | null>(null); // erro que repetir não resolve
  const [concluido, setConcluido] = useState<string | null>(null); // homologação concluída: só leitura

  const credRef = useRef(cred);
  useEffect(() => {
    credRef.current = cred;
  }, [cred]);
  const respRef = useRef<Record<string, RespPasso>>({});
  const itemDe = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const voando = useRef<Set<string>>(new Set());
  const sujos = useRef<Set<string>>(new Set());
  const falhou = useRef<Set<string>>(new Set());
  const geracao = useRef(0);

  const contar = () => {
    setOcupado(sujos.current.size - falhou.current.size);
    setFalhas(falhou.current.size);
  };

  const cabecalhos = (c: Credencial) => ({ "Content-Type": "application/json", Authorization: `Bearer ${c.chave}` });

  // Lê as respostas do servidor. Devolve o erro (com "invalida" = a chave não vale mais), ou null se deu certo.
  const carregar = useCallback(async (nova?: Credencial): Promise<{ msg: string; invalida: boolean } | null> => {
    const c = nova ?? credRef.current;
    if (nova) credRef.current = nova;
    if (!c) return null;
    const g = geracao.current;
    try {
      const r = await fetch(`/api/passos?caderno=${encodeURIComponent(c.caderno)}`, { headers: cabecalhos(c), signal: AbortSignal.timeout(TEMPO), cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (g !== geracao.current) return null;
      if (!r.ok || !j || typeof j.passos !== "object") return { msg: j?.erro ?? "Não conseguimos carregar suas respostas. Confira sua internet e tente de novo.", invalida: r.status === 401 };
      respRef.current = j.passos;
      setResp(j.passos);
      setConcluido(j.aceite ? `A homologação foi concluída por ${j.aceite.nome}. O caderno está só para leitura.` : null);
      return null;
    } catch {
      return { msg: "Não conseguimos carregar suas respostas. Confira sua internet e tente de novo.", invalida: false };
    }
  }, []);

  async function salvar(passo: string) {
    if (voando.current.has(passo)) return;
    const g = geracao.current;
    voando.current.add(passo);
    let tentativa = 0;
    for (;;) {
      const c = credRef.current;
      if (!c || g !== geracao.current) return;
      const valor = respRef.current[passo];
      if (!valor) break;
      const enviado = JSON.stringify(valor);
      let status = 0;
      let msg: string | undefined;
      let codigo: string | undefined;
      try {
        const x = await fetch(c.api ?? "/api/passos", {
          method: "PUT",
          headers: cabecalhos(c),
          body: JSON.stringify({ caderno: c.caderno, item: itemDe.current[passo], passo, ...valor }),
          signal: AbortSignal.timeout(TEMPO),
        });
        status = x.status;
        if (!x.ok) {
          const j = await x.json().catch(() => null);
          msg = j?.erro;
          codigo = j?.codigo;
        }
      } catch {
        status = 0; // sem rede ou demorou: falha passageira
      }
      if (g !== geracao.current) return;
      if (status >= 200 && status < 300) {
        if (JSON.stringify(respRef.current[passo]) !== enviado) {
          tentativa = 0;
          continue; // a pessoa mudou algo durante o envio: manda de novo
        }
        sujos.current.delete(passo);
        falhou.current.delete(passo);
        setSalvo(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        break;
      }
      if (status === 409 && (codigo === "aceito" || codigo === "enviado")) {
        sujos.current.clear();
        falhou.current.clear();
        setConcluido(msg ?? "A homologação foi concluída. O caderno está só para leitura.");
        if (!c.api) void carregar();
        break;
      }
      if (status >= 400 && status < 500 && !TRANSITORIOS.includes(status)) {
        setBloqueio(msg ?? "Não foi possível salvar. Recarregue a página e tente de novo.");
        break;
      }
      if (tentativa >= ESPERAS.length) {
        falhou.current.add(passo);
        break;
      }
      await esperar(ESPERAS[tentativa++]);
    }
    if (g !== geracao.current) return;
    voando.current.delete(passo);
    contar();
  }

  // Muda a resposta de um passo na tela e agenda o salvamento (600 ms depois da última mudança)
  function mudar(itemId: string, passoId: string, patch: Partial<RespPasso>) {
    if (concluido) return;
    const atual: RespPasso = respRef.current[passoId] ?? { resultado: "funcionou", obs: "", anexos: [] };
    respRef.current = { ...respRef.current, [passoId]: { ...atual, ...patch } };
    setResp(respRef.current);
    itemDe.current[passoId] = itemId;
    sujos.current.add(passoId);
    falhou.current.delete(passoId);
    clearTimeout(timers.current[passoId]);
    timers.current[passoId] = setTimeout(() => {
      delete timers.current[passoId];
      void salvar(passoId);
    }, 600);
    contar();
  }

  function tentarDeNovo() {
    for (const p of Array.from(falhou.current)) {
      falhou.current.delete(p);
      void salvar(p);
    }
    contar();
  }

  // Ao sair com algo sem salvar: avisa (se já falhou) ou manda o que ficou esperando
  useEffect(() => {
    function descarregar() {
      const c = credRef.current;
      if (!c || bloqueio) return;
      for (const p of sujos.current) {
        if (voando.current.has(p) || !respRef.current[p]) continue;
        try {
          void fetch(c.api ?? "/api/passos", { method: "PUT", headers: cabecalhos(c), body: JSON.stringify({ caderno: c.caderno, item: itemDe.current[p], passo: p, ...respRef.current[p] }), keepalive: true });
        } catch {}
      }
    }
    const aoEsconder = () => document.visibilityState === "hidden" && descarregar();
    const aoSair = (e: BeforeUnloadEvent) => {
      if ((bloqueio || falhou.current.size > 0) && sujos.current.size > 0) e.preventDefault();
    };
    window.addEventListener("pagehide", descarregar);
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("beforeunload", aoSair);
    return () => {
      window.removeEventListener("pagehide", descarregar);
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("beforeunload", aoSair);
    };
  }, [bloqueio]);

  // Zera tudo (troca de pessoa)
  function limpar() {
    geracao.current++;
    for (const t of Object.values(timers.current)) clearTimeout(t);
    timers.current = {};
    voando.current.clear();
    sujos.current.clear();
    falhou.current.clear();
    itemDe.current = {};
    respRef.current = {};
    setResp({});
    setSalvo(null);
    setBloqueio(null);
    setConcluido(null);
    contar();
  }

  // Coloca respostas já carregadas (as rodadas buscam tudo de uma vez em /api/rodada)
  // (useCallback: quem usa isto num efeito não pode ver uma função nova a cada renderização)
  const definir = useCallback((r: Record<string, RespPasso>, concluido: string | null = null) => {
    respRef.current = r;
    setResp(r);
    setConcluido(concluido);
  }, []);

  const semSalvar = () => sujos.current.size;

  return { resp, salvo, ocupado, falhas, bloqueio, concluido, carregar, definir, mudar, tentarDeNovo, limpar, semSalvar };
}
