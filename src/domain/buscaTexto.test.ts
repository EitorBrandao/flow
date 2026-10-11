import { describe, expect, it } from 'vitest';
import { normalizarBusca, textoBate, valorBate } from './buscaTexto';

describe('normalizarBusca', () => {
  it('tira acento e maiúscula', () => {
    expect(normalizarBusca('Café Ação')).toBe('cafe acao');
  });
});

describe('textoBate', () => {
  it('acha com ou sem acento, nos dois sentidos', () => {
    expect(textoBate('Café da manhã', 'cafe')).toBe(true);
    expect(textoBate('Cafe', normalizarBusca('CAFÉ'))).toBe(true);
  });
  it('termo vazio ou texto ausente não casa', () => {
    expect(textoBate('Café', '')).toBe(false);
    expect(textoBate(undefined, 'cafe')).toBe(false);
  });
});

describe('valorBate', () => {
  it('acha o valor sem o ponto de milhar', () => {
    expect(valorBate(123456, '1234')).toBe(true);
    expect(valorBate(123456, '1234,56')).toBe(true);
  });
  it('continua achando com o ponto', () => {
    expect(valorBate(123456, '1.234')).toBe(true);
  });
  it('não acha valor diferente nem termo vazio', () => {
    expect(valorBate(123456, '1235')).toBe(false);
    expect(valorBate(123456, '')).toBe(false);
  });
});
