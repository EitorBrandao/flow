import { describe, expect, it } from 'vitest';
import { detectarAdapter } from './index';

const CABECALHO_NUBANK = 'Data,Valor,Identificador,Descrição';

describe('detectarAdapter', () => {
  it('reconhece o CSV do Nubank pelo cabeçalho', () => {
    const adapter = detectarAdapter('qualquer.csv', CABECALHO_NUBANK);
    expect(adapter?.id).toBe('nubank-conta-csv');
  });

  it('reconhece o PDF pela assinatura %PDF', () => {
    const adapter = detectarAdapter('fatura.pdf', '%PDF-1.4\n...');
    expect(adapter?.id).toBe('santander-fatura-pdf');
  });

  it('devolve undefined para um texto que nenhum adapter reconhece', () => {
    const adapter = detectarAdapter('qualquer.txt', 'data,titulo,valor\n2026-08-15,LOJA GAMA,45.00');
    expect(adapter).toBeUndefined();
  });
});
