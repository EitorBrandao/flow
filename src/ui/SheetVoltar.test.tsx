import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import Sheet from './Sheet';

function Exemplo({ nivel2 = false }: { nivel2?: boolean }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(nivel2);
  return (
    <>
      <Sheet aberto={a} onFechar={() => setA(false)} rotulo="primeiro"><p>conteudo A</p></Sheet>
      <Sheet aberto={b} onFechar={() => setB(false)} rotulo="segundo"><p>conteudo B</p></Sheet>
      <button onClick={() => setA(false)}>fechar A</button>
    </>
  );
}

const esperarPop = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

// Deixa o popstate do desmonte do teste anterior chegar antes deste.
beforeEach(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('o botão Voltar fecha o sheet aberto', async () => {
  render(<Exemplo />);
  expect(screen.getByText('conteudo A')).toBeInTheDocument();
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); window.history.back(); });
  await esperarPop();
  expect(screen.queryByText('conteudo A')).not.toBeInTheDocument();
});

it('com dois sheets, o Voltar fecha só o de cima', async () => {
  render(<Exemplo nivel2 />);
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); window.history.back(); });
  await esperarPop();
  expect(screen.queryByText('conteudo B')).not.toBeInTheDocument();
  expect(screen.getByText('conteudo A')).toBeInTheDocument();
});

it('fechar pelo app desfaz a entrada de histórico do sheet', async () => {
  const voltar = vi.spyOn(window.history, 'back');
  render(<Exemplo />);
  expect(voltar).not.toHaveBeenCalled();
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); screen.getByText('fechar A').click(); });
  await esperarPop();
  expect(screen.queryByText('conteudo A')).not.toBeInTheDocument();
  expect(voltar).toHaveBeenCalledTimes(1);
  voltar.mockRestore();
});

it('fechar pelo Voltar não chama history.back de novo', async () => {
  const voltar = vi.spyOn(window.history, 'back');
  render(<Exemplo />);
  voltar.mockClear();
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); window.history.back(); });
  await esperarPop();
  expect(screen.queryByText('conteudo A')).not.toBeInTheDocument();
  expect(voltar).toHaveBeenCalledTimes(1); // só a chamada do próprio teste
  voltar.mockRestore();
});
