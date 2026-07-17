export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Acrescenta um dígito (0-9) ao fim do buffer de centavos, empurrando os existentes à esquerda. */
export function empurrarDigito(centavos: number, digito: string): number {
  return centavos * 10 + Number(digito);
}

/** Remove o último dígito do buffer de centavos. */
export function apagarUltimoDigito(centavos: number): number {
  return Math.floor(centavos / 10);
}

/** Extrai só os dígitos de um texto (ex. colado) e converte em centavos. */
export function digitosParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  return digitos === '' ? 0 : Number(digitos);
}
