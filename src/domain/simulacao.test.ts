import type { DiaSaldo } from './projection';
import type { Dados, Lancamento, Recorrencia } from './types';
import {
  ajustarAteSim, ajustarDeSim, estenderRecorrencias, extremosPossiveis, itensDoCenario,
  larguraColunaValor, periodoPadrao, primeiroMesNegativo, resumoMensal,
} from './simulacao';

const dia = (data: string, sem: number, com: number): DiaSaldo =>
  ({ data, saldoEfetivo: 0, saldoProjetado: sem, saldoComCenarios: com });

describe('periodoPadrao', () => {
  it('retorna o mês de hoje até o mês do horizonte', () => {
    expect(periodoPadrao('2026-09-15', '2027-12-31')).toEqual({
      de: '2026-09',
      ate: '2027-12',
    });
  });
});

describe('ajustarDeSim', () => {
  it('novoDe antes de mesHoje fica como mesHoje', () => {
    expect(ajustarDeSim({ de: '2026-09', ate: '2027-12' }, '2026-08', '2026-09')).toEqual({
      de: '2026-09',
      ate: '2027-12',
    });
  });

  it('novoDe depois de ate arrasta ate', () => {
    expect(ajustarDeSim({ de: '2026-09', ate: '2027-12' }, '2028-02', '2026-09')).toEqual({
      de: '2028-02',
      ate: '2028-02',
    });
  });

  it('passa de 60 meses: ate vira novoDe + 59 meses', () => {
    expect(ajustarDeSim({ de: '2026-09', ate: '2031-08' }, '2026-10', '2026-09')).toEqual({
      de: '2026-10',
      ate: '2031-09',
    });
  });
});

describe('ajustarAteSim', () => {
  it('novoAte antes de mesHoje fica como mesHoje', () => {
    expect(ajustarAteSim({ de: '2026-09', ate: '2027-12' }, '2026-07', '2026-09')).toEqual({
      de: '2026-09',
      ate: '2026-09',
    });
  });

  it('novoAte antes de de: de vira novoAte, mas nunca antes de mesHoje', () => {
    expect(ajustarAteSim({ de: '2026-09', ate: '2027-12' }, '2026-12', '2026-09')).toEqual({
      de: '2026-09',
      ate: '2026-12',
    });
  });

  it('passa de 60 meses: de vira novoAte - 59 meses, respeitando mesHoje', () => {
    expect(ajustarAteSim({ de: '2026-09', ate: '2027-12' }, '2032-01', '2026-09')).toEqual({
      de: '2027-02',
      ate: '2032-01',
    });
  });
});

describe('estenderRecorrencias', () => {
  it('recorrência mensal ativa além do horizonte', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-09-10',
      alteradoEm: '2026-09-10',
      valor: 1000,
      dataInicio: '2026-09-10',
      diaDoMes: 10,
      parcelas: null,
      ativa: true,
      origem: 'manual',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-03-31');
    expect(result.length).toBe(3);
    expect(result.map((l) => l.data)).toEqual(['2027-01-10', '2027-02-10', '2027-03-10']);
    expect(result[0].recorrenciaId).toBe('rec1');
    expect(result[0].origem).toBe('recorrencia');
    expect(result[0].status).toBe('previsto');
  });

  it('recorrência inativa não estende', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-09-10',
      alteradoEm: '2026-09-10',
      valor: 1000,
      dataInicio: '2026-09-10',
      diaDoMes: 10,
      parcelas: null,
      ativa: false,
      origem: 'manual',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    expect(estenderRecorrencias(dados, '2027-03-31')).toEqual([]);
  });

  it('parcelada que termina antes do horizonte não estende', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-11-10',
      alteradoEm: '2026-11-10',
      valor: 1000,
      dataInicio: '2026-11-10',
      diaDoMes: 10,
      parcelas: 3,
      ativa: true,
      origem: 'manual',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-03-31');
    expect(result.length).toBe(1);
    expect(result[0].data).toBe('2027-01-10');
  });

  it('parcelada que cruza o horizonte estende as parcelas além dele', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-11-10',
      alteradoEm: '2026-11-10',
      valor: 1000,
      dataInicio: '2026-11-10',
      diaDoMes: 10,
      parcelas: 5,
      ativa: true,
      origem: 'manual',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-05-31');
    expect(result.length).toBe(3);
    expect(result.map((l) => l.data)).toEqual(['2027-01-10', '2027-02-10', '2027-03-10']);
  });

  it('dia 31 em mês curto resulta em fim do mês', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-12-31',
      alteradoEm: '2026-12-31',
      valor: 1000,
      dataInicio: '2026-12-31',
      diaDoMes: 31,
      parcelas: null,
      ativa: true,
      origem: 'manual',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-03-31');
    expect(result.map((l) => l.data)).toContain('2027-02-28');
  });

  it('recorrência de cenário mantém cenarioId', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-09-10',
      alteradoEm: '2026-09-10',
      valor: 1000,
      dataInicio: '2026-09-10',
      diaDoMes: 10,
      parcelas: null,
      ativa: true,
      origem: 'manual',
      cenarioId: 'cen1',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-03-31');
    expect(result[0].cenarioId).toBe('cen1');
  });

  it('não duplica lançamento real já existente com mesma recorrenciaId e data', () => {
    const rec: Recorrencia = {
      id: 'rec1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-09-10',
      alteradoEm: '2026-09-10',
      valor: 1000,
      dataInicio: '2026-09-10',
      diaDoMes: 10,
      parcelas: null,
      ativa: true,
      origem: 'manual',
    };
    const lancamento: Lancamento = {
      id: 'l1',
      boxId: 'box1',
      categoriaId: 'cat1',
      criadoEm: '2026-09-10',
      alteradoEm: '2026-09-10',
      valor: 1000,
      data: '2027-01-10',
      status: 'previsto',
      origem: 'recorrencia',
      recorrenciaId: 'rec1',
    };
    const dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'> = {
      recorrencias: [rec],
      lancamentos: [lancamento],
      config: { horizonteProjecao: '2026-12-31' } as any,
    };
    const result = estenderRecorrencias(dados, '2027-03-31');
    expect(result.map((l) => l.data)).toEqual(['2027-02-10', '2027-03-10']);
  });
});

