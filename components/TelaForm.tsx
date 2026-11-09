"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { btn, btn2, campo } from "@/components/estilos";

type Passo = { id?: string; fazer: string; esperado: string };
type PassoLocal = Passo & { k: number };
type Item = { id?: string; nome: string; faz: string; imagem?: string; passos?: Passo[] };
// k só serve para o React não misturar os itens (e os passos) ao remover um
type ItemLocal = Omit<Item, "passos"> & { k: number; passos: PassoLocal[] };
type Inicial = { titulo: string; imagem: string | null; link: string | null; pdf: string | null; itens: Item[]; paiId: string | null; moduloId: string };

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
            <img src={url} alt="Imagem enviada" className="max-h-56 rounded-md border border-slate-200" />
          </button>
          <dialog ref={ampliada} onClick={() => ampliada.current?.close()} className="m-auto max-h-[92vh] max-w-[92vw] rounded-lg p-2 backdrop:bg-black/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Imagem ampliada" className="max-h-[88vh] max-w-full cursor-zoom-out" />
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

let proxK = 0;
const novoPasso = (p?: Passo): PassoLocal => ({ fazer: "", esperado: "", ...p, k: proxK++ });
const novoItem = (i?: Item): ItemLocal => ({ nome: "", faz: "", ...i, passos: (i?.passos ?? []).map((p) => novoPasso(p)), k: proxK++ });

const MENSAGEM_ERRO: Record<string, string> = {
  titulo: "Escreva o nome da tela.",
  pai: "Não foi possível ligar este pop-up à tela escolhida. Escolha outra tela principal.",
  modulo: "Escolha o módulo da tela. Se ainda não existe nenhum, volte ao caderno e crie os módulos primeiro.",
  passo: "Algum passo do roteiro está incompleto. Cada passo precisa dos dois campos: “O que fazer” e “O que deve acontecer”. Preencha ou remova o passo.",
  url: "Um dos endereços não é aceito. O link da tela deve começar com https:// e as imagens e PDFs devem ser enviados pelo botão “Escolher”, não colados.",
};

