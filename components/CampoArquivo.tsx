"use client";

import { useId, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ExternalLink, FileText, ImagePlus, Maximize2, RefreshCw, Trash2, Upload } from "lucide-react";
import Dialogo from "@/components/Dialogo";
import { botao } from "@/components/estilos";

const TIPOS = { imagem: { accept: "image/png,image/jpeg,image/webp", formatos: "PNG, JPG ou WebP", substantivo: "imagem" }, pdf: { accept: "application/pdf", formatos: "PDF", substantivo: "PDF" } } as const;

const nomeDaUrl = (u: string) => {
  try {
    return decodeURIComponent(new URL(u).pathname.split("/").pop() ?? "");
  } catch {
    return u;
  }
};

// Área de arquivo da tela, da funcionalidade ou do PDF: selecionar, miniatura inteira (sem cortar), nome, ampliar, substituir e remover.
// O valor é a URL no armazenamento (controlada por quem usa). Se o envio de uma troca falhar, o arquivo anterior continua.
export default function CampoArquivo({ nome, rotulo, ajuda, tipo = "imagem", limiteMb, valor, aoMudar, descricaoAlt }: {
  nome: string; // nome do campo escondido que vai no formulário
  rotulo: string;
  ajuda?: string;
  tipo?: "imagem" | "pdf";
  limiteMb: number;
  valor: string;
  aoMudar: (url: string) => void;
  descricaoAlt?: string;
}) {
  const id = useId();
  const cfg = TIPOS[tipo];
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<{ arquivo: string; pct: number } | null>(null);
  const [erro, setErro] = useState("");
  const [nomeEscolhido, setNomeEscolhido] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function enviar(f: File) {
    setErro("");
    if (tipo === "imagem" && !["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setErro(`“${f.name}” não é aceito. Use ${cfg.formatos}.`);
    if (tipo === "pdf" && f.type !== "application/pdf") return setErro(`“${f.name}” não é um PDF.`);
    if (f.size > limiteMb * 1024 * 1024) return setErro(`“${f.name}” tem mais de ${limiteMb} MB. Reduza o tamanho e tente de novo.${valor ? ` O ${cfg.substantivo} anterior foi mantido.` : ""}`);
    setEnviando({ arquivo: f.name, pct: 0 });
    try {
      const b = await upload(f.name, f, { access: "public", handleUploadUrl: "/api/upload", onUploadProgress: (p) => setEnviando({ arquivo: f.name, pct: Math.round(p.percentage) }) });
      aoMudar(b.url);
      setNomeEscolhido(f.name);
    } catch {
      setErro(`Não conseguimos enviar “${f.name}”. Confira sua internet e tente de novo.${valor ? ` O ${cfg.substantivo} anterior foi mantido.` : ""}`);
    }
    setEnviando(null);
  }

  const escolher = () => entrada.current?.click();
  const Icone = tipo === "imagem" ? ImagePlus : FileText;

  return (
    <div>
      <p id={`${id}-r`} className="text-sm font-medium">{rotulo}</p>
      {ajuda && <p className="mt-0.5 text-xs text-slate-700">{ajuda}</p>}
      <input type="hidden" name={nome} value={valor} />
      <input
        ref={entrada}
        id={`${id}-arquivo`}
        type="file"
        accept={cfg.accept}
        aria-labelledby={`${id}-r`}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.[0]) void enviar(e.target.files[0]);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files?.[0]) void enviar(e.dataTransfer.files[0]); }}
        className={`mt-2 rounded-lg border border-dashed p-3 ${arrastando ? "border-indigo-600 bg-indigo-50" : "border-slate-300 bg-slate-50"}`}
      >
        {valor ? (
          <div className="flex flex-wrap items-start gap-4">
            {tipo === "imagem" ? (
              <button type="button" onClick={() => setAmpliada(true)} aria-label={`Ampliar ${descricaoAlt ?? "a imagem"}`} title="Ampliar" className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={valor} alt={descricaoAlt ?? "Imagem de referência"} className="h-32 w-48 rounded-md border border-slate-200 bg-white object-contain" />
              </button>
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600"><FileText aria-hidden="true" className="size-6" /></span>
            )}
            <div className="min-w-0 flex-1 basis-56">
              <p className="break-all text-sm font-medium">{nomeEscolhido ?? nomeDaUrl(valor)}</p>
              <p className="text-xs text-slate-700">{enviando ? "Enviando a nova versão…" : nomeEscolhido ? "Enviado agora. Salve para guardar." : "Arquivo salvo."}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tipo === "imagem" ? (
                  <button type="button" onClick={() => setAmpliada(true)} className={botao("secundario")}>
                    <Maximize2 aria-hidden="true" />
                    Ampliar
                  </button>
                ) : (
                  <a href={valor} target="_blank" rel="noreferrer" className={botao("secundario")}>
                    <ExternalLink aria-hidden="true" />
                    Abrir PDF<span className="sr-only"> (abre em nova aba)</span>
                  </a>
                )}
                <button type="button" disabled={!!enviando} onClick={escolher} className={botao("secundario")}>
                  <RefreshCw aria-hidden="true" />
                  Substituir
                </button>
                <button type="button" disabled={!!enviando} onClick={() => { aoMudar(""); setNomeEscolhido(null); setErro(""); }} aria-label={`Remover ${cfg.substantivo}`} className={botao("destrutivo")}>
                  <Trash2 aria-hidden="true" />
                  Remover
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Icone aria-hidden="true" className="size-8 shrink-0 text-slate-500" />
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm text-slate-800">Nenhum arquivo escolhido.</p>
              <p className="text-xs text-slate-700">{cfg.formatos}, até {limiteMb} MB. Você também pode arrastar o arquivo para cá.</p>
            </div>
            <button type="button" disabled={!!enviando} onClick={escolher} className={botao("secundario")}>
              <Upload aria-hidden="true" />
              Selecionar {cfg.substantivo}
            </button>
          </div>
        )}

        {enviando && (
          <div className="mt-3" role="status">
            <p className="text-xs text-slate-800">Enviando “{enviando.arquivo}”… {enviando.pct}%</p>
            <progress value={enviando.pct} max={100} className="mt-1 h-2 w-full overflow-hidden rounded-full accent-indigo-600" aria-label="Progresso do envio" />
          </div>
        )}
        {erro && <p role="alert" className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">{erro}</p>}
      </div>

      {tipo === "imagem" && (
        <Dialogo aberto={ampliada} aoFechar={() => setAmpliada(false)} titulo={descricaoAlt ?? "Imagem de referência"} largo>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt={descricaoAlt ?? "Imagem de referência ampliada"} className="mx-auto max-h-[75vh] max-w-full object-contain" />
        </Dialogo>
      )}
    </div>
  );
}
