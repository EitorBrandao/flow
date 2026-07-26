import { describe, it, expect } from 'vitest';
import { CATEGORIAS_SUGERIDAS } from './categoriasSugeridas';

describe('categoriasSugeridas', () => {
  it('tem nome único dentro de cada tipo', () => {
    const porTipo = new Map<string, Set<string>>();
    for (const cat of CATEGORIAS_SUGERIDAS) {
      if (!porTipo.has(cat.tipo)) {
        porTipo.set(cat.tipo, new Set());
      }
      const nomes = porTipo.get(cat.tipo)!;
      expect(nomes.has(cat.nome)).toBe(false);
      nomes.add(cat.nome);
    }
  });

  it('existe ao menos uma de cada tipo', () => {
    const tipos = new Set(CATEGORIAS_SUGERIDAS.map((c) => c.tipo));
    expect(tipos.has('ganho')).toBe(true);
    expect(tipos.has('gasto')).toBe(true);
  });

  it('tem exatamente 7 marcadas por padrão', () => {
    const marcadas = CATEGORIAS_SUGERIDAS.filter((c) => c.marcadaPorPadrao);
    expect(marcadas.length).toBe(7);
  });
});
