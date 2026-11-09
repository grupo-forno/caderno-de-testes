"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { btn, btn2, campo } from "@/components/ui";

type Item = { nome: string; faz: string };
type Inicial = { titulo: string; imagem: string | null; link: string | null; pdf: string | null; itens: Item[] };

function Arquivo({ nome, rotulo, substantivo, accept, limiteMb, inicial }: { nome: string; rotulo: string; substantivo: string; accept: string; limiteMb: number; inicial: string | null }) {
  const [url, setUrl] = useState(inicial ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const ampliada = useRef<HTMLDialogElement>(null);
  const ehImagem = accept.startsWith("image");

  async function enviar(f: File) {
    setErro("");
    if (f.size > limiteMb * 1024 * 1024) {
      setErro(`Esse arquivo tem mais de ${limiteMb} MB. Reduza o tamanho e tente de novo.`);
      return;
    }
    setEnviando(true);
    try {
      const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload" });
      setUrl(b.url);
    } catch {
      setErro("Não conseguimos enviar o arquivo. Confira sua internet e tente de novo. Se continuar, avise quem cuida do sistema.");
    }
    setEnviando(false);
  }

  return (
    <div>
      <p className="text-sm font-medium">{rotulo}</p>
      <input type="hidden" name={nome} value={url} />
      <input
        ref={entrada}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.[0]) void enviar(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {url && ehImagem && (
        <>
          <button type="button" onClick={() => ampliada.current?.showModal()} aria-label="Ampliar a imagem" className="mt-2 block cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Imagem da tela enviada" className="max-h-56 rounded-md border border-slate-200" />
          </button>
          <dialog ref={ampliada} onClick={() => ampliada.current?.close()} className="m-auto max-h-[92vh] max-w-[92vw] rounded-lg p-2 backdrop:bg-black/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Imagem da tela ampliada" className="max-h-[88vh] max-w-full cursor-zoom-out" />
          </dialog>
        </>
      )}
      {url && !ehImagem && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-indigo-700 underline">Abrir o PDF enviado</a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {url ? (
          <>
            {ehImagem && <button type="button" onClick={() => ampliada.current?.showModal()} className={btn2}>Ampliar</button>}
            <button type="button" disabled={enviando} onClick={() => entrada.current?.click()} className={btn2}>Alterar {substantivo}</button>
            <button type="button" disabled={enviando} onClick={() => setUrl("")} className={btn2 + " text-rose-700"}>Excluir {substantivo}</button>
          </>
        ) : (
          <>
            <button type="button" disabled={enviando} onClick={() => entrada.current?.click()} className={btn}>Escolher {substantivo}</button>
            {!enviando && <span className="text-sm text-slate-500">Nenhum arquivo escolhido</span>}
          </>
        )}
        {enviando && <span className="text-sm text-slate-600">Enviando…</span>}
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-rose-700">{erro}</p>}
    </div>
  );
}

export default function TelaForm({ acao, inicial, erro }: { acao: (f: FormData) => void; inicial: Inicial; erro?: boolean }) {
  const [itens, setItens] = useState<Item[]>(inicial.itens.length ? inicial.itens : [{ nome: "", faz: "" }]);
  const [programada, setProgramada] = useState(!!inicial.link);
  const [pdfProprio, setPdfProprio] = useState(!!inicial.pdf);
  const mudar = (i: number, p: Partial<Item>) => setItens(itens.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <form action={acao} className="space-y-6">
      <label className="block text-sm font-medium">
        Nome da tela
        <input name="titulo" required defaultValue={inicial.titulo} placeholder="Ex.: Lista de cadastros" className={campo} />
      </label>
      {erro && <p role="alert" className="text-sm text-rose-700">Escreva o nome da tela.</p>}

      <fieldset>
        <legend className="text-sm font-medium">Tela programada?</legend>
        <div className="mt-2 flex gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="programada" checked={programada} onChange={() => setProgramada(true)} /> Sim</label>
          <label className="flex items-center gap-2"><input type="radio" name="programada" checked={!programada} onChange={() => setProgramada(false)} /> Não, é só desenho</label>
        </div>
        {programada && (
          <label className="mt-3 block text-sm font-medium">
            Link da tela programada
            <input name="link_url" type="url" required defaultValue={inicial.link ?? ""} placeholder="https://" className={campo} />
          </label>
        )}
      </fieldset>

      <Arquivo nome="imagem_url" rotulo="Imagem da tela (PNG, JPG ou WebP, até 10 MB)" substantivo="imagem" accept="image/png,image/jpeg,image/webp" limiteMb={10} inicial={inicial.imagem} />

      <fieldset>
        <legend className="text-sm font-medium">O que cada item da tela faz</legend>
        <p className="text-xs text-slate-600">
          Campo, botão ou qualquer elemento, e o que acontece quando a pessoa usa. Aparece para o cliente na página e é com isso que o PDF das funcionalidades é gerado sozinho.
        </p>
        <div className="mt-3 space-y-3">
          {itens.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_2fr_auto]">
              <input name="itemNome" value={it.nome} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Ex.: Botão Salvar" aria-label="Nome do item" className={campo + " mt-0"} />
              <input name="itemFaz" value={it.faz} onChange={(e) => mudar(i, { faz: e.target.value })} placeholder="Ex.: Grava o cadastro e volta para a lista" aria-label="O que faz" className={campo + " mt-0"} />
              <button type="button" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="text-sm text-slate-600 underline">Remover</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItens([...itens, { nome: "", faz: "" }])} className={btn2 + " mt-3"}>Adicionar item</button>
      </fieldset>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={pdfProprio} onChange={(e) => setPdfProprio(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="font-medium">Quero enviar um PDF meu</span>
            <span className="block text-xs text-slate-600">Sem marcar, o PDF é gerado automaticamente com a lista acima.</span>
          </span>
        </label>
        {pdfProprio && (
          <div className="mt-3">
            <Arquivo nome="pdf_url" rotulo="PDF das funcionalidades (até 20 MB)" substantivo="PDF" accept="application/pdf" limiteMb={20} inicial={inicial.pdf} />
          </div>
        )}
      </div>

      <button className={btn}>Salvar tela</button>
    </form>
  );
}
