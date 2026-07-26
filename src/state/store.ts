import { create } from 'zustand';
import * as repo from '../db/repo';
import { hojeISO } from '../domain/dates';
import { categoriasFaturaIds } from '../domain/fatura';
import { agoraISO, novoId, type Dados, type ID, type ISODate } from '../domain/types';

export type Aba = 'hoje' | 'fluxo' | 'lancar' | 'cartao' | 'analises' | 'simulador' | 'ajustes';
export type BoxSelecionada = ID | 'casa';
export type SecaoAjustes = 'menu' | 'categorias' | 'recorrencias' | 'boxes' | 'cartoes'
  | 'categoriasCartao' | 'assinaturas' | 'viagens' | 'backup' | 'wiki' | 'versao';

interface AppState {
  carregado: boolean;
  dados: Dados | null;
  hoje: ISODate;
  aba: Aba;
  boxSel: BoxSelecionada;
  ajustesSecao: SecaoAjustes | null;
  iniciar(): Promise<void>;
  recarregar(): Promise<void>;
  setAba(aba: Aba): void;
  setBoxSel(boxSel: BoxSelecionada): void;
  abrirAjustes(secao: SecaoAjustes): void;
  limparAjustesSecao(): void;
}

export const useApp = create<AppState>((set) => ({
  carregado: false,
  dados: null,
  hoje: hojeISO(),
  aba: 'hoje',
  boxSel: 'casa',
  ajustesSecao: null,
  async iniciar() {
    const inicial = await repo.carregarTudo();
    if (!inicial.boxes.some((b) => b.nome === 'casa')) {
      const agora = agoraISO();
      await repo.salvarBox({
        id: novoId(), nome: 'casa', saldoInicial: null, dataSaldoInicial: null,
        criadoEm: agora, alteradoEm: agora,
      });
    }
    await repo.materializarTodas(inicial.config.horizonteProjecao);
    await repo.sincronizarCartoes(inicial.config.horizonteProjecao);
    const dados = await repo.carregarTudo();
    // boxPadraoId só é válido se apontar para uma box com saldo próprio: é a única lista
    // que o seletor do Shell exibe (+ o sentinela 'casa'). Um valor órfão (ex.: box da
    // casa, saldoInicial null) cai no mesmo fallback de quando não há padrão definido.
    const boxPadraoValido = dados.config.boxPadraoId != null
      && dados.boxes.some((b) => b.id === dados.config.boxPadraoId && b.saldoInicial != null);
    const boxSel: BoxSelecionada =
      (boxPadraoValido ? dados.config.boxPadraoId : null)
      ?? dados.boxes.find((b) => b.saldoInicial != null)?.id
      ?? 'casa';
    set({ dados, carregado: true, hoje: hojeISO(), boxSel });
  },
  async recarregar() {
    set({ dados: await repo.carregarTudo(), hoje: hojeISO() });
  },
  setAba: (aba) => set({ aba }),
  setBoxSel: (boxSel) => set({ boxSel }),
  abrirAjustes: (secao) => set({ aba: 'ajustes', ajustesSecao: secao }),
  limparAjustesSecao: () => set({ ajustesSecao: null }),
}));

/** Ids das boxes da seleção atual ('casa' = todas, para consolidação). */
export function boxIdsSelecionadas(dados: Dados, boxSel: BoxSelecionada): ID[] {
  if (boxSel !== 'casa') return [boxSel];
  return dados.boxes.map((b) => b.id);
}

/**
 * Resolve a seleção atual pro id de uma única box concreta — usado nas telas de
 * Ajustes e no Simulador, que operam sobre uma box por vez (nunca consolidam).
 * O sentinela 'casa' vira o id da box de nome "casa" (autocriada em iniciar());
 * `null` só ocorre se essa box tiver sido renomeada/removida depois.
 */
export function boxIdEfetivo(dados: Dados, boxSel: BoxSelecionada): ID | null {
  if (boxSel !== 'casa') return boxSel;
  return dados.boxes.find((b) => b.nome === 'casa')?.id ?? null;
}

/** Ids dos cenários ligados (mostrados na projeção). */
export function cenariosLigados(dados: Dados): Set<ID> {
  return new Set(dados.cenarios.filter((c) => c.ligado).map((c) => c.id));
}

/** Estado do cartão de primeiro uso: se precisa e por quê. */
export function estadoPrimeiroUso(dados: Dados): { semBoxPropria: boolean; semCategorias: boolean; precisa: boolean } {
  const semBoxPropria = !dados.boxes.some((b) => b.saldoInicial != null);
  const categoriasVisiveis = dados.categorias.filter((c) => !categoriasFaturaIds(dados.cartoes).has(c.id));
  const semCategorias = categoriasVisiveis.length === 0;
  return { semBoxPropria, semCategorias, precisa: semBoxPropria || semCategorias };
}
