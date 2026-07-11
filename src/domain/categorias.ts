import type { Categoria, CategoriaCartao } from './types';

// Ordem canônica definida pelo usuário em Ajustes: ganhos antes de gastos,
// depois `ordem`; nome desempata porque existem `ordem` duplicadas
// (ex.: categoria de fatura nasce com ordem 0) e a ordem do banco é arbitrária.
export function compararCategorias(a: Categoria, b: Categoria): number {
  if (a.tipo !== b.tipo) return a.tipo === 'ganho' ? -1 : 1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

export function compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number {
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}
