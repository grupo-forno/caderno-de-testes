"use client";

import { useRef } from "react";

// Imagem que amplia ao clicar (ou com Enter). Fecha com o botão, com um clique ou com Esc.
// As imagens carregam só quando aparecem na tela, menos a principal (prioridade).
export default function Imagem({ src, alt, className, prioridade = false }: { src: string; alt: string; className: string; prioridade?: boolean }) {
  const janela = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => janela.current?.showModal()} aria-label={`Ampliar: ${alt}`} className="block cursor-zoom-in rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} loading={prioridade ? "eager" : "lazy"} decoding="async" />
      </button>
      <dialog ref={janela} onClick={() => janela.current?.close()} aria-label={alt} className="m-auto max-h-[92vh] max-w-[92vw] overscroll-contain rounded-lg p-2 backdrop:bg-black/70">
        <button type="button" autoFocus onClick={() => janela.current?.close()} className="mb-2 min-h-11 rounded-md border border-slate-400 bg-white px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          Fechar imagem
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[80vh] max-w-full cursor-zoom-out" decoding="async" />
      </dialog>
    </>
  );
}
