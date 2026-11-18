import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// O app não usa window.confirm, alert nem prompt: a confirmação é o ConfirmarSheet e o aviso
// é o Retorno (docs/estilo/interacao.md). Este teste impede que voltem.
const RAIZ = path.resolve('src');
const DIALOGO = /(?<![.\w])(?:window\.)?(confirm|alert|prompt)\s*\(/;

function fontes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

it('nenhum arquivo de src/ abre diálogo nativo do navegador', () => {
  const achados = fontes(RAIZ).flatMap((arquivo) =>
    fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)
      .map((linha, i) => ({ linha, n: i + 1 }))
      .filter(({ linha }) => DIALOGO.test(linha) && !linha.trim().startsWith('//') && !linha.trim().startsWith('*'))
      .map(({ n }) => `${path.relative(RAIZ, arquivo)}:${n}`));

  expect(achados).toEqual([]);
});

it('a expressão pega as três formas e não pega nomes parecidos', () => {
  expect(DIALOGO.test("if (!window.confirm('x')) return;")).toBe(true);
  expect(DIALOGO.test("alert('x')")).toBe(true);
  expect(DIALOGO.test('const r = prompt("x")')).toBe(true);
  expect(DIALOGO.test('await repo.confirmarPendente(id)')).toBe(false);
  expect(DIALOGO.test('function confirmar() {')).toBe(false);
  expect(DIALOGO.test('onConfirmar()')).toBe(false);
});
