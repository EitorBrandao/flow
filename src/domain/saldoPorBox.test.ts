import { projetarBoxes } from './projection';
import { saldosPorBox } from './saldoPorBox';
import type { Box, Categoria, Lancamento } from './types';

const agora = '2026-07-01T12:00:00.000Z';
const box = (id: string, nome: string, saldoInicial: number | null, dataSaldoInicial: string | null): Box =>
  ({ id, nome, saldoInicial, dataSaldoInicial, criadoEm: agora, alteradoEm: agora });
const cat = (id: string, boxId: string, tipo: 'ganho' | 'gasto'): Categoria =>
  ({ id, boxId, nome: id, tipo, ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora }) as Categoria;
const lanc = (id: string, boxId: string, categoriaId: string, data: string, valor: number): Lancamento =>
  ({ id, boxId, categoriaId, data, valor, status: 'efetivo', origem: 'manual', criadoEm: agora, alteradoEm: agora }) as Lancamento;

const entrada = (boxes: Box[], lancamentos: Lancamento[]) => ({
  boxes,
  categorias: [cat('c-ana', 'ana', 'gasto'), cat('c-bruno', 'bruno', 'gasto'), cat('c-casa', 'casa', 'gasto')],
  lancamentos,
  cenariosLigados: new Set<string>(),
  horizonte: '2026-12-31',
});

it('devolve o saldo efetivo de hoje de cada box com saldo próprio', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const e = entrada(boxes, [lanc('l1', 'ana', 'c-ana', '2026-07-01', 15000)]);
  const r = saldosPorBox(['ana', 'bruno'], e, '2026-07-02');
  expect(r).toEqual([
    { boxId: 'ana', nome: 'ana', saldoEfetivo: 85000 },
    { boxId: 'bruno', nome: 'bruno', saldoEfetivo: 50000 },
  ]);
});

it('a soma das linhas é igual ao total consolidado', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const e = entrada(boxes, [
    lanc('l1', 'ana', 'c-ana', '2026-07-01', 15000),
    lanc('l2', 'bruno', 'c-bruno', '2026-06-10', 90000),
  ]);
  const ids = ['ana', 'bruno'];
  const soma = saldosPorBox(ids, e, '2026-07-02').reduce((s, r) => s + r.saldoEfetivo, 0);
  const total = projetarBoxes(ids, e).filter((s) => s.data <= '2026-07-02').at(-1)!.saldoEfetivo;
  expect(soma).toBe(total);
});

it('omite a box sem saldo próprio e sem lançamento', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('casa', 'casa', null, null)];
  const r = saldosPorBox(['ana', 'casa'], entrada(boxes, []), '2026-07-02');
  expect(r.map((x) => x.nome)).toEqual(['ana']);
});

it('inclui a box sem saldo próprio quando ela tem lançamento', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('casa', 'casa', null, null)];
  const e = entrada(boxes, [lanc('l1', 'casa', 'c-casa', '2026-07-01', 20000)]);
  const r = saldosPorBox(['ana', 'casa'], e, '2026-07-02');
  expect(r.find((x) => x.nome === 'casa')?.saldoEfetivo).toBe(-20000);
});

it('só considera as boxes da seleção', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const r = saldosPorBox(['ana'], entrada(boxes, []), '2026-07-02');
  expect(r.map((x) => x.nome)).toEqual(['ana']);
});

function somaETotal(ids: string[], e: ReturnType<typeof entrada>, hoje: string) {
  const soma = saldosPorBox(ids, e, hoje).reduce((s, r) => s + r.saldoEfetivo, 0);
  const total = projetarBoxes(ids, e).filter((s) => s.data <= hoje).at(-1)?.saldoEfetivo ?? 0;
  return { soma, total };
}

it('boxes com datas de início diferentes: a soma das linhas é igual ao total', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-03-01')];
  const e = entrada(boxes, [
    lanc('l1', 'ana', 'c-ana', '2026-02-10', 7000),
    lanc('l2', 'ana', 'c-ana', '2026-04-10', 3000),
    lanc('l3', 'bruno', 'c-bruno', '2026-02-20', 9000),
    lanc('l4', 'bruno', 'c-bruno', '2026-05-05', 1000),
  ]);
  const { soma, total } = somaETotal(['ana', 'bruno'], e, '2026-07-02');
  expect(soma).toBe(total);
  expect(soma).toBe(100000 - 7000 - 3000 + 50000 - 1000);
});

it('lançamento da box sem saldo próprio anterior ao início consolidado não entra', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-03-01'), box('casa', 'casa', null, null)];
  const e = entrada(boxes, [
    lanc('l1', 'casa', 'c-casa', '2026-01-15', 20000),
    lanc('l2', 'casa', 'c-casa', '2026-04-15', 5000),
  ]);
  const ids = ['ana', 'casa'];
  const { soma, total } = somaETotal(ids, e, '2026-07-02');
  expect(soma).toBe(total);
  expect(saldosPorBox(ids, e, '2026-07-02').find((r) => r.nome === 'casa')?.saldoEfetivo).toBe(-5000);
});

it('box com data de saldo inicial no futuro: a soma das linhas é igual ao total', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-09-01')];
  const e = entrada(boxes, [
    lanc('l1', 'bruno', 'c-bruno', '2026-06-01', 4000),
    lanc('l2', 'bruno', 'c-bruno', '2026-09-10', 4000),
    lanc('l3', 'ana', 'c-ana', '2026-02-01', 1000),
  ]);
  const { soma, total } = somaETotal(['ana', 'bruno'], e, '2026-07-02');
  expect(soma).toBe(total);
});

it('hoje anterior ao início: a soma das linhas é igual ao total', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-08-01'), box('bruno', 'bruno', 50000, '2026-08-01')];
  const e = entrada(boxes, [lanc('l1', 'ana', 'c-ana', '2026-08-10', 1000)]);
  const { soma, total } = somaETotal(['ana', 'bruno'], e, '2026-07-02');
  expect(soma).toBe(total);
});
