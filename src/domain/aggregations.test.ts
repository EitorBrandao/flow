import type { Categoria, Lancamento } from './types';
import { compararMeses, lancamentosDaCategoria, mediaMovel3, resumoMensal, serieMensal } from './aggregations';

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

it('lancamentosDaCategoria agrupa por nota normalizada, soma subtotal e ordena', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria Silva' }),
    lanc({ id: 'p2', data: '2026-07-12', valor: 20000, categoriaId: 'car', nota: ' maria silva ' }),
    lanc({ id: 'p3', data: '2026-07-08', valor: 15000, categoriaId: 'car', nota: 'Padaria' }),
    lanc({ id: 'p4', data: '2026-07-01', valor: 5000, categoriaId: 'car' }), // sem nota
  ];
  const grupos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);

  expect(grupos).toHaveLength(3);
  expect(grupos[0].notaExibicao).toBe('Maria Silva');
  expect(grupos[0].notaChave).toBe('maria silva');
  expect(grupos[0].subtotal).toBe(50000);
  expect(grupos[0].itens.map((i) => i.data)).toEqual(['2026-07-12', '2026-07-05']); // recente primeiro
  expect(grupos[1].notaExibicao).toBe('Padaria');
  expect(grupos[1].subtotal).toBe(15000);
  expect(grupos[2].notaExibicao).toBe('sem nota');
  expect(grupos[2].subtotal).toBe(5000);
});

it('lancamentosDaCategoria respeita o filtro de box/mês/status/cenário', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }),
    lanc({ id: 'p2', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', boxId: 'outra' }),
    lanc({ id: 'p3', data: '2026-06-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }), // mês errado
    lanc({ id: 'p4', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', status: 'previsto' }),
    lanc({ id: 'p5', data: '2026-07-05', valor: 999999, categoriaId: 'car', nota: 'Maria', status: 'previsto', cenarioId: 'x' }),
  ];
  const semPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);
  expect(semPrevistos[0].subtotal).toBe(30000); // só p1

  const comPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, true);
  expect(comPrevistos[0].subtotal).toBe(60000); // p1 + p4, cenário fora
});
