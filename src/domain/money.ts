export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte texto digitado ("12,34" | "1.234,56" | "1234.56" | "1234") em centavos. */
export function parseValorDigitado(texto: string): number | null {
  const t = texto.trim();
  if (!/^[\d.,]+$/.test(t)) return null;
  const normalizado = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const v = Number(normalizado);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}
