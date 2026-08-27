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
    {
      titulo: 'Adicionado',
      itens: [
        { texto: 'item novo A', detalhes: [] },
        { texto: 'item novo B', detalhes: [] },
      ],
    },
    {
      titulo: 'Removido',
      itens: [{ texto: 'item removido', detalhes: [] }],
    },
  ]);
});

it('ignora texto fora de versão/seção', () => {
  const versoes = parseChangelog('texto solto\n- item órfão\n');
  expect(versoes).toEqual([]);
});

it('junta linhas de continuação de um tópico sem detalhe', () => {
  const comQuebra = `## [0.3.0] - 2026-07-19

### Alterado

- primeira linha do item
  segunda linha do mesmo item
  terceira linha do mesmo item.
- item seguinte, numa linha só
`;
  const [v030] = parseChangelog(comQuebra);
  expect(v030.secoes[0].itens).toEqual([
    {
      texto: 'primeira linha do item segunda linha do mesmo item terceira linha do mesmo item.',
      detalhes: [],
    },
    { texto: 'item seguinte, numa linha só', detalhes: [] },
  ]);
});

it('lida com quebras de linha CRLF (Windows)', () => {
  const crlf = EXEMPLO.replace(/\n/g, '\r\n');
  const versoes = parseChangelog(crlf);
  expect(versoes).toHaveLength(2);
  expect(versoes[0].versao).toBe('0.2.0');
  expect(versoes[0].data).toBe('2026-07-05');
  expect(versoes[0].secoes[0].itens).toEqual([
    { texto: 'item novo A', detalhes: [] },
    { texto: 'item novo B', detalhes: [] },
  ]);
});

it('reconhece detalhe indentado com exatamente 2 espaços sob um tópico', () => {
  const comDetalhe = `## [0.4.0] - 2026-07-20

### Adicionado

- Tópico principal.
  - Primeiro detalhe.
  - Segundo detalhe.
- Tópico sem detalhe.
`;
  const [v040] = parseChangelog(comDetalhe);
  expect(v040.secoes[0].itens).toEqual([
    { texto: 'Tópico principal.', detalhes: ['Primeiro detalhe.', 'Segundo detalhe.'] },
    { texto: 'Tópico sem detalhe.', detalhes: [] },
  ]);
});

it('junta continuação de linha no último detalhe, não no texto do tópico', () => {
  const comDetalheQuebrado = `## [0.5.0] - 2026-07-21

### Alterado

- Tópico.
  - Detalhe que quebrou
    numa segunda linha.
`;
  const [v050] = parseChangelog(comDetalheQuebrado);
  expect(v050.secoes[0].itens).toEqual([
    { texto: 'Tópico.', detalhes: ['Detalhe que quebrou numa segunda linha.'] },
  ]);
});
