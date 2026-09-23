import { diasEntre, hojeISO } from './dates';
import type { Config, ISODate } from './types';

export type NivelBackup = 'neutro' | 'aviso' | 'urgente';

export interface EstadoBackup {
  nivel: NivelBackup;
  /** "hoje", "ontem", "há N dias" ou "nunca" — completa a frase "Último backup: …". */
  idade: string;
}

/** Dias de calendário a partir dos quais um backup com mudanças pendentes fica urgente. */
export const DIAS_BACKUP_URGENTE = 7;

/** Mesmo texto na Hoje e em Ajustes → Backup. */
export const SUFIXO_MUDANCAS_BACKUP = ' · há mudanças não salvas em backup';

/** Idade e nível do último backup. A idade é contada em dias de calendário entre a data
 *  local do backup e `hoje` — não em horas —, para o texto e o limite do vermelho usarem a
 *  mesma régua. */
export function estadoBackup(
  config: Pick<Config, 'ultimoBackupEm' | 'mudancasDesdeBackup'>,
  hoje: ISODate,
): EstadoBackup {
  const ms = config.ultimoBackupEm ? Date.parse(config.ultimoBackupEm) : Number.NaN;
  if (Number.isNaN(ms)) {
    return { nivel: config.mudancasDesdeBackup ? 'urgente' : 'neutro', idade: 'nunca' };
  }
  const dataBackup = hojeISO(new Date(ms));
  // diasEntre devolve [] quando o backup é depois de hoje (relógio adiantado): conta como hoje
  const dias = Math.max(0, diasEntre(dataBackup, hoje).length - 1);
  const idade = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
  const nivel: NivelBackup = !config.mudancasDesdeBackup
    ? 'neutro'
    : dias >= DIAS_BACKUP_URGENTE ? 'urgente' : 'aviso';
  return { nivel, idade };
}
