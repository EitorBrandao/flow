import { describe, expect, it } from 'vitest';
import type { Dados, Lancamento } from '../domain/types';
import { conferir } from './conferencia';
import type { LancamentoBruto } from './tipos';

const BOX = 'box-1';
const CAT = 'cat-1';
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

function dadosCom(lancamentos: Lancamento[]): Dados {
  return {
    boxes: [], categorias: [], lancamentos, recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
    conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: BOX, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
  };
}

function bruto(p: Partial<LancamentoBruto> & { data: string; valorCent: number }): LancamentoBruto {
  return { descricao: 'LOJA GAMA', fonte: 'conta', ...p };
}

const OPCOES = { boxId: BOX, categoriaPadraoId: CAT, cartaoId: CARTAO,
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
});
