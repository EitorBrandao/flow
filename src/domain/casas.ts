import type { Box, Dados, ID } from './types';

/** Nome da box consolidadora que o app cria sozinho em cada instalação (`iniciar()`), com id novo. */
export const NOME_BOX_CASA = 'casa';

/** A casa que fica quando há mais de uma: a criada primeiro (empate pelo id, para o resultado não
 *  depender da ordem da lista). */
export function casaQueFica(boxes: readonly Box[]): Box | undefined {
  return boxes
    .filter((b) => b.nome === NOME_BOX_CASA)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id))[0];
}

/** Para cada box de nome "casa" de `candidatas` que não é a de destino: `id` antigo → `destinoId`. */
export function trocasDaCasa(candidatas: readonly Box[], destinoId: ID): Map<ID, ID> {
  return new Map(
    candidatas.filter((b) => b.nome === NOME_BOX_CASA && b.id !== destinoId).map((b) => [b.id, destinoId] as const),
  );
}

/**
 * Aponta para a box nova tudo que apontava para uma box trocada (`boxId` de categorias,
 * lançamentos, recorrências, cartões e bancos; `escopo` de cenários; `config.boxPadraoId`) e tira
 * as boxes trocadas da lista. Devolve cópias; não altera o que recebeu. Sem trocas, devolve o
 * mesmo objeto.
 */
export function aplicarTrocasDeBox(dados: Dados, trocas: ReadonlyMap<ID, ID>): Dados {
  if (trocas.size === 0) return dados;
  const daBox = <T extends { boxId: ID }>(xs: T[]): T[] =>
    xs.map((x) => (trocas.has(x.boxId) ? { ...x, boxId: trocas.get(x.boxId)! } : x));
  const padrao = dados.config.boxPadraoId;
  return {
    ...dados,
    boxes: dados.boxes.filter((b) => !trocas.has(b.id)),
    categorias: daBox(dados.categorias),
    lancamentos: daBox(dados.lancamentos),
    recorrencias: daBox(dados.recorrencias),
    cartoes: daBox(dados.cartoes),
    bancos: daBox(dados.bancos),
    cenarios: dados.cenarios.map((c) => (c.escopo != null && trocas.has(c.escopo) ? { ...c, escopo: trocas.get(c.escopo)! } : c)),
    config: padrao != null && trocas.has(padrao) ? { ...dados.config, boxPadraoId: trocas.get(padrao)! } : dados.config,
  };
}
