import { formatarBRL, formatarSobraCompacta, empurrarDigito, apagarUltimoDigito, digitosParaCentavos } from './money';

describe('formatarBRL', () => {
  it('formata centavos como moeda pt-BR', () => {
    // toLocaleString pt-BR usa espaço não separável (U+00A0) após R$
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
    expect(formatarBRL(0)).toBe('R$ 0,00');
    expect(formatarBRL(-9100)).toBe('-R$ 91,00');
  });
});

describe('empurrarDigito', () => {
  it('acrescenta dígito único ao buffer vazio', () => {
    expect(empurrarDigito(0, '1')).toBe(1);
    expect(empurrarDigito(0, '5')).toBe(5);
  });
  it('encadeia dígitos (0 → 1 → 12)', () => {
    expect(empurrarDigito(empurrarDigito(0, '1'), '2')).toBe(12);
  });
  it('encadeia a partir de valor não-zero', () => {
    expect(empurrarDigito(12, '3')).toBe(123);
    expect(empurrarDigito(99, '0')).toBe(990);
  });
});

describe('apagarUltimoDigito', () => {
  it('remove o último dígito de um valor', () => {
    expect(apagarUltimoDigito(12)).toBe(1);
    expect(apagarUltimoDigito(1)).toBe(0);
  });
  it('desce de vários dígitos até 0', () => {
    expect(apagarUltimoDigito(1234)).toBe(123);
    expect(apagarUltimoDigito(123)).toBe(12);
    expect(apagarUltimoDigito(12)).toBe(1);
    expect(apagarUltimoDigito(1)).toBe(0);
  });
  it('não fica negativo em zero', () => {
    expect(apagarUltimoDigito(0)).toBe(0);
  });
});

describe('digitosParaCentavos', () => {
  it('extrai dígitos de "R$ 12,34"', () => {
    expect(digitosParaCentavos('R$ 12,34')).toBe(1234);
  });
  it('converte "1234" em 1234', () => {
    expect(digitosParaCentavos('1234')).toBe(1234);
  });
  it('retorna 0 para texto vazio', () => {
    expect(digitosParaCentavos('')).toBe(0);
  });
  it('retorna 0 para texto sem dígitos', () => {
    expect(digitosParaCentavos('abc')).toBe(0);
  });
  it('extrai dígitos de texto formatado com pontos e vírgulas', () => {
    expect(digitosParaCentavos('R$ 1.234,56')).toBe(123456);
  });
});

describe('formatarSobraCompacta', () => {
  it('formata positivo com sinal + e sem casas decimais', () => {
    expect(formatarSobraCompacta(187000)).toBe('+1.870');
  });
  it('formata negativo com sinal − (menos Unicode) e valor absoluto', () => {
    expect(formatarSobraCompacta(-41000)).toBe('−410');
  });
  it('arredonda centavos ao real mais próximo', () => {
    expect(formatarSobraCompacta(93050)).toBe('+931'); // 930,50 arredonda pra 931
  });
  it('zero é positivo (sinal +)', () => {
    expect(formatarSobraCompacta(0)).toBe('+0');
  });
});
