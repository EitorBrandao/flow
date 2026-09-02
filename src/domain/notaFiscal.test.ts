import { extrairChaveDoQrCode, parsearNotaFiscal } from './notaFiscal';

const CHAVE = '35240100000000000000000000000000000000000000';

describe('extrairChaveDoQrCode', () => {
  it('extrai a chave de uma URL no formato padrão nacional', () => {
    const url = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${CHAVE}|2|1|1|abcdef0123456789`;
    expect(extrairChaveDoQrCode(url)).toBe(CHAVE);
  });

  it('extrai a chave quando o separador vem URL-encoded (%7C)', () => {
    const url = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${CHAVE}%7C2%7C1%7C1%7Cabc`;
    expect(extrairChaveDoQrCode(url)).toBe(CHAVE);
  });

  it('devolve undefined para texto sem o parâmetro p= de 44 dígitos', () => {
    expect(extrairChaveDoQrCode('https://exemplo.com/sem-chave')).toBeUndefined();
    expect(extrairChaveDoQrCode('p=123|2|1|1|abc')).toBeUndefined(); // chave curta demais
    expect(extrairChaveDoQrCode('')).toBeUndefined();
  });
});

const XML_VALIDO = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('parsearNotaFiscal', () => {
  it('extrai valor, data e descrição de um XML válido', () => {
    expect(parsearNotaFiscal(XML_VALIDO)).toEqual({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA', itens: [],
    });
  });

  it('XML parcial: campo faltando vira undefined, não quebra os outros', () => {
    const semNome = XML_VALIDO.replace('<emit><xNome>Mercado Exemplo LTDA</xNome></emit>', '<emit></emit>');
    expect(parsearNotaFiscal(semNome)).toEqual({
      valorTotal: 6240, data: '2026-08-29', descricao: undefined, itens: [],
    });
  });

  it('XML malformado devolve objeto vazio, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha')).toEqual({ itens: [] });
  });

  it('string vazia devolve objeto vazio', () => {
    expect(parsearNotaFiscal('')).toEqual({ itens: [] });
  });

  it('XML bem formado mas de outro schema (sem os campos esperados) devolve objeto vazio', () => {
    expect(parsearNotaFiscal('<raiz><outraCoisa>123</outraCoisa></raiz>')).toEqual({
      valorTotal: undefined, data: undefined, descricao: undefined, itens: [],
    });
  });
});

const XML_COM_ITENS = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <det nItem="1">
        <prod><xProd>Produto A</xProd><qCom>2.0000</qCom><uCom>UN</uCom><vProd>10.00</vProd></prod>
      </det>
      <det nItem="2">
        <prod><xProd>Produto B</xProd><qCom>0.5675</qCom><uCom>KG</uCom><vProd>52.40</vProd></prod>
      </det>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('itens da nota (det/prod)', () => {
  it('extrai descrição, quantidade, unidade e valor de cada item', () => {
    expect(parsearNotaFiscal(XML_COM_ITENS).itens).toEqual([
      { descricao: 'Produto A', quantidade: 20000, unidade: 'UN', valorCent: 1000 },
      { descricao: 'Produto B', quantidade: 5675, unidade: 'KG', valorCent: 5240 },
    ]);
  });

  it('guarda a quantidade em décimos de milésimo, sem perder a quarta casa', () => {
    // 0,5675 kg em milésimos viraria 0,567 — a quarta casa existe no schema da NFe
    expect(parsearNotaFiscal(XML_COM_ITENS).itens[1].quantidade).toBe(5675);
  });

  it('descarta item sem xProd, sem virar linha de valor zero', () => {
    const semNome = XML_COM_ITENS.replace('<xProd>Produto A</xProd>', '');
    const itens = parsearNotaFiscal(semNome).itens;
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe('Produto B');
  });

  it('descarta item com vProd fora do formato de duas casas', () => {
    const tresCasas = XML_COM_ITENS.replace('<vProd>10.00</vProd>', '<vProd>10.005</vProd>');
    const itens = parsearNotaFiscal(tresCasas).itens;
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe('Produto B');
  });

  it('quantidade e unidade ausentes viram undefined, o item continua válido', () => {
    const magro = '<NFe><infNFe><det><prod><xProd>Produto C</xProd><vProd>7.50</vProd></prod></det></infNFe></NFe>';
    expect(parsearNotaFiscal(magro).itens).toEqual([{ descricao: 'Produto C', valorCent: 750 }]);
  });

  it('nota sem nenhum det devolve lista vazia', () => {
    expect(parsearNotaFiscal(XML_VALIDO).itens).toEqual([]);
  });

  it('XML malformado devolve lista vazia, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha').itens).toEqual([]);
    expect(parsearNotaFiscal('').itens).toEqual([]);
  });
});
