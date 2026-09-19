import { describe, expect, it } from 'vitest';
import type { CompraCartao, Dados, Lancamento } from '../domain/types';
import {
  acaoEfetiva, chaveDoItem, conferir, totalCorrigidoValido, totalEfetivo,
} from './conferencia';
import type { ItemConferencia, LancamentoBruto, LeituraAdapter } from './tipos';

const BOX = 'box-1';
const CAT = 'cat-1';
const CAT_GANHO = 'cat-ganho-1';
const CARTAO = 'cartao-1';
const CAT_CARTAO = 'catcartao-1';

function lancamento(p: Partial<Lancamento> & { data: string; valor: number }): Lancamento {
  return {
    id: p.id ?? `l-${p.data}-${p.valor}`,
    boxId: BOX, categoriaId: CAT, nota: p.nota,
    status: p.status ?? 'efetivo', origem: p.origem ?? 'manual',
    criadoEm: '2026-08-01T00:00:00.000Z', alteradoEm: '2026-08-01T00:00:00.000Z',
    ...p,
  } as Lancamento;
}

function dadosCom(lancamentos: Lancamento[], comprasCartao: CompraCartao[] = []): Dados {
  return {
    boxes: [], categorias: [], lancamentos, recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao, recorrenciasCartao: [],
    conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: BOX, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
  };
}

function compraCartao(p: Partial<CompraCartao> & { data: string; valorTotal: number }): CompraCartao {
  return {
    id: p.id ?? `c-${p.data}-${p.valorTotal}`,
    cartaoId: CARTAO, categoriaCartaoId: CAT_CARTAO, parcelas: 1,
    criadoEm: '2026-08-01T00:00:00.000Z', alteradoEm: '2026-08-01T00:00:00.000Z',
    ...p,
  } as CompraCartao;
}

function bruto(p: Partial<LancamentoBruto> & { data: string; valorCent: number }): LancamentoBruto {
  return { descricao: 'LOJA GAMA', fonte: 'conta', ...p };
}

const OPCOES = { boxId: BOX, categoriasPadrao: { ganho: CAT_GANHO, gasto: CAT }, cartaoId: CARTAO,
                 categoriaCartaoPadraoId: CAT_CARTAO };

