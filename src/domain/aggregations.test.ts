import type { Categoria, Lancamento } from './types';
import { compararMeses, mediaMovel3, resumoMensal, serieMensal } from './aggregations';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const cats: Categoria[] = [
  { id: 'sal', boxId: 'be', nome: 'salario', tipo: 'ganho', ordem: 0, arquivada: false, ...ts },
  { id: 'car', boxId: 'be', nome: 'cartão', tipo: 'gasto', ordem: 0, arquivada: false, ...ts },
  { id: 'psi', boxId: 'be', nome: 'psicologa', tipo: 'gasto', ordem: 1, arquivada: false, ...ts },
];

function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor' | 'categoriaId'>): Lancamento {
  return { boxId: 'be', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

const lancs: Lancamento[] = [
  lanc({ id: '1', data: '2026-07-05', valor: 550000, categoriaId: 'sal' }),
  lanc({ id: '2', data: '2026-07-10', valor: 110000, categoriaId: 'car' }),
  lanc({ id: '3', data: '2026-07-12', valor: 80000, categoriaId: 'psi' }),
  lanc({ id: '4', data: '2026-07-20', valor: 50000, categoriaId: 'car', status: 'previsto' }),
  lanc({ id: '5', data: '2026-07-21', valor: 999999, categoriaId: 'car', status: 'previsto', cenarioId: 'x' }),
  lanc({ id: '6', data: '2026-06-10', valor: 90000, categoriaId: 'car' }),
  lanc({ id: '7', data: '2025-07-15', valor: 70000, categoriaId: 'car' }),
];

it('resumoMensal só com efetivos', () => {
  const r = resumoMensal('2026-07', ['be'], cats, lancs, false);
  expect(r.totalGanhos).toBe(550000);
  expect(r.totalGastos).toBe(190000);
  expect(r.sobra).toBe(360000);
  const cartao = r.linhas.find((l) => l.categoriaId === 'car')!;
  expect(cartao.total).toBe(110000);
  expect(cartao.pctDaRenda).toBeCloseTo(0.2);
  expect(r.linhas.find((l) => l.categoriaId === 'sal')!.pctDaRenda).toBeNull();
  expect(r.linhas[0].tipo).toBe('ganho'); // ganhos primeiro
});

it('resumoMensal com previstos inclui o previsto mas nunca o cenário', () => {
  const r = resumoMensal('2026-07', ['be'], cats, lancs, true);
  expect(r.totalGastos).toBe(240000); // 110000 + 80000 + 50000; cenário fora
});

it('compararMeses traz mês anterior e mesmo mês do ano anterior', () => {
  const c = compararMeses('2026-07', ['be'], cats, lancs, false);
  const cartao = c.find((x) => x.categoriaId === 'car')!;
  expect(cartao.atual).toBe(110000);
  expect(cartao.mesAnterior).toBe(90000);
  expect(cartao.anoAnterior).toBe(70000);
});

it('serieMensal e mediaMovel3', () => {
  const meses = ['2026-05', '2026-06', '2026-07'];
  expect(serieMensal('car', meses, ['be'], lancs, false)).toEqual([0, 90000, 110000]);
  expect(mediaMovel3([30, 60, 90, 120])).toEqual([null, null, 60, 90]);
});
