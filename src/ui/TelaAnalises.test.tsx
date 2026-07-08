import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAnalises from './TelaAnalises';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedBoxComCategoria() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catPix = await repo.salvarCategoria({ boxId: box.id, nome: 'pix', tipo: 'gasto', ordem: 0 });
  return { box, catPix };
}

it('clicar numa linha da tabela abre o sheet com os lançamentos agrupados por nota', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 15000, status: 'efetivo', nota: 'Padaria' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));

  expect(await screen.findByRole('dialog', { name: 'pix' })).toBeInTheDocument();
  expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  expect(screen.getByText('Padaria')).toBeInTheDocument();
});

it('trocar o mês com o sheet aberto atualiza os grupos exibidos', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-06-05', valor: 20000, status: 'efetivo', nota: 'João' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));
  expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  expect(screen.queryByText('João')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

  expect(await screen.findByText('João')).toBeInTheDocument();
  expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
});
