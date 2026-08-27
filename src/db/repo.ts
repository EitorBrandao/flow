import { compararCategorias, compararCategoriasCartao } from '../domain/categorias';
import { hojeISO } from '../domain/dates';
import { calcularFaturas, datasFaturaDoMes, dedupConferencias, diffSincronizacao, type PlanoParcelamento } from '../domain/fatura';
import { materializar, ocorrencias } from '../domain/recurrence';
import {
  agoraISO, novoId,
  type Banco, type Box, type Cartao, type Categoria, type CategoriaCartao, type Cenario, type CompraCartao,
  type Config, type Dados, type ID, type ISODate, type Lancamento, type Recorrencia,
  type RecorrenciaCartao, type StatusLancamento, type TipoCategoria, type Viagem,
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
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(), db.viagens.toArray(), db.bancos.toArray(),
  ]);
  // ordem canônica na fonte: todo consumidor do snapshot herda a ordem de Ajustes
  categorias.sort(compararCategorias);
  categoriasCartao.sort(compararCategoriasCartao);
  // mais recente primeiro: id (UUID) não reflete ordem de criação, então listas que
  // dependem da ordem de inserção (ex.: lançamentos do mesmo dia no Fluxo) precisam
  // disso na fonte, não em cada tela.
  lancamentos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return {
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos, config,
  };
}

