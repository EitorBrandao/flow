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
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA',
    });
  });

  it('XML parcial: campo faltando vira undefined, não quebra os outros', () => {
    const semNome = XML_VALIDO.replace('<emit><xNome>Mercado Exemplo LTDA</xNome></emit>', '<emit></emit>');
    expect(parsearNotaFiscal(semNome)).toEqual({ valorTotal: 6240, data: '2026-08-29', descricao: undefined });
  });

  it('XML malformado devolve objeto vazio, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha')).toEqual({});
  });

  it('string vazia devolve objeto vazio', () => {
    expect(parsearNotaFiscal('')).toEqual({});
  });

  it('XML bem formado mas de outro schema (sem os campos esperados) devolve objeto vazio', () => {
    expect(parsearNotaFiscal('<raiz><outraCoisa>123</outraCoisa></raiz>')).toEqual({
      valorTotal: undefined, data: undefined, descricao: undefined,
    });
  });
});
