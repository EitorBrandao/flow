import type { Box, Categoria, Lancamento } from './types';
import { pendentes, projetarBoxes, type EntradaProjecao } from './projection';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

const eitor: Box = { id: 'be', nome: 'eitor', saldoInicial: 134035, dataSaldoInicial: '2026-01-01', ...ts };
const ju: Box = { id: 'bj', nome: 'ju', saldoInicial: 50000, dataSaldoInicial: '2026-01-01', ...ts };
const casa: Box = { id: 'bc', nome: 'casa', saldoInicial: null, dataSaldoInicial: null, ...ts };

const cats: Categoria[] = [
  { id: 'cg', boxId: 'be', nome: 'salario', tipo: 'ganho', ordem: 0, arquivada: false, ...ts },
  { id: 'cd', boxId: 'be', nome: 'cartão', tipo: 'gasto', ordem: 1, arquivada: false, ...ts },
  { id: 'cjg', boxId: 'bj', nome: 'pix', tipo: 'ganho', ordem: 0, arquivada: false, ...ts },
  { id: 'cca', boxId: 'bc', nome: 'energia', tipo: 'gasto', ordem: 0, arquivada: false, ...ts },
];

function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor'>): Lancamento {
  return { boxId: 'be', categoriaId: 'cg', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

function entrada(lancs: Lancamento[], ligados: string[] = []): EntradaProjecao {
  return {
    boxes: [eitor, ju, casa], categorias: cats, lancamentos: lancs,
    cenariosLigados: new Set(ligados), horizonte: '2026-01-05',
  };
}

it('acumula saldo dia a dia como a planilha', () => {
  const serie = projetarBoxes(['be'], entrada([
    lanc({ id: '1', data: '2026-01-02', valor: 150000 }),               // ganho efetivo
    lanc({ id: '2', data: '2026-01-03', valor: 12684, categoriaId: 'cd', status: 'previsto' }), // gasto previsto
  ]));
  expect(serie.map((s) => s.data)).toEqual([
    '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
  ]);
  expect(serie[0]).toEqual({ data: '2026-01-01', saldoEfetivo: 134035, saldoProjetado: 134035, saldoComCenarios: 134035 });
  expect(serie[1].saldoEfetivo).toBe(284035);
  expect(serie[2].saldoEfetivo).toBe(284035);      // previsto não entra no efetivo
  expect(serie[2].saldoProjetado).toBe(271351);    // 284035 - 12684
});

it('ignora lançamentos com data <= dataSaldoInicial (regra do dia inicial)', () => {
  const serie = projetarBoxes(['be'], entrada([
    lanc({ id: '1', data: '2026-01-01', valor: 99999 }),
  ]));
  expect(serie[0].saldoEfetivo).toBe(134035);
  expect(serie[4].saldoEfetivo).toBe(134035);
});

it('valor negativo inverte o sinal naturalmente (estorno)', () => {
  const serie = projetarBoxes(['be'], entrada([
    lanc({ id: '1', data: '2026-01-02', valor: -9100, categoriaId: 'cd' }), // gasto negativo = +91
  ]));
  expect(serie[1].saldoEfetivo).toBe(134035 + 9100);
});

it('cenário só entra em saldoComCenarios e apenas se ligado', () => {
  const lancs = [lanc({ id: '1', data: '2026-01-02', valor: 30000, categoriaId: 'cd', status: 'previsto', cenarioId: 'cen1' })];
  const desligado = projetarBoxes(['be'], entrada(lancs));
  expect(desligado[1].saldoComCenarios).toBe(134035);
  const ligado = projetarBoxes(['be'], entrada(lancs, ['cen1']));
  expect(ligado[1].saldoProjetado).toBe(134035);
  expect(ligado[1].saldoComCenarios).toBe(104035);
});

it('consolida casa: soma boxes + gastos compartilhados', () => {
  const serie = projetarBoxes(['be', 'bj', 'bc'], entrada([
    lanc({ id: '1', data: '2026-01-02', valor: 100000 }),                                  // eitor +1000
    lanc({ id: '2', data: '2026-01-02', valor: 20000, boxId: 'bj', categoriaId: 'cjg' }),  // ju +200
    lanc({ id: '3', data: '2026-01-03', valor: 17325, boxId: 'bc', categoriaId: 'cca' }),  // casa -173,25
  ]));
  expect(serie[0].saldoEfetivo).toBe(184035);            // 134035 + 50000
  expect(serie[1].saldoEfetivo).toBe(184035 + 120000);
  expect(serie[2].saldoEfetivo).toBe(184035 + 120000 - 17325);
});

it('pendentes: previstos sem cenário com data <= hoje, ordenados', () => {
  const lancs = [
    lanc({ id: 'a', data: '2026-01-04', valor: 1, status: 'previsto' }),
    lanc({ id: 'b', data: '2026-01-02', valor: 1, status: 'previsto' }),
    lanc({ id: 'c', data: '2026-01-02', valor: 1, status: 'previsto', cenarioId: 'x' }),
    lanc({ id: 'd', data: '2026-01-09', valor: 1, status: 'previsto' }),
    lanc({ id: 'e', data: '2026-01-02', valor: 1 }),
  ];
  expect(pendentes(lancs, '2026-01-04').map((l) => l.id)).toEqual(['b', 'a']);
});
