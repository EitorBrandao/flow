import type { Box } from './types';
import { categoriasTransferenciaIds } from './transferencia';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

function box(p: Partial<Box> & Pick<Box, 'id'>): Box {
  return { nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, ...ts, ...p };
}

describe('categoriasTransferenciaIds', () => {
  it('retorna as duas categorias ocultas de cada box que já transferiu', () => {
    const a = box({ id: 'b1', categoriaTransferenciaSaidaId: 's1', categoriaTransferenciaEntradaId: 'e1' });
    const b = box({ id: 'b2', categoriaTransferenciaSaidaId: 's2', categoriaTransferenciaEntradaId: 'e2' });
    expect(categoriasTransferenciaIds([a, b])).toEqual(new Set(['s1', 'e1', 's2', 'e2']));
  });

  it('box que nunca transferiu não contribui id nenhum', () => {
    expect(categoriasTransferenciaIds([box({ id: 'b1' })])).toEqual(new Set());
  });

  it('lista vazia de boxes retorna conjunto vazio', () => {
    expect(categoriasTransferenciaIds([])).toEqual(new Set());
  });
});
