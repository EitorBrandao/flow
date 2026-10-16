import { parsearComprovante, parsearComprovantes } from './comprovante';

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
      valorTotal: 100000, parcelas: 2, data: '2027-03-05', descricao: 'Loja Teste Ltda',
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

  it('milhar com vírgula e espaço antes dos centavos ("1,000 ,00")', () => {
    expect(parsearComprovante('TOTAL:\nR$ 1,000 ,00').valorTotal).toBe(100000);
  });
});

describe('parsearComprovantes (várias passadas de OCR)', () => {
  it('vota o total: o dígito errado de uma passada perde para as outras', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 4.000,06\nPARCELAS: 02 X R$ 500,00',
      'TOTAL: R$ 1.000,00\nPARCELAS: 02 X R$ 506,00',
      'TOTAL: R$ 1.000,06\nPARCELAS: 02 X R$ 500,00',
    ]);
    expect(r).toMatchObject({ valorTotal: 100000, parcelas: 2 });
  });

  it('total confirmado pela linha TOTAL e pelas parcelas vence um valor mais repetido só numa fonte', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 1.000,06', 'TOTAL: R$ 1.000,06', 'TOTAL: R$ 1.000,00\nPARCELAS: 02 X R$ 500,00',
    ]);
    expect(r.valorTotal).toBe(100000);
  });

  it('zero lido como 6, 8 ou 9: o valor com zeros vence leituras que só diferem por essa confusão', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 1.000,06\nPARCELAS: 02 X R$ 500,06',
      'TOTAL:\nPARCELAS: 02 X R$ 500,00',
      'PARCELAS: 02 X R$ 500,08',
      'PARCELAS: 02 X R$ 500,06',
      'PARCELAS: 02 X R$ 500,00',
    ]);
    expect(r.valorTotal).toBe(100000);
  });

  it('confusão só vale para dígitos conhecidos: 1.000,07 não vira 1.000,00', () => {
    expect(parsearComprovantes(['TOTAL: R$ 1.000,07', 'TOTAL: R$ 1.000,07']).valorTotal).toBe(100007);
  });

  it('data inválida de uma passada (mês 19) não atrapalha a válida de outra', () => {
    expect(parsearComprovantes(['16/19/26', '05/03/27']).data).toBe('2027-03-05');
  });

  it('descarta data no futuro quando `hoje` é informado', () => {
    expect(parsearComprovantes(['16/12/26', '05/03/27'], '2027-03-05').data).toBe('2027-03-05');
  });

  it('vota dia, mês e ano separadamente: cada passada acerta uma parte', () => {
    const r = parsearComprovantes(['15/19/26', '16/19/26', '46/10/26', '16/10/16'], '2027-03-05');
    expect(r.data).toBe('2027-03-05');
  });

  it('com várias passadas, leitura isolada de uma parte da data não basta', () => {
    expect(parsearComprovantes(['06/10/26', '05/03/27', '05/03/27', ''], '2027-03-05').data).toBe('2027-03-05');
    expect(parsearComprovantes(['06/10/26', 'lixo', ''], '2027-03-05').data).toBeUndefined();
  });

  it('ano implausível (2016 numa foto de 2026) deixa a data em branco', () => {
    expect(parsearComprovantes(['16/10/16'], '2027-03-05').data).toBeUndefined();
  });

  it('descrição: escolhe o texto mais parecido com os das outras passadas', () => {
    const r = parsearComprovantes([
      'CASA EXEMPLU LOJA CNPJ:1', 'CASA EXEMPLO LOJA CNPJ:1', 'CASA EXEMPLO LOJA S CNPJ:1', 'XXXXXXXX CNPJ:1',
    ]);
    expect(r.descricao).toBe('Casa Exemplo Loja');
  });

  it('com várias passadas, final do cartão lido uma vez só não entra', () => {
    expect(parsearComprovantes(['MASTERCARD ****1778', '', '']).finalCartao).toBeUndefined();
    expect(parsearComprovantes(['MASTERCARD ****9876', 'VISA ****9876', '']).finalCartao).toBe('9876');
  });

  it('final do cartão sem asteriscos, na linha da bandeira', () => {
    expect(parsearComprovante('MASTERCARD  FrERETRRRRA 9876').finalCartao).toBe('9876');
  });

  it('lista vazia devolve objeto vazio', () => {
    expect(parsearComprovantes([])).toEqual({});
  });
});