export default function TelaForm({
  acao, inicial, erro, principais, temFilhos, modulos,
}: {
  acao: (f: FormData) => void;
  inicial: Inicial;
  erro?: string;
  principais: { id: string; titulo: string }[];
  temFilhos: boolean;
  modulos: { id: string; titulo: string }[];
}) {
  const [modulo, setModulo] = useState(inicial.moduloId || modulos[0]?.id || "");
  const [itens, setItens] = useState<ItemLocal[]>(() => (inicial.itens.length ? inicial.itens.map((i) => novoItem(i)) : [novoItem()]));
  const [ehPopup, setEhPopup] = useState(!!inicial.paiId);
  const [pai, setPai] = useState(inicial.paiId ?? principais[0]?.id ?? "");
  const [programada, setProgramada] = useState(!!inicial.link);
  const [pdfProprio, setPdfProprio] = useState(!!inicial.pdf);
  const mudar = (k: number, p: Partial<ItemLocal>) => setItens(itens.map((x) => (x.k === k ? { ...x, ...p } : x)));
  const mudarPasso = (k: number, pk: number, p: Partial<Passo>) => setItens(itens.map((x) => (x.k === k ? { ...x, passos: x.passos.map((s) => (s.k === pk ? { ...s, ...p } : s)) } : x)));
  const moverPasso = (k: number, de: number, dir: -1 | 1) =>
    setItens(itens.map((x) => {
      const para = de + dir;
      if (x.k !== k || para < 0 || para >= x.passos.length) return x;
      const l = [...x.passos];
      [l[de], l[para]] = [l[para], l[de]];
      return { ...x, passos: l };
    }));
  const podeSerPopup = !temFilhos && principais.length > 0;

  return (
    <form action={acao} className="space-y-6">
      <label className="block text-sm font-medium">
        Nome da tela
        <input name="titulo" required defaultValue={inicial.titulo} placeholder="Ex.: Lista de cadastros" className={campo} />
      </label>
      {erro && MENSAGEM_ERRO[erro] && <p role="alert" className="text-sm text-rose-700">{MENSAGEM_ERRO[erro]}</p>}

      {!ehPopup && (
        <label className="block text-sm font-medium">
          Em qual módulo está esta tela?
          <select name="modulo_id" required value={modulo} onChange={(e) => setModulo(e.target.value)} className={campo + " min-h-11"}>
            {modulos.length === 0 && <option value="">Nenhum módulo criado ainda</option>}
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
          </select>
        </label>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Que tipo de tela é essa?</legend>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="tipo" checked={!ehPopup} onChange={() => setEhPopup(false)} /> Tela principal</label>
          <label className={`flex items-center gap-2 ${podeSerPopup ? "" : "text-slate-400"}`}>
            <input type="radio" name="tipo" checked={ehPopup} disabled={!podeSerPopup} onChange={() => setEhPopup(true)} /> Pop-up ou janela que abre dentro de outra tela
          </label>
          {!podeSerPopup && (
            <p className="text-xs text-slate-500">
              {temFilhos ? "Esta tela já tem pop-ups, por isso não pode ser pop-up de outra." : "Crie primeiro uma tela principal para poder ligar um pop-up a ela."}
            </p>
          )}
        </div>
        {ehPopup && (
          <label className="mt-3 block text-sm font-medium">
            Abre dentro de qual tela?
            <select name="pai_id" required value={pai} onChange={(e) => setPai(e.target.value)} className={campo}>
              {principais.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-600">O pop-up fica no mesmo módulo da tela escolhida e aparece junto dela, para o cliente ver que um pertence ao outro.</span>
          </label>
        )}
      </fieldset>

      {!ehPopup && (
        <fieldset>
          <legend className="text-sm font-medium">Esta tela já existe em código?</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="programada" checked={programada} onChange={() => setProgramada(true)} /> Sim, está programada (o validador testa de verdade)</label>
            <label className="flex items-center gap-2"><input type="radio" name="programada" checked={!programada} onChange={() => setProgramada(false)} /> Não, é só um desenho (o validador revisa a imagem)</label>
          </div>
          {programada && (
            <label className="mt-3 block text-sm font-medium">
              Link da tela programada
              <input name="link_url" type="url" required defaultValue={inicial.link ?? ""} placeholder="https://" className={campo} />
            </label>
          )}
        </fieldset>
      )}

      <Arquivo nome="imagem_url" rotulo={ehPopup ? "Imagem do pop-up (PNG, JPG ou WebP, até 10 MB)" : "Imagem da tela (PNG, JPG ou WebP, até 10 MB)"} substantivo="imagem" accept="image/png,image/jpeg,image/webp" limiteMb={10} inicial={inicial.imagem} />

      <fieldset>
        <legend className="text-sm font-medium">O que cada item da tela faz</legend>
        <p className="text-xs text-slate-600">
          Cada item é uma funcionalidade (campo, botão, área...) e o que acontece quando a pessoa usa. A descrição serve de referência. Para a pessoa conseguir testar sozinha, escreva também o roteiro de teste, passo a passo; ela responde cada passo e o resultado da funcionalidade é calculado sozinho. É com esta lista que o PDF das funcionalidades é gerado. Se um item abre um pop-up ou muda a tela, dá para juntar uma imagem a ele. Pode deixar a lista vazia por enquanto: a tela aparece no menu como “Em preparação” até você cadastrar as funcionalidades.
        </p>
        <div className="mt-3 space-y-3">
          {itens.map((it) => (
            <div key={it.k} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_2fr_auto]">
              <input type="hidden" name="itemId" value={it.id ?? ""} />
              <label className="block text-xs font-medium text-slate-600">
                Item (botão, campo, área…)
                <textarea name="itemNome" rows={2} value={it.nome} onChange={(e) => mudar(it.k, { nome: e.target.value })} placeholder="Ex.: Botão Salvar, Campo Nome, Área de filtros" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                O que faz (descrição de referência)
                <textarea name="itemFaz" rows={2} value={it.faz} onChange={(e) => mudar(it.k, { faz: e.target.value })} placeholder="Ex.: Grava o cadastro e volta para a lista" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
              </label>
              <button type="button" onClick={() => setItens(itens.filter((x) => x.k !== it.k))} className="self-start text-sm text-slate-600 underline sm:mt-5">Remover</button>
              <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-3">
                <legend className="px-1 text-sm font-semibold">Roteiro de teste</legend>
                <input type="hidden" name="itemPassos" value={JSON.stringify(it.passos.map(({ id, fazer, esperado }) => ({ id, fazer, esperado })))} />
                <p className="text-xs text-slate-600">Passo a passo para outra pessoa testar sozinha. Cada passo diz o que fazer e o que ela deve ver acontecer.</p>
                {it.passos.length === 0 && (
                  <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <strong>Falta escrever o roteiro detalhado.</strong> Sem passos, o validador só vê a descrição acima e responde OK, NÃO OK ou NÃO TESTADO como antes.
                  </p>
                )}
                <ol className="mt-3 space-y-3">
                  {it.passos.map((p, n) => (
                    <li key={p.k} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Passo {n + 1}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" disabled={n === 0} onClick={() => moverPasso(it.k, n, -1)} aria-label={`Subir o passo ${n + 1}`} className={btn2 + " min-h-11 px-3 disabled:opacity-30"}>↑</button>
                          <button type="button" disabled={n === it.passos.length - 1} onClick={() => moverPasso(it.k, n, 1)} aria-label={`Descer o passo ${n + 1}`} className={btn2 + " min-h-11 px-3 disabled:opacity-30"}>↓</button>
                          <button type="button" onClick={() => mudar(it.k, { passos: it.passos.filter((s) => s.k !== p.k) })} className="min-h-11 px-2 text-sm text-slate-600 underline">Remover<span className="sr-only"> o passo {n + 1}</span></button>
                        </div>
                      </div>
                      <label className="mt-2 block text-xs font-medium text-slate-600">
                        O que fazer <span className="font-normal">(obrigatório)</span>
                        <textarea required rows={2} maxLength={2000} value={p.fazer} onChange={(e) => mudarPasso(it.k, p.k, { fazer: e.target.value })} placeholder="Ex.: Clique em Novo cadastro, preencha o nome e clique em Salvar" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
                      </label>
                      <label className="mt-2 block text-xs font-medium text-slate-600">
                        O que deve acontecer <span className="font-normal">(obrigatório)</span>
                        <textarea required rows={2} maxLength={2000} value={p.esperado} onChange={(e) => mudarPasso(it.k, p.k, { esperado: e.target.value })} placeholder="Ex.: A tela volta para a lista e o novo cadastro aparece no topo" className={campo + " field-sizing-content min-h-14 resize-y text-slate-900"} />
                      </label>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={() => mudar(it.k, { passos: [...it.passos, novoPasso()] })} className={btn2 + " mt-3 min-h-11"}>Adicionar passo</button>
              </fieldset>
              <div className="sm:col-span-3">
                <Arquivo nome="itemImagem" rotulo="Imagem deste item (opcional)" substantivo="imagem" accept="image/png,image/jpeg,image/webp" limiteMb={10} inicial={it.imagem ?? null} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItens([...itens, novoItem()])} className={btn2 + " mt-3"}>Adicionar item</button>
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
