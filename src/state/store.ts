import { create } from 'zustand';
import * as repo from '../db/repo';
import { hojeISO } from '../domain/dates';
import type { Dados, ID, ISODate } from '../domain/types';

export type Aba = 'hoje' | 'fluxo' | 'lancar' | 'analises' | 'simulador' | 'ajustes';
export type BoxSelecionada = ID | 'casa';

interface AppState {
  carregado: boolean;
  dados: Dados | null;
  hoje: ISODate;
  aba: Aba;
  boxSel: BoxSelecionada;
  iniciar(): Promise<void>;
  recarregar(): Promise<void>;
  setAba(aba: Aba): void;
  setBoxSel(boxSel: BoxSelecionada): void;
}

export const useApp = create<AppState>((set) => ({
  carregado: false,
  dados: null,
  hoje: hojeISO(),
  aba: 'hoje',
  boxSel: 'casa',
  async iniciar() {
    const inicial = await repo.carregarTudo();
    await repo.materializarTodas(inicial.config.horizonteProjecao);
    const dados = await repo.carregarTudo();
    const boxSel: BoxSelecionada =
      dados.config.boxPadraoId
      ?? dados.boxes.find((b) => b.saldoInicial != null)?.id
      ?? 'casa';
    set({ dados, carregado: true, hoje: hojeISO(), boxSel });
  },
  async recarregar() {
    set({ dados: await repo.carregarTudo(), hoje: hojeISO() });
  },
  setAba: (aba) => set({ aba }),
  setBoxSel: (boxSel) => set({ boxSel }),
}));

/** Ids das boxes da seleção atual ('casa' = todas, para consolidação). */
export function boxIdsSelecionadas(dados: Dados, boxSel: BoxSelecionada): ID[] {
  if (boxSel !== 'casa') return [boxSel];
  return dados.boxes.map((b) => b.id);
}

/** Ids dos cenários ligados (mostrados na projeção). */
export function cenariosLigados(dados: Dados): Set<ID> {
  return new Set(dados.cenarios.filter((c) => c.ligado).map((c) => c.id));
}
