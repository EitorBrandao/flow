import { describe, expect, it } from 'vitest';
import { contraparteNubank, naturezaNubank, normalizarDescricao } from './descricao';

describe('normalizarDescricao', () => {
  it('tira acento, pontuação, caixa e espaço duplicado', () => {
    expect(normalizarDescricao('  Farmácia  DELTA, Ltda. ')).toBe('farmacia delta ltda');
  });
});

describe('contraparteNubank', () => {
  it('extrai o nome do Pix enviado', () => {
    const d = 'Transferência enviada pelo Pix - FULANO DE TAL - •••.123.456-•• - '
      + 'BANCO ALFA S.A. (0001) Agência: 1234 Conta: 12345-6';
    expect(contraparteNubank(d)).toBe('FULANO DE TAL');
  });

  it('extrai o nome do Pix recebido via Open Banking', () => {
    const d = 'Transferência recebida pelo Pix via Open Banking - LOJA GAMA - '
      + '12.345.678/0001-90 - BANCO ALFA S.A. (0001) Agência: 1 Conta: 1234567-0';
    expect(contraparteNubank(d)).toBe('LOJA GAMA');
  });

  // O nome do banco pode conter " - ". Partir a descrição por " - " quebra aqui.
  it('não se perde quando o nome do banco tem hífen cercado de espaços', () => {
    const d = 'Transferência enviada pelo Pix - POSTO BETA - •••.123.456-•• - '
      + 'BANCO ALFA - IP (0001) Agência: 1 Conta: 1234567-0';
    expect(contraparteNubank(d)).toBe('POSTO BETA');
  });

  it('extrai o beneficiário do boleto', () => {
    expect(contraparteNubank('Pagamento de boleto efetuado - MERCADO ALFA S.A.'))
      .toBe('MERCADO ALFA S.A.');
  });

  it('devolve a descrição inteira quando nenhum molde casa', () => {
    expect(contraparteNubank('Compra no débito')).toBe('Compra no débito');
  });
});

describe('naturezaNubank', () => {
  it('reconhece os movimentos da caixinha', () => {
    expect(naturezaNubank('Aplicação RDB')).toBe('aplicacaoInterna');
    expect(naturezaNubank('Resgate RDB')).toBe('resgateInterno');
  });

  it('não reconhece o que não é movimento interno', () => {
    expect(naturezaNubank('Pagamento de boleto efetuado - LOJA GAMA')).toBeUndefined();
  });
});
