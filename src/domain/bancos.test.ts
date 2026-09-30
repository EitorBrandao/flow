import type { Banco, Cartao, Categoria, CompraCartao, Dados, Lancamento } from './types';
import {
  bancoIdDoCartao, bancoIdDoLancamento, bancoPadrao, bancosDaBox, dadosDoBanco, lancamentoNoFiltro,
  nomeBancoDoLancamento, saldoCalculadoBanco, totalDeclaradoCent,
} from './bancos';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };

function banco(id: string, boxId: string, nome: string, ordem: number, declarado: number | null): Banco {
  return { id, boxId, nome, ordem, saldoDeclaradoCent: declarado, dataSaldoDeclarado: declarado != null ? '2026-08-01' : null, ...ts };
}

const cat = (id: string, tipo: 'ganho' | 'gasto'): Categoria => (
  { id, boxId: 'box1', nome: id, tipo, ordem: 0, arquivada: false, ...ts }
);
const CATEGORIAS = [cat('gasto', 'gasto'), cat('ganho', 'ganho')];

function lanc(id: string, patch: Partial<Lancamento>): Lancamento {
  return {
    id, boxId: 'box1', categoriaId: 'gasto', data: '2026-08-02', valor: 1000,
    status: 'efetivo', origem: 'manual', ...ts, ...patch,
  };
}

function cartao(id: string, bancoId?: string): Cartao {
  return {
    id, boxId: 'box1', nome: 'Cartão', diaFechamento: 10, diaVencimento: 20,
    categoriaFaturaId: 'catfat', ativo: true, ...(bancoId ? { bancoId } : {}), ...ts,
  };
}

function compra(id: string, cartaoId: string): CompraCartao {
  return {
    id, cartaoId, categoriaCartaoId: 'cc', data: '2026-08-02', valorTotal: 1000, parcelas: 1, ...ts,
  };
}

function dadosCom(parcial: Partial<Dados>): Dados {
  return {
    boxes: [], categorias: CATEGORIAS, lancamentos: [], recorrencias: [], cenarios: [], cartoes: [],
    categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
      horizonteProjecao: '2027-12-31',
    },
    ...parcial,
  };
}

describe('bancosDaBox', () => {
  it('filtra pelas boxes pedidas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.id)).toEqual(['b1']);
  });

  it('ordena por ordem e desempata por nome', () => {
    // nomes escolhidos para que a ordenação correta DIVIRJA da puramente alfabética:
    // só por nome daria ['Apple', 'Mango', 'Zebra'], que não é o esperado abaixo
    const bancos = [
      banco('b1', 'box1', 'Zebra', 0, null),
      banco('b2', 'box1', 'Apple', 1, null),
      banco('b3', 'box1', 'Mango', 0, null),
    ];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.nome)).toEqual(['Mango', 'Zebra', 'Apple']);
  });

  it('boxes múltiplas (visão casa) trazem os bancos de todas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1', 'box2'])).toHaveLength(2);
  });
});

describe('totalDeclaradoCent', () => {
  it('soma só os informados, ignorando os nulos', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, 50000), banco('b2', 'box1', 'Beta', 1, null), banco('b3', 'box1', 'Gama', 2, 30000)];
    expect(totalDeclaradoCent(bancos)).toBe(80000);
  });

  it('devolve null quando nenhum banco foi informado', () => {
    // distinguir "informou zero" de "não informou" é o que impede a tela de afirmar
    // uma diferença que não existe
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box1', 'Beta', 1, null)];
    expect(totalDeclaradoCent(bancos)).toBe(null);
  });

  it('zero informado conta como informado, e não como ausente', () => {
    expect(totalDeclaradoCent([banco('b1', 'box1', 'Alfa', 0, 0)])).toBe(0);
  });

  it('zero misturado com não informados devolve 0, não null', () => {
    // se a função filtrasse por valor "falsy" em vez de por `!= null`, o zero sumiria
    // e o resultado viraria null — a tela então acusaria uma diferença inexistente
    const bancos = [banco('b1', 'box1', 'Alfa', 0, 0), banco('b2', 'box1', 'Beta', 1, null)];
    expect(totalDeclaradoCent(bancos)).toBe(0);
  });

  it('lista vazia devolve null', () => {
    expect(totalDeclaradoCent([])).toBe(null);
  });
});

