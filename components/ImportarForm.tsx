"use client";

import { useActionState, useState } from "react";
import { confirmarImportacao, verificarImportacao } from "@/app/admin/importar-actions";
import { btn, btn2 } from "@/components/ui";
import { ESTADO_INICIAL, type Resumo } from "@/lib/importacao";

const MAX_BYTES = 1_000_000;
const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function Previa({ r }: { r: Resumo }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <p className="font-semibold">A planilha está certa. Veja o que vai acontecer:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          Módulos: {plural(r.modulosNovos, "novo", "novos")}
          {r.modulosExistentes > 0 && `, ${plural(r.modulosExistentes, "já existe", "já existem")}`}.
        </li>
        <li>
          Telas: {plural(r.telasNovas, "nova", "novas")}
          {r.telasExistentes > 0 && `, ${plural(r.telasExistentes, "já existe", "já existem")}`}.
        </li>
        <li>
          Pop-ups: {plural(r.popupsNovos, "novo", "novos")}
          {r.popupsExistentes > 0 && `, ${plural(r.popupsExistentes, "já existe", "já existem")}`}.
        </li>
        <li>
          Funcionalidades: {plural(r.funcsNovas, "nova", "novas")}
          {r.funcsIgnoradas > 0 && `, ${plural(r.funcsIgnoradas, "ignorada porque já existe", "ignoradas porque já existem")}`}.
        </li>
      </ul>
      <p className="mt-2">Nada que já existe é apagado ou alterado, e as respostas dos clientes continuam como estão.</p>
    </div>
  );
}

export default function ImportarForm({ cadernoId }: { cadernoId: string }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [nota, setNota] = useState(""); // aviso que não é erro (ex.: arquivo lido como Windows-1252)
  const [ver, verAcao, verPendente] = useActionState(verificarImportacao.bind(null, cadernoId), ESTADO_INICIAL);
  const [conf, confAcao, confPendente] = useActionState(confirmarImportacao.bind(null, cadernoId), ESTADO_INICIAL);
  const ocupado = verPendente || confPendente;

  // mostra o resultado mais recente: da verificação ou da tentativa de importar
  const estado = conf.quando > ver.quando ? conf : ver;
  // o navegador troca as quebras de linha por CRLF ao enviar o formulário: compara sem essa diferença
  const normaliza = (s: string) => s.replace(/\r\n?/g, "\n");
  const igual = (a: string, b: string) => normaliza(a) === normaliza(b);
  const podeImportar = ver.fase === "previa" && igual(ver.textoVerificado, texto) && conf.quando <= ver.quando;
  // a gravação falhou depois de uma verificação certa: o caminho é verificar de novo e importar
  const erroGravacao = conf.fase === "erro" && conf.quando > ver.quando;

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setAviso("Esse arquivo passou de 1 MB. Divida em duas planilhas e importe uma de cada vez.");
      return;
    }
    try {
      // Excel em português costuma salvar CSV em Windows-1252; se não for UTF-8 válido, lê assim para não estragar os acentos
      const buf = await f.arrayBuffer();
      let lido: string;
      let comoWindows = false;
      try {
        lido = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        lido = new TextDecoder("windows-1252").decode(buf);
        comoWindows = true;
      }
      setAviso("");
      setNota(comoWindows ? "Lemos o arquivo como Windows-1252; confira os acentos antes de verificar." : "");
      setTexto(lido);
    } catch {
      setNota("");
      setAviso("Não conseguimos ler esse arquivo. Salve de novo como CSV e tente outra vez.");
    }
  }

  return (
    <form action={verAcao} className="space-y-4">
      <div>
        <label htmlFor="arquivo" className="text-sm font-medium">Escolha o arquivo da planilha (.csv)</label>
        <input id="arquivo" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={aoEscolher} className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-slate-400 file:bg-white file:px-4 file:text-sm file:font-medium" />
        <div role="alert">{aviso && <p className="mt-2 text-sm text-rose-800">{aviso}</p>}</div>
        <div role="status">{nota && <p className="mt-2 text-sm text-slate-800">{nota}</p>}</div>
      </div>

      <div>
        <label htmlFor="texto" className="text-sm font-medium">Ou cole o texto da planilha aqui (dá para corrigir antes de verificar)</label>
        <textarea
          id="texto"
          name="texto"
          rows={10}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Módulo;Tela;Pop-up de;Funcionalidade;O que faz\nFinanceiro;Relatório de pedidos;;Aplicar filtros;Gera o relatório"}
          className="mt-2 w-full resize-y rounded-md border border-slate-500 px-3 py-2 font-mono text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <p className="mt-1 text-xs text-slate-700">{texto.length > 0 ? `${new TextEncoder().encode(texto).length.toLocaleString("pt-BR")} de 1.000.000 letras e símbolos` : "Limite de 1 MB e 2.000 linhas."}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={ocupado || !texto.trim()} className={`${erroGravacao ? btn : btn2} min-h-11 disabled:opacity-50 ${FOCO}`}>
          {verPendente ? "Verificando…" : "Verificar planilha"}
        </button>
        {podeImportar && (
          <button type="submit" formAction={confAcao} disabled={ocupado} className={`${btn} min-h-11 disabled:opacity-50 ${FOCO}`}>
            {confPendente ? "Importando…" : "Importar agora"}
          </button>
        )}
      </div>

      <div aria-live="polite" className="space-y-3">
        {estado.fase === "previa" && estado.resumo && <Previa r={estado.resumo} />}
        {estado.fase === "previa" && !podeImportar && !igual(ver.textoVerificado, texto) && (
          <p className="text-sm text-slate-800">O texto mudou depois da verificação. Clique em “Verificar planilha” de novo para poder importar.</p>
        )}
        {estado.fase === "erro" && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            <p className="font-semibold">{estado.mensagem}</p>
            {erroGravacao && <p className="mt-2">Clique em Verificar planilha e tente importar de novo.</p>}
            {estado.erros.length > 0 && (
              <>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {estado.erros.map((e, k) => <li key={k}>{e}</li>)}
                </ul>
                {estado.totalErros > estado.erros.length && (
                  <p className="mt-2">Mostramos os {estado.erros.length} primeiros de {estado.totalErros} problemas. Corrija estes e verifique de novo para ver os próximos.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
