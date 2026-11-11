"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import BotaoEnviar from "@/components/BotaoEnviar";
import Dialogo from "@/components/Dialogo";
import { botao, campo } from "@/components/estilos";

// "Nova rodada": pede o nome (e a versão) antes de criar, em vez de criar uma rodada sem nome
export default function NovaRodada({ acao, versao }: { acao: (f: FormData) => void; versao: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-haspopup="dialog" className={botao("primario")}>
        <Plus aria-hidden="true" />Nova rodada
      </button>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Nova rodada">
        <form action={acao} className="space-y-4">
          <label className="block text-sm font-medium">
            Nome da rodada <span className="font-normal text-slate-600">(obrigatório)</span>
            <input name="nome" required autoFocus maxLength={200} placeholder="Ex.: Entrega 1: cadastro do atendente" className={campo + " min-h-11"} />
            <span className="mt-1 block text-xs font-normal text-slate-600">É o nome que você e os validadores veem. Dá para mudar depois, enquanto a rodada for rascunho.</span>
          </label>
          <label className="block text-sm font-medium">
            Versão
            <input name="versao" required maxLength={60} defaultValue={versao} className={campo + " min-h-11"} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className={botao("secundario")}>Cancelar</button>
            <BotaoEnviar pendente="Criando…">Criar rodada</BotaoEnviar>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
