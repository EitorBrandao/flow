import { describe, expect, it } from 'vitest';
import { parsearDataExtrato, parsearValorExtrato } from './valores';

describe('parsearValorExtrato', () => {
  it('lê o formato internacional do CSV do Nubank', () => {
    expect(parsearValorExtrato('1234.56')).toBe(123456);
    expect(parsearValorExtrato('-1234.56')).toBe(-123456);
    expect(parsearValorExtrato('45.00')).toBe(4500);
  });

  it('lê o formato brasileiro da fatura do Santander', () => {
    expect(parsearValorExtrato('1.234,56')).toBe(123456);
    expect(parsearValorExtrato('-1.234,56')).toBe(-123456);
    expect(parsearValorExtrato('123,45')).toBe(12345);
  });

  it('aceita R$ e espaço não separável', () => {
    expect(parsearValorExtrato('R$ 1.234,56')).toBe(123456);
    expect(parsearValorExtrato('R$ 1.234,56')).toBe(123456);
  });

  // Mesmo risco que `parsearCentavosDecimal` documenta em src/domain/money.ts: valor absurdo
  // viraria Infinity, e JSON.stringify(Infinity) é null — o backup voltaria quebrado.
  it('recusa valor grande demais para um inteiro seguro', () => {
    expect(parsearValorExtrato('99999999999999999999,99')).toBeUndefined();
    expect(parsearValorExtrato('-99999999999999999999,99')).toBeUndefined();
  });

  // A regra do finance.py lê "1.234" como um inteiro e duzentos e trinta e quatro milésimos.
  // Ponto seguido de exatamente três dígitos, sem vírgula na string, é separador de milhar.
  it('trata ponto de milhar sem centavos como milhar', () => {
    expect(parsearValorExtrato('1.234')).toBe(123400);
  });

  it('devolve undefined em vez de lançar', () => {
    expect(parsearValorExtrato('')).toBeUndefined();
    expect(parsearValorExtrato('-')).toBeUndefined();
    expect(parsearValorExtrato('abc')).toBeUndefined();
  });
});

describe('parsearDataExtrato', () => {
  it('lê os quatro formatos previstos', () => {
    expect(parsearDataExtrato('2026-08-15')).toBe('2026-08-15');
    expect(parsearDataExtrato('15/08/2026')).toBe('2026-08-15');
    expect(parsearDataExtrato('15/08/26')).toBe('2026-08-15');
    expect(parsearDataExtrato('20260815')).toBe('2026-08-15');
  });

  it('devolve undefined em vez de lançar', () => {
    expect(parsearDataExtrato('32/13/2026')).toBeUndefined();
    expect(parsearDataExtrato('bla')).toBeUndefined();
  });
});
