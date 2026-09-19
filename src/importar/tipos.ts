import type { ID, ISODate } from '../domain/types';

/** Uma linha lida de um arquivo de banco, antes de qualquer decisão. É formato
 *  intermediário: aqui o valor ainda carrega sinal, porque é assim que o banco escreve. No
 *  Flow o valor é sempre positivo, e quem diz entrada ou saída é o tipo da categoria. */
export interface LancamentoBruto {
  data: ISODate;
  valorCent: number; // negativo = saída
  descricao: string;
  fonte: 'conta' | 'cartao';
  externalId?: string;
  parcela?: { n: number; total: number };
  natureza?: NaturezaBruto;
}

/** Linhas que não são gasto nem ganho comum, reconhecidas pelo adapter. */
export type NaturezaBruto =
  | 'aplicacaoInterna'
  | 'resgateInterno'
  | 'pagamentoFatura'
  | 'estornoCartao';

/** Um bloco de cartão da fatura. A fatura pode ter titular, adicional e virtual; as linhas
 *  não trazem os dígitos do cartão, elas herdam do cabeçalho do bloco. */
export interface BlocoCartao {
  rotulo: string;
  brutos: LancamentoBruto[];
  totalDeclaradoCent?: number;
}

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;
  avisos: string[];
  blocos?: BlocoCartao[];
  // Existe só para diagnóstico, quando nada é reconhecido no arquivo — e contém os dados da
  // fatura ou do extrato do usuário. Nunca é gravado: só a UI de importação o lê, para exibir
  // um botão de copiar.
  textoExtraido?: string;
  // O texto de cada linha (ou trecho) que virou uma unidade de `linhasIgnoradas`, na mesma
  // ordem. Existe só para diagnóstico e contém os dados da fatura ou do extrato do usuário —
  // nunca é gravado: só a UI de importação o lê, para exibir a lista sob pedido.
  linhasNaoReconhecidas?: string[];
}

export interface Adapter {
  id: 'nubank-conta-csv' | 'santander-fatura-pdf';
  rotulo: string;
  detectar(nome: string, inicio: string): boolean;
  ler(conteudo: ArrayBuffer): Promise<LeituraAdapter>;
}

export type EstadoItem =
  | 'confere' | 'previsto' | 'divergente' | 'novo' | 'sobra' | 'interno';

/** Compra de cartão remontada a partir de uma linha parcelada da fatura. */
export interface CompraReconstruida {
  data: ISODate;
  valorTotalCent: number;
  parcelas: number;
  anoDeduzidoComAviso: boolean;
}

export type AcaoItem =
  | { tipo: 'ignorar' }
  | { tipo: 'confirmar' }
  | { tipo: 'confirmarComValor'; valorCent: number; data?: ISODate }
  | { tipo: 'adicionarLancamento'; categoriaId: ID }
  | { tipo: 'adicionarCompra'; categoriaCartaoId: ID }
  | { tipo: 'excluir' };

export interface ItemConferencia {
  estado: EstadoItem;
  bruto?: LancamentoBruto;
  lancamentoId?: ID;
  compraCartaoId?: ID;
  compraReconstruida?: CompraReconstruida;
  acao: AcaoItem;
  aviso?: string;
}

/**
 * Decisão do usuário sobre um item, guardada junto do `estado` em que ele estava quando a
 * decisão foi tomada.
 *
 * A UI chaveia as decisões por uma identidade estável do item (`chaveDoItem`, em
 * `conferencia.ts`), não pelo índice dele na lista — trocar o destino de um bloco refaz a
 * lista e desloca índices. Mas a identidade estável não basta sozinha: recalcular o item pode
 * mudar o `estado` dele (trocar a box pode transformar um `novo` em `confere`), e nesse caso a
 * decisão antiga não faz mais sentido para o item novo. Guardar o `estado` junto permite
 * invalidar a decisão quando isso acontece.
 */
export interface DecisaoTroca {
  estado: EstadoItem;
  acao: AcaoItem;
}

/** Mesmo tratamento de `DecisaoTroca`, para a correção do total de uma compra reconstruída. */
export interface DecisaoTotal {
  estado: EstadoItem;
  valorCent: number;
}
