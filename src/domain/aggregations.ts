import { addMeses, mesDe, addDias } from './dates';
import type { Categoria, ID, ISODate, Lancamento, TipoCategoria, Dados } from './types';
import { compararCategorias, categoriasCartaoReservadasIds } from './categorias';

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
  const catsOrdenadas = [...categorias].sort(compararCategorias);
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

export interface ResumoMesSimples {
  mes: string;
  ganhos: number;
  gastos: number;
  sobra: number;
}

export function serieMensalResumo(
  meses: string[],
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ResumoMesSimples[] {
  return meses.map((mes) => {
    const totais = totaisPorCategoria(filtrar(mes, boxIds, lancamentos, incluirPrevistos));
    let ganhos = 0;
    let gastos = 0;
    for (const c of categorias) {
      const t = totais.get(c.id) ?? 0;
      if (c.tipo === 'ganho') ganhos += t; else gastos += t;
    }
    return { mes, ganhos, gastos, sobra: ganhos - gastos };
  });
}

export interface ItemLancamento {
  data: ISODate;
  valor: number;
}

export interface GrupoLancamentos {
  notaChave: string;
  notaExibicao: string;
  subtotal: number;
  itens: ItemLancamento[];
}

export function lancamentosDaCategoria(
  mes: string,
  categoriaId: ID,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): GrupoLancamentos[] {
  const doCategoria = filtrar(mes, boxIds, lancamentos, incluirPrevistos).filter(
    (l) => l.categoriaId === categoriaId,
  );
  const grupos = new Map<string, GrupoLancamentos>();
  for (const l of doCategoria) {
    const chave = (l.nota ?? '').trim().toLowerCase();
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { notaChave: chave, notaExibicao: chave === '' ? 'sem nota' : l.nota!.trim(), subtotal: 0, itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.subtotal += l.valor;
    grupo.itens.push({ data: l.data, valor: l.valor });
  }
  for (const g of grupos.values()) {
    g.itens.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }
  return [...grupos.values()].sort((a, b) => b.subtotal - a.subtotal);
}

export type DestinoFrequente =
  | { tipo: 'box'; categoriaId: ID }
  | { tipo: 'cartao'; cartaoId: ID; categoriaCartaoId: ID };

export interface ChipFrequente {
  chave: string;      // 'box:<categoriaId>' | 'cartao:<cartaoId>:<categoriaCartaoId>'
  destino: DestinoFrequente;
  rotulo: string;     // nome da categoria
  valorCent: number;  // valor da ocorrência mais recente
  usos: number;
}

interface Acumulado extends ChipFrequente {
  ultimaData: ISODate;
}

/**
 * Combinações de categoria + destino que o usuário mais digitou na janela, para virarem
 * atalhos na sheet Adicionar. Só conta o que foi digitado à mão: recorrência, fatura,
 * assinatura e parcelamento entram sozinhos no app, e um atalho para eles convidaria a
 * lançar em duplicidade. `status` não filtra — o que separa gesto de automação é `origem`.
 *
 * A janela é medida pela `data` do lançamento, não por `criadoEm`: quem digita hoje o gasto
 * do mês passado quer que ele conte no mês passado.
 */
export function frequentes(
  dados: Dados,
  opcoes: {
    hoje: ISODate;
    boxId: ID | null;
    cartaoIds: readonly ID[];
    janelaDias?: number;
    limite?: number;
  },
): ChipFrequente[] {
  const janelaDias = opcoes.janelaDias ?? 60;
  const limite = opcoes.limite ?? 6;
  const inicio = addDias(opcoes.hoje, -(janelaDias - 1));
  const dentro = (d: ISODate) => d >= inicio && d <= opcoes.hoje;

  const acc = new Map<string, Acumulado>();
  function registrar(
    chave: string, destino: DestinoFrequente, rotulo: string, data: ISODate, valorCent: number,
  ) {
    const atual = acc.get(chave);
    if (!atual) {
      acc.set(chave, { chave, destino, rotulo, valorCent, usos: 1, ultimaData: data });
      return;
    }
    atual.usos += 1;
    // empate de data: vence quem aparece por último no array — arbitrário, mas estável
    if (data >= atual.ultimaData) { atual.ultimaData = data; atual.valorCent = valorCent; }
  }

  if (opcoes.boxId != null) {
    const cats = new Map(
      dados.categorias
        .filter((c) => c.boxId === opcoes.boxId && !c.arquivada)
        .map((c) => [c.id, c] as const),
    );
    for (const l of dados.lancamentos) {
      if (l.origem !== 'manual' || l.cenarioId) continue;
      if (l.boxId !== opcoes.boxId || !dentro(l.data)) continue;
      const cat = cats.get(l.categoriaId);
      if (!cat) continue;
      registrar(`box:${cat.id}`, { tipo: 'box', categoriaId: cat.id }, cat.nome, l.data, l.valor);
    }
  }

  const permitidos = new Set(
    dados.cartoes.filter((c) => c.ativo && opcoes.cartaoIds.includes(c.id)).map((c) => c.id),
  );
  const reservadas = categoriasCartaoReservadasIds(dados.cartoes);
  const catsCartao = new Map(
    dados.categoriasCartao
      .filter((c) => !c.arquivada && !reservadas.has(c.id))
      .map((c) => [c.id, c] as const),
  );
  for (const co of dados.comprasCartao) {
    if (co.recorrenciaCartaoId) continue;
    if (!permitidos.has(co.cartaoId) || !dentro(co.data)) continue;
    const cat = catsCartao.get(co.categoriaCartaoId);
    if (!cat || cat.cartaoId !== co.cartaoId) continue;
    registrar(
      `cartao:${co.cartaoId}:${cat.id}`,
      { tipo: 'cartao', cartaoId: co.cartaoId, categoriaCartaoId: cat.id },
      cat.nome, co.data, co.valorTotal,
    );
  }

  return [...acc.values()]
    .sort((a, b) => (
      b.usos - a.usos
      || (a.ultimaData < b.ultimaData ? 1 : a.ultimaData > b.ultimaData ? -1 : 0)
      || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0)
    ))
    .slice(0, limite)
    .map(({ chave, destino, rotulo, valorCent, usos }) => ({ chave, destino, rotulo, valorCent, usos }));
}
