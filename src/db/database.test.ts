import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import type { Box, Categoria, Lancamento, Recorrencia, Config } from '../domain/types';
import { agoraISO, novoId } from '../domain/types';

/**
 * Testes de upgrade de schema Dexie.
 *
 * Cada teste:
 * 1. Cria um banco numa versão antiga
 * 2. Popula com dados reais
 * 3. Fecha o banco
 * 4. Reabre na versão seguinte
 * 5. Verifica que todos os dados sobrevivem à migração
 *
 * Se um campo gravado numa versão antiga NÃO aparecer na versão nova, isso é um bug
 * de perda de dados. Parar e reportar imediatamente.
 */

/**
 * Helper: compara dois arrays agnóstico de ordem, identificando itens por ID.
 */
function expectArraysEqualById<T extends { id: string }>(actual: T[], expected: T[]): void {
  expect(actual).toHaveLength(expected.length);
  const actualMap = new Map(actual.map((item) => [item.id, item]));
  const expectedMap = new Map(expected.map((item) => [item.id, item]));
  for (const [id, expectedItem] of expectedMap) {
    const actualItem = actualMap.get(id);
    expect(actualItem).toEqual(expectedItem);
  }
}

/**
 * Teste 1: Upgrade v1 → v2
 *
 * V1 tinha: boxes, categorias, lancamentos, recorrencias, cenarios, config
 * V2 adiciona: cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura
 *
 * Dados de v1 não devem desaparecer. Novos índices em lancamentos (cartaoId) não devem quebrar.
 */
describe('Database upgrade v1 → v2', () => {
  it('sobrevive dados de v1 quando reaberto em v2', async () => {
    const dbName = `flow-test-v1-to-v2-${novoId()}`;

    // === Passo 1: Criar banco em v1, popular dados ===
    const dbV1 = new Dexie(dbName);
    dbV1.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });

    await dbV1.open();

    const agora = agoraISO();

    // Guardar IDs para verificação
    const boxId = novoId();
    const categoriaGanhoId = novoId();
    const categoriaBrasoId = novoId();
    const lancamento1Id = novoId();
    const lancamento2Id = novoId();
    const recorrenciaId = novoId();
    const cenarioId = novoId();

    // Adicionar dados de v1
    const boxes: Box[] = [{
      id: boxId,
      nome: 'Eitor',
      saldoInicial: 500000,
      dataSaldoInicial: '2026-01-01',
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const categorias: Categoria[] = [
      {
        id: categoriaGanhoId,
        boxId,
        nome: 'Salário',
        tipo: 'ganho',
        ordem: 0,
        arquivada: false,
        criadoEm: agora,
        alteradoEm: agora,
      },
      {
        id: categoriaBrasoId,
        boxId,
        nome: 'Mercado',
        tipo: 'gasto',
        ordem: 0,
        arquivada: false,
        criadoEm: agora,
        alteradoEm: agora,
      },
    ];

    const lancamentos: Lancamento[] = [
      {
        id: lancamento1Id,
        boxId,
        categoriaId: categoriaGanhoId,
        data: '2026-07-01',
        valor: 250000,
        status: 'efetivo',
        origem: 'manual',
        criadoEm: agora,
        alteradoEm: agora,
      },
      {
        id: lancamento2Id,
        boxId,
        categoriaId: categoriaBrasoId,
        data: '2026-07-05',
        valor: 15000,
        status: 'previsto',
        origem: 'recorrencia',
        recorrenciaId,
        criadoEm: agora,
        alteradoEm: agora,
      },
    ];

    const recorrencias: Recorrencia[] = [{
      id: recorrenciaId,
      boxId,
      categoriaId: categoriaBrasoId,
      valor: 15000,
      dataInicio: '2026-07-05',
      diaDoMes: 5,
      parcelas: null,
      ativa: true,
      origem: 'manual',
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const cenarios = [
      {
        id: cenarioId,
        nome: 'Compra grande',
        ligado: true,
        criadoEm: agora,
        alteradoEm: agora,
      },
    ];

    const config: Config = {
      id: 'config',
      boxPadraoId: boxId,
      ultimoBackupEm: agora,
      mudancasDesdeBackup: false,
      horizonteProjecao: '2027-12-31',
    };

    // Inserir tudo em v1
    await dbV1.table('boxes').bulkAdd(boxes);
    await dbV1.table('categorias').bulkAdd(categorias);
    await dbV1.table('lancamentos').bulkAdd(lancamentos);
    await dbV1.table('recorrencias').bulkAdd(recorrencias);
    await dbV1.table('cenarios').bulkAdd(cenarios);
    await dbV1.table('config').put(config);

    // === Passo 2: Fechar v1 ===
    await dbV1.close();

    // === Passo 3: Reabrir em v2 (com o novo índice em lancamentos) ===
    const dbV2 = new Dexie(dbName);
    dbV2.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    dbV2.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });

    await dbV2.open();

    // === Passo 4: Verificar que dados de v1 sobrevivem ===
    expectArraysEqualById(await dbV2.table('boxes').toArray(), boxes);
    expectArraysEqualById(await dbV2.table('categorias').toArray(), categorias);
    expectArraysEqualById(await dbV2.table('lancamentos').toArray(), lancamentos);
    expectArraysEqualById(await dbV2.table('recorrencias').toArray(), recorrencias);
    expectArraysEqualById(await dbV2.table('cenarios').toArray(), cenarios);
    expect(await dbV2.table('config').get('config')).toEqual(config);

    // === Passo 5: Verificar que tabelas novas de v2 estão vazias ===
    expect(await dbV2.table('cartoes').toArray()).toEqual([]);
    expect(await dbV2.table('categoriasCartao').toArray()).toEqual([]);
    expect(await dbV2.table('comprasCartao').toArray()).toEqual([]);
    expect(await dbV2.table('recorrenciasCartao').toArray()).toEqual([]);
    expect(await dbV2.table('conferenciasFatura').toArray()).toEqual([]);

    await dbV2.close();
    await Dexie.delete(dbName);
  });
});

