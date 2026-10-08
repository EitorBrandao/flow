import { boxIdEfetivo, useApp } from '../state/store';
import { modoDaBox } from '../domain/modos';
import type { ModoUso, TelaModo } from '../domain/types';

/** Modo da tela na box do topo. Na visão casa vale o modo da box real "casa". */
export function useModo(tela: TelaModo): ModoUso {
  return useApp((s) => {
    if (!s.dados) return 'avancado';
    const id = boxIdEfetivo(s.dados, s.boxSel);
    return modoDaBox(s.dados.config, s.dados.boxes.find((b) => b.id === id), tela);
  });
}
