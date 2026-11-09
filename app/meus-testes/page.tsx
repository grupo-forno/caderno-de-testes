import MeusTestesAoVivo from "@/components/MeusTestes";

export const metadata = { title: "Meus testes", robots: { index: false, follow: false } };

// Entrada do validador: o link de acesso é /meus-testes#k=<convite>. A tela busca só o que foi atribuído a essa pessoa.
export default function Page() {
  return <MeusTestesAoVivo />;
}
