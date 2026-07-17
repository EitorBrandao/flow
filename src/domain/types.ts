export type ID = string;
export type ISODate = string; // "AAAA-MM-DD"
export type TipoCategoria = 'ganho' | 'gasto';
export type StatusLancamento = 'efetivo' | 'previsto';
export type OrigemLancamento = 'manual' | 'recorrencia' | 'cartao';

interface Entidade {
  id: ID;
  criadoEm: string; // ISO datetime
  alteradoEm: string;
}

export interface Box extends Entidade {
  nome: string;
  saldoInicial: number | null; // centavos; null = box sem saldo próprio (ex.: casa)
  dataSaldoInicial: ISODate | null;
  dono?: string; // multi-pessoa futura; não usado na v1
  saldoDeclaradoCent?: number | null; // último saldo real do banco informado pelo usuário
  dataSaldoDeclarado?: ISODate | null;
}

export interface Categoria extends Entidade {
  boxId: ID;
  nome: string;
  tipo: TipoCategoria;
  ordem: number;
  arquivada: boolean;
}

export interface Lancamento extends Entidade {
  boxId: ID;
  categoriaId: ID;
  data: ISODate;
  valor: number; // centavos; normalmente > 0, negativo permitido p/ estorno
  nota?: string;
  status: StatusLancamento;
  origem: OrigemLancamento;
  recorrenciaId?: ID;
  cenarioId?: ID; // lançamento hipotético; nunca 'efetivo'
  cartaoId?: ID;     // lançamento de fatura: cartão dono
  faturaMes?: string; // 'AAAA-MM' do vencimento — chave estável da fatura
}

export interface Recorrencia extends Entidade {
  boxId: ID;
  categoriaId: ID;
  valor: number; // centavos
  dataInicio: ISODate;
  diaDoMes: number; // 1-31, clampado ao fim do mês
  parcelas: number | null; // null = sem fim
  nota?: string;
  ativa: boolean;
  origem: 'manual';
  cenarioId?: ID;
}

export interface Cartao extends Entidade {
  boxId: ID;
  nome: string;
  diaFechamento: number; // 1-31, clampado ao fim do mês
  diaVencimento: number; // 1-31, clampado
  categoriaFaturaId: ID; // categoria de gasto do Flow que recebe a fatura
  ativo: boolean;
}

export interface CategoriaCartao extends Entidade {
  cartaoId: ID;
  nome: string;
  ordem: number;
  arquivada: boolean;
}

export interface CompraCartao extends Entidade {
  cartaoId: ID;
  categoriaCartaoId: ID;
  data: ISODate;   // data da compra
  valorTotal: number; // centavos, total da compra
  parcelas: number;   // >= 1; 1 = à vista
  descricao?: string;
  recorrenciaCartaoId?: ID; // se gerada por assinatura
}

export interface RecorrenciaCartao extends Entidade {
  cartaoId: ID;
  categoriaCartaoId: ID;
  valor: number; // centavos
  dataInicio: ISODate;
  diaDoMes: number;
  parcelas: number | null; // null = sem fim
  descricao?: string;
  ativa: boolean;
}

/** Valor de conferência da fatura digitado a partir do app do banco (máx. 1 por cartão+mês). */
export interface ConferenciaFatura extends Entidade {
  cartaoId: ID;
  mes: string; // 'AAAA-MM' do vencimento
  valorAppCent: number;
  usarValorApp: boolean; // marcado: o previsto no Flow usa valorAppCent no lugar da soma
}

export interface Cenario extends Entidade {
  nome: string;
  ligado: boolean;
}

export interface Config {
  id: 'config';
  boxPadraoId: ID | null;
  ultimoBackupEm: string | null;
  mudancasDesdeBackup: boolean;
  horizonteProjecao: ISODate;
  saldoDeclaradoCent?: number | null; // último saldo real do banco informado (visão 'casa')
  dataSaldoDeclarado?: ISODate | null;
}

export interface Dados {
  boxes: Box[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  recorrencias: Recorrencia[];
  cenarios: Cenario[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  recorrenciasCartao: RecorrenciaCartao[];
  conferenciasFatura: ConferenciaFatura[];
  config: Config;
}

export function novoId(): ID {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}
