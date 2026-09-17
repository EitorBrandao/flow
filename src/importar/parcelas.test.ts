import { describe, expect, it } from 'vitest';
import { reconstruirCompra } from './parcelas';

describe('reconstruirCompra', () => {
  it('multiplica a parcela pelo total e usa a data da própria linha', () => {
    const c = reconstruirCompra({
      diaMes: '02/07', parcelaN: 3, parcelaTotal: 10,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c).toEqual({
      data: '2026-07-02',
      valorTotalCent: 100000,
      parcelas: 10,
      anoDeduzidoComAviso: false,
    });
  });

  // Parcela 10 de 12 numa fatura de fevereiro: a compra é de maio do ANO ANTERIOR.
  it('deduz o ano anterior quando a compra ficou para trás', () => {
    const c = reconstruirCompra({
      diaMes: '02/05', parcelaN: 10, parcelaTotal: 12,
      valorParcelaCent: 12345, mesFatura: '2026-02',
    });
    expect(c.data).toBe('2025-05-02');
    expect(c.anoDeduzidoComAviso).toBe(false);
  });

  it('avisa quando a data deduzida cai longe do mês esperado', () => {
    const c = reconstruirCompra({
      diaMes: '02/01', parcelaN: 3, parcelaTotal: 10,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c.anoDeduzidoComAviso).toBe(true);
  });

  it('trata a compra à vista como parcela 1 de 1', () => {
    const c = reconstruirCompra({
      diaMes: '07/09', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 4500, mesFatura: '2026-09',
    });
    expect(c).toEqual({
      data: '2026-09-07', valorTotalCent: 4500, parcelas: 1, anoDeduzidoComAviso: false,
    });
  });
});
