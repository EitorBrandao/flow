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

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;
  avisos: string[];
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