export interface NovoLancamento {
  boxId: ID; categoriaId: ID; data: ISODate; valor: number;
  nota?: string; status: StatusLancamento; cenarioId?: ID; viagemId?: ID;
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
  patch: Partial<Pick<Lancamento, 'valor' | 'data' | 'nota' | 'categoriaId' | 'status' | 'viagemId'>>,
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

export async function confirmarPendente(id: ID, valorReal?: number, dataReal?: ISODate): Promise<void> {
  await atualizarLancamento(id, {
    status: 'efetivo',
    ...(valorReal != null ? { valor: valorReal } : {}),
    ...(dataReal != null ? { data: dataReal } : {}),
  });
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

export async function substituirTudo(d: Dados): Promise<void> {
  const tabelas = [
    db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios,
    db.cartoes, db.categoriasCartao, db.comprasCartao, db.recorrenciasCartao,
    db.conferenciasFatura, db.viagens, db.bancos, db.config,
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
    // o modo "substituir" do import não passa por `mesclar`: sem isto, um backup com duas
    // conferências do mesmo cartão e mês grava as duas e uma fica órfã (ver dedupConferencias)
    await db.conferenciasFatura.bulkAdd(dedupConferencias(d.conferenciasFatura));
    await db.viagens.bulkAdd(d.viagens);
    await db.bancos.bulkAdd(d.bancos);
    await db.config.put({ ...d.config, mudancasDesdeBackup: false });
  });
}

// ---------- Viagem ----------

export interface NovaViagem { nome: string; dataInicio: ISODate; dataFim: ISODate }

export async function salvarViagem(n: NovaViagem): Promise<Viagem> {
  const agora = agoraISO();
  const v: Viagem = { id: novoId(), criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.viagens, db.config, async () => {
    await db.viagens.add(v);
    await marcarMudanca();
  });
  return v;
}

export async function atualizarViagem(
  id: ID,
  patch: Partial<Pick<Viagem, 'nome' | 'dataInicio' | 'dataFim'>>,
): Promise<void> {
  await db.transaction('rw', db.viagens, db.config, async () => {
    await db.viagens.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export async function excluirViagem(id: ID): Promise<void> {
  await db.transaction('rw', db.viagens, db.lancamentos, db.comprasCartao, db.config, async () => {
    await db.lancamentos.where('viagemId').equals(id).modify({ viagemId: undefined });
    await db.comprasCartao.where('viagemId').equals(id).modify({ viagemId: undefined });
    await db.viagens.delete(id);
    await marcarMudanca();
  });
}

export interface NovoBanco { boxId: ID; nome: string; ordem: number }

export async function salvarBanco(n: NovoBanco | Banco): Promise<Banco> {
  const agora = agoraISO();
  const b: Banco = 'id' in n
    ? { ...n, alteradoEm: agora }
    : {
      id: novoId(), saldoDeclaradoCent: null, dataSaldoDeclarado: null,
      criadoEm: agora, alteradoEm: agora, ...n,
    };
  await db.transaction('rw', db.bancos, db.config, async () => {
    await db.bancos.put(b);
    await marcarMudanca();
  });
  return b;
}

export async function atualizarBanco(
  id: ID,
  patch: Partial<Pick<Banco, 'nome' | 'ordem' | 'saldoDeclaradoCent' | 'dataSaldoDeclarado'>>,
): Promise<void> {
  await db.transaction('rw', db.bancos, db.config, async () => {
    await db.bancos.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

/** Excluir um banco desliga os cartões que apontavam para ele. Cartão apontando para
 *  banco inexistente é inconsistência silenciosa — o mesmo cuidado que
 *  `converterCenarioEmReal` toma com as recorrências. */
export async function excluirBanco(id: ID): Promise<void> {
  await db.transaction('rw', db.bancos, db.cartoes, db.config, async () => {
    const agora = agoraISO();
    // `bancoId` não é índice (a Tarefa 1 o declarou só como campo), então é `.filter()`
    // e não `.where()` — mesmo idioma de `converterCenarioEmReal` (`repo.ts:212`).
    await db.cartoes.filter((c) => c.bancoId === id).modify((c) => {
      delete c.bancoId;
      c.alteradoEm = agora;
    });
    await db.bancos.delete(id);
    await marcarMudanca();
  });
}

// ---------- Cartão de crédito ----------

export interface NovoCartao {
  boxId: ID; nome: string; diaFechamento: number; diaVencimento: number; bancoId?: ID;
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
        bancoId: n.bancoId, ativo: true, criadoEm: agora, alteradoEm: agora, categoriaFaturaId: novoId(),
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

export async function categoriaAssinaturasDe(cartaoId: ID): Promise<ID> {
  const cartao = (await db.cartoes.get(cartaoId))!;
  if (cartao.categoriaAssinaturasId) return cartao.categoriaAssinaturasId;
  const agora = agoraISO();
  const categoriaId = novoId();
  await db.transaction('rw', db.cartoes, db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.add({
      id: categoriaId, cartaoId, nome: 'Assinaturas', ordem: 0,
      arquivada: false, criadoEm: agora, alteradoEm: agora,
    });
    await db.cartoes.update(cartaoId, { categoriaAssinaturasId: categoriaId, alteradoEm: agora });
    await marcarMudanca();
  });
  return categoriaId;
}

export async function categoriaParcelamentoDe(cartaoId: ID): Promise<ID> {
  const cartao = (await db.cartoes.get(cartaoId))!;
  if (cartao.categoriaParcelamentoId) return cartao.categoriaParcelamentoId;
  const agora = agoraISO();
  const categoriaId = novoId();
  await db.transaction('rw', db.cartoes, db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.add({
      id: categoriaId, cartaoId, nome: 'Parcelamento', ordem: 0,
      arquivada: false, criadoEm: agora, alteradoEm: agora,
    });
    await db.cartoes.update(cartaoId, { categoriaParcelamentoId: categoriaId, alteradoEm: agora });
    await marcarMudanca();
  });
  return categoriaId;
}

export interface PagamentoFatura {
  lancamentoId: ID;      // o lançamento da fatura no Flow (origem 'cartao')
  cartaoId: ID;
  faturaMes: string;     // 'AAAA-MM' do vencimento
  valorPagoCent: number;
  dataPagamento: ISODate; // quando o dinheiro saiu — pode ser antes do vencimento
  parcelamento?: PlanoParcelamento;
  horizonte: ISODate;
}

/**
 * Registra que a fatura foi paga por um valor diferente do total e, se for o caso, que o
 * restante foi parcelado no banco.
 *
 * O parcelamento vira uma `CompraCartao` comum numa CategoriaCartao reservada, e não uma
 * entidade nova: um parcelamento *é* um valor fatiado nas faturas seguintes, que é
 * exatamente o que `calcularFaturas` já sabe fazer. Daí em diante tudo vem de graça — o
 * resumo por categoria, a lista da TelaCartao, a sincronização com os lançamentos do Flow e
 * a edição/exclusão pelo FormCompra.
 *
 * A data da compra é a **data de fechamento da fatura sendo paga**: pela regra de
 * `mesFechamentoDaCompra`, compra no dia exato do fechamento cai na fatura seguinte — que é
 * onde a parcela 1 deve estar. Nenhuma aritmética de data nova, e vale nas duas
 * configurações de ciclo (vencimento antes ou depois do fechamento).
 *
 * O lançamento pode já estar `efetivo` (parcelamento registrado dias depois): este é o único
 * caminho do app que reescreve um `efetivo`, e é sob ação explícita do usuário.
 *
 * `dataPagamento` reescreve a data do lançamento. A fatura nasce projetada no vencimento,
 * mas quem paga adiantado tira o dinheiro da conta antes — e a projeção só fica honesta se
 * enxergar a saída no dia certo.
 */
export async function registrarPagamentoFatura(p: PagamentoFatura): Promise<void> {
  const cartao = await db.cartoes.get(p.cartaoId);
  if (!cartao) throw new Error(`cartão ${p.cartaoId} não encontrado`);

  const parcelamento = p.parcelamento;
  // Criar a categoria reservada fora da transação do lançamento: `categoriaParcelamentoDe`
  // abre a sua própria, e transação aninhada em Dexie com outro conjunto de tabelas falha.
  const categoriaCartaoId = parcelamento ? await categoriaParcelamentoDe(p.cartaoId) : null;

  const agora = agoraISO();
  await db.transaction('rw', db.lancamentos, db.comprasCartao, db.config, async () => {
    // A data do lançamento passa a ser a do pagamento, não a do vencimento: pagar adiantado
    // tira o dinheiro da conta antes, e é isso que a projeção precisa enxergar. `faturaMes`
    // não muda — a identidade da fatura continua sendo o mês do vencimento.
    await db.lancamentos.update(p.lancamentoId, {
      status: 'efetivo', valor: p.valorPagoCent, data: p.dataPagamento, alteradoEm: agora,
    });
    if (parcelamento && categoriaCartaoId) {
      const [ano, mes] = p.faturaMes.split('-');
      await db.comprasCartao.add({
        id: novoId(), cartaoId: p.cartaoId, categoriaCartaoId,
        data: datasFaturaDoMes(cartao, p.faturaMes).dataFechamento,
        valorTotal: parcelamento.parcelas * parcelamento.valorParcelaCent,
        parcelas: parcelamento.parcelas,
        descricao: `Parcelamento da fatura de ${mes}/${ano}`,
        criadoEm: agora, alteradoEm: agora,
      });
    }
    await marcarMudanca();
  });
  await sincronizarCartoes(p.horizonte);
}

export interface NovaCompraCartao {
  cartaoId: ID; categoriaCartaoId: ID; data: ISODate; valorTotal: number;
  parcelas: number; descricao?: string; viagemId?: ID;
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
  patch: Partial<Pick<CompraCartao, 'data' | 'valorTotal' | 'parcelas' | 'descricao' | 'categoriaCartaoId' | 'viagemId'>>,
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
  await sincronizarCartoes(horizonte, { permitirCicloAtualPara: ass.id });
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
 *  compra passada é história ≈ efetivo; futura acompanha a regra ≈ previsto).
 *  `permitirCicloAtual` força a criação do ciclo mais recente (<= hoje) quando ele ainda não
 *  existe — só usado ao salvar esta assinatura especificamente (ver `salvarAssinatura`), nunca
 *  em sincronizações automáticas: editar uma assinatura cujo dia do mês já passou não deve
 *  deixar a fatura atual sem o valor, mas isso não pode virar backfill de ciclos antigos que o
 *  usuário tenha apagado de propósito. */
async function materializarAssinatura(
  ass: RecorrenciaCartao, hoje: ISODate, ate: ISODate, opts?: { permitirCicloAtual?: boolean },
): Promise<void> {
  const existentes = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
  const diff = materializar(ass, existentes.map((c) => ({
    id: c.id, data: c.data, status: (c.data <= hoje ? 'efetivo' : 'previsto') as StatusLancamento,
  })), hoje, ate);
  if (opts?.permitirCicloAtual && ass.ativa) {
    const cicloAtual = ocorrencias(ass, hoje).at(-1);
    if (cicloAtual && !existentes.some((c) => c.data === cicloAtual) && !diff.criarDatas.includes(cicloAtual)) {
      diff.criarDatas = [...diff.criarDatas, cicloAtual].sort();
    }
  }
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

/** Materializa assinaturas e sincroniza os lançamentos de fatura de todos os cartões.
 *  `permitirCicloAtualPara` (opcional) libera o ciclo atual em atraso só para essa assinatura —
 *  ver `materializarAssinatura`. */
export async function sincronizarCartoes(
  horizonte: ISODate, opts?: { permitirCicloAtualPara?: ID },
): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', [
    db.cartoes, db.comprasCartao, db.recorrenciasCartao, db.conferenciasFatura, db.lancamentos,
  ], async () => {
    for (const ass of await db.recorrenciasCartao.toArray()) {
      await materializarAssinatura(ass, hoje, horizonte, {
        permitirCicloAtual: ass.id === opts?.permitirCicloAtualPara,
      });
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
