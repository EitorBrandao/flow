import { formatarBRL, parseValorDigitado } from './money';

describe('formatarBRL', () => {
  it('formata centavos como moeda pt-BR', () => {
    // toLocaleString pt-BR usa espaço não separável (U+00A0) após R$
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
    expect(formatarBRL(0)).toBe('R$ 0,00');
    expect(formatarBRL(-9100)).toBe('-R$ 91,00');
  });
});

describe('parseValorDigitado', () => {
  it('aceita vírgula decimal pt-BR', () => {
    expect(parseValorDigitado('12,34')).toBe(1234);
    expect(parseValorDigitado('1.234,56')).toBe(123456);
  });
  it('aceita ponto decimal', () => {
    expect(parseValorDigitado('1234.56')).toBe(123456);
  });
  it('inteiro vira reais', () => {
    expect(parseValorDigitado('1234')).toBe(123400);
  });
  it('rejeita vazio, não numérico, zero e negativo', () => {
    expect(parseValorDigitado('')).toBeNull();
    expect(parseValorDigitado('abc')).toBeNull();
    expect(parseValorDigitado('0')).toBeNull();
    expect(parseValorDigitado('-5')).toBeNull();
  });
  it('com permitirZero, aceita zero mas continua rejeitando negativo', () => {
    expect(parseValorDigitado('0', { permitirZero: true })).toBe(0);
    expect(parseValorDigitado('0,00', { permitirZero: true })).toBe(0);
    expect(parseValorDigitado('-5', { permitirZero: true })).toBeNull();
  });
});
