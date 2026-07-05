import { render, screen } from '@testing-library/react';
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
});
