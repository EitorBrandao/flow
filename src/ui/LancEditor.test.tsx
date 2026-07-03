import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import LancEditor from './LancEditor';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('confirma um pendente com valor editado: persiste o novo valor e status efetivo juntos', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const previsto = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'previsto',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<LancEditor lanc={previsto} onFechar={() => {}} />);
  const campoValor = screen.getByLabelText('Valor');
  await userEvent.clear(campoValor);
  await userEvent.type(campoValor, '73,45');
  await userEvent.click(screen.getByRole('button', { name: '✓ Confirmar' }));

  const atualizado = await db.lancamentos.get(previsto.id);
  expect(atualizado).toMatchObject({ valor: 7345, status: 'efetivo' });
});
