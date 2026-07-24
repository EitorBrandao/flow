import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import CategoriasCartao from './CategoriasCartao';

beforeEach(async () => {
  await limparDb();
});

async function prepararCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  return cartao;
}

async function prepararBoxComCartao(nomeBox: string, nomeCartao: string) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: nomeBox, saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: nomeCartao, diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  return { box, cartao };
}

it('renomeia uma categoria de cartão existente via edição inline', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'supermercado');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('supermercado')).toBeInTheDocument();
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.nome).toBe('supermercado');
});

it('arquivar move a categoria de cartão para a seção Arquivados', async () => {
  const cartao = await prepararCartao();
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivados')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
});

it('restaurar devolve a categoria de cartão pra lista ativa', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.atualizarCategoriaCartao(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.getByText('Arquivados')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  await waitFor(() => expect(screen.queryByText('Arquivados')).not.toBeInTheDocument());
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});

it('categoria automática de assinaturas não aparece na lista de categorias do cartão', async () => {
  const cartao = await prepararCartao();
  await repo.categoriaAssinaturasDe(cartao.id);
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);

  expect(screen.queryByText('Assinaturas')).not.toBeInTheDocument();
});

it('trocar de box na tela de Categorias do cartão mostra só os cartões daquela box no seletor', async () => {
  await prepararBoxComCartao('eitor', 'Nubank');
  await prepararBoxComCartao('ju', 'Santander');
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'eitor' }));

  expect(screen.getByRole('button', { name: 'Nubank' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Santander' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'ju' }));

  expect(screen.getByRole('button', { name: 'Santander' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nubank' })).not.toBeInTheDocument();
});
