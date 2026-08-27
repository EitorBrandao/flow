import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { db } from './database';
import * as repo from './repo';
import type { Box, Categoria, Dados } from '../domain/types';
import { agoraISO, novoId } from '../domain/types';

beforeEach(async () => {
  await limparDb();
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

it('carregarTudo ordena lançamentos por criadoEm, mais recente primeiro', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    const { box, gasto } = await boxECategoria();
    vi.setSystemTime(new Date('2026-07-01T10:00:00'));
    const primeiro = await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-01', valor: 1000, status: 'efetivo' });
    vi.setSystemTime(new Date('2026-07-01T10:00:05'));
    const segundo = await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-01', valor: 2000, status: 'efetivo' });
    vi.setSystemTime(new Date('2026-07-01T10:00:10'));
    const terceiro = await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-01', valor: 3000, status: 'efetivo' });

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos.map((l) => l.id)).toEqual([terceiro.id, segundo.id, primeiro.id]);
  } finally {
    vi.useRealTimers();
  }
});

it('salvarRecorrencia materializa previstos até o horizonte', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 12300, dataInicio: '2026-08-03', diaDoMes: 3, parcelas: 8 },
      '2027-12-31',
    );
    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(8);
    expect(dados.lancamentos.every((l) => l.status === 'previsto' && l.origem === 'recorrencia')).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it('editar recorrência atualiza valor dos previstos e preserva efetivos', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    const rec = await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 10000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 3 },
      '2026-12-31',
    );
    const primeiro = (await repo.carregarTudo()).lancamentos.find((l) => l.data === '2026-08-05')!;
    await repo.confirmarPendente(primeiro.id, 9990);
    await repo.salvarRecorrencia({ ...rec, valor: 11000 }, '2026-12-31');
    const dados = await repo.carregarTudo();
    const confirmado = dados.lancamentos.find((l) => l.id === primeiro.id)!;
    expect(confirmado.status).toBe('efetivo');
    expect(confirmado.valor).toBe(9990); // efetivo intocado
    const previstos = dados.lancamentos.filter((l) => l.status === 'previsto');
    expect(previstos).toHaveLength(2);
    expect(previstos.every((l) => l.valor === 11000)).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it('excluirRecorrencia remove previstos e mantém efetivos', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    const rec = await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 10000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 3 },
      '2026-12-31',
    );
    const primeiro = (await repo.carregarTudo()).lancamentos.find((l) => l.data === '2026-08-05')!;
    await repo.confirmarPendente(primeiro.id);
    await repo.excluirRecorrencia(rec.id);
    const dados = await repo.carregarTudo();
    expect(dados.recorrencias).toHaveLength(0);
    expect(dados.lancamentos).toHaveLength(1);
    expect(dados.lancamentos[0].status).toBe('efetivo');
  } finally {
    vi.useRealTimers();
  }
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

it('excluirLancamento remove o lançamento', async () => {
  const { box, gasto } = await boxECategoria();
  const l = await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-02', valor: 5000, status: 'efetivo' });
  await repo.excluirLancamento(l.id);
  const dados = await repo.carregarTudo();
  expect(dados.lancamentos).toHaveLength(0);
});

it('atualizarCategoria altera nome, ordem e arquivada', async () => {
  const { gasto } = await boxECategoria();
  await repo.atualizarCategoria(gasto.id, { nome: 'mercado', ordem: 2, arquivada: true });
  const dados = await repo.carregarTudo();
  const atualizada = dados.categorias.find((c) => c.id === gasto.id)!;
  expect(atualizada.nome).toBe('mercado');
  expect(atualizada.ordem).toBe(2);
  expect(atualizada.arquivada).toBe(true);
});

it('materializarTodas atualiza previstos de todas as recorrências até um novo horizonte', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 5000, dataInicio: '2026-08-10', diaDoMes: 10, parcelas: null },
      '2026-10-31',
    );
    expect((await repo.carregarTudo()).lancamentos).toHaveLength(3);
    await repo.materializarTodas('2027-01-31');
    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(6);
  } finally {
    vi.useRealTimers();
  }
});

