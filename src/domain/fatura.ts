import { addMeses, dataComDia, mesDe } from './dates';
import type {
  AjusteFechamento, Cartao, CompraCartao, ConferenciaFatura, ID, ISODate, Lancamento, RecorrenciaCartao,
} from './types';

export type CicloCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>;

/** Mês ('AAAA-MM') cujo fechamento recolhe a compra. Compra no dia do fechamento
 *  entra na fatura seguinte (o primeiro fechamento ESTRITAMENTE posterior à data).
 *  `ajustes` (mês calendário de fechamento → dia override, ver `ajustesDoCartao`) substitui
 *  `cartao.diaFechamento` quando existe entrada para o mês da própria compra. */
export function mesFechamentoDaCompra(
  cartao: CicloCartao, data: ISODate, ajustes?: ReadonlyMap<string, number>,
): string {
  const [ano, mes] = data.split('-').map(Number);
  const mesCompra = mesDe(data);
  const diaFechamento = ajustes?.get(mesCompra) ?? cartao.diaFechamento;
  const fechamentoDoMes = dataComDia(ano, mes, diaFechamento);
  return data < fechamentoDoMes ? mesCompra : addMeses(mesCompra, 1);
}

/** Mês do vencimento da fatura que fecha no mês dado. */
export function mesVencimentoDoFechamento(cartao: CicloCartao, mesFechamento: string): string {
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : addMeses(mesFechamento, 1);
}

/** Mês ('AAAA-MM' do vencimento — a chave da fatura) onde cai a parcela 1 da compra. */
export function mesFaturaDaCompra(
  cartao: CicloCartao, data: ISODate, ajustes?: ReadonlyMap<string, number>,
): string {
  return mesVencimentoDoFechamento(cartao, mesFechamentoDaCompra(cartao, data, ajustes));
}

/** Datas de fechamento e vencimento da fatura cujo vencimento cai no mês dado. O mês
 *  calendário de fechamento é sempre calculado a partir do `diaVencimento`/`diaFechamento`
 *  PADRÃO do cartão (não do override) — só o dia dentro desse mês pode vir de `ajustes`. */
export function datasFaturaDoMes(
  cartao: CicloCartao, mesVencimento: string, ajustes?: ReadonlyMap<string, number>,
): { dataFechamento: ISODate; dataVencimento: ISODate } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento
    ? mesVencimento
    : addMeses(mesVencimento, -1);
  const [anoF, mesF] = mesFechamento.split('-').map(Number);
  const [anoV, mesV] = mesVencimento.split('-').map(Number);
  const diaFechamento = ajustes?.get(mesFechamento) ?? cartao.diaFechamento;
  return {
    dataFechamento: dataComDia(anoF, mesF, diaFechamento),
    dataVencimento: dataComDia(anoV, mesV, cartao.diaVencimento),
  };
}

export interface ItemFatura {
  compraId: ID;
  data: ISODate; // data da compra
  categoriaCartaoId: ID;
  descricao?: string;
  parcela: number; // 1-based
  totalParcelas: number;
  valorCent: number;
}

export interface Fatura {
  mes: string; // 'AAAA-MM' do vencimento (chave da fatura)
  dataFechamento: ISODate;
  dataVencimento: ISODate;
  itens: ItemFatura[];
  totalCent: number;
}

/** Parcela n (1-based) em centavos; o resto da divisão inteira vai na primeira. */
export function valorParcela(valorTotal: number, parcelas: number, n: number): number {
  const base = Math.floor(valorTotal / parcelas);
  return n === 1 ? valorTotal - base * (parcelas - 1) : base;
}

