import { conferenciaDaCasa } from './conferenciaPorBox';
import { saldosPorBox } from './saldoPorBox';
import type { Banco, Box, Categoria, Dados, Lancamento } from './types';

const agora = '2026-07-01T12:00:00.000Z';
const box = (id: string, saldoInicial: number | null, declarado?: number | null): Box => ({
  id, nome: id, saldoInicial, dataSaldoInicial: saldoInicial === null ? null : '2026-01-01',
  saldoDeclaradoCent: declarado, criadoEm: agora, alteradoEm: agora,
});
const banco = (id: string, boxId: string, declarado: number | null): Banco =>
  ({ id, boxId, nome: id, ordem: 0, saldoDeclaradoCent: declarado, dataSaldoDeclarado: declarado === null ? null : '2026-07-01', criadoEm: agora, alteradoEm: agora });
const cat = (id: string, boxId: string): Categoria =>
  ({ id, boxId, nome: id, tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora }) as Categoria;
const lanc = (id: string, boxId: string, valor: number): Lancamento =>
  ({ id, boxId, categoriaId: `c-${boxId}`, data: '2026-06-10', valor, status: 'efetivo', origem: 'manual', criadoEm: agora, alteradoEm: agora }) as Lancamento;

function dados(boxes: Box[], bancos: Banco[] = [], lancamentos: Lancamento[] = []): Dados {
  return {
    boxes, bancos, lancamentos,
    categorias: boxes.map((b) => cat(`c-${b.id}`, b.id)),
    cenarios: [], cartoes: [],
    config: { horizonteProjecao: '2026-12-31' },
  } as unknown as Dados;
}
const HOJE = '2026-07-02';
const nada = new Set<string>();

it('duas boxes sem bancos, ambas informadas: soma, total do Flow e diferença', () => {
  const d = dados([box('ana', 100000, 100000), box('bruno', 50000, 50000)], [], [lanc('l1', 'bruno', 10000)]);
  const r = conferenciaDaCasa(d, ['ana', 'bruno'], HOJE, nada);
  expect(r.totalInformadoCent).toBe(150000);
  expect(r.totalFlowCent).toBe(140000);
  expect(r.faltam).toEqual([]);
  expect(r.diffCent).toBe(10000);
});

it('diferença negativa quando o declarado é menor que o Flow', () => {
  const r = conferenciaDaCasa(dados([box('ana', 100000, 100000), box('bruno', 50000, 40000)]), ['ana', 'bruno'], HOJE, nada);
  expect(r.totalInformadoCent).toBe(140000);
  expect(r.totalFlowCent).toBe(150000);
  expect(r.diffCent).toBe(-10000);
});

it('box com bancos soma os bancos e ignora o saldo declarado da box', () => {
  const d = dados([box('ana', 100000, 999)], [banco('b1', 'ana', 300), banco('b2', 'ana', 150)]);
  const r = conferenciaDaCasa(d, ['ana'], HOJE, nada);
  expect(r.linhas[0].declaradoCent).toBe(450);
  expect(r.linhas[0].bancos.map((b) => b.id)).toEqual(['b1', 'b2']);
});

it('box com bancos sem nenhum informado entra em faltam; a outra informada soma sozinha', () => {
  const d = dados([box('ana', 100000), box('bruno', 50000, 50000)], [banco('b1', 'ana', null)]);
  const r = conferenciaDaCasa(d, ['ana', 'bruno'], HOJE, nada);
  expect(r.faltam).toEqual(['ana']);
  expect(r.diffCent).toBeNull();
  expect(r.totalInformadoCent).toBe(50000);
});

it('nenhuma informada: total informado nulo e todas em faltam', () => {
  const r = conferenciaDaCasa(dados([box('ana', 100000), box('bruno', 50000)]), ['ana', 'bruno'], HOJE, nada);
  expect(r.totalInformadoCent).toBeNull();
  expect(r.faltam).toEqual(['ana', 'bruno']);
  expect(r.diffCent).toBeNull();
});

it('saldo declarado zero conta como informado', () => {
  const r = conferenciaDaCasa(dados([box('ana', 0, 0)]), ['ana'], HOJE, nada);
  expect(r.totalInformadoCent).toBe(0);
  expect(r.faltam).toEqual([]);
  expect(r.diffCent).toBe(0);
});

it('a box casa, sem saldo próprio, não entra nas linhas nem no total do Flow', () => {
  const d = dados([box('ana', 100000, 100000), box('casa', null)], [], [lanc('l1', 'casa', 7000)]);
  const r = conferenciaDaCasa(d, ['ana', 'casa'], HOJE, nada);
  expect(r.linhas.map((l) => l.nome)).toEqual(['ana']);
  expect(r.totalFlowCent).toBe(100000);
});

it('uma box só devolve uma linha', () => {
  const r = conferenciaDaCasa(dados([box('ana', 100000, 100000), box('bruno', 50000)]), ['ana'], HOJE, nada);
  expect(r.linhas).toHaveLength(1);
  expect(r.diffCent).toBe(0);
});

it('sem nenhuma box com saldo próprio: sem linhas e sem diferença', () => {
  const r = conferenciaDaCasa(dados([box('casa', null)]), ['casa'], HOJE, nada);
  expect(r.linhas).toEqual([]);
  expect(r.diffCent).toBeNull();
  expect(r.totalFlowCent).toBe(0);
});

it('flowCent de cada linha é o de saldosPorBox e o total é a soma', () => {
  const d = dados([box('ana', 100000, 1), box('bruno', 50000, 1)], [], [lanc('l1', 'ana', 15000), lanc('l2', 'bruno', 2000)]);
  const r = conferenciaDaCasa(d, ['ana', 'bruno'], HOJE, nada);
  const ref = saldosPorBox(['ana', 'bruno'], {
    boxes: d.boxes, categorias: d.categorias, lancamentos: d.lancamentos,
    cenariosLigados: nada, horizonte: d.config.horizonteProjecao,
  }, HOJE);
  expect(r.linhas.map((l) => l.flowCent)).toEqual(ref.map((x) => x.saldoEfetivo));
  expect(r.totalFlowCent).toBe(85000 + 48000);
});
