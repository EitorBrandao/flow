import { describe, expect, it } from 'vitest';
import { aplicarTrocasDeBox, casaQueFica, trocasDaCasa } from './casas';
import type { Box, Dados } from './types';

const box = (id: string, nome: string, criadoEm = '2026-01-01T10:00:00Z'): Box =>
  ({ id, nome, saldoInicial: null, dataSaldoInicial: null, criadoEm, alteradoEm: criadoEm });

describe('casaQueFica', () => {
  it('sem casa, não há o que manter', () => {
    expect(casaQueFica([box('b1', 'ana')])).toBeUndefined();
  });
  it('com uma casa, é ela', () => {
    expect(casaQueFica([box('b1', 'ana'), box('c1', 'casa')])?.id).toBe('c1');
  });
  it('com várias, fica a criada primeiro', () => {
    const boxes = [box('c2', 'casa', '2026-03-01T00:00:00Z'), box('c1', 'casa', '2026-02-01T00:00:00Z'), box('c3', 'casa', '2026-04-01T00:00:00Z')];
    expect(casaQueFica(boxes)?.id).toBe('c1');
  });
  it('em empate de criação, desempata pelo id, sem depender da ordem da lista', () => {
    const a = [box('cb', 'casa'), box('ca', 'casa')];
    const b = [box('ca', 'casa'), box('cb', 'casa')];
    expect(casaQueFica(a)?.id).toBe('ca');
    expect(casaQueFica(b)?.id).toBe('ca');
  });
  it('só vale o nome exato "casa"', () => {
    expect(casaQueFica([box('x', 'Casa'), box('y', 'casa ')])).toBeUndefined();
  });
});

describe('trocasDaCasa', () => {
  it('leva cada outra casa para a que fica', () => {
    const t = trocasDaCasa([box('c1', 'casa'), box('c2', 'casa'), box('c3', 'casa'), box('b1', 'ana')], 'c1');
    expect([...t.entries()].sort()).toEqual([['c2', 'c1'], ['c3', 'c1']]);
  });
  it('a casa de destino não troca consigo mesma, e box de outro nome fica de fora', () => {
    expect(trocasDaCasa([box('c1', 'casa'), box('b1', 'ana')], 'c1').size).toBe(0);
  });
});

describe('aplicarTrocasDeBox', () => {
  const vazio = (boxes: Box[]): Dados => ({
    boxes, categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: { id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31' },
  });
  const t = new Map([['c2', 'c1']]);

  it('sem trocas, devolve o mesmo objeto', () => {
    const d = vazio([box('c1', 'casa')]);
    expect(aplicarTrocasDeBox(d, new Map())).toBe(d);
  });
  it('tira as boxes trocadas e aponta tudo para a que fica', () => {
    const d = vazio([box('c1', 'casa'), box('c2', 'casa'), box('b1', 'ana')]);
    d.categorias = [{ id: 'k', boxId: 'c2', nome: 'x', tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: 't', alteradoEm: 't' }, { id: 'k2', boxId: 'b1', nome: 'y', tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: 't', alteradoEm: 't' }];
    d.cenarios = [{ id: 'z', nome: 'h', ligado: false, escopo: 'c2', criadoEm: 't', alteradoEm: 't' }, { id: 'z2', nome: 'h', ligado: false, escopo: 'b1', criadoEm: 't', alteradoEm: 't' }];
    d.config = { ...d.config, boxPadraoId: 'c2' };
    const r = aplicarTrocasDeBox(d, t);
    expect(r.boxes.map((b) => b.id).sort()).toEqual(['b1', 'c1']);
    expect(r.categorias.map((c) => c.boxId)).toEqual(['c1', 'b1']);
    expect(r.cenarios.map((c) => c.escopo)).toEqual(['c1', 'b1']);
    expect(r.config.boxPadraoId).toBe('c1');
  });
  it('não altera o objeto recebido', () => {
    const d = vazio([box('c1', 'casa'), box('c2', 'casa')]);
    d.categorias = [{ id: 'k', boxId: 'c2', nome: 'x', tipo: 'gasto', ordem: 0, arquivada: false, criadoEm: 't', alteradoEm: 't' }];
    aplicarTrocasDeBox(d, t);
    expect(d.boxes).toHaveLength(2);
    expect(d.categorias[0].boxId).toBe('c2');
  });
});
