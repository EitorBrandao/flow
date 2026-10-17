import type { CategoriaCartao, CnpjCategoria, ID } from './types';

/** Só os dígitos de um CNPJ, ou `undefined` se não tiver 14 ou se os dígitos verificadores
 *  não fecharem. O OCR erra dígitos: a verificação evita aprender uma categoria para um CNPJ
 *  que não existe. */
export function normalizarCnpj(texto: string): string | undefined {
  const d = texto.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return undefined;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((s, c, i) => s + Number(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`) ? d : undefined;
}

/** Primeiro CNPJ válido do texto de um comprovante (com ou sem pontuação). */
export function extrairCnpj(texto: string): string | undefined {
  for (const m of texto.matchAll(/\d{2}\s*\.?\s*\d{3}\s*\.?\s*\d{3}\s*\/?\s*\d{4}\s*-?\s*\d{2}/g)) {
    const cnpj = normalizarCnpj(m[0]);
    if (cnpj) return cnpj;
  }
  return undefined;
}

/** Os 8 primeiros dígitos identificam a empresa; filial e matriz compartilham a raiz. */
export function raizCnpj(cnpj: string): string {
  return cnpj.slice(0, 8);
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Categoria do cartão que o CNPJ aprendido aponta. As categorias do cartão são por cartão:
 *  vale o id quando ele pertence ao cartão e, senão, uma categoria de mesmo nome. Arquivada
 *  nunca é sugerida. */
export function categoriaPorCnpj(
  aprendidos: CnpjCategoria[], cnpj: string | undefined, categorias: CategoriaCartao[], cartaoId: ID,
): ID | undefined {
  if (!cnpj) return undefined;
  const raiz = raizCnpj(cnpj);
  const achado = aprendidos.filter((a) => a.raiz === raiz)
    .sort((a, b) => b.alteradoEm.localeCompare(a.alteradoEm))[0];
  if (!achado) return undefined;
  const doCartao = categorias.filter((c) => c.cartaoId === cartaoId && !c.arquivada);
  return (doCartao.find((c) => c.id === achado.categoriaCartaoId)
    ?? doCartao.find((c) => semAcento(c.nome) === semAcento(achado.categoriaNome)))?.id;
}

/** Uma raiz de CNPJ, uma categoria: o índice do Dexie é não-único, então todo caminho que grava
 *  o snapshot inteiro (importar, mesclar) passa por aqui. Vence o `alteradoEm` mais recente;
 *  empate desempata pelo id. */
export function dedupCnpjsCategoria(itens: CnpjCategoria[]): CnpjCategoria[] {
  const porRaiz = new Map<string, CnpjCategoria>();
  for (const i of itens) {
    const atual = porRaiz.get(i.raiz);
    if (!atual || i.alteradoEm > atual.alteradoEm || (i.alteradoEm === atual.alteradoEm && i.id > atual.id)) {
      porRaiz.set(i.raiz, i);
    }
  }
  return [...porRaiz.values()];
}
