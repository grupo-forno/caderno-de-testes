"use client";

import BotaoEnviar from "@/components/BotaoEnviar";
import { useId, useState } from "react";
import EditorPassos, { novoPassoEditavel, type PassoEditavel } from "@/components/EditorPassos";
import { campo } from "@/components/estilos";
import { MAX_PERFIL, ROTULO_TIPO, TIPOS, type PassoCenario, type TipoCenario } from "@/lib/cenarios";

type PassoLocal = PassoEditavel & { telaId: string | null; perfil: string };
export type TelaOpcao = { id: string; titulo: string; modulo: string };
export type InicialCenario = {
  titulo: string;
  objetivo: string;
  tipo: TipoCenario;
  preRequisitos: string;
  dadosTeste: string;
  telaId: string | null;
  passos: PassoCenario[];
  origemItem: string | null;
};

const MENSAGEM_ERRO: Record<string, string> = {
  titulo: "Escreva o título do cenário.",
  tipo: "Escolha o tipo de revisão.",
  passo: "Algum passo está incompleto. Cada passo precisa dos dois campos: “O que fazer” e “O que deve acontecer”. Preencha ou remova o passo.",
};

const novoPasso = (p?: Partial<PassoCenario>): PassoLocal => novoPassoEditavel({ telaId: null, perfil: "", ...p }) as PassoLocal;

export default function CenarioForm({ acao, inicial, telas, perfis, erro, textoAviso }: {
  acao: (f: FormData) => void;
  inicial: InicialCenario;
  telas: TelaOpcao[];
  perfis: string[]; // perfis já usados em outros cenários do caderno: sugestões
  erro?: string;
  textoAviso?: string;
}) {
  const [passos, setPassos] = useState<PassoLocal[]>(() => inicial.passos.map((p) => novoPasso(p)));
  const [telaPrincipal, setTelaPrincipal] = useState(inicial.telaId ?? "");
  const idPerfis = useId();
  const tela = (id: string | null) => telas.find((t) => t.id === (id || telaPrincipal));
  const rotuloTela = (t?: TelaOpcao) => (t ? `${t.modulo} › ${t.titulo}` : "");

  // grupos por módulo, para o seletor de tela
  const modulos = [...new Set(telas.map((t) => t.modulo))];
  const opcoes = (
    <>
      {modulos.map((m) => (
        <optgroup key={m} label={m}>
          {telas.filter((t) => t.modulo === m).map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
        </optgroup>
      ))}
    </>
  );

  return (
    <form action={acao} className="space-y-8">
      {inicial.origemItem && <input type="hidden" name="origem_item" value={inicial.origemItem} />}
      {textoAviso && <p role="status" className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-950">{textoAviso}</p>}
      {erro && MENSAGEM_ERRO[erro] && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{MENSAGEM_ERRO[erro]}</p>}

      <section aria-labelledby="t-dados" className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 id="t-dados" className="text-lg font-semibold">Dados do cenário</h2>
        <label className="block text-sm font-medium">
          Título <span className="font-normal text-slate-600">(obrigatório)</span>
          <input name="titulo" required maxLength={200} defaultValue={inicial.titulo} placeholder="Ex.: Solicitação de compra aprovada pelo Financeiro" className={campo} />
        </label>
        <label className="block text-sm font-medium">
          Objetivo
          <textarea name="objetivo" rows={2} maxLength={5000} defaultValue={inicial.objetivo} placeholder="O que este cenário garante que funciona" className={campo + " field-sizing-content resize-y"} />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Tipo de revisão</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {TIPOS.map((t) => (
              <label key={t} className="flex items-center gap-2">
                <input type="radio" name="tipo" value={t} defaultChecked={inicial.tipo === t} /> {ROTULO_TIPO[t]}
                <span className="text-xs text-slate-600">{t === "desenho" ? "(o validador confere a imagem)" : "(o validador testa a tela programada)"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          Tela principal (opcional, só para teste de uma tela)
          <select name="tela_id" value={telaPrincipal} onChange={(e) => setTelaPrincipal(e.target.value)} className={campo + " min-h-11"}>
            <option value="">Nenhuma: cada passo indica a sua tela</option>
            {opcoes}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-600">Para um cenário de uma tela só. Para um fluxo com várias telas (ex.: escolher a área, depois cadastrar o celular), deixe em branco e escolha a tela em cada passo, mais abaixo.</span>
        </label>
        <label className="block text-sm font-medium">
          Pré-requisitos
          <textarea name="pre_requisitos" rows={2} maxLength={5000} defaultValue={inicial.preRequisitos} placeholder="Ex.: Um usuário com perfil Comprador e outro com perfil Financeiro" className={campo + " field-sizing-content resize-y"} />
        </label>
        <label className="block text-sm font-medium">
          Dados de teste
          <textarea name="dados_teste" rows={2} maxLength={5000} defaultValue={inicial.dadosTeste} placeholder="Ex.: Fornecedor Teste Ltda, valor R$ 100,00" className={campo + " field-sizing-content resize-y"} />
        </label>
      </section>

      <section aria-labelledby="t-passos" className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 id="t-passos" className="text-lg font-semibold">Passos</h2>
        <p className="mt-1 text-sm text-slate-700">Na ordem em que acontecem. Cada passo pode estar em uma tela diferente: quando o fluxo muda de tela ou de pessoa, indique a tela e o perfil dentro do passo (campo “Tela deste passo”).</p>
        <input type="hidden" name="passos" value={JSON.stringify(passos.map(({ id, fazer, esperado, telaId, perfil }) => ({ id, fazer, esperado, telaId, perfil })))} />

        {passos.length > 0 ? (
          <ol aria-label="Resumo do fluxo" className="mt-3 flex flex-wrap gap-2 text-xs">
            {passos.map((p, n) => (
              <li key={p.k} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1">
                <span className="font-semibold">{n + 1}.</span> {p.perfil ? <strong>{p.perfil}</strong> : "Sem perfil"}
                {tela(p.telaId) && <span className="text-slate-700"> · {rotuloTela(tela(p.telaId))}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">Nenhum passo ainda. Clique em “Adicionar passo” para começar.</p>
        )}

        <datalist id={idPerfis}>{perfis.map((p) => <option key={p} value={p} />)}</datalist>
        <EditorPassos<PassoLocal>
          passos={passos}
          aoMudar={setPassos}
          novo={() => novoPasso()}
          cabecalho={(p) => (p.perfil ? <span className="font-normal text-slate-700"> · executa: <strong>{p.perfil}</strong></span> : null)}
          extra={(p, mudar) => (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-600">
                Perfil que executa
                <input list={idPerfis} maxLength={MAX_PERFIL} value={p.perfil} onChange={(e) => mudar({ perfil: e.target.value })} placeholder="Ex.: Comprador" className={campo + " text-slate-900"} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Tela deste passo
                <select value={p.telaId ?? ""} onChange={(e) => mudar({ telaId: e.target.value || null })} className={campo + " min-h-11 text-slate-900"}>
                  <option value="">{telaPrincipal ? "A tela principal" : "Nenhuma"}</option>
                  {opcoes}
                </select>
              </label>
            </div>
          )}
        />
      </section>

      <BotaoEnviar variante="primario">Salvar cenário</BotaoEnviar>
    </form>
  );
}