/** Faturas derivadas das compras até `ate` (vencimento), ordenadas por mês. Função pura. */
export function calcularFaturas(
  cartao: CicloCartao, compras: CompraCartao[], ate: ISODate, ajustes?: ReadonlyMap<string, number>,
): Fatura[] {
  const porMes = new Map<string, Fatura>();
  for (const c of compras) {
    const mesFech1 = mesFechamentoDaCompra(cartao, c.data, ajustes);
    for (let n = 1; n <= c.parcelas; n++) {
      const mes = mesVencimentoDoFechamento(cartao, addMeses(mesFech1, n - 1));
      const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
      if (dataVencimento > ate) break;
      let f = porMes.get(mes);
      if (!f) {
        f = { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
        porMes.set(mes, f);
      }
      const valorCent = valorParcela(c.valorTotal, c.parcelas, n);
      f.itens.push({
        compraId: c.id, data: c.data, categoriaCartaoId: c.categoriaCartaoId,
        ...(c.descricao ? { descricao: c.descricao } : {}),
        parcela: n, totalParcelas: c.parcelas, valorCent,
      });
      f.totalCent += valorCent;
    }
  }
  const out = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  for (const f of out) {
    f.itens.sort((a, b) => a.data.localeCompare(b.data) || a.compraId.localeCompare(b.compraId));
  }
  return out;
}

/** Subtotal da fatura por categoria de cartão, do maior para o menor. */
export function resumoPorCategoria(fatura: Fatura): [ID, number][] {
  const porCategoria = new Map<ID, number>();
  for (const i of fatura.itens) {
    porCategoria.set(i.categoriaCartaoId, (porCategoria.get(i.categoriaCartaoId) ?? 0) + i.valorCent);
  }
  return [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
}

/** Valor que a fatura leva ao Flow: soma dos itens, ou o valor do app se o usuário marcou. */
export function valorSincronizado(fatura: Fatura, conf: ConferenciaFatura | undefined): number {
  return conf?.usarValorApp ? conf.valorAppCent : fatura.totalCent;
}

export interface PlanoParcelamento {
  parcelas: number;        // N >= 1
  valorParcelaCent: number;
}

export interface ResumoParcelamento {
  restanteCent: number;   // o que ficou de fora do pagamento desta fatura
  totalParceladoCent: number;
  jurosCent: number;      // > 0 com juros, 0 sem juros, < 0 se o usuário digitou algo incoerente
}

/**
 * Contas do parcelamento de fatura, a partir dos números que o app do banco mostra: o app
 * **não** calcula juros nem deriva a parcela de uma taxa — se houver juros, eles já vêm
 * embutidos no valor da parcela que o usuário digitou. O juros aqui é só informativo, a
 * diferença entre o que se vai pagar e o que se deixou de pagar.
 */
export function resumoParcelamento(
  totalFaturaCent: number, valorPagoCent: number, plano: PlanoParcelamento,
): ResumoParcelamento {
  const restanteCent = totalFaturaCent - valorPagoCent;
  const totalParceladoCent = plano.parcelas * plano.valorParcelaCent;
  return { restanteCent, totalParceladoCent, jurosCent: totalParceladoCent - restanteCent };
}

/**
 * Conferência é única por cartão e mês, mas o índice `[cartaoId+mes]` do Dexie não é unique:
 * duas conferências do mesmo mês com ids diferentes entram pelo import de backup e ficam.
 * O estrago é silencioso — `salvarConferenciaFatura` lê com `.first()` e passa a editar
 * sempre a mesma, deixando a outra órfã e mudando o valor da fatura conforme a ordem do
 * índice. Vence a mais recente; empate desempata pelo id, para o resultado não depender da
 * ordem de entrada. Aplicado em todo caminho que grava o snapshot inteiro.
 */
export function dedupConferencias(cs: ConferenciaFatura[]): ConferenciaFatura[] {
  const porCartaoMes = new Map<string, ConferenciaFatura>();
  for (const c of cs) {
    const chave = `${c.cartaoId}|${c.mes}`;
    const atual = porCartaoMes.get(chave);
    const vence = !atual
      || c.alteradoEm > atual.alteradoEm
      || (c.alteradoEm === atual.alteradoEm && c.id > atual.id);
    if (vence) porCartaoMes.set(chave, c);
  }
  return [...porCartaoMes.values()];
}

/** Filtra os ajustes de fechamento de um cartão específico e converte para o formato que
 *  `mesFechamentoDaCompra`/`datasFaturaDoMes`/`calcularFaturas` consultam: mês calendário
 *  do fechamento → dia override. Assume a entrada já deduplicada (`dedupAjustesFechamento`) —
 *  mesma divisão de responsabilidade de `valorSincronizado` em relação a `dedupConferencias`. */
export function ajustesDoCartao(ajustes: AjusteFechamento[], cartaoId: ID): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const a of ajustes) {
    if (a.cartaoId === cartaoId) mapa.set(a.mes, a.diaFechamento);
  }
  return mapa;
}

/**
 * Ajuste de fechamento é único por cartão e mês, mas o índice `[cartaoId+mes]` do Dexie não é
 * unique — mesmo cuidado de `dedupConferencias`. Vence o `alteradoEm` mais recente; empate
 * desempata pelo id. Aplicado em todo caminho que grava o snapshot inteiro.
 */
export function dedupAjustesFechamento(as: AjusteFechamento[]): AjusteFechamento[] {
  const porCartaoMes = new Map<string, AjusteFechamento>();
  for (const a of as) {
    const chave = `${a.cartaoId}|${a.mes}`;
    const atual = porCartaoMes.get(chave);
    const vence = !atual
      || a.alteradoEm > atual.alteradoEm
      || (a.alteradoEm === atual.alteradoEm && a.id > atual.id);
    if (vence) porCartaoMes.set(chave, a);
  }
  return [...porCartaoMes.values()];
}

export interface DiffSincronizacao {
  criar: { faturaMes: string; data: ISODate; valor: number }[];
  atualizar: { id: ID; valor: number; data: ISODate }[];
  excluirIds: ID[];
}

