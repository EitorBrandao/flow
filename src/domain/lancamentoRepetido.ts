import type { CompraCartao, ID, ISODate, Lancamento } from './types';

export interface CandidatoLancamento {
  boxId: ID;
  data: ISODate;
  valor: number;
  categoriaId: ID;
}

/**
 * Acha um lançamento igual ao candidato: mesma box, data, valor e categoria.
 * A categoria já fixa o tipo (gasto ou ganho), então ele não entra na comparação.
 * Conta `efetivo` e `previsto` de origem `manual` ou `recorrencia`.
 * Fatura de cartão, transferência e cenário ficam de fora.
 */
export function lancamentoRepetido(
  lancamentos: Lancamento[],
  c: CandidatoLancamento,
): Lancamento | null {
  return lancamentos.find((l) =>
    (l.origem === 'manual' || l.origem === 'recorrencia')
    && l.cenarioId == null
    && l.boxId === c.boxId
    && l.data === c.data
    && l.valor === c.valor
    && l.categoriaId === c.categoriaId,
  ) ?? null;
}

export interface CandidatoCompra {
  cartaoId: ID;
  data: ISODate;
  valorTotal: number;
  parcelas: number;
  categoriaCartaoId: ID;
}

/** Acha uma compra igual à candidata: mesmo cartão, data, valor total, número de parcelas e categoria do cartão. */
export function compraRepetida(compras: CompraCartao[], c: CandidatoCompra): CompraCartao | null {
  return compras.find((x) =>
    x.cartaoId === c.cartaoId
    && x.data === c.data
    && x.valorTotal === c.valorTotal
    && x.parcelas === c.parcelas
    && x.categoriaCartaoId === c.categoriaCartaoId,
  ) ?? null;
}
