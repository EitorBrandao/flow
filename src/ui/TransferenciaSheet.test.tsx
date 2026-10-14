import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import TransferenciaSheet from './TransferenciaSheet';

beforeEach(async () => {
  await limparDb();
});

async function seedTransferencia() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const bradesco = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  const nubank = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await repo.transferirEntreBancos(bradesco.id, nubank.id, 50000, '2026-07-05');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });
  const saida = (await db.lancamentos.toArray())
    .find((l) => l.origem === 'transferencia' && l.bancoId === bradesco.id) as Lancamento;
  return { saida };
}

it('mostra os bancos, a data e o valor, e exclui as duas pernas ao confirmar', async () => {
  const { saida } = await seedTransferencia();
  const onFechar = vi.fn();
  window.confirm = vi.fn(() => true);
  render(<TransferenciaSheet lanc={saida} onFechar={onFechar} />);

  expect(await screen.findByRole('dialog', { name: 'Transferência' })).toBeInTheDocument();
  expect(screen.getByText('Bradesco → Nubank')).toBeInTheDocument();
  expect(screen.getByText('R$ 500,00')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Excluir transferência' }));

  await waitFor(() => {
    expect(onFechar).toHaveBeenCalledOnce();
  });
  expect((await db.lancamentos.toArray())).toHaveLength(0);
});

it('cancelar a confirmação de exclusão não apaga nada', async () => {
  const { saida } = await seedTransferencia();
  window.confirm = vi.fn(() => false);
  render(<TransferenciaSheet lanc={saida} onFechar={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir transferência' }));

  expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(2);
});

it('entre boxes: mostra de onde saiu e onde entrou, e exclui as duas pernas', async () => {
  const agora = agoraISO();
  const ana = { id: novoId(), nome: 'ana', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const caio = { id: novoId(), nome: 'caio', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(ana);
  await repo.salvarBox(caio);
  const azul = await repo.salvarBanco({ boxId: ana.id, nome: 'Azul', ordem: 0 });
  await repo.transferirEntreBoxes({ boxId: ana.id, bancoId: azul.id }, { boxId: caio.id }, 30000, '2026-07-05');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: ana.id, hoje: '2026-07-05' });
  const saida = (await db.lancamentos.toArray()).find((l) => l.boxId === ana.id) as Lancamento;
  window.confirm = vi.fn(() => true);
  const onFechar = vi.fn();
  render(<TransferenciaSheet lanc={saida} onFechar={onFechar} />);

  expect(await screen.findByText('Saiu de')).toBeInTheDocument();
  expect(screen.getByText('ana · Azul')).toBeInTheDocument();
  expect(screen.getByText('Entrou em')).toBeInTheDocument();
  expect(screen.getByText('Excluir apaga os dois lançamentos, um em cada box.')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Excluir transferência' }));
  await waitFor(() => expect(onFechar).toHaveBeenCalledOnce());
  expect(await db.lancamentos.count()).toBe(0);
});
