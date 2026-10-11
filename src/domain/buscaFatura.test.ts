import { describe, expect, it } from 'vitest';
import { itemFaturaBate } from './buscaFatura';
import type { Fatura } from './fatura';

type Item = Fatura['itens'][number];
const item: Item = {
  compraId: 'c1', parcela: 3, totalParcelas: 4, data: '2026-10-02', valorCent: 7834,
  categoriaCartaoId: 'k1', descricao: 'Sorveteria Alvo',
} as Item;
const nomeCat = (id: string) => (id === 'k1' ? 'Mercado' : '?');

describe('itemFaturaBate', () => {
  it('casa por descrição, sem diferenciar caixa', () => {
    expect(itemFaturaBate(item, 'sorveteria', nomeCat)).toBe(true);
    expect(itemFaturaBate(item, 'alvo', nomeCat)).toBe(true);
  });
  it('casa por categoria do cartão', () => {
    expect(itemFaturaBate(item, 'mercado', nomeCat)).toBe(true);
  });
  it('casa por data em dd/mm/aaaa e por pedaço dela', () => {
    expect(itemFaturaBate(item, '02/10/2026', nomeCat)).toBe(true);
    expect(itemFaturaBate(item, '02/10', nomeCat)).toBe(true);
    expect(itemFaturaBate(item, '2026-10', nomeCat)).toBe(false);
  });
  it('casa por valor formatado', () => {
    expect(itemFaturaBate(item, '78,34', nomeCat)).toBe(true);
    expect(itemFaturaBate(item, '7834', nomeCat)).toBe(false);
  });
  it('item sem descrição ainda casa pela categoria', () => {
    expect(itemFaturaBate({ ...item, descricao: undefined } as Item, 'merc', nomeCat)).toBe(true);
    expect(itemFaturaBate({ ...item, descricao: undefined } as Item, 'sorv', nomeCat)).toBe(false);
  });
  it('termo vazio não casa com nada', () => {
    expect(itemFaturaBate(item, '', nomeCat)).toBe(false);
  });
});
