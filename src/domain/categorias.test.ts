import type { Categoria, CategoriaCartao } from './types';
import { compararCategorias, compararCategoriasCartao } from './categorias';

const ts = { criadoEm: '2026-07-10T12:00:00.000Z', alteradoEm: '2026-07-10T12:00:00.000Z' };

const salario: Categoria = { id: 'sal', boxId: 'b', nome: 'salário', tipo: 'ganho', ordem: 2, arquivada: false, ...ts };
const aluguel: Categoria = { id: 'alu', boxId: 'b', nome: 'aluguel', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const mercado: Categoria = { id: 'mer', boxId: 'b', nome: 'mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...ts };
const pix: Categoria = { id: 'pix', boxId: 'b', nome: 'pix', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };

it('ganhos vêm antes de gastos, mesmo com ordem maior', () => {
  expect([mercado, salario].sort(compararCategorias).map((c) => c.id)).toEqual(['sal', 'mer']);
});

it('dentro do mesmo tipo, ordena pela ordem definida', () => {
  expect([mercado, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'mer']);
});

it('empate de ordem desempata por nome', () => {
  expect([pix, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'pix']);
});

const catsCartao: CategoriaCartao[] = [
  { id: 'c1', cartaoId: 'k', nome: 'streaming', ordem: 1, arquivada: false, ...ts },
  { id: 'c2', cartaoId: 'k', nome: 'mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'c3', cartaoId: 'k', nome: 'farmácia', ordem: 0, arquivada: false, ...ts },
];

it('categorias de cartão: ordem, depois nome', () => {
  expect([...catsCartao].sort(compararCategoriasCartao).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
});
