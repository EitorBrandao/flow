import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import Shell from './Shell';

beforeEach(async () => {
  await db.delete();
  await db.open();
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