it('descartar (excluir) um previsto de recorrência que já venceu não faz ele reaparecer no próximo boot', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-01-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 5000, dataInicio: '2026-01-10', diaDoMes: 10, parcelas: 2 },
      '2026-12-31',
    );
    // em 2026-01-01, as duas ocorrências (01-10 e 02-10) ainda são futuras: ambas materializam.
    let dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(2);
    const vencido = dados.lancamentos.find((l) => l.data === '2026-01-10')!;

    // o tempo passa: a ocorrência de 01-10 já venceu (virou pendente) e o usuário descarta.
    vi.setSystemTime(new Date('2026-01-15T12:00:00'));
    await repo.excluirLancamento(vencido.id);
    await repo.materializarTodas('2026-12-31'); // próximo "boot"

    dados = await repo.carregarTudo();
    expect(dados.lancamentos.find((l) => l.data === '2026-01-10')).toBeUndefined();
    expect(dados.lancamentos).toHaveLength(1); // só resta a ocorrência de 02-10
  } finally {
    vi.useRealTimers();
  }
});

it('excluirCenario apaga o cenário e os lançamentos/recorrências vinculados a ele', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    const agora = agoraISO();
    await repo.salvarCenario({ id: 'cen2', nome: 'moto', ligado: true, criadoEm: agora, alteradoEm: agora });
    await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-01', valor: 30000, status: 'previsto', cenarioId: 'cen2',
    });
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 8000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 3, cenarioId: 'cen2' },
      '2026-12-31',
    );
    const antes = await repo.carregarTudo();
    expect(antes.recorrencias).toHaveLength(1);
    expect(antes.lancamentos.filter((l) => l.cenarioId === 'cen2')).toHaveLength(4); // 1 manual + 3 materializados

    await repo.excluirCenario('cen2');
    const dados = await repo.carregarTudo();
    expect(dados.cenarios).toHaveLength(0);
    expect(dados.recorrencias).toHaveLength(0);
    expect(dados.lancamentos).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

it('salvarConfig persiste o patch mesmo antes de qualquer carregarTudo (regressão)', async () => {
  await repo.salvarConfig({ boxPadraoId: 'box1' });
  const dados = await repo.carregarTudo();
  expect(dados.config.boxPadraoId).toBe('box1');
});

it('substituirTudo troca completamente os dados e reseta mudancasDesdeBackup', async () => {
  const { box, gasto } = await boxECategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: gasto.id, data: '2026-07-02', valor: 5000, status: 'efetivo' });
  expect((await repo.carregarTudo()).config.mudancasDesdeBackup).toBe(true);

  const agora = agoraISO();
  const novoBox: Box = {
    id: 'nb1', nome: 'novo', saldoInicial: 500, dataSaldoInicial: '2026-02-01', criadoEm: agora, alteradoEm: agora,
  };
  const novaCategoria: Categoria = {
    id: 'nc1', boxId: 'nb1', nome: 'nova cat', tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora,
  };
  const dadosNovos: Dados = {
    boxes: [novoBox],
    categorias: [novaCategoria],
    lancamentos: [{
      id: 'nl1', boxId: 'nb1', categoriaId: 'nc1', data: '2026-09-01', valor: 999,
      status: 'previsto', origem: 'manual', criadoEm: agora, alteradoEm: agora,
    }],
    recorrencias: [],
    cenarios: [],
    cartoes: [],
    categoriasCartao: [],
    comprasCartao: [],
    recorrenciasCartao: [],
    conferenciasFatura: [],
    viagens: [],
    bancos: [],
    config: {
      id: 'config', boxPadraoId: 'nb1', ultimoBackupEm: agora,
      mudancasDesdeBackup: true, horizonteProjecao: `${new Date().getFullYear() + 1}-12-31`,
    },
  };
  await repo.substituirTudo(dadosNovos);
  const dados = await repo.carregarTudo();
  expect(dados.boxes.map((b) => b.id)).toEqual(['nb1']);
  expect(dados.categorias.map((c) => c.id)).toEqual(['nc1']);
  expect(dados.lancamentos.map((l) => l.id)).toEqual(['nl1']);
  expect(dados.config.boxPadraoId).toBe('nb1');
  expect(dados.config.mudancasDesdeBackup).toBe(false);
});

