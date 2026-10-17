import { leituraConfiavel, parsearComprovante, parsearComprovantes } from './comprovante';

// Textos sintéticos no layout de maquininha — nenhum dado real.
const PARCELADO = `
Maquininha Exemplo        VIA CLIENTE
LOJA TESTE LTDA     CNPJ:00.000.000/0001-00
RUA EXEMPLO 100           SAO PAULO/SP
TOTAL:                    R$ 800,00
PARCELAS:             02 X R$ 400,00
CREDITO PARCELADO ESTABELECIMENTO
MASTERCARD          ************1234
05/03/27 - 09H15
Auto:000000
`;

describe('parsearComprovante', () => {
  it('lê total, parcelas, data, estabelecimento e final do cartão', () => {
    expect(parsearComprovante(PARCELADO)).toEqual({
      valorTotal: 80000, parcelas: 2, data: '2027-03-05', descricao: 'Loja Teste Ltda',
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
    const r = parsearComprovante('TOTAL: R$ 1.2OO,OO\nPARCELAS: O2 X R$ 6OO,OO\n1O/1O/26');
    expect(r).toMatchObject({ valorTotal: 120000, parcelas: 2, data: '2026-10-10' });
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

  it('milhar com vírgula e espaço antes dos centavos ("1,200 ,00")', () => {
    expect(parsearComprovante('TOTAL:\nR$ 1,200 ,00').valorTotal).toBe(120000);
  });
});

describe('parsearComprovantes (várias passadas de OCR)', () => {
  it('vota o total: o dígito errado de uma passada perde para as outras', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 900,06\nPARCELAS: 02 X R$ 400,00',
      'TOTAL: R$ 800,00\nPARCELAS: 02 X R$ 436,00',
      'TOTAL: R$ 800,06\nPARCELAS: 02 X R$ 400,00',
    ]);
    expect(r).toMatchObject({ valorTotal: 80000, parcelas: 2 });
  });

  it('total confirmado pela linha TOTAL e pelas parcelas vence um valor mais repetido só numa fonte', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 800,06', 'TOTAL: R$ 800,06', 'TOTAL: R$ 800,00\nPARCELAS: 02 X R$ 400,00',
    ]);
    expect(r.valorTotal).toBe(80000);
  });

  it('zero lido como 6, 8 ou 9: o valor com zeros vence leituras que só diferem por essa confusão', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 800,06\nPARCELAS: 02 X R$ 400,06',
      'TOTAL:\nPARCELAS: 02 X R$ 400,00',
      'PARCELAS: 02 X R$ 400,08',
      'PARCELAS: 02 X R$ 400,06',
      'PARCELAS: 02 X R$ 400,00',
    ]);
    expect(r.valorTotal).toBe(80000);
  });

  it('confusão só vale para dígitos conhecidos: 800,07 não vira 800,00', () => {
    expect(parsearComprovantes(['TOTAL: R$ 800,07', 'TOTAL: R$ 800,07']).valorTotal).toBe(80007);
  });

  it('data inválida de uma passada (mês 13) não atrapalha a válida de outra', () => {
    expect(parsearComprovantes(['05/13/27', '05/03/27']).data).toBe('2027-03-05');
  });

  it('descarta data no futuro quando `hoje` é informado', () => {
    expect(parsearComprovantes(['05/05/27', '05/03/27'], '2027-03-05').data).toBe('2027-03-05');
  });

  it('vota dia, mês e ano separadamente: cada passada acerta uma parte', () => {
    const r = parsearComprovantes(['04/13/27', '05/13/27', '45/03/27', '05/03/17'], '2027-03-05');
    expect(r.data).toBe('2027-03-05');
  });

  it('com várias passadas, leitura isolada de uma parte da data não basta', () => {
    expect(parsearComprovantes(['06/03/27', '05/03/27', '05/03/27', ''], '2027-03-05').data).toBe('2027-03-05');
    expect(parsearComprovantes(['06/03/27', 'lixo', ''], '2027-03-05').data).toBeUndefined();
  });

  it('ano implausível (2017 numa foto de 2027) deixa a data em branco', () => {
    expect(parsearComprovantes(['05/03/17'], '2027-03-05').data).toBeUndefined();
  });

  it('descrição: escolhe o texto mais parecido com os das outras passadas', () => {
    const r = parsearComprovantes([
      'CASA EXEMPLU LOJA CNPJ:1', 'CASA EXEMPLO LOJA CNPJ:1', 'CASA EXEMPLO LOJA S CNPJ:1', 'XXXXXXXX CNPJ:1',
    ]);
    expect(r.descricao).toBe('Casa Exemplo Loja');
  });

  it('com várias passadas, final do cartão lido uma vez só não entra', () => {
    expect(parsearComprovantes(['MASTERCARD ****5432', '', '']).finalCartao).toBeUndefined();
    expect(parsearComprovantes(['MASTERCARD ****9876', 'VISA ****9876', '']).finalCartao).toBe('9876');
  });

  it('final do cartão sem asteriscos, na linha da bandeira', () => {
    expect(parsearComprovante('MASTERCARD  FrERETRRRRA 9876').finalCartao).toBe('9876');
  });

  it('lista vazia devolve objeto vazio', () => {
    expect(parsearComprovantes([])).toEqual({});
  });
});

