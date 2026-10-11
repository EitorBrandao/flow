import type { Fatura } from './fatura';
import { textoBate, valorBate } from './buscaTexto';

/**
 * Se uma compra da fatura casa com o termo de busca: descrição, categoria do cartão, data
 * (`dd/mm/aaaa`) ou valor. É a única regra: o Cartão, o Fluxo e a folha da fatura usam esta.
 * `termo` já vem sem espaços nas pontas e normalizado (`normalizarBusca`); termo vazio não
 * casa com nada.
 */
export function itemFaturaBate(
  item: Fatura['itens'][number], termo: string, nomeCat: (categoriaCartaoId: string) => string,
): boolean {
  if (termo === '') return false;
  if (textoBate(item.descricao, termo)) return true;
  if (textoBate(nomeCat(item.categoriaCartaoId), termo)) return true;
  if (item.data.split('-').reverse().join('/').includes(termo)) return true;
  return valorBate(item.valorCent, termo);
}
