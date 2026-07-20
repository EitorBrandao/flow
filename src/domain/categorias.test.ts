import type { Categoria, CategoriaCartao } from './types';
import { compararCategorias, compararCategoriasCartao, diffOrdem, proximaOrdem } from './categorias';

const ts = { criadoEm: '2026-07-10T12:00:00.000Z', alteradoEm: '2026-07-10T12:00:00.000Z' };

const salario: Categoria = { id: 'sal', boxId: 'b', nome: 'salário', tipo: 'ganho', ordem: 2, arquivada: false, ...ts };
const aluguel: Categoria = { id: 'alu', boxId: 'b', nome: 'aluguel', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const mercado: Categoria = { id: 'mer', boxId: 'b', nome: 'mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...ts };
const pix: Categoria = { id: 'pix', boxId: 'b', nome: 'pix', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const salarioArquivado: Categoria = { id: 'sal-arq', boxId: 'b', nome: 'salário antigo', tipo: 'ganho', ordem: 0, arquivada: true, ...ts };
const aluguelArquivado: Categoria = { id: 'alu-arq', boxId: 'b', nome: 'aluguel antigo', tipo: 'gasto', ordem: 0, arquivada: true, ...ts };

it('ganhos vêm antes de gastos, mesmo com ordem maior', () => {
  expect([mercado, salario].sort(compararCategorias).map((c) => c.id)).toEqual(['sal', 'mer']);
});

it('dentro do mesmo tipo, ordena pela ordem definida', () => {
  expect([mercado, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'mer']);
});

it('empate de ordem desempata por nome', () => {
  expect([pix, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'pix']);
});

it('arquivadas vêm sempre por último, mesmo com ordem menor que as ativas', () => {
  expect([salarioArquivado, mercado].sort(compararCategorias).map((c) => c.id)).toEqual(['mer', 'sal-arq']);
});

it('arquivadas de tipos diferentes se misturam na mesma seção, por ordem e depois nome', () => {
  expect([salarioArquivado, aluguelArquivado].sort(compararCategorias).map((c) => c.id)).toEqual(['alu-arq', 'sal-arq']);
});

const catsCartao: CategoriaCartao[] = [
  { id: 'c1', cartaoId: 'k', nome: 'streaming', ordem: 1, arquivada: false, ...ts },
  { id: 'c2', cartaoId: 'k', nome: 'mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'c3', cartaoId: 'k', nome: 'farmácia', ordem: 0, arquivada: false, ...ts },
];
const catCartaoArquivada: CategoriaCartao = { id: 'c4', cartaoId: 'k', nome: 'antiga', ordem: 0, arquivada: true, ...ts };

it('categorias de cartão: ordem, depois nome', () => {
  expect([...catsCartao].sort(compararCategoriasCartao).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
});

it('categorias de cartão arquivadas vêm sempre por último', () => {
  expect([catCartaoArquivada, ...catsCartao].sort(compararCategoriasCartao).map((c) => c.id))
    .toEqual(['c3', 'c2', 'c1', 'c4']);
});

it('proximaOrdem: grupo vazio começa em 0', () => {
  expect(proximaOrdem([])).toBe(0);
});

it('proximaOrdem: continua depois do maior ordem existente no grupo', () => {
  expect(proximaOrdem([{ ordem: 3 }, { ordem: 1 }])).toBe(4);
});

it('diffOrdem: nenhuma mudança quando a ordem já bate com o índice', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([]);
});

it('diffOrdem: recalcula só os itens que mudaram de posição', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'c', ordem: 2 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([{ id: 'c', ordem: 1 }, { id: 'b', ordem: 2 }]);
});
