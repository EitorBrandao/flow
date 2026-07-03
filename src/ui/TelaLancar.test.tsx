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

it('bloqueia o lançamento quando a data é limpa', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.clear(screen.getByLabelText('Data'));

  expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(0);
});

it('roteia para a box "casa" pelo nome, não pela primeira box', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const casa = { id: novoId(), nome: 'casa', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(casa);
  await repo.salvarCategoria({ boxId: casa.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '50,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ boxId: casa.id, valor: 5000 });
});

it('marca como previsto quando o toggle está ativo, mesmo com data de hoje', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByLabelText('Marcar como previsto'));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ data: '2026-07-02', status: 'previsto' });
});
