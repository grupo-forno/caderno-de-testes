import Link from "next/link";
import AdminBar from "@/components/AdminBar";
import { enderecoDoBanco } from "@/lib/db";

// Mostrada no lugar de uma página quando o banco ainda não tem as tabelas que ela usa (atualização do banco pendente).
export default function BancoDesatualizado({ cadernoId, pagina, faltando }: { cadernoId: string; pagina: string; faltando: string[] }) {
  return (
    <>
      <AdminBar />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/admin/${cadernoId}`} className="text-sm text-indigo-800 hover:underline">← Voltar ao caderno</Link>
        <h1 className="mt-2 text-balance text-2xl font-semibold">{pagina} ainda não pode abrir neste ambiente</h1>
        <p role="alert" className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          O banco de dados deste ambiente ainda não recebeu a atualização que cria o que esta página usa. Seus cadernos e respostas não foram alterados.
        </p>
        <h2 className="mt-5 text-base font-semibold">O que fazer (quem cuida do sistema)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
          <li>No computador onde o projeto está, com o endereço do banco deste ambiente configurado, rode <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run db:setup</code>.</li>
          <li>Recarregue esta página.</li>
        </ol>
        <p className="mt-4 text-sm text-slate-800">Tabelas que faltam: <span className="font-mono text-xs">{faltando.join(", ")}</span></p>
        <p className="mt-1 text-sm text-slate-800">Banco que este ambiente consulta: <span className="font-mono text-xs">{enderecoDoBanco()}</span></p>
        <p className="mt-1 text-xs text-slate-600">Se você já rodou a atualização e esta mensagem continua, ela foi aplicada em outro banco: confira se o endereço acima é o mesmo do banco que você atualizou.</p>
      </main>
    </>
  );
}
