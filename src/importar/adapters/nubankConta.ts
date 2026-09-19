import { lerCsv } from '../csv';
import { naturezaNubank } from '../descricao';
import type { Adapter, LancamentoBruto, LeituraAdapter } from '../tipos';
import { parsearDataExtrato, parsearValorExtrato } from '../valores';

/** O cabeçalho é a assinatura do formato. O nome do arquivo não serve: o Nubank manda nomes
 *  diferentes conforme o mês e o canal. */
function ehCabecalho(linha: string): boolean {
  const c = linha.toLowerCase();
  return c.includes('data') && c.includes('valor') && c.includes('identificador');
}

/** Extrato da conta corrente Nubank. Positivo é entrada, negativo é saída — a convenção do
 *  `LancamentoBruto` é a mesma, então não há inversão de sinal aqui. */
export function lerNubankConta(texto: string): LeituraAdapter {
  const linhas = lerCsv(texto);
  const brutos: LancamentoBruto[] = [];
  const linhasNaoReconhecidas: string[] = [];
  let linhasIgnoradas = 0;

  if (linhas.length === 0 || !ehCabecalho(linhas[0].join(','))) {
    return { brutos, linhasIgnoradas, avisos: [] };
  }

  for (const colunas of linhas.slice(1)) {
    const data = parsearDataExtrato(colunas[0] ?? '');
    const valorCent = parsearValorExtrato(colunas[1] ?? '');
    const descricao = (colunas[3] ?? '').trim();
    if (data == null || valorCent == null || descricao === '') {
      linhasIgnoradas++;
      // `lerCsv` já separou a linha em colunas: juntá-las de volta com vírgula reconstrói a
      // linha crua o bastante para o diagnóstico, sem precisar guardar o texto original à
      // parte só para este caso raro.
      linhasNaoReconhecidas.push(colunas.join(','));
      continue;
    }
    const externalId = (colunas[2] ?? '').trim();
    const natureza = naturezaNubank(descricao);
    brutos.push({
      data, valorCent, descricao, fonte: 'conta',
      ...(externalId ? { externalId } : {}),
      ...(natureza ? { natureza } : {}),
    });
  }
  return { brutos, linhasIgnoradas, avisos: [], linhasNaoReconhecidas };
}

export const nubankConta: Adapter = {
  id: 'nubank-conta-csv',
  rotulo: 'Nubank — extrato da conta (CSV)',
  detectar: (_nome, inicio) => ehCabecalho(inicio.split('\n')[0] ?? ''),
  ler: async (conteudo) =>
    lerNubankConta(new TextDecoder('utf-8').decode(conteudo)),
};
