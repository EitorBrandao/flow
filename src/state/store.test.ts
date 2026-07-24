import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { boxIdsSelecionadas, useApp } from './store';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ carregado: false, dados: null, aba: 'hoje', boxSel: 'casa' });
});

it('iniciar carrega dados, materializa recorrências e escolhe box padrão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 1000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'x', tipo: 'gasto', ordem: 0 });
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: cat.id, valor: 100, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 2 },
      '2026-12-31',
    );
    await useApp.getState().iniciar();
    const s = useApp.getState();
    expect(s.carregado).toBe(true);
    expect(s.boxSel).toBe(box.id); // primeira box com saldo próprio
    expect(s.dados!.lancamentos).toHaveLength(2); // materializadas no boot
  } finally {
    vi.useRealTimers();
  }
});

it('iniciar ignora boxPadraoId que aponta para uma box sem saldo próprio (ex.: casa) e cai no fallback', async () => {
  const agora = agoraISO();
  const boxComSaldo = { id: novoId(), nome: 'eitor', saldoInicial: 1000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const boxCasa = { id: novoId(), nome: 'casa', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(boxComSaldo);
  await repo.salvarBox(boxCasa);
  await repo.salvarConfig({ boxPadraoId: boxCasa.id });

  await useApp.getState().iniciar();

  expect(useApp.getState().boxSel).toBe(boxComSaldo.id);
});

it('boot sincroniza faturas de cartão montado direto no banco', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await db.boxes.add(box);
    const catFlow = { id: novoId(), boxId: box.id, nome: 'cartão', tipo: 'gasto' as const, ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora };
    await db.categorias.add(catFlow);
    const cartao = { id: novoId(), boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id, ativo: true, criadoEm: agora, alteradoEm: agora };
    await db.cartoes.add(cartao);
    const catCartao = { id: novoId(), cartaoId: cartao.id, nome: 'mercado', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora };
    await db.categoriasCartao.add(catCartao);
    await db.comprasCartao.add({
      id: novoId(), cartaoId: cartao.id, categoriaCartaoId: catCartao.id,
      data: '2026-07-10', valorTotal: 5000, parcelas: 1, criadoEm: agora, alteradoEm: agora,
    });

    await useApp.getState().iniciar();

    const previstos = useApp.getState().dados!.lancamentos.filter((l) => l.origem === 'cartao');
    expect(previstos).toHaveLength(1);
    expect(previstos[0]).toMatchObject({ faturaMes: '2026-08', data: '2026-08-05', valor: 5000, status: 'previsto' });
  } finally { vi.useRealTimers(); }
});

it('boxIdsSelecionadas: casa = todas as boxes', async () => {
  await useApp.getState().iniciar();
  const s = useApp.getState();
  expect(boxIdsSelecionadas(s.dados!, 'casa')).toEqual([]);
  expect(boxIdsSelecionadas({ ...s.dados!, boxes: [{ id: 'a' } as never, { id: 'b' } as never] }, 'casa')).toEqual(['a', 'b']);
  expect(boxIdsSelecionadas(s.dados!, 'xyz')).toEqual(['xyz']);
});
