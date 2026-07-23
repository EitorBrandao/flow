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

it('checkbox de viagem aparece marcado quando a data cai no período de uma viagem e marca o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  const checkbox = screen.getByLabelText(`Viagem: ${viagem.nome}`) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  const lancs = await db.lancamentos.toArray();
  expect(lancs[0].viagemId).toBe(viagem.id);
});

it('checkbox de viagem some quando a data está fora do período e desmarcado não marca o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const viagem = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-07-01', dataFim: '2026-07-05' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.getByLabelText(`Viagem: ${viagem.nome}`)).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(`Viagem: ${viagem.nome}`));

  await userEvent.type(screen.getByLabelText('Valor'), '12,34');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  let lancs = await db.lancamentos.toArray();
  expect(lancs[0].viagemId).toBeUndefined();

  // agora fora do período: o checkbox deve sumir
  await userEvent.clear(screen.getByLabelText('Data'));
  await userEvent.type(screen.getByLabelText('Data'), '2026-08-01');
  expect(screen.queryByLabelText(`Viagem: ${viagem.nome}`)).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'cartão' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
  lancs = await db.lancamentos.toArray();
  expect(lancs).toHaveLength(2);
  expect(lancs[1].viagemId).toBeUndefined();
});

it('categoria da fatura de um cartão não aparece na grade de seleção', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nubank' })).not.toBeInTheDocument();
});
