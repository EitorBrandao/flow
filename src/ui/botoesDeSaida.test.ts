// src/ui/botoesDeSaida.test.ts
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// Regra 9 de docs/estilo/interacao.md: Fechar e Cancelar têm contorno (.botao-discreto).
// As exceções são painéis em que "Fechar" é a única ação, e por isso a principal.
const RAIZ = path.resolve('src/ui');
const EXCECOES = new Set([
  'TelaHoje.tsx:botao botao-primario',
  'TransferirEntreBoxes.tsx:botao botao-primario',
  // Cancelar sozinho na linha, sem ação principal ao lado: fica como está.
  'EscanearComprovanteSheet.tsx:botao',
  // Cancelar sozinho na linha (o de baixo, do sheet, divide a linha com "Continuar").
  'EscanearNotaSheet.tsx:botao',
]);

function fontes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx') ? [caminho] : [];
  });
}

it('todo botão Fechar ou Cancelar usa .botao-discreto, salvo as exceções declaradas', () => {
  const fora: string[] = [];
  for (const arquivo of fontes(RAIZ)) {
    const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
    linhas.forEach((linha, i) => {
      const m = linha.match(/className="([^"]*)".*?[^=]>(?:Fechar|Cancelar)<\/button>/);
      if (!m || m[1].includes('botao-discreto')) return;
      if (EXCECOES.has(`${path.basename(arquivo)}:${m[1]}`)) return;
      fora.push(`${path.relative(RAIZ, arquivo)}:${i + 1}`);
    });
  }
  expect(fora).toEqual([]);
});
