import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useApp } from '../state/store';
import Retorno from './Retorno';

beforeEach(() => { useApp.setState({ retorno: null }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('não mostra nada sem retorno', () => {
  render(<Retorno />);
  expect(screen.queryByText('Desfazer')).not.toBeInTheDocument();
});

it('mostra o texto; sem função de desfazer, não mostra o botão', () => {
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  expect(screen.getByText('Alteração salva')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
});

it('Desfazer roda a função, recarrega e fecha o aviso', async () => {
  const desfazer = vi.fn().mockResolvedValue(undefined);
  const recarregar = vi.fn().mockResolvedValue(undefined);
  useApp.setState({ recarregar });
  render(<Retorno />);
  act(() => useApp.getState().avisar('Lançamento excluído', desfazer));

  await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

  expect(desfazer).toHaveBeenCalledOnce();
  expect(recarregar).toHaveBeenCalledOnce();
  expect(useApp.getState().retorno).toBeNull();
});

it('um aviso novo substitui o anterior e ganha id novo', async () => {
  render(<Retorno />);
  act(() => useApp.getState().avisar('Primeiro'));
  const primeiro = useApp.getState().retorno!.id;
  act(() => useApp.getState().avisar('Segundo'));
  // O aviso antigo sai com a animação de saída; o novo já está na tela.
  await waitFor(() => expect(screen.queryByText('Primeiro')).not.toBeInTheDocument());
  expect(screen.getByText('Segundo')).toBeInTheDocument();
  expect(useApp.getState().retorno!.id).not.toBe(primeiro);
});

it('some sozinho: 3 s sem Desfazer, 6 s com Desfazer', () => {
  vi.useFakeTimers();
  render(<Retorno />);

  act(() => useApp.getState().avisar('Alteração salva'));
  act(() => { vi.advanceTimersByTime(2999); });
  expect(useApp.getState().retorno).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(useApp.getState().retorno).toBeNull();

  act(() => useApp.getState().avisar('Lançamento excluído', async () => {}));
  act(() => { vi.advanceTimersByTime(5999); });
  expect(useApp.getState().retorno).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(useApp.getState().retorno).toBeNull();
});

it('se o Desfazer falhar, o aviso fecha e o erro não some em silêncio', async () => {
  const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Retorno />);
  act(() => useApp.getState().avisar('Lançamento excluído', async () => { throw new Error('falhou'); }));

  await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

  expect(await screen.findByText('Não foi possível desfazer')).toBeInTheDocument();
  expect(erro).toHaveBeenCalled();
  erro.mockRestore();
});

it('um aviso novo que chega durante o Desfazer não é fechado quando ele termina', async () => {
  let terminar!: () => void;
  const desfazer = vi.fn(() => new Promise<void>((r) => { terminar = r; }));
  useApp.setState({ recarregar: vi.fn().mockResolvedValue(undefined) });
  render(<Retorno />);
  act(() => useApp.getState().avisar('Lançamento excluído', desfazer));

  await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
  act(() => useApp.getState().avisar('Outro aviso'));
  await act(async () => { terminar(); });

  expect(useApp.getState().retorno?.texto).toBe('Outro aviso');
});

// O jsdom não faz layout: o topo do sheet é simulado.
function abrirSheetFalso(topo: number) {
  const el = document.createElement('div');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: topo } as DOMRect);
  document.body.appendChild(el);
  return el;
}

it('sem sheet aberto, a pista fica no lugar do CSS', async () => {
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  await new Promise((r) => setTimeout(r, 60));
  expect(screen.getByRole('status').style.bottom).toBe('');
});

it('com sheet aberto, a pista sobe para 8 px acima da borda de cima do sheet', async () => {
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(744);
  const sheet = abrirSheetFalso(400);
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  // 744 - 400 + 8 = 352
  await waitFor(() => expect(screen.getByRole('status').style.bottom).toBe('352px'));
  sheet.remove();
});

it('quando o sheet sai do DOM, a pista volta ao lugar do CSS', async () => {
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(744);
  const sheet = abrirSheetFalso(400);
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  await waitFor(() => expect(screen.getByRole('status').style.bottom).toBe('352px'));
  sheet.remove();
  await waitFor(() => expect(screen.getByRole('status').style.bottom).toBe(''));
});

it('sheet quase da altura da tela não empurra o aviso para fora da janela', async () => {
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(744);
  const sheet = abrirSheetFalso(20);
  render(<Retorno />);
  act(() => useApp.getState().avisar('Alteração salva'));
  // 744 - 20 + 8 = 732, limitado a 744 - 60 = 684
  await waitFor(() => expect(screen.getByRole('status').style.bottom).toBe('684px'));
  sheet.remove();
});
