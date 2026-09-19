import { describe, expect, it } from 'vitest';
import { FATURA_DOIS_CARTOES, FATURA_SANTANDER } from '../fixtures/santander-fatura';
import { lerSantanderFatura, mesFaturaDoTexto } from './santanderFatura';

describe('lerSantanderFatura', () => {
  it('lê as seis transações do bloco único', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    expect(r.brutos).toHaveLength(6);
    expect(r.linhasIgnoradas).toBe(0);
    expect(r.blocos).toHaveLength(1);
    expect(r.blocos![0].rotulo).toBe('FULANO DE TAL - 0000 XXXX XXXX 0000');
  });

  it('não lista nenhuma linha não reconhecida quando tudo é lido', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    expect(r.linhasNaoReconhecidas).toEqual([]);
  });

  it('registra o texto de cada linha ignorada, na mesma quantidade que linhasIgnoradas', () => {
    const texto = [
      'FULANO DE TAL - 0000 XXXX XXXX 0000',
      'Compra Data Descrição Parcela R$ US$',
      '01/08 MERCADO ALFA 45,00',
      'linha sem padrao nenhum de transacao',
    ].join('\n');
    const r = lerSantanderFatura(texto, '2026-09');
    expect(r.linhasIgnoradas).toBe(1);
    expect(r.linhasNaoReconhecidas).toHaveLength(r.linhasIgnoradas);
    expect(r.linhasNaoReconhecidas).toEqual(['linha sem padrao nenhum de transacao']);
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

  it('separa os lançamentos por cartão e aceita o cartão virtual', () => {
    const r = lerSantanderFatura(FATURA_DOIS_CARTOES, '2026-09');
    expect(r.blocos).toHaveLength(2);
    expect(r.blocos![0].rotulo).toBe('FULANO DE TAL - 0000 XXXX XXXX 0000');
    expect(r.blocos![1].rotulo).toBe('@ FULANO DE TAL - 1234 5678 9012 3456');
    expect(r.blocos![0].brutos.map((b) => b.descricao)).toEqual(['MERCADO ALFA']);
    expect(r.blocos![1].brutos.map((b) => b.descricao)).toEqual(['POSTO BETA']);
    expect(r.linhasIgnoradas).toBe(0);
    expect(r.avisos).toEqual([]);
  });

  // O cabeçalho de colunas colado à transação não pode levar a transação junto.
  it('lê a transação colada ao cabeçalho de colunas', () => {
    const r = lerSantanderFatura(FATURA_DOIS_CARTOES, '2026-09');
    expect(r.brutos.some((b) => b.descricao === 'POSTO BETA')).toBe(true);
  });

  it('conta a transação que aparece antes de qualquer cartão, em vez de perdê-la', () => {
    const r = lerSantanderFatura('3 07/08 MERCADO ALFA 45,00', '2026-09');
    expect(r.brutos).toHaveLength(0);
    expect(r.linhasIgnoradas).toBe(1);
    expect(r.linhasNaoReconhecidas).toEqual(['3 07/08 MERCADO ALFA 45,00']);
  });

  it('não lança com mês de fatura malformado', () => {
    expect(() => lerSantanderFatura(FATURA_SANTANDER, 'abc')).not.toThrow();
    const r = lerSantanderFatura(FATURA_SANTANDER, 'abc');
    expect(r.brutos).toHaveLength(0);
    expect(r.avisos).toHaveLength(1);
  });

  it('devolve estorno e pagamento como entrada, e compra como saída', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const estorno = r.brutos.find((b) => b.natureza === 'estornoCartao');
    const pagamento = r.brutos.find((b) => b.natureza === 'pagamentoFatura');
    const compra = r.brutos.find((b) => b.descricao === 'MERCADO ALFA 103');
    expect(estorno!.valorCent).toBeGreaterThan(0);
    expect(pagamento!.valorCent).toBeGreaterThan(0);
    expect(compra!.valorCent).toBeLessThan(0);
  });
});

describe('mesFaturaDoTexto', () => {
  it('lê o vencimento quando está na mesma linha do rótulo', () => {
    expect(mesFaturaDoTexto('Vencimento 15/09/2026')).toBe('2026-09');
  });

  it('lê o vencimento quando o valor vem na linha seguinte ao rótulo', () => {
    expect(mesFaturaDoTexto('Vencimento\n15/09/2026')).toBe('2026-09');
  });

  it('devolve undefined sem o rótulo "Vencimento"', () => {
    expect(mesFaturaDoTexto('Fatura sem data nenhuma')).toBeUndefined();
  });
});
