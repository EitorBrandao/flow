import type { Categoria, ISODate, Lancamento, TipoCategoria } from './types';

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
