import { addMeses, mesDe } from './dates';
import { formatarSaldoSemSimbolo, formatarSemSimbolo } from './money';
import { mesesEntre } from './periodo';
import { ocorrencias } from './recurrence';
import type { DiaSaldo } from './projection';
import type { Dados, ID, ISODate, Lancamento, Recorrencia } from './types';

export const MAX_MESES_SIMULACAO = 60;

/** Período da tabela do Simular, em meses (AAAA-MM), inclusivos nas duas extremidades. */
export interface PeriodoSimulacao { de: string; ate: string }

/** Um mês da tabela do Simular: saldo no último dia do mês sem e com os cenários. */
export interface LinhaMes { mes: string; sem: number; com: number; dif: number }

/** Período padrão: do mês de hoje até o mês do horizonte. */
export function periodoPadrao(hoje: ISODate, horizonte: ISODate): PeriodoSimulacao {
  return {
    de: mesDe(hoje),
    ate: mesDe(horizonte),
  };
}

/** Ajusta o início do período. `novoDe` nunca antes de `mesHoje`. Se passar de 60 meses,
 *  `ate` é arrastado. */
export function ajustarDeSim(
  p: PeriodoSimulacao,
  novoDe: string,
  mesHoje: string,
): PeriodoSimulacao {
  const de = novoDe < mesHoje ? mesHoje : novoDe;

  // O fim só se mexe se o início passar dele (então vira o início) ou se o período passar do teto.
  let ate = de > p.ate ? de : p.ate;

  const meses = mesesEntre(de, ate).length;
  if (meses > MAX_MESES_SIMULACAO) {
    ate = addMeses(de, MAX_MESES_SIMULACAO - 1);
  }
  return { de, ate };
}

/** Ajusta o fim do período. Se passar de 60 meses, `de` é arrastado. `de` nunca fica antes de
 *  `mesHoje`. */
export function ajustarAteSim(
  p: PeriodoSimulacao,
  novoAte: string,
  mesHoje: string,
): PeriodoSimulacao {
  let ate = novoAte;
  let de = p.de;

  // Se novoAte < mesHoje, clamp para mesHoje
  if (ate < mesHoje) {
    ate = mesHoje;
  }

  if (ate < de) {
    de = ate;
  }
  if (de < mesHoje) {
    de = mesHoje;
  }

  const meses = mesesEntre(de, ate).length;
  if (meses > MAX_MESES_SIMULACAO) {
    de = addMeses(ate, -(MAX_MESES_SIMULACAO - 1));
    if (de < mesHoje) {
      de = mesHoje;
      ate = addMeses(mesHoje, MAX_MESES_SIMULACAO - 1);
    }
  }
  return { de, ate };
}

/** Cria lançamentos sintéticos para as ocorrências de recorrências ativas que passam de
 *  `config.horizonteProjecao` até `ate`. Os ids são estáveis (`ext-<recId>-<data>`). Não
 *  duplica datas que já existem. */
export function estenderRecorrencias(
  dados: Pick<Dados, 'recorrencias' | 'lancamentos' | 'config'>,
  ate: ISODate,
): Lancamento[] {
  const result: Lancamento[] = [];
  const existentes = new Set(
    dados.lancamentos
      .filter((l) => l.recorrenciaId)
      .map((l) => `${l.recorrenciaId}:${l.data}`),
  );

  for (const rec of dados.recorrencias) {
    if (!rec.ativa) continue;
    const ocorrs = ocorrencias(rec, ate);
    for (const data of ocorrs) {
      if (data <= dados.config.horizonteProjecao) continue;
      const chave = `${rec.id}:${data}`;
      if (existentes.has(chave)) continue;

      result.push({
        id: `ext-${rec.id}-${data}`,
        boxId: rec.boxId,
        categoriaId: rec.categoriaId,
        valor: rec.valor,
        data,
        status: 'previsto',
        origem: 'recorrencia',
        recorrenciaId: rec.id,
        criadoEm: rec.criadoEm,
        alteradoEm: rec.alteradoEm,
        ...(rec.nota && { nota: rec.nota }),
        ...(rec.bancoId && { bancoId: rec.bancoId }),
        ...(rec.cenarioId && { cenarioId: rec.cenarioId }),
      });
    }
  }

  return result;
}

/** Resume a série de `projetarBoxes` por mês, do mês de `hoje` em diante. Usa o último dia de
 *  cada mês presente na série. `sem` é o saldo projetado (efetivo + previsto, sem cenário);
 *  `com` soma os cenários ligados na projeção. Opcional `ate` (mês AAAA-MM) corta meses
 *  depois dele. */
export function resumoMensal(serie: DiaSaldo[], hoje: ISODate, ate?: string): LinhaMes[] {
  const mesHoje = mesDe(hoje);
  const ultimoDoMes = new Map<string, DiaSaldo>();
  for (const d of serie) {
    const mes = mesDe(d.data);
    if (mes < mesHoje) continue;
    if (ate && mes > ate) continue;
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

/** Menor saldo do campo entre os dias de `hoje` em diante. Série sem dias assim: `0`. */
export function menorSaldo(
  serie: DiaSaldo[], campo: 'saldoProjetado' | 'saldoComCenarios', hoje: ISODate,
): number {
  const futuros = serie.filter((d) => d.data >= hoje);
  if (futuros.length === 0) return 0;
  return Math.min(...futuros.map((d) => d[campo]));
}

/** Primeiro dia, de `hoje` em diante, em que o saldo do campo fica abaixo de zero. */
export function primeiroDiaNegativo(
  serie: DiaSaldo[], campo: 'saldoProjetado' | 'saldoComCenarios', hoje: ISODate,
): ISODate | null {
  return serie.find((d) => d.data >= hoje && d[campo] < 0)?.data ?? null;
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
