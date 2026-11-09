"use client";

import { useState } from "react";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Props = {
  titulo: string;
  versao: string;
  preparadoPor: string;
  ambienteUrl: string | null;
  antesDeComecar: string[];
  contagem: { modulos: number; telas: number; funcionalidades: number; passos: number; semRoteiro: number; desenhos: number; programadas: number };
  progresso: { respondidos: number; comProblema: number; bloqueados: number; iniciou: boolean };
  linkParaContinuar: string | null;
  aoComecar: () => void;
  aoVerTelas: () => void;
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Primeira tela do validador: o que será validado e a ação principal
export default function Inicio({ titulo, versao, preparadoPor, ambienteUrl, antesDeComecar, contagem: c, progresso: p, linkParaContinuar, aoComecar, aoVerTelas }: Props) {
  const [copiado, setCopiado] = useState<"sim" | "nao" | null>(null);
  const temPassos = c.passos > 0;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkParaContinuar ?? "");
      setCopiado("sim");
    } catch {
      setCopiado("nao"); // o navegador não deixou: a pessoa copia o texto do campo
    }
  }

  return (
    <div>
      <h2 id="titulo-tela" tabIndex={-1} className="break-words text-balance text-2xl font-semibold focus:outline-none">Vamos validar este sistema</h2>
      <p className="mt-2 text-base text-slate-800">
        Você vai conferir se <strong>{titulo}</strong> (versão {versao}{preparadoPor ? `, preparado por ${preparadoPor}` : ""}) funciona como combinado.
        {temPassos ? " Em cada funcionalidade, siga o passo a passo e diga se o resultado foi o esperado." : " Em cada funcionalidade, leia o que ela faz e dê o seu resultado."}
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="O que será validado">
        {[
          [plural(c.modulos, "módulo", "módulos"), ""],
          [plural(c.telas, "tela ou pop-up", "telas e pop-ups"), c.desenhos || c.programadas ? `${c.programadas} programadas, ${c.desenhos} só desenho` : ""],
          [plural(c.funcionalidades, "funcionalidade", "funcionalidades"), c.semRoteiro ? `${c.semRoteiro} sem roteiro (você responde pela descrição)` : c.funcionalidades ? "todas com roteiro" : ""],
          [plural(c.passos, "passo", "passos"), temPassos ? "para responder" : "nenhum roteiro ainda"],
        ].map(([t, d]) => (
          <li key={t} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-lg font-semibold tabular-nums">{t}</p>
            {d && <p className="text-xs text-slate-700">{d}</p>}
          </li>
        ))}
      </ul>

      {c.desenhos > 0 && (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <strong>Telas “só desenho”</strong> ainda não existem em código: você confere pela imagem. As <strong>telas programadas</strong> têm um botão para abrir e testar de verdade.
        </p>
      )}

      <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        {p.iniciou && (
          <p className="text-sm text-indigo-950">
            {temPassos ? `Você já respondeu ${plural(p.respondidos, "passo", "passos")} de ${c.passos}.` : "Você já começou a responder."}
            {p.comProblema > 0 && ` ${plural(p.comProblema, "passo deu diferente", "passos deram diferente")}.`}
            {p.bloqueados > 0 && ` ${plural(p.bloqueados, "passo ficou bloqueado", "passos ficaram bloqueados")}.`} Suas respostas são salvas sozinhas.
          </p>
        )}
        <div className={`flex flex-wrap items-center gap-3 ${p.iniciou ? "mt-3" : ""}`}>
          <button type="button" onClick={aoComecar} className={`min-h-12 rounded-md bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 ${FOCO}`}>
            {p.iniciou ? "Continuar de onde parei" : "Começar teste"}
          </button>
          {ambienteUrl && (
            <a href={ambienteUrl} target="_blank" rel="noreferrer" className={`inline-flex min-h-12 items-center rounded-md border border-indigo-700 bg-white px-5 text-base font-medium text-indigo-900 hover:bg-indigo-100 ${FOCO}`}>
              Abrir ambiente de teste<span className="sr-only"> (abre em nova aba)</span>
            </a>
          )}
          <button type="button" onClick={aoVerTelas} className={`min-h-11 rounded-md px-3 text-sm font-medium text-indigo-800 underline ${FOCO}`}>Ver módulos e telas</button>
        </div>
        {ambienteUrl && <p className="mt-2 text-xs text-indigo-950">O ambiente de teste abre em outra aba. Volte aqui para responder.</p>}
      </div>

      {antesDeComecar.length > 0 && (
        <section className="mt-6" aria-labelledby="t-antes">
          <h3 id="t-antes" className="text-base font-semibold">Antes de começar, tenha à mão</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">{antesDeComecar.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="t-como">
        <h3 id="t-como" className="text-base font-semibold">Como responder cada passo</h3>
        <ul className="mt-1 space-y-1 text-sm text-slate-800">
          <li><strong>Funcionou:</strong> aconteceu o que o caderno esperava. Se quiser, deixe um comentário.</li>
          <li><strong>Deu diferente:</strong> aconteceu outra coisa. Conte o que viu e, se puder, cole ou anexe um print.</li>
          <li><strong>Não consegui testar:</strong> não deu para fazer o passo. Diga o motivo.</li>
        </ul>
        <p className="mt-2 text-sm text-slate-700">Um passo sem resposta ainda não foi testado. Um passo bloqueado é um que você tentou e não conseguiu fazer.</p>
      </section>

      {linkParaContinuar && (
        <details className="mt-6 rounded-lg border border-slate-200 bg-white">
          <summary className={`flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${FOCO}`}>Continuar em outro aparelho ou outro dia</summary>
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-800">
            <p>Guarde este link. Só quem tem o link consegue ver e mudar suas respostas e prints. Digitar o seu e-mail não basta.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="link-continuar">Link para continuar</label>
              <input id="link-continuar" readOnly value={linkParaContinuar} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-500 px-3 text-sm" />
              <button type="button" onClick={copiar} className={`min-h-11 rounded-md border border-slate-400 bg-white px-4 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>Copiar link</button>
            </div>
            <p role="status" className="mt-1 text-xs text-slate-700">
              {copiado === "sim" ? "Link copiado." : copiado === "nao" ? "Não deu para copiar sozinho: selecione o texto do campo e copie." : ""}
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
