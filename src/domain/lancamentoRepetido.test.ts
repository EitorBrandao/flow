import { describe, expect, it } from 'vitest';
import { lancamentoRepetido } from './lancamentoRepetido';
import type { Categoria, Lancamento } from './types';

const cat = (id: string, tipo: Categoria['tipo']): Categoria => ({
  id, boxId: 'b1', nome: id, tipo, ordem: 1, arquivada: false, criadoEm: 't', alteradoEm: 't',
});
const categorias = [cat('gasto1', 'gasto'), cat('ganho1', 'ganho')];

const lanc = (extra: Partial<Lancamento> = {}): Lancamento => ({
  id: 'l1', boxId: 'b1', categoriaId: 'gasto1', data: '2026-10-08', valor: 4500,
  status: 'efetivo', origem: 'manual', criadoEm: 't', alteradoEm: 't', ...extra,
});
const candidato = { boxId: 'b1', data: '2026-10-08', valor: 4500, tipo: 'gasto' as const };

describe('lancamentoRepetido', () => {
  it('acha o lançamento igual', () => {
    const l = lanc();
    expect(lancamentoRepetido([l], categorias, candidato)).toBe(l);
  });
  it('lista vazia não repete', () => {
    expect(lancamentoRepetido([], categorias, candidato)).toBeNull();
  });
  it('valor, data ou box diferentes não repetem', () => {
    expect(lancamentoRepetido([lanc({ valor: 4501 })], categorias, candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ data: '2026-10-09' })], categorias, candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ boxId: 'b2' })], categorias, candidato)).toBeNull();
  });
  it('tipo diferente não repete', () => {
    const ganho = lanc({ categoriaId: 'ganho1' });
    expect(lancamentoRepetido([ganho], categorias, candidato)).toBeNull();
    expect(lancamentoRepetido([ganho], categorias, { ...candidato, tipo: 'ganho' })).toBe(ganho);
  });
  it('previsto manual e de recorrência contam', () => {
    const prev = lanc({ status: 'previsto' });
    const rec = lanc({ id: 'l2', status: 'previsto', origem: 'recorrencia' });
    expect(lancamentoRepetido([prev], categorias, candidato)).toBe(prev);
    expect(lancamentoRepetido([rec], categorias, candidato)).toBe(rec);
  });
  it('cartão, transferência e cenário não contam', () => {
    expect(lancamentoRepetido([lanc({ origem: 'cartao' })], categorias, candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ origem: 'transferencia' })], categorias, candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ cenarioId: 'c1' })], categorias, candidato)).toBeNull();
  });
  it('categoria desconhecida não repete', () => {
    expect(lancamentoRepetido([lanc({ categoriaId: 'sumiu' })], categorias, candidato)).toBeNull();
  });
});
