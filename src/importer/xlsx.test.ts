import * as XLSX from 'xlsx';
import { boxSheetFixture, simulacoesFixture } from './fixtures';
import { lerBoxSheet, lerPlanilha, lerSimulacoes, montarResultado } from './xlsx';

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

describe('lerSimulacoes', () => {
  it('extrai blocos de empréstimo', () => {
    expect(lerSimulacoes(simulacoesFixture())).toEqual([{
      nome: 'Emprestimo Teste', dataInicio: '2025-07-03', diaDoMes: 3, parcelas: 8, valorMensalCent: 12684,
    }]);
  });

  it('sem rótulo de nome acima do bloco usa o nome padrão "Emprestimo 1"', () => {
    const ws = simulacoesFixture();
    delete ws['A2']; // remove o rótulo 'Emprestimo Teste'; só sobra 'valor total' acima
    expect(lerSimulacoes(ws)).toEqual([{
      nome: 'Emprestimo 1', dataInicio: '2025-07-03', diaDoMes: 3, parcelas: 8, valorMensalCent: 12684,
    }]);
  });

  it('bloco de empréstimo com dados incompletos lança erro apontando aba e linha', () => {
    const ws = simulacoesFixture();
    delete ws['B7']; // 'parcelas' deixa de ser número
    expect(() => lerSimulacoes(ws)).toThrow(
      'Aba "Simulacoes_Eitor": bloco de empréstimo com dados incompletos perto da linha 6.',
    );
  });
});

describe('montarResultado', () => {
  it('monta boxes, categorias e lançamentos com status pela fronteira do hoje', () => {
    const imp = lerBoxSheet(boxSheetFixture(), 'eitor');
    const res = montarResultado([imp], [], '2026-01-02');
    expect(res.boxes).toHaveLength(1);
    expect(res.boxes[0]).toMatchObject({ nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01' });
    expect(res.categorias).toHaveLength(3);
    const porData = Object.fromEntries(res.lancamentos.map((l) => [l.data, l]));
    expect(porData['2026-01-02'].status).toBe('efetivo');   // <= hoje
    expect(porData['2026-01-03'].status).toBe('previsto');  // futuro
    expect(porData['2026-01-04'].valor).toBe(-5000);        // estorno preservado
    expect(res.lancamentos.every((l) => l.origem === 'import')).toBe(true);
  });

  it('box casa fica sem saldo próprio', () => {
    const imp = lerBoxSheet(boxSheetFixture(), 'casa');
    const res = montarResultado([imp], [], '2026-01-02');
    expect(res.boxes[0].saldoInicial).toBeNull();
    expect(res.boxes[0].dataSaldoInicial).toBeNull();
  });

  it('empréstimo vira recorrência e vincula lançamentos da categoria homônima', () => {
    const ws = boxSheetFixture();
    ws['A17'] = { t: 's', v: 'Emprestimo Teste' }; // renomeia 'aluguel'
    const imp = lerBoxSheet(ws, 'eitor');
    const res = montarResultado([imp], [{
      nome: 'Emprestimo Teste', dataInicio: '2025-07-03', diaDoMes: 3, parcelas: 8, valorMensalCent: 12684,
    }], '2026-01-02');
    expect(res.recorrencias).toHaveLength(1);
    const rec = res.recorrencias[0];
    expect(rec).toMatchObject({ valor: 12684, diaDoMes: 3, parcelas: 8, origem: 'import', ativa: true });
    const doEmprestimo = res.lancamentos.find((l) => l.data === '2026-01-04')!;
    expect(doEmprestimo.recorrenciaId).toBe(rec.id);
  });

  it('empréstimo sem categoria correspondente cria a categoria', () => {
    const imp = lerBoxSheet(boxSheetFixture(), 'eitor');
    const res = montarResultado([imp], [{
      nome: 'Emprestimo Novo', dataInicio: '2026-02-01', diaDoMes: 1, parcelas: 4, valorMensalCent: 10000,
    }], '2026-01-02');
    const cat = res.categorias.find((c) => c.nome === 'Emprestimo Novo');
    expect(cat).toBeDefined();
    expect(cat!.tipo).toBe('gasto');
    expect(res.recorrencias[0].categoriaId).toBe(cat!.id);
  });
});

/** Monta um workbook real (bytes) a partir de fixtures, para exercitar lerPlanilha de ponta a ponta. */
function montarWorkbookBytes(sheets: Record<string, XLSX.WorkSheet>): ArrayBuffer {
  const wb: XLSX.WorkBook = { SheetNames: Object.keys(sheets), Sheets: sheets };
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('lerPlanilha', () => {
  it('monta o resultado completo a partir das quatro abas obrigatórias', () => {
    const bytes = montarWorkbookBytes({
      'box (eitor)': boxSheetFixture(),
      'box (Ju)': boxSheetFixture(),
      'box (casa)': boxSheetFixture(),
      Simulacoes_Eitor: simulacoesFixture(),
    });
    const res = lerPlanilha(bytes, '2026-01-02');
    expect(res.boxes).toHaveLength(3);
    const casa = res.boxes.find((b) => b.nome === 'casa');
    expect(casa?.saldoInicial).toBeNull();
    expect(casa?.dataSaldoInicial).toBeNull();
    expect(res.recorrencias.length).toBeGreaterThan(0);
    expect(res.lancamentos.length).toBeGreaterThan(0);
  });

  it('lança erro em pt-BR quando falta uma das abas obrigatórias', () => {
    const bytes = montarWorkbookBytes({
      'box (eitor)': boxSheetFixture(),
      'box (Ju)': boxSheetFixture(),
      Simulacoes_Eitor: simulacoesFixture(),
      // 'box (casa)' ausente de propósito
    });
    expect(() => lerPlanilha(bytes, '2026-01-02')).toThrow('Aba "box (casa)" não encontrada');
  });
});
