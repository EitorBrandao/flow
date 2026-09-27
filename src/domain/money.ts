import type { TipoCategoria } from './types';

/** Valor sempre sem sinal: a cor, na tela, diz o sentido (`classeEfeito`, `classeSaldo`).
 *  Regra de linguagem em `docs/estilo/fundamentos.md`. */
export function formatarBRL(centavos: number): string {
  return (Math.abs(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Saldo (um estado, não um movimento): abaixo de zero mostra o "−" (U+2212), além da cor.
 *  Movimento usa `formatarBRL`, sem sinal. Regra em `docs/estilo/fundamentos.md`. */
export function formatarSaldo(centavos: number): string {
  return (centavos < 0 ? '−' : '') + formatarBRL(centavos);
}

/** Percentual com uma casa e vírgula decimal (ex.: "32,4%", "−12,3%"). Recebe pontos
 *  percentuais (32.4), não fração (0.324). */
export function formatarPercentual(p: number): string {
  return `${p.toFixed(1).replace('.', ',').replace('-', '−')}%`;
}

/** Acrescenta um dígito (0-9) ao fim do buffer de centavos, empurrando os existentes à esquerda. */
export function empurrarDigito(centavos: number, digito: string): number {
  return centavos * 10 + Number(digito);
}

/** Remove o último dígito do buffer de centavos. */
export function apagarUltimoDigito(centavos: number): number {
  return Math.floor(centavos / 10);
}

/** Extrai só os dígitos de um texto (ex. colado) e converte em centavos. */
export function digitosParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  return digitos === '' ? 0 : Number(digitos);
}

/** Sobra do mês em formato compacto (sem "R$", sem sinal, arredondado ao real) — rótulo curto
 *  para caber acima de barras de gráfico (ex.: "1.870"). A cor do rótulo diz o sentido. */
export function formatarSobraCompacta(centavos: number): string {
  return Math.round(Math.abs(centavos) / 100).toLocaleString('pt-BR');
}

/** Valor de um lançamento com o sinal do seu efeito no saldo: ganho soma, gasto subtrai.
 *  Um estorno (valor negativo) sai com o sentido invertido. */
export function efeitoNoSaldo(valor: number, tipo: TipoCategoria): number {
  return tipo === 'ganho' ? valor : -valor;
}

/** Classe de cor de um efeito no saldo: verde entra, vermelho sai, zero sem cor. */
export function classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | undefined {
  if (efeito > 0) return 'valor-ganho';
  if (efeito < 0) return 'valor-gasto';
  return undefined;
}

/** Classe de cor de um saldo — a mesma do saldo do dia no Fluxo (`.total-dia`). */
export function classeSaldo(saldo: number): 'total-dia pos' | 'total-dia neg' {
  return saldo >= 0 ? 'total-dia pos' : 'total-dia neg';
}

/** Valor com centavos, sem "R$" — para caber em pílula estreita (ex.: "8,50", "1.234,56").
 *  Sem sinal, como `formatarBRL`: a cor, na tela, diz o sentido. */
export function formatarSemSimbolo(centavos: number): string {
  return (Math.abs(centavos) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/** Saldo sem "R$" — abaixo de zero leva o "−", como `formatarSaldo`. Para colunas estreitas
 *  de saldo (tabela do Simular). */
export function formatarSaldoSemSimbolo(centavos: number): string {
  return (centavos < 0 ? '−' : '') + formatarSemSimbolo(centavos);
}

/** Converte uma string decimal simples (formato do XML da NFe, ex. "123.45") em centavos
 *  inteiros. `undefined` se o texto não casar com esse formato — não lança exceção. A
 *  regex não limita a quantidade de dígitos, então um `vProd` absurdo (nenhuma NFC-e real
 *  chega perto disso) estouraria `Number.MAX_SAFE_INTEGER` e viraria `Infinity`; esse valor
 *  vai para o IndexedDB e para o backup, onde `JSON.stringify(Infinity)` é `null` — e um
 *  re-import traria `valorCent: null`, quebrando `distribuirItens` em `NaN` na lista
 *  inteira. Por isso o resultado só é aceito quando é um inteiro seguro. */
export function parsearCentavosDecimal(texto: string): number | undefined {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto.trim());
  if (!m) return undefined;
  const fracao = (m[2] ?? '').padEnd(2, '0');
  const centavos = Number(m[1]) * 100 + Number(fracao);
  return Number.isSafeInteger(centavos) ? centavos : undefined;
}
