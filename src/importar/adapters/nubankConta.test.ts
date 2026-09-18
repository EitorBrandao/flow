import { describe, expect, it } from 'vitest';
import { lerNubankConta, nubankConta } from './nubankConta';

const CABECALHO = 'Data,Valor,Identificador,Descrição';
const UUID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('lerNubankConta', () => {
  it('lê uma entrada e uma saída, com o Identificador como externalId', () => {
    const csv = [
      CABECALHO,
      `15/08/2026,1000.00,${UUID},Resgate RDB`,
      '16/08/2026,-45.00,2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e,'
        + 'Pagamento de boleto efetuado - LOJA GAMA',
    ].join('\n');

    const r = lerNubankConta(csv);

    expect(r.linhasIgnoradas).toBe(0);
    expect(r.brutos).toHaveLength(2);
    expect(r.brutos[0]).toEqual({
      data: '2026-08-15',
      valorCent: 100000,
      descricao: 'Resgate RDB',
      fonte: 'conta',
      externalId: UUID,
      natureza: 'resgateInterno',
    });
    expect(r.brutos[1].valorCent).toBe(-4500);
    expect(r.brutos[1].natureza).toBeUndefined();
  });

  it('marca a aplicação como movimento interno', () => {
    const csv = `${CABECALHO}\n15/08/2026,-1000.00,${UUID},Aplicação RDB`;
    expect(lerNubankConta(csv).brutos[0].natureza).toBe('aplicacaoInterna');
  });

  it('conta a linha ilegível em vez de lançar', () => {
    const csv = [
      CABECALHO,
      `15/08/2026,1000.00,${UUID},Resgate RDB`,
      'data-torta,valor-torto,x,y',
    ].join('\n');

    const r = lerNubankConta(csv);
    expect(r.brutos).toHaveLength(1);
    expect(r.linhasIgnoradas).toBe(1);
  });

  it('não devolve nada quando o cabeçalho não é o esperado', () => {
    const r = lerNubankConta('date,title,amount\n2026-08-15,LOJA GAMA,45.00');
    expect(r.brutos).toHaveLength(0);
  });
});

describe('nubankConta.detectar', () => {
  it('reconhece pelo cabeçalho, não pelo nome do arquivo', () => {
    expect(nubankConta.detectar('qualquer.csv', CABECALHO)).toBe(true);
    expect(nubankConta.detectar('NU_2026.csv', 'date,title,amount')).toBe(false);
  });
});
