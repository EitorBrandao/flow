import * as repo from '../db/repo';
import type { Dados, ISODate } from '../domain/types';
import { instalarAmbiente } from './ambiente';
import { tirarRetrato, type Retrato } from './retrato';

export interface Passo {
  data: ISODate;
  descricao: string;
  executar(dados: Dados): Promise<void>;
}

export interface Corte {
  data: ISODate;
  rotulo: string;
}

export interface Roteiro {
  passos: Passo[];
  cortes: Corte[];
}

/**
 * Roda o roteiro do começo ao fim e tira um retrato em cada corte.
 *
 * Materializa e sincroniza antes de cada corte, igual ao `iniciar()` do store
 * (`src/state/store.ts`): sem isso o retrato não enxerga recorrência nem fatura do
 * período que acabou de passar.
 */
export async function executarRoteiro(roteiro: Roteiro): Promise<Retrato[]> {
  const inicio = roteiro.passos[0]?.data ?? roteiro.cortes[0]?.data;
  if (!inicio) throw new Error('roteiro vazio: nenhum passo e nenhum corte');

  const ambiente = instalarAmbiente(inicio);
  const retratos: Retrato[] = [];

  try {
    // A box "casa" nasce em iniciar() (src/state/store.ts), não no repo. O dossiê roda sem
    // a UI, então precisa criá-la aqui — senão o sentinela 'casa' não resolve para box nenhuma.
    await repo.salvarBox({
      id: 'box-casa', nome: 'casa', saldoInicial: null, dataSaldoInicial: null,
      criadoEm: `${inicio}T12:00:00.000Z`, alteradoEm: `${inicio}T12:00:00.000Z`,
    });

    const agenda = [
      ...roteiro.passos.map((p, i) => ({ data: p.data, tipo: 'passo' as const, indice: i, passo: p })),
      ...roteiro.cortes.map((c) => ({ data: c.data, tipo: 'corte' as const, corte: c })),
    ].sort((a, b) => (a.data === b.data ? (a.tipo === 'passo' ? -1 : 1) : a.data.localeCompare(b.data)));

    for (const item of agenda) {
      ambiente.avancarPara(item.data);
      const dados = await repo.carregarTudo();

      if (item.tipo === 'passo') {
        try {
          await item.passo.executar(dados);
        } catch (erro) {
          const causa = erro instanceof Error ? erro.message : String(erro);
          throw new Error(
            `o roteiro parou no passo ${item.indice + 1} (${item.passo.data}, "${item.passo.descricao}"): ${causa}`,
          );
        }
      } else {
        const horizonte = dados.config.horizonteProjecao;
        await repo.materializarTodas(horizonte);
        await repo.sincronizarCartoes(horizonte);
        retratos.push(tirarRetrato(await repo.carregarTudo(), item.corte.data, item.corte.rotulo));
      }
    }
  } finally {
    ambiente.restaurar();
  }

  return retratos;
}
