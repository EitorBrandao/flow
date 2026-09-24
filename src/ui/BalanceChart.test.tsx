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

  // O rodapé mostra o menor e o maior saldo reais da série, como o FluxoChartModal. O zero
  // só entra na escala do desenho (a linha do zero fica visível), nunca no rótulo.
  it('todos os valores positivos: mín e máx são os valores reais (verdes)', () => {
    render(<BalanceChart serie={serieComValores(61000, 342000)} hoje="2026-07-02" />);
    expect(screen.getByText(semNbsp(formatarBRL(61000)))).toHaveClass('pos');
    expect(screen.getByText(semNbsp(formatarBRL(342000)))).toHaveClass('pos');
  });

  it('todos os valores negativos: mín e máx são os valores reais (vermelhos)', () => {
    render(<BalanceChart serie={serieComValores(-189000, -12000)} hoje="2026-07-02" />);
    expect(screen.getByText(semNbsp(formatarBRL(-189000)))).toHaveClass('neg');
    expect(screen.getByText(semNbsp(formatarBRL(-12000)))).toHaveClass('neg');
  });
});

it('o rótulo "mín" mostra o menor saldo real, não o zero da escala', () => {
  const positiva: DiaSaldo[] = [
    { data: '2026-07-01', saldoEfetivo: 350000, saldoProjetado: 350000, saldoComCenarios: 350000 },
    { data: '2026-07-02', saldoEfetivo: 350000, saldoProjetado: 300000, saldoComCenarios: 300000 },
    { data: '2026-07-03', saldoEfetivo: 350000, saldoProjetado: 420000, saldoComCenarios: 420000 },
  ];
  const { container } = render(<BalanceChart serie={positiva} hoje="2026-07-01" />);
  const rodape = container.querySelector('.grafico-rodape')!.textContent!;
  expect(semNbsp(rodape)).toContain(`mín ${semNbsp(formatarBRL(300000))}`);
  expect(semNbsp(rodape)).toContain(`máx ${semNbsp(formatarBRL(420000))}`);
});

describe('BalanceChart — datas das pontas do rodapé', () => {
  const ponta = (data: string): DiaSaldo => ({ data, saldoEfetivo: 100000, saldoProjetado: 100000, saldoComCenarios: 100000 });

  it('no mesmo ano, mostra só dia e mês', () => {
    const { container } = render(<BalanceChart serie={[ponta('2026-09-16'), ponta('2026-10-21')]} hoje="2026-09-16" />);
    expect(container.querySelector('.grafico-rodape')).not.toHaveClass('duas-linhas');
    const spans = container.querySelectorAll('.grafico-rodape > span');
    expect(spans[0].textContent).toBe('16/09');
    expect(spans[2].textContent).toBe('21/10');
  });

  it('entre anos diferentes, mostra as datas completas numa linha e o mín/máx na seguinte', () => {
    const { container } = render(<BalanceChart serie={[ponta('2026-08-01'), ponta('2027-12-31')]} hoje="2026-09-23" />);
    const rodape = container.querySelector('.grafico-rodape')!;
    expect(rodape).toHaveClass('duas-linhas');
    const datas = rodape.querySelectorAll('.grafico-rodape-datas > span');
    expect(datas[0].textContent).toBe('01/08/2026');
    expect(datas[1].textContent).toBe('31/12/2027');
    expect(rodape.querySelector('.grafico-rodape-minmax')!.textContent).toMatch(/^mín .* · máx /);
  });
});
