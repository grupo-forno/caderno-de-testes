import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { sair } from "@/app/admin/actions";

export default function AdminBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 px-4 py-3">
        <Link href="/admin" className="font-semibold">Caderno de testes</Link>
        <AdminNav />
        <form action={sair}><button className="text-sm text-slate-600 hover:underline">Sair</button></form>
      </div>
    </div>
  );
}
