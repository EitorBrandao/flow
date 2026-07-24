import { render, screen } from '@testing-library/react';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import BalanceChart from './BalanceChart';

// formatarBRL usa toLocaleString, que insere um espaço não separável ( ) entre "R$" e o
// valor; o normalizador padrão do testing-library colapsa esse caractere para um espaço comum
// ao ler o texto do DOM, então precisamos normalizar o valor esperado da mesma forma.
function semNbsp(s: string): string {
  return s.replace(/ /g, ' ');
}

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

function serieComValores(min: number, max: number): DiaSaldo[] {
  return [
    { data: '2026-07-01', saldoEfetivo: min, saldoProjetado: min, saldoComCenarios: min },
    { data: '2026-07-02', saldoEfetivo: max, saldoProjetado: max, saldoComCenarios: max },
  ];
}

describe('BalanceChart — cor do rodapé mín/máx', () => {
  it('mín negativo e máx positivo: mín em vermelho, máx em verde', () => {
    render(<BalanceChart serie={serieComValores(-34000, 218000)} hoje="2026-07-02" />);
    expect(screen.getByText(semNbsp(formatarBRL(-34000)))).toHaveClass('neg');
    expect(screen.getByText(semNbsp(formatarBRL(218000)))).toHaveClass('pos');
  });

  // min/max (BalanceChart.tsx) sempre incluem 0 como piso/teto — o domínio do gráfico
  // cobre a linha do zero mesmo quando todos os dados são positivos. Com dados só
  // positivos, o "mín" exibido é sempre R$ 0,00 (ainda verde, por ser >= 0), nunca o menor
  // valor real da série.
  it('todos os valores positivos: mín cai no zero (verde), máx no maior valor (verde)', () => {
    render(<BalanceChart serie={serieComValores(61000, 342000)} hoje="2026-07-02" />);
    expect(screen.getByText(semNbsp(formatarBRL(0)))).toHaveClass('pos');
    expect(screen.getByText(semNbsp(formatarBRL(342000)))).toHaveClass('pos');
  });

  // simetricamente, com dados só negativos o "máx" exibido é sempre R$ 0,00 (verde) — o
  // rodapé nunca fica "todo vermelho" neste componente, diferente do FluxoChartModal
  // (cujo rodapé não força o zero).
  it('todos os valores negativos: mín no menor valor (vermelho), máx cai no zero (verde)', () => {
    render(<BalanceChart serie={serieComValores(-189000, -12000)} hoje="2026-07-02" />);
    expect(screen.getByText(semNbsp(formatarBRL(-189000)))).toHaveClass('neg');
    expect(screen.getByText(semNbsp(formatarBRL(0)))).toHaveClass('pos');
  });
});
