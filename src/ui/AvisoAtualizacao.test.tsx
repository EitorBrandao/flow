import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { useApp } from '../state/store';
import AvisoAtualizacao from './AvisoAtualizacao';
import { versaoAtual } from './ajustes/versaoAtual';

const CHAVE = 'flow:versao-vista';

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

it('primeira abertura: não avisa e grava a versão', () => {
  render(<AvisoAtualizacao />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(localStorage.getItem(CHAVE)).toBe(versaoAtual);
});

it('mesma versão: não avisa', () => {
  localStorage.setItem(CHAVE, versaoAtual);
  render(<AvisoAtualizacao />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('versão nova: avisa, grava a versão e some em 2 s', async () => {
  vi.useFakeTimers();
  localStorage.setItem(CHAVE, '0.0.1');
  render(<AvisoAtualizacao />);
  expect(screen.getByRole('button', { name: /Nova versão atualizada/ })).toBeInTheDocument();
  expect(localStorage.getItem(CHAVE)).toBe(versaoAtual);
  await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('tocar no aviso abre Ajustes › Versão', async () => {
  localStorage.setItem(CHAVE, '0.0.1');
  render(<AvisoAtualizacao />);
  await userEvent.click(screen.getByRole('button', { name: /Ver atualizações/ }));
  expect(useApp.getState().aba).toBe('ajustes');
  expect(useApp.getState().ajustesSecao).toBe('versao');
});
