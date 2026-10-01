import { describe, expect, it } from 'vitest';
import { cenarioDaVisao, escopoDoCenario } from './cenarios';
import { cenariosLigados } from '../state/store';
import type { Cenario, Dados } from './types';

function cenario(id: string, extra: Partial<Cenario> = {}): Cenario {
  return { id, nome: id, ligado: true, criadoEm: '2026-01-01T00:00:00.000Z', alteradoEm: '2026-01-01T00:00:00.000Z', ...extra };
}

describe('escopoDoCenario', () => {
  it('cenário sem escopo é da casa', () => {
    expect(escopoDoCenario(cenario('c1'))).toBe('casa');
  });
  it('cenário com escopo devolve o escopo', () => {
    expect(escopoDoCenario(cenario('c1', { escopo: 'b-ana' }))).toBe('b-ana');
  });
});

describe('cenarioDaVisao', () => {
  it('cenário sem escopo só existe na casa', () => {
    const c = cenario('c1');
    expect(cenarioDaVisao(c, 'casa')).toBe(true);
    expect(cenarioDaVisao(c, 'b-ana')).toBe(false);
  });
  it('cenário de uma box só existe nessa box', () => {
    const c = cenario('c1', { escopo: 'b-ana' });
    expect(cenarioDaVisao(c, 'b-ana')).toBe(true);
    expect(cenarioDaVisao(c, 'casa')).toBe(false);
    expect(cenarioDaVisao(c, 'b-bruno')).toBe(false);
  });
  it('cenário com escopo "casa" existe na casa', () => {
    expect(cenarioDaVisao(cenario('c1', { escopo: 'casa' }), 'casa')).toBe(true);
  });
});

describe('cenariosLigados por visão', () => {
  const dados = {
    cenarios: [
      cenario('da-casa'),
      cenario('de-ana', { escopo: 'b-ana' }),
      cenario('de-bruno', { escopo: 'b-bruno' }),
      cenario('casa-desligado', { escopo: 'casa', ligado: false }),
      cenario('ana-desligado', { escopo: 'b-ana', ligado: false }),
    ],
  } as unknown as Dados;

  it('na casa, só o cenário ligado da casa', () => {
    expect([...cenariosLigados(dados, 'casa')]).toEqual(['da-casa']);
  });
  it('numa box, só o cenário ligado dela', () => {
    expect([...cenariosLigados(dados, 'b-ana')]).toEqual(['de-ana']);
    expect([...cenariosLigados(dados, 'b-bruno')]).toEqual(['de-bruno']);
  });
  it('visão sem cenários devolve vazio', () => {
    expect(cenariosLigados(dados, 'b-outra').size).toBe(0);
  });
});
