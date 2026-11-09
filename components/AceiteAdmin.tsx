import { reabrirHomologacao } from "@/app/admin/aceite-actions";
import { Confirmar } from "@/components/ui";
import { sql } from "@/lib/db";
import { dataHora } from "@/lib/formatar";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const link = `inline-flex min-h-11 items-center text-sm text-indigo-800 underline ${FOCO}`;

const ERROS: Record<string, string> = {
  motivo: "Escreva o motivo da reabertura (pelo menos 5 letras).",
  aceite: "Essa homologação já tinha sido reaberta. Recarregue a página e confira.",
};

// Caixa no topo do caderno: a homologação foi concluída? por quem? reabrir exige motivo.
export default async function AceiteAdmin({ cadernoId, slug, erro, reaberta }: { cadernoId: string; slug: string; erro?: string; reaberta?: boolean }) {
  const aceites = await sql`
    select token, nome, email, hash, criado, reaberto_em, reaberto_por, reaberto_motivo
    from aceites where caderno = ${slug} order by criado desc`;
  const vigente = aceites.find((a) => !a.reaberto_em);
  const antigos = aceites.filter((a) => a.reaberto_em);

  return (
    <section aria-labelledby="titulo-homologacao" className={`mt-6 rounded-lg border p-5 ${vigente ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <h2 id="titulo-homologacao" className="font-semibold">Aceite da homologação</h2>
      {reaberta && <p role="status" className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-emerald-900">Homologação reaberta. O cliente já pode mudar as respostas de novo.</p>}
      {erro && ERROS[erro] && <p role="alert" className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">{ERROS[erro]}</p>}

      {vigente ? (
        <>
          <p className="mt-1 text-sm text-emerald-950">
            Homologação <strong>concluída</strong> por {vigente.nome} ({vigente.email}) em {dataHora(vigente.criado)}. O caderno está só para leitura para o cliente.
          </p>
          <p className="mt-1 text-xs text-slate-700">Código de verificação: {String(vigente.hash).slice(0, 8)}</p>
          <a href={`/api/aceite/${vigente.token}/pdf`} target="_blank" rel="noreferrer" className={link}>
            Baixar o termo de aceite (PDF)<span className="sr-only"> (abre em nova aba)</span>
          </a>
          <form action={reabrirHomologacao.bind(null, cadernoId)} className="mt-3 border-t border-emerald-200 pt-3">
            <label className="block text-sm font-medium">
              Motivo da reabertura <span className="font-normal text-slate-700">(obrigatório)</span>
              <textarea name="motivo" required minLength={5} maxLength={1000} rows={2} className="mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600" />
            </label>
            <div className="mt-2">
              <Confirmar texto="Reabrir a homologação? O cliente poderá mudar as respostas de novo. O motivo fica registrado no histórico.">Reabrir homologação</Confirmar>
            </div>
          </form>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-700">Homologação ainda não concluída. Quando o cliente concluir, o nome, a data e o termo aparecem aqui.</p>
      )}

      {antigos.length > 0 && (
        <details className="mt-3 rounded-md border border-slate-200 bg-white">
          <summary className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium ${FOCO}`}>Aceites anteriores, já reabertos ({antigos.length})</summary>
          <ul className="space-y-2 border-t border-slate-200 px-3 py-2 text-sm">
            {antigos.map((a) => (
              <li key={a.token}>
                {a.nome} concluiu em {dataHora(a.criado)}. Reaberto em {dataHora(a.reaberto_em)} por {a.reaberto_por ?? "Equipe"}. Motivo: {a.reaberto_motivo}{" "}
                <a href={`/api/aceite/${a.token}/pdf`} target="_blank" rel="noreferrer" className={link}>Termo (PDF)<span className="sr-only"> (abre em nova aba)</span></a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
