import { addMeses } from '../domain/dates';
import type { CompraReconstruida } from './tipos';
import { montarISODate } from './valores';

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
 * A fatura do Santander já traz a data da compra na subseção `Parcelamentos` — o que falta é
 * o ano, porque a data vem como "DD/MM". O ano escolhido é o que põe a data mais perto de
 * `mês da fatura − n meses`.
 *
 * Por quê `− n`, não `− (n − 1)`: a parcela 1 de uma compra feita no mês P entra na fatura que
 * VENCE em P+1, não na própria P — o ciclo fecha antes do vencimento. Então a parcela n entra
 * na fatura de P+n, e o mês da compra é `mesFatura − n`. Com `− (n − 1)` (o centro antigo), toda
 * compra comum do começo do ciclo ficava a dois meses do esperado e ganhava "Ano deduzido com
 * incerteza" à toa — foi o que o usuário viu em compras comuns de mercado, na primeira
 * conferência real.
 *
 * Devolve `undefined` quando a linha não dá uma compra coerente: numeração de parcela
 * impossível, "DD/MM" ilegível, ou data que não existe no calendário em ano candidato nenhum.
 * Quem chama conta essa linha como ignorada. Nunca se inventa uma compra em silêncio.
 *
 * Quando o melhor candidato de ano ainda cai a mais de um mês do esperado, o resultado vem
 * com `anoDeduzidoComAviso`, e a tela mostra isso. Todo EMPATE entre dois anos candidatos cai
 * necessariamente nesse caso — eles ficam a doze meses um do outro, então só empatam no ponto
 * médio, bem acima do limiar. A escolha arbitrária nunca fica escondida do usuário.
 */
export function reconstruirCompra(args: ArgsReconstrucao): CompraReconstruida | undefined {
  if (!Number.isInteger(args.parcelaTotal) || args.parcelaTotal < 1) return undefined;
  if (!Number.isInteger(args.parcelaN) || args.parcelaN < 1) return undefined;
  if (args.parcelaN > args.parcelaTotal) return undefined;

  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(args.diaMes.trim());
  if (!m) return undefined;
  const dia = Number(m[1]);
  const mes = Number(m[2]);

  const mesEsperado = addMeses(args.mesFatura, -args.parcelaN);
  const anoBase = Number(mesEsperado.slice(0, 4));
  const mm = String(mes).padStart(2, '0');

  // Ordena os anos candidatos por proximidade e fica no primeiro que dá uma data existente.
  // Isso é o que salva uma compra de 29/02: se o ano mais perto não for bissexto, o candidato
  // seguinte ainda pode ser, e a linha não se perde.
  const candidatos = [anoBase - 1, anoBase, anoBase + 1]
    .map((ano) => ({ ano, distancia: distanciaEmMeses(`${ano}-${mm}`, mesEsperado) }))
    .sort((a, b) => a.distancia - b.distancia);

  for (const c of candidatos) {
    const data = montarISODate(c.ano, mes, dia);
    if (data == null) continue;
    const valorTotalCent = args.valorParcelaCent * args.parcelaTotal;
    if (!Number.isSafeInteger(valorTotalCent)) return undefined;
    return {
      data,
      valorTotalCent,
      parcelas: args.parcelaTotal,
      anoDeduzidoComAviso: c.distancia > 1,
    };
  }
  return undefined;
}
