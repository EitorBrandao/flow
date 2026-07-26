import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import PrimeiroUso from './PrimeiroUso';

beforeEach(async () => {
  await limparDb();
});

it('sem box, mostra botão de criar box', async () => {
  await useApp.getState().iniciar();

  render(<PrimeiroUso />);
  expect(screen.getByRole('button', { name: /Criar minha box com o saldo do banco/ })).toBeInTheDocument();
});

it('sem box, botão primário de criar box chama abrirAjustes', async () => {
  await useApp.getState().iniciar();
  const spy = vi.spyOn(useApp.getState(), 'abrirAjustes');

  render(<PrimeiroUso />);
  await userEvent.click(screen.getByRole('button', { name: /Criar minha box com o saldo do banco/ }));

  expect(spy).toHaveBeenCalledWith('boxes');
  spy.mockRestore();
});

it('com box mas sem categoria, mostra botão de escolher categorias', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'teste', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();

  render(<PrimeiroUso />);
  expect(screen.getByRole('button', { name: /Escolher minhas categorias/ })).toBeInTheDocument();
});

it('com box mas sem categoria, botão primário chama abrirAjustes(categorias)', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'teste', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  const spy = vi.spyOn(useApp.getState(), 'abrirAjustes');

  render(<PrimeiroUso />);
  await userEvent.click(screen.getByRole('button', { name: /Escolher minhas categorias/ }));

  expect(spy).toHaveBeenCalledWith('categorias');
  spy.mockRestore();
});

it('botão de backup chama abrirAjustes(backup)', async () => {
  await useApp.getState().iniciar();
  const spy = vi.spyOn(useApp.getState(), 'abrirAjustes');

  render(<PrimeiroUso />);
  await userEvent.click(screen.getByRole('button', { name: /Já uso o Flow em outro aparelho/ }));

  expect(spy).toHaveBeenCalledWith('backup');
  spy.mockRestore();
});
