// Aparece enquanto o banco responde (a primeira abertura do dia pode demorar alguns segundos)
export default function Carregando() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <p role="status" className="text-sm text-slate-700">Carregando…</p>
    </main>
  );
}
