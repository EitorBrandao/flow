import { parsearComprovante } from './comprovante';

// Texto sintético no layout de maquininha — nenhum dado real.
const PARCELADO = `
Maquininha Exemplo        VIA CLIENTE
LOJA TESTE LTDA     CNPJ:00.000.000/0001-00
RUA EXEMPLO 100           SAO PAULO/SP
TOTAL:                    R$ 1.000,00
PARCELAS:             02 X R$ 500,00
CREDITO PARCELADO ESTABELECIMENTO
MASTERCARD          ************1234
05/03/27 - 09H15
Auto:000000
`;

describe('parsearComprovante', () => {
  it('lê total, parcelas, data, estabelecimento e final do cartão', () => {
    expect(parsearComprovante(PARCELADO)).toEqual({
      valorTotal: 100000, parcelas: 2, data: '2027-03-05', descricao: 'LOJA TESTE LTDA',
      finalCartao: '1234', bandeira: 'Mastercard',
    });
  });

  it('compra à vista: sem linha de parcelas, não inventa parcelas', () => {
    const r = parsearComprovante('TOTAL: R$ 45,90\nVISA ****9999\n01/02/2026');
    expect(r).toMatchObject({ valorTotal: 4590, data: '2026-02-01', finalCartao: '9999', bandeira: 'Visa' });
    expect(r.parcelas).toBeUndefined();
  });

  it('sem linha TOTAL, soma pelas parcelas', () => {
    expect(parsearComprovante('PARCELAS: 03 X R$ 33,33').valorTotal).toBe(9999);
  });

  it('o total vence quando difere da soma das parcelas (arredondamento)', () => {
    const r = parsearComprovante('TOTAL: R$ 100,00\nPARCELAS: 03 X R$ 33,33');
    expect(r).toMatchObject({ valorTotal: 10000, parcelas: 3 });
  });

  it('corrige letras que o OCR confunde com dígitos', () => {
    const r = parsearComprovante('TOTAL: R$ 1.OOO,OO\nPARCELAS: O2 X R$ 5OO,OO\n1O/1O/26');
    expect(r).toMatchObject({ valorTotal: 100000, parcelas: 2, data: '2026-10-10' });
  });

  it('data inexistente no calendário fica de fora', () => {
    expect(parsearComprovante('TOTAL: R$ 10,00\n31/02/26').data).toBeUndefined();
  });

  it('data com ano de quatro dígitos', () => {
    expect(parsearComprovante('15/03/2027').data).toBe('2027-03-15');
  });

  it('texto sem nada reconhecível devolve objeto vazio', () => {
    expect(parsearComprovante('')).toEqual({});
    expect(parsearComprovante('lorem ipsum')).toEqual({});
  });

  it('total zerado é ignorado', () => {
    expect(parsearComprovante('TOTAL: R$ 0,00').valorTotal).toBeUndefined();
  });
});
