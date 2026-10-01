import { describe, expect, it } from 'vitest';
import { intervaloDaCompra, lerNubankFatura, nubankFatura } from './nubankFatura';

const CAB = 'date,title,amount';

function ler(...linhas: string[]) {
  return lerNubankFatura([CAB, ...linhas].join('\n'));
}

describe('nubankFatura.detectar', () => {
  it('reconhece o cabeçalho, com BOM, espaços e maiúsculas', () => {
    expect(nubankFatura.detectar('x.csv', CAB)).toBe(true);
    expect(nubankFatura.detectar('x.csv', '﻿Date,Title,Amount  \n2026-08-01,A,"1,00"')).toBe(true);
  });

  it('recusa o extrato da conta e outro CSV', () => {
    expect(nubankFatura.detectar('x.csv', 'Data,Valor,Identificador,Descrição')).toBe(false);
    expect(nubankFatura.detectar('x.csv', 'date,title,amount,extra')).toBe(false);
    expect(nubankFatura.detectar('x.pdf', '%PDF-1.4')).toBe(false);
  });
});

describe('intervaloDaCompra', () => {
  it('3/10 com a linha em 30/07: compra entre 30/05 e 29/06', () => {
    expect(intervaloDaCompra('2026-07-30', 3)).toEqual({ min: '2026-05-30', max: '2026-06-29' });
  });
  it('2/4 com a linha em 30/08: compra entre 30/07 e 29/08', () => {
    expect(intervaloDaCompra('2026-08-30', 2)).toEqual({ min: '2026-07-30', max: '2026-08-29' });
  });
  it('2/2 com a linha em 31/03: a mínima cai no fim de fevereiro', () => {
    // 31/03 − 1 mês → 28/02 (2026 não é bissexto); máxima = 31/03 − 1 dia = 30/03.
    expect(intervaloDaCompra('2026-03-31', 2)).toEqual({ min: '2026-02-28', max: '2026-03-30' });
  });
  it('vira o ano: 3/6 com a linha em 15/01/2027', () => {
    // mínima = 15/01/2027 − 2 meses = 15/11/2026; máxima = 15/12/2026 − 1 dia = 14/12/2026.
    expect(intervaloDaCompra('2027-01-15', 3)).toEqual({ min: '2026-11-15', max: '2026-12-14' });
  });
});

describe('lerNubankFatura', () => {
  it('compra à vista: sinal invertido, sem parcela e sem natureza', () => {
    const r = ler('2026-08-18,Mercado Alfa,"50,00"');
    expect(r.brutos).toEqual([
      { data: '2026-08-18', valorCent: -5000, descricao: 'Mercado Alfa', fonte: 'cartao' },
    ]);
    expect(r.linhasIgnoradas).toBe(0);
  });

  it('lê valor com milhar e negativo com espaço depois do sinal', () => {
    const r = ler('2026-08-04,Pagamento recebido,"- 1.234,56"');
    expect(r.brutos[0].valorCent).toBe(123456);
    expect(r.brutos[0].natureza).toBe('pagamentoFatura');
  });

  it('parcela 1/N: data real, sem data estimada', () => {
    const r = ler('2026-08-01,Loja Gama - Parcela 1/4,"100,03"');
    expect(r.brutos[0]).toEqual({
      data: '2026-08-01', valorCent: -10003, descricao: 'Loja Gama', fonte: 'cartao',
      parcela: { n: 1, total: 4 },
    });
  });

  it('parcela n > 1: data estimada e intervalo', () => {
    const r = ler('2026-07-30,Loja Delta - Parcela 3/10,"40,00"');
    expect(r.brutos[0]).toEqual({
      data: '2026-05-30', valorCent: -4000, descricao: 'Loja Delta', fonte: 'cartao',
      parcela: { n: 3, total: 10 },
      dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
    });
  });

  it('parcela no formato do Pix no Crédito ("- 2/5")', () => {
    const r = ler('2026-07-30,Pix no Crédito - Fulano de Tal - 2/5,"35,00"');
    expect(r.brutos[0].descricao).toBe('Pix no Crédito - Fulano de Tal');
    expect(r.brutos[0].parcela).toEqual({ n: 2, total: 5 });
    expect(r.brutos[0].dataEstimada).toEqual({ min: '2026-06-30', max: '2026-07-29' });
  });

  it('numeração de parcela impossível fica na descrição e vira compra à vista', () => {
    const r = ler('2026-08-10,Loja Beta - 0/3,"10,00"', '2026-08-11,Loja Beta - Parcela 5/3,"10,00"');
    expect(r.brutos[0]).toEqual({ data: '2026-08-10', valorCent: -1000, descricao: 'Loja Beta - 0/3', fonte: 'cartao' });
    expect(r.brutos[1].descricao).toBe('Loja Beta - Parcela 5/3');
    expect(r.brutos[1].parcela).toBeUndefined();
  });

  it('crédito de compra: estorno, com a descrição só o nome da loja', () => {
    const r = ler('2026-09-18,"Crédito de ""Loja Gama""","- 20,00"');
    expect(r.brutos[0]).toEqual({
      data: '2026-09-18', valorCent: 2000, descricao: 'Loja Gama', fonte: 'cartao',
      natureza: 'estornoCartao',
    });
  });

  it('outro valor negativo é estorno; IOF positivo é gasto comum', () => {
    const r = ler('2026-08-12,Ajuste a crédito,"- 5,00"', '2026-08-12,IOF de compra internacional,"1,10"');
    expect(r.brutos[0].natureza).toBe('estornoCartao');
    expect(r.brutos[1].natureza).toBeUndefined();
    expect(r.brutos[1].valorCent).toBe(-110);
  });

  it('corrige acentos em UTF-8 duplo', async () => {
    const texto = [CAB, '2026-07-30,Pix no CrÃ©dito - Fulano - 2/2,"10,00"'].join('\n');
    const bytes = new TextEncoder().encode(texto);
    const r = await nubankFatura.ler(bytes.buffer);
    expect(r.brutos[0].descricao).toBe('Pix no Crédito - Fulano');
  });

  it('linha ilegível vai para as não reconhecidas', () => {
    const r = ler('2026-13-01,Loja X,"1,00"', '2026-08-01,Loja Y,abc', '2026-08-01,,"1,00"', '2026-08-02,Loja Z,"2,00"');
    expect(r.linhasIgnoradas).toBe(3);
    expect(r.linhasNaoReconhecidas).toHaveLength(3);
    expect(r.brutos).toHaveLength(1);
  });

  it('um bloco só, sem total declarado, com todos os brutos', () => {
    const r = ler('2026-08-18,Mercado Alfa,"50,00"', '2026-08-04,Pagamento recebido,"- 50,00"');
    expect(r.blocos).toEqual([{ rotulo: 'Fatura Nubank', brutos: r.brutos }]);
  });

  it('ler() devolve o texto extraído, já corrigido', async () => {
    const texto = [CAB, '2026-08-18,Mercado Alfa,"50,00"'].join('\n');
    const r = await nubankFatura.ler(new TextEncoder().encode(texto).buffer);
    expect(r.textoExtraido).toBe(texto);
  });

  it('sem cabeçalho reconhecido, não lê nada', () => {
    const r = lerNubankFatura('Data,Valor\n01/08/2026,10.00');
    expect(r.brutos).toEqual([]);
    expect(r.linhasIgnoradas).toBe(0);
  });
});
