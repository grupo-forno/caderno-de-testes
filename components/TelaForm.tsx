"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { btn, btn2, campo } from "@/components/ui";

type Item = { nome: string; faz: string };
type Inicial = { titulo: string; imagem: string | null; link: string | null; pdf: string | null; itens: Item[] };

function Arquivo({ nome, rotulo, accept, limiteMb, inicial }: { nome: string; rotulo: string; accept: string; limiteMb: number; inicial: string | null }) {
  const [url, setUrl] = useState(inicial ?? "");
  const [estado, setEstado] = useState<"" | "enviando">("");
  const [erro, setErro] = useState("");

  async function enviar(f: File) {
    setErro("");
    if (f.size > limiteMb * 1024 * 1024) {
      setErro(`Esse arquivo tem mais de ${limiteMb} MB. Reduza o tamanho e tente de novo.`);
      return;
    }
    setEstado("enviando");
    try {
      const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload" });
      setUrl(b.url);
    } catch {
      setErro("Não conseguimos enviar o arquivo. Confira sua internet e tente de novo. Se continuar, avise quem cuida do sistema.");
    }
    setEstado("");
  }

  return (
    <div>
      <p className="text-sm font-medium">{rotulo}</p>
      <input type="hidden" name={nome} value={url} />
      {url && accept.startsWith("image") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 max-h-48 rounded-md border border-slate-200" />
      )}
      {url && !accept.startsWith("image") && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-indigo-700 underline">Abrir PDF enviado</a>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="file" accept={accept} onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} className="text-sm" />
        {url && <button type="button" onClick={() => setUrl("")} className="text-sm text-slate-600 underline">Remover</button>}
      </div>
      {estado && <p className="mt-1 text-sm text-slate-600">Enviando…</p>}
      {erro && <p role="alert" className="mt-1 text-sm text-rose-700">{erro}</p>}
    </div>
  );
}

export default function TelaForm({ acao, inicial, erro }: { acao: (f: FormData) => void; inicial: Inicial; erro?: boolean }) {
  const [itens, setItens] = useState<Item[]>(inicial.itens.length ? inicial.itens : [{ nome: "", faz: "" }]);
  const mudar = (i: number, p: Partial<Item>) => setItens(itens.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <form action={acao} className="space-y-6">
      <label className="block text-sm font-medium">
        Nome da tela
        <input name="titulo" required defaultValue={inicial.titulo} placeholder="Ex.: Lista de cadastros" className={campo} />
      </label>
      {erro && <p role="alert" className="text-sm text-rose-700">Escreva o nome da tela.</p>}

      <Arquivo nome="imagem_url" rotulo="Imagem da tela (PNG, JPG ou WebP, até 10 MB)" accept="image/png,image/jpeg,image/webp" limiteMb={10} inicial={inicial.imagem} />

      <label className="block text-sm font-medium">
        Link da tela programada (deixe vazio enquanto for só desenho)
        <input name="link_url" type="url" defaultValue={inicial.link ?? ""} placeholder="https://" className={campo} />
      </label>

      <Arquivo nome="pdf_url" rotulo="PDF das funcionalidades (até 20 MB)" accept="application/pdf" limiteMb={20} inicial={inicial.pdf} />

      <fieldset>
        <legend className="text-sm font-medium">O que cada item da tela faz</legend>
        <p className="text-xs text-slate-600">Campo, botão ou qualquer elemento, e o que acontece quando a pessoa usa. Aparece para o cliente na página.</p>
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

      <button className={btn}>Salvar tela</button>
    </form>
  );
}
