import type { Cartao, CompraCartao, ConferenciaFatura, Lancamento } from './types';
import { calcularFaturas, datasFaturaDoMes, diffSincronizacao, mesFaturaDaCompra, mesFechamentoDaCompra, valorParcela } from './fatura';

const nubank = { diaFechamento: 28, diaVencimento: 5 }; // vence no mês seguinte ao fechamento
const outro = { diaFechamento: 10, diaVencimento: 20 }; // vence no mesmo mês do fechamento

describe('mesFechamentoDaCompra', () => {
  it('compra antes do fechamento cai no ciclo do próprio mês', () => {
    expect(mesFechamentoDaCompra(nubank, '2026-07-10')).toBe('2026-07');
  });
  it('compra no dia do fechamento entra na fatura seguinte', () => {
    expect(mesFechamentoDaCompra(nubank, '2026-07-28')).toBe('2026-08');
  });
  it('clampa o fechamento ao fim do mês (dia 31 em fevereiro)', () => {
    const c = { diaFechamento: 31, diaVencimento: 7 };
    expect(mesFechamentoDaCompra(c, '2026-02-27')).toBe('2026-02');
    expect(mesFechamentoDaCompra(c, '2026-02-28')).toBe('2026-03'); // 28 = fechamento clampado
  });
});

describe('mesFaturaDaCompra e datasFaturaDoMes', () => {
  it('vencimento menor que o fechamento: vence no mês seguinte', () => {
    expect(mesFaturaDaCompra(nubank, '2026-07-10')).toBe('2026-08');
    expect(datasFaturaDoMes(nubank, '2026-08'))
      .toEqual({ dataFechamento: '2026-07-28', dataVencimento: '2026-08-05' });
  });
  it('vencimento maior que o fechamento: vence no mesmo mês', () => {
    expect(mesFaturaDaCompra(outro, '2026-07-05')).toBe('2026-07');
    expect(datasFaturaDoMes(outro, '2026-07'))
      .toEqual({ dataFechamento: '2026-07-10', dataVencimento: '2026-07-20' });
  });
  it('atravessa a virada de ano', () => {
    expect(mesFaturaDaCompra(nubank, '2026-12-28')).toBe('2027-02'); // fecha 2027-01-28, vence 2027-02-05
    expect(mesFaturaDaCompra(nubank, '2026-12-27')).toBe('2027-01');
  });
});

function compra(data: string, valorTotal: number, parcelas = 1): CompraCartao {
  return {
    id: `c-${data}-${valorTotal}-${parcelas}`, cartaoId: 'k1', categoriaCartaoId: 'cat1',
    data, valorTotal, parcelas, criadoEm: '', alteradoEm: '',
  };
}

describe('valorParcela', () => {
  it('divide ao centavo, resto na primeira parcela', () => {
    expect(valorParcela(10000, 3, 1)).toBe(3334);
    expect(valorParcela(10000, 3, 2)).toBe(3333);
    expect(valorParcela(10000, 3, 3)).toBe(3333);
    expect(valorParcela(9999, 2, 1)).toBe(5000);
    expect(valorParcela(9999, 2, 2)).toBe(4999);
    expect(valorParcela(5000, 1, 1)).toBe(5000);
  });
});

describe('calcularFaturas', () => {
  it('agrupa compras nas faturas certas e soma ao centavo', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 5000), compra('2026-07-28', 2000)], '2026-12-31');
    expect(fs.map((f) => [f.mes, f.totalCent])).toEqual([['2026-08', 5000], ['2026-09', 2000]]);
    expect(fs[0].dataVencimento).toBe('2026-08-05');
  });

  it('espalha parcelas pelas faturas seguintes, resto na primeira', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 10000, 3)], '2026-12-31');
    expect(fs.map((f) => [f.mes, f.totalCent]))
      .toEqual([['2026-08', 3334], ['2026-09', 3333], ['2026-10', 3333]]);
    expect(fs[0].itens[0]).toMatchObject({ parcela: 1, totalParcelas: 3, valorCent: 3334 });
    expect(fs[1].itens[0]).toMatchObject({ parcela: 2, totalParcelas: 3, valorCent: 3333 });
  });

  it('corta parcelas com vencimento além do horizonte', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 12000, 12)], '2026-10-31');
    expect(fs.map((f) => f.mes)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('parcelas atravessam a virada de ano', () => {
    const fs = calcularFaturas(nubank, [compra('2026-11-10', 6000, 3)], '2027-12-31');
    expect(fs.map((f) => f.mes)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('soma múltiplas compras e parcelas na mesma fatura', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 10000, 3), compra('2026-08-01', 500)], '2026-12-31');
    expect(fs.find((f) => f.mes === '2026-09')?.totalCent).toBe(3333 + 500);
  });
});

