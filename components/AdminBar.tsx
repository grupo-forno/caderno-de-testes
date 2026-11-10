import Link from "next/link";
import { LogOut } from "lucide-react";
import AdminNav from "@/components/AdminNav";
import BotaoEnviar from "@/components/BotaoEnviar";
import { FOCO } from "@/components/estilos";
import { sair } from "@/app/admin/actions";

export default function AdminBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/admin" className={`rounded px-1 py-2 font-semibold ${FOCO}`}>Caderno de testes</Link>
        <AdminNav />
        <form action={sair}>
          <BotaoEnviar variante="discreto" pendente="Saindo…">
            <LogOut aria-hidden="true" />
            Sair
          </BotaoEnviar>
        </form>
      </div>
    </div>
  );
}
