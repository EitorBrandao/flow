import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';
import Viagens from './Viagens';

beforeEach(async () => {
  await limparDb();
});

it('cadastra uma viagem', async () => {
  await useApp.getState().iniciar();
  render(<Viagens />);

  await userEvent.type(screen.getByLabelText('Nome'), 'Praia');
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-01-31');
  await userEvent.type(screen.getByLabelText('Data final'), '2026-02-05');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText('Praia')).toBeInTheDocument());
  const viagens = await db.viagens.toArray();
  expect(viagens).toHaveLength(1);
  expect(viagens[0]).toMatchObject({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
});

it('bloqueia data final anterior à data inicial', async () => {
  await useApp.getState().iniciar();
  render(<Viagens />);

  await userEvent.type(screen.getByLabelText('Nome'), 'Praia');
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-02-05');
  await userEvent.type(screen.getByLabelText('Data final'), '2026-01-31');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/data final não pode ser anterior/)).toBeInTheDocument();
  expect(await db.viagens.count()).toBe(0);
});

it('bloqueia viagem com período sobreposto a outra existente', async () => {
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  await userEvent.type(screen.getByLabelText('Nome'), 'Montanha');
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-01-15');
  await userEvent.type(screen.getByLabelText('Data final'), '2026-01-20');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/já existe uma viagem cadastrada nesse período/i)).toBeInTheDocument();
  expect(await db.viagens.count()).toBe(1);
});

it('edita uma viagem existente', async () => {
  const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const nome = screen.getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Praia em família');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(screen.getByText('Praia em família')).toBeInTheDocument());
  const atualizada = await db.viagens.get(v.id);
  expect(atualizada?.nome).toBe('Praia em família');
});

it('exclui uma viagem, desvinculando sem apagar lançamentos', async () => {
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Viagens />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  await waitFor(async () => expect(await db.viagens.count()).toBe(0));
});
