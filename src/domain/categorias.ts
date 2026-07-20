import type { Categoria, CategoriaCartao, ID } from './types';

// Ordem canônica definida pelo usuário em Ajustes: ganhos antes de gastos, arquivadas
// sempre por último (grupo à parte, misturando os dois tipos); dentro do grupo, `ordem`
// decide e `nome` desempata — existem `ordem` duplicadas na prática (ex.: categoria de
// fatura nasce com ordem 0) e a ordem vinda do banco é arbitrária.
function grupoCategoria(c: Categoria): number {
  if (c.arquivada) return 2;
  return c.tipo === 'ganho' ? 0 : 1;
}

export function compararCategorias(a: Categoria, b: Categoria): number {
  const grupoA = grupoCategoria(a);
  const grupoB = grupoCategoria(b);
  if (grupoA !== grupoB) return grupoA - grupoB;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

export function compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number {
  if (a.arquivada !== b.arquivada) return a.arquivada ? 1 : -1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

interface ComOrdem { id: ID; ordem: number }

// Depois de um arraste, o índice 0-based de cada item na nova ordem vira o novo `ordem` a
// persistir; só devolve os que realmente mudaram, pra não escrever no banco à toa.
export function diffOrdem<T extends ComOrdem>(novaOrdem: readonly T[]): Array<{ id: ID; ordem: number }> {
  return novaOrdem
    .map((item, ordem) => ({ id: item.id, ordem }))
    .filter((item, i) => item.ordem !== novaOrdem[i].ordem);
}

// Próxima posição livre no fim de um grupo — usado tanto ao criar uma categoria quanto ao
// mover uma categoria pra outro grupo (arquivar/restaurar).
export function proximaOrdem(itensDoGrupo: readonly { ordem: number }[]): number {
  return Math.max(-1, ...itensDoGrupo.map((c) => c.ordem)) + 1;
}