describe('leituras ruidosas de foto real', () => {
  it('"R$ 1,200" sem centavos e com vírgula no milhar vale 1.200,00', () => {
    expect(parsearComprovante('TOTAL: R$ 1,200,\nPARCELAS: 02 X R$ 600,00').valorTotal).toBe(120000);
    expect(parsearComprovante('R$ 1,200,00\n02 X R$ 600,00').valorTotal).toBe(120000);
  });

  it('número de parcelas e "R$" estragados ("UZ X R3 400,00")', () => {
    expect(parsearComprovante('PARCELAS: UZ X R3 400,00')).toMatchObject({ parcelas: 2, valorTotal: 80000 });
    expect(parsearComprovante('Q2 X Rá 400,00').parcelas).toBe(2);
  });

  it('total sem a palavra TOTAL: o valor solto vale se a linha das parcelas aparece junto', () => {
    expect(parsearComprovante('BR 800,00\n02 X R$ 400,00').valorTotal).toBe(80000);
  });

  it('valor solto sem linha de parcelas não vira total (pode ser a parcela)', () => {
    expect(parsearComprovante('* 400,00').valorTotal).toBeUndefined();
  });

  it('o zero que o OCR lê como 8 ou 9 nas parcelas não muda o total', () => {
    const r = parsearComprovantes([
      '02 X R$ 408,00', 'UZ X R$ 400,06', 'PARCELAS: 02 X R$ 408,06', 'UZ X R$ 400,06', 'JuIAL: R$ 800,06\nUZ X R$ 409,06',
    ]);
    expect(r.valorTotal).toBe(80000);
  });

  it('1 lido como 4 no total ("4.200,00") perde para as parcelas que dizem 600', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 4.200,00\n02 X R$ 600,00', '02 X R$ 608,06', 'UZ X R$ 600,00',
    ]);
    expect(r.valorTotal).toBe(120000);
  });

  it('valor redondo não vira outro por causa do prior de zeros: 33,33 x 3', () => {
    expect(parsearComprovante('PARCELAS: 03 X R$ 33,33').valorTotal).toBe(9999);
  });

  it('valores legítimos sem zeros redondos não são puxados para zero: 1.016,00 em 2 x 508,00', () => {
    const r = parsearComprovantes([
      'TOTAL: R$ 1.016,00\n02 X R$ 508,00', 'TOTAL: R$ 1.016,00\n02 X R$ 508,00', '02 X R$ 508,00',
    ]);
    expect(r.valorTotal).toBe(101600);
  });

  it('à vista: 89,90 com uma passada lida como 89,96 continua 89,90', () => {
    const r = parsearComprovantes(['TOTAL: R$ 89,90', 'TOTAL: R$ 89,96', 'TOTAL: R$ 89,90']);
    expect(r.valorTotal).toBe(8990);
  });
});

describe('leituraConfiavel', () => {
  const boa = 'TOTAL: R$ 800,00\nPARCELAS: 02 X R$ 400,00';

  it('com poucas leituras iguais, ainda não', () => {
    expect(leituraConfiavel([boa])).toBe(false);
  });

  it('total e parcelas confirmados em várias leituras: pode parar', () => {
    expect(leituraConfiavel([boa, boa, 'lixo'])).toBe(true);
  });

  it('total confirmado, mas parcelas lidas uma vez só: segue lendo', () => {
    expect(leituraConfiavel(['TOTAL: R$ 800,00', 'TOTAL: R$ 800,00', 'TOTAL: R$ 800,00\n02 X R$ 400,00'])).toBe(false);
  });

  it('só a linha das parcelas, repetida: segue lendo para ler a linha TOTAL', () => {
    const so = 'PARCELAS: 02 X R$ 408,00';
    expect(leituraConfiavel([so, so, so])).toBe(false);
  });

  it('à vista: exige 3 leituras da linha TOTAL', () => {
    expect(leituraConfiavel(['TOTAL: R$ 89,90', 'TOTAL: R$ 89,90'])).toBe(false);
    expect(leituraConfiavel(['TOTAL: R$ 89,90', 'TOTAL: R$ 89,90', 'TOTAL: R$ 89,90'])).toBe(true);
  });

  it('sem total, não', () => {
    expect(leituraConfiavel(['lorem', 'ipsum', 'dolor'])).toBe(false);
  });
});

// Débito: sem linha TOTAL e sem parcelas, o valor vem colado ao "R$" na linha do tipo.
const DEBITO = `
LOJA TESTE
DEBITO                       R$21,47
VIA ESTABELECIMENTO (L)  17/10/26 19H10
MASTERCARD DEBITO ***2417
COM GENEROS    CNPJ: 11.222.333/0001-81
SAO PAULO/SP
APROVADO PELO EMISSOR
`;

describe('comprovante de débito', () => {
  it('lê valor, data, final do cartão e CNPJ sem linha TOTAL nem parcelas', () => {
    const r = parsearComprovante(DEBITO, '2026-10-17');
    expect(r).toMatchObject({
      valorTotal: 2147, data: '2026-10-17', finalCartao: '2417', bandeira: 'Mastercard', cnpj: '11222333000181',
    });
    expect(r.parcelas).toBeUndefined();
  });

  it('aceita o "R$" lido como "RS"', () => {
    expect(parsearComprovante('DEBITO  RS21,47\n17/10/26').valorTotal).toBe(2147);
  });

  it('CNPJ com dígito errado é descartado', () => {
    expect(parsearComprovante('CNPJ: 11.222.333/0001-80\nTOTAL: R$ 10,00').cnpj).toBeUndefined();
  });

  it('vota o CNPJ entre passadas: uma leitura ruim perde', () => {
    const ruim = DEBITO.replace('0001-81', '0001-31');
    expect(parsearComprovantes([ruim, DEBITO, DEBITO]).cnpj).toBe('11222333000181');
  });
});
