import { describe, expect, it } from 'vitest';
import { corrigirUtf8Duplo } from './texto';

describe('corrigirUtf8Duplo', () => {
  it('não muda texto sem o defeito', () => {
    expect(corrigirUtf8Duplo('Pix no Crédito - Loja Gama')).toBe('Pix no Crédito - Loja Gama');
    expect(corrigirUtf8Duplo('Mercado Alfa')).toBe('Mercado Alfa');
  });

  it('corrige o UTF-8 duplo', () => {
    expect(corrigirUtf8Duplo('Pix no Crédito')).toBe('Pix no Crédito');
    expect(corrigirUtf8Duplo('Serviço à vista')).toBe('Serviço à vista');
  });

  it('devolve o original quando há caractere acima de U+00FF', () => {
    const t = 'Crédito — Loja';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });

  it('devolve o original quando os bytes não formam UTF-8 válido', () => {
    // "Ã" seguido de "\u0080" e depois "Ã" sozinho no fim: o segundo é sequência truncada.
    const t = 'Ã\u0080 e Ã';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });
});
