import type { Cenario } from './types';

/** Visão dona do cenário: o id de uma box ou 'casa'. Cenário antigo, sem o campo, é da casa. */
export function escopoDoCenario(c: Cenario): string {
  return c.escopo ?? 'casa';
}

/** O cenário só existe na visão que o criou: `boxSel` é 'casa' ou o id da box do topo. */
export function cenarioDaVisao(c: Cenario, boxSel: string): boolean {
  return escopoDoCenario(c) === boxSel;
}
