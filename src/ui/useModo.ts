import { useApp } from '../state/store';
import { modoDe } from '../domain/modos';
import type { ModoUso, TelaModo } from '../domain/types';

export function useModo(tela: TelaModo): ModoUso {
  return useApp((s) => (s.dados ? modoDe(s.dados.config, tela) : 'avancado'));
}
