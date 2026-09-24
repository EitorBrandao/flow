import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wiki from './Wiki';
import { normalizar } from './capitulos';

describe('Wiki', () => {
  const propriedadesAlteradas: Array<[object, string, PropertyDescriptor | undefined]> = [];
  function definirPropriedade(alvo: object, prop: string, valor: unknown) {
    propriedadesAlteradas.push([alvo, prop, Object.getOwnPropertyDescriptor(alvo, prop)]);
    Object.defineProperty(alvo, prop, { configurable: true, value: valor });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [alvo, prop, descritor] of propriedadesAlteradas.splice(0)) {
      if (descritor) Object.defineProperty(alvo, prop, descritor);
      else delete (alvo as Record<string, unknown>)[prop];
    }
  });

  it('abre no primeiro capítulo', async () => {
    render(<Wiki />);
    expect(await screen.findByRole('heading', { name: 'Os primeiros passos' })).toBeInTheDocument();
  });

  it('troca de capítulo pelo índice', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Glossário' }));
    expect(await screen.findByRole('heading', { name: 'Glossário' })).toBeInTheDocument();
  });

  it('a busca mostra onde o termo está, com o trecho destacado, sem acento e sem caixa', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'CREDITO');
    const resultados = await screen.findAllByRole('button', { name: /^Cartão de crédito/ });
    for (const r of resultados) expect(normalizar(r.querySelector('mark')!.textContent!)).toBe('credito');
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();
  });

  it('a busca acha pelo texto, não só pelo título, e o resultado leva à seção', async () => {
    const original = Element.prototype.scrollIntoView;
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    try {
      render(<Wiki />);
      await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
      await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'pendente');
      const [r] = await screen.findAllByRole('button', { name: /^Conceitos e modelo de dados · / });
      const secao = r.querySelector('.wiki-resultado-onde')!.textContent!.split(' · ')[1];
      await userEvent.click(r);
      expect(await screen.findByRole('heading', { name: 'Conceitos e modelo de dados' })).toBeInTheDocument();
      expect((rolar.mock.contexts.at(-1) as HTMLElement).textContent).toBe(secao);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('avisa quando a busca não acha nada', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'jabuticaba');
    expect(await screen.findByText(/nada encontrado/i)).toBeInTheDocument();
  });

  it('usa nomes do conjunto nos exemplos, nunca um nome fixo', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Conceitos e modelo de dados' }));
    const corpo = await screen.findByRole('article');
    expect(corpo.textContent).not.toMatch(/\{\{/);
  });

  async function abrirConceitos() {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
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
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Código e versão' }));
    const link = await screen.findByRole('link', { name: /github\.com\/EitorBrandao\/flow/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('balão no Glossário mostra definição de link interno', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
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

  it('a barra do índice mostra o capítulo atual', async () => {
    render(<Wiki />);
    await screen.findByRole('article');
    expect(screen.getByRole('button', { name: /^Índice/ })).toHaveTextContent('Os primeiros passos');
  });

  function simularPosicoes(titulos: Element[], passaram: number) {
    // Barra: topo 0, base 20. Títulos até `passaram` já subiram além da barra; os demais estão abaixo.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = titulos.indexOf(this);
      const top = i === -1 ? 0 : i < passaram ? -100 + i : 500;
      return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} } as DOMRect;
    });
    // Página bem mais alta que a tela: não está no fim, então vale só a regra normal (base da barra).
    definirPropriedade(document.documentElement, 'scrollHeight', 100000);
  }

  it('a barra mostra a última seção que passou por baixo dela', async () => {
    render(<Wiki />);
    const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
    expect(titulos.length).toBeGreaterThan(2);
    simularPosicoes(titulos, 2);
    fireEvent.scroll(window);
    expect(screen.getByRole('button', { name: /^Índice/ }))
      .toHaveTextContent(`Os primeiros passos · ${titulos[1].textContent}`);
  });

  it('antes da primeira seção, a barra mostra só o capítulo', async () => {
    render(<Wiki />);
    const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
    simularPosicoes(titulos, 0);
    fireEvent.scroll(window);
    expect(screen.getByRole('button', { name: /^Índice/ }).textContent).not.toContain('·');
  });

  function simularPosicoesExplicitas(titulos: Element[], tops: number[]) {
    // Barra: topo 0, base 20 (igual a simularPosicoes). Cada título usa o topo dado em `tops`.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = titulos.indexOf(this);
      const top = i === -1 ? 0 : tops[i];
      return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} } as DOMRect;
    });
  }

  // Só o primeiro título passou da barra; os dois últimos, embora não tenham passado, já estão visíveis na tela.
  function tituloTopos(n: number) {
    const tops = new Array(n).fill(400);
    tops[0] = -50;
    tops[n - 2] = 200;
    tops[n - 1] = 250;
    return tops;
  }

  describe('fim da página', () => {
    it('no fim da página, a barra mostra o último título visível, mesmo que não tenha passado por baixo dela', async () => {
      render(<Wiki />);
      const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
      expect(titulos.length).toBeGreaterThan(2);
      simularPosicoesExplicitas(titulos, tituloTopos(titulos.length));
      definirPropriedade(window, 'innerHeight', 300);
      definirPropriedade(window, 'scrollY', 700);
      definirPropriedade(document.documentElement, 'scrollHeight', 1000);
      fireEvent.scroll(window);
      expect(screen.getByRole('button', { name: /^Índice/ }))
        .toHaveTextContent(`Os primeiros passos · ${titulos.at(-1)!.textContent}`);
    });

    it('fora do fim da página, as mesmas posições valem a regra normal (mostra o primeiro título)', async () => {
      render(<Wiki />);
      const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
      expect(titulos.length).toBeGreaterThan(2);
      simularPosicoesExplicitas(titulos, tituloTopos(titulos.length));
      definirPropriedade(window, 'innerHeight', 300);
      definirPropriedade(window, 'scrollY', 0);
      definirPropriedade(document.documentElement, 'scrollHeight', 1000);
      fireEvent.scroll(window);
      expect(screen.getByRole('button', { name: /^Índice/ }))
        .toHaveTextContent(`Os primeiros passos · ${titulos[0].textContent}`);
    });

    it('página que cabe na tela, sem rolagem, segue a regra normal', async () => {
      render(<Wiki />);
      const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
      simularPosicoesExplicitas(titulos, tituloTopos(titulos.length));
      definirPropriedade(window, 'innerHeight', 1000);
      definirPropriedade(window, 'scrollY', 0);
      definirPropriedade(document.documentElement, 'scrollHeight', 1000);
      fireEvent.scroll(window);
      expect(screen.getByRole('button', { name: /^Índice/ }))
        .toHaveTextContent(`Os primeiros passos · ${titulos[0].textContent}`);
    });
  });

  it('a gaveta lista as seções do capítulo atual e leva até a seção', async () => {
    const original = Element.prototype.scrollIntoView; // jsdom não implementa
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    try {
      await abrirConceitos();
      const titulos = [...screen.getByRole('article').querySelectorAll('h3[id]')];
      await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
      const gaveta = screen.getByRole('navigation');
      for (const t of titulos) expect(within(gaveta).getByRole('button', { name: t.textContent! })).toBeInTheDocument();
      await userEvent.click(within(gaveta).getByRole('button', { name: titulos[2].textContent! }));
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(rolar.mock.contexts.at(-1)).toBe(titulos[2]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('a gaveta não expande capítulos que não são o atual', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
    // "Box" é seção de Conceitos; o capítulo atual é Os primeiros passos.
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Box' })).not.toBeInTheDocument();
  });

  it('trocar de capítulo pela gaveta volta ao topo do capítulo novo', async () => {
    const original = Element.prototype.scrollIntoView; // jsdom não implementa
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    try {
      render(<Wiki />);
      const artigo = await screen.findByRole('article');
      await userEvent.click(screen.getByRole('button', { name: /^Índice/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Glossário' }));
      expect(await screen.findByRole('heading', { name: 'Glossário' })).toBeInTheDocument();
      expect(rolar.mock.contexts.at(-1)).toBe(artigo);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
