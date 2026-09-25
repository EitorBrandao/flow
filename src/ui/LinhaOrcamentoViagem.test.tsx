import { render, screen } from '@testing-library/react';
import { formatarBRL } from '../domain/money';
import LinhaOrcamentoViagem from './LinhaOrcamentoViagem';

it('dentro do orçamento: mostra o que falta em verde', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={120000} />);
  expect(container.textContent).toBe(`${formatarBRL(120000)} de ${formatarBRL(300000)} · falta ${formatarBRL(180000)}`);
  const forte = container.querySelector('strong.valor-ganho')!;
  expect(forte).toHaveClass('valor-ganho');
  expect(forte.textContent).toMatch(/1.800,00/);
});

it('no limite: falta R$ 0,00, ainda verde', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={300000} />);
  const forte = container.querySelector('strong.valor-ganho')!;
  expect(forte).toHaveClass('valor-ganho');
  expect(forte.textContent).toMatch(/0,00/);
});

it('passou: mostra o excesso em vermelho, com o ícone dentro do valor', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={320000} />);
  const forte = container.querySelector('strong.valor-gasto')!;
  expect(forte.textContent).toContain(formatarBRL(20000));
  expect(forte.querySelector('svg')).not.toBeNull();
  expect(container.textContent).toContain(formatarBRL(320000));
  expect(container.textContent).toContain(formatarBRL(300000));
  expect(container.textContent).toContain('passou');
});

it('com este gasto: ganha o prefixo', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={145000} comEsteGasto />);
  expect(container.textContent).toMatch(/^Com este gasto: /);
});
