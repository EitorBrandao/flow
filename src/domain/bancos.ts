import type { Banco, ID } from './types';

/** Bancos das boxes pedidas, na ordem canônica de Ajustes (mesma disciplina das
 *  categorias de cartão: `ordem` decide, `nome` desempata). */
export function bancosDaBox(bancos: Banco[], boxIds: readonly ID[]): Banco[] {
  return bancos
    .filter((b) => boxIds.includes(b.boxId))
    .sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.nome.localeCompare(b.nome)));
}

/** Soma dos saldos informados, ignorando os que não foram informados. Devolve `null`
 *  quando NENHUM banco tem valor — "informou zero" e "não informou" são coisas
 *  diferentes, e confundi-las faz a tela acusar uma diferença inexistente. */
export function totalDeclaradoCent(bancos: Banco[]): number | null {
  const informados = bancos.filter((b) => b.saldoDeclaradoCent != null);
  if (informados.length === 0) return null;
  return informados.reduce((s, b) => s + b.saldoDeclaradoCent!, 0);
}
