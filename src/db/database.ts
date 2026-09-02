import Dexie, { type Table } from 'dexie';
import type {
  Banco, Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, NotaFiscalSalva, Recorrencia, RecorrenciaCartao, Viagem,
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
  bancos!: Table<Banco, string>;
  notasFiscais!: Table<NotaFiscalSalva, string>;

  constructor(nome = 'flow') {
    super(nome);
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
    this.version(4).stores({
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
      bancos: 'id, boxId',
    });
    // `compraCartaoId` é índice NÃO-único de propósito. `&compraCartaoId` seria a expressão
    // natural de "uma nota por compra", mas faria o merge de dois backups com notas
    // diferentes da mesma compra estourar ConstraintError no meio da transação — e a
    // importação inteira falharia, num app onde importar backup é caminho crítico.
    this.version(5).stores({
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
      bancos: 'id, boxId',
      notasFiscais: 'id, compraCartaoId',
    });
  }
}

export const db = new FlowDB();
