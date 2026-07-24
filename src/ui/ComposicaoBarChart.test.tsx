import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ComposicaoBarChart, { type LinhaComposicao } from './ComposicaoBarChart';

const linhas: LinhaComposicao[] = [
  { chave: 'sal', nome: 'Salário', tipo: 'ganho', total: 620000, pctDaRenda: null },
  { chave: 'alu', nome: 'Aluguel', tipo: 'gasto', total: 220000, pctDaRenda: 0.324 },
  { chave: 'assinaturas', nome: 'Assinaturas', badge: 'todos os cartões', tipo: 'gasto', total: 23000, pctDaRenda: null },
];

it('renderiza nome, valor e % da renda quando presente', () => {
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={() => {}} />);
  expect(screen.getByText('Salário')).toBeInTheDocument();
  expect(screen.getByText('R$ 6.200,00')).toBeInTheDocument();
  expect(screen.getByText('32.4%')).toBeInTheDocument();
  expect(screen.getByText('todos os cartões')).toBeInTheDocument();
});

it('largura da barra reflete valor/base (escala compartilhada), arredondada a 2 casas', () => {
  const { container } = render(<ComposicaoBarChart linhas={linhas} base={620000} onClicarLinha={() => {}} />);
  const barras = container.querySelectorAll('.composicao-preenchimento');
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // 620000/620000
  expect((barras[1] as HTMLElement).style.width).toBe('35.48%'); // 220000/620000*100 = 35.483870...% -> 35.48%
});

it('clique numa linha chama onClicarLinha com a chave certa', async () => {
  const onClicarLinha = vi.fn();
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={onClicarLinha} />);
  await userEvent.click(screen.getByRole('button', { name: /Aluguel/ }));
  expect(onClicarLinha).toHaveBeenCalledWith('alu');
});

it('tecla Enter aciona a mesma ação do clique', async () => {
  const onClicarLinha = vi.fn();
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={onClicarLinha} />);
  screen.getByRole('button', { name: /Salário/ }).focus();
  await userEvent.keyboard('{Enter}');
  expect(onClicarLinha).toHaveBeenCalledWith('sal');
});

it('mensagem de vazio quando não há linhas', () => {
  render(<ComposicaoBarChart linhas={[]} base={1} onClicarLinha={() => {}} />);
  expect(screen.getByText('Sem movimentos no mês.')).toBeInTheDocument();
});
