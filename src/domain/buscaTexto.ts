import { formatarBRL } from './money';

/**
 * Regras de texto da busca, comuns ao Fluxo e ao Cartão: sem diferença de maiúscula nem de
 * acento ("cafe" acha "Café") e valor achado com ou sem ponto de milhar ("1234" acha 1.234,56).
 */

/** Minúsculas, sem acento e com espaço comum no lugar do espaço sem quebra da moeda. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ /g, ' ')
    .toLowerCase();
}

/** Se `termo` (já normalizado) aparece em `texto`. Termo vazio não casa com nada. */
export function textoBate(texto: string | undefined, termo: string): boolean {
  return termo !== '' && !!texto && normalizarBusca(texto).includes(termo);
}

/** Valor casa com o termo, escrito com ou sem o ponto de milhar. */
export function valorBate(centavos: number, termo: string): boolean {
  if (termo === '') return false;
  const completo = normalizarBusca(formatarBRL(centavos));
  return completo.includes(termo) || completo.replace(/\./g, '').includes(termo);
}
