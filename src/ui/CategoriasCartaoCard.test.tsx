import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatarBRL } from '../domain/money';
import type { Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import CategoriasCartaoCard from './CategoriasCartaoCard';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
function cartao(id: string, nome: string, boxId = 'b1', ativo = true): Cartao {
  return { id, boxId, nome, diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: `f-${id}`, ativo, ...ts };
}
function categoria(id: string, cartaoId: string, nome: string, ordem: number, arquivada = false): CategoriaCartao {
  return { id, cartaoId, nome, ordem, arquivada, ...ts };
}
function compra(id: string, cartaoId: string, categoriaCartaoId: string, data: string, valorTotal: number): CompraCartao {
  return { id, cartaoId, categoriaCartaoId, data, valorTotal, parcelas: 1, ...ts };
}

const azul = cartao('k1', 'Cartão Azul');
const verde = cartao('k2', 'Cartão Verde');
const cats = [
  categoria('mercado', 'k1', 'Mercado', 0),
  categoria('farmacia', 'k1', 'Farmácia', 1),
  categoria('antiga', 'k1', 'Antiga', 2, true),
  categoria('transporte', 'k2', 'Transporte', 0),
  categoria('outra', 'k3', 'Outra', 0),
];

function renderizar(p: { cartoes?: Cartao[]; compras: CompraCartao[]; boxIds?: string[]; onAbrir?: () => void }) {
  render(
    <CategoriasCartaoCard
      mes="2026-09" boxIds={p.boxIds ?? ['b1']} cartoes={p.cartoes ?? [azul]} categoriasCartao={cats}
      comprasCartao={p.compras} ajustesFechamento={[]} onAbrir={p.onAbrir ?? (() => {})}
    />,
  );
  return screen.getByText('Categorias do cartão').closest('.card') as HTMLElement;
}

describe('CategoriasCartaoCard', () => {
  // fecha 28, vence 5 do mês seguinte: compra de 10/08 → fatura 09; 10/07 → 08; 10/06 → 07; 10/08/2025 → 09/2025
  it('mostra mês, mês anterior, ano passado e média 3m por categoria', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 124000),
        compra('b', 'k1', 'mercado', '2026-07-10', 98000),
        compra('c', 'k1', 'mercado', '2026-06-10', 105000),
        compra('d', 'k1', 'mercado', '2025-08-10', 87000),
      ],
    });
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const celulas = within(linha).getAllByRole('cell').map((c) => c.textContent);
    // média 3m = (105000 + 98000 + 124000) / 3 = 109000
    expect(celulas.slice(1)).toEqual([124000, 98000, 87000, 109000].map(formatarBRL));
    expect(within(card).getByText('set/2026')).toBeInTheDocument();
  });

  it('com um cartão só, não mostra o nome do cartão; com dois, um bloco por cartão', () => {
    const compras = [
      compra('a', 'k1', 'mercado', '2026-08-10', 10000),
      compra('b', 'k2', 'transporte', '2026-08-10', 20000),
    ];
    const card1 = renderizar({ compras });
    expect(card1.querySelector('.rotulo-grupo')).toBeNull();
    cleanup();
    const card2 = renderizar({ cartoes: [azul, verde], compras });
    const rotulos = [...card2.querySelectorAll('.rotulo-grupo')].map((e) => e.textContent);
    expect(rotulos).toEqual(['Cartão Azul', 'Cartão Verde']);
  });

  it('cartão de outra box fica fora; cartão inativo com histórico entra', () => {
    const outraBox = cartao('k3', 'Cartão Laranja', 'b2');
    const inativo = cartao('k2', 'Cartão Verde', 'b1', false);
    const card = renderizar({
      cartoes: [azul, inativo, outraBox],
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 10000),
        compra('b', 'k2', 'transporte', '2026-08-10', 20000),
        compra('c', 'k3', 'outra', '2026-08-10', 30000),
      ],
    });
    expect(within(card).getByText('Cartão Verde')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Transporte' })).toBeInTheDocument();
    expect(within(card).queryByText('Cartão Laranja')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Outra' })).not.toBeInTheDocument();
  });

  it('categoria arquivada com valor aparece; linha some quando os três meses são zero', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'antiga', '2026-08-10', 5000),
        compra('b', 'k1', 'farmacia', '2026-06-10', 3000), // só em jul/2026 = mês − 2
      ],
    });
    expect(within(card).getByRole('button', { name: 'Antiga' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Farmácia' })).not.toBeInTheDocument();
  });

  it('zero fica neutro; estorno líquido fica verde', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'mercado', '2026-07-10', 15000), // ago: gasto
        compra('b', 'k1', 'farmacia', '2026-08-10', -12000), // set: estorno
      ],
    });
    const mercado = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const [, atual, anterior] = within(mercado).getAllByRole('cell');
    expect(atual).toHaveClass('valor-neutro');
    expect(anterior).toHaveClass('valor-gasto');
    const farmacia = within(card).getByRole('button', { name: 'Farmácia' }).closest('tr') as HTMLElement;
    expect(within(farmacia).getAllByRole('cell')[1]).toHaveClass('valor-ganho');
  });

  it('ordem das linhas segue a ordem das categorias do cartão', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'farmacia', '2026-08-10', 90000),
        compra('b', 'k1', 'mercado', '2026-08-10', 1000),
      ],
    });
    const nomes = within(card).getAllByRole('button').map((b) => b.textContent);
    expect(nomes).toEqual(['Mercado', 'Farmácia']);
  });

  it('tocar no nome chama onAbrir com o cartão e a categoria', async () => {
    const onAbrir = vi.fn();
    const card = renderizar({ compras: [compra('a', 'k1', 'mercado', '2026-08-10', 10000)], onAbrir });
    await userEvent.click(within(card).getByRole('button', { name: 'Mercado' }));
    expect(onAbrir).toHaveBeenCalledWith({ cartaoId: 'k1', categoriaCartaoId: 'mercado' });
  });

  it('sem gasto em nenhum cartão mostra a mensagem de vazio, sem tabela', () => {
    const card = renderizar({ compras: [] });
    expect(within(card).getByText('Sem gastos no cartão para comparar.')).toBeInTheDocument();
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });
});
