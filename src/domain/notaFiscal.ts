import { dataDeISODatetime } from './dates';
import { parsearCentavosDecimal } from './money';
import type { ID, ISODate, ItemNota, NotaFiscalSalva } from './types';

/** Dado extraído do XML de uma NFC-e. Cada campo falta quando o XML não o contém ou é
 *  irreconhecível — as funções deste arquivo nunca lançam exceção, porque XML malformado é
 *  entrada esperada aqui (veio de fora do app, colado ou enviado pelo usuário). */
export interface NotaFiscalExtraida {
  valorTotal?: number; // centavos
  data?: ISODate;
  descricao?: string;
  itens: ItemNota[]; // sempre presente; vazia quando não há det/prod legível
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

/** `qCom` tem quatro casas decimais no schema da NFe. Guardar em milésimos transformaria
 *  0,5675 kg em 0,567 — por isso décimos de milésimo, inteiro. `undefined` fora do formato. */
function parsearQuantidade(texto: string): number | undefined {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(texto.trim());
  if (!m) return undefined;
  const fracao = (m[2] ?? '').padEnd(4, '0');
  return Number(m[1]) * 10000 + Number(fracao);
}

/** Itens da nota, na ordem do XML. Item sem nome ou sem valor legível é descartado, não vira
 *  linha de valor zero: ele reaparece na linha de diferença, que é onde toda sobra vai parar
 *  de qualquer jeito. */
function extrairItens(doc: Document): ItemNota[] {
  const itens: ItemNota[] = [];
  const dets = doc.getElementsByTagName('det');
  for (let i = 0; i < dets.length; i++) {
    const prod = dets[i].getElementsByTagName('prod')[0];
    if (!prod) continue;
    const descricao = textoDaTag(prod, 'xProd');
    const vProd = textoDaTag(prod, 'vProd');
    const valorCent = vProd ? parsearCentavosDecimal(vProd) : undefined;
    if (!descricao || valorCent == null) continue;
    const qCom = textoDaTag(prod, 'qCom');
    itens.push({
      descricao,
      quantidade: qCom ? parsearQuantidade(qCom) : undefined,
      unidade: textoDaTag(prod, 'uCom'),
      valorCent,
    });
  }
  return itens;
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
    return { itens: [] };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return { itens: [] };

  const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
  const vNF = icmsTot ? textoDaTag(icmsTot, 'vNF') : undefined;

  const dhEmi = textoDaTag(doc, 'dhEmi');

  const emit = doc.getElementsByTagName('emit')[0];
  const xNome = emit ? textoDaTag(emit, 'xNome') : undefined;

  return {
    valorTotal: vNF ? parsearCentavosDecimal(vNF) : undefined,
    data: dhEmi ? dataDeISODatetime(dhEmi) : undefined,
    descricao: xNome,
    itens: extrairItens(doc),
  };
}

/** A nota anexada a uma compra. Um merge de backups pode deixar mais de uma da mesma compra
 *  (o índice é não-único de propósito) — nesse caso vence a de `alteradoEm` mais recente, em
 *  vez de quebrar. */
export function notaDaCompra(
  notas: NotaFiscalSalva[], compraCartaoId: ID,
): NotaFiscalSalva | undefined {
  let escolhida: NotaFiscalSalva | undefined;
  for (const n of notas) {
    if (n.compraCartaoId !== compraCartaoId) continue;
    if (!escolhida || n.alteradoEm > escolhida.alteradoEm) escolhida = n;
  }
  return escolhida;
}

/** Uma linha da lista "item → valor → % do total". */
export interface LinhaDistribuicao {
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valorCent: number;
  percentual: number; // 0..100, negativo se é linha de desconto
  diferenca?: true;
}

/**
 * Distribui o total da COMPRA entre os itens da nota. A compra manda: a soma dos `vProd`
 * quase nunca bate com ela (desconto, frete, acréscimo, item de valor ilegível), e a sobra
 * vira uma linha final em vez de sumir. Os percentuais são sempre do total da compra — nunca
 * do total da nota, nunca da parcela.
 */
export function distribuirItens(itens: ItemNota[], totalCompraCent: number): LinhaDistribuicao[] {
  if (itens.length === 0) return [];
  const pct = (v: number) => (totalCompraCent === 0 ? 0 : (v / totalCompraCent) * 100);
  // ordenação estável no ES2019+: itens de mesmo valor mantêm a ordem da nota
  const linhas: LinhaDistribuicao[] = [...itens]
    .sort((a, b) => b.valorCent - a.valorCent)
    .map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valorCent: i.valorCent,
      percentual: pct(i.valorCent),
    }));
  const soma = itens.reduce((s, i) => s + i.valorCent, 0);
  const resto = totalCompraCent - soma;
  if (resto !== 0) {
    linhas.push({
      descricao: resto < 0 ? 'Desconto' : 'Frete ou acréscimo',
      valorCent: resto,
      percentual: pct(resto),
      diferenca: true,
    });
  }
  return linhas;
}
