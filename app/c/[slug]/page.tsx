import { notFound } from "next/navigation";
import Caderno from "@/components/Caderno";
import { buscarCaderno } from "@/lib/dados";

export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const r = await buscarCaderno(slug);
  if (!r) notFound();
  return <Caderno caderno={r.caderno} slug={slug} />;
}
