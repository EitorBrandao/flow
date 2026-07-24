import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Categorias from './Categorias';

beforeEach(async () => {
  await limparDb();
});

it('renomeia uma categoria existente via edição inline', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'cartão de crédito');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('cartão de crédito')).toBeInTheDocument();
  const atualizado = await db.categorias.get(cat.id);
  expect(atualizado?.nome).toBe('cartão de crédito');
});

it('categoria da fatura de um cartão não aparece na lista de categorias', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  expect(screen.getByText('mercado')).toBeInTheDocument();
  expect(screen.queryByText('Nubank')).not.toBeInTheDocument();
});

it('arquivar move a categoria para a seção Arquivados, com badge de tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivados')).toBeInTheDocument();
  expect(screen.getByText('gasto', { selector: '.badge' })).toBeInTheDocument();
});

it('restaurar devolve a categoria para a seção do seu tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.atualizarCategoria(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.getByText('Arquivados')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  await waitFor(() => expect(screen.queryByText('Arquivados')).not.toBeInTheDocument());
  const atualizado = await db.categorias.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});
