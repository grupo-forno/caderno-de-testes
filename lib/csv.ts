// CSV simples e sem dependências (roda no servidor, no navegador e direto no node).
// Lê com separador ";" ou "," (detectado na primeira linha), aspas duplicadas, quebra de linha dentro de aspas e BOM.
// Escreve com ";" e BOM, que é o que o Excel em português abre sem estragar acentos.

export function parseCsv(entrada: string): string[][] {
  const t = entrada.replace(/^﻿/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const pontoVirgulas = (primeira.match(/;/g) ?? []).length;
  const virgulas = (primeira.match(/,/g) ?? []).length;
  // ponytail: a detecção olha só a primeira linha. Se os títulos tiverem vírgula entre aspas, use ";".
  const sep = pontoVirgulas > 0 && pontoVirgulas >= virgulas ? ";" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let cel = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cel += '"';
          i++;
        } else aspas = false;
      } else cel += c;
    } else if (c === '"' && cel === "") {
      aspas = true; // aspas só abrem no começo do campo
    } else if (c === sep) {
      linha.push(cel);
      cel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(cel);
      linhas.push(linha);
      linha = [];
      cel = "";
    } else cel += c;
  }
  if (cel !== "" || linha.length) {
    linha.push(cel);
    linhas.push(linha);
  }
  while (linhas.length && linhas[linhas.length - 1].every((x) => x.trim() === "")) linhas.pop();
  return linhas;
}

// Célula que começa com = + - @ ou tab seria lida como fórmula pelo Excel: ganha um apóstrofo na frente.
function celula(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsv(linhas: string[][]): string {
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}
