import { describe, expect, it } from 'vitest';
import { FATURA_SANTANDER } from '../fixtures/santander-fatura';
import { lerSantanderFatura } from './santanderFatura';

describe('lerSantanderFatura', () => {
  it('lê as seis transações do bloco único', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    expect(r.brutos).toHaveLength(6);
    expect(r.linhasIgnoradas).toBe(0);
    expect(r.blocos).toHaveLength(1);
    expect(r.blocos![0].rotulo).toBe('FULANO DE TAL - 0000 XXXX XXXX 0000');
  });

  // Este é o caso que derruba qualquer parser que assuma uma transação por linha.
  it('separa transações grudadas numa linha só', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const descricoes = r.brutos.map((b) => b.descricao);
    expect(descricoes).toContain('POSTO BETA');
    expect(descricoes).toContain('FARMACIA DELTA');
  });

  // "MERCADO ALFA 103" — o 103 é parte da descrição, não uma parcela.
  it('não confunde número no fim da descrição com parcela', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const mercado = r.brutos.find((b) => b.descricao === 'MERCADO ALFA 103');
    expect(mercado).toBeDefined();
    expect(mercado!.parcela).toBeUndefined();
    expect(mercado!.valorCent).toBe(-4500);
  });

  it('reconstrói a compra parcelada a partir da data da própria linha', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const parcelada = r.brutos.find((b) => b.parcela != null)!;
    expect(parcelada.parcela).toEqual({ n: 3, total: 10 });
    expect(parcelada.data).toBe('2026-07-02');
  });

  it('marca o pagamento da fatura e o estorno pela natureza', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const naturezas = r.brutos.map((b) => b.natureza);
    expect(naturezas).toContain('pagamentoFatura');
    expect(naturezas).toContain('estornoCartao');
  });

  it('descarta o ruído: cabeçalho de colunas, VALOR TOTAL e número de página', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const descricoes = r.brutos.map((b) => b.descricao).join(' | ');
    expect(descricoes).not.toContain('VALOR TOTAL');
    expect(descricoes).not.toContain('Descrição Parcela');
  });

  it('avisa quando a soma do bloco não bate com o VALOR TOTAL declarado', () => {
    const torto = FATURA_SANTANDER.replace('VALOR TOTAL 236,80', 'VALOR TOTAL 999,00');
    const r = lerSantanderFatura(torto, '2026-09');
    expect(r.avisos.join(' ')).toContain('VALOR TOTAL');
  });
});
