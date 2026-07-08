import { hojeISO } from '../domain/dates';
import { calcularFaturas, diffSincronizacao } from '../domain/fatura';
import { materializar } from '../domain/recurrence';
import {
  agoraISO, novoId,
  type Box, type Cartao, type Categoria, type CategoriaCartao, type Cenario, type CompraCartao,
  type Config, type Dados, type ID, type ISODate, type Lancamento, type Recorrencia,
  type RecorrenciaCartao, type StatusLancamento, type TipoCategoria,
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
  const [
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(),
  ]);
  return {
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, config,
  };
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
  const tabelas = [
    db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios,
    db.cartoes, db.categoriasCartao, db.comprasCartao, db.recorrenciasCartao,
    db.conferenciasFatura, db.config,
  ];
  await db.transaction('rw', tabelas, async () => {
    await Promise.all(tabelas.map((t) => t.clear()));
    await db.boxes.bulkAdd(d.boxes);
    await db.categorias.bulkAdd(d.categorias);
    await db.lancamentos.bulkAdd(d.lancamentos);
    await db.recorrencias.bulkAdd(d.recorrencias);
    await db.cenarios.bulkAdd(d.cenarios);
    await db.cartoes.bulkAdd(d.cartoes);
    await db.categoriasCartao.bulkAdd(d.categoriasCartao);
    await db.comprasCartao.bulkAdd(d.comprasCartao);
    await db.recorrenciasCartao.bulkAdd(d.recorrenciasCartao);
    await db.conferenciasFatura.bulkAdd(d.conferenciasFatura);
    await db.config.put({ ...d.config, mudancasDesdeBackup: false });
  });
}

// ---------- Cartão de crédito ----------

export interface NovoCartao {
  boxId: ID; nome: string; diaFechamento: number; diaVencimento: number;
}

