"use client";

import { useEffect, useRef, useState } from "react";
import LinkTela from "@/components/LinkTela";
import { ChipStatus } from "@/components/StatusBadge";
import { criterios, declaracaoTexto, faltaAlgo, type ContagemAceite } from "@/lib/aceiteRegras";
import { dataHora } from "@/lib/formatar";
import { type ResumoTela } from "@/lib/status";
import { ROTULO_SEVERIDADE, type Modulo, type Resp, type Tela } from "@/lib/tipos";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Props = {
  modulos: { modulo: Modulo; numero: string; resumo: ResumoTela; telas: { tela: Tela; numero: string }[] }[];
  resumos: Record<string, ResumoTela>;
  geral: ResumoTela;
  res: (id: string) => Resp;
  aoIr: (id: string) => void;
  pendentes: number; // respostas ainda sendo salvas
  falhas: number; // respostas que não conseguiram salvar
  bloqueado: boolean; // o servidor recusou uma gravação e a página precisa ser recarregada
  pessoa: { nome: string; email: string } | null;
  aceite: { nome: string; criado: string; token: string | null } | null;
  aoConcluir: () => Promise<string | null>; // devolve a mensagem de erro, ou null se deu certo
};

export default function Resumo({ modulos, resumos, geral, res, aoIr, pendentes, falhas, bloqueado, pessoa, aceite, aoConcluir }: Props) {
  // mesma conta que o servidor faz na hora de concluir (o servidor é quem decide de verdade)
  const contagem: ContagemAceite = { total: 0, ok: 0, naoOk: 0, naoTestado: 0, emPreparacao: 0, impedem: 0 };
  for (const m of modulos) {
    for (const { tela } of m.telas) {
      if (!tela.itens.length) {
        contagem.emPreparacao++;
        continue;
      }
      for (const i of tela.itens) {
        contagem.total++;
        const x = res(i.id);
        if (x.resultado === "ok") contagem.ok++;
        else if (x.resultado === "nao_ok") {
          contagem.naoOk++;
          if (x.severidade === null || x.severidade === "impede") contagem.impedem++;
        } else contagem.naoTestado++;
      }
    }
  }
  const atencao: { telaId: string; tela: string; item: string; obs: string; gravidade: string | null }[] = [];
  for (const m of modulos) {
    for (const { tela } of m.telas) {
      for (const i of tela.itens) {
        if (res(i.id).resultado === "nao_ok") { const sv = res(i.id).severidade; atencao.push({ telaId: tela.id, tela: tela.titulo, item: i.nome, obs: res(i.id).obs, gravidade: sv ? ROTULO_SEVERIDADE[sv] : null }); }
      }
    }
  }
  const tudoOk = geral.status === "finalizada";
  const semSalvar = falhas > 0 || bloqueado;

  return (
    <div>
      <h2 id="titulo-tela" tabIndex={-1} className="text-balance text-2xl font-semibold focus:outline-none">Resumo geral</h2>
      <p className="mt-1 text-sm text-slate-700">Veja como está cada módulo e cada tela antes de terminar.</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <dt className="text-sm font-medium text-emerald-900">OK</dt>
          <dd className="text-3xl font-semibold tabular-nums text-emerald-950">{geral.ok}</dd>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <dt className="text-sm font-medium text-rose-900">NÃO OK</dt>
          <dd className="text-3xl font-semibold tabular-nums text-rose-950">{geral.naoOk}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
          <dt className="text-sm font-medium text-slate-800">NÃO TESTADO</dt>
          <dd className="text-3xl font-semibold tabular-nums text-slate-900">{geral.naoTestado}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-700">Os números contam funcionalidades, não telas.</p>

      <p role="status" className={`mt-4 rounded-md px-3 py-2 text-sm ${pendentes === 0 && !semSalvar && tudoOk ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-800"}`}>
        {semSalvar
          ? "Não conseguimos salvar todas as respostas. Veja o aviso no topo da página e tente de novo antes de continuar."
          : pendentes > 0
            ? "Ainda há respostas sendo salvas. Espere um instante antes de fechar a página."
            : geral.total === 0
              ? "Ainda não há funcionalidades prontas para testar. Volte mais tarde."
              : tudoOk
                ? "Tudo está OK. Obrigado! Se quiser, salve uma cópia em PDF abaixo e avise quem preparou o caderno."
                : "Ainda há funcionalidades que não estão OK ou áreas em preparação. Você pode voltar depois e continuar com o mesmo link, sem perder nada."}
      </p>

      {modulos.map(({ modulo, numero, resumo, telas }) => (
        <section key={modulo.id} aria-labelledby={`rm-${modulo.id}`} className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id={`rm-${modulo.id}`} className="text-lg font-semibold">
              <span className="mr-2 text-slate-600">{numero}</span>
              {modulo.titulo}
            </h3>
            <div className="flex items-center gap-2">
              {resumo.total > 0 && <span className="text-xs tabular-nums text-slate-700">{resumo.ok} de {resumo.total} OK</span>}
              <ChipStatus status={resumo.status} />
              <LinkTela id={modulo.id} aoIr={aoIr} ariaLabel={`Abrir o módulo ${modulo.titulo}`} className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
                Abrir
              </LinkTela>
            </div>
          </div>
          {telas.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {telas.map(({ tela, numero: n }) => (
                <li key={tela.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${tela.paiId ? "pl-8 sm:pl-10" : ""}`}>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    <span className="mr-1 text-slate-600">{n}</span>
                    {tela.paiId && "Pop-up: "}
                    {tela.titulo}
                  </span>
                  {resumos[tela.id].status !== "em_preparacao" && <span className="text-xs tabular-nums text-slate-700">{resumos[tela.id].ok} de {resumos[tela.id].total} OK</span>}
                  <ChipStatus status={resumos[tela.id].status} />
                  <LinkTela id={tela.id} aoIr={aoIr} ariaLabel={`Abrir ${tela.paiId ? "o pop-up" : "a tela"} ${tela.titulo}`} className={`inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 text-sm font-medium hover:bg-slate-50 ${FOCO}`}>
                    Abrir
                  </LinkTela>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {atencao.length > 0 && (
        <>
          <h3 className="mt-8 text-lg font-semibold">O que você marcou como NÃO OK</h3>
          <ul className="mt-3 space-y-2">
            {atencao.map((a, k) => (
              <li key={k} className="rounded-lg border border-rose-200 bg-white p-3 text-sm">
                <p className="whitespace-pre-wrap font-medium">{a.item}</p>
                <p className="text-xs text-slate-700">na tela “{a.tela}”{a.gravidade && ` · ${a.gravidade}`}</p>
                {a.obs.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{a.obs}</p>
                ) : (
                  <p className="mt-1 text-rose-800">
                    Falta contar o que mudar.{" "}
                    <LinkTela id={a.telaId} aoIr={aoIr} ariaLabel={`Abrir a tela “${a.tela}” para escrever o que mudar em “${a.item}”`} className={`rounded font-medium underline ${FOCO}`}>Abrir a tela</LinkTela>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Concluir c={contagem} pessoa={pessoa} aceite={aceite} aoConcluir={aoConcluir} pendentes={pendentes} semSalvar={semSalvar} />

      <div className="mt-8 print:hidden">
        <button type="button" onClick={() => window.print()} className={`min-h-11 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 ${FOCO}`}>
          Imprimir ou salvar em PDF
        </button>
      </div>
    </div>
  );
}

function Concluir({ c, pessoa, aceite, aoConcluir, pendentes, semSalvar }: { c: ContagemAceite; pessoa: Props["pessoa"]; aceite: Props["aceite"]; aoConcluir: Props["aoConcluir"]; pendentes: number; semSalvar: boolean }) {
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);
  const euConclui = useRef(false);
  const cs = criterios(c);
  const falta = faltaAlgo(cs);

  // depois de concluir, o botão some: o foco vai para o título do bloco novo
  useEffect(() => {
    if (aceite && euConclui.current) {
      euConclui.current = false;
      titulo.current?.focus();
    }
  }, [aceite]);

  // o botão fica "desabilitado" só por aria-disabled (continua focável) e a frase abaixo explica o motivo
  const motivo = enviando
    ? "Concluindo… aguarde."
    : !ciente
      ? "Marque “Estou ciente” para concluir."
      : pendentes > 0
        ? "Espere as respostas terminarem de ser salvas para concluir."
        : semSalvar
          ? "Há respostas que não foram salvas. Resolva o aviso no topo da página para concluir."
          : "";

  async function concluir() {
    if (motivo) return;
    setEnviando(true);
    setErro(null);
    euConclui.current = true; // antes: a tela troca de bloco assim que o servidor aceitar
    const e = await aoConcluir();
    setEnviando(false);
    if (e) {
      euConclui.current = false;
      setErro(e);
      return;
    }
    setAnuncio("Homologação concluída.");
  }

  return (
    <div>
      {/* região de anúncio sempre presente: só o texto muda */}
      <p role="status" className="sr-only">{anuncio}</p>

      {aceite ? (
        <section aria-labelledby="titulo-aceite" className="mt-8 rounded-lg border border-emerald-300 bg-emerald-50 p-4 sm:p-5 print:hidden">
          <h3 id="titulo-aceite" ref={titulo} tabIndex={-1} className="text-lg font-semibold text-emerald-950 focus:outline-none">Homologação concluída</h3>
          <p className="mt-1 text-sm text-emerald-950">Concluída por {aceite.nome} em {dataHora(aceite.criado)}. O caderno está só para leitura.</p>
          {aceite.token && (
            <a href={`/api/aceite/${aceite.token}/pdf`} target="_blank" rel="noreferrer" className={`mt-3 inline-flex min-h-11 items-center rounded-md border border-emerald-700 bg-white px-4 text-sm font-medium text-emerald-950 hover:bg-emerald-100 ${FOCO}`}>
              Baixar termo de aceite (PDF)<span className="sr-only"> (abre em nova aba)</span>
            </a>
          )}
        </section>
      ) : pessoa ? (
        <section aria-labelledby="titulo-aceite" className="mt-8 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 print:hidden">
          <h3 id="titulo-aceite" className="text-lg font-semibold">Concluir a homologação</h3>
          <p className="mt-1 text-sm text-slate-700">Quando terminar, conclua para registrar a sua aprovação. Depois disso o caderno fica só para leitura.</p>

          <ul className="mt-3 space-y-1.5 text-sm">
            {cs.map((x) => (
              <li key={x.texto} className={`flex items-start gap-2 ${x.ok ? "text-emerald-900" : "text-rose-900"}`}>
                <span aria-hidden="true" className="font-bold">{x.ok ? "✓" : "✗"}</span>
                <span className="sr-only">{x.ok ? "Ok:" : "Falta:"}</span>
                <span>{x.texto}</span>
              </li>
            ))}
          </ul>
          {c.naoTestado + c.emPreparacao > 0 && (
            <p className="mt-2 text-sm text-slate-700">
              Ficaram {c.naoTestado} {c.naoTestado === 1 ? "funcionalidade não testada" : "funcionalidades não testadas"} e {c.emPreparacao} {c.emPreparacao === 1 ? "área" : "áreas"} em preparação. Você pode concluir mesmo assim, ciente disso.
            </p>
          )}

          {falta ? (
            <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">Ainda não dá para concluir. Resolva os itens marcados como Falta.</p>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p><span className="font-semibold">Nome:</span> {pessoa.nome}</p>
              <p><span className="font-semibold">E-mail:</span> {pessoa.email}</p>
              <p className="mt-1 text-xs text-slate-700">O e-mail é só uma declaração: o sistema não confere se ele é seu.</p>
              <blockquote className="mt-3 border-l-4 border-slate-400 pl-3 text-slate-900">{declaracaoTexto(c)}</blockquote>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 font-medium">
                <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="h-5 w-5" />
                Estou ciente <span className="font-normal text-slate-700">(obrigatório)</span>
              </label>
              <button
                type="button"
                aria-disabled={!!motivo}
                aria-describedby="motivo-concluir"
                onClick={concluir}
                className={`mt-3 min-h-11 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-emerald-700 ${FOCO}`}
              >
                {enviando ? "Concluindo…" : "Concluir homologação"}
              </button>
              <p id="motivo-concluir" className="mt-2 text-slate-700">{motivo}</p>
              <p role="alert" className="mt-2 text-rose-800">{erro}</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
