import { boxSheetFixture } from './fixtures';
import { lerBoxSheet } from './xlsx';

describe('lerBoxSheet', () => {
  it('lê datas, saldo inicial, categorias e células', () => {
    const imp = lerBoxSheet(boxSheetFixture(), 'eitor');
    expect(imp.datas).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']);
    expect(imp.saldoInicialCent).toBe(100000);
    expect(imp.dataSaldoInicial).toBe('2026-01-01');
    expect(imp.categorias).toEqual([
      { nome: 'salario', tipo: 'ganho', linha: 9 },
      { nome: 'cartão', tipo: 'gasto', linha: 16 },
      { nome: 'aluguel', tipo: 'gasto', linha: 17 },
    ]);
    expect(imp.celulas).toEqual([
      { data: '2026-01-02', categoria: { nome: 'salario', tipo: 'ganho', linha: 9 }, valorCent: 150000 },
      { data: '2026-01-03', categoria: { nome: 'cartão', tipo: 'gasto', linha: 16 }, valorCent: 20050 },
      { data: '2026-01-04', categoria: { nome: 'aluguel', tipo: 'gasto', linha: 17 }, valorCent: -5000 },
    ]);
    expect(imp.saldosPlanilhaCent).toEqual([100000, 250000, 229950, 234950, 234950]);
  });

  it('ignora categorias listadas (linhas Eitor/Ju da aba casa)', () => {
    const imp = lerBoxSheet(boxSheetFixture(), 'casa', ['aluguel']);
    expect(imp.categorias.map((c) => c.nome)).toEqual(['salario', 'cartão']);
    expect(imp.celulas.some((c) => c.categoria.nome === 'aluguel')).toBe(false);
  });

  it('sem fórmula SUM usa os ranges padrão (9-14 / 16-30)', () => {
    const ws = boxSheetFixture();
    delete ws['B8'].f;
    delete ws['B15'].f;
    const imp = lerBoxSheet(ws, 'eitor');
    expect(imp.categorias).toHaveLength(3);
  });
});
