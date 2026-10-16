import type { ISODate } from '../domain/types';
import { addDias } from '../domain/dates';
import { montarISODate, parsearValorExtrato } from './valores';

/** Dado extraído do texto de um comprovante de maquininha. Cada campo falta quando o texto não o
 *  traz ou o OCR o deixou ilegível. */
export interface ComprovanteExtraido {
  valorTotal?: number; // centavos
  parcelas?: number;   // >= 1
  data?: ISODate;
  descricao?: string;  // nome do estabelecimento
  finalCartao?: string; // 4 últimos dígitos
  bandeira?: string;
}

const VALOR = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})`;
const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'Amex', 'Hipercard'];

/** O OCR troca letras por dígitos (O→0, I→1) dentro de números, e vírgula por ponto no milhar
 *  ("1,000 ,00"). Só corrige onde o formato exige dígito: depois de "R$", entre barras de data e
 *  antes de "X" nas parcelas. */
function corrigirDigitos(texto: string): string {
  const digito = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return texto
    .replace(/R\$\s*([\dOoIl|.,]+(?:\s+,[\dOoIl|]{2})?)/g,
      (_, n: string) => `R$ ${digito(n).replace(/(\d)[.,](\d{3})\s*,(\d{2})\b/, '$1.$2,$3').replace(/\s+/g, '')}`)
    .replace(/\b([\dOoIl|]{1,2})\s*\/\s*([\dOoIl|]{1,2})\s*\/\s*([\dOoIl|]{2,4})\b/g,
      (_, d: string, m: string, a: string) => `${digito(d)}/${digito(m)}/${digito(a)}`)
    .replace(/\b([\dOoIl|]{1,2})\s*[xX]\s*(?=R\$)/g, (_, n: string) => `${digito(n)}x `);
}

/** Trios dia/mês/ano como o OCR os entregou, ainda sem validar: uma passada pode errar só o dia
 *  e outra só o mês, e a votação por componente junta os acertos de cada uma. */
function datasDoTexto(texto: string): Array<[number, number, number]> {
  const trios: Array<[number, number, number]> = [];
  for (const m of texto.matchAll(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b/g)) {
    trios.push([Number(m[1]), Number(m[2]), m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])]);
  }
  return trios;
}

function descricaoDoTexto(linhas: string[]): string | undefined {
  const linha = linhas.find((l) => /CNP/i.test(l));
  if (!linha) return undefined;
  const nome = linha.slice(0, linha.search(/CNP/i)).replace(/\s+/g, ' ').trim();
  return nome.length >= 2 ? nome : undefined;
}

interface Leitura {
  total?: number;
  parcelas?: number;
  parcelaCent?: number;
  datas: Array<[number, number, number]>;
  descricao?: string;
  finalCartao?: string;
  bandeira?: string;
}

function lerUmTexto(textoBruto: string): Leitura {
  const texto = corrigirDigitos(textoBruto);
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const total = new RegExp(String.raw`TOTAL\s*:?\s*(?:R\$)?\s*${VALOR}`, 'i').exec(texto);
  const totalCent = total ? parsearValorExtrato(total[1]) : undefined;
  const parc = new RegExp(String.raw`(\d{1,2})\s*[xX]\s*(?:R\$)?\s*${VALOR}`).exec(texto);
  const n = parc ? Number(parc[1]) : undefined;
  const final = /\*{3,}\s*(\d{4})\b/.exec(texto)
    ?? /(?:MASTERCARD|VISA|ELO|AMEX|HIPERCARD)[^\n\d]*(\d{4})\s*$/im.exec(texto);
  return {
    ...(totalCent !== undefined && totalCent > 0 ? { total: totalCent } : {}),
    ...(n !== undefined && n >= 1 && n <= 99 ? { parcelas: n } : {}),
    ...(parc ? { parcelaCent: parsearValorExtrato(parc[2]) } : {}),
    datas: datasDoTexto(texto),
    ...(descricaoDoTexto(linhas) ? { descricao: descricaoDoTexto(linhas) } : {}),
    ...(final ? { finalCartao: final[1] } : {}),
    ...(BANDEIRAS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(texto))
      ? { bandeira: BANDEIRAS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(texto)) } : {}),
  };
}

/** O valor mais votado; no empate, o que apareceu primeiro. `undefined` sem nenhum voto. */
function maisVotado<T>(votos: T[]): T | undefined {
  const contagem = new Map<T, number>();
  for (const v of votos) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  let melhor: T | undefined;
  let max = 0;
  for (const [v, c] of contagem) if (c > max) { melhor = v; max = c; }
  return melhor;
}

/** Dias que um comprovante pode ter de idade para ser aceito (um ano e uns dias). Um ano lido
 *  como 2016 numa foto de hoje é erro de OCR, não compra antiga: melhor deixar a data em branco
 *  (o formulário usa hoje) do que preencher uma data errada com cara de certa. */
const IDADE_MAXIMA_DIAS = 400;

/** Vota dia, mês e ano separadamente e escolhe a combinação existente e plausível com mais
 *  votos somados — assim "mês 12" (futuro) perde para "mês 10" mesmo empatando em votos. Sem
 *  `hoje`, não filtra por plausibilidade. Fora da janela [hoje − 400 dias, hoje + 1 dia],
 *  devolve `undefined`. */
function votarData(trios: Array<[number, number, number]>, hoje?: ISODate): ISODate | undefined {
  const contar = (valores: number[]) => {
    const m = new Map<number, number>();
    for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const dias = contar(trios.map((t) => t[0]));
  const meses = contar(trios.map((t) => t[1]));
  const anos = contar(trios.map((t) => t[2]));
  let melhor: ISODate | undefined;
  let pontos = 0;
  for (const [d, vd] of dias) for (const [m, vm] of meses) for (const [a, va] of anos) {
    const data = montarISODate(a, m, d);
    if (!data) continue;
    if (hoje && (data > addDias(hoje, 1) || data < addDias(hoje, -IDADE_MAXIMA_DIAS))) continue;
    if (vd + vm + va > pontos) { pontos = vd + vm + va; melhor = data; }
  }
  return melhor;
}

function distanciaEdicao(a: string, b: string): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** O texto mais parecido com os demais: o OCR erra letras diferentes a cada passada, então o
 *  "meio" delas costuma ser o mais próximo do original. Empate: o primeiro. O resultado vira
 *  "Maiúsculas Iniciais" (a maquininha imprime tudo em caixa alta, e o OCR mistura). */
function medoide(textos: string[]): string | undefined {
  let melhor: string | undefined;
  let menor = Infinity;
  for (const t of textos) {
    const soma = textos.reduce((acc, o) => acc + distanciaEdicao(t.toUpperCase(), o.toUpperCase()), 0);
    if (soma < menor) { menor = soma; melhor = t; }
  }
  if (melhor) {
    return melhor.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toUpperCase());
  }
  return melhor;
}

/**
 * Lê o texto (já passado por OCR) de um comprovante de cartão de maquininha. Nunca lança
 * exceção: o texto vem de fora e o OCR erra. Campo ilegível fica `undefined` — quem chama
 * preenche só o que veio e o usuário confere o resto no formulário.
 *
 * Aceita vários textos do mesmo comprovante (o OCR roda em mais de uma passada, porque cada
 * passada erra dígitos diferentes) e vota campo a campo. Para o total, valem como voto tanto a
 * linha "TOTAL" quanto "N X R$ parcela" multiplicado: se uma passada erra um dígito, as outras
 * a vencem. Numa passada só, o total vence a soma das parcelas — a parcela pode ter
 * arredondamento. `hoje` descarta datas futuras: um comprovante nunca é de amanhã.
 */
export function parsearComprovantes(textos: string[], hoje?: ISODate): ComprovanteExtraido {
  const leituras = textos.map(lerUmTexto);
  const r: ComprovanteExtraido = {};

  const totais: number[] = [];
  for (const l of leituras) {
    if (l.total !== undefined) totais.push(l.total);
    if (l.parcelas !== undefined && l.parcelaCent !== undefined) totais.push(l.parcelaCent * l.parcelas);
  }
  const total = maisVotado(totais.filter((t) => Number.isSafeInteger(t) && t > 0));
  if (total !== undefined) r.valorTotal = total;

  const parcelas = maisVotado(leituras.flatMap((l) => (l.parcelas !== undefined ? [l.parcelas] : [])));
  if (parcelas !== undefined) r.parcelas = parcelas;

  const data = votarData(leituras.flatMap((l) => l.datas), hoje);
  if (data) r.data = data;

  const descricao = medoide(leituras.flatMap((l) => (l.descricao ? [l.descricao] : [])));
  if (descricao) r.descricao = descricao;

  const final = maisVotado(leituras.flatMap((l) => (l.finalCartao ? [l.finalCartao] : [])));
  if (final) r.finalCartao = final;

  const bandeira = maisVotado(leituras.flatMap((l) => (l.bandeira ? [l.bandeira] : [])));
  if (bandeira) r.bandeira = bandeira;

  return r;
}

/** Um texto só — ver `parsearComprovantes`. */
export function parsearComprovante(texto: string, hoje?: ISODate): ComprovanteExtraido {
  return parsearComprovantes([texto], hoje);
}
