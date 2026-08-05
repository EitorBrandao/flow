import { dedupConferencias } from '../domain/fatura';
import type { Dados } from '../domain/types';

export interface Backup {
  app: 'flow';
  schema: 4;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 4, exportadoEm: new Date().toISOString(), dados };
}

const TABELAS_V1 = ['boxes', 'categorias', 'lancamentos', 'recorrencias', 'cenarios'] as const;
const TABELAS_CARTAO = [
  'cartoes', 'categoriasCartao', 'comprasCartao', 'recorrenciasCartao', 'conferenciasFatura',
] as const;
const TABELAS_VIAGEM = ['viagens'] as const;
const TABELAS_BANCO = ['bancos'] as const;

export function validarBackup(json: unknown): Backup {
  const b = json as { app?: unknown; schema?: unknown; exportadoEm?: unknown; dados?: Record<string, unknown> } | null;
  if (!b || typeof b !== 'object' || b.app !== 'flow') {
    throw new Error('Este arquivo não é um backup do Flow.');
  }
  if (b.schema !== 1 && b.schema !== 2 && b.schema !== 3 && b.schema !== 4) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
  const d = b.dados;
  if (!d || TABELAS_V1.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // `typeof null === 'object'` e `typeof [] === 'object'`: sem estes dois testes um config
  // nulo atravessa a validação inteira e só quebra no `db.config.put` do repo, com mensagem
  // obscura (o import cai fora por rollback da transação, sem perder dados, mas sem explicar).
  if (!d.config || typeof d.config !== 'object' || Array.isArray(d.config)) {
    throw new Error('Backup corrompido: configuração ausente ou inválida.');
  }
  if (b.schema >= 2 && TABELAS_CARTAO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // >= e não ===: schema 3 era o mais novo quando esta checagem nasceu, mas schema 4 (e
  // qualquer futuro) também tem que ter viagens bem formada — do contrário um backup schema 4
  // sem viagens passaria batido (não é < 3, não backfila; não é === 3, não valida).
  if (b.schema >= 3 && TABELAS_VIAGEM.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // bancos nasceu no schema 4: a partir daqui é obrigatória e bem formada.
  if (b.schema >= 4 && TABELAS_BANCO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // backups de schema < 4 já existentes (gerados antes do bump) podem trazer `bancos` mesmo
  // assim, porque a entidade nasceu no código antes do schema subir — nesse caso ela é opcional
  // (backfill abaixo), mas se vier, tem que vir como array.
  if (d.bancos !== undefined && TABELAS_BANCO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  const dados = { ...d } as unknown as Dados;
  // 'config' é a chave primária do registro único; um backup sem ela faz o `put` do repo
  // gravar sem chave e falhar. O id é constante por definição — impor aqui é barato.
  dados.config = { ...dados.config, id: 'config' };
  if (b.schema === 1) {
    // backup antigo: tabelas do cartão nasceram depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_CARTAO) md[t] = [];
  }
  if (b.schema < 3) {
    // backup antigo: viagens nasceu depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_VIAGEM) md[t] = [];
  }
  if (!Array.isArray(dados.bancos)) {
    // backup de schema < 4 sem a chave bancos: entidade nasceu antes do bump de schema.
    // Para schema >= 4 este ramo é inalcançável — a checagem obrigatória acima já teria
    // lançado antes de chegar aqui — mas a condição por array (em vez de por schema) evita
    // sobrescrever com [] um `bancos` real que já exista num backup de schema < 4.
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_BANCO) md[t] = [];
  }
  return {
    app: 'flow', schema: 4,
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
    conferenciasFatura: dedupConferencias(
      mesclarTabela(atual.conferenciasFatura, doBackup.conferenciasFatura),
    ),
    viagens: mesclarTabela(atual.viagens, doBackup.viagens),
    bancos: mesclarTabela(atual.bancos, doBackup.bancos),
    config: atual.config,
  };
}
