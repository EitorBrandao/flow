import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wiki from './Wiki';

describe('Wiki', () => {
  it('abre no primeiro capítulo', async () => {
    render(<Wiki />);
    expect(await screen.findByRole('heading', { name: 'Os primeiros passos' })).toBeInTheDocument();
  });

  it('troca de capítulo pelo índice', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Glossário' }));
    expect(await screen.findByRole('heading', { name: 'Glossário' })).toBeInTheDocument();
  });

  it('a busca filtra o índice, sem acento e sem caixa', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'CREDITO');
    expect(await screen.findByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();
  });

  it('a busca filtra pelo texto do capítulo, não só pelo título', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'teclado');
    expect(await screen.findByRole('button', { name: 'Os primeiros passos' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Telas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();
  });

  it('avisa quando a busca não acha nada', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'jabuticaba');
    expect(await screen.findByText(/nada encontrado/i)).toBeInTheDocument();
  });

  it('usa nomes do conjunto nos exemplos, nunca um nome fixo', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Conceitos e modelo de dados' }));
    const corpo = await screen.findByRole('article');
    expect(corpo.textContent).not.toMatch(/\{\{/);
  });
});
