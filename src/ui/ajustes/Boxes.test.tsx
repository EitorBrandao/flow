import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Boxes from './Boxes';

beforeEach(async () => {
  await limparDb();
});

it('salva saldo inicial "0,00" como zero, não como sem-saldo-próprio', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<Boxes />);
  const checkbox = screen.getByLabelText('Esta box tem saldo próprio');
  await userEvent.click(checkbox);
  const saldoInput = screen.getByLabelText('Saldo inicial');
  await userEvent.click(saldoInput);
  const dataInput = screen.getByLabelText('Data do saldo');
  await userEvent.type(dataInput, '2026-01-01');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  const atualizado = await db.boxes.get(box.id);
  expect(atualizado?.saldoInicial).toBe(0);
  expect(atualizado?.dataSaldoInicial).toBe('2026-01-01');
});

it('desmarcar "tem saldo próprio" salva null', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 12345, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<Boxes />);
  const checkbox = screen.getByLabelText('Esta box tem saldo próprio');
  expect(checkbox).toBeChecked();
  await userEvent.click(checkbox);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  const atualizado = await db.boxes.get(box.id);
  expect(atualizado?.saldoInicial).toBe(null);
  expect(atualizado?.dataSaldoInicial).toBe(null);
});
