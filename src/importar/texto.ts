/** Sinal de UTF-8 decodificado duas vezes: "Ã" ou "Â" seguidos de um caractere de
 *  continuação (U+0080 a U+00BF). É como "é" vira "Ã©". */
const UTF8_DUPLO = /[ÂÃ][\u0080-¿]/;

/**
 * Desfaz o UTF-8 duplo: cada caractere vira um byte, e os bytes são lidos de novo como UTF-8.
 * O CSV da fatura do Nubank chegou assim duas vezes, e a origem do defeito é incerta.
 *
 * Nunca lança. Texto sem o sinal, com caractere acima de U+00FF (não pode ter vindo de bytes)
 * ou com bytes que não formam UTF-8 válido volta sem mudança.
 */
export function corrigirUtf8Duplo(texto: string): string {
  if (!UTF8_DUPLO.test(texto)) return texto;
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c > 0xff) return texto;
    bytes[i] = c;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return texto;
  }
}
