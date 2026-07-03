import { diasEntre } from './dates';
import type { Box, Categoria, ID, ISODate, Lancamento } from './types';

export interface DiaSaldo {
  data: ISODate;
  saldoEfetivo: number;
  saldoProjetado: number;
  saldoComCenarios: number;
}

export interface EntradaProjecao {
  boxes: Box[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  cenariosLigados: ReadonlySet<ID>;
  horizonte: ISODate;
}

export function projetarBoxes(boxIds: readonly ID[], e: EntradaProjecao): DiaSaldo[] {
  const sel = new Set(boxIds);
  const boxes = e.boxes.filter((b) => sel.has(b.id));
  const cats = new Map(e.categorias.map((c) => [c.id, c]));
  const lancs = e.lancamentos.filter((l) => sel.has(l.boxId));

  const iniciosBoxes = boxes
    .map((b) => b.dataSaldoInicial)
    .filter((d): d is ISODate => d != null);
  const candidatos = iniciosBoxes.length > 0
    ? iniciosBoxes
    : lancs.map((l) => l.data);
  const inicio = [...candidatos].sort()[0];
  if (!inicio || inicio > e.horizonte) return [];

  const base = boxes.reduce((s, b) => s + (b.saldoInicial ?? 0), 0);
  const inicialPorBox = new Map(boxes.map((b) => [b.id, b.dataSaldoInicial]));

  const porDia = new Map<ISODate, Lancamento[]>();
  for (const l of lancs) {
    const d0 = inicialPorBox.get(l.boxId);
    if (d0 != null && l.data <= d0) continue; // já contido no saldo inicial da box
    if (l.data < inicio || l.data > e.horizonte) continue;
    const arr = porDia.get(l.data);
    if (arr) arr.push(l);
    else porDia.set(l.data, [l]);
  }

  let ef = base;
  let pr = base;
  let ce = base;
  const out: DiaSaldo[] = [];
  for (const dia of diasEntre(inicio, e.horizonte)) {
    for (const l of porDia.get(dia) ?? []) {
      const tipo = cats.get(l.categoriaId)?.tipo ?? 'gasto';
      const v = (tipo === 'ganho' ? 1 : -1) * l.valor;
      if (l.cenarioId) {
        if (e.cenariosLigados.has(l.cenarioId)) ce += v;
      } else if (l.status === 'efetivo') {
        ef += v; pr += v; ce += v;
      } else {
        pr += v; ce += v;
      }
    }
    out.push({ data: dia, saldoEfetivo: ef, saldoProjetado: pr, saldoComCenarios: ce });
  }
  return out;
}

export function pendentes(lancamentos: Lancamento[], hoje: ISODate): Lancamento[] {
  return lancamentos
    .filter((l) => l.status === 'previsto' && !l.cenarioId && l.data <= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
}
