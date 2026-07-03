import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaHoje from './TelaHoje';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('mostra saldo e confirma um pendente', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 550000, status: 'previsto' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument(); // saldo efetivo
  expect(screen.getByText(/salario/)).toBeInTheDocument();     // pendente na fila

  await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  const lanc = (await db.lancamentos.toArray())[0];
  expect(lanc.status).toBe('efetivo');
});