const cartaoK: Cartao = {
  id: 'k1', boxId: 'b1', nome: 'Nu', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catFlow', ativo: true, criadoEm: '', alteradoEm: '',
};

function lancFatura(faturaMes: string, valor: number, status: 'previsto' | 'efetivo', data: string): Lancamento {
  return {
    id: `l-${faturaMes}`, boxId: 'b1', categoriaId: 'catFlow', data, valor, status,
    origem: 'cartao', cartaoId: 'k1', faturaMes, criadoEm: '', alteradoEm: '',
  };
}

function conf(mes: string, valorAppCent: number, usarValorApp: boolean): ConferenciaFatura {
  return { id: `cf-${mes}`, cartaoId: 'k1', mes, valorAppCent, usarValorApp, criadoEm: '', alteradoEm: '' };
}

describe('diffSincronizacao', () => {
  const faturas = calcularFaturas(cartaoK, [compra('2026-07-10', 10000, 2)], '2026-12-31');
  // faturas: 2026-08 (5000, vence 08-05) e 2026-09 (5000, vence 09-05)

  it('cria previstos para faturas futuras', () => {
    const d = diffSincronizacao(cartaoK, faturas, [], [], '2026-07-15');
    expect(d.criar).toEqual([
      { faturaMes: '2026-08', data: '2026-08-05', valor: 5000 },
      { faturaMes: '2026-09', data: '2026-09-05', valor: 5000 },
    ]);
    expect(d.atualizar).toEqual([]);
    expect(d.excluirIds).toEqual([]);
  });

  it('não recria fatura já vencida que o usuário descartou', () => {
    const d = diffSincronizacao(cartaoK, faturas, [], [], '2026-08-10');
    expect(d.criar).toEqual([{ faturaMes: '2026-09', data: '2026-09-05', valor: 5000 }]);
  });

  it('atualiza previsto existente quando o total muda (mesmo já vencido/pendente)', () => {
    const exist = [lancFatura('2026-08', 4000, 'previsto', '2026-08-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-08-10');
    expect(d.atualizar).toEqual([{ id: 'l-2026-08', valor: 5000, data: '2026-08-05' }]);
  });

  it('nunca toca lançamento efetivo', () => {
    const exist = [lancFatura('2026-08', 4000, 'efetivo', '2026-08-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-08-10');
    expect(d.atualizar).toEqual([]);
    expect(d.excluirIds).toEqual([]);
  });

  it('remove previsto de fatura que zerou', () => {
    const exist = [lancFatura('2026-10', 999, 'previsto', '2026-10-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-07-15');
    expect(d.excluirIds).toEqual(['l-2026-10']);
  });

  it('usarValorApp substitui a soma; desmarcado, a soma vale', () => {
    const usando = diffSincronizacao(cartaoK, faturas, [conf('2026-08', 7777, true)], [], '2026-07-15');
    expect(usando.criar[0]).toEqual({ faturaMes: '2026-08', data: '2026-08-05', valor: 7777 });
    const semUsar = diffSincronizacao(cartaoK, faturas, [conf('2026-08', 7777, false)], [], '2026-07-15');
    expect(semUsar.criar[0]).toEqual({ faturaMes: '2026-08', data: '2026-08-05', valor: 5000 });
  });

  it('conferência com usarValorApp e sem itens cria previsto mesmo assim', () => {
    const d = diffSincronizacao(cartaoK, [], [conf('2026-11', 3000, true)], [], '2026-07-15');
    expect(d.criar).toEqual([{ faturaMes: '2026-11', data: '2026-11-05', valor: 3000 }]);
  });

  it('cartão inativo remove todos os previstos e não cria nada', () => {
    const exist = [lancFatura('2026-08', 5000, 'previsto', '2026-08-05')];
    const d = diffSincronizacao({ ...cartaoK, ativo: false }, faturas, [], exist, '2026-07-15');
    expect(d.criar).toEqual([]);
    expect(d.excluirIds).toEqual(['l-2026-08']);
  });
});
