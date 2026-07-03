import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaLancar from './TelaLancar';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('lança um gasto em 3 interações: valor, categoria, Lançar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ valor: 1234, data: '2026-07-02', status: 'efetivo', origem: 'manual' });
});
