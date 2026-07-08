import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import AdicionarSheet from './AdicionarSheet';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return box;
}

it('escolher "Lançamento" fecha o sheet e troca para a aba Lançar', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, aba: 'cartao' });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Lançamento'));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('lancar');
});

it('sem cartão cadastrado: "Compra no cartão" mostra aviso e leva para Ajustes', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nenhum cartão cadastrado' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cartão' }));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('ajustes');
});

it('1 cartão ativo: "Compra no cartão" pula direto para o formulário', async () => {
  const box = await montarBox();
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});

it('2+ cartões ativos: "Compra no cartão" mostra lista de escolha antes do formulário', async () => {
  const box = await montarBox();
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Compra em qual cartão?' })).toBeInTheDocument();
  await userEvent.click(screen.getByText('Inter'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});
