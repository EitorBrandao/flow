import { render, screen, within } from '@testing-library/react';
import TabelaSimulacao from './TabelaSimulacao';

const linhas = [
  { mes: '2026-10', sem: 100000, com: 100000, dif: 0 },
  { mes: '2026-11', sem: 100000, com: 70000, dif: -30000 },
  { mes: '2026-12', sem: 100000, com: -50000, dif: -150000 },
  { mes: '2027-01', sem: 100000, com: 120000, dif: 20000 },
];

it('mostra Mês · Com · Diferença · Sem, com mês curto e "Valores em R$"', () => {
  render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  expect(screen.getByText('Valores em R$')).toBeInTheDocument();
  const cab = screen.getAllByRole('columnheader').map((th) => th.textContent);
  expect(cab).toEqual(['Mês', 'Com', 'Diferença', 'Sem']);
  expect(screen.getByText('nov/26')).toBeInTheDocument();
});

it('saldo abaixo de zero leva "−" e vermelho; diferença sem sinal, pela cor; zero vira "—"', () => {
  render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  const [, , dez, jan] = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell'));
  expect(dez[1]).toHaveTextContent('−500,00');
  expect(dez[1].querySelector('strong')).toHaveClass('total-dia', 'neg');
  expect(dez[2]).toHaveTextContent(/^1\.500,00$/);
  expect(dez[2].querySelector('strong')).toHaveClass('valor-gasto');
  expect(jan[2]).toHaveTextContent(/^200,00$/);
  expect(jan[2].querySelector('strong')).toHaveClass('valor-ganho');
  const out = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
  expect(out[2]).toHaveTextContent('—');
  expect(out[3].querySelector('strong')).toHaveClass('total-dia', 'pos');
});

it('largura mínima vem só de larguraCh, não do conteúdo', () => {
  const { container, rerender } = render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  const antes = (container.querySelector('table') as HTMLElement).style.minWidth;
  rerender(<TabelaSimulacao linhas={linhas.map((l) => ({ ...l, com: l.sem, dif: 0 }))} larguraCh={9} />);
  expect((container.querySelector('table') as HTMLElement).style.minWidth).toBe(antes);
  expect(container.querySelector('table')).toHaveClass('tabela', 'tabela-fixa');
});
