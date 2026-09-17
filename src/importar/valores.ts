import type { ISODate } from '../domain/types';

/** Converte um valor monetário de extrato em centavos inteiros. Aceita o formato
 *  internacional do CSV do Nubank ("1234.56") e o brasileiro da fatura do Santander
 *  ("1.234,56"). Devolve `undefined` fora desses formatos — nunca lança, porque a entrada vem
 *  de fora do app. */
export function parsearValorExtrato(texto: string): number | undefined {
  let limpo = texto.trim()
    .replace(/R\$/gi, '')
    .replace(/ /g, '')
    .replace(/\s/g, '');
  if (limpo === '' || limpo === '-') return undefined;

  const negativo = limpo.startsWith('-');
  if (negativo) limpo = limpo.slice(1);

  if (limpo.includes(',')) {
    // Formato brasileiro: o ponto é milhar e a vírgula é decimal.
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // Ponto de milhar sem centavos: "1.234" é mil duzentos e trinta e quatro.
    limpo = limpo.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  const [inteiro, fracao = ''] = limpo.split('.');
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  // Mesmo risco que `parsearCentavosDecimal` documenta em src/domain/money.ts: valor absurdo
  // viraria Infinity, e JSON.stringify(Infinity) é null — o backup voltaria quebrado.
  return Number.isSafeInteger(Math.abs(centavos)) ? (negativo ? -centavos : centavos) : undefined;
}

/** Monta um `ISODate` a partir de ano, mês (1-12) e dia, com zero à esquerda. Devolve
 *  `undefined` quando a data não existe no calendário — 31 de abril, 29 de fevereiro em ano
 *  não bissexto. A checagem é de ida e volta: `Date.UTC` normaliza silenciosamente um dia que
 *  estoura o mês, então comparar o mês e o dia de volta é o que pega o caso. */
export function montarISODate(ano: number, mes: number, dia: number): ISODate | undefined {
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || !Number.isInteger(dia)) return undefined;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${ano}-${mm}-${dd}`;
}

/** Converte uma data de extrato em `ISODate`. Aceita AAAA-MM-DD, DD/MM/AAAA, DD/MM/AA e
 *  AAAAMMDD. Devolve `undefined` fora desses formatos — nunca lança. O DD/MM sem ano da
 *  fatura do Santander NÃO entra aqui: ele depende do ano deduzido, em `parcelas.ts`. */
export function parsearDataExtrato(texto: string): ISODate | undefined {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return montarISODate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return montarISODate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(t);
  if (m) return montarISODate(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return montarISODate(Number(m[1]), Number(m[2]), Number(m[3]));
  return undefined;
}
