"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { ArrowLeft, BookOpen, ClipboardCheck, LayoutDashboard, LayoutList, ListChecks, LogOut, Menu, Pencil, X } from "lucide-react";
import { sair } from "@/app/admin/actions";
import BotaoEnviar from "@/components/BotaoEnviar";
import { botaoIcone, FOCO } from "@/components/estilos";

type Destino = { rotulo: string; href: string; icone: ReactNode; ativo: boolean };

// Navegação do caderno aberto: nome no topo, caminho de volta para a lista, áreas de trabalho e, separado, a administração do caderno.
function Navegacao({ cadernoId, nome, aoNavegar }: { cadernoId: string; nome: string; aoNavegar?: () => void }) {
  const p = usePathname();
  const base = `/admin/${cadernoId}`;
  const em = (...prefixos: string[]) => prefixos.some((x) => p.startsWith(`${base}${x}`));
  const trabalho: Destino[] = [
    { rotulo: "Visão geral", href: base, icone: <LayoutDashboard />, ativo: p === base || em("/respostas", "/historico") },
    { rotulo: "Estrutura", href: `${base}/estrutura`, icone: <LayoutList />, ativo: em("/estrutura", "/tela", "/importar") },
    { rotulo: "Fluxos entre telas", href: `${base}/biblioteca`, icone: <ListChecks />, ativo: em("/biblioteca") },
    { rotulo: "Homologações", href: `${base}/rodadas`, icone: <ClipboardCheck />, ativo: em("/rodadas") },
  ];
  const admin: Destino[] = [{ rotulo: "Editar caderno", href: `${base}/editar`, icone: <Pencil />, ativo: em("/editar") }];

  const item = (d: Destino) => (
    <li key={d.href}>
      <Link
        href={d.href}
        onClick={aoNavegar}
        aria-current={d.ativo ? "page" : undefined}
        className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm lg:min-h-9 [&>svg]:size-4 [&>svg]:shrink-0 ${FOCO} ${d.ativo ? "bg-indigo-50 font-semibold text-indigo-900 [&>svg]:text-indigo-700" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 [&>svg]:text-slate-500"}`}
      >
        {d.icone}
        {d.rotulo}
      </Link>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <Link href="/admin" onClick={aoNavegar} className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 lg:min-h-8 [&>svg]:size-3.5 ${FOCO}`}>
          <ArrowLeft aria-hidden="true" />
          Seus cadernos
        </Link>
        <div className="mt-2 flex items-start gap-2 px-1.5 pb-3">
          <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-700" />
          <div className="min-w-0">
            <p className="text-xs text-slate-600">Caderno</p>
            <p className="break-words text-sm font-semibold leading-snug">{nome}</p>
          </div>
        </div>
      </div>
      <nav aria-label="Áreas do caderno" className="flex-1 overflow-y-auto border-t border-slate-200 px-3 py-3">
        <p className="px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-slate-600">Trabalho</p>
        <ul className="space-y-0.5">{trabalho.map(item)}</ul>
        <p className="mt-5 px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-slate-600">Administração</p>
        <ul className="space-y-0.5">{admin.map(item)}</ul>
      </nav>
      <div className="border-t border-slate-200 px-3 py-2">
        <form action={sair}>
          <BotaoEnviar variante="discreto" pendente="Saindo…" className="w-full justify-start">
            <LogOut aria-hidden="true" />
            Sair
          </BotaoEnviar>
        </form>
      </div>
    </div>
  );
}

// Menu fixo no desktop (224 px). Em largura estreita vira um painel que abre pelo botão do topo.
export default function ShellCaderno({ cadernoId, nome, children }: { cadernoId: string; nome: string; children: ReactNode }) {
  const painel = useRef<HTMLDialogElement>(null);
  return (
    <div className="min-h-screen lg:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-2 focus:outline-indigo-600">Ir para o conteúdo</a>
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen">
        <Navegacao cadernoId={cadernoId} nome={nome} />
      </aside>

      <div id="conteudo" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-1.5 lg:hidden">
          <button type="button" onClick={() => painel.current?.showModal()} aria-label="Abrir o menu do caderno" aria-haspopup="dialog" title="Menu" className={botaoIcone("secundario")}>
            <Menu aria-hidden="true" />
          </button>
          <p className="min-w-0 truncate text-sm font-semibold">{nome}</p>
        </div>
        <dialog ref={painel} aria-label="Menu do caderno" onClick={(e) => { if (e.target === painel.current) painel.current?.close(); }} className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-72 max-w-[85vw] overscroll-contain border-r border-slate-200 bg-white p-0 backdrop:bg-slate-900/50 lg:hidden">
          <div className="flex h-full flex-col">
            <div className="flex justify-end px-3 pt-2">
              <button type="button" onClick={() => painel.current?.close()} aria-label="Fechar o menu" title="Fechar" className={botaoIcone("discreto")}>
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Navegacao cadernoId={cadernoId} nome={nome} aoNavegar={() => painel.current?.close()} />
            </div>
          </div>
        </dialog>
        {children}
      </div>
    </div>
  );
}