describe('tabelas do cartão', () => {
  it('carregarTudo devolve as tabelas novas (vazias num banco novo)', async () => {
    const dados = await repo.carregarTudo();
    expect(dados.cartoes).toEqual([]);
    expect(dados.categoriasCartao).toEqual([]);
    expect(dados.comprasCartao).toEqual([]);
    expect(dados.recorrenciasCartao).toEqual([]);
    expect(dados.conferenciasFatura).toEqual([]);
  });

  it('substituirTudo limpa e regrava as tabelas do cartão', async () => {
    const agora = agoraISO();
    await db.cartoes.add({
      id: 'velho', boxId: 'b', nome: 'Velho', diaFechamento: 1, diaVencimento: 10,
      categoriaFaturaId: 'c', ativo: true, criadoEm: agora, alteradoEm: agora,
    });
    const dados = await repo.carregarTudo();
    await repo.substituirTudo({
      ...dados,
      cartoes: [{
        id: 'novo', boxId: 'b', nome: 'Novo', diaFechamento: 28, diaVencimento: 5,
        categoriaFaturaId: 'c', ativo: true, criadoEm: agora, alteradoEm: agora,
      }],
    });
    const depois = await db.cartoes.toArray();
    expect(depois.map((c) => c.id)).toEqual(['novo']);
  });

  it('substituirTudo deduplica conferências do mesmo cartão e mês', async () => {
    const dados = await repo.carregarTudo();
    const base = { cartaoId: 'k1', mes: '2026-03', usarValorApp: true, criadoEm: '2026-03-01' };
    await repo.substituirTudo({
      ...dados,
      conferenciasFatura: [
        { ...base, id: 'cf1', valorAppCent: 10_000, alteradoEm: '2026-03-01' },
        { ...base, id: 'cf2', valorAppCent: 25_000, alteradoEm: '2026-03-10' },
        { ...base, id: 'cf3', mes: '2026-04', valorAppCent: 30_000, alteradoEm: '2026-04-01' },
      ],
    });
    const depois = await db.conferenciasFatura.toArray();
    expect(depois.map((c) => c.id).sort()).toEqual(['cf2', 'cf3']);
  });
});

