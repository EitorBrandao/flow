import 'fake-indexeddb/auto';
import { db } from './database';
import * as repo from './repo';
import type { Box, Categoria } from '../domain/types';
import { agoraISO, novoId } from '../domain/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function boxECategoria(): Promise<{ box: Box; ganho: Categoria; gasto: Categoria }> {
  const agora = agoraISO();
  const box: Box = {
    id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  const ganho = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  const gasto = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  return { box, ganho, gasto };
}

it('carregarTudo cria config default com horizonte no fim do ano seguinte', async () => {
  const dados = await repo.carregarTudo();
  expect(dados.config.horizonteProjecao).toBe(`${new Date().getFullYear() + 1}-12-31`);
  expect(dados.config.mudancasDesdeBackup).toBe(false);
});

it('salvarLancamento persiste e marca mudança desde backup', async () => {
  const { box, gasto } = await boxECategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-02', valor: 5000, status: 'efetivo' });
  const dados = await repo.carregarTudo();
  expect(dados.lancamentos).toHaveLength(1);
  expect(dados.lancamentos[0].origem).toBe('manual');
  expect(dados.config.mudancasDesdeBackup).toBe(true);
});

it('salvarRecorrencia materializa previstos até o horizonte', async () => {
  const { box, gasto } = await boxECategoria();
  await repo.salvarRecorrencia(
    { boxId: box.id, categoriaId: gasto.id, valor: 12684, dataInicio: '2026-01-03', diaDoMes: 3, parcelas: 8 },
    '2026-12-31',
  );
  const dados = await repo.carregarTudo();
  expect(dados.lancamentos).toHaveLength(8);
  expect(dados.lancamentos.every((l) => l.status === 'previsto' && l.origem === 'recorrencia')).toBe(true);
});

it('editar recorrência atualiza valor dos previstos e preserva efetivos', async () => {
  const { box, gasto } = await boxECategoria();
  const rec = await repo.salvarRecorrencia(
    { boxId: box.id, categoriaId: gasto.id, valor: 10000, dataInicio: '2026-01-05', diaDoMes: 5, parcelas: 3 },
    '2026-12-31',
  );
  const primeiro = (await repo.carregarTudo()).lancamentos.find((l) => l.data === '2026-01-05')!;
  await repo.confirmarPendente(primeiro.id, 9990);
  await repo.salvarRecorrencia({ ...rec, valor: 11000 }, '2026-12-31');
  const dados = await repo.carregarTudo();
  const confirmado = dados.lancamentos.find((l) => l.id === primeiro.id)!;
  expect(confirmado.status).toBe('efetivo');
  expect(confirmado.valor).toBe(9990); // efetivo intocado
  const previstos = dados.lancamentos.filter((l) => l.status === 'previsto');
  expect(previstos).toHaveLength(2);
  expect(previstos.every((l) => l.valor === 11000)).toBe(true);
});

it('excluirRecorrencia remove previstos e mantém efetivos', async () => {
  const { box, gasto } = await boxECategoria();
  const rec = await repo.salvarRecorrencia(
    { boxId: box.id, categoriaId: gasto.id, valor: 10000, dataInicio: '2026-01-05', diaDoMes: 5, parcelas: 3 },
    '2026-12-31',
  );
  const primeiro = (await repo.carregarTudo()).lancamentos.find((l) => l.data === '2026-01-05')!;
  await repo.confirmarPendente(primeiro.id);
  await repo.excluirRecorrencia(rec.id);
  const dados = await repo.carregarTudo();
  expect(dados.recorrencias).toHaveLength(0);
  expect(dados.lancamentos).toHaveLength(1);
  expect(dados.lancamentos[0].status).toBe('efetivo');
});

it('converterCenarioEmReal desvincula lançamentos e apaga o cenário', async () => {
  const { box, gasto } = await boxECategoria();
  const agora = agoraISO();
  await repo.salvarCenario({ id: 'cen1', nome: 'bike', ligado: true, criadoEm: agora, alteradoEm: agora });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-08-01', valor: 30000, status: 'previsto', cenarioId: 'cen1' });
  await repo.converterCenarioEmReal('cen1');
  const dados = await repo.carregarTudo();
  expect(dados.cenarios).toHaveLength(0);
  expect(dados.lancamentos[0].cenarioId).toBeUndefined();
  expect(dados.lancamentos[0].status).toBe('previsto'); // vai aparecer em pendentes p/ confirmação
});

it('aplicarImport é idempotente (reimportar não duplica)', async () => {
  const agora = agoraISO();
  const boxImp: Box = { id: 'bi', nome: 'eitor', saldoInicial: 134035, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const catImp: Categoria = { id: 'ci', boxId: 'bi', nome: 'cartão', tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora };
  const montar = () => ({
    boxes: [boxImp],
    categorias: [catImp],
    lancamentos: [{
      id: novoId(), boxId: 'bi', categoriaId: 'ci', data: '2026-03-10', valor: 5000,
      status: 'efetivo' as const, origem: 'import' as const, criadoEm: agora, alteradoEm: agora,
    }],
    recorrencias: [],
  });
  await repo.aplicarImport(montar());
  await repo.aplicarImport(montar());
  const dados = await repo.carregarTudo();
  expect(dados.boxes).toHaveLength(1);
  expect(dados.categorias).toHaveLength(1);
  expect(dados.lancamentos).toHaveLength(1);
});
