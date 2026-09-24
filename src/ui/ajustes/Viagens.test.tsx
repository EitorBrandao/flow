import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  await userEvent.clear(screen.getByLabelText('Data inicial'));
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-01-31');
  await userEvent.clear(screen.getByLabelText('Data final'));
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
  await userEvent.clear(screen.getByLabelText('Data inicial'));
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-02-05');
  await userEvent.clear(screen.getByLabelText('Data final'));
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
  await userEvent.clear(screen.getByLabelText('Data inicial'));
  await userEvent.type(screen.getByLabelText('Data inicial'), '2026-01-15');
  await userEvent.clear(screen.getByLabelText('Data final'));
  await userEvent.type(screen.getByLabelText('Data final'), '2026-01-20');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/já existe uma viagem cadastrada nesse período/i)).toBeInTheDocument();
  expect(await db.viagens.count()).toBe(1);
});

it('o formulário de criação não tem botão Cancelar', async () => {
  await useApp.getState().iniciar();
  render(<Viagens />);

  expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
});

it('toca no lápis para editar: abre os campos dentro do item e some "Nova viagem"', async () => {
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  expect(screen.getByText('Nova viagem')).toBeInTheDocument();
  const item = screen.getByText('Praia').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  expect(screen.queryByText('Nova viagem')).not.toBeInTheDocument();
  expect(within(item).getByLabelText('Nome')).toHaveValue('Praia');
});

it('no item aberto, os botões aparecem na ordem Cancelar, Salvar', async () => {
  await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  const item = screen.getByText('Praia').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));

  const botoes = within(item).getAllByRole('button');
  const nomes = botoes.map((b) => b.textContent);
  expect(nomes.indexOf('Cancelar')).toBeLessThan(nomes.indexOf('Salvar'));
  expect(within(item).getByRole('button', { name: 'Salvar' })).toHaveClass('botao-primario');
});

it('cancelar fecha o item sem gravar e traz "Nova viagem" de volta', async () => {
  const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  const item = screen.getByText('Praia').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const nome = within(item).getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Outro nome');
  await userEvent.click(within(item).getByRole('button', { name: 'Cancelar' }));

  expect(screen.getByText('Nova viagem')).toBeInTheDocument();
  expect(within(item).getByText('Praia')).toBeInTheDocument();
  const atual = await db.viagens.get(v.id);
  expect(atual?.nome).toBe('Praia');
});

it('edita uma viagem existente', async () => {
  const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-10', dataFim: '2026-01-15' });
  await useApp.getState().iniciar();
  render(<Viagens />);

  const item = screen.getByText('Praia').closest('.item') as HTMLElement;
  await userEvent.click(within(item).getByRole('button', { name: 'Editar' }));
  const nome = within(item).getByLabelText('Nome') as HTMLInputElement;
  await userEvent.clear(nome);
  await userEvent.type(nome, 'Praia em família');
  await userEvent.click(within(item).getByRole('button', { name: 'Salvar' }));

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

it('a lista tem o título de grupo "Cadastradas"', async () => {
  await useApp.getState().iniciar();
  render(<Viagens />);
  expect(screen.getByText('Cadastradas')).toHaveClass('rotulo-grupo');
});
