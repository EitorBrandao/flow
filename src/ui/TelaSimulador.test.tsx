import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaSimulador from './TelaSimulador';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('categoria da fatura de um cartão não aparece no select de categoria do cenário hipotético', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<TelaSimulador />);
  await userEvent.type(screen.getByPlaceholderText(/novo cenário/), 'teste');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Detalhar' }));

  expect(screen.getByRole('option', { name: /mercado/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
});