describe('cartão de crédito', () => {
  async function montarCartao() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    return { box, cartao, catCartao };
  }

  it('cria a categoria da fatura automaticamente, oculta, com o nome do cartão', async () => {
    const { box, cartao } = await montarCartao();
    const categoria = await db.categorias.get(cartao.categoriaFaturaId);
    expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto', arquivada: false });
  });

  it('editar o nome do cartão renomeia a categoria da fatura junto', async () => {
    const { cartao } = await montarCartao();
    await repo.salvarCartao({ ...cartao, nome: 'Nubank Ultravioleta' }, '2027-12-31');
    const categoria = await db.categorias.get(cartao.categoriaFaturaId);
    expect(categoria?.nome).toBe('Nubank Ultravioleta');
  });

  it('editar um cartão ignora categoriaFaturaId estranho no payload e não renomeia categoria alheia', async () => {
    const { cartao } = await montarCartao();
    const outraCategoria = await repo.salvarCategoria({ boxId: cartao.boxId, nome: 'mercado', tipo: 'gasto', ordem: 1 });

    await repo.salvarCartao({ ...cartao, nome: 'Nubank Ultravioleta', categoriaFaturaId: outraCategoria.id }, '2027-12-31');

    const atualizado = await db.cartoes.get(cartao.id);
    expect(atualizado?.categoriaFaturaId).toBe(cartao.categoriaFaturaId);

    const categoriaOriginal = await db.categorias.get(cartao.categoriaFaturaId);
    expect(categoriaOriginal?.nome).toBe('Nubank Ultravioleta');

    const categoriaAlheia = await db.categorias.get(outraCategoria.id);
    expect(categoriaAlheia?.nome).toBe('mercado');
  });

  it('compra parcelada gera um previsto por fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 10000, parcelas: 3,
      }, '2027-12-31');
      const previstos = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(previstos.map((l) => [l.faturaMes, l.data, l.valor, l.status])).toEqual([
        ['2026-08', '2026-08-05', 3334, 'previsto'],
        ['2026-09', '2026-09-05', 3333, 'previsto'],
        ['2026-10', '2026-10-05', 3333, 'previsto'],
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('editar e excluir compra atualizam os previstos; efetivo confirmado fica intacto', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const compra = await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 6000, parcelas: 2,
      }, '2027-12-31');
      const ago = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      await repo.confirmarPendente(ago.id, 3100); // confirma a 1ª fatura com valor ajustado

      await repo.atualizarCompraCartao(compra.id, { valorTotal: 8000 }, '2027-12-31');
      const depois = await db.lancamentos.toArray();
      expect(depois.find((l) => l.faturaMes === '2026-08')!.valor).toBe(3100); // efetivo intocado
      expect(depois.find((l) => l.faturaMes === '2026-09')!.valor).toBe(4000); // previsto seguiu

      await repo.excluirCompraCartao(compra.id, '2027-12-31');
      const fim = await db.lancamentos.toArray();
      expect(fim.find((l) => l.faturaMes === '2026-08')!.valor).toBe(3100); // história preservada
      expect(fim.find((l) => l.faturaMes === '2026-09')).toBeUndefined();   // previsto removido
    } finally { vi.useRealTimers(); }
  });

  it('assinatura materializa compras futuras e pausar remove as não passadas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const ass = await repo.salvarAssinatura({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, valor: 4990,
        dataInicio: '2026-07-15', diaDoMes: 15, parcelas: null, descricao: 'Netflix',
      }, '2026-12-31');
      const compras = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
      // compras materializadas até o horizonte (2026-12-31); a de 12-15 cai na fatura de
      // vencimento 2027-01-05, que passa do horizonte — a compra existe, o previsto não.
      expect(compras.map((c) => c.data).sort()).toEqual([
        '2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15',
      ]);
      expect(compras.every((c) => c.valorTotal === 4990 && c.parcelas === 1)).toBe(true);

      await repo.salvarAssinatura({ ...ass, ativa: false }, '2026-12-31');
      expect(await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).count()).toBe(0);
      // (nada é "passado" aqui: hoje=2026-07-01 é antes da 1ª ocorrência)
    } finally { vi.useRealTimers(); }
  });

  it('assinatura criada com o dia do ciclo atual já passado inclui a cobrança do mês corrente', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-28T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const ass = await repo.salvarAssinatura({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, valor: 2990,
        dataInicio: '2026-07-17', diaDoMes: 17, parcelas: null, descricao: 'Streaming',
      }, '2026-12-31');
      const compras = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
      expect(compras.map((c) => c.data).sort()).toEqual([
        '2026-07-17', '2026-08-17', '2026-09-17', '2026-10-17', '2026-11-17', '2026-12-17',
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('editar uma assinatura cujo ciclo atual foi apagado recria só esse ciclo, sem tocar sincronização em segundo plano', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-06-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const ass = await repo.salvarAssinatura({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, valor: 3990,
        dataInicio: '2026-06-17', diaDoMes: 17, parcelas: null, descricao: 'Streaming',
      }, '2026-12-31');

      vi.setSystemTime(new Date('2026-07-28T12:00:00'));
      const julho = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id)
        .and((c) => c.data === '2026-07-17').first();
      await db.comprasCartao.delete(julho!.id); // simula o usuário apagando o lançamento de propósito

      // sincronização em segundo plano (ex.: reabrir o app) não ressuscita o ciclo apagado
      await repo.sincronizarCartoes('2026-12-31');
      expect(await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id)
        .and((c) => c.data === '2026-07-17').count()).toBe(0);

      // editar essa assinatura específica recria só o ciclo atual que está faltando
      await repo.salvarAssinatura({ ...ass, valor: 4990 }, '2026-12-31');
      const recriada = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id)
        .and((c) => c.data === '2026-07-17').first();
      expect(recriada?.valorTotal).toBe(4990);
    } finally { vi.useRealTimers(); }
  });

  it('conferência usarValorApp muda o valor do previsto; desmarcar volta à soma', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 8000, parcelas: 1,
      }, '2027-12-31');
      await repo.salvarConferenciaFatura(cartao.id, '2026-08', 10000, true, '2027-12-31');
      let previsto = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      expect(previsto.valor).toBe(10000);
      await repo.salvarConferenciaFatura(cartao.id, '2026-08', 10000, false, '2027-12-31');
      previsto = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      expect(previsto.valor).toBe(8000);
    } finally { vi.useRealTimers(); }
  });

  it('desativar cartão remove os previstos e preserva efetivos e compras', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 5000, parcelas: 1,
      }, '2027-12-31');
      await repo.salvarCartao({ ...cartao, ativo: false }, '2027-12-31');
      expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao')).toEqual([]);
      expect(await db.comprasCartao.count()).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});

