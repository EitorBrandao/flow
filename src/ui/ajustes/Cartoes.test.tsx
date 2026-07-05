import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Cartoes from './Cartoes';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  return { box, cat };
}

it('cadastra um cartão com a categoria "cartão" pré-selecionada', async () => {
  const { box, cat } = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // aguarda o recarregar() da criação assentar (evita corrida com o beforeEach do próximo teste)
  await waitFor(() => expect(screen.getByText(/Nubank/)).toBeInTheDocument());

  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(1);
  expect(cartoes[0]).toMatchObject({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    categoriaFaturaId: cat.id, ativo: true,
  });
});

it('impede segundo cartão ativo na mesma box', async () => {
  const { box, cat } = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: cat.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/já tem um cartão ativo/)).toBeInTheDocument();
  expect(await db.cartoes.count()).toBe(1);
});
