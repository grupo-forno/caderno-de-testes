import { ehAdmin } from "@/lib/admin";
import { gerarCsv } from "@/lib/csv";

// Planilha de exemplo para a autora preencher. Cada linha é UMA funcionalidade.
export async function GET() {
  if (!(await ehAdmin())) return new Response("Entre como autora para baixar o modelo.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const csv = gerarCsv([
    ["Módulo", "Tela", "Pop-up de", "Funcionalidade", "O que faz"],
    ["Financeiro", "Relatório de pedidos", "", "Aplicar filtros", "Gera o relatório com os filtros escolhidos."],
    ["Financeiro", "Resumo de entregas", "Relatório de pedidos", "Botão Exportar resumo", "Baixa o resumo dos entregadores em planilha."],
    ["RH", "Funcionários", "", "", ""],
    ["Compras", "", "", "", ""],
  ]);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modelo-importacao.csv"', "Cache-Control": "no-store" },
  });
}
