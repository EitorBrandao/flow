import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Sheet from './Sheet';

describe('Sheet', () => {
  it('renderiza children num dialog quando aberto', () => {
    render(<Sheet aberto onFechar={() => {}} rotulo="Teste"><p>conteúdo</p></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Teste' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('não renderiza nada quando fechado', () => {
    render(<Sheet aberto={false} onFechar={() => {}}><p>conteúdo</p></Sheet>);
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('fecha ao clicar no backdrop, mas não ao clicar no conteúdo', async () => {
    const onFechar = vi.fn();
    render(<Sheet aberto onFechar={onFechar}><p>conteúdo</p></Sheet>);
    await userEvent.click(screen.getByText('conteúdo'));
    expect(onFechar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onFechar).toHaveBeenCalledOnce();
  });

  function puxar(el: Element, de: number, ate: number) {
    fireEvent.touchStart(el, { touches: [{ clientX: 100, clientY: de }] });
    fireEvent.touchMove(el, { touches: [{ clientX: 100, clientY: ate }] });
    fireEvent.touchEnd(el, { touches: [] });
  }

  it('trava a rolagem da página enquanto está aberto e destrava ao fechar', () => {
    const { rerender } = render(<Sheet aberto onFechar={() => {}}><p>conteúdo</p></Sheet>);
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('none');
    rerender(<Sheet aberto={false} onFechar={() => {}}><p>conteúdo</p></Sheet>);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
  });

  it('sheet aberto por cima de outro só destrava a página quando o último fecha', () => {
    const { rerender } = render(<>
      <Sheet aberto onFechar={() => {}}><p>um</p></Sheet>
      <Sheet aberto onFechar={() => {}}><p>dois</p></Sheet>
    </>);
    rerender(<>
      <Sheet aberto onFechar={() => {}}><p>um</p></Sheet>
      <Sheet aberto={false} onFechar={() => {}}><p>dois</p></Sheet>
    </>);
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('puxar o conteúdo para baixo, com ele no topo, fecha o sheet', () => {
    const onFechar = vi.fn();
    render(<Sheet aberto onFechar={onFechar}><p>conteúdo</p></Sheet>);
    puxar(screen.getByText('conteúdo').parentElement!, 100, 300);
    expect(onFechar).toHaveBeenCalledOnce();
  });

  it('puxar o conteúdo para cima não fecha', () => {
    const onFechar = vi.fn();
    render(<Sheet aberto onFechar={onFechar}><p>conteúdo</p></Sheet>);
    const conteudo = screen.getByText('conteúdo').parentElement!;
    puxar(conteudo, 300, 100);
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('com o conteúdo rolado para baixo, puxar para baixo rola em vez de fechar', () => {
    const onFechar = vi.fn();
    render(<Sheet aberto onFechar={onFechar}><p>conteúdo</p></Sheet>);
    const conteudo = screen.getByText('conteúdo').parentElement!;
    conteudo.scrollTop = 200;
    puxar(conteudo, 100, 300);
    expect(onFechar).not.toHaveBeenCalled();
  });
});
