import type { EntradaProjecao } from './projection';
import type { ID, ISODate } from './types';

export interface SaldoDaBox { boxId: ID; nome: string; saldoEfetivo: number }

/** Saldo efetivo de hoje de cada box da seleção, para a visão casa. Entram as boxes com saldo
 *  próprio e a box sem saldo próprio só se tiver algum lançamento. Cada linha usa o MESMO corte
 *  do total consolidado (`projetarBoxes`): o início é a menor `dataSaldoInicial` da seleção (ou,
 *  sem nenhuma, a menor data de lançamento); fora ficam o lançamento anterior a esse início, o
 *  da própria data do saldo inicial da box (ou antes) e o posterior ao horizonte. Por isso a
 *  soma das linhas é sempre igual ao total. Se hoje vem antes do início, o total não tem dia
 *  até hoje e o card mostra zero; as linhas também mostram zero, para a soma continuar igual. */
export function saldosPorBox(ids: readonly ID[], e: EntradaProjecao, hoje: ISODate): SaldoDaBox[] {
  const sel = new Set(ids);
  const boxes = e.boxes.filter((b) => sel.has(b.id));
  const lancs = e.lancamentos.filter((l) => sel.has(l.boxId));
  const iniciosBoxes = boxes.map((b) => b.dataSaldoInicial).filter((d): d is ISODate => d != null);
  const candidatos = iniciosBoxes.length > 0 ? iniciosBoxes : lancs.map((l) => l.data);
  const inicio = [...candidatos].sort()[0];
  const semDia = !inicio || inicio > e.horizonte || hoje < inicio;
  const tipos = new Map(e.categorias.map((c) => [c.id, c.tipo]));

  return boxes
    .filter((b) => b.saldoInicial !== null || lancs.some((l) => l.boxId === b.id))
    .map((b) => {
      if (semDia) return { boxId: b.id, nome: b.nome, saldoEfetivo: 0 };
      let saldo = b.saldoInicial ?? 0;
      for (const l of lancs) {
        if (l.boxId !== b.id || l.cenarioId || l.status !== 'efetivo') continue;
        if (l.data < inicio || l.data > e.horizonte || l.data > hoje) continue;
        if (b.dataSaldoInicial != null && l.data <= b.dataSaldoInicial) continue;
        saldo += (tipos.get(l.categoriaId) === 'ganho' ? 1 : -1) * l.valor;
      }
      return { boxId: b.id, nome: b.nome, saldoEfetivo: saldo };
    });
}
