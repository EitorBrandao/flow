import { describe, expect, it } from 'vitest';
import {
  ajustarAte, ajustarDe, anoAnteriorRepete, estadoInicial, mesesDoPeriodo, mesesEntre, notaComparacao,
  periodoAnoAnterior, periodoAnterior, rotuloColunaPeriodo, rotuloIntervalo,
} from './periodo';

describe('mesesEntre', () => {
  it('inclui as duas pontas e atravessa a virada de ano', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('um mês só', () => {
    expect(mesesEntre('2026-09', '2026-09')).toEqual(['2026-09']);
  });
  it('de depois de até dá lista vazia', () => {
    expect(mesesEntre('2026-10', '2026-09')).toEqual([]);
  });
});

describe('estadoInicial e mesesDoPeriodo', () => {
  const e = estadoInicial('2026-09');
  it('começa no modo Mês, com o mês de hoje', () => {
    expect(e.modo).toBe('mes');
    expect(mesesDoPeriodo(e)).toEqual(['2026-09']);
  });
  it('12 meses termina no mês de hoje', () => {
    const m = mesesDoPeriodo({ ...e, modo: '12m' });
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-10');
    expect(m[11]).toBe('2026-09');
  });
  it('Ano começa no último ano fechado', () => {
    const m = mesesDoPeriodo({ ...e, modo: 'ano' });
    expect(m[0]).toBe('2025-01');
    expect(m[11]).toBe('2025-12');
  });
  it('Período começa em 6 meses atrás até hoje (7 meses)', () => {
    expect(mesesDoPeriodo({ ...e, modo: 'periodo' })).toEqual(mesesEntre('2026-03', '2026-09'));
  });
});

describe('janelas de comparação', () => {
  const doze = mesesEntre('2025-10', '2026-09');
  it('anterior = os N meses antes', () => {
    const a = periodoAnterior(doze);
    expect(a[0]).toBe('2024-10');
    expect(a[11]).toBe('2025-09');
  });
  it('ano anterior = os mesmos meses, 12 antes', () => {
    expect(periodoAnoAnterior(mesesEntre('2026-03', '2026-09'))).toEqual(mesesEntre('2025-03', '2025-09'));
  });
  it('com 12 meses, anterior e ano anterior se repetem', () => {
    expect(anoAnteriorRepete(doze)).toBe(true);
    expect(anoAnteriorRepete(mesesEntre('2026-03', '2026-09'))).toBe(false);
    expect(anoAnteriorRepete(mesesEntre('2024-10', '2026-09'))).toBe(false);
  });
});

describe('ajustarDe e ajustarAte', () => {
  it('de além de até arrasta até', () => {
    expect(ajustarDe('2026-03', '2026-09', '2026-10')).toEqual({ de: '2026-10', ate: '2026-10' });
  });
  it('até antes de de arrasta de', () => {
    expect(ajustarAte('2026-03', '2026-09', '2026-02')).toEqual({ de: '2026-02', ate: '2026-02' });
  });
  it('de recuando além de 24 meses puxa até', () => {
    // 2024-09 → 2026-09 = 25 meses; até cai para 2024-09 + 23 = 2026-08
    expect(ajustarDe('2024-10', '2026-09', '2024-09')).toEqual({ de: '2024-09', ate: '2026-08' });
  });
  it('até avançando além de 24 meses puxa de', () => {
    // 2024-10 → 2026-10 = 25 meses; de sobe para 2026-10 − 23 = 2024-11
    expect(ajustarAte('2024-10', '2026-09', '2026-10')).toEqual({ de: '2024-11', ate: '2026-10' });
  });
  it('dentro do limite, só a ponta mexida muda', () => {
    expect(ajustarDe('2026-03', '2026-09', '2026-02')).toEqual({ de: '2026-02', ate: '2026-09' });
  });
});

describe('rótulos', () => {
  it('rotuloIntervalo', () => {
    expect(rotuloIntervalo(mesesEntre('2025-10', '2026-09'))).toBe('out/2025 – set/2026');
    expect(rotuloIntervalo(['2026-09'])).toBe('set/2026');
  });
  it('rotuloColunaPeriodo', () => {
    expect(rotuloColunaPeriodo('ano', mesesEntre('2025-01', '2025-12'))).toBe('2025');
    expect(rotuloColunaPeriodo('12m', mesesEntre('2025-10', '2026-09'))).toBe('12 meses');
    expect(rotuloColunaPeriodo('periodo', mesesEntre('2026-03', '2026-09'))).toBe('7 meses');
  });
  it('notaComparacao', () => {
    expect(notaComparacao(mesesEntre('2025-10', '2026-09')))
      .toBe('anterior = out/2024 – set/2025 (é também o ano anterior)');
    expect(notaComparacao(mesesEntre('2026-03', '2026-09')))
      .toBe('anterior = ago/2025 – fev/2026 · ano anterior = mar/2025 – set/2025');
  });
});
