import type { Lancamento, Recorrencia } from './types';
import { materializar, ocorrencias } from './recurrence';

function rec(sobrescrever: Partial<Recorrencia> = {}): Recorrencia {
  return {
    id: 'r1', boxId: 'b1', categoriaId: 'c1', valor: 12684,
    dataInicio: '2025-07-03', diaDoMes: 3, parcelas: 8,
    ativa: true, origem: 'manual',
    criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z',
    ...sobrescrever,
  };
}

function lanc(data: string, status: 'efetivo' | 'previsto', id = `l-${data}`): Lancamento {
  return {
    id, boxId: 'b1', categoriaId: 'c1', data, valor: 12684, status,
    origem: 'recorrencia', recorrenciaId: 'r1',
    criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z',
  };
}

describe('ocorrencias', () => {
  it('replica o Emprestimo Eitor da planilha (8 parcelas, dia 3, início 2025-07-03)', () => {
    expect(ocorrencias(rec(), '2026-12-31')).toEqual([
      '2025-07-03', '2025-08-03', '2025-09-03', '2025-10-03',
      '2025-11-03', '2025-12-03', '2026-01-03', '2026-02-03',
    ]);
  });

  it('quando o dia do mês já passou no mês de início, começa no mês seguinte', () => {
    expect(ocorrencias(rec({ dataInicio: '2026-01-15', diaDoMes: 10, parcelas: 2 }), '2026-12-31'))
      .toEqual(['2026-02-10', '2026-03-10']);
  });

  it('clampa dia 31 em meses curtos', () => {
    expect(ocorrencias(rec({ dataInicio: '2026-01-31', diaDoMes: 31, parcelas: 3 }), '2026-12-31'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('sem fim (parcelas null) é limitada pelo horizonte', () => {
    const r = rec({ dataInicio: '2026-01-05', diaDoMes: 5, parcelas: null });
    expect(ocorrencias(r, '2026-04-30')).toEqual([
      '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05',
    ]);
  });
});

describe('materializar', () => {
  it('cria as datas que faltam e preserva as existentes', () => {
    const existentes = [lanc('2025-07-03', 'efetivo'), lanc('2025-08-03', 'previsto')];
    const diff = materializar(rec(), existentes, '2025-08-15', '2025-10-31');
    expect(diff.criarDatas).toEqual(['2025-09-03', '2025-10-03']);
    expect(diff.excluirIds).toEqual([]);
  });

  it('exclui previstos fora das datas esperadas, mas nunca efetivos', () => {
    const existentes = [lanc('2025-06-03', 'previsto', 'orfao'), lanc('2025-05-03', 'efetivo', 'conf')];
    const diff = materializar(rec(), existentes, '2025-06-15', '2025-07-31');
    expect(diff.excluirIds).toEqual(['orfao']);
    expect(diff.criarDatas).toEqual(['2025-07-03']);
  });

  it('recorrência inativa remove todos os previstos e não cria nada', () => {
    const existentes = [lanc('2025-07-03', 'efetivo'), lanc('2025-08-03', 'previsto', 'p1')];
    const diff = materializar(rec({ ativa: false }), existentes, '2025-09-01', '2026-12-31');
    expect(diff).toEqual({ criarDatas: [], excluirIds: ['p1'] });
  });

  it('não recria uma data esperada passada que está ausente dos existentes (descarte definitivo)', () => {
    // 4 ocorrências esperadas até '2025-10-31': 07-03, 08-03, 09-03, 10-03. Nenhuma existe ainda.
    // hoje = '2025-09-15': as 3 primeiras já são passado (não voltam); só a futura (10-03) é criada.
    const diff = materializar(rec(), [], '2025-09-15', '2025-10-31');
    expect(diff.criarDatas).toEqual(['2025-10-03']);
  });
});
