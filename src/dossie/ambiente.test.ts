import { hojeISO } from '../domain/dates';
import { agoraISO, novoId } from '../domain/types';
import { instalarAmbiente } from './ambiente';

it('sequencia os ids em ordem lexicográfica', () => {
  const amb = instalarAmbiente('2026-01-01');
  try {
    expect(novoId()).toBe('id-0001');
    expect(novoId()).toBe('id-0002');
    expect(novoId()).toBe('id-0003');
  } finally {
    amb.restaurar();
  }
});

it('congela o relógio na data inicial', () => {
  const amb = instalarAmbiente('2026-03-15');
  try {
    expect(hojeISO()).toBe('2026-03-15');
    expect(agoraISO()).toBe('2026-03-15T12:00:00.000Z');
  } finally {
    amb.restaurar();
  }
});

it('avança o relógio sem reiniciar o contador de ids', () => {
  const amb = instalarAmbiente('2026-01-01');
  try {
    expect(novoId()).toBe('id-0001');
    amb.avancarPara('2026-06-30');
    expect(hojeISO()).toBe('2026-06-30');
    expect(novoId()).toBe('id-0002');
  } finally {
    amb.restaurar();
  }
});

it('restaurar devolve o relógio e o gerador de id reais', () => {
  const amb = instalarAmbiente('2026-01-01');
  amb.restaurar();
  expect(novoId()).not.toBe('id-0002');
  expect(novoId()).toMatch(/^[0-9a-f]{8}-/);
});

it('recusa avançar para trás', () => {
  const amb = instalarAmbiente('2026-06-01');
  try {
    expect(() => amb.avancarPara('2026-05-31')).toThrow(/para trás/);
  } finally {
    amb.restaurar();
  }
});
