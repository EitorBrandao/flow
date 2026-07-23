import { mesDe } from './dates';
import { calcularFaturas, datasFaturaDoMes } from './fatura';
import type { Cartao, CompraCartao, ID, ISODate, Lancamento, Viagem } from './types';

/** Viagem cujo período (inclusive) contém `data`. Como viagens não se sobrepõem, no
 *  máximo uma é retornada. */
export function viagemAtivaEm(viagens: Viagem[], data: ISODate): Viagem | null {
  return viagens.find((v) => data >= v.dataInicio && data <= v.dataFim) ?? null;
}

/** Se um novo período [dataInicio, dataFim] sobrepõe alguma viagem existente
 *  (bordas tocando contam como sobreposição). `ignorarId` exclui a própria viagem
 *  sendo editada da checagem. */
export function viagensSobrepoem(
  viagens: Viagem[],
  dataInicio: ISODate,
  dataFim: ISODate,
  ignorarId?: ID,
): boolean {
  return viagens.some(
    (v) => v.id !== ignorarId && dataInicio <= v.dataFim && dataFim >= v.dataInicio,
  );
}

export interface ItemViagem { data: ISODate; valor: number }

export interface GrupoItemViagem {
  chave: string;
  rotulo: string;
  subtotal: number;
  itens: ItemViagem[];
}

export interface ResumoViagem {
  grupos: GrupoItemViagem[];
  total: number;
}

/** Detalhamento de uma viagem: lançamentos de débito (agrupados por nota) e compras de
 *  cartão (agrupadas por descrição) marcados com `viagem.id`, filtrados por box. Usa o
 *  valor cheio da compra (não fatiado por parcela) — é o total histórico da viagem. */
export function itensDaViagem(
  viagem: Viagem,
  lancamentos: Lancamento[],
  comprasCartao: CompraCartao[],
  boxIds: readonly ID[],
  cartoes: Cartao[],
  incluirPrevistos: boolean,
): ResumoViagem {
  const sel = new Set(boxIds);
  const cartaoBoxId = new Map(cartoes.map((c) => [c.id, c.boxId]));
  const grupos = new Map<string, GrupoItemViagem>();

  function acumular(rotuloBruto: string | undefined, data: ISODate, valor: number) {
    const chave = (rotuloBruto ?? '').trim().toLowerCase();
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { chave, rotulo: chave === '' ? 'sem descrição' : rotuloBruto!.trim(), subtotal: 0, itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.subtotal += valor;
    grupo.itens.push({ data, valor });
  }

  for (const l of lancamentos) {
    if (l.viagemId !== viagem.id) continue;
    if (!sel.has(l.boxId)) continue;
    if (l.status !== 'efetivo' && !incluirPrevistos) continue;
    acumular(l.nota, l.data, l.valor);
  }
  for (const c of comprasCartao) {
    if (c.viagemId !== viagem.id) continue;
    const boxId = cartaoBoxId.get(c.cartaoId);
    if (boxId == null || !sel.has(boxId)) continue;
    acumular(c.descricao, c.data, c.valorTotal);
  }

  for (const g of grupos.values()) {
    g.itens.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }
  const lista = [...grupos.values()].sort((a, b) => b.subtotal - a.subtotal);
  const total = lista.reduce((soma, g) => soma + g.subtotal, 0);
  return { grupos: lista, total };
}

/** Total gasto numa viagem restrito a um mês específico. Débito conta pela data do
 *  lançamento; compra de cartão conta pelo mês de VENCIMENTO de cada parcela (reaproveita
 *  `calcularFaturas`), não pelo mês da compra — uma compra parcelada durante a viagem
 *  continua aparecendo nos meses seguintes enquanto houver parcela pendente. */
export function totalViagemNoMes(
  viagem: Viagem,
  mes: string,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  comprasCartao: CompraCartao[],
  cartoes: Cartao[],
  incluirPrevistos: boolean,
): number {
  const sel = new Set(boxIds);
  let total = 0;
  for (const l of lancamentos) {
    if (l.viagemId !== viagem.id) continue;
    if (!sel.has(l.boxId) || mesDe(l.data) !== mes) continue;
    if (l.status !== 'efetivo' && !incluirPrevistos) continue;
    total += l.valor;
  }
  for (const cartao of cartoes) {
    if (!sel.has(cartao.boxId)) continue;
    const comprasDaViagem = comprasCartao.filter((c) => c.viagemId === viagem.id && c.cartaoId === cartao.id);
    if (comprasDaViagem.length === 0) continue;
    const ate = datasFaturaDoMes(cartao, mes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDaViagem, ate).find((f) => f.mes === mes);
    if (fatura) total += fatura.totalCent;
  }
  return total;
}
