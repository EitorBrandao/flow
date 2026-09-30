import { render, screen } from '@testing-library/react';
import type { ResumoMesSimples } from '../domain/aggregations';
import EvolucaoMensalChart from './EvolucaoMensalChart';
import { formatarBRL } from '../domain/money';

const serie: ResumoMesSimples[] = [
  { mes: '2026-06', ganhos: 700000, gastos: 610000, sobra: 90000 },
  { mes: '2026-07', ganhos: 680000, gastos: 493000, sobra: 187000 },
];

it('mostra a sobra de cada mês no formato compacto, com cor por sinal', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('900')).toHaveClass('evolucao-sobra', 'pos');
  expect(screen.getByText('1.870')).toHaveClass('evolucao-sobra', 'pos');
});

it('sobra negativa usa a classe neg', () => {
  const serieNegativa: ResumoMesSimples[] = [{ mes: '2026-07', ganhos: 100000, gastos: 250000, sobra: -150000 }];
  render(<EvolucaoMensalChart serie={serieNegativa} mesAtual="2026-07" />);
  expect(screen.getByText('1.500')).toHaveClass('evolucao-sobra', 'neg');
});

it('sobra zero não ganha pos nem neg: movimento zero fica sem cor', () => {
  const serieZerada: ResumoMesSimples[] = [{ mes: '2026-07', ganhos: 100000, gastos: 100000, sobra: 0 }];
  render(<EvolucaoMensalChart serie={serieZerada} mesAtual="2026-07" />);
  const rotulo = screen.getByText('0');
  expect(rotulo).toHaveClass('evolucao-sobra');
  expect(rotulo).not.toHaveClass('pos');
  expect(rotulo).not.toHaveClass('neg');
});

it('mostra a legenda de ganhos, gastos e tendência', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('ganhos')).toBeInTheDocument();
  expect(screen.getByText('gastos')).toBeInTheDocument();
  expect(screen.getByText(/tend[êe]ncia/)).toBeInTheDocument();
});

function serieDe(n: number): ResumoMesSimples[] {
  return Array.from({ length: n }, (_, i) => {
    const mes = `2026-${String(i + 1).padStart(2, '0')}`;
    return { mes, ganhos: 100000, gastos: 90000, sobra: 10000 };
  });
}

it('até 6 meses: um rótulo de sobra por mês', () => {
  const { container } = render(<EvolucaoMensalChart serie={serieDe(6)} mesAtual={null} />);
  expect(container.querySelectorAll('.evolucao-sobra')).toHaveLength(6);
});

it('acima de 6 meses: a fileira de sobra dá lugar à sobra do período', () => {
  const { container } = render(<EvolucaoMensalChart serie={serieDe(7)} mesAtual={null} />);
  expect(container.querySelectorAll('.evolucao-sobra')).toHaveLength(0);
  const linha = screen.getByText('sobra do período');
  expect(linha.querySelector('strong')?.textContent).toBe(formatarBRL(70000)); // 7 × 10000 centavos
  expect(linha.querySelector('strong')).toHaveClass('valor-ganho');
});