it('carregarTudo devolve categorias na ordem canônica (ganho→gasto, ordem, nome)', async () => {
  const agora = agoraISO();
  const box: Box = {
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 1 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'pix', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 5 });
  const dados = await repo.carregarTudo();
  expect(dados.categorias.map((c) => c.nome)).toEqual(['salário', 'aluguel', 'pix', 'mercado']);
});

describe('viagem', () => {
  it('salvarViagem persiste e carregarTudo devolve a viagem', async () => {
    const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
    const dados = await repo.carregarTudo();
    expect(dados.viagens).toHaveLength(1);
    expect(dados.viagens[0]).toMatchObject({ id: v.id, nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
  });

  it('atualizarViagem altera nome e datas', async () => {
    const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
    await repo.atualizarViagem(v.id, { nome: 'Praia em família', dataFim: '2026-02-06' });
    const dados = await repo.carregarTudo();
    expect(dados.viagens[0]).toMatchObject({ nome: 'Praia em família', dataInicio: '2026-01-31', dataFim: '2026-02-06' });
  });

  it('excluirViagem apaga a viagem e desvincula lançamentos e compras marcados, sem apagá-los', async () => {
    const { box, gasto } = await boxECategoria();
    const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-02-01', valor: 5000, status: 'efetivo', viagemId: v.id,
    });
    const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'hotel', ordem: 0 });
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-02-01', valorTotal: 20000, parcelas: 1, viagemId: v.id,
    }, '2027-12-31');

    await repo.excluirViagem(v.id);

    const dados = await repo.carregarTudo();
    expect(dados.viagens).toHaveLength(0);
    expect(dados.lancamentos.find((x) => x.id === l.id)?.viagemId).toBeUndefined();
    expect(dados.comprasCartao.find((x) => x.id === compra.id)?.viagemId).toBeUndefined();
  });

  it('atualizarLancamento remove a marcação de viagem quando o patch passa viagemId undefined', async () => {
    const { box, gasto } = await boxECategoria();
    const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-02-01', valor: 5000, status: 'efetivo', viagemId: v.id,
    });
    await repo.atualizarLancamento(l.id, { viagemId: undefined });
    const dados = await repo.carregarTudo();
    expect(dados.lancamentos.find((x) => x.id === l.id)?.viagemId).toBeUndefined();
  });

  it('atualizarCompraCartao remove a marcação de viagem quando o patch passa viagemId undefined', async () => {
    const { box } = await boxECategoria();
    const v = await repo.salvarViagem({ nome: 'Praia', dataInicio: '2026-01-31', dataFim: '2026-02-05' });
    const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'hotel', ordem: 0 });
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-02-01', valorTotal: 20000, parcelas: 1, viagemId: v.id,
    }, '2027-12-31');
    await repo.atualizarCompraCartao(compra.id, { viagemId: undefined }, '2027-12-31');
    const dados = await repo.carregarTudo();
    expect(dados.comprasCartao.find((x) => x.id === compra.id)?.viagemId).toBeUndefined();
  });

  it('substituirTudo inclui viagens no roundtrip', async () => {
    await repo.salvarViagem({ nome: 'Velha', dataInicio: '2026-01-01', dataFim: '2026-01-05' });
    const dados = await repo.carregarTudo();
    const agora = agoraISO();
    await repo.substituirTudo({
      ...dados,
      viagens: [{ id: 'nv1', nome: 'Nova', dataInicio: '2026-03-01', dataFim: '2026-03-05', criadoEm: agora, alteradoEm: agora }],
    });
    const depois = await repo.carregarTudo();
    expect(depois.viagens.map((v) => v.id)).toEqual(['nv1']);
  });
});

