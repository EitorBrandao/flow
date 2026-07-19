import { parseChangelog } from './changelog';

const EXEMPLO = `# Changelog

texto introdutório qualquer.

## [0.2.0] - 2026-07-05

### Adicionado

- item novo A
- item novo B

### Removido

- item removido

## [0.1.0] - 2026-07-03

### Adicionado

- primeira versão
`;

it('agrupa versões em ordem, com data e seções', () => {
  const versoes = parseChangelog(EXEMPLO);
  expect(versoes).toHaveLength(2);
  expect(versoes[0].versao).toBe('0.2.0');
  expect(versoes[0].data).toBe('2026-07-05');
  expect(versoes[1].versao).toBe('0.1.0');
});

it('separa itens por seção dentro da mesma versão', () => {
  const [v020] = parseChangelog(EXEMPLO);
  expect(v020.secoes).toEqual([
    { titulo: 'Adicionado', itens: ['item novo A', 'item novo B'] },
    { titulo: 'Removido', itens: ['item removido'] },
  ]);
});

it('ignora texto fora de versão/seção', () => {
  const versoes = parseChangelog('texto solto\n- item órfão\n');
  expect(versoes).toEqual([]);
});

it('junta linhas de continuação de um item que quebrou no markdown', () => {
  const comQuebra = `## [0.3.0] - 2026-07-19

### Alterado

- primeira linha do item
  segunda linha do mesmo item
  terceira linha do mesmo item.
- item seguinte, numa linha só
`;
  const [v030] = parseChangelog(comQuebra);
  expect(v030.secoes[0].itens).toEqual([
    'primeira linha do item segunda linha do mesmo item terceira linha do mesmo item.',
    'item seguinte, numa linha só',
  ]);
});

it('lida com quebras de linha CRLF (Windows)', () => {
  const crlf = EXEMPLO.replace(/\n/g, '\r\n');
  const versoes = parseChangelog(crlf);
  expect(versoes).toHaveLength(2);
  expect(versoes[0].versao).toBe('0.2.0');
  expect(versoes[0].data).toBe('2026-07-05');
  expect(versoes[0].secoes[0].itens).toEqual(['item novo A', 'item novo B']);
});
