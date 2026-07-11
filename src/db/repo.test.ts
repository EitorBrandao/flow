import 'fake-indexeddb/auto';
import { db } from './database';
import * as repo from './repo';
import type { Box, Categoria, Dados } from '../domain/types';
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
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, gasto } = await boxECategoria();
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: gasto.id, valor: 12684, dataInicio: '2026-08-03', diaDoMes: 3, parcelas: 8 },
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
