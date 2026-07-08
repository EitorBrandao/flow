import type { ISODate } from './types';

const MS_DIA = 86_400_000;

function paraUTC(d: ISODate): number {
  return Date.parse(`${d}T00:00:00Z`);
}

function isoDeUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function hojeISO(agora: Date = new Date()): ISODate {
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
}

export function addDias(d: ISODate, n: number): ISODate {
  return isoDeUTC(paraUTC(d) + n * MS_DIA);
}

export function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

/** Data no mês (ano, mes1a12 — pode extrapolar, ex.: 13 = jan seguinte) com dia clampado. */
export function dataComDia(ano: number, mes1a12: number, dia: number): ISODate {
  const base = new Date(Date.UTC(ano, mes1a12 - 1, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1;
  const d = Math.min(dia, ultimoDiaDoMes(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function diasEntre(inicio: ISODate, fim: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let t = paraUTC(inicio); t <= paraUTC(fim); t += MS_DIA) out.push(isoDeUTC(t));
  return out;
}

export function mesDe(d: ISODate): string {
  return d.slice(0, 7);
}

export function addMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Desloca uma data completa em N meses, mantendo o dia do mês (clampado ao fim do mês
 *  se necessário). N pode ser negativo. */
export function addMesesData(d: ISODate, n: number): ISODate {
  const [ano, mes, dia] = d.split('-').map(Number);
  return dataComDia(ano, mes + n, dia);
}

/** Serial de data do Excel (base 1899-12-30) → ISODate. */
export function serialExcelParaISO(serial: number): ISODate {
  return isoDeUTC(Date.UTC(1899, 11, 30) + Math.round(serial) * MS_DIA);
}
