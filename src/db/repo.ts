import { hojeISO } from '../domain/dates';
import { materializar } from '../domain/recurrence';
import {
  agoraISO, novoId,
  type Box, type Categoria, type Cenario, type Config, type Dados, type ID,
  type ISODate, type Lancamento, type Recorrencia, type StatusLancamento, type TipoCategoria,
} from '../domain/types';
import { db } from './database';

function configPadrao(): Config {
  return {
    id: 'config', boxPadraoId: null, ultimoBackupEm: null,
    mudancasDesdeBackup: false,
    horizonteProjecao: `${new Date().getFullYear() + 1}-12-31`,
  };
}

async function marcarMudanca(): Promise<void> {
  const alterado = await db.config.update('config', { mudancasDesdeBackup: true });
  if (!alterado) {
    // primeira escrita antes de qualquer carregarTudo(): garante que a config exista
    await db.config.put({ ...configPadrao(), mudancasDesdeBackup: true });
  }
}

export async function carregarTudo(): Promise<Dados> {
  const horizonteMinimo = `${new Date().getFullYear() + 1}-12-31`;
  let config = await db.config.get('config');
  if (!config) {
    config = configPadrao();
    await db.config.put(config);
  } else if (config.horizonteProjecao < horizonteMinimo) {
    // virada de ano automática: o horizonte acompanha o calendário para sempre
    config = { ...config, horizonteProjecao: horizonteMinimo };
    await db.config.put(config);
  }
  const [boxes, categorias, lancamentos, recorrencias, cenarios] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
  ]);
  return { boxes, categorias, lancamentos, recorrencias, cenarios, config };
}

export interface NovoLancamento {
  boxId: ID; categoriaId: ID; data: ISODate; valor: number;
  nota?: string; status: StatusLancamento; cenarioId?: ID;
}

export async function salvarLancamento(n: NovoLancamento): Promise<Lancamento> {
  const agora = agoraISO();
  const l: Lancamento = { id: novoId(), origem: 'manual', criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.lancamentos, db.config, async () => {
    await db.lancamentos.add(l);
    await marcarMudanca();
  });
  return l;
}

