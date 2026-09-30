import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatarBRL } from '../domain/money';
import { describe, expect, it, vi } from 'vitest';
import CategoriaPeriodoSheet from './CategoriaPeriodoSheet';

function abrir(onAbrirMes = vi.fn()) {
  render(
    <CategoriaPeriodoSheet
      aberto nome="Mercado" tipo="gasto" meses={['2026-07', '2026-08', '2026-09']}
      serie={[30000, 0, 90000]} verMes="os lançamentos" onAbrirMes={onAbrirMes} onFechar={() => {}}
    />,
  );
  return screen.getByRole('dialog', { name: 'Mercado' });
}

describe('CategoriaPeriodoSheet', () => {
  it('cabeçalho com total e intervalo; uma barra por mês; média por mês', () => {
    const dialog = abrir();
    expect(within(dialog).getByText('R$ 1.200,00')).toHaveClass('valor-gasto'); // 30000 + 90000
    expect(within(dialog).getByText('jul/2026 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();
    expect(within(dialog).getByText('R$ 0,00')).toHaveClass('valor-neutro');
    const barras = dialog.querySelectorAll<HTMLElement>('.composicao-preenchimento');
    expect([...barras].map((b) => b.style.width)).toEqual(['33.33%', '0%', '100%']);
    // 120000 / 3 = 40000
    expect(within(dialog).getByText('média por mês').querySelector('strong')?.textContent).toBe(formatarBRL(40000));
  });

  it('tocar num mês chama onAbrirMes com o mês; Enter também', async () => {
    const onAbrirMes = vi.fn();
    const dialog = abrir(onAbrirMes);
    await userEvent.click(within(dialog).getByRole('button', { name: /ago\/2026/ }));
    expect(onAbrirMes).toHaveBeenLastCalledWith('2026-08');
    within(dialog).getByRole('button', { name: /set\/2026/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onAbrirMes).toHaveBeenLastCalledWith('2026-09');
  });
});
