import type { Categoria, CompraCartao, ISODate, Lancamento, TipoCategoria } from './types';

export interface CandidatoLancamento {
  boxId: string;
  data: ISODate;
  valor: number;
  tipo: TipoCategoria;
}

/**
 * Acha um lançamento igual ao candidato: mesma box, data, valor e tipo.
 * Conta `efetivo` e `previsto` de origem `manual` ou `recorrencia`.
 * Fatura de cartão, transferência e cenário ficam de fora.
 */
export function lancamentoRepetido(
  lancamentos: Lancamento[],
  categorias: Categoria[],
  c: CandidatoLancamento,
): Lancamento | null {
  const tipoDe = new Map(categorias.map((cat) => [cat.id, cat.tipo]));
  return lancamentos.find((l) =>
    (l.origem === 'manual' || l.origem === 'recorrencia')
    && l.cenarioId == null
    && l.boxId === c.boxId
    && l.data === c.data
    && l.valor === c.valor
    && tipoDe.get(l.categoriaId) === c.tipo,
  ) ?? null;
}

export interface CandidatoCompra {
  cartaoId: string;
  data: ISODate;
  valorTotal: number;
  parcelas: number;
}

/** Acha uma compra igual à candidata: mesmo cartão, data, valor total e número de parcelas. */
export function compraRepetida(compras: CompraCartao[], c: CandidatoCompra): CompraCartao | null {
  return compras.find((x) =>
    x.cartaoId === c.cartaoId
    && x.data === c.data
    && x.valorTotal === c.valorTotal
    && x.parcelas === c.parcelas,
  ) ?? null;
}
