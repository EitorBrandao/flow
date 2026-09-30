import { addMeses, mesAbreviado } from './dates';

/** Modo do seletor de período da aba Análises. */
export type ModoPeriodo = 'mes' | '12m' | 'ano' | 'periodo';

/** Estado de todos os modos ao mesmo tempo: trocar de modo não perde o que os outros tinham. */
export interface EstadoPeriodo {
  modo: ModoPeriodo;
  /** modo Mês: o mês escolhido */
  mes: string;
  /** modo 12 meses: o último mês da janela */
  fim12: string;
  /** modo Ano */
  ano: number;
  /** modo Período: primeiro e último mês, inclusive */
  de: string;
  ate: string;
}

/** Teto do modo Período: acima disso o gráfico de evolução não cabe no celular. */
export const MAX_MESES_PERIODO = 24;

export function estadoInicial(mesHoje: string): EstadoPeriodo {
  return {
    modo: 'mes',
    mes: mesHoje,
    fim12: mesHoje,
    ano: Number(mesHoje.slice(0, 4)) - 1, // último ano fechado
    de: addMeses(mesHoje, -6),
    ate: mesHoje,
  };
}

/** Lista inclusiva de meses `AAAA-MM`; vazia se `de` vem depois de `ate`. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let m = de; m <= ate; m = addMeses(m, 1)) out.push(m);
  return out;
}

export function mesesDoPeriodo(e: EstadoPeriodo): string[] {
  switch (e.modo) {
    case 'mes': return [e.mes];
    case '12m': return mesesEntre(addMeses(e.fim12, -11), e.fim12);
    case 'ano': return mesesEntre(`${e.ano}-01`, `${e.ano}-12`);
    case 'periodo': return mesesEntre(e.de, e.ate);
  }
}

/** Os N meses imediatamente antes do período. */
export function periodoAnterior(meses: readonly string[]): string[] {
  return meses.map((m) => addMeses(m, -meses.length));
}

/** Os mesmos meses do período, 12 meses antes. */
export function periodoAnoAnterior(meses: readonly string[]): string[] {
  return meses.map((m) => addMeses(m, -12));
}

/** Com 12 meses, "anterior" e "ano anterior" são o mesmo intervalo: a coluna repetida some. */
export function anoAnteriorRepete(meses: readonly string[]): boolean {
  return meses.length === 12;
}

/** Move o início do período. Passar do fim arrasta o fim; passar do teto puxa o fim. */
export function ajustarDe(_de: string, ate: string, novoDe: string): { de: string; ate: string } {
  let novoAte = novoDe > ate ? novoDe : ate;
  if (mesesEntre(novoDe, novoAte).length > MAX_MESES_PERIODO) novoAte = addMeses(novoDe, MAX_MESES_PERIODO - 1);
  return { de: novoDe, ate: novoAte };
}

/** Move o fim do período. Voltar antes do início arrasta o início; passar do teto puxa o início. */
export function ajustarAte(de: string, _ate: string, novoAte: string): { de: string; ate: string } {
  let novoDe = novoAte < de ? novoAte : de;
  if (mesesEntre(novoDe, novoAte).length > MAX_MESES_PERIODO) novoDe = addMeses(novoAte, -(MAX_MESES_PERIODO - 1));
  return { de: novoDe, ate: novoAte };
}

/** "out/2025 – set/2026"; com um mês só, "set/2026". */
export function rotuloIntervalo(meses: readonly string[]): string {
  if (meses.length === 0) return '';
  const primeiro = mesAbreviado(meses[0]);
  return meses.length === 1 ? primeiro : `${primeiro} – ${mesAbreviado(meses[meses.length - 1])}`;
}

/** Cabeçalho da 1ª coluna de valor das tabelas de comparação com vários meses. */
export function rotuloColunaPeriodo(modo: ModoPeriodo, meses: readonly string[]): string {
  if (modo === 'ano') return meses[0]?.slice(0, 4) ?? '';
  if (modo === '12m') return '12 meses';
  return `${meses.length} meses`;
}

/** Linha fina sob o título das tabelas de comparação: diz que intervalo cada coluna usa. */
export function notaComparacao(meses: readonly string[]): string {
  const anterior = `anterior = ${rotuloIntervalo(periodoAnterior(meses))}`;
  return anoAnteriorRepete(meses)
    ? `${anterior} (é também o ano anterior)`
    : `${anterior} · ano anterior = ${rotuloIntervalo(periodoAnoAnterior(meses))}`;
}
