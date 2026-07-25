import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { FlowDB } from './database';
import type {
  Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, Recorrencia, RecorrenciaCartao,
} from '../domain/types';
import { agoraISO, novoId } from '../domain/types';

/**
 * Testes de caminho de upgrade do schema Dexie do `FlowDB`.
 *
 * Cada teste de salto:
 * 1. Abre um Dexie CRU (não o `FlowDB`) declarando só o schema histórico da versão de
 *    origem — simula um cliente antigo com dados já gravados.
 * 2. Fecha esse banco.
 * 3. Abre `new FlowDB(mesmoNome)` — dispara a cadeia real de migrações declarada em
 *    `src/db/database.ts` até a versão atual.
 * 4. Confere que cada registro volta idêntico e que as tabelas novas existem vazias.
 *
 * Só os schemas das versões 1 e 2 são literais aqui (história congelada — nunca mude
 * estes literais). O lado novo de cada salto é sempre o `FlowDB` real: se alguém alterar
 * ou apagar uma `this.version(n)` em `database.ts`, este arquivo quebra.
 *
 * Se um registro gravado numa versão antiga não voltar idêntico depois da migração, é
 * bug real de perda de dados do usuário — parar e reportar, nunca afrouxar a asserção.
 */

/** Schema da v1 do FlowDB — literal, histórico, nunca mude. */
const SCHEMA_V1 = {
  boxes: 'id',
  categorias: 'id, boxId',
  lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
  recorrencias: 'id, boxId, origem',
  cenarios: 'id',
  config: 'id',
};

/** Schema da v2 do FlowDB — literal, histórico, nunca mude. */
const SCHEMA_V2 = {
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
};