describe('bancoPadrao', () => {
  it('devolve o banco marcado como padrão', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), { ...banco('b2', 'box1', 'Beta', 1, null), padrao: true }];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });

  it('sem nenhuma marca, devolve o primeiro por ordem', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 1, null), banco('b2', 'box1', 'Beta', 0, null)];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });

  it('box sem bancos devolve undefined', () => {
    expect(bancoPadrao([], 'box1')).toBeUndefined();
  });

  it('ignora o padrão marcado numa box diferente', () => {
    const bancos = [{ ...banco('b1', 'box2', 'Alfa', 0, null), padrao: true }];
    expect(bancoPadrao(bancos, 'box1')).toBeUndefined();
  });

  it('duas marcadas (backup mesclado): vale a primeira por ordem', () => {
    const bancos = [
      { ...banco('b1', 'box1', 'Alfa', 1, null), padrao: true },
      { ...banco('b2', 'box1', 'Beta', 0, null), padrao: true },
    ];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });
});

describe('bancoIdDoCartao', () => {
  const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box1', 'Beta', 1, null)];

  it('devolve o banco do cartão', () => {
    expect(bancoIdDoCartao(cartao('c1', 'b2'), bancos)).toBe('b2');
  });

  it('cartão sem banco usa o padrão da box', () => {
    expect(bancoIdDoCartao(cartao('c1'), bancos)).toBe('b1');
  });

  it('banco do cartão que não existe mais cai no padrão', () => {
    expect(bancoIdDoCartao(cartao('c1', 'fantasma'), bancos)).toBe('b1');
  });

  it('box sem bancos devolve undefined', () => {
    expect(bancoIdDoCartao(cartao('c1'), [])).toBeUndefined();
  });
});

describe('bancoIdDoLancamento', () => {
  const bancos = [banco('b1', 'box1', 'Alfa', 0, null)];

  it('devolve o banco gravado', () => {
    expect(bancoIdDoLancamento(lanc('l1', { bancoId: 'b1' }), [], bancos)).toBe('b1');
  });

  it('lançamento sem banco devolve undefined', () => {
    expect(bancoIdDoLancamento(lanc('l1', {}), [], bancos)).toBeUndefined();
  });

  it('banco que não existe mais conta como sem banco', () => {
    expect(bancoIdDoLancamento(lanc('l1', { bancoId: 'fantasma' }), [], bancos)).toBeUndefined();
  });

  it('fatura sem banco gravado usa o banco do cartão, nunca o padrão', () => {
    const l = lanc('l1', { origem: 'cartao', cartaoId: 'c1', faturaMes: '2026-08' });
    expect(bancoIdDoLancamento(l, [cartao('c1', 'b1')], bancos)).toBe('b1');
    expect(bancoIdDoLancamento(l, [cartao('c1')], bancos)).toBeUndefined();
  });

  it('lançamento manual não herda o banco de nenhum cartão', () => {
    const l = lanc('l1', { cartaoId: 'c1' });
    expect(bancoIdDoLancamento(l, [cartao('c1', 'b1')], bancos)).toBeUndefined();
  });
});

