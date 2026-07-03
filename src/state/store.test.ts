import 'fake-indexeddb/auto';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { boxIdsSelecionadas, useApp } from './store';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useApp.setState({ carregado: false, dados: null, aba: 'hoje', boxSel: 'casa' });
});

it('iniciar carrega dados, materializa recorrências e escolhe box padrão', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 1000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'x', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia(
    { boxId: box.id, categoriaId: cat.id, valor: 100, dataInicio: '2026-01-05', diaDoMes: 5, parcelas: 2 },
    '2026-12-31',
  );
  await useApp.getState().iniciar();
  const s = useApp.getState();
  expect(s.carregado).toBe(true);
  expect(s.boxSel).toBe(box.id); // primeira box com saldo próprio
  expect(s.dados!.lancamentos).toHaveLength(2); // materializadas no boot
});

it('boxIdsSelecionadas: casa = todas as boxes', async () => {
  await useApp.getState().iniciar();
  const s = useApp.getState();
  expect(boxIdsSelecionadas(s.dados!, 'casa')).toEqual([]);
  expect(boxIdsSelecionadas({ ...s.dados!, boxes: [{ id: 'a' } as never, { id: 'b' } as never] }, 'casa')).toEqual(['a', 'b']);
  expect(boxIdsSelecionadas(s.dados!, 'xyz')).toEqual(['xyz']);
});