/** Diff entre as faturas calculadas e os lançamentos de fatura no Flow (mesma disciplina
 *  de `materializar`): efetivo nunca é tocado; previsto novo só com vencimento > hoje
 *  (não dá para distinguir "nunca criado" de "descartado" no passado); previsto existente
 *  segue valor/data do alvo; alvo ausente ou zerado ⇒ previsto excluído.
 *  Entradas de outro cartão são ignoradas (defesa além do pré-filtro do chamador). */
export function diffSincronizacao(
  cartao: Cartao,
  faturas: Fatura[],
  conferencias: ConferenciaFatura[],
  existentes: Lancamento[],
  hoje: ISODate,
): DiffSincronizacao {
  const confs = conferencias.filter((c) => c.cartaoId === cartao.id);
  const confPorMes = new Map(confs.map((c) => [c.mes, c]));
  const alvo = new Map<string, { valor: number; data: ISODate }>();
  if (cartao.ativo) {
    for (const f of faturas) {
      const valor = valorSincronizado(f, confPorMes.get(f.mes));
      if (valor > 0) alvo.set(f.mes, { valor, data: f.dataVencimento });
    }
    for (const c of confs) {
      if (c.usarValorApp && c.valorAppCent > 0 && !alvo.has(c.mes)) {
        alvo.set(c.mes, { valor: c.valorAppCent, data: datasFaturaDoMes(cartao, c.mes).dataVencimento });
      }
    }
  }
  const diff: DiffSincronizacao = { criar: [], atualizar: [], excluirIds: [] };
  const vistos = new Set<string>();
  for (const l of existentes) {
    if (l.cartaoId !== cartao.id || l.faturaMes == null) continue;
    vistos.add(l.faturaMes);
    if (l.status === 'efetivo') continue;
    const a = alvo.get(l.faturaMes);
    if (!a) diff.excluirIds.push(l.id);
    else if (a.valor !== l.valor || a.data !== l.data) diff.atualizar.push({ id: l.id, ...a });
  }
  for (const [faturaMes, a] of alvo) {
    if (!vistos.has(faturaMes) && a.data > hoje) diff.criar.push({ faturaMes, ...a });
  }
  diff.criar.sort((a, b) => a.faturaMes.localeCompare(b.faturaMes));
  return diff;
}

/** Ids das categorias reservadas para receber a fatura de algum cartão (ativo ou não) — não
 *  devem aparecer em nenhuma lista de seleção manual de categoria. */
export function categoriasFaturaIds(cartoes: Cartao[]): Set<ID> {
  return new Set(cartoes.map((c) => c.categoriaFaturaId));
}

export interface ItemResumoAssinaturas {
  cartaoId: ID;
  cartaoNome: string;
  recorrenciaCartaoId: ID;
  descricao: string;
  valorCent: number;
}

export interface ResumoAssinaturas {
  totalCent: number;
  itens: ItemResumoAssinaturas[];
}

/** Total e detalhamento (por cartão > assinatura) das compras geradas por assinatura que
 *  caem na fatura do mês dado, entre os cartões das boxes selecionadas. */
/** Total e detalhamento (por cartão > assinatura) das compras geradas por assinatura que
 *  caem na fatura do mês dado, entre os cartões das boxes selecionadas. */
export function resumoAssinaturasDoMes(
  mes: string,
  boxIds: readonly ID[],
  cartoes: Cartao[],
  comprasCartao: CompraCartao[],
  recorrenciasCartao: RecorrenciaCartao[],
  ajustesFechamento: AjusteFechamento[] = [],
): ResumoAssinaturas {
  const itens: ItemResumoAssinaturas[] = [];
  for (const cartao of cartoes) {
    if (!boxIds.includes(cartao.boxId)) continue;
    const comprasDoCartao = comprasCartao.filter(
      (c) => c.cartaoId === cartao.id && c.recorrenciaCartaoId != null,
    );
    if (comprasDoCartao.length === 0) continue;
    const ajustes = ajustesDoCartao(ajustesFechamento, cartao.id);
    const ate = datasFaturaDoMes(cartao, mes, ajustes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDoCartao, ate, ajustes).find((f) => f.mes === mes);
    if (!fatura) continue;
    const porAssinatura = new Map<ID, number>();
    for (const item of fatura.itens) {
      const compra = comprasDoCartao.find((c) => c.id === item.compraId)!;
      const chave = compra.recorrenciaCartaoId!;
      porAssinatura.set(chave, (porAssinatura.get(chave) ?? 0) + item.valorCent);
    }
    for (const [recorrenciaCartaoId, valorCent] of porAssinatura) {
      const ass = recorrenciasCartao.find((a) => a.id === recorrenciaCartaoId);
      itens.push({
        cartaoId: cartao.id, cartaoNome: cartao.nome, recorrenciaCartaoId,
        descricao: ass?.descricao ?? 'Assinatura', valorCent,
      });
    }
  }
  return { totalCent: itens.reduce((s, i) => s + i.valorCent, 0), itens };
}
