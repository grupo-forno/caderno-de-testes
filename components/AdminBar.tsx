import Link from "next/link";
import { sair } from "@/app/admin/actions";

export default function AdminBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="font-semibold">Caderno de testes</Link>
        <form action={sair}><button className="text-sm text-slate-600 hover:underline">Sair</button></form>
      </div>
    </div>
  );
}
