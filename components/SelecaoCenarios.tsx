"use client";

import BotaoEnviar from "@/components/BotaoEnviar";
import { useState } from "react";
import { btn2, campo } from "@/components/estilos";
import { semAcento } from "@/lib/cenarios";

export type OpcaoCenario = { id: string; titulo: string; tipo: string; passos: number; modulos: string[]; perfis: string[]; marcado: boolean; grupo: "roteiro" | "fluxo" };

// Escolha dos cenários da biblioteca: busca e filtros funcionam na própria página e os cenários escondidos continuam marcados
export default function SelecaoCenarios({ acao, cenarios, modulos, perfis }: { acao: (f: FormData) => void; cenarios: OpcaoCenario[]; modulos: string[]; perfis: string[] }) {
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState("");
  const [perfil, setPerfil] = useState("");
  const [marcados, setMarcados] = useState(() => new Set(cenarios.filter((c) => c.marcado).map((c) => c.id)));
  const visivel = (c: OpcaoCenario) => (!q || semAcento(c.titulo).includes(semAcento(q))) && (!modulo || c.modulos.includes(modulo)) && (!perfil || c.perfis.includes(perfil));
  const nVisiveis = cenarios.filter(visivel).length;

  if (!cenarios.length) {
    return <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-800">Ainda não há nada para testar. Escreva o roteiro de uma funcionalidade na tela (aba Funcionalidades e testes) ou crie um fluxo entre telas, e volte aqui.</p>;
  }
  return (
    <form action={acao} className="mt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium sm:col-span-3">
          Buscar pelo título
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className={campo + " min-h-11"} placeholder="Ex.: compra" />
        </label>
        <label className="block text-sm font-medium">
          Módulo
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={campo + " min-h-11"}>
            <option value="">Todos</option>
            {modulos.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Perfil de acesso
          <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className={campo + " min-h-11"}>
            <option value="">Todos</option>
            {perfis.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <p role="status" className="mt-3 text-sm text-slate-700">{nVisiveis} de {cenarios.length} itens na lista · {marcados.size} escolhidos para a rodada.</p>
      {nVisiveis === 0 && <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm">Nada com estes filtros.</p>}
      {(["roteiro", "fluxo"] as const).map((g) => {
        const lista = cenarios.filter((c) => c.grupo === g);
        if (!lista.length) return null;
        return (
      <div key={g} className="mt-4">
      <h3 className="text-sm font-semibold">{g === "roteiro" ? "Roteiros das telas" : "Fluxos entre telas"}</h3>
      <ul className="mt-2 space-y-2">
        {lista.map((c) => (
          <li key={c.id} hidden={!visivel(c)}>
            <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${marcados.has(c.id) ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"}`}>
              <input
                type="checkbox"
                name="cenario"
                value={c.id}
                checked={marcados.has(c.id)}
                onChange={(e) => setMarcados((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                className="mt-1 h-5 w-5"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.titulo}</span>
                <span className="block text-xs text-slate-700">{c.tipo} · {c.passos} {c.passos === 1 ? "passo" : "passos"}</span>
                <span className="block text-xs text-slate-700">Módulos: {c.modulos.length ? c.modulos.join(", ") : "nenhum indicado"} · Perfis de acesso: {c.perfis.length ? c.perfis.join(", ") : "nenhum indicado"}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      </div>
        );
      })}
      <div className="mt-3 flex flex-wrap gap-2">
        <BotaoEnviar variante="primario">Salvar escolhas da rodada</BotaoEnviar>
        <button type="button" onClick={() => setMarcados(new Set(cenarios.filter(visivel).map((c) => c.id).concat([...marcados])))} className={btn2 + " min-h-11"}>Marcar os que aparecem</button>
      </div>
    </form>
  );
}
