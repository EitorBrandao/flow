import type { Dados } from '../domain/types';

export interface Backup {
  app: 'flow';
  schema: 1;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 1, exportadoEm: new Date().toISOString(), dados };
}

const TABELAS = ['boxes', 'categorias', 'lancamentos', 'recorrencias', 'cenarios'] as const;

export function validarBackup(json: unknown): Backup {
  const b = json as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'flow') {
    throw new Error('Este arquivo não é um backup do Flow.');
  }
  if (b.schema !== 1) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
  const d = b.dados as Dados | undefined;
  if (!d || TABELAS.some((t) => !Array.isArray(d[t])) || typeof d.config !== 'object') {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  return b as Backup;
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
    cartoes: [],
    categoriasCartao: [],
    comprasCartao: [],
    recorrenciasCartao: [],
    conferenciasFatura: [],
    config: atual.config,
  };
}