/**
 * Teste 2: Upgrade v2 → v3
 *
 * V2 tinha: boxes, categorias, lancamentos, recorrencias, cenarios, config, cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura
 * V3 adiciona: viagens + índices para viagemId em lancamentos e comprasCartao
 *
 * Dados de v2 não devem desaparecer. Novos índices não devem quebrar.
 */
describe('Database upgrade v2 → v3', () => {
  it('sobrevive dados de v2 quando reaberto em v3', async () => {
    const dbName = `flow-test-v2-to-v3-${novoId()}`;

    // === Passo 1: Criar banco em v2, popular dados ===
    const dbV2 = new Dexie(dbName);
    dbV2.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    dbV2.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });

    await dbV2.open();

    const agora = agoraISO();

    // Guardar IDs
    const boxId = novoId();
    const cartaoId = novoId();
    const categoriaFaturaId = novoId();
    const categoriaCartaoId = novoId();
    const compraCartaoId = novoId();
    const recorrenciaCartaoId = novoId();
    const conferenciaFaturaId = novoId();

    // Adicionar dados de v2 (incluindo dados de cartão)
    const cartoes = [{
      id: cartaoId,
      boxId,
      nome: 'Nubank',
      diaFechamento: 28,
      diaVencimento: 5,
      categoriaFaturaId,
      ativo: true,
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const categoriasCartao = [{
      id: categoriaCartaoId,
      cartaoId,
      nome: 'Alimentação',
      ordem: 0,
      arquivada: false,
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const comprasCartao = [{
      id: compraCartaoId,
      cartaoId,
      categoriaCartaoId,
      data: '2026-07-10',
      valorTotal: 50000,
      parcelas: 2,
      descricao: 'Compra de teste',
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const recorrenciasCartao = [{
      id: recorrenciaCartaoId,
      cartaoId,
      categoriaCartaoId,
      valor: 4990,
      dataInicio: '2026-07-15',
      diaDoMes: 15,
      parcelas: null,
      descricao: 'Netflix',
      ativa: true,
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const conferenciasFatura = [{
      id: conferenciaFaturaId,
      cartaoId,
      mes: '2026-08',
      valorAppCent: 100000,
      usarValorApp: true,
      criadoEm: agora,
      alteradoEm: agora,
    }];

    // Inserir em v2
    await dbV2.table('cartoes').bulkAdd(cartoes);
    await dbV2.table('categoriasCartao').bulkAdd(categoriasCartao);
    await dbV2.table('comprasCartao').bulkAdd(comprasCartao);
    await dbV2.table('recorrenciasCartao').bulkAdd(recorrenciasCartao);
    await dbV2.table('conferenciasFatura').bulkAdd(conferenciasFatura);

    await dbV2.close();

    // === Passo 2: Reabrir em v3 (com viagens e novos índices) ===
    const dbV3 = new Dexie(dbName);
    dbV3.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    dbV3.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });
    dbV3.version(3).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
      viagens: 'id, dataInicio, dataFim',
    });

    await dbV3.open();

    // === Passo 3: Verificar que dados de v2 sobrevivem ===
    expectArraysEqualById(await dbV3.table('cartoes').toArray(), cartoes);
    expectArraysEqualById(await dbV3.table('categoriasCartao').toArray(), categoriasCartao);
    expectArraysEqualById(await dbV3.table('comprasCartao').toArray(), comprasCartao);
    expectArraysEqualById(await dbV3.table('recorrenciasCartao').toArray(), recorrenciasCartao);
    expectArraysEqualById(await dbV3.table('conferenciasFatura').toArray(), conferenciasFatura);

    // === Passo 4: Verificar que tabela nova de v3 está vazia ===
    expect(await dbV3.table('viagens').toArray()).toEqual([]);

    await dbV3.close();
    await Dexie.delete(dbName);
  });
});

/**
 * Teste 3: Upgrade v1 → v3 (full chain)
 *
 * Garante que os dados conseguem atravessar os dois upgrades sem se perder.
 * Este teste exerce a cadeia inteira: v1 → v2 → v3.
 */
describe('Database upgrade v1 → v3 (full chain)', () => {
  it('sobrevive dados de v1 através da cadeia completa v1→v2→v3', async () => {
    const dbName = `flow-test-v1-to-v3-${novoId()}`;

    // === Passo 1: Criar banco em v1, popular dados ===
    const dbV1 = new Dexie(dbName);
    dbV1.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });

    await dbV1.open();

    const agora = agoraISO();
    const boxId = novoId();
    const categoriaId = novoId();
    const lancamentoId = novoId();

    const boxes: Box[] = [{
      id: boxId,
      nome: 'Casa',
      saldoInicial: 1000000,
      dataSaldoInicial: '2026-01-01',
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const categorias: Categoria[] = [{
      id: categoriaId,
      boxId,
      nome: 'Aluguel',
      tipo: 'gasto',
      ordem: 0,
      arquivada: false,
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const lancamentos: Lancamento[] = [{
      id: lancamentoId,
      boxId,
      categoriaId,
      data: '2026-08-10',
      valor: 150000,
      status: 'efetivo',
      origem: 'manual',
      criadoEm: agora,
      alteradoEm: agora,
    }];

    const config: Config = {
      id: 'config',
      boxPadraoId: boxId,
      ultimoBackupEm: agora,
      mudancasDesdeBackup: false,
      horizonteProjecao: '2027-12-31',
    };

    await dbV1.table('boxes').bulkAdd(boxes);
    await dbV1.table('categorias').bulkAdd(categorias);
    await dbV1.table('lancamentos').bulkAdd(lancamentos);
    await dbV1.table('config').put(config);

    await dbV1.close();

    // === Passo 2: Reabrir em v3 (vai passar por v2 automaticamente) ===
    const dbV3 = new Dexie(dbName);
    dbV3.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    dbV3.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });
    dbV3.version(3).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
      viagens: 'id, dataInicio, dataFim',
    });

    await dbV3.open();

    // === Passo 3: Verificar que dados de v1 chegaram até v3 ===
    expectArraysEqualById(await dbV3.table('boxes').toArray(), boxes);
    expectArraysEqualById(await dbV3.table('categorias').toArray(), categorias);
    expectArraysEqualById(await dbV3.table('lancamentos').toArray(), lancamentos);
    expect(await dbV3.table('config').get('config')).toEqual(config);

    // === Passo 4: Verificar que tabelas intermediárias e novas estão vazias ===
    expect(await dbV3.table('recorrencias').toArray()).toEqual([]);
    expect(await dbV3.table('cenarios').toArray()).toEqual([]);
    expect(await dbV3.table('cartoes').toArray()).toEqual([]);
    expect(await dbV3.table('categoriasCartao').toArray()).toEqual([]);
    expect(await dbV3.table('comprasCartao').toArray()).toEqual([]);
    expect(await dbV3.table('recorrenciasCartao').toArray()).toEqual([]);
    expect(await dbV3.table('conferenciasFatura').toArray()).toEqual([]);
    expect(await dbV3.table('viagens').toArray()).toEqual([]);

    await dbV3.close();
    await Dexie.delete(dbName);
  });
});
