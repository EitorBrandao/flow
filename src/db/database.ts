import Dexie, { type Table } from 'dexie';
import type {
  Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, Recorrencia, RecorrenciaCartao, Viagem,
} from '../domain/types';

export class FlowDB extends Dexie {
  boxes!: Table<Box, string>;
  categorias!: Table<Categoria, string>;
  lancamentos!: Table<Lancamento, string>;
  recorrencias!: Table<Recorrencia, string>;
  cenarios!: Table<Cenario, string>;
  config!: Table<Config, string>;
  cartoes!: Table<Cartao, string>;
  categoriasCartao!: Table<CategoriaCartao, string>;
  comprasCartao!: Table<CompraCartao, string>;
  recorrenciasCartao!: Table<RecorrenciaCartao, string>;
  conferenciasFatura!: Table<ConferenciaFatura, string>;
  viagens!: Table<Viagem, string>;

  constructor() {
    super('flow');
    this.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    this.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });
    this.version(3).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
      viagens: 'id, dataInicio, dataFim',
    });
  }
}

export const db = new FlowDB();