/** Dados-base comuns a v1 e v2 (boxes, categorias, lançamentos, recorrência, cenário, config). */
function dadosBase() {
  const agora = agoraISO();
  const boxId = novoId();
  const categoriaGanhoId = novoId();
  const categoriaGastoId = novoId();
  const recorrenciaId = novoId();

  const box: Box = {
    id: boxId,
    nome: 'conta teste',
    saldoInicial: 100000,
    dataSaldoInicial: '2026-01-01',
    criadoEm: agora,
    alteradoEm: agora,
  };

  const categoriaGanho: Categoria = {
    id: categoriaGanhoId,
    boxId,
    nome: 'salário',
    tipo: 'ganho',
    ordem: 0,
    arquivada: false,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const categoriaGasto: Categoria = {
    id: categoriaGastoId,
    boxId,
    nome: 'mercado',
    tipo: 'gasto',
    ordem: 1,
    arquivada: false,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const lancamentoEfetivo: Lancamento = {
    id: novoId(),
    boxId,
    categoriaId: categoriaGanhoId,
    data: '2026-07-01',
    valor: 200000,
    status: 'efetivo',
    origem: 'manual',
    criadoEm: agora,
    alteradoEm: agora,
  };

  const lancamentoPrevisto: Lancamento = {
    id: novoId(),
    boxId,
    categoriaId: categoriaGastoId,
    data: '2026-07-10',
    valor: 10000,
    status: 'previsto',
    origem: 'recorrencia',
    recorrenciaId,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const recorrencia: Recorrencia = {
    id: recorrenciaId,
    boxId,
    categoriaId: categoriaGastoId,
    valor: 10000,
    dataInicio: '2026-07-10',
    diaDoMes: 10,
    parcelas: null,
    ativa: true,
    origem: 'manual',
    criadoEm: agora,
    alteradoEm: agora,
  };

  const cenario: Cenario = {
    id: novoId(),
    nome: 'compra grande',
    ligado: false,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const config: Config = {
    id: 'config',
    boxPadraoId: boxId,
    ultimoBackupEm: null,
    mudancasDesdeBackup: false,
    horizonteProjecao: '2027-12-31',
  };

  return { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config };
}

/** Dados de cartão introduzidos na v2. */
function dadosCartao(boxId: string) {
  const agora = agoraISO();
  const cartaoId = novoId();
  const categoriaFaturaId = novoId();
  const categoriaCartaoId = novoId();

  const cartao: Cartao = {
    id: cartaoId,
    boxId,
    nome: 'cartão teste',
    diaFechamento: 20,
    diaVencimento: 27,
    categoriaFaturaId,
    ativo: true,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const categoriaCartao: CategoriaCartao = {
    id: categoriaCartaoId,
    cartaoId,
    nome: 'assinaturas',
    ordem: 0,
    arquivada: false,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const compraCartao: CompraCartao = {
    id: novoId(),
    cartaoId,
    categoriaCartaoId,
    data: '2026-07-05',
    valorTotal: 30000,
    parcelas: 3,
    descricao: 'compra teste',
    criadoEm: agora,
    alteradoEm: agora,
  };

  const recorrenciaCartao: RecorrenciaCartao = {
    id: novoId(),
    cartaoId,
    categoriaCartaoId,
    valor: 5000,
    dataInicio: '2026-07-15',
    diaDoMes: 15,
    parcelas: null,
    ativa: true,
    criadoEm: agora,
    alteradoEm: agora,
  };

  const conferenciaFatura: ConferenciaFatura = {
    id: novoId(),
    cartaoId,
    mes: '2026-08',
    valorAppCent: 35000,
    usarValorApp: false,
    criadoEm: agora,
    alteradoEm: agora,
  };

  return { cartao, categoriaCartao, compraCartao, recorrenciaCartao, conferenciaFatura };
}

describe('caminho de upgrade do schema Dexie (FlowDB real)', () => {
  it('salto v1 → v3: dados de um cliente antigo sobrevivem e as tabelas novas nascem vazias', async () => {
    const nome = `flow-teste-v1-${novoId()}`;
    const { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config } = dadosBase();

    const antigo = new Dexie(nome);
    antigo.version(1).stores(SCHEMA_V1);
    await antigo.open();
    try {
      await antigo.table('boxes').add(box);
      await antigo.table('categorias').bulkAdd([categoriaGanho, categoriaGasto]);
      await antigo.table('lancamentos').bulkAdd([lancamentoEfetivo, lancamentoPrevisto]);
      await antigo.table('recorrencias').add(recorrencia);
      await antigo.table('cenarios').add(cenario);
      await antigo.table('config').put(config);
    } finally {
      await antigo.close();
    }

    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(3);

      expect(await flow.boxes.get(box.id)).toEqual(box);
      expect(await flow.categorias.get(categoriaGanho.id)).toEqual(categoriaGanho);
      expect(await flow.categorias.get(categoriaGasto.id)).toEqual(categoriaGasto);
      expect(await flow.lancamentos.get(lancamentoEfetivo.id)).toEqual(lancamentoEfetivo);
      expect(await flow.lancamentos.get(lancamentoPrevisto.id)).toEqual(lancamentoPrevisto);
      expect(await flow.recorrencias.get(recorrencia.id)).toEqual(recorrencia);
      expect(await flow.cenarios.get(cenario.id)).toEqual(cenario);
      expect(await flow.config.get('config')).toEqual(config);

      await expect(flow.cartoes.count()).resolves.toBe(0);
      await expect(flow.categoriasCartao.count()).resolves.toBe(0);
      await expect(flow.comprasCartao.count()).resolves.toBe(0);
      await expect(flow.recorrenciasCartao.count()).resolves.toBe(0);
      await expect(flow.conferenciasFatura.count()).resolves.toBe(0);
      await expect(flow.viagens.count()).resolves.toBe(0);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });

  it('salto v2 → v3: dados de cartão sobrevivem, viagens nasce vazia e o índice viagemId funciona', async () => {
    const nome = `flow-teste-v2-${novoId()}`;
    const { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config } = dadosBase();
    const { cartao, categoriaCartao, compraCartao, recorrenciaCartao, conferenciaFatura } = dadosCartao(box.id);

    const antigo = new Dexie(nome);
    antigo.version(1).stores(SCHEMA_V1);
    antigo.version(2).stores(SCHEMA_V2);
    await antigo.open();
    try {
      await antigo.table('boxes').add(box);
      await antigo.table('categorias').bulkAdd([categoriaGanho, categoriaGasto]);
      await antigo.table('lancamentos').bulkAdd([lancamentoEfetivo, lancamentoPrevisto]);
      await antigo.table('recorrencias').add(recorrencia);
      await antigo.table('cenarios').add(cenario);
      await antigo.table('config').put(config);
      await antigo.table('cartoes').add(cartao);
      await antigo.table('categoriasCartao').add(categoriaCartao);
      await antigo.table('comprasCartao').add(compraCartao);
      await antigo.table('recorrenciasCartao').add(recorrenciaCartao);
      await antigo.table('conferenciasFatura').add(conferenciaFatura);
    } finally {
      await antigo.close();
    }

    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(3);

      expect(await flow.boxes.get(box.id)).toEqual(box);
      expect(await flow.categorias.get(categoriaGanho.id)).toEqual(categoriaGanho);
      expect(await flow.categorias.get(categoriaGasto.id)).toEqual(categoriaGasto);
      expect(await flow.lancamentos.get(lancamentoEfetivo.id)).toEqual(lancamentoEfetivo);
      expect(await flow.lancamentos.get(lancamentoPrevisto.id)).toEqual(lancamentoPrevisto);
      expect(await flow.recorrencias.get(recorrencia.id)).toEqual(recorrencia);
      expect(await flow.cenarios.get(cenario.id)).toEqual(cenario);
      expect(await flow.config.get('config')).toEqual(config);
      expect(await flow.cartoes.get(cartao.id)).toEqual(cartao);
      expect(await flow.categoriasCartao.get(categoriaCartao.id)).toEqual(categoriaCartao);
      expect(await flow.comprasCartao.get(compraCartao.id)).toEqual(compraCartao);
      expect(await flow.recorrenciasCartao.get(recorrenciaCartao.id)).toEqual(recorrenciaCartao);
      expect(await flow.conferenciasFatura.get(conferenciaFatura.id)).toEqual(conferenciaFatura);

      await expect(flow.viagens.count()).resolves.toBe(0);

      // Índice `viagemId` só existe a partir da v3 — a consulta não deve lançar.
      await expect(flow.comprasCartao.where('viagemId').equals('inexistente').toArray()).resolves.toEqual([]);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });

  // Guarda de versão: ao adicionar `this.version(4)` em database.ts, este teste falha de
  // propósito — é o lembrete forçado para escrever o salto 3 → 4 (schema congelado + teste
  // de migração) antes de mexer no schema real.
  it('a versão atual do schema é 3 — subiu de versão? adicione o salto novo aqui', async () => {
    const nome = `flow-teste-guarda-versao-${novoId()}`;
    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(3);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });
});
