import { addMeses } from '../domain/dates';
import type { ISODate } from '../domain/types';
import type { CompraReconstruida } from './tipos';

export interface ArgsReconstrucao {
  diaMes: string;        // "DD/MM", como a fatura escreve
  parcelaN: number;      // 1-based
  parcelaTotal: number;
  valorParcelaCent: number;
  mesFatura: string;     // "AAAA-MM" do vencimento da fatura sendo lida
}

/** Distância em meses entre dois "AAAA-MM". */
function distanciaEmMeses(a: string, b: string): number {
  const [anoA, mesA] = a.split('-').map(Number);
  const [anoB, mesB] = b.split('-').map(Number);
  return Math.abs((anoA * 12 + mesA) - (anoB * 12 + mesB));
}

/**
 * Remonta a compra original a partir de uma linha parcelada da fatura.
 *
 * A fatura do Santander já traz a data da compra na subseção `Parcelamentos` — não é preciso
 * calcular nada subtraindo meses. O que falta é o ano, porque a data vem como "DD/MM".
 *
 * O ano escolhido é o que põe a data mais perto do mês esperado, que é
 * `mês da fatura − (n − 1) meses`. Quando nem o melhor candidato cai a menos de dois meses do
 * esperado, o resultado vem com `anoDeduzidoComAviso`, e a tela mostra isso. Nunca se inventa
 * um ano em silêncio.
 */
export function reconstruirCompra(args: ArgsReconstrucao): CompraReconstruida {
  const [dia, mes] = args.diaMes.split('/');
  const mesEsperado = addMeses(args.mesFatura, -(args.parcelaN - 1));
  const anoBase = Number(mesEsperado.slice(0, 4));

  let melhorAno = anoBase;
  let melhorDistancia = Infinity;
  for (const ano of [anoBase - 1, anoBase, anoBase + 1]) {
    const d = distanciaEmMeses(`${ano}-${mes}`, mesEsperado);
    if (d < melhorDistancia) { melhorDistancia = d; melhorAno = ano; }
  }

  const data = `${melhorAno}-${mes}-${dia}` as ISODate;
  return {
    data,
    valorTotalCent: args.valorParcelaCent * args.parcelaTotal,
    parcelas: args.parcelaTotal,
    anoDeduzidoComAviso: melhorDistancia > 1,
  };
}
