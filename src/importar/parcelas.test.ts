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
    expect(c).toBeDefined();
    expect(c!.data).toBe('2025-05-02');
    expect(c!.anoDeduzidoComAviso).toBe(false);
  });

  it('avisa quando a data deduzida cai longe do mês esperado', () => {
    const c = reconstruirCompra({
      diaMes: '02/01', parcelaN: 3, parcelaTotal: 10,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c).toBeDefined();
    expect(c!.anoDeduzidoComAviso).toBe(true);
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

  it('recusa dia que não existe no mês', () => {
    expect(reconstruirCompra({
      diaMes: '31/04', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 10000, mesFatura: '2026-04',
    })).toBeUndefined();
  });

  // 29/02 só existe em ano bissexto. O ano mais perto pode não ser — e aí o candidato
  // seguinte salva a linha, em vez de descartá-la.
  it('escolhe um ano bissexto quando a data é 29 de fevereiro', () => {
    const c = reconstruirCompra({
      diaMes: '29/02', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 10000, mesFatura: '2027-02',
    });
    expect(c).toBeDefined();
    expect(c!.data).toBe('2028-02-29');
  });

  it('recusa DD/MM ilegível em vez de montar texto sem sentido', () => {
    for (const diaMes of ['abc', '', '7', '13/13/2026']) {
      expect(reconstruirCompra({
        diaMes, parcelaN: 1, parcelaTotal: 1,
        valorParcelaCent: 10000, mesFatura: '2026-09',
      })).toBeUndefined();
    }
  });

  it('recusa numeração de parcela impossível', () => {
    const base = { diaMes: '07/09', valorParcelaCent: 10000, mesFatura: '2026-09' };
    expect(reconstruirCompra({ ...base, parcelaN: 1, parcelaTotal: 0 })).toBeUndefined();
    expect(reconstruirCompra({ ...base, parcelaN: 15, parcelaTotal: 10 })).toBeUndefined();
  });

  it('aceita DD/MM com zero à esquerda e devolve ISODate bem formado', () => {
    const c = reconstruirCompra({
      diaMes: '07/09', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c!.data).toBe('2026-09-07');
  });

  // A parcela 1 de uma compra feita no mês P entra na fatura que vence em P+1 — não na própria
  // P. Uma compra comum (à vista) do começo do ciclo de fechamento cai no mês ANTERIOR ao
  // vencimento, não no mesmo mês. Com o centro errado (mesFatura, sem descontar o mês), essa
  // compra ficava a dois meses do esperado e ganhava "Ano deduzido com incerteza" à toa.
  it('não avisa para compra comum do começo do ciclo, um mês antes do vencimento', () => {
    const c = reconstruirCompra({
      diaMes: '28/08', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 10000, mesFatura: '2026-10',
    });
    expect(c).toBeDefined();
    expect(c!.data).toBe('2026-08-28');
    expect(c!.anoDeduzidoComAviso).toBe(false);
  });
});
