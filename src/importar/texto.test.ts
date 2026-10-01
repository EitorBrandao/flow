import { describe, expect, it } from 'vitest';
import { corrigirUtf8Duplo } from './texto';

describe('corrigirUtf8Duplo', () => {
  it('não muda texto sem o defeito', () => {
    expect(corrigirUtf8Duplo('Pix no Cr\u00e9dito - Loja Gama')).toBe('Pix no Cr\u00e9dito - Loja Gama');
    expect(corrigirUtf8Duplo('Mercado Alfa')).toBe('Mercado Alfa');
  });

  it('corrige o UTF-8 duplo', () => {
    expect(corrigirUtf8Duplo('Pix no Cr\u00c3\u00a9dito')).toBe('Pix no Cr\u00e9dito');
    expect(corrigirUtf8Duplo('Servi\u00c3\u00a7o \u00c3\u00a0 vista')).toBe('Servi\u00e7o \u00e0 vista');
  });

  it('devolve o original quando há caractere acima de U+00FF', () => {
    const t = 'Cr\u00c3\u00a9dito \u2014 Loja';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });

  it('devolve o original quando os bytes não formam UTF-8 válido', () => {
    // "Ã" seguido de "\u0080" e depois "Ã" sozinho no fim: o segundo é sequência truncada.
    const t = '\u00c3\u0080 e \u00c3';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });
});
