import { render, screen } from '@testing-library/react';
import type { DiaSaldo } from '../domain/projection';
import BalanceChart from './BalanceChart';

// Cenário: saldo inicial 1000, gasto pendente (não confirmado) de -300 no dia 1
// deixa o projetado em 700; salário confirmado de +2000 no dia 5 eleva o efetivo
// a 3000, acima do projetado máximo (2700). A linha "passado" (sólida) plota
// saldoEfetivo, então o domínio do gráfico precisa cobrir esse valor também.
const serie: DiaSaldo[] = [
  { data: '2026-07-01', saldoEfetivo: 1000, saldoProjetado: 700, saldoComCenarios: 700 },
  { data: '2026-07-02', saldoEfetivo: 1000, saldoProjetado: 700, saldoComCenarios: 700 },
  { data: '2026-07-03', saldoEfetivo: 1000, saldoProjetado: 700, saldoComCenarios: 700 },
  { data: '2026-07-04', saldoEfetivo: 1000, saldoProjetado: 700, saldoComCenarios: 700 },
  { data: '2026-07-05', saldoEfetivo: 3000, saldoProjetado: 2700, saldoComCenarios: 2700 },
];

function extrairPontosY(svg: SVGElement): number[] {
  const ys: number[] = [];
  svg.querySelectorAll('polyline').forEach((pl) => {
    const pts = pl.getAttribute('points') ?? '';
    for (const par of pts.trim().split(/\s+/).filter(Boolean)) {
      const [, yStr] = par.split(',');
      ys.push(Number(yStr));
    }
  });
  return ys;
}

it('mantém a linha do passado (saldoEfetivo) dentro do viewBox mesmo quando excede o projetado', () => {
  render(<BalanceChart serie={serie} hoje="2026-07-05" />);
  const svg = screen.getByRole('img', { name: /Linha do saldo/ });
  const ys = extrairPontosY(svg as unknown as SVGElement);
  expect(ys.length).toBeGreaterThan(0);
  for (const yVal of ys) {
    expect(yVal).toBeGreaterThanOrEqual(0);
    expect(yVal).toBeLessThanOrEqual(40);
  }
});