export async function salvarCartao(n: NovoCartao | Cartao, horizonte: ISODate): Promise<Cartao> {
  const agora = agoraISO();
  let cartao!: Cartao;
  await db.transaction('rw', [db.cartoes, db.categorias, db.config], async () => {
    if ('id' in n) {
      const atual = await db.cartoes.get(n.id);
      const categoriaFaturaId = atual?.categoriaFaturaId ?? n.categoriaFaturaId;
      cartao = { ...n, categoriaFaturaId, alteradoEm: agora };
      await db.categorias.update(categoriaFaturaId, { nome: cartao.nome, alteradoEm: agora });
    } else {
      cartao = {
        id: novoId(), boxId: n.boxId, nome: n.nome, diaFechamento: n.diaFechamento, diaVencimento: n.diaVencimento,
        ativo: true, criadoEm: agora, alteradoEm: agora, categoriaFaturaId: novoId(),
      };
      await db.categorias.add({
        id: cartao.categoriaFaturaId, boxId: cartao.boxId, nome: cartao.nome, tipo: 'gasto',
        ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora,
      });
    }
    await db.cartoes.put(cartao);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return cartao;
}

export interface NovaCategoriaCartao { cartaoId: ID; nome: string; ordem: number }

export async function salvarCategoriaCartao(n: NovaCategoriaCartao): Promise<CategoriaCartao> {
  const agora = agoraISO();
  const c: CategoriaCartao = { id: novoId(), arquivada: false, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.add(c);
    await marcarMudanca();
  });
  return c;
}

export async function atualizarCategoriaCartao(
  id: ID,
  patch: Partial<Pick<CategoriaCartao, 'nome' | 'ordem' | 'arquivada'>>,
): Promise<void> {
  await db.transaction('rw', db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export interface NovaCompraCartao {
  cartaoId: ID; categoriaCartaoId: ID; data: ISODate; valorTotal: number;
  parcelas: number; descricao?: string;
}

export async function salvarCompraCartao(n: NovaCompraCartao, horizonte: ISODate): Promise<CompraCartao> {
  const agora = agoraISO();
  const c: CompraCartao = { id: novoId(), criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.add(c);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return c;
}

export async function atualizarCompraCartao(
  id: ID,
  patch: Partial<Pick<CompraCartao, 'data' | 'valorTotal' | 'parcelas' | 'descricao' | 'categoriaCartaoId'>>,
  horizonte: ISODate,
): Promise<void> {
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function excluirCompraCartao(id: ID, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.delete(id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export interface NovaAssinatura {
  cartaoId: ID; categoriaCartaoId: ID; valor: number; dataInicio: ISODate;
  diaDoMes: number; parcelas: number | null; descricao?: string;
}

export async function salvarAssinatura(
  n: NovaAssinatura | RecorrenciaCartao,
  horizonte: ISODate,
): Promise<RecorrenciaCartao> {
  const agora = agoraISO();
  const ass: RecorrenciaCartao = 'id' in n
    ? { ...n, alteradoEm: agora }
    : { id: novoId(), ativa: true, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.recorrenciasCartao, db.config, async () => {
    await db.recorrenciasCartao.put(ass);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return ass;
}

export async function excluirAssinatura(id: ID, horizonte: ISODate): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', db.recorrenciasCartao, db.comprasCartao, db.config, async () => {
    const futuras = await db.comprasCartao.where('recorrenciaCartaoId').equals(id)
      .filter((c) => c.data > hoje).primaryKeys();
    await db.comprasCartao.bulkDelete(futuras);
    await db.recorrenciasCartao.delete(id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function salvarConferenciaFatura(
  cartaoId: ID, mes: string, valorAppCent: number, usarValorApp: boolean, horizonte: ISODate,
): Promise<void> {
  await db.transaction('rw', db.conferenciasFatura, db.config, async () => {
    const agora = agoraISO();
    const ex = await db.conferenciasFatura.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.conferenciasFatura.update(ex.id, { valorAppCent, usarValorApp, alteradoEm: agora });
    else {
      await db.conferenciasFatura.add({
        id: novoId(), cartaoId, mes, valorAppCent, usarValorApp, criadoEm: agora, alteradoEm: agora,
      });
    }
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function removerConferenciaFatura(cartaoId: ID, mes: string, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.conferenciasFatura, db.config, async () => {
    const ex = await db.conferenciasFatura.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.conferenciasFatura.delete(ex.id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

/** Materializa CompraCartao futuras da assinatura (reusa o diff de recorrências:
 *  compra passada é história ≈ efetivo; futura acompanha a regra ≈ previsto). */
async function materializarAssinatura(ass: RecorrenciaCartao, hoje: ISODate, ate: ISODate): Promise<void> {
  const existentes = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
  const diff = materializar(ass, existentes.map((c) => ({
    id: c.id, data: c.data, status: (c.data <= hoje ? 'efetivo' : 'previsto') as StatusLancamento,
  })), hoje, ate);
  const agora = agoraISO();
  await db.comprasCartao.bulkDelete(diff.excluirIds);
  await db.comprasCartao.bulkAdd(diff.criarDatas.map((data): CompraCartao => ({
    id: novoId(), cartaoId: ass.cartaoId, categoriaCartaoId: ass.categoriaCartaoId,
    data, valorTotal: ass.valor, parcelas: 1,
    ...(ass.descricao ? { descricao: ass.descricao } : {}),
    recorrenciaCartaoId: ass.id, criadoEm: agora, alteradoEm: agora,
  })));
  await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id)
    .filter((c) => c.data > hoje)
    .modify((c) => {
      c.valorTotal = ass.valor;
      c.categoriaCartaoId = ass.categoriaCartaoId;
      if (ass.descricao) c.descricao = ass.descricao;
      c.alteradoEm = agora;
    });
}

/** Materializa assinaturas e sincroniza os lançamentos de fatura de todos os cartões. */
export async function sincronizarCartoes(horizonte: ISODate): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', [
    db.cartoes, db.comprasCartao, db.recorrenciasCartao, db.conferenciasFatura, db.lancamentos,
  ], async () => {
    for (const ass of await db.recorrenciasCartao.toArray()) {
      await materializarAssinatura(ass, hoje, horizonte);
    }
    for (const cartao of await db.cartoes.toArray()) {
      const [compras, conferencias, existentes] = await Promise.all([
        db.comprasCartao.where('cartaoId').equals(cartao.id).toArray(),
        db.conferenciasFatura.where('cartaoId').equals(cartao.id).toArray(),
        db.lancamentos.where('cartaoId').equals(cartao.id).toArray(),
      ]);
      const faturas = calcularFaturas(cartao, compras, horizonte);
      const diff = diffSincronizacao(cartao, faturas, conferencias, existentes, hoje);
      const agora = agoraISO();
      await db.lancamentos.bulkDelete(diff.excluirIds);
      for (const a of diff.atualizar) {
        await db.lancamentos.update(a.id, { valor: a.valor, data: a.data, alteradoEm: agora });
      }
      await db.lancamentos.bulkAdd(diff.criar.map((n): Lancamento => ({
        id: novoId(), boxId: cartao.boxId, categoriaId: cartao.categoriaFaturaId,
        data: n.data, valor: n.valor, status: 'previsto', origem: 'cartao',
        cartaoId: cartao.id, faturaMes: n.faturaMes,
        criadoEm: agora, alteradoEm: agora,
      })));
    }
  });
}
