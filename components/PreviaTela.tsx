"use client";

import { useState, type ReactNode } from "react";
import { Eye, ListChecks } from "lucide-react";
import Aviso from "@/components/Aviso";
import EstadoVazio from "@/components/EstadoVazio";
import Etiqueta from "@/components/Etiqueta";
import Execucao, { idPasso, type PassoFila } from "@/components/Execucao";
import { botao } from "@/components/estilos";
import type { Modo } from "@/lib/acesso";
import type { Tela } from "@/lib/tipos";

export type ItemPrevia = { id: string; nome: string; faz: string; imagem?: string; passos: { id: string; fazer: string; esperado: string }[] };

// Prévia interna: a tela que está sendo preparada, do jeito que o validador a lê (a mesma apresentação da execução real).
// Só leitura: não existe resposta, validação nem evidência aqui. Não é o link que vai para o cliente.
export default function PreviaTela({ tela, moduloTitulo, paiTitulo, ambienteUrl, itens, sujo, acaoSalvar, aoPreparar }: {
  tela: { id: string; titulo: string; imagem: string | null; link: string | null; caminho: string; modo: Modo; pdf: string | null };
  moduloTitulo: string;
  paiTitulo: string | null;
  ambienteUrl: string | null;
  itens: ItemPrevia[];
  sujo: boolean; // há alterações ainda não salvas (a prévia já mostra as alterações)
  acaoSalvar: ReactNode;
  aoPreparar: () => void; // leva à aba de funcionalidades
}) {
  const [pos, setPos] = useState(0);
  const modulo = { id: "m", titulo: moduloTitulo || "Sem módulo" };
  const t: Tela = { id: tela.id, moduloId: "m", titulo: tela.titulo || "Tela sem nome", imagem: tela.imagem, link: tela.link, pdf: tela.pdf, itens: [], paiId: paiTitulo ? "pai" : null, caminho: tela.caminho, modo: tela.modo };
  const fila: PassoFila[] = [];
  for (const item of itens) {
    item.passos.forEach((passo, n) => fila.push({ passo, indice: n + 1, total: item.passos.length, item: { id: item.id, nome: item.nome, faz: item.faz, imagem: item.imagem, passos: item.passos }, tela: t, numeroTela: "1", modulo, numeroModulo: "1", paiTitulo }));
  }
  const semRoteiro = itens.filter((i) => !i.passos.length);
  const atual = fila[Math.min(pos, fila.length - 1)];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta tom="info" icone={Eye}>Prévia interna</Etiqueta>
        <p className="text-sm text-slate-800">Somente leitura. Nada aqui cria respostas, validações ou evidências, e este não é o link do cliente.</p>
      </div>
      {sujo && (
        <Aviso tom="alerta" className="mt-3" titulo="Esta prévia inclui alterações ainda não salvas." acoes={acaoSalvar}>
          O validador só vê estas mudanças depois que você salvar.
        </Aviso>
      )}

      {semRoteiro.length > 0 && (
        <Aviso tom="alerta" className="mt-3" titulo={`${semRoteiro.length === 1 ? "Uma funcionalidade está" : `${semRoteiro.length} funcionalidades estão`} sem roteiro`} acoes={<button type="button" onClick={aoPreparar} className={botao("secundario")}><ListChecks aria-hidden="true" />Escrever os passos</button>}>
          Sem passos, o validador só vê a descrição e responde OK, NÃO OK ou NÃO TESTADO: {semRoteiro.map((i) => i.nome || "Sem nome").join(", ")}.
        </Aviso>
      )}

      {fila.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio icone={ListChecks} titulo="Ainda não há passos para o validador ler." acao={<button type="button" onClick={aoPreparar} className={botao("primario")}><ListChecks aria-hidden="true" />Ir para funcionalidades e testes</button>}>
            Escreva o roteiro de pelo menos uma funcionalidade e a prévia mostra a execução completa.
          </EstadoVazio>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <Execucao
            key={atual.passo.id}
            previa
            atual={atual}
            fila={fila}
            posicao={fila.indexOf(atual)}
            resp={{}}
            chave=""
            slug=""
            somenteLeitura={false}
            semLinkTela
            salvamento={{ texto: "", tipo: "ok" }}
            aoMudar={() => {}}
            aoIr={(id) => {
              const i = fila.findIndex((f) => idPasso(f.passo.id) === id);
              if (i >= 0) setPos(i);
            }}
            aoSair={() => {}}
            ambienteUrl={ambienteUrl}
          />
        </div>
      )}
    </div>
  );
}