describe('bancos', () => {
  it('substituirTudo grava bancos do backup e remove os locais pré-existentes', async () => {
    const agora = agoraISO();
    await db.bancos.add({
      id: 'velho', boxId: 'b', nome: 'Banco Velho', ordem: 0,
      saldoDeclaradoCent: 1000, dataSaldoDeclarado: '2026-01-01', criadoEm: agora, alteradoEm: agora,
    });
    const dados = await repo.carregarTudo();
    await repo.substituirTudo({
      ...dados,
      bancos: [{
        id: 'novo', boxId: 'b', nome: 'Banco Novo', ordem: 0,
        saldoDeclaradoCent: 2000, dataSaldoDeclarado: '2026-02-01', criadoEm: agora, alteradoEm: agora,
      }],
    });
    const depois = await db.bancos.toArray();
    expect(depois.map((c) => c.id)).toEqual(['novo']);
  });
});

it('carregarTudo devolve categorias de cartão ordenadas por ordem e nome', async () => {
  const agora = agoraISO();
  const box: Box = {
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'streaming', ordem: 1 });
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'farmácia', ordem: 0 });
  const dados = await repo.carregarTudo();
  expect(dados.categoriasCartao.map((c) => c.nome)).toEqual(['farmácia', 'mercado', 'streaming']);
});

describe('categoriaAssinaturasDe', () => {
  it('cria a categoria "Assinaturas" do cartão na primeira chamada', async () => {
    const { box } = await boxECategoria();
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    const categoriaId = await repo.categoriaAssinaturasDe(cartao.id);

    const categoria = await db.categoriasCartao.get(categoriaId);
    expect(categoria).toMatchObject({ cartaoId: cartao.id, nome: 'Assinaturas', arquivada: false });
    const cartaoAtualizado = await db.cartoes.get(cartao.id);
    expect(cartaoAtualizado?.categoriaAssinaturasId).toBe(categoriaId);
  });

  it('reaproveita a categoria já criada nas chamadas seguintes', async () => {
    const { box } = await boxECategoria();
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    const primeira = await repo.categoriaAssinaturasDe(cartao.id);
    const segunda = await repo.categoriaAssinaturasDe(cartao.id);

    expect(segunda).toBe(primeira);
    expect(await db.categoriasCartao.count()).toBe(1);
  });
});

