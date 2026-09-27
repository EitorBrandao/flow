import { mesDe } from './dates';
import { formatarSaldoSemSimbolo, formatarSemSimbolo } from './money';
import type { DiaSaldo } from './projection';
import type { Dados, ID, ISODate, Lancamento, Recorrencia } from './types';

/** Um mês da tabela do Simular: saldo no último dia do mês sem e com os cenários. */
export interface LinhaMes { mes: string; sem: number; com: number; dif: number }

/** Resume a série de `projetarBoxes` por mês, do mês de `hoje` em diante. Usa o último dia de
 *  cada mês presente na série. `sem` é o saldo projetado (efetivo + previsto, sem cenário);
 *  `com` soma os cenários ligados na projeção. */
export function resumoMensal(serie: DiaSaldo[], hoje: ISODate): LinhaMes[] {
  const mesHoje = mesDe(hoje);
  const ultimoDoMes = new Map<string, DiaSaldo>();
  for (const d of serie) {
    const mes = mesDe(d.data);
    if (mes < mesHoje) continue;
    ultimoDoMes.set(mes, d); // a série vem em ordem: o último que entra é o último dia
  }
  return [...ultimoDoMes.entries()].map(([mes, d]) => ({
    mes, sem: d.saldoProjetado, com: d.saldoComCenarios, dif: d.saldoComCenarios - d.saldoProjetado,
  }));
}

/** Primeiro mês com o saldo com cenários abaixo de zero, ou `null`. */
export function primeiroMesNegativo(linhas: LinhaMes[]): string | null {
  return linhas.find((l) => l.com < 0)?.mes ?? null;
}

/** Faixa em que o saldo com cenários pode cair, qualquer que seja a combinação ligada.
 *  `efeitos[i][k]` é a diferença do cenário `i` sozinho no mês `k`. */
export function extremosPossiveis(
  sem: number[], efeitos: number[][],
): { min: number[]; max: number[] } {
  return {
    min: sem.map((s, k) => s + efeitos.reduce((t, e) => t + Math.min(0, e[k] ?? 0), 0)),
    max: sem.map((s, k) => s + efeitos.reduce((t, e) => t + Math.max(0, e[k] ?? 0), 0)),
  };
}

/** Largura, em caracteres, da coluna de valor da tabela do Simular: o texto mais longo entre
 *  os saldos possíveis (com "−") e as diferenças possíveis (sem sinal). Nunca menos de 4. */
export function larguraColunaValor(sem: number[], ext: { min: number[]; max: number[] }): number {
  const textos = sem.flatMap((s, k) => [
    formatarSaldoSemSimbolo(s),
    formatarSaldoSemSimbolo(ext.min[k]),
    formatarSaldoSemSimbolo(ext.max[k]),
    formatarSemSimbolo(ext.min[k] - s),
    formatarSemSimbolo(ext.max[k] - s),
  ]);
  return Math.max(4, ...textos.map((t) => t.length));
}

export type Repeticao = 'unica' | 'parcelado' | 'mensal';

/** Item de um cenário: um lançamento avulso ("uma vez") ou uma recorrência (parcelado ou
 *  todo mês). Os lançamentos materializados da recorrência não são itens. */
export type ItemCenario =
  | { repeticao: 'unica'; id: ID; data: ISODate; lancamento: Lancamento }
  | { repeticao: 'parcelado' | 'mensal'; id: ID; data: ISODate; recorrencia: Recorrencia };

export function itensDoCenario(
  dados: Pick<Dados, 'lancamentos' | 'recorrencias'>, cenarioId: ID,
): ItemCenario[] {
  const avulsos: ItemCenario[] = dados.lancamentos
    .filter((l) => l.cenarioId === cenarioId && l.recorrenciaId == null)
    .map((l) => ({ repeticao: 'unica', id: l.id, data: l.data, lancamento: l }));
  const recorrentes: ItemCenario[] = dados.recorrencias
    .filter((r) => r.cenarioId === cenarioId)
    .map((r) => ({
      repeticao: r.parcelas == null ? 'mensal' : 'parcelado', id: r.id, data: r.dataInicio, recorrencia: r,
    }));
  return [...avulsos, ...recorrentes].sort((a, b) => a.data.localeCompare(b.data));
}
