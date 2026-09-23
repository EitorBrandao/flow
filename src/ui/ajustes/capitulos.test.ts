import { describe, it, expect } from 'vitest';
import { NOMES, idDoCapitulo, parseCapitulo, sortearNomes, termosDoGlossario, validarLinks } from './capitulos';

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

  it('quebra o inline em forte, código e link externo', () => {
    const cap = parseCapitulo('t', '# T\n\numa **coisa** com `código` e [um link](https://exemplo.com).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'uma ' },
      { tipo: 'forte', texto: 'coisa' },
      { tipo: 'texto', texto: ' com ' },
      { tipo: 'codigo', texto: 'código' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'link', texto: 'um link', href: 'https://exemplo.com' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('lê link interno para capítulo e para seção', () => {
    const cap = parseCapitulo('t', '# T\n\nveja [o motor](#motor) e [a fronteira](#motor/fronteira-do-hoje-e-pendentes).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'veja ' },
      { tipo: 'ref', texto: 'o motor', capitulo: 'motor' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'ref', texto: 'a fronteira', capitulo: 'motor', secao: 'fronteira-do-hoje-e-pendentes' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('lê [[termo]] como link para o glossário, com e sem crase', () => {
    const cap = parseCapitulo('t', '# T\n\num [[box casa]] e um [[`efetivo`]].\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'um ' },
      { tipo: 'ref', texto: 'box casa', capitulo: 'glossario', secao: 'box-casa' },
      { tipo: 'texto', texto: ' e um ' },
      { tipo: 'ref', texto: 'efetivo', capitulo: 'glossario', secao: 'efetivo', codigo: true },
      { tipo: 'texto', texto: '.' },
    ]);
    expect(cap.texto).toContain('um box casa e um efetivo.');
  });

  it('recusa [[ ]] malformado e link interno com mais de uma barra', () => {
    expect(() => parseCapitulo('t', '# T\n\num [[termo] solto\n', NOMES_FIXOS)).toThrow(/não reconhecida/);
    expect(() => parseCapitulo('t', '# T\n\num termo]] solto\n', NOMES_FIXOS)).toThrow(/não reconhecida/);
    expect(() => parseCapitulo('t', '# T\n\n[x](#a/b/c)\n', NOMES_FIXOS)).toThrow(/link interno/);
  });

  it('dá id a cada termo de campos, sem crase e sem acento', () => {
    const cap = parseCapitulo('t', '# T\n\n: `efetivo` | confirmado\n: horizonte de projeção | até onde\n', NOMES_FIXOS);
    const campos = cap.blocos[0];
    if (campos.tipo !== 'campos') throw new Error('bloco errado');
    expect(campos.itens.map((i) => i.id)).toEqual(['efetivo', 'horizonte-de-projecao']);
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

  // Achado 1: *item colado (sem espaço) deve lançar
  it('lança quando asterisco colado sem espaço (*item)', () => {
    expect(() => parseCapitulo('t', '# T\n\n*item\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  // Achado 1: **negrito** no início deve ser parágrafo, não lançar
  it('aceita **negrito** no início de linha como parágrafo', () => {
    const cap = parseCapitulo('t', '# T\n\n**Obrigatórios:** valor, categoria.\n', NOMES_FIXOS);
    expect(cap.blocos).toHaveLength(1);
    expect(cap.blocos[0].tipo).toBe('paragrafo');
  });

  // Cobertura: tabulação no início deve lançar
  it('lança quando linha começa com tabulação', () => {
    expect(() => parseCapitulo('t', '# T\n\n\tindentado\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  // Cobertura: ![imagem] no início deve lançar
  it('lança quando linha começa com ![imagem]', () => {
    expect(() => parseCapitulo('t', '# T\n\n![alt](url)\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  // Achado 2: linha de campos sem pipe deve lançar
  it('lança quando linha de campos não tem pipe', () => {
    expect(() => parseCapitulo('t', '# T\n\n: sem pipe aqui\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  // Achado 3: segundo # deve lançar
  it('lança quando há segundo título (# ) no capítulo', () => {
    expect(() => parseCapitulo('t', '# Primeiro\n\nparágrafo\n\n# Segundo\n', NOMES_FIXOS)).toThrow(/título/);
  });
});

describe('idDoCapitulo', () => {
  it('tira pasta, extensão e número do nome do arquivo', () => {
    expect(idDoCapitulo('../../../docs/wiki/4-motor.md')).toBe('motor');
    expect(idDoCapitulo('8-glossario.md')).toBe('glossario');
    expect(idDoCapitulo('1-primeiros-passos')).toBe('primeiros-passos');
  });
});

describe('validarLinks', () => {
  const glossario = parseCapitulo('glossario', '# Glossário\n\n: pendente | espera confirmação\n', NOMES_FIXOS);
  const motor = parseCapitulo('motor', '# Motor\n\n## Fronteira do hoje\n\ntexto\n', NOMES_FIXOS);

  it('aceita destinos que existem', () => {
    const ok = parseCapitulo('conceitos', '# C\n\n[m](#motor), [f](#motor/fronteira-do-hoje) e [[pendente]].\n', NOMES_FIXOS);
    expect(validarLinks([glossario, motor, ok])).toEqual([]);
  });

  it('reprova capítulo, seção e termo inexistentes, dizendo onde está o link', () => {
    const ruim = parseCapitulo('conceitos', '# C\n\n- [x](#nada)\n- [y](#motor/sumiu)\n\n: campo | um [[inventado]]\n', NOMES_FIXOS);
    const erros = validarLinks([glossario, motor, ruim]);
    expect(erros).toHaveLength(3);
    expect(erros[0]).toMatch(/conceitos.*#nada/);
    expect(erros[1]).toMatch(/conceitos.*#motor\/sumiu/);
    expect(erros[2]).toMatch(/conceitos.*#glossario\/inventado/);
  });
});

describe('termosDoGlossario', () => {
  it('indexa termo e definição pelo id', () => {
    const g = parseCapitulo('glossario', '# Glossário\n\n: `efetivo` | Lançamento confirmado.\n', NOMES_FIXOS);
    const termos = termosDoGlossario(g);
    expect(termos.get('efetivo')?.definicao).toEqual([{ tipo: 'texto', texto: 'Lançamento confirmado.' }]);
  });
});

describe('capítulos de docs/wiki', () => {
  const brutos = import.meta.glob('../../../docs/wiki/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const arquivos = Object.entries(brutos).filter(([caminho]) => !caminho.endsWith('README.md'));

  it('existem nove capítulos numerados', () => {
    expect(arquivos).toHaveLength(9);
  });

  it.each(arquivos)('%s parseia e não deixa marcação crua', (caminho, raw) => {
    const cap = parseCapitulo(caminho, raw, NOMES_FIXOS);
    expect(cap.titulo.length).toBeGreaterThan(0);
    expect(cap.blocos.length).toBeGreaterThan(0);
    // marcação que sobrou é sinal de sintaxe que o parser não entendeu
    // asterisco duplo **, simples *, backtick, ](, ou {{
    expect(cap.texto).not.toMatch(/\*\*|\*|`|\]\(|\{\{/);
  });

  it('nenhum capítulo cita nome de pessoa fixo no lugar do marcador', () => {
    for (const [, raw] of arquivos) {
      expect(raw).not.toMatch(/\bAna\b|\bBruno\b/);
    }
  });

  it('todo link interno aponta para capítulo, seção ou termo que existe', () => {
    const caps = arquivos.map(([caminho, raw]) => parseCapitulo(idDoCapitulo(caminho), raw, NOMES_FIXOS));
    expect(validarLinks(caps)).toEqual([]);
  });

  it('os capítulos usam links internos (a conversão das referências em prosa aconteceu)', () => {
    const todos = arquivos.map(([, raw]) => raw).join('\n');
    expect(todos).toMatch(/\]\(#motor\/consolidacao-da-casa\)/);
    expect(todos).toMatch(/\[\[pendente\]\]/);
  });
});