describe('saldoCalculadoBanco', () => {
  const b1 = banco('b1', 'box1', 'Alfa', 0, 100000); // informado em 2026-08-01
  const b2 = banco('b2', 'box1', 'Beta', 1, null);
  const base = { categorias: CATEGORIAS, cartoes: [] as Cartao[], bancos: [b1, b2] };

  it('sem saldo informado devolve null', () => {
    expect(saldoCalculadoBanco(b2, { ...base, lancamentos: [] })).toBeNull();
  });

  it('soma o ganho e subtrai o gasto posteriores ao saldo informado', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', valor: 2000 }),
      lanc('l2', { bancoId: 'b1', categoriaId: 'ganho', valor: 5000, data: '2026-08-03' }),
    ];
    // 100000 - 2000 + 5000
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(103000);
  });

  it('lançamento na própria data do saldo, ou antes, já está no saldo informado', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', valor: 999, data: '2026-08-01' }),
      lanc('l2', { bancoId: 'b1', valor: 999, data: '2026-07-31' }),
    ];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });

  it('ignora previsto, cenário, lançamento sem banco e lançamento de outro banco', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', status: 'previsto' }),
      lanc('l2', { bancoId: 'b1', cenarioId: 'c1', status: 'previsto' }),
      lanc('l3', {}),
      lanc('l4', { bancoId: 'b2' }),
    ];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });

  it('estorno (valor negativo num gasto) devolve o dinheiro ao saldo', () => {
    const lancamentos = [lanc('l1', { bancoId: 'b1', valor: -300 })];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100300);
  });

  it('fatura efetiva sem banco gravado sai do banco do cartão', () => {
    const fatura = lanc('l1', { origem: 'cartao', cartaoId: 'c1', faturaMes: '2026-08', valor: 4000 });
    expect(saldoCalculadoBanco(b1, { ...base, cartoes: [cartao('c1', 'b1')], lancamentos: [fatura] })).toBe(96000);
    expect(saldoCalculadoBanco(b1, { ...base, cartoes: [cartao('c1')], lancamentos: [fatura] })).toBe(100000);
  });

  it('referência a banco inexistente conta como sem banco', () => {
    const lancamentos = [lanc('l1', { bancoId: 'fantasma' })];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });
});

describe('filtro por banco', () => {
  const b1 = banco('b1', 'box1', 'Alfa', 0, null);
  const b2 = banco('b2', 'box1', 'Beta', 1, null);
  const lancamentos = [
    lanc('no-b1', { bancoId: 'b1' }),
    lanc('no-b2', { bancoId: 'b2' }),
    lanc('sem-banco', {}),
  ];
  // c-b2 aponta para b2; c-livre não tem banco e cai no padrão da box (b1, primeiro por ordem)
  const cartoes = [cartao('c-b2', 'b2'), cartao('c-livre')];
  const comprasCartao = [compra('k-b2', 'c-b2'), compra('k-livre', 'c-livre')];
  const dados = dadosCom({ lancamentos, cartoes, comprasCartao, bancos: [b1, b2] });

  it('"todos" devolve os mesmos dados', () => {
    expect(dadosDoBanco(dados, 'todos')).toBe(dados);
  });

  it('um banco fica com os lançamentos dele e com as compras dos cartões dele', () => {
    const f = dadosDoBanco(dados, 'b2');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['no-b2']);
    expect(f.comprasCartao.map((c) => c.id)).toEqual(['k-b2']);
  });

  it('cartão sem banco conta no banco padrão', () => {
    const f = dadosDoBanco(dados, 'b1');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['no-b1']);
    expect(f.comprasCartao.map((c) => c.id)).toEqual(['k-livre']);
  });

  it('"sem-banco" fica só com o que não tem banco', () => {
    const f = dadosDoBanco(dados, 'sem-banco');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['sem-banco']);
    expect(f.comprasCartao).toEqual([]);
  });

  it('lancamentoNoFiltro segue a mesma regra, lançamento a lançamento', () => {
    const [noB1, noB2, semBanco] = lancamentos;
    expect(lancamentoNoFiltro(noB1, 'todos', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB1, 'b1', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB2, 'b1', cartoes, [b1, b2])).toBe(false);
    expect(lancamentoNoFiltro(semBanco, 'sem-banco', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB1, 'sem-banco', cartoes, [b1, b2])).toBe(false);
  });

  it('nomeBancoDoLancamento dá o nome, ou "Sem banco"', () => {
    const d = { cartoes, bancos: [b1, b2] };
    expect(nomeBancoDoLancamento(lancamentos[0], d)).toBe('Alfa');
    expect(nomeBancoDoLancamento(lancamentos[2], d)).toBe('Sem banco');
  });
});
