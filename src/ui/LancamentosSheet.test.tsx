import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Lancamento } from '../domain/types';
import LancamentosSheet from './LancamentosSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor'>): Lancamento {
  return { boxId: 'be', categoriaId: 'pix', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

describe('LancamentosSheet', () => {
  it('agrupa por nota, mostra subtotal do grupo e total da categoria', () => {
    const lancamentos: Lancamento[] = [
      lanc({ id: '1', data: '2026-07-05', valor: 30000, nota: 'Maria Silva' }),
      lanc({ id: '2', data: '2026-07-12', valor: 20000, nota: ' maria silva ' }),
      lanc({ id: '3', data: '2026-07-08', valor: 15000, nota: 'Padaria' }),
    ];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancamentos} incluirPrevistos={false} onFechar={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByText('R$ 650,00')).toBeInTheDocument(); // total da categoria
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('R$ 500,00')).toBeInTheDocument(); // subtotal do grupo Maria Silva
    expect(screen.getByText('12/07/2026')).toBeInTheDocument();
    expect(screen.getByText('05/07/2026')).toBeInTheDocument();
  });

  it('grupo com um único lançamento não mostra a data; grupo com mais de um mostra', () => {
    const lancamentos: Lancamento[] = [
      lanc({ id: '1', data: '2026-07-05', valor: 30000, nota: 'Boleto' }),
      lanc({ id: '2', data: '2026-07-08', valor: 15000, nota: 'Checar' }),
      lanc({ id: '3', data: '2026-07-12', valor: 10000, nota: 'Checar' }),
    ];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancamentos} incluirPrevistos={false} onFechar={() => {}}
      />,
    );

    expect(screen.getByText('Boleto')).toBeInTheDocument();
    expect(screen.queryByText('05/07/2026')).not.toBeInTheDocument();

    expect(screen.getByText('Checar')).toBeInTheDocument();
    expect(screen.getByText('12/07/2026')).toBeInTheDocument();
    expect(screen.getByText('08/07/2026')).toBeInTheDocument();
  });

  it('lançamento sem nota cai no grupo "sem nota"', () => {
    const lancamentos: Lancamento[] = [lanc({ id: '1', data: '2026-07-05', valor: 5000 })];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancamentos} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    expect(screen.getByText('sem nota')).toBeInTheDocument();
  });

  it('total de gasto com estorno maior que os gastos aparece verde e sem sinal', () => {
    const lancs: Lancamento[] = [
      lanc({ id: 'l1', data: '2026-07-03', valor: 2000 }),
      lanc({ id: 'l2', data: '2026-07-04', valor: -5000 }),
    ];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="mercado" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancs} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    // total = 2000 − 5000 = −3000 centavos: efeito no saldo de gasto = +3000 → verde
    const total = screen.getAllByText(/^R\$\s*30,00$/)[0];
    expect(total).toHaveClass('valor-ganho');
  });

  it('estorno isolado em gasto aparece verde com rótulo "estorno" no grupo', () => {
    const lancs: Lancamento[] = [lanc({ id: 'l1', data: '2026-07-04', valor: -5000 })];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="estorno-test" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancs} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    // total = -5000: efeito no saldo de gasto = +5000 → verde
    const total = screen.getAllByText(/^R\$\s*50,00$/)[0];
    expect(total).toHaveClass('valor-ganho');
    // Rótulo "estorno" deve aparecer na linha do grupo
    expect(screen.getByText('estorno')).toBeInTheDocument();
  });

  it('estorno isolado em ganho aparece vermelho com rótulo "estorno"', () => {
    const lancs: Lancamento[] = [lanc({ id: 'l1', data: '2026-07-04', valor: -5000 })];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="estorno-ganho" tipo="ganho" mes="2026-07" boxIds={['be']}
        lancamentos={lancs} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    // total = -5000: efeito no saldo de ganho = -5000 → vermelho
    const total = screen.getAllByText(/^R\$\s*50,00$/)[0];
    expect(total).toHaveClass('valor-gasto');
    // Rótulo "estorno" deve aparecer
    expect(screen.getByText('estorno')).toBeInTheDocument();
  });

  it('total zero (gasto cancelado por estorno) não ganha classe de cor', () => {
    const lancs: Lancamento[] = [
      lanc({ id: 'l1', data: '2026-07-03', valor: 5000 }),
      lanc({ id: 'l2', data: '2026-07-04', valor: -5000 }),
    ];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="zerado" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancs} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    const cabecalho = screen.getByText('zerado').closest('.linha') as HTMLElement;
    const total = within(cabecalho).getByText('R$ 0,00');
    expect(total).not.toHaveClass('valor-ganho');
    expect(total).not.toHaveClass('valor-gasto');
  });

  it('fechado não renderiza nada', () => {
    render(
      <LancamentosSheet
        aberto={false} categoriaId={null} nome="" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={[]} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
