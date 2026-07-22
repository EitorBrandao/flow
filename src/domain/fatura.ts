import { addMeses, dataComDia, mesDe } from './dates';
import type { Cartao, CompraCartao, ConferenciaFatura, ID, ISODate, Lancamento, RecorrenciaCartao } from './types';

export type CicloCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>;

/** Mês ('AAAA-MM') cujo fechamento recolhe a compra. Compra no dia do fechamento
 *  entra na fatura seguinte (o primeiro fechamento ESTRITAMENTE posterior à data). */
export function mesFechamentoDaCompra(cartao: CicloCartao, data: ISODate): string {
  const [ano, mes] = data.split('-').map(Number);
  const fechamentoDoMes = dataComDia(ano, mes, cartao.diaFechamento);
  return data < fechamentoDoMes ? mesDe(data) : addMeses(mesDe(data), 1);
}

/** Mês do vencimento da fatura que fecha no mês dado. */
export function mesVencimentoDoFechamento(cartao: CicloCartao, mesFechamento: string): string {
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : addMeses(mesFechamento, 1);
}

/** Mês ('AAAA-MM' do vencimento — a chave da fatura) onde cai a parcela 1 da compra. */
export function mesFaturaDaCompra(cartao: CicloCartao, data: ISODate): string {
  return mesVencimentoDoFechamento(cartao, mesFechamentoDaCompra(cartao, data));
}

/** Datas de fechamento e vencimento da fatura cujo vencimento cai no mês dado. */
export function datasFaturaDoMes(
  cartao: CicloCartao,
  mesVencimento: string,
): { dataFechamento: ISODate; dataVencimento: ISODate } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento
    ? mesVencimento
    : addMeses(mesVencimento, -1);
  const [anoF, mesF] = mesFechamento.split('-').map(Number);
  const [anoV, mesV] = mesVencimento.split('-').map(Number);
  return {
    dataFechamento: dataComDia(anoF, mesF, cartao.diaFechamento),
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
export function calcularFaturas(cartao: CicloCartao, compras: CompraCartao[], ate: ISODate): Fatura[] {
  const porMes = new Map<string, Fatura>();
  for (const c of compras) {
    const mesFech1 = mesFechamentoDaCompra(cartao, c.data);
    for (let n = 1; n <= c.parcelas; n++) {
      const mes = mesVencimentoDoFechamento(cartao, addMeses(mesFech1, n - 1));
      const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes);
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
export function resumoAssinaturasDoMes(
  mes: string,
  boxIds: readonly ID[],
  cartoes: Cartao[],
  comprasCartao: CompraCartao[],
  recorrenciasCartao: RecorrenciaCartao[],
): ResumoAssinaturas {
  const itens: ItemResumoAssinaturas[] = [];
  for (const cartao of cartoes) {
    if (!boxIds.includes(cartao.boxId)) continue;
    const comprasDoCartao = comprasCartao.filter(
      (c) => c.cartaoId === cartao.id && c.recorrenciaCartaoId != null,
    );
    if (comprasDoCartao.length === 0) continue;
    const ate = datasFaturaDoMes(cartao, mes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDoCartao, ate).find((f) => f.mes === mes);
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