describe('conferir', () => {
  it('marca confere quando já existe lançamento igual', () => {
    const d = dadosCom([lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA' })]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    expect(itens[0].estado).toBe('confere');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('marca previsto e propõe confirmar', () => {
    const d = dadosCom([
      lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA', status: 'previsto' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    expect(itens[0].estado).toBe('previsto');
    expect(itens[0].acao.tipo).toBe('confirmar');
  });

  it('marca divergente e propõe o valor do banco', () => {
    const d = dadosCom([
      lancamento({ data: '2026-08-15', valor: 12000, nota: 'LOJA GAMA', status: 'previsto' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -13700 })], d, OPCOES);
    expect(itens[0].estado).toBe('divergente');
    expect(itens[0].acao).toEqual({ tipo: 'confirmarComValor', valorCent: 13700, data: '2026-08-15' });
  });

  it('marca novo e propõe adicionar na categoria padrão', () => {
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao).toEqual({ tipo: 'adicionarLancamento', categoriaId: CAT });
  });

  it('não marca sobra para lançamento fora do período, mesmo por um dia', () => {
    const d = dadosCom([
      lancamento({ id: 'sobrando', data: '2026-08-16', valor: 1000, nota: 'POSTO BETA' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    const sobra = itens.find((i) => i.estado === 'sobra');
    expect(sobra).toBeUndefined(); // 16/08 está fora do período [15/08, 15/08]
  });

  it('não marca sobra fora do período coberto pelo arquivo', () => {
    const d = dadosCom([
      lancamento({ id: 'antigo', data: '2026-01-01', valor: 1000, nota: 'POSTO BETA' }),
      lancamento({ id: 'dentro', data: '2026-08-16', valor: 1000, nota: 'POSTO BETA' }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500 }),
      bruto({ data: '2026-08-17', valorCent: -5190, descricao: 'FARMACIA DELTA' }),
    ], d, OPCOES);
    const sobras = itens.filter((i) => i.estado === 'sobra').map((i) => i.lancamentoId);
    expect(sobras).toEqual(['dentro']);
  });

  // Uma parcela posterior (n > 1) traz no bruto a data da COMPRA ORIGINAL, meses atrás — não a
  // data da fatura atual. Se essa data entrar no cálculo do período da "sobra", o período
  // estica por meses, e toda compra do app nesse intervalo vira sobra falsa.
  it('não usa a data de parcela posterior (n > 1) para esticar o período da sobra', () => {
    const d = dadosCom([], [
      // Compra de dois meses antes do ciclo da fatura atual, ausente do arquivo: com o
      // período esticado pela parcela, isso vira sobra falsa; sem esticar, fica fora do
      // período (que passa a ir só de 20/07 a 15/08, definido pelos brutos comuns).
      compraCartao({ id: 'antiga-fora', data: '2026-06-10', valorTotal: 3000, descricao: 'POSTO BETA' }),
      // Compra dentro do ciclo da fatura atual, ausente do arquivo: continua sobra de
      // verdade, porque está dentro do período real.
      compraCartao({ id: 'do-mes-sobra', data: '2026-08-01', valorTotal: 2000, descricao: 'FARMACIA DELTA' }),
    ]);
    const itens = conferir([
      // Parcela 2 de 3: a data é a da compra original, em junho — meses antes do ciclo atual.
      bruto({
        data: '2026-06-02', valorCent: -10000, fonte: 'cartao', descricao: 'MERCADO ALFA',
        parcela: { n: 2, total: 3 },
      }),
      // Duas compras comuns do ciclo atual, que definem o período real: 20/07 a 15/08.
      bruto({ data: '2026-07-20', valorCent: -3000, fonte: 'cartao', descricao: 'FULANO DE TAL' }),
      bruto({ data: '2026-08-15', valorCent: -4500, fonte: 'cartao', descricao: 'LOJA GAMA' }),
    ], d, OPCOES);
    const sobras = itens.filter((i) => i.estado === 'sobra').map((i) => i.compraCartaoId);
    expect(sobras).toEqual(['do-mes-sobra']);
  });

  // Sem casamento um-para-um, os dois brutos casam com o mesmo lançamento.
  it('casa um-para-um quando há dois lançamentos iguais no mesmo dia', () => {
    const d = dadosCom([
      lancamento({ id: 'a', data: '2026-08-15', valor: 1000, nota: 'LOJA GAMA' }),
      lancamento({ id: 'b', data: '2026-08-15', valor: 1000, nota: 'LOJA GAMA' }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -1000 }),
      bruto({ data: '2026-08-15', valorCent: -1000 }),
    ], d, OPCOES);
    expect(itens.filter((i) => i.estado === 'confere')).toHaveLength(2);
    expect(new Set(itens.map((i) => i.lancamentoId)).size).toBe(2);
  });

  it('casa dentro da tolerância de três dias e não fora dela', () => {
    const d = dadosCom([lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA' })]);
    expect(conferir([bruto({ data: '2026-08-18', valorCent: -4500 })], d, OPCOES)[0].estado)
      .toBe('confere');
    expect(conferir([bruto({ data: '2026-08-19', valorCent: -4500 })], d, OPCOES)[0].estado)
      .toBe('novo');
  });

  it('marca o resgate como interno e ignora, sem perguntar', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: 100000, descricao: 'Resgate RDB',
              natureza: 'resgateInterno' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('marca a aplicação como interno, mas com aviso de que é sua decisão', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -100000, descricao: 'Aplicação RDB',
              natureza: 'aplicacaoInterna' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBeDefined();
  });

  it('marca o estorno como interno e não grava', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -2, fonte: 'cartao', natureza: 'estornoCartao' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('confere o pagamento da fatura contra o lançamento da fatura', () => {
    const d = dadosCom([
      lancamento({
        id: 'fatura', data: '2026-08-05', valor: 123456, status: 'previsto',
        origem: 'cartao', cartaoId: CARTAO, faturaMes: '2026-08',
      }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-03', valorCent: -123456, fonte: 'cartao',
              descricao: 'PAGAMENTO DE FATURA-INTERNET', natureza: 'pagamentoFatura' }),
    ], d, OPCOES);
    expect(itens[0].estado).toBe('previsto');
    expect(itens[0].lancamentoId).toBe('fatura');
    expect(itens[0].acao).toEqual({
      tipo: 'confirmarComValor', valorCent: 123456, data: '2026-08-03',
    });
  });

  // O tipo da categoria decide se o valor soma ou subtrai no saldo. Uma entrada gravada em
  // categoria de gasto seria subtraída da projeção.
  it('escolhe a categoria de entrada para valor positivo e a de saída para negativo', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: 100000, descricao: 'FULANO DE TAL' }),
      bruto({ data: '2026-08-16', valorCent: -4500, descricao: 'LOJA GAMA' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].acao).toEqual({ tipo: 'adicionarLancamento', categoriaId: CAT_GANHO });
    expect(itens[1].acao).toEqual({ tipo: 'adicionarLancamento', categoriaId: CAT });
  });

  it('não cria nada quando o pagamento não acha fatura correspondente', () => {
    const itens = conferir([
      bruto({ data: '2026-08-03', valorCent: -123456, fonte: 'cartao',
              descricao: 'PAGAMENTO DE FATURA-INTERNET', natureza: 'pagamentoFatura' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBeDefined();
  });

  it('propõe adicionar compra para gasto de cartão não encontrado', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500, fonte: 'cartao' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao).toEqual({ tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO });
  });

  it('reconstrói o total da compra parcelada, não o valor da parcela', () => {
    const itens = conferir([
      bruto({ data: '2026-07-02', valorCent: -10000, fonte: 'cartao',
              parcela: { n: 3, total: 10 } }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].compraReconstruida).toEqual({
      data: '2026-07-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false,
    });
  });

  // O candidato de valor exato vence mesmo estando mais longe em data. Sem isso, um previsto
  // de valor errado no dia certo sequestraria o casamento do lançamento certo.
  it('prefere o candidato de valor exato ao mais próximo em data', () => {
    const d = dadosCom([
      lancamento({ id: 'perto-errado', data: '2026-08-15', valor: 9900, nota: 'LOJA GAMA' }),
      lancamento({ id: 'longe-certo', data: '2026-08-17', valor: 4500, nota: 'LOJA GAMA' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    expect(itens[0].estado).toBe('confere');
    expect(itens[0].lancamentoId).toBe('longe-certo');
  });

  it('não preenche compraReconstruida para compra à vista', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500, fonte: 'cartao' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].acao).toEqual({ tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO });
    expect(itens[0].compraReconstruida).toBeUndefined();
  });

  it('não casa pagamento com fatura de meses atrás', () => {
    const d = dadosCom([
      lancamento({
        id: 'fatura-velha', data: '2026-02-05', valor: 123456, status: 'previsto',
        origem: 'cartao', cartaoId: CARTAO, faturaMes: '2026-02',
      }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-03', valorCent: -123456, fonte: 'cartao',
              descricao: 'PAGAMENTO DE FATURA-INTERNET', natureza: 'pagamentoFatura' }),
    ], d, OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].lancamentoId).toBeUndefined();
  });

  // Um bruto sem destino não pode derrubar a classificação dos outros.
  it('avisa em vez de lançar quando falta a categoria padrão do cartão', () => {
    const semCategoria = { boxId: BOX, categoriasPadrao: { ganho: CAT_GANHO, gasto: CAT }, cartaoId: CARTAO };
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500, fonte: 'cartao' }),
      bruto({ data: '2026-08-16', valorCent: -5190, fonte: 'conta', descricao: 'POSTO BETA' }),
    ], dadosCom([]), semCategoria);
    expect(itens).toHaveLength(2);
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBeDefined();
    expect(itens[1].estado).toBe('novo');
  });

  // IMPORTANTE 5: uma linha de valor zero não é gasto nem ganho — virar lançamento de
  // R$ 0,00 numa categoria de gasto não serve a nada, e a categoria nem decidiria se soma ou
  // subtrai no saldo.
  it('marca a linha de valor zero como interno e nunca a grava', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: 0, descricao: 'LOJA GAMA' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBe('Linha de valor zero; não entra no fluxo.');
  });
});

describe('chaveDoItem', () => {
  function leituraCom(brutos: LancamentoBruto[]): LeituraAdapter {
    return { brutos, linhasIgnoradas: 0, avisos: [] };
  }

  it('chaveia um item com bruto pela posição dele em leitura.brutos, não pela posição na lista exibida', () => {
    const b0 = bruto({ data: '2026-08-15', valorCent: -1000, descricao: 'LOJA GAMA' });
    const b1 = bruto({ data: '2026-08-16', valorCent: -2000, descricao: 'POSTO BETA' });
    const leitura = leituraCom([b0, b1]);
    const item0: ItemConferencia = { estado: 'novo', bruto: b0, acao: { tipo: 'adicionarLancamento', categoriaId: CAT } };
    const item1: ItemConferencia = { estado: 'novo', bruto: b1, acao: { tipo: 'adicionarLancamento', categoriaId: CAT } };

    // A ordem em que os itens aparecem numa lista (já ordenada, ou reagrupada por um
    // `flatMap` de blocos) não influencia a chave — ela só olha `leitura.brutos`.
    expect(chaveDoItem(item1, leitura)).toBe('bruto:1');
    expect(chaveDoItem(item0, leitura)).toBe('bruto:0');
  });

  it('chaveia uma sobra pelo que ela referencia do lado do app, não por bruto', () => {
    const leitura = leituraCom([]);
    const sobraLancamento: ItemConferencia = { estado: 'sobra', lancamentoId: 'l-1', acao: { tipo: 'ignorar' } };
    const sobraCompra: ItemConferencia = { estado: 'sobra', compraCartaoId: 'c-1', acao: { tipo: 'ignorar' } };
    expect(chaveDoItem(sobraLancamento, leitura)).toBe('sobra:l-1');
    expect(chaveDoItem(sobraCompra, leitura)).toBe('sobra:c-1');
  });
});

describe('acaoEfetiva / totalEfetivo', () => {
  it('usa a decisão só quando ela foi tomada para o MESMO estado do item recalculado', () => {
    const item: ItemConferencia = {
      estado: 'confere', bruto: bruto({ data: '2026-08-15', valorCent: -1000 }),
      acao: { tipo: 'ignorar' },
    };
    // Decisão tomada quando o item ainda era "novo": não vale mais pro item recalculado como
    // "confere" (ex.: trocar a box mudou o que casa no app).
    expect(acaoEfetiva(item, { estado: 'novo', acao: { tipo: 'excluir' } })).toEqual({ tipo: 'ignorar' });
    // Decisão tomada para o estado atual: vale.
    expect(acaoEfetiva(item, { estado: 'confere', acao: { tipo: 'excluir' } })).toEqual({ tipo: 'excluir' });
    // Sem decisão nenhuma: a ação padrão do item.
    expect(acaoEfetiva(item, undefined)).toEqual({ tipo: 'ignorar' });
  });

  it('mesmo critério vale para o total corrigido', () => {
    const item: ItemConferencia = { estado: 'novo', acao: { tipo: 'ignorar' } };
    expect(totalEfetivo(item, { estado: 'sobra', valorCent: 5000 })).toBeUndefined();
    expect(totalEfetivo(item, { estado: 'novo', valorCent: 5000 })).toBe(5000);
    expect(totalEfetivo(item, undefined)).toBeUndefined();
  });
});

describe('totalCorrigidoValido', () => {
  // IMPORTANTE 4: um total corrigido menor que o valor de UMA parcela não faz sentido — nem
  // zero. `aplicar` precisa ignorar a correção nesse caso e gravar o total reconstruído.
  it('rejeita um total corrigido menor que o valor de uma parcela, inclusive zero', () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: bruto({ data: '2026-07-02', valorCent: -10000, fonte: 'cartao', parcela: { n: 3, total: 10 } }),
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO },
      compraReconstruida: { data: '2026-07-02', valorTotalCent: 100000, parcelas: 10, anoDeduzidoComAviso: false },
    };
    expect(totalCorrigidoValido(item, 0)).toBeUndefined();
    expect(totalCorrigidoValido(item, 9999)).toBeUndefined();
    expect(totalCorrigidoValido(item, 10000)).toBe(10000);
    expect(totalCorrigidoValido(item, 150000)).toBe(150000);
  });

  it('sem correção nenhuma, devolve undefined', () => {
    const item: ItemConferencia = {
      estado: 'novo',
      bruto: bruto({ data: '2026-07-02', valorCent: -10000, fonte: 'cartao' }),
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO },
    };
    expect(totalCorrigidoValido(item, undefined)).toBeUndefined();
  });
});
