import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Boxes from './Boxes';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('salva saldo inicial "0,00" como zero, não como sem-saldo-próprio', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<Boxes />);
  const saldoInput = screen.getByLabelText('Saldo inicial');
  await userEvent.type(saldoInput, '0,00');
  const dataInput = screen.getByLabelText('Data do saldo');
  await userEvent.type(dataInput, '2026-01-01');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  const atualizado = await db.boxes.get(box.id);
  expect(atualizado?.saldoInicial).toBe(0);
  expect(atualizado?.dataSaldoInicial).toBe('2026-01-01');
});
