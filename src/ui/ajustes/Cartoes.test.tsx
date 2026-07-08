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

it('cadastra um cartão e cria a categoria da fatura automaticamente', async () => {
  const { box } = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // espera pelo dado persistido em vez de texto na tela — evita ambiguidade com a opção
  // "Nubank" que agora também aparece no select de categoria (a própria categoria oculta)
  await waitFor(async () => expect(await db.cartoes.count()).toBe(1));

  const cartoes = await db.cartoes.toArray();
  expect(cartoes[0]).toMatchObject({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, ativo: true,
  });
  const categoria = await db.categorias.get(cartoes[0].categoriaFaturaId);
  expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto' });
});

it('impede segundo cartão ativo na mesma box', async () => {
  const { box } = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/já tem um cartão ativo/)).toBeInTheDocument();
  expect(await db.cartoes.count()).toBe(1);
});
