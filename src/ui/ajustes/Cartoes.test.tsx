import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Cartoes from './Cartoes';

beforeEach(async () => {
  await limparDb();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return box;
}

it('cadastra um cartão sem pedir categoria e cria a categoria da fatura sozinho', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  expect(screen.queryByLabelText('Categoria da fatura')).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // aguarda o recarregar() da criação assentar (evita corrida com o beforeEach do próximo teste)
  await waitFor(() => expect(screen.getByText(/Nubank/)).toBeInTheDocument());

  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(1);
  expect(cartoes[0]).toMatchObject({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, ativo: true });
  const categoria = await db.categorias.get(cartoes[0].categoriaFaturaId);
  expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto' });
});

it('permite dois cartões ativos na mesma box', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText(/Inter/)).toBeInTheDocument());
  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(2);
  expect(cartoes.every((c) => c.ativo)).toBe(true);
});

it('trocar de box na tela de Cartões mostra só os cartões daquela box', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const ju = { id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(ju);
  await repo.salvarCartao({ boxId: eitor.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCartao({ boxId: ju.id, nome: 'Santander', diaFechamento: 29, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });

  render(<Cartoes />);
  await userEvent.selectOptions(screen.getByLabelText('Box do cartão'), 'eitor');

  expect(screen.getByText('Nubank', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Santander', { exact: false })).not.toBeInTheDocument();

  await userEvent.selectOptions(screen.getByLabelText('Box do cartão'), 'ju');

  expect(screen.getByText('Santander', { exact: false })).toBeInTheDocument();
  expect(screen.queryByText('Nubank', { exact: false })).not.toBeInTheDocument();
});
