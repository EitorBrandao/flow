import { projetarBoxes, type EntradaProjecao } from './projection';
import type { ID, ISODate } from './types';

export interface SaldoDaBox { boxId: ID; nome: string; saldoEfetivo: number }

/** Saldo efetivo de hoje de cada box da seleção, para a visão casa. Entram as boxes com saldo
 *  próprio e a box sem saldo próprio só se tiver algum lançamento. Cada box usa a mesma
 *  projeção do total (`projetarBoxes`), com uma box só. Quando todas as boxes começam na mesma
 *  data, a soma das linhas é igual ao total consolidado. */
export function saldosPorBox(ids: readonly ID[], e: EntradaProjecao, hoje: ISODate): SaldoDaBox[] {
  const sel = new Set(ids);
  return e.boxes
    .filter((b) => sel.has(b.id))
    .filter((b) => b.saldoInicial !== null || e.lancamentos.some((l) => l.boxId === b.id))
    .map((b) => {
      const dia = projetarBoxes([b.id], e).filter((s) => s.data <= hoje).at(-1);
      return { boxId: b.id, nome: b.nome, saldoEfetivo: dia?.saldoEfetivo ?? 0 };
    });
}
