// scripts/varredura/comparar.test.mjs
import { describe, it, expect } from 'vitest';
import { chaveDoAchado, comparar } from './comparar.mjs';

const a = (passo, tipo, alvo) => ({ passo, tipo, alvo, detalhe: '' });

describe('varredura: comparar', () => {
  it('a chave ignora dígitos do alvo, que mudam com a data', () => {
    expect(chaveDoAchado(a('hoje', 'alvo', 'button.pill "Pendentes · 4"')))
      .toBe(chaveDoAchado(a('hoje', 'alvo', 'button.pill "Pendentes · 12"')));
  });

  it('a chave separa passos e tipos diferentes', () => {
    expect(chaveDoAchado(a('hoje', 'alvo', 'x'))).not.toBe(chaveDoAchado(a('fluxo', 'alvo', 'x')));
    expect(chaveDoAchado(a('hoje', 'alvo', 'x'))).not.toBe(chaveDoAchado(a('hoje', 'estouro', 'x')));
  });

  it('achado fora dos conhecidos é novo', () => {
    const r = comparar([a('hoje', 'alvo', 'x'), a('hoje', 'alvo', 'y')], [chaveDoAchado(a('hoje', 'alvo', 'x'))]);
    expect(r.novos.map((n) => n.alvo)).toEqual(['y']);
    expect(r.resolvidos).toEqual([]);
  });

  it('conhecido que não apareceu é resolvido', () => {
    const sumiu = chaveDoAchado(a('hoje', 'alvo', 'x'));
    expect(comparar([], [sumiu]).resolvidos).toEqual([sumiu]);
  });

  it('o mesmo achado duas vezes conta uma vez só', () => {
    expect(comparar([a('hoje', 'alvo', 'x'), a('hoje', 'alvo', 'x')], []).novos).toHaveLength(1);
  });

  it('listas vazias devolvem listas vazias', () => {
    expect(comparar([], [])).toEqual({ novos: [], resolvidos: [] });
  });
});