export async function atualizarLancamento(
  id: ID,
  patch: Partial<Pick<Lancamento, 'valor' | 'data' | 'nota' | 'categoriaId' | 'status'>>,
): Promise<void> {
  await db.transaction('rw', db.lancamentos, db.config, async () => {
    await db.lancamentos.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export async function excluirLancamento(id: ID): Promise<void> {
  await db.transaction('rw', db.lancamentos, db.config, async () => {
    await db.lancamentos.delete(id);
    await marcarMudanca();
  });
}

export async function confirmarPendente(id: ID, valorReal?: number): Promise<void> {
  await atualizarLancamento(id, { status: 'efetivo', ...(valorReal != null ? { valor: valorReal } : {}) });
}

export async function salvarBox(box: Box): Promise<void> {
  await db.transaction('rw', db.boxes, db.config, async () => {
    await db.boxes.put({ ...box, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export interface NovaCategoria { boxId: ID; nome: string; tipo: TipoCategoria; ordem: number }

export async function salvarCategoria(n: NovaCategoria): Promise<Categoria> {
  const agora = agoraISO();
  const c: Categoria = { id: novoId(), arquivada: false, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.categorias, db.config, async () => {
    await db.categorias.add(c);
    await marcarMudanca();
  });
  return c;
}

export async function atualizarCategoria(
  id: ID,
  patch: Partial<Pick<Categoria, 'nome' | 'ordem' | 'arquivada'>>,
): Promise<void> {
  await db.transaction('rw', db.categorias, db.config, async () => {
    await db.categorias.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

async function materializarRecorrencia(rec: Recorrencia, horizonte: ISODate): Promise<void> {
  const existentes = await db.lancamentos.where('recorrenciaId').equals(rec.id).toArray();
  const diff = materializar(rec, existentes, hojeISO(), horizonte);
  const agora = agoraISO();
  await db.lancamentos.bulkDelete(diff.excluirIds);
  await db.lancamentos.bulkAdd(diff.criarDatas.map((data): Lancamento => ({
    id: novoId(), boxId: rec.boxId, categoriaId: rec.categoriaId, data, valor: rec.valor,
    ...(rec.nota ? { nota: rec.nota } : {}),
    status: 'previsto', origem: 'recorrencia', recorrenciaId: rec.id,
    ...(rec.cenarioId ? { cenarioId: rec.cenarioId } : {}),
    criadoEm: agora, alteradoEm: agora,
  })));
  // previstos remanescentes acompanham a regra atual (valor/categoria); efetivos são história
  await db.lancamentos.where('recorrenciaId').equals(rec.id)
    .filter((l) => l.status === 'previsto')
    .modify((l) => {
      l.valor = rec.valor;
      l.categoriaId = rec.categoriaId;
      l.alteradoEm = agora;
    });
}

export interface NovaRecorrencia {
  boxId: ID; categoriaId: ID; valor: number; dataInicio: ISODate;
  diaDoMes: number; parcelas: number | null; nota?: string; cenarioId?: ID;
}

export async function salvarRecorrencia(
  n: NovaRecorrencia | Recorrencia,
  horizonte: ISODate,
): Promise<Recorrencia> {
  const agora = agoraISO();
  const rec: Recorrencia = 'id' in n
    ? { ...n, alteradoEm: agora }
    : { id: novoId(), ativa: true, origem: 'manual', criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.recorrencias, db.lancamentos, db.config, async () => {
    await db.recorrencias.put(rec);
    await materializarRecorrencia(rec, horizonte);
    await marcarMudanca();
  });
  return rec;
}

export async function materializarTodas(horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.recorrencias, db.lancamentos, async () => {
    for (const rec of await db.recorrencias.toArray()) {
      await materializarRecorrencia(rec, horizonte);
    }
  });
}

export async function excluirRecorrencia(id: ID): Promise<void> {
  await db.transaction('rw', db.recorrencias, db.lancamentos, db.config, async () => {
    const previstos = await db.lancamentos.where('recorrenciaId').equals(id)
      .filter((l) => l.status === 'previsto').primaryKeys();
    await db.lancamentos.bulkDelete(previstos);
    await db.recorrencias.delete(id);
    await marcarMudanca();
  });
}

export async function salvarCenario(c: Cenario): Promise<void> {
  await db.transaction('rw', db.cenarios, db.config, async () => {
    await db.cenarios.put({ ...c, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export async function excluirCenario(id: ID): Promise<void> {
  await db.transaction('rw', db.cenarios, db.lancamentos, db.recorrencias, db.config, async () => {
    await db.lancamentos.where('cenarioId').equals(id).delete();
    const recs = await db.recorrencias.filter((r) => r.cenarioId === id).primaryKeys();
    await db.recorrencias.bulkDelete(recs);
    await db.cenarios.delete(id);
    await marcarMudanca();
  });
}

export async function converterCenarioEmReal(id: ID): Promise<void> {
  await db.transaction('rw', db.cenarios, db.lancamentos, db.recorrencias, db.config, async () => {
    const agora = agoraISO();
    await db.lancamentos.where('cenarioId').equals(id).modify((l) => {
      delete l.cenarioId;
      l.alteradoEm = agora;
    });
    await db.recorrencias.filter((r) => r.cenarioId === id).modify((r) => {
      delete r.cenarioId;
      r.alteradoEm = agora;
    });
    await db.cenarios.delete(id);
    await marcarMudanca();
  });
}

export async function salvarConfig(patch: Partial<Config>): Promise<void> {
  const alterado = await db.config.update('config', patch);
  if (!alterado) {
    // primeira escrita antes de qualquer carregarTudo(): garante que a config exista
    await db.config.put({ ...configPadrao(), ...patch });
  }
}

export interface DadosImportados {
  boxes: Box[]; categorias: Categoria[]; lancamentos: Lancamento[]; recorrencias: Recorrencia[];
}

export async function aplicarImport(d: DadosImportados): Promise<void> {
  await db.transaction('rw', [db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.config], async () => {
    // 1. Remover import anterior (idempotência)
    await db.lancamentos.where('origem').equals('import').delete();
    const recsAntigas = await db.recorrencias.where('origem').equals('import').primaryKeys();
    for (const rid of recsAntigas) {
      const previstos = await db.lancamentos.where('recorrenciaId').equals(rid)
        .filter((l) => l.status === 'previsto').primaryKeys();
      await db.lancamentos.bulkDelete(previstos);
    }
    await db.recorrencias.bulkDelete(recsAntigas);

    // 2. Upsert boxes por nome
    const agora = agoraISO();
    const boxesExistentes = await db.boxes.toArray();
    const mapaBoxId = new Map<ID, ID>();
    for (const b of d.boxes) {
      const ex = boxesExistentes.find((x) => x.nome === b.nome);
      if (ex) {
        mapaBoxId.set(b.id, ex.id);
        await db.boxes.update(ex.id, {
          saldoInicial: b.saldoInicial, dataSaldoInicial: b.dataSaldoInicial, alteradoEm: agora,
        });
      } else {
        mapaBoxId.set(b.id, b.id);
        await db.boxes.add(b);
      }
    }

    // 3. Upsert categorias por (box, nome, tipo)
    const catsExistentes = await db.categorias.toArray();
    const mapaCatId = new Map<ID, ID>();
    for (const c of d.categorias) {
      const boxId = mapaBoxId.get(c.boxId) ?? c.boxId;
      const ex = catsExistentes.find((x) => x.boxId === boxId && x.nome === c.nome && x.tipo === c.tipo);
      if (ex) {
        mapaCatId.set(c.id, ex.id);
      } else {
        mapaCatId.set(c.id, c.id);
        await db.categorias.add({ ...c, boxId });
      }
    }

    // 4. Recorrências e lançamentos com ids remapeados
    for (const r of d.recorrencias) {
      await db.recorrencias.add({
        ...r,
        boxId: mapaBoxId.get(r.boxId) ?? r.boxId,
        categoriaId: mapaCatId.get(r.categoriaId) ?? r.categoriaId,
      });
    }
    await db.lancamentos.bulkAdd(d.lancamentos.map((l) => ({
      ...l,
      boxId: mapaBoxId.get(l.boxId) ?? l.boxId,
      categoriaId: mapaCatId.get(l.categoriaId) ?? l.categoriaId,
    })));
    await marcarMudanca();
  });
}

export async function substituirTudo(d: Dados): Promise<void> {
  await db.transaction('rw', [db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios, db.config], async () => {
    await Promise.all([
      db.boxes.clear(), db.categorias.clear(), db.lancamentos.clear(),
      db.recorrencias.clear(), db.cenarios.clear(), db.config.clear(),
    ]);
    await db.boxes.bulkAdd(d.boxes);
    await db.categorias.bulkAdd(d.categorias);
    await db.lancamentos.bulkAdd(d.lancamentos);
    await db.recorrencias.bulkAdd(d.recorrencias);
    await db.cenarios.bulkAdd(d.cenarios);
    await db.config.put({ ...d.config, mudancasDesdeBackup: false });
  });
}
