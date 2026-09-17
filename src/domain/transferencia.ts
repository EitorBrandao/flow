import type { Box, ID } from './types';

/** Ids das duas categorias ocultas de transferência de cada box (saída e entrada) — não
 *  devem aparecer em nenhuma lista de seleção manual de categoria. Mesmo formato de
 *  `categoriasFaturaIds` (`src/domain/fatura.ts`). */
export function categoriasTransferenciaIds(boxes: Box[]): Set<ID> {
  const ids = new Set<ID>();
  for (const b of boxes) {
    if (b.categoriaTransferenciaSaidaId) ids.add(b.categoriaTransferenciaSaidaId);
    if (b.categoriaTransferenciaEntradaId) ids.add(b.categoriaTransferenciaEntradaId);
  }
  return ids;
}
