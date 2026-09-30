import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { estadoInicial, type EstadoPeriodo } from '../domain/periodo';
import SeletorPeriodo from './SeletorPeriodo';

function Harness({ inicial }: { inicial?: Partial<EstadoPeriodo> }) {
  const [e, setE] = useState<EstadoPeriodo>({ ...estadoInicial('2026-09'), ...inicial });
  return <div className="tela"><SeletorPeriodo estado={e} mesHoje="2026-09" onMudar={setE} /></div>;
}
const barra = () => document.querySelector('.barra-fixa') as HTMLElement;

describe('SeletorPeriodo', () => {
  it('mostra as quatro pílulas, com Mês marcada', () => {
    render(<Harness />);
    const grupo = screen.getByRole('radiogroup', { name: 'Período' });
    expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Mês', '12 meses', 'Ano', 'Período']);
    expect(within(grupo).getByRole('radio', { name: 'Mês' })).toHaveAttribute('aria-checked', 'true');
  });

  it('modo Mês: o seletor de mês fica na barra fixa e anda de mês em mês', async () => {
    render(<Harness />);
    expect(within(barra()).getByText('setembro de 2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mês anterior' }));
    expect(within(barra()).getByText('agosto de 2026')).toBeInTheDocument();
  });

  it('modo 12 meses: janela até o mês de hoje, deslizando de mês em mês', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
    expect(within(barra()).getByText('out/2025 – set/2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Período seguinte' }));
    expect(within(barra()).getByText('nov/2025 – out/2026')).toBeInTheDocument();
  });

  it('modo Ano: abre no último ano fechado; o ano de hoje leva "até agora"', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
    expect(within(barra()).getByText('2025')).toBeInTheDocument();
    expect(screen.queryByText('até agora')).not.toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Ano seguinte' }));
    expect(within(barra()).getByText('2026')).toBeInTheDocument();
    expect(within(barra()).getByText('até agora')).toHaveClass('badge');
  });

  it('modo Período: de/até fora da barra fixa, nota de tamanho, e a barra desliza a janela', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Período' }));
    expect(screen.getByText('7 meses · máximo de 24')).toBeInTheDocument();
    const inicial = screen.getByRole('button', { name: 'Mês inicial anterior' });
    expect(barra().contains(inicial)).toBe(false);
    expect(within(barra()).getByText('mar/2026 – set/2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Período anterior' }));
    expect(within(barra()).getByText('fev/2026 – ago/2026')).toBeInTheDocument();
    expect(screen.getByText('7 meses · máximo de 24')).toBeInTheDocument();
  });

  it('modo Período: início além do fim arrasta o fim; nunca passa de 24 meses', async () => {
    render(<Harness inicial={{ modo: 'periodo', de: '2026-09', ate: '2026-09' }} />);
    expect(screen.getByText('1 mês · máximo de 24')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mês inicial seguinte' }));
    expect(within(barra()).getByText('out/2026')).toBeInTheDocument();
  });

  it('modo Período: recuar o início no teto puxa o fim', async () => {
    render(<Harness inicial={{ modo: 'periodo', de: '2024-10', ate: '2026-09' }} />);
    expect(screen.getByText('24 meses · máximo de 24')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mês inicial anterior' }));
    expect(within(barra()).getByText('set/2024 – ago/2026')).toBeInTheDocument();
    expect(screen.getByText('24 meses · máximo de 24')).toBeInTheDocument();
  });

  it('trocar de modo preserva o estado dos outros modos', async () => {
    render(<Harness />);
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mês anterior' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Mês' }));
    expect(within(barra()).getByText('agosto de 2026')).toBeInTheDocument();
  });
});
