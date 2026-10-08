import { describe, expect, it } from 'vitest';
import { compraRepetida, lancamentoRepetido } from './lancamentoRepetido';
import type { CompraCartao, Lancamento } from './types';

const lanc = (extra: Partial<Lancamento> = {}): Lancamento => ({
  id: 'l1', boxId: 'b1', categoriaId: 'gasto1', data: '2026-10-08', valor: 4500,
  status: 'efetivo', origem: 'manual', criadoEm: 't', alteradoEm: 't', ...extra,
});
const candidato = { boxId: 'b1', data: '2026-10-08', valor: 4500, categoriaId: 'gasto1' };

describe('lancamentoRepetido', () => {
  it('acha o lançamento igual', () => {
    const l = lanc();
    expect(lancamentoRepetido([l], candidato)).toBe(l);
  });
  it('lista vazia não repete', () => {
    expect(lancamentoRepetido([], candidato)).toBeNull();
  });
  it('valor, data ou box diferentes não repetem', () => {
    expect(lancamentoRepetido([lanc({ valor: 4501 })], candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ data: '2026-10-09' })], candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ boxId: 'b2' })], candidato)).toBeNull();
  });
  it('categoria diferente não repete, mesmo com o mesmo tipo', () => {
    const outra = lanc({ categoriaId: 'gasto2' });
    expect(lancamentoRepetido([outra], candidato)).toBeNull();
    expect(lancamentoRepetido([outra], { ...candidato, categoriaId: 'gasto2' })).toBe(outra);
  });
  it('tipo diferente também não repete', () => {
    expect(lancamentoRepetido([lanc({ categoriaId: 'ganho1' })], candidato)).toBeNull();
  });
  it('previsto manual e de recorrência contam', () => {
    const prev = lanc({ status: 'previsto' });
    const rec = lanc({ id: 'l2', status: 'previsto', origem: 'recorrencia' });
    expect(lancamentoRepetido([prev], candidato)).toBe(prev);
    expect(lancamentoRepetido([rec], candidato)).toBe(rec);
  });
  it('cartão, transferência e cenário não contam', () => {
    expect(lancamentoRepetido([lanc({ origem: 'cartao' })], candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ origem: 'transferencia' })], candidato)).toBeNull();
    expect(lancamentoRepetido([lanc({ cenarioId: 'c1' })], candidato)).toBeNull();
  });
});

describe('compraRepetida', () => {
  const compra = (extra: Partial<CompraCartao> = {}): CompraCartao => ({
    id: 'k1', cartaoId: 'c1', categoriaCartaoId: 'cc1', data: '2026-10-08', valorTotal: 30000,
    parcelas: 3, criadoEm: 't', alteradoEm: 't', ...extra,
  });
  const cand = { cartaoId: 'c1', data: '2026-10-08', valorTotal: 30000, parcelas: 3, categoriaCartaoId: 'cc1' };

  it('acha a compra igual', () => {
    const k = compra();
    expect(compraRepetida([k], cand)).toBe(k);
  });
  it('lista vazia não repete', () => {
    expect(compraRepetida([], cand)).toBeNull();
  });
  it('cartão, data, valor ou parcelas diferentes não repetem', () => {
    expect(compraRepetida([compra({ cartaoId: 'c2' })], cand)).toBeNull();
    expect(compraRepetida([compra({ data: '2026-10-09' })], cand)).toBeNull();
    expect(compraRepetida([compra({ valorTotal: 30001 })], cand)).toBeNull();
    expect(compraRepetida([compra({ parcelas: 1 })], cand)).toBeNull();
  });
  it('categoria do cartão diferente não repete', () => {
    expect(compraRepetida([compra({ categoriaCartaoId: 'cc2' })], cand)).toBeNull();
  });
  it('compra de assinatura também conta', () => {
    const k = compra({ recorrenciaCartaoId: 'r1' });
    expect(compraRepetida([k], cand)).toBe(k);
  });
});
