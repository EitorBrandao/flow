import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { Box, Categoria, Lancamento } from '../domain/types';
import PendentesResumo from './PendentesResumo';

const AGORA = '2026-07-01T00:00:00.000Z';
const boxes: Box[] = [{ id: 'b1', nome: 'carteira', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: AGORA, alteradoEm: AGORA }];
const categorias = [
  { id: 'c1', boxId: 'b1', nome: 'salário', tipo: 'ganho', ordem: 0 },
  { id: 'c2', boxId: 'b1', nome: 'moradia', tipo: 'gasto', ordem: 1 },
  { id: 'c3', boxId: 'b1', nome: 'jardinagem', tipo: 'gasto', ordem: 2 },
] as Categoria[];
const previsto = (id: string, categoriaId: string, data: string, valor: number, nota?: string) => ({
  id, boxId: 'b1', categoriaId, data, valor, nota, status: 'previsto', origem: 'manual', criadoEm: AGORA, alteradoEm: AGORA,
}) as Lancamento;

const tres = [
  previsto('p1', 'c1', '2026-06-29', 650000, 'Pagamento do mês'),
  previsto('p2', 'c2', '2026-06-30', 185000, 'Aluguel'),
  previsto('p3', 'c3', '2026-07-01', 11990),
];

function montar(fila: Lancamento[], mostrarBox = false) {
  const onConfirmar = vi.fn();
  const onVerTodos = vi.fn();
  render(
    <PendentesResumo
      fila={fila} categorias={categorias} boxes={boxes} mostrarBox={mostrarBox}
      onConfirmar={onConfirmar} onVerTodos={onVerTodos}
    />,
  );
  return { onConfirmar, onVerTodos };
}

it('fila vazia não mostra nada', () => {
  const { container } = render(
    <PendentesResumo fila={[]} categorias={categorias} boxes={boxes} mostrarBox={false} onConfirmar={vi.fn()} onVerTodos={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('mostra a contagem total e só os dois primeiros da fila', () => {
  montar(tres);
  expect(screen.getByText('Pendentes · 3')).toBeInTheDocument();
  expect(screen.getByText('salário')).toBeInTheDocument();
  expect(screen.getByText('moradia')).toBeInTheDocument();
  expect(screen.queryByText('jardinagem')).not.toBeInTheDocument();
});

it('mostra data em formato brasileiro e a nota', () => {
  montar(tres);
  expect(screen.getByText('29/06/2026 · Pagamento do mês')).toBeInTheDocument();
});

it('com um ou dois pendentes não mostra "Ver os N"', () => {
  montar(tres.slice(0, 2));
  expect(screen.getByText('Pendentes · 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Ver os/ })).not.toBeInTheDocument();
});

it('com mais de dois, "Ver os N" chama onVerTodos', async () => {
  const { onVerTodos } = montar(tres);
  await userEvent.click(screen.getByRole('button', { name: 'Ver os 3 →' }));
  expect(onVerTodos).toHaveBeenCalledOnce();
});

it('o ✓ confirma o pendente da própria linha', async () => {
  const { onConfirmar } = montar(tres);
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar moradia' }));
  expect(onConfirmar).toHaveBeenCalledOnce();
  expect(onConfirmar).toHaveBeenCalledWith(tres[1]);
});

it('ganho usa a classe de entrada e gasto a de saída, como a fila de Pendentes', () => {
  montar(tres);
  expect(screen.getByText(/6\.500,00/)).toHaveClass('valor-ganho');
  expect(screen.getByText(/1\.850,00/)).toHaveClass('valor-gasto');
});

it('na visão casa mostra o selo da box', () => {
  montar(tres, true);
  expect(screen.getAllByText('carteira').length).toBeGreaterThan(0);
});
