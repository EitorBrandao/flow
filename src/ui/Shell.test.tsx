import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import Shell from './Shell';

beforeEach(async () => {
  await limparDb();
});

it('o + central abre o popup de Adicionar em vez de trocar direto para Lançar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<Shell />);

  await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('dialog', { name: 'Adicionar' })).toBeInTheDocument();
  expect(useApp.getState().aba).not.toBe('lancar');

  await userEvent.click(screen.getByText('Lançamento'));
  expect(useApp.getState().aba).toBe('lancar');
});

it('mostra o nome da aba atual no topo, entre a box e a engrenagem', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<Shell />);

  expect(screen.getByText('Hoje')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
  expect(useApp.getState().aba).toBe('ajustes');
  expect(screen.getAllByText('Ajustes').length).toBeGreaterThan(0);
});

it('engrenagem sempre volta pro menu inicial de Ajustes, mesmo já estando numa seção', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<Shell />);

  await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
  await userEvent.click(screen.getByText('Boxes'));
  expect(screen.queryByText('Boxes', { selector: 'h2' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
  expect(screen.queryByText('Boxes', { selector: 'h2' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Categorias' })).toBeInTheDocument();
});
