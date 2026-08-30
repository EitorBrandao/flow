import { dataDeISODatetime } from './dates';
import { parsearCentavosDecimal } from './money';
import type { ISODate } from './types';

/** Dado extraído do XML de uma NFC-e. Cada campo falta quando o XML não o contém ou é
 *  irreconhecível — as funções deste arquivo nunca lançam exceção, porque XML malformado é
 *  entrada esperada aqui (veio de fora do app, colado ou enviado pelo usuário). */
export interface NotaFiscalExtraida {
  valorTotal?: number; // centavos
  data?: ISODate;
  descricao?: string;
}

/**
 * Extrai a chave de acesso (44 dígitos) da URL do QR-code da NFC-e, no formato padrão
 * nacional: ".../nfce/qrcode?p=<chave>|<versão>|<ambiente>|<tipo>|<hash>". O separador `|`
 * pode chegar como `%7C` (URL-encoded), dependendo de como o QR foi gerado.
 */
export function extrairChaveDoQrCode(texto: string): string | undefined {
  const normalizado = texto.replace(/%7C/gi, '|');
  const m = /[?&]p=(\d{44})(?:\||$)/.exec(normalizado);
  return m?.[1];
}

function textoDaTag(raiz: Element | Document, tag: string): string | undefined {
  const texto = raiz.getElementsByTagName(tag)[0]?.textContent?.trim();
  return texto ? texto : undefined;
}

/**
 * Faz o parse do XML padrão da NFC-e/NFe. Usa `getElementsByTagName` em vez de seletor CSS
 * porque `querySelector` sobre documento XML (não HTML) tem suporte inconsistente entre
 * motores — `getElementsByTagName` funciona igual nos dois. Tolerante: cada campo ausente ou
 * fora do formato esperado vira `undefined`, nunca lança exceção.
 */
export function parsearNotaFiscal(xml: string): NotaFiscalExtraida {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    return {};
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return {};

  const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
  const vNF = icmsTot ? textoDaTag(icmsTot, 'vNF') : undefined;

  const dhEmi = textoDaTag(doc, 'dhEmi');

  const emit = doc.getElementsByTagName('emit')[0];
  const xNome = emit ? textoDaTag(emit, 'xNome') : undefined;

  return {
    valorTotal: vNF ? parsearCentavosDecimal(vNF) : undefined,
    data: dhEmi ? dataDeISODatetime(dhEmi) : undefined,
    descricao: xNome,
  };
}
