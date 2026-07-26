import { describe, it, expect } from 'vitest';
import { NOMES, parseCapitulo, sortearNomes } from './wiki';

const NOMES_FIXOS = { a: 'Ana', b: 'Bruno' };

describe('sortearNomes', () => {
  it('devolve dois nomes distintos do conjunto', () => {
    const { a, b } = sortearNomes(() => 0.5);
    expect(NOMES).toContain(a);
    expect(NOMES).toContain(b);
    expect(a).not.toBe(b);
  });

  it('nunca repete o nome, mesmo quando o sorteio cai no mesmo índice', () => {
    // aleatorio() constante = i e j calculados a partir do mesmo número
    for (const constante of [0, 0.25, 0.5, 0.75, 0.999]) {
      const { a, b } = sortearNomes(() => constante);
      expect(a).not.toBe(b);
    }
  });
});

describe('parseCapitulo', () => {
  it('lê o título e os blocos na ordem', () => {
    const cap = parseCapitulo('teste', '# Primeiros passos\n\nUm parágrafo.\n\n## A primeira box\n\n- item um\n- item dois\n', NOMES_FIXOS);
    expect(cap.id).toBe('teste');
    expect(cap.titulo).toBe('Primeiros passos');
    expect(cap.blocos.map((b) => b.tipo)).toEqual(['paragrafo', 'topico', 'lista']);
  });

  it('junta linhas seguidas num parágrafo só', () => {
    const cap = parseCapitulo('t', '# T\n\nlinha um\nlinha dois\n\nlinha três\n', NOMES_FIXOS);
    const paragrafos = cap.blocos.filter((b) => b.tipo === 'paragrafo');
    expect(paragrafos).toHaveLength(2);
    expect(cap.texto).toContain('linha um linha dois');
  });

  it('reconhece nota, campos e lista', () => {
    const raw = '# T\n\n> uma nota\n\n: `saldoInicial` | centavos\n: `ativa` | pausar não apaga\n\n- só um item\n';
    const cap = parseCapitulo('t', raw, NOMES_FIXOS);
    expect(cap.blocos.map((b) => b.tipo)).toEqual(['nota', 'campos', 'lista']);
    const campos = cap.blocos[1];
    if (campos.tipo !== 'campos') throw new Error('bloco errado');
    expect(campos.itens).toHaveLength(2);
    expect(campos.itens[0].termo[0]).toEqual({ tipo: 'codigo', texto: 'saldoInicial' });
  });

  it('quebra o inline em forte, código e link', () => {
    const cap = parseCapitulo('t', '# T\n\numa **coisa** com `código` e [um link](#box).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'uma ' },
      { tipo: 'forte', texto: 'coisa' },
      { tipo: 'texto', texto: ' com ' },
      { tipo: 'codigo', texto: 'código' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'link', texto: 'um link', href: '#box' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('troca os marcadores de nome, em prosa e em nome de box', () => {
    const cap = parseCapitulo('t', '# T\n\n{{nomeA}} e {{nomeB}} usam `{{boxA}}` e `{{boxB}}`.\n', NOMES_FIXOS);
    expect(cap.texto).toContain('Ana e Bruno usam ana e bruno');
  });

  it('recusa sintaxe fora do subconjunto', () => {
    expect(() => parseCapitulo('t', '# T\n\n### fundo demais\n', NOMES_FIXOS)).toThrow(/não suportada/);
    expect(() => parseCapitulo('t', '# T\n\n| a | b |\n', NOMES_FIXOS)).toThrow(/não suportada/);
    expect(() => parseCapitulo('t', '# T\n\n1. primeiro\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  it('recusa capítulo sem título', () => {
    expect(() => parseCapitulo('t', 'sem título\n', NOMES_FIXOS)).toThrow(/título/);
  });
});
