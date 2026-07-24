import { render, screen } from '@testing-library/react';
import type { ResumoMesSimples } from '../domain/aggregations';
import EvolucaoMensalChart from './EvolucaoMensalChart';

const serie: ResumoMesSimples[] = [
  { mes: '2026-06', ganhos: 700000, gastos: 610000, sobra: 90000 },
  { mes: '2026-07', ganhos: 680000, gastos: 493000, sobra: 187000 },
];

it('mostra a sobra de cada mês no formato compacto, com cor por sinal', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('+900')).toHaveClass('evolucao-sobra', 'pos');
  expect(screen.getByText('+1.870')).toHaveClass('evolucao-sobra', 'pos');
});

it('sobra negativa usa a classe neg', () => {
  const serieNegativa: ResumoMesSimples[] = [{ mes: '2026-07', ganhos: 100000, gastos: 250000, sobra: -150000 }];
  render(<EvolucaoMensalChart serie={serieNegativa} mesAtual="2026-07" />);
  expect(screen.getByText('−1.500')).toHaveClass('evolucao-sobra', 'neg');
});

it('mostra a legenda de ganhos, gastos e tendência', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('ganhos')).toBeInTheDocument();
  expect(screen.getByText('gastos')).toBeInTheDocument();
  expect(screen.getByText(/tend[êe]ncia/)).toBeInTheDocument();
});
