import { reconstruirCompra } from '../parcelas';
import type { BlocoCartao, LancamentoBruto, LeituraAdapter, NaturezaBruto } from '../tipos';
import { parsearValorExtrato } from '../valores';

/**
 * Uma transação inteira: ícone opcional, data DD/MM, descrição, parcela NN/NN opcional, e o
 * valor no fim.
 *
 * Por que casar a transação inteira em vez de partir a linha pelas datas: o marcador de
 * parcela ("03/10") tem a MESMA forma de uma data DD/MM. Partir por data quebrava a linha de
 * parcelamento em dois pedaços inválidos e a fazia sumir por completo. Ancorar no valor final
 * resolve isso, e de quebra ignora ruído grudado no começo da linha — a extração do PDF às
 * vezes cola o cabeçalho de colunas na primeira transação.
 *
 * A descrição é preguiçosa: para no primeiro valor bem formado. É o que deixa
 * "MERCADO ALFA 103 45,00" render a descrição "MERCADO ALFA 103", e não "MERCADO ALFA".
 */
const TRANSACAO =
  /(?:[23]\s+)?(\d{2}\/\d{2})\s+(.+?)(?:\s+(\d{2}\/\d{2}))?\s+(-?[\d.]+,\d{2})(?=\s|$)/g;

interface TransacaoLida {
  diaMes: string;
  descricao: string;
  parcela?: string;
  valorTexto: string;
}

/** Todas as transações de uma linha de texto. A extração do PDF junta várias numa linha só,
 *  então uma linha pode render zero, uma ou muitas. */
function extrairTransacoes(linha: string): TransacaoLida[] {
  const out: TransacaoLida[] = [];
  TRANSACAO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TRANSACAO.exec(linha)) != null) {
    const descricao = m[2].trim();
    if (descricao === '') continue;
    out.push({
      diaMes: m[1],
      descricao,
      ...(m[3] ? { parcela: m[3] } : {}),
      valorTexto: m[4],
    });
  }
  return out;
}

const CABECALHO_BLOCO = /^@?\s*.+ - \d{4} [X\d]{4} [X\d]{4} \d{4}$/;
const RUIDO = [
  /^Detalhamento da Fatura$/i,
  // "Descrição" com escape: nenhum caractere não-ASCII colado dentro de regex.
  /^Compra Data Descrição Parcela/i,
  /^\d\/\d$/,
  /^(Pagamento e Demais Créditos|Parcelamentos|Despesas)$/i,
];

type Subsecao = 'creditos' | 'parcelamentos' | 'despesas';

function subsecaoDe(linha: string): Subsecao | undefined {
  const l = linha.trim().toLowerCase();
  if (l.startsWith('pagamento e demais')) return 'creditos';
  if (l === 'parcelamentos') return 'parcelamentos';
  if (l === 'despesas') return 'despesas';
  return undefined;
}

function naturezaDe(descricao: string, subsecao: Subsecao): NaturezaBruto | undefined {
  if (subsecao !== 'creditos') return undefined;
  return /pagamento de fatura/i.test(descricao) ? 'pagamentoFatura' : 'estornoCartao';
}

/**
 * Fatura do cartão Santander, a partir do TEXTO já extraído do PDF. Esta função nunca vê um
 * PDF: `textoPdf.ts` é a única parte que conhece o pdf.js, e essa separação é o que torna o
 * parser testável.
 *
 * `mesFatura` é o "AAAA-MM" do vencimento, necessário para deduzir o ano das datas "DD/MM".
 */
export function lerSantanderFatura(texto: string, mesFatura: string): LeituraAdapter {
  const blocos: BlocoCartao[] = [];
  const avisos: string[] = [];
  let linhasIgnoradas = 0;
  let atual: BlocoCartao | undefined;
  let subsecao: Subsecao = 'despesas';

  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim();
    if (linha === '') continue;

    if (CABECALHO_BLOCO.test(linha)) {
      atual = { rotulo: linha, brutos: [] };
      blocos.push(atual);
      subsecao = 'despesas';
      continue;
    }

    const sub = subsecaoDe(linha);
    if (sub) { subsecao = sub; continue; }

    const totalMatch = /^VALOR TOTAL\s+(-?[\d.]+,\d{2})/.exec(linha);
    if (totalMatch && atual) {
      atual.totalDeclaradoCent = parsearValorExtrato(totalMatch[1]);
      continue;
    }

    if (RUIDO.some((re) => re.test(linha))) continue;
    if (!atual) continue;

    const transacoes = extrairTransacoes(linha);
    if (transacoes.length === 0) { linhasIgnoradas++; continue; }

    for (const t of transacoes) {
      const valorCent = parsearValorExtrato(t.valorTexto);
      if (valorCent == null) { linhasIgnoradas++; continue; }

      const parcelaTexto = t.parcela;
      const parcelaN = parcelaTexto ? Number(parcelaTexto.slice(0, 2)) : 1;
      const parcelaTotal = parcelaTexto ? Number(parcelaTexto.slice(3)) : 1;

      // `reconstruirCompra` devolve `undefined` quando a linha não dá uma compra coerente
      // (numeração impossível, "DD/MM" ilegível, data que não existe no calendário). Nesse
      // caso a linha é só ignorada — nunca se inventa uma data ou uma compra em silêncio.
      const compra = reconstruirCompra({
        diaMes: t.diaMes, parcelaN, parcelaTotal,
        valorParcelaCent: Math.abs(valorCent), mesFatura,
      });
      if (compra == null) { linhasIgnoradas++; continue; }
      if (compra.anoDeduzidoComAviso) {
        avisos.push(`Ano deduzido com incerteza em "${t.descricao}".`);
      }

      const natureza = naturezaDe(t.descricao, subsecao);
      // O sinal do LancamentoBruto é o do banco: gasto de cartão é saída.
      const sinalizado = valorCent > 0 ? -valorCent : valorCent;
      atual.brutos.push({
        data: compra.data,
        valorCent: sinalizado,
        descricao: t.descricao,
        fonte: 'cartao',
        ...(parcelaTexto ? { parcela: { n: parcelaN, total: parcelaTotal } } : {}),
        ...(natureza ? { natureza } : {}),
      } satisfies LancamentoBruto);
    }
  }

  for (const b of blocos) {
    if (b.totalDeclaradoCent == null) continue;
    const soma = b.brutos
      .filter((x) => x.natureza == null)
      .reduce((s, x) => s + Math.abs(x.valorCent), 0);
    if (soma !== b.totalDeclaradoCent) {
      avisos.push(
        // "cartão" e "não" com escape: nenhum caractere não-ASCII colado dentro de string.
        `A soma do cartão "${b.rotulo}" não bate com o VALOR TOTAL declarado na fatura.`,
      );
    }
  }

  return { brutos: blocos.flatMap((b) => b.brutos), linhasIgnoradas, avisos, blocos };
}
