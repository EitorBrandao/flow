import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, renderHook } from '@testing-library/react';
import * as repo from '../db/repo';
import { useApp } from '../state/store';
import { useModo } from './useModo';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ dados: null });
});

it('sem dados carregados, vale o Avançado', () => {
  const { result } = renderHook(() => useModo('hoje'));
  expect(result.current).toBe('avancado');
});

it('lê o modo da tela na config', async () => {
  await repo.salvarModo('hoje', 'simples');
  await useApp.getState().iniciar();
  const { result } = renderHook(() => useModo('hoje'));
  expect(result.current).toBe('simples');
  const outra = renderHook(() => useModo('fluxo'));
  expect(outra.result.current).toBe('avancado');
});

it('muda quando o modo é trocado e o snapshot recarregado', async () => {
  await repo.salvarModo('cartao', 'simples');
  await useApp.getState().iniciar();
  const { result } = renderHook(() => useModo('cartao'));
  expect(result.current).toBe('simples');
  await act(async () => {
    await repo.salvarModo('cartao', 'avancado');
    await useApp.getState().recarregar();
  });
  expect(result.current).toBe('avancado');
});
