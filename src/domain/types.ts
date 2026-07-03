export type ID = string;
export type ISODate = string; // "AAAA-MM-DD"
export type TipoCategoria = 'ganho' | 'gasto';
export type StatusLancamento = 'efetivo' | 'previsto';
export type OrigemLancamento = 'manual' | 'recorrencia' | 'import';

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
  valor: number; // centavos; normalmente > 0, negativo permitido p/ estorno importado
  nota?: string;
  status: StatusLancamento;
  origem: OrigemLancamento;
  recorrenciaId?: ID;
  cenarioId?: ID; // lançamento hipotético; nunca 'efetivo'
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
  origem: 'manual' | 'import';
  cenarioId?: ID;
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
}

export interface Dados {
  boxes: Box[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  recorrencias: Recorrencia[];
  cenarios: Cenario[];
  config: Config;
}

export function novoId(): ID {
  return crypto.randomUUID();
}

export function agoraISO(): string {
  return new Date().toISOString();
}
