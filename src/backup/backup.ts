import type { Dados } from '../domain/types';

export interface Backup {
  app: 'flow';
  schema: 2;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 2, exportadoEm: new Date().toISOString(), dados };
}

const TABELAS_V1 = ['boxes', 'categorias', 'lancamentos', 'recorrencias', 'cenarios'] as const;
const TABELAS_CARTAO = [
  'cartoes', 'categoriasCartao', 'comprasCartao', 'recorrenciasCartao', 'conferenciasFatura',
] as const;

export function validarBackup(json: unknown): Backup {
  const b = json as { app?: unknown; schema?: unknown; exportadoEm?: unknown; dados?: Record<string, unknown> } | null;
  if (!b || typeof b !== 'object' || b.app !== 'flow') {
    throw new Error('Este arquivo não é um backup do Flow.');
  }
  if (b.schema !== 1 && b.schema !== 2) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
  const d = b.dados;
  if (!d || TABELAS_V1.some((t) => !Array.isArray(d[t])) || typeof d.config !== 'object') {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  if (b.schema === 2 && TABELAS_CARTAO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  const dados = { ...d } as unknown as Dados;
  if (b.schema === 1) {
    // backup antigo: tabelas do cartão nasceram depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_CARTAO) md[t] = [];
  }
  return {
    app: 'flow', schema: 2,
    exportadoEm: typeof b.exportadoEm === 'string' ? b.exportadoEm : new Date().toISOString(),
    dados,
  };
}

/** Mescla por id; em conflito vence o alteradoEm mais recente. Config local é mantida. */
export function mesclar(atual: Dados, doBackup: Dados): Dados {
  function mesclarTabela<T extends { id: string; alteradoEm: string }>(a: T[], b: T[]): T[] {
    const porId = new Map(a.map((x) => [x.id, x]));
    for (const x of b) {
      const existente = porId.get(x.id);
      if (!existente || x.alteradoEm > existente.alteradoEm) porId.set(x.id, x);
    }
    return [...porId.values()];
  }
  return {
    boxes: mesclarTabela(atual.boxes, doBackup.boxes),
    categorias: mesclarTabela(atual.categorias, doBackup.categorias),
    lancamentos: mesclarTabela(atual.lancamentos, doBackup.lancamentos),
    recorrencias: mesclarTabela(atual.recorrencias, doBackup.recorrencias),
    cenarios: mesclarTabela(atual.cenarios, doBackup.cenarios),
    cartoes: mesclarTabela(atual.cartoes, doBackup.cartoes),
    categoriasCartao: mesclarTabela(atual.categoriasCartao, doBackup.categoriasCartao),
    comprasCartao: mesclarTabela(atual.comprasCartao, doBackup.comprasCartao),
    recorrenciasCartao: mesclarTabela(atual.recorrenciasCartao, doBackup.recorrenciasCartao),
    conferenciasFatura: mesclarTabela(atual.conferenciasFatura, doBackup.conferenciasFatura),
    config: atual.config,
  };
}
