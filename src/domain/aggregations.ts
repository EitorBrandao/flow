import { addMeses, mesDe } from './dates';
import type { Categoria, ID, Lancamento, TipoCategoria } from './types';

export interface LinhaResumo {
  categoriaId: ID;
  nome: string;
  tipo: TipoCategoria;
  total: number;
  pctDaRenda: number | null;
}

export interface ResumoMensal {
  mes: string;
  linhas: LinhaResumo[];
  totalGanhos: number;
  totalGastos: number;
  sobra: number;
}

function filtrar(
  mes: string,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): Lancamento[] {
  const sel = new Set(boxIds);
  return lancamentos.filter(
    (l) =>
      sel.has(l.boxId) &&
      !l.cenarioId &&
      mesDe(l.data) === mes &&
      (l.status === 'efetivo' || incluirPrevistos),
  );
}

function totaisPorCategoria(lancs: Lancamento[]): Map<ID, number> {
  const totais = new Map<ID, number>();
  for (const l of lancs) totais.set(l.categoriaId, (totais.get(l.categoriaId) ?? 0) + l.valor);
  return totais;
}

export function resumoMensal(
  mes: string,
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ResumoMensal {
  const totais = totaisPorCategoria(filtrar(mes, boxIds, lancamentos, incluirPrevistos));
  const catsOrdenadas = [...categorias].sort(
    (a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1),
  );
  let totalGanhos = 0;
  let totalGastos = 0;
  for (const c of catsOrdenadas) {
    const t = totais.get(c.id) ?? 0;
    if (c.tipo === 'ganho') totalGanhos += t;
    else totalGastos += t;
  }
  const linhas: LinhaResumo[] = catsOrdenadas
    .filter((c) => totais.has(c.id))
    .map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      tipo: c.tipo,
      total: totais.get(c.id)!,
      pctDaRenda:
        c.tipo === 'gasto' && totalGanhos > 0 ? totais.get(c.id)! / totalGanhos : null,
    }));
  return { mes, linhas, totalGanhos, totalGastos, sobra: totalGanhos - totalGastos };
}

export interface ComparativoCategoria {
  categoriaId: ID;
  nome: string;
  tipo: TipoCategoria;
  atual: number;
  mesAnterior: number;
  anoAnterior: number;
}

export function compararMeses(
  mes: string,
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ComparativoCategoria[] {
  const atual = totaisPorCategoria(filtrar(mes, boxIds, lancamentos, incluirPrevistos));
  const anterior = totaisPorCategoria(filtrar(addMeses(mes, -1), boxIds, lancamentos, incluirPrevistos));
  const anoPassado = totaisPorCategoria(filtrar(addMeses(mes, -12), boxIds, lancamentos, incluirPrevistos));
  return categorias
    .filter((c) => atual.has(c.id) || anterior.has(c.id) || anoPassado.has(c.id))
    .map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      tipo: c.tipo,
      atual: atual.get(c.id) ?? 0,
      mesAnterior: anterior.get(c.id) ?? 0,
      anoAnterior: anoPassado.get(c.id) ?? 0,
    }));
}

export function serieMensal(
  categoriaId: ID,
  meses: string[],
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): number[] {
  return meses.map(
    (mes) => totaisPorCategoria(filtrar(mes, boxIds, lancamentos, incluirPrevistos)).get(categoriaId) ?? 0,
  );
}

export function mediaMovel3(valores: number[]): (number | null)[] {
  return valores.map((_, i) =>
    i < 2 ? null : Math.round((valores[i] + valores[i - 1] + valores[i - 2]) / 3),
  );
}