describe('registrarPagamentoFatura', () => {
  // Monta um cartão com o ciclo pedido e uma fatura já projetada no Flow.
  async function comFatura(diaFechamento: number, diaVencimento: number, totalCent: number) {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Cartão', diaFechamento, diaVencimento }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-05',
      valorTotal: totalCent, parcelas: 1,
    }, '2027-12-31');
    const lancamentos = await db.lancamentos.toArray();
    return { cartao, fatura: lancamentos.find((l) => l.origem === 'cartao')! };
  }

  it('sem parcelamento: só grava o valor pago como efetivo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);
      expect(fatura.valor).toBe(90000);

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: fatura.faturaMes!,
        valorPagoCent: 85000, dataPagamento: fatura.data, horizonte: '2027-12-31',
      });

      const depois = await db.lancamentos.get(fatura.id);
      expect(depois).toMatchObject({ status: 'efetivo', valor: 85000 });
      expect(await db.comprasCartao.count()).toBe(1); // só a compra original
    } finally { vi.useRealTimers(); }
  });

  it('parcelado: a parcela 1 cai na fatura seguinte (vencimento antes do fechamento)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      // fecha 28/07, vence 05/08
      const { cartao, fatura } = await comFatura(28, 5, 90000);
      expect(fatura.faturaMes).toBe('2026-08');

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: fatura.data, parcelamento: { parcelas: 3, valorParcelaCent: 20000 },
        horizonte: '2027-12-31',
      });

      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-08', 30000, 'efetivo'],   // o que foi realmente pago
        ['2026-09', 20000, 'previsto'],  // parcela 1
        ['2026-10', 20000, 'previsto'],  // parcela 2
        ['2026-11', 20000, 'previsto'],  // parcela 3
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('parcelado: a parcela 1 cai na fatura seguinte (vencimento depois do fechamento)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      // fecha 10/07, vence 20/07
      const { cartao, fatura } = await comFatura(10, 20, 90000);
      expect(fatura.faturaMes).toBe('2026-07');

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-07',
        valorPagoCent: 30000, dataPagamento: fatura.data, parcelamento: { parcelas: 2, valorParcelaCent: 30000 },
        horizonte: '2027-12-31',
      });

      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-07', 30000, 'efetivo'],
        ['2026-08', 30000, 'previsto'],
        ['2026-09', 30000, 'previsto'],
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('o parcelamento vira compra na categoria reservada, com a descrição do mês da fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: fatura.data, parcelamento: { parcelas: 3, valorParcelaCent: 22000 },
        horizonte: '2027-12-31',
      });

      const atualizado = (await db.cartoes.get(cartao.id))!;
      expect(atualizado.categoriaParcelamentoId).toBeDefined();
      const categoria = await db.categoriasCartao.get(atualizado.categoriaParcelamentoId!);
      expect(categoria).toMatchObject({ nome: 'Parcelamento', arquivada: false });

      const parcelamento = (await db.comprasCartao.toArray())
        .find((c) => c.categoriaCartaoId === atualizado.categoriaParcelamentoId)!;
      expect(parcelamento).toMatchObject({
        data: '2026-07-28',      // o fechamento da fatura paga
        valorTotal: 66000,       // 3 × 220,00 — com os juros do banco embutidos
        parcelas: 3,
        descricao: 'Parcelamento da fatura de 08/2026',
      });
    } finally { vi.useRealTimers(); }
  });

  it('parcelar duas faturas reaproveita a mesma categoria reservada', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);
      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: fatura.data, parcelamento: { parcelas: 2, valorParcelaCent: 30000 },
        horizonte: '2027-12-31',
      });
      const setembro = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-09')!;
      await repo.registrarPagamentoFatura({
        lancamentoId: setembro.id, cartaoId: cartao.id, faturaMes: '2026-09',
        valorPagoCent: 10000, dataPagamento: setembro.data, parcelamento: { parcelas: 2, valorParcelaCent: 10000 },
        horizonte: '2027-12-31',
      });

      const reservadas = (await db.categoriasCartao.toArray()).filter((c) => c.nome === 'Parcelamento');
      expect(reservadas).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it('pagar adiantado move a saída para o dia do pagamento, sem mexer no mês da fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);
      expect(fatura.data).toBe('2026-08-05'); // vencimento

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 90000, dataPagamento: '2026-07-28', // dez dias antes
        horizonte: '2027-12-31',
      });

      const depois = await db.lancamentos.get(fatura.id);
      expect(depois).toMatchObject({ status: 'efetivo', data: '2026-07-28', faturaMes: '2026-08' });
    } finally { vi.useRealTimers(); }
  });

  it('a data do pagamento não desloca as parcelas, que seguem o ciclo da fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: '2026-07-20', // pagou bem antes do vencimento
        parcelamento: { parcelas: 3, valorParcelaCent: 20000 },
        horizonte: '2027-12-31',
      });

      // as parcelas continuam nas faturas 09, 10 e 11 — quem manda nelas é o fechamento do
      // cartão, não o dia em que o usuário quitou a fatura anterior
      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.status === 'previsto')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.data, l.valor])).toEqual([
        ['2026-09', '2026-09-05', 20000],
        ['2026-10', '2026-10-05', 20000],
        ['2026-11', '2026-11-05', 20000],
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('parcelar uma fatura já confirmada corrige o valor pago e cria as parcelas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, fatura } = await comFatura(28, 5, 90000);
      await repo.confirmarPendente(fatura.id); // confirmou pelo valor cheio, sem lembrar do parcelamento
      expect((await db.lancamentos.get(fatura.id))!.valor).toBe(90000);

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: fatura.data, parcelamento: { parcelas: 3, valorParcelaCent: 20000 },
        horizonte: '2027-12-31',
      });

      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
      const parcelas = (await db.lancamentos.toArray()).filter((l) => l.status === 'previsto' && l.origem === 'cartao');
      expect(parcelas.map((l) => l.faturaMes).sort()).toEqual(['2026-09', '2026-10', '2026-11']);
    } finally { vi.useRealTimers(); }
  });
});