describe('resumoMensal', () => {
  it('pega o último dia de cada mês, do mês de hoje em diante', () => {
    const serie = [
      dia('2026-08-31', 900, 900),   // antes do mês de hoje: fica de fora
      dia('2026-09-29', 1000, 1000),
      dia('2026-09-30', 1200, 1100),
      dia('2026-10-01', 1200, 900),
      dia('2026-10-31', 1500, 700),
      dia('2026-11-15', 1600, 600),  // último dia presente na série de novembro
    ];
    expect(resumoMensal(serie, '2026-09-29')).toEqual([
      { mes: '2026-09', sem: 1200, com: 1100, dif: -100 },
      { mes: '2026-10', sem: 1500, com: 700, dif: -800 },
      { mes: '2026-11', sem: 1600, com: 600, dif: -1000 },
    ]);
  });

  it('série vazia dá lista vazia', () => {
    expect(resumoMensal([], '2026-09-29')).toEqual([]);
  });

  it('parâmetro ate corta meses depois dele', () => {
    const serie = [
      dia('2026-09-30', 1200, 1100),
      dia('2026-10-31', 1500, 700),
      dia('2026-11-15', 1600, 600),
    ];
    expect(resumoMensal(serie, '2026-09-29', '2026-10')).toEqual([
      { mes: '2026-09', sem: 1200, com: 1100, dif: -100 },
      { mes: '2026-10', sem: 1500, com: 700, dif: -800 },
    ]);
  });
});

describe('primeiroMesNegativo', () => {
  it('devolve o primeiro mês com saldo com cenários abaixo de zero', () => {
    const linhas = [
      { mes: '2026-09', sem: 100, com: 50, dif: -50 },
      { mes: '2026-10', sem: 100, com: -10, dif: -110 },
      { mes: '2026-11', sem: 100, com: -20, dif: -120 },
    ];
    expect(primeiroMesNegativo(linhas)).toBe('2026-10');
  });
  it('zero não é negativo; sem negativo devolve null', () => {
    expect(primeiroMesNegativo([{ mes: '2026-09', sem: 0, com: 0, dif: 0 }])).toBeNull();
  });
});

describe('extremosPossiveis', () => {
  it('soma separadamente os efeitos negativos e os positivos de cada mês', () => {
    const sem = [1000, 2000];
    const efeitos = [[-300, -600], [500, 200], [-100, 50]];
    // mês 0: min = 1000 − 300 − 100 = 600; max = 1000 + 500 = 1500
    // mês 1: min = 2000 − 600 = 1400;       max = 2000 + 200 + 50 = 2250
    expect(extremosPossiveis(sem, efeitos)).toEqual({ min: [600, 1400], max: [1500, 2250] });
  });
  it('sem cenários, min e max são o próprio sem', () => {
    expect(extremosPossiveis([10, 20], [])).toEqual({ min: [10, 20], max: [10, 20] });
  });
});

describe('larguraColunaValor', () => {
  it('conta o texto mais longo entre saldos (com "−") e diferenças (sem sinal)', () => {
    // textos: sem "1.000,00" (8); min "−2.500,00" (9); max "1.500,00" (8);
    //         dif min "3.500,00" (8); dif max "500,00" (6) → 9
    expect(larguraColunaValor([100000], { min: [-250000], max: [150000] })).toBe(9);
  });
  it('nunca fica abaixo de 4 (cabe o "—")', () => {
    expect(larguraColunaValor([], { min: [], max: [] })).toBe(4);
  });
});

describe('itensDoCenario', () => {
  const base = { boxId: 'b', categoriaId: 'c', criadoEm: 'x', alteradoEm: 'x' };
  it('une lançamentos avulsos e recorrências do cenário, pela data, sem os materializados', () => {
    const lancamentos: Lancamento[] = [
      { ...base, id: 'l1', data: '2026-11-05', valor: 100, status: 'previsto', origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'l2', data: '2026-10-10', valor: 50, status: 'previsto', origem: 'recorrencia', cenarioId: 'k', recorrenciaId: 'r1' },
      { ...base, id: 'l3', data: '2026-10-01', valor: 70, status: 'previsto', origem: 'manual', cenarioId: 'outro' },
      { ...base, id: 'l4', data: '2026-10-01', valor: 70, status: 'previsto', origem: 'manual' },
    ];
    const recorrencias: Recorrencia[] = [
      { ...base, id: 'r1', valor: 50, dataInicio: '2026-10-10', diaDoMes: 10, parcelas: 4, ativa: true, origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'r2', valor: 30, dataInicio: '2026-09-20', diaDoMes: 20, parcelas: null, ativa: true, origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'r3', valor: 30, dataInicio: '2026-09-20', diaDoMes: 20, parcelas: null, ativa: true, origem: 'manual' },
    ];
    const itens = itensDoCenario({ lancamentos, recorrencias }, 'k');
    expect(itens.map((i) => [i.id, i.repeticao, i.data])).toEqual([
      ['r2', 'mensal', '2026-09-20'],
      ['r1', 'parcelado', '2026-10-10'],
      ['l1', 'unica', '2026-11-05'],
    ]);
  });
});
