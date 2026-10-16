import type { ISODate } from '../domain/types';
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

/** O OCR troca letras por dígitos (O→0, I→1) dentro de números. Só corrige onde o formato exige
 *  dígito: depois de "R$", entre barras de data e antes de "X" nas parcelas. */
function corrigirDigitos(texto: string): string {
  const digito = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  return texto
    .replace(/R\$\s*([\dOoIl|.,]+)/g, (_, n: string) => `R$ ${digito(n)}`)
    .replace(/\b([\dOoIl|]{1,2})\s*\/\s*([\dOoIl|]{1,2})\s*\/\s*([\dOoIl|]{2,4})\b/g,
      (_, d: string, m: string, a: string) => `${digito(d)}/${digito(m)}/${digito(a)}`)
    .replace(/\b([\dOoIl|]{1,2})\s*[xX]\s*(?=R\$)/g, (_, n: string) => `${digito(n)}x `);
}

function lerData(texto: string): ISODate | undefined {
  for (const m of texto.matchAll(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b/g)) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const data = montarISODate(ano, Number(m[2]), Number(m[1]));
    if (data) return data;
  }
  return undefined;
}

function lerDescricao(linhas: string[]): string | undefined {
  const linha = linhas.find((l) => /CNPJ|CNP[J:]/i.test(l));
  if (!linha) return undefined;
  const nome = linha.slice(0, linha.search(/CNP/i)).replace(/\s+/g, ' ').trim();
  return nome.length >= 2 ? nome : undefined;
}

/**
 * Lê o texto (já passado por OCR) de um comprovante de cartão de maquininha. Nunca lança
 * exceção: o texto vem de fora e o OCR erra. Campo ilegível fica `undefined` — quem chama
 * preenche só o que veio e o usuário confere o resto no formulário.
 *
 * O total vem da linha "TOTAL". Sem ela, usa "N X R$ valor" multiplicado. Havendo as duas, o
 * total vence: a parcela pode ter arredondamento.
 */
export function parsearComprovante(textoBruto: string): ComprovanteExtraido {
  const texto = corrigirDigitos(textoBruto);
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const r: ComprovanteExtraido = {};

  const total = new RegExp(String.raw`TOTAL\s*:?\s*(?:R\$)?\s*${VALOR}`, 'i').exec(texto);
  const totalCent = total ? parsearValorExtrato(total[1]) : undefined;

  const parc = new RegExp(String.raw`(\d{1,2})\s*[xX]\s*(?:R\$)?\s*${VALOR}`).exec(texto);
  const n = parc ? Number(parc[1]) : undefined;
  const parcelaCent = parc ? parsearValorExtrato(parc[2]) : undefined;
  if (n !== undefined && n >= 1 && n <= 99) r.parcelas = n;

  if (totalCent !== undefined && totalCent > 0) r.valorTotal = totalCent;
  else if (r.parcelas !== undefined && parcelaCent !== undefined) r.valorTotal = parcelaCent * r.parcelas;

  const data = lerData(texto);
  if (data) r.data = data;

  const descricao = lerDescricao(linhas);
  if (descricao) r.descricao = descricao;

  const final = /\*{3,}\s*(\d{4})\b/.exec(texto);
  if (final) r.finalCartao = final[1];

  const bandeira = BANDEIRAS.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(texto));
  if (bandeira) r.bandeira = bandeira;

  return r;
}
