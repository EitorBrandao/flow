import type { Cartao, Categoria, CategoriaCartao, Lancamento } from './types';
import { compararCategorias, compararCategoriasCartao, diffOrdem, proximaOrdem, categoriasCartaoReservadasIds, unificarCategoriasPorNome } from './categorias';

const ts = { criadoEm: '2026-07-10T12:00:00.000Z', alteradoEm: '2026-07-10T12:00:00.000Z' };

const salario: Categoria = { id: 'sal', boxId: 'b', nome: 'salário', tipo: 'ganho', ordem: 2, arquivada: false, ...ts };
const aluguel: Categoria = { id: 'alu', boxId: 'b', nome: 'aluguel', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const mercado: Categoria = { id: 'mer', boxId: 'b', nome: 'mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...ts };
const pix: Categoria = { id: 'pix', boxId: 'b', nome: 'pix', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const salarioArquivado: Categoria = { id: 'sal-arq', boxId: 'b', nome: 'salário antigo', tipo: 'ganho', ordem: 0, arquivada: true, ...ts };
const aluguelArquivado: Categoria = { id: 'alu-arq', boxId: 'b', nome: 'aluguel antigo', tipo: 'gasto', ordem: 0, arquivada: true, ...ts };

it('ganhos vêm antes de gastos, mesmo com ordem maior', () => {
  expect([mercado, salario].sort(compararCategorias).map((c) => c.id)).toEqual(['sal', 'mer']);
});

it('dentro do mesmo tipo, ordena pela ordem definida', () => {
  expect([mercado, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'mer']);
});

it('empate de ordem desempata por nome', () => {
  expect([pix, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'pix']);
});

it('arquivadas vêm sempre por último, mesmo com ordem menor que as ativas', () => {
  expect([salarioArquivado, mercado].sort(compararCategorias).map((c) => c.id)).toEqual(['mer', 'sal-arq']);
});

it('arquivadas de tipos diferentes se misturam na mesma seção, por ordem e depois nome', () => {
  expect([salarioArquivado, aluguelArquivado].sort(compararCategorias).map((c) => c.id)).toEqual(['alu-arq', 'sal-arq']);
});

const catsCartao: CategoriaCartao[] = [
  { id: 'c1', cartaoId: 'k', nome: 'streaming', ordem: 1, arquivada: false, ...ts },
  { id: 'c2', cartaoId: 'k', nome: 'mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'c3', cartaoId: 'k', nome: 'farmácia', ordem: 0, arquivada: false, ...ts },
];
const catCartaoArquivada: CategoriaCartao = { id: 'c4', cartaoId: 'k', nome: 'antiga', ordem: 0, arquivada: true, ...ts };

it('categorias de cartão: ordem, depois nome', () => {
  expect([...catsCartao].sort(compararCategoriasCartao).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
});

it('categorias de cartão arquivadas vêm sempre por último', () => {
  expect([catCartaoArquivada, ...catsCartao].sort(compararCategoriasCartao).map((c) => c.id))
    .toEqual(['c3', 'c2', 'c1', 'c4']);
});

it('proximaOrdem: grupo vazio começa em 0', () => {
  expect(proximaOrdem([])).toBe(0);
});

it('proximaOrdem: continua depois do maior ordem existente no grupo', () => {
  expect(proximaOrdem([{ ordem: 3 }, { ordem: 1 }])).toBe(4);
});

it('diffOrdem: nenhuma mudança quando a ordem já bate com o índice', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([]);
});

it('diffOrdem: recalcula só os itens que mudaram de posição', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'c', ordem: 2 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([{ id: 'c', ordem: 1 }, { id: 'b', ordem: 2 }]);
});

function cartao(id: string, categoriaAssinaturasId?: string, categoriaParcelamentoId?: string): Cartao {
  return {
    id, boxId: 'b1', nome: `cartao-${id}`, diaFechamento: 10, diaVencimento: 20,
    categoriaFaturaId: `fat-${id}`, categoriaAssinaturasId, categoriaParcelamentoId, ativo: true,
    criadoEm: '', alteradoEm: '',
  };
}

describe('categoriasCartaoReservadasIds', () => {
  it('retorna só os ids de categoriaAssinaturasId definidos', () => {
    const cartoes = [cartao('k1', 'ass1'), cartao('k2'), cartao('k3', 'ass3')];
    expect(categoriasCartaoReservadasIds(cartoes)).toEqual(new Set(['ass1', 'ass3']));
  });

  it('junta as categorias de assinaturas e de parcelamento do mesmo cartão', () => {
    expect(categoriasCartaoReservadasIds([cartao('k1', 'ass1', 'parc1')]))
      .toEqual(new Set(['ass1', 'parc1']));
  });

  it('inclui a de parcelamento mesmo quando o cartão nunca teve assinatura', () => {
    expect(categoriasCartaoReservadasIds([cartao('k1', undefined, 'parc1')]))
      .toEqual(new Set(['parc1']));
  });

  it('retorna conjunto vazio quando nenhum cartão tem categoria reservada', () => {
    expect(categoriasCartaoReservadasIds([cartao('k1')])).toEqual(new Set());
  });
});


describe('unificarCategoriasPorNome', () => {
  const c = (id: string, boxId: string, nome: string, tipo: 'ganho' | 'gasto' = 'gasto', extra: Partial<Categoria> = {}): Categoria =>
    ({ id, boxId, nome, tipo, ordem: 0, arquivada: false, ...ts, ...extra });
  const l = (id: string, boxId: string, categoriaId: string, valor = 10000): Lancamento =>
    ({ id, boxId, categoriaId, data: '2026-07-10', valor, status: 'efetivo', origem: 'manual', ...ts });
  const nenhuma = new Set<string>();

  it('junta "mercado" e "Mercado" de boxes diferentes num grupo só', () => {
    const cats = [c('c-ana', 'ana', 'mercado'), c('c-bruno', 'bruno', 'Mercado')];
    const lancs = [l('l1', 'ana', 'c-ana'), l('l2', 'bruno', 'c-bruno')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias).toHaveLength(1);
    expect(r.categorias[0].id).toBe('c-ana');
    expect(r.categorias[0].nome).toBe('mercado');
    expect(r.lancamentos.map((x) => x.categoriaId)).toEqual(['c-ana', 'c-ana']);
  });

  it('trata "Cafe", "Café" e "CAFÉ" como um grupo só', () => {
    const cats = [c('a', 'ana', 'Cafe'), c('b', 'bruno', 'Café'), c('c', 'casa', 'CAFÉ')];
    const r = unificarCategoriasPorNome(cats, [], nenhuma);
    expect(r.categorias).toHaveLength(1);
    expect(r.categorias[0].id).toBe('a');
  });

  it('mantém dois grupos quando o tipo é diferente', () => {
    const cats = [c('g1', 'ana', 'mercado', 'gasto'), c('g2', 'bruno', 'mercado', 'ganho')];
    const lancs = [l('l1', 'ana', 'g1'), l('l2', 'bruno', 'g2')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias).toHaveLength(2);
    expect(r.lancamentos.map((x) => x.categoriaId)).toEqual(['g1', 'g2']);
  });

  it('ignora espaços nas pontas do nome', () => {
    const cats = [c('a', 'ana', '  mercado '), c('b', 'bruno', 'mercado')];
    const lancs = [l('l1', 'bruno', 'b')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias).toHaveLength(1);
    expect(r.categorias[0].id).toBe('a');
    expect(r.lancamentos[0].categoriaId).toBe('a');
  });

  it('não junta categoria oculta: ela fica no resultado e seus lançamentos não mudam', () => {
    const cats = [c('a', 'ana', 'fatura'), c('b', 'bruno', 'fatura')];
    const lancs = [l('l1', 'ana', 'a'), l('l2', 'bruno', 'b')];
    const r = unificarCategoriasPorNome(cats, lancs, new Set(['b']));
    expect(r.categorias.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.lancamentos.map((x) => x.categoriaId)).toEqual(['a', 'b']);
  });

  it('escolhe a categoria ativa como representante quando há arquivada e ativa', () => {
    const cats = [c('arq', 'ana', 'mercado', 'gasto', { arquivada: true }), c('ativa', 'bruno', 'mercado', 'gasto', { ordem: 5 })];
    const lancs = [l('l1', 'ana', 'arq')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias.map((x) => x.id)).toEqual(['ativa']);
    expect(r.lancamentos[0].categoriaId).toBe('ativa');
  });

  it('escolhe a primeira arquivada na ordem quando todas são arquivadas', () => {
    const cats = [
      c('arq2', 'ana', 'mercado', 'gasto', { arquivada: true, ordem: 3 }),
      c('arq1', 'bruno', 'mercado', 'gasto', { arquivada: true, ordem: 1 }),
    ];
    const lancs = [l('l1', 'ana', 'arq2')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias.map((x) => x.id)).toEqual(['arq1']);
    expect(r.lancamentos[0].categoriaId).toBe('arq1');
  });

  it('preserva boxId, valor, data e id dos lançamentos', () => {
    const cats = [c('a', 'ana', 'mercado'), c('b', 'bruno', 'mercado')];
    const original = l('l2', 'bruno', 'b', 25000);
    const r = unificarCategoriasPorNome(cats, [original], nenhuma);
    expect(r.lancamentos[0]).toEqual({ ...original, categoriaId: 'a' });
    expect(r.lancamentos[0].boxId).toBe('bruno');
    expect(r.lancamentos[0].valor).toBe(25000);
    expect(r.lancamentos[0].data).toBe('2026-07-10');
    expect(r.lancamentos[0].id).toBe('l2');
  });

  it('não altera as entradas', () => {
    const cats = Object.freeze([c('a', 'ana', 'mercado'), c('b', 'bruno', 'mercado')].map((x) => Object.freeze(x))) as Categoria[];
    const lancs = Object.freeze([l('l1', 'bruno', 'b')].map((x) => Object.freeze(x))) as Lancamento[];
    const ocultas = new Set<string>();
    expect(() => unificarCategoriasPorNome(cats, lancs, ocultas)).not.toThrow();
    expect(lancs[0].categoriaId).toBe('b');
    expect(cats).toHaveLength(2);
  });

  it('junta também a categoria sem lançamento', () => {
    const cats = [c('a', 'ana', 'mercado'), c('b', 'bruno', 'mercado')];
    const r = unificarCategoriasPorNome(cats, [], nenhuma);
    expect(r.categorias.map((x) => x.id)).toEqual(['a']);
    expect(r.lancamentos).toEqual([]);
  });

  it('devolve o mesmo conteúdo quando não há grupo repetido', () => {
    const cats = [c('a', 'ana', 'mercado'), c('b', 'bruno', 'aluguel')];
    const lancs = [l('l1', 'ana', 'a'), l('l2', 'bruno', 'b')];
    const r = unificarCategoriasPorNome(cats, lancs, nenhuma);
    expect(r.categorias).toEqual(cats);
    expect(r.lancamentos).toEqual(lancs);
  });
});
