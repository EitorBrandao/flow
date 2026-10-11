import { formatarBRL } from './money';
import type { Fatura } from './fatura';

/**
 * Se uma compra da fatura casa com o termo de busca: descrição, categoria do cartão, data
 * (`dd/mm/aaaa`) ou valor. É a única regra: o Cartão, o Fluxo e a folha da fatura usam esta.
 * `termo` já vem sem espaços nas pontas e em minúsculas; termo vazio não casa com nada.
 */
export function itemFaturaBate(
  item: Fatura['itens'][number], termo: string, nomeCat: (categoriaCartaoId: string) => string,
): boolean {
  if (termo === '') return false;
  if (item.descricao && item.descricao.toLowerCase().includes(termo)) return true;
  if (nomeCat(item.categoriaCartaoId).toLowerCase().includes(termo)) return true;
  if (item.data.split('-').reverse().join('/').includes(termo)) return true;
  return formatarBRL(item.valorCent).toLowerCase().includes(termo);
}