describe('bancos', () => {
  it('salvarBanco cria com saldo não informado e aparece em carregarTudo', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });

    expect(banco).toMatchObject({ nome: 'Banco Um', saldoDeclaradoCent: null, dataSaldoDeclarado: null });
    const dados = await repo.carregarTudo();
    expect(dados.bancos.map((b) => b.nome)).toEqual(['Banco Um']);
    expect(dados.config.mudancasDesdeBackup).toBe(true);
  });

  it('atualizarBanco grava o saldo informado com a data', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: 50000, dataSaldoDeclarado: '2026-08-05' });

    expect(await db.bancos.get(banco.id)).toMatchObject({
      saldoDeclaradoCent: 50000, dataSaldoDeclarado: '2026-08-05',
    });
  });

  it('excluirBanco limpa o bancoId dos cartões que apontavam para ele', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Cartão', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    await db.cartoes.update(cartao.id, { bancoId: banco.id });

    await repo.excluirBanco(banco.id);

    // cartão órfão apontando para banco inexistente é inconsistência silenciosa
    expect(await db.bancos.get(banco.id)).toBeUndefined();
    expect((await db.cartoes.get(cartao.id))?.bancoId).toBeUndefined();
  });

  it('excluirBanco não mexe em cartão de outro banco', async () => {
    const { box } = await boxECategoria();
    const alvo = await repo.salvarBanco({ boxId: box.id, nome: 'Alvo', ordem: 0 });
    const outro = await repo.salvarBanco({ boxId: box.id, nome: 'Outro', ordem: 1 });
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Cartão', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    await db.cartoes.update(cartao.id, { bancoId: outro.id });

    await repo.excluirBanco(alvo.id);

    expect((await db.cartoes.get(cartao.id))?.bancoId).toBe(outro.id);
  });
});

it('confirma um pendente com valor e data corrigidos', async () => {
  const { box, gasto } = await boxECategoria();
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: gasto.id, data: '2026-08-27', valor: 12000, status: 'previsto',
  });

  await repo.confirmarPendente(lanc.id, 13700, '2026-08-28');

  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.status).toBe('efetivo');
  expect(salvo?.valor).toBe(13700);
  expect(salvo?.data).toBe('2026-08-28');
});

it('confirma um pendente sem data corrigida e mantém a data do previsto', async () => {
  const { box, gasto } = await boxECategoria();
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: gasto.id, data: '2026-08-27', valor: 12000, status: 'previsto',
  });

  await repo.confirmarPendente(lanc.id, 13700);

  const salvo = await db.lancamentos.get(lanc.id);
  expect(salvo?.valor).toBe(13700);
  expect(salvo?.data).toBe('2026-08-27');
});
