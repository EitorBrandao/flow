import { datasFaturaDoMes, mesFaturaDaCompra, mesFechamentoDaCompra } from './fatura';

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
