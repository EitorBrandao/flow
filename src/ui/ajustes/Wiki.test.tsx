import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wiki from './Wiki';

describe('Wiki', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  async function abrirConceitos() {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Conceitos e modelo de dados' }));
  }

  it('link interno troca de capítulo', async () => {
    await abrirConceitos();
    await userEvent.click(await screen.findByRole('link', { name: 'Consolidação da casa' }));
    expect(await screen.findByRole('heading', { name: 'Motor por baixo dos panos' })).toBeInTheDocument();
  });

  it('termo do glossário abre a definição no lugar e fecha ao tocar fora', async () => {
    await abrirConceitos();
    await userEvent.click(await screen.findByRole('button', { name: 'pendente' }));
    const balao = await screen.findByRole('dialog', { name: 'Definição: pendente' });
    expect(balao).toHaveTextContent(/espera confirmação na tela Hoje/);
    expect(screen.getByRole('heading', { name: 'Conceitos e modelo de dados' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('heading', { name: 'Conceitos e modelo de dados' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tocar de novo no mesmo termo fecha o balão', async () => {
    await abrirConceitos();
    const termo = await screen.findByRole('button', { name: 'pendente' });
    await userEvent.click(termo);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.click(termo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc fecha o balão', async () => {
    await abrirConceitos();
    await userEvent.click(await screen.findByRole('button', { name: 'pendente' }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('link externo abre em aba nova', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Código e versão' }));
    const link = await screen.findByRole('link', { name: /github\.com\/EitorBrandao\/flow/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('balão no Glossário mostra definição de link interno', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Glossário' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Previsto' }));
    const balao = await screen.findByRole('dialog', { name: 'Definição: previsto' });
    expect(balao).toHaveTextContent(/entra só na projeção/);
  });

  it('balão dentro do balão com posições simuladas; cores do termo e do link em nota', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    try {
      spy.mockImplementation(function (this: HTMLElement) {
        if (this.tagName === 'ARTICLE') {
          return { top: 0, left: 0, width: 300, bottom: 1000, right: 300, height: 1000, x: 0, y: 0, toJSON() {} } as DOMRect;
        }
        if (this.closest('.wiki-balao')) {
          return { top: 290, bottom: 300, left: 50, width: 40, right: 90, height: 10, x: 50, y: 290, toJSON() {} } as DOMRect;
        }
        return { top: 90, bottom: 100, left: 20, width: 40, right: 60, height: 10, x: 20, y: 90, toJSON() {} } as DOMRect;
      });

      await abrirConceitos();
      await userEvent.click(await screen.findByRole('button', { name: 'pendente' }));
      const balao1 = await screen.findByRole('dialog', { name: 'Definição: pendente' });
      const top1 = balao1.style.top;
      const seta1 = balao1.style.getPropertyValue('--seta');
      expect(top1).toBe('110px');

      const dialog = await screen.findByRole('dialog');
      const botaoPrevisto = within(dialog).getByRole('button', { name: 'Previsto' });
      await userEvent.click(botaoPrevisto);

      const balao2 = await screen.findByRole('dialog', { name: 'Definição: previsto' });
      const top2 = balao2.style.top;
      const seta2 = balao2.style.getPropertyValue('--seta');

      // Deve ser o mesmo balão, só com id trocado
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(top2).toBe(top1);
      expect(top2).toBe('110px');
      expect(seta2).toBe(seta1);
    } finally {
      spy.mockRestore();
    }
  });
});
