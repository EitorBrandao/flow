import type { ISODate } from '../domain/types';
import { extrairCnpj } from '../domain/cnpj';
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
  cnpj?: string; // 14 dígitos, com dígitos verificadores conferidos
}

const VALOR = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})`;
const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'Amex', 'Hipercard'];

/** O OCR troca letras por dígitos (O→0, I→1) dentro de números, e vírgula por ponto no milhar
 *  ("1,000 ,00"). Só corrige onde o formato exige dígito: depois de "R$", entre barras de data e
 *  antes de "X" nas parcelas. */
function corrigirDigitos(texto: string): string {
  const digito = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return texto
    // milhar com vírgula e centavos separados por espaço, e milhar sem os centavos
    .replace(/(\d)[.,](\d{3})\s*,\s*(\d{2})\b/g, '$1.$2,$3')
    .replace(/R\$\s*(\d{1,3})[.,](\d{3})(?![\d.]|,\d)/g, 'R$ $1.$2,00')
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
  cnpj?: string;
}

/** O "02" da linha "02 X R$ valor" chega como "UZ", "U2", "Q2", "VZ"…: letras de forma parecida com
 *  dígitos. Só vale no número de parcelas, que fica sempre antes do "X". */
function parcelasDoToken(token: string): number | undefined {
  const digitos = token
    .replace(/[OoUuQqVvDd]/g, '0').replace(/[Zz]/g, '2').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5');
  return /^\d{1,2}$/.test(digitos) ? Number(digitos) : undefined;
}

function lerUmTexto(textoBruto: string): Leitura {
  const texto = corrigirDigitos(textoBruto);
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Linha de parcelas: "N X R$ valor". O "R$" também chega estragado ("Rá", "R3", "RS").
  const parc = new RegExp(String.raw`\b([\dOoUuQqVvDdIl|]{1,2}|[OoUuQqVvDd][Zz2])\s*[xX]\s*(?:R\S{0,2}\s*)?${VALOR}`).exec(texto);
  const n = parc ? parcelasDoToken(parc[1]) : undefined;

  // Total: depois da palavra "TOTAL" (que também chega como "JuIAL", "TA;"), ou, sem ela, o
  // primeiro valor com centavos de uma linha sem "X" (a das parcelas tem).
  const comPalavra = new RegExp(String.raw`TOTAL\s*:?\s*(?:R\$)?\s*${VALOR}`, 'i').exec(texto);
  const solto = linhas.find((l) => !/[xX]/.test(l) && new RegExp(VALOR).test(l));
  const soltoValor = solto ? new RegExp(VALOR).exec(solto) : null;
  // Sem a palavra TOTAL, o valor solto só vale se a linha das parcelas aparecer no mesmo texto:
  // sozinho, ele pode ser a parcela.
  // Débito e crédito à vista não têm "TOTAL" nem linha de parcelas: o valor é o único que vem
  // colado ao "R$" (o OCR também entrega "RS" e "R5").
  const comReais = new RegExp(String.raw`\bR[$S5]\s*${VALOR}`).exec(texto);
  const total = comPalavra ?? (parc ? soltoValor : comReais);
  const totalCent = total ? parsearValorExtrato(total[1]) : undefined;

  const final = /\*{3,}\s*(\d{4})\b/.exec(texto)
    ?? /(?:MASTERCARD|VISA|ELO|AMEX|HIPERCARD)[^\n\d]*(\d{4})\s*$/im.exec(texto);
  const bandeira = BANDEIRAS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(texto));
  const descricao = descricaoDoTexto(linhas);
  const cnpj = extrairCnpj(texto);
  return {
    ...(totalCent !== undefined && totalCent > 0 ? { total: totalCent } : {}),
    ...(n !== undefined && n >= 1 && n <= 99 ? { parcelas: n } : {}),
    ...(parc ? { parcelaCent: parsearValorExtrato(parc[2]) } : {}),
    datas: datasDoTexto(texto),
    ...(descricao ? { descricao } : {}),
    ...(final ? { finalCartao: final[1] } : {}),
    ...(bandeira ? { bandeira } : {}),
    ...(cnpj ? { cnpj } : {}),
  };
}

/** Dígitos que a impressora térmica entrega e o OCR lê errado: a chave é o dígito verdadeiro, o
 *  valor são as leituras erradas mais comuns. O zero com ponto ou risco no meio vira 6, 8, 9 ou 4,
 *  em qualquer posição do número e de forma independente de um dígito para outro. */
const CONFUSOES: Record<string, string> = { 0: '6894', 1: '74', 3: '8', 5: '6', 6: '05', 8: '03' };

/** Por dígito: lido igual ao verdadeiro, lido como uma confusão conhecida, ou qualquer outra
 *  coisa. Os dígitos são independentes, então o valor todo é o produto. */
const P_DIGITO_IGUAL = 0.7;
const P_DIGITO_CONFUSAO = 0.08;
const P_DIGITO_OUTRO = 0.002;
const P_TAMANHO_DIFERENTE = 1e-4; // por dígito de diferença no tamanho
/** Valores em reais têm muito mais zeros que o acaso (500, 1.000, ,00): a priori, o dígito
 *  verdadeiro é zero com probabilidade bem acima dos outros. */
const PRIORI_ZERO = 0.35;
const PRIORI_OUTRO = (1 - PRIORI_ZERO) / 9;

/** Probabilidade de o OCR ler `lido` quando o valor verdadeiro é `verdadeiro` (os dois em
 *  centavos), dígito a dígito. */
function verossimilhanca(verdadeiro: number, lido: number): number {
  const v = String(verdadeiro);
  const l = String(lido);
  if (v.length !== l.length) return P_TAMANHO_DIFERENTE ** Math.abs(v.length - l.length);
  let p = 1;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === l[i]) p *= P_DIGITO_IGUAL;
    else if (CONFUSOES[v[i]]?.includes(l[i])) p *= P_DIGITO_CONFUSAO;
    else p *= P_DIGITO_OUTRO;
  }
  return p;
}

/** Valores verdadeiros que explicam uma leitura: o próprio valor e todos os que resultam de
 *  trocar qualquer subconjunto de dígitos pelos que o OCR costuma confundir com eles. */
function explicacoes(lido: number): number[] {
  const digitos = String(lido).split('');
  const opcoes = digitos.map((d) => [
    d, ...Object.entries(CONFUSOES).filter(([, lidos]) => lidos.includes(d)).map(([verdadeiro]) => verdadeiro),
  ]);
  if (opcoes.reduce((n, o) => n * o.length, 1) > 20000) return [lido];
  let partes = [''];
  for (const o of opcoes) partes = partes.flatMap((prefixo) => o.map((d) => prefixo + d));
  return partes.map(Number);
}

/** Hipóteses para o valor verdadeiro: tudo que alguma leitura poderia ter sido. */
function hipoteses(lidos: number[]): number[] {
  const todas = new Set<number>();
  for (const lido of lidos) for (const e of explicacoes(lido)) todas.add(e);
  return [...todas].filter((t) => Number.isSafeInteger(t) && t > 0);
}

/**
 * O total mais provável, dadas as leituras da linha "TOTAL" (`diretos`) e das parcelas
 * (`porParcela`, valor de uma parcela). Cada passada de OCR é uma observação ruidosa do mesmo
 * valor: escolhe-se a hipótese que melhor explica todas, onde ler o dígito certo é provável, ler
 * um 6 no lugar de um 0 é plausível, e o resto é raro. A parcela esperada de uma hipótese é
 * total ÷ parcelas, arredondado. Empate: a hipótese que apareceu primeiro.
 */
function escolherTotal(diretos: number[], porParcela: number[], parcelas: number): number | undefined {
  const lidos = [...diretos, ...porParcela.map((p) => p * parcelas)].filter((t) => Number.isSafeInteger(t) && t > 0);
  let melhor: number | undefined;
  let melhorPontos = -Infinity;
  for (const h of hipoteses(lidos)) {
    let pontos = 0;
    for (const dig of String(h)) pontos += Math.log(dig === '0' ? PRIORI_ZERO : PRIORI_OUTRO);
    for (const d of diretos) pontos += Math.log(verossimilhanca(h, d));
    const esperada = Math.round(h / parcelas);
    for (const p of porParcela) pontos += Math.log(verossimilhanca(esperada, p));
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = h; }
  }
  return melhor;
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
function votarData(trios: Array<[number, number, number]>, passadas: number, hoje?: ISODate): ISODate | undefined {
  // Com 3 passadas ou mais, cada parte da data precisa de 2 leituras iguais: uma leitura isolada
  // de "06" no lugar de "16" é plausível e errada, e a data em branco cai em hoje.
  const minimo = passadas >= 3 ? 2 : 1;
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
    if (vd < minimo || vm < minimo || va < minimo) continue;
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

  const parcelas = maisVotado(leituras.flatMap((l) => (l.parcelas !== undefined ? [l.parcelas] : [])));
  if (parcelas !== undefined) r.parcelas = parcelas;

  const diretos = leituras.flatMap((l) => (l.total !== undefined ? [l.total] : []));
  const porParcela = leituras.flatMap((l) => (l.parcelaCent !== undefined ? [l.parcelaCent] : []));
  const total = escolherTotal(diretos, porParcela, parcelas ?? 1);
  if (total !== undefined) r.valorTotal = total;

  const data = votarData(leituras.flatMap((l) => l.datas), leituras.length, hoje);
  if (data) r.data = data;

  const descricao = medoide(leituras.flatMap((l) => (l.descricao ? [l.descricao] : [])));
  if (descricao) r.descricao = descricao;

  // Final do cartão: dígitos soltos depois dos asteriscos são fáceis de errar, e um final errado
  // com cara de certo é pior que nenhum. Com 3 passadas ou mais, exige 2 leituras iguais.
  const finais = leituras.flatMap((l) => (l.finalCartao ? [l.finalCartao] : []));
  const final = maisVotado(finais);
  const confirmado = final !== undefined && (leituras.length < 3 || finais.filter((f) => f === final).length >= 2);
  if (confirmado) r.finalCartao = final;

  const bandeira = maisVotado(leituras.flatMap((l) => (l.bandeira ? [l.bandeira] : [])));
  if (bandeira) r.bandeira = bandeira;

  // CNPJ: já vem com os dígitos verificadores conferidos, então um valor lido é quase sempre
  // certo; o mais votado resolve o resto.
  const cnpj = maisVotado(leituras.flatMap((l) => (l.cnpj ? [l.cnpj] : [])));
  if (cnpj) r.cnpj = cnpj;

  return r;
}

/** Um texto só — ver `parsearComprovantes`. */
export function parsearComprovante(texto: string, hoje?: ISODate): ComprovanteExtraido {
  return parsearComprovantes([texto], hoje);
}

/** Quantas leituras exatamente iguais ao total escolhido precisam existir para encerrar a leitura
 *  cedo. Cada passada de OCR custa cerca de 1 s no celular. */
const APOIOS_PARA_PARAR = 3;

/** Já dá para parar de ler? Só quando o total escolhido foi confirmado por fontes diferentes.
 *  Com linha de parcelas: pelo menos uma leitura da linha TOTAL e uma de parcela × N, somando
 *  `APOIOS_PARA_PARAR`, com as parcelas lidas em 2 passadas. Sem ela (à vista): `APOIOS_PARA_PARAR`
 *  leituras da linha TOTAL. Várias leituras da mesma linha não bastam: o erro que o OCR repete
 *  passada após passada é justamente o de uma linha só (o zero da parcela lido como 8, por
 *  exemplo), e parar ali pularia as passadas que poderiam ler a outra linha. Uma passada a mais
 *  custa segundos; um valor errado custa o dinheiro do usuário. */
export function leituraConfiavel(textos: string[], hoje?: ISODate): boolean {
  const r = parsearComprovantes(textos, hoje);
  if (r.valorTotal === undefined) return false;
  const leituras = textos.map(lerUmTexto);
  const n = r.parcelas ?? 1;
  const diretos = leituras.filter((l) => l.total === r.valorTotal).length;
  if (r.parcelas === undefined) return diretos >= APOIOS_PARA_PARAR;
  const derivados = leituras.filter((l) => l.parcelaCent !== undefined && l.parcelaCent * n === r.valorTotal).length;
  const parcelasIguais = leituras.filter((l) => l.parcelas === r.parcelas).length;
  return diretos >= 1 && derivados >= 1 && diretos + derivados >= APOIOS_PARA_PARAR && parcelasIguais >= 2;
}
