import { estadoBackup } from './estadoBackup';

/** Timestamp de um horário local — independente do fuso da máquina que roda o teste. */
function local(ano: number, mes: number, dia: number, hora = 12, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

const HOJE = '2026-07-26';

describe('estadoBackup', () => {
  it('nunca feito e sem mudanças é neutro', () => {
    expect(estadoBackup({ ultimoBackupEm: null, mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'nunca' });
  });

  it('nunca feito e com mudanças é urgente', () => {
    expect(estadoBackup({ ultimoBackupEm: null, mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'nunca' });
  });

  it('feito hoje, com mudanças, é aviso', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 26, 9), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'hoje' });
  });

  it('feito ontem às 23:50 conta como ontem, não como hoje', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 25, 23, 50), mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'ontem' });
  });

  it('6 dias com mudanças ainda é aviso', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 20), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'há 6 dias' });
  });

  it('7 dias com mudanças é urgente', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 19), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'há 7 dias' });
  });

  it('30 dias sem mudanças continua neutro', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 6, 26), mudancasDesdeBackup: false }, HOJE))
      .toEqual({ nivel: 'neutro', idade: 'há 30 dias' });
  });

  it('data de backup ilegível é tratada como nunca feito', () => {
    expect(estadoBackup({ ultimoBackupEm: 'lixo', mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'urgente', idade: 'nunca' });
  });

  it('backup com data depois de hoje (relógio adiantado) conta como hoje', () => {
    expect(estadoBackup({ ultimoBackupEm: local(2026, 7, 28), mudancasDesdeBackup: true }, HOJE))
      .toEqual({ nivel: 'aviso', idade: 'hoje' });
  });
});
