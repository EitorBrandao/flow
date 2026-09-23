import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { nomeDoMes } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

const cartao: Cartao = {
  id: 'k1', boxId: 'be', nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catFlow', ativo: true, ...ts,
};

const categoriasCartao: CategoriaCartao[] = [
  { id: 'mercado', cartaoId: 'k1', nome: 'Mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'streaming', cartaoId: 'k1', nome: 'Streaming', ordem: 1, arquivada: false, ...ts },
];

function compra(p: Partial<CompraCartao> & Pick<CompraCartao, 'id' | 'data' | 'valorTotal' | 'categoriaCartaoId'>): CompraCartao {
  return { cartaoId: 'k1', parcelas: 1, ...ts, ...p };
}

describe('FaturaCategoriaSheet', () => {
  it('mostra o total da fatura e o subtotal por categoria de cartão', () => {
    const comprasCartao: CompraCartao[] = [
      compra({ id: 'c1', data: '2026-07-10', valorTotal: 62000, categoriaCartaoId: 'mercado' }),
      compra({ id: 'c2', data: '2026-07-12', valorTotal: 4590, categoriaCartaoId: 'streaming' }),
    ];
    render(
      <FaturaCategoriaSheet
        aberto cartao={cartao} mes="2026-08" comprasCartao={comprasCartao} categoriasCartao={categoriasCartao}
        horizonteProjecao="2027-12-31" onFechar={() => {}} onAbrirCartao={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: `Nubank · fatura de ${nomeDoMes('2026-08')}` })).toBeInTheDocument();
    expect(screen.getByText(`Nubank · fatura de ${nomeDoMes('2026-08')}`)).toBeInTheDocument();
    const totalEsperado = formatarBRL(66590).replace(/\s/g, ' ');
    expect(screen.getByText(totalEsperado, { selector: 'strong.valor-gasto' })).toBeInTheDocument();
    // Compras em julho/2026 fecham a fatura de agosto (fechamento dia 28/07, vencimento dia 05/08).
    expect(screen.getByText((_, el) => el?.tagName === 'P'
      && (el.textContent ?? '').includes('fecha 28/07/2026 · vence 05/08/2026'))).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('R$ 620,00')).toBeInTheDocument();
    expect(screen.getByText('Streaming')).toBeInTheDocument();
    expect(screen.getByText('R$ 45,90')).toBeInTheDocument();
  });

  it('fatura sem compras mostra o total zerado, sem destaque de valor-gasto', () => {
    render(
      <FaturaCategoriaSheet
        aberto cartao={cartao} mes="2026-08" comprasCartao={[]} categoriasCartao={categoriasCartao}
        horizonteProjecao="2027-12-31" onFechar={() => {}} onAbrirCartao={() => {}}
      />,
    );

    const totalEsperado = formatarBRL(0).replace(/\s/g, ' ');
    expect(screen.getByText(totalEsperado, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(totalEsperado, { selector: 'strong.valor-gasto' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum gasto nesta fatura.')).toBeInTheDocument();
    // Mesmo sem compras no mês, as datas do ciclo (fechamento/vencimento) vêm certas.
    expect(screen.getByText((_, el) => el?.tagName === 'P'
      && (el.textContent ?? '').includes('fecha 28/07/2026 · vence 05/08/2026'))).toBeInTheDocument();
  });

  it('botão "Ver fatura completa" chama onAbrirCartao', async () => {
    const onAbrirCartao = vi.fn();
    render(
      <FaturaCategoriaSheet
        aberto cartao={cartao} mes="2026-08" comprasCartao={[]} categoriasCartao={categoriasCartao}
        horizonteProjecao="2027-12-31" onFechar={() => {}} onAbrirCartao={onAbrirCartao}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Ver fatura completa/ }));
    expect(onAbrirCartao).toHaveBeenCalledTimes(1);
  });

  it('sem cartão não renderiza nada', () => {
    render(
      <FaturaCategoriaSheet
        aberto cartao={null} mes="2026-08" comprasCartao={[]} categoriasCartao={[]}
        horizonteProjecao="2027-12-31" onFechar={() => {}} onAbrirCartao={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
