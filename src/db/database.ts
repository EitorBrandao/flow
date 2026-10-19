import Dexie, { type Table } from 'dexie';
import type {
  AjusteFechamento, Banco, Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, CnpjCategoria, Lancamento, NotaFiscalSalva, Recorrencia, RecorrenciaCartao, Viagem,
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
  ajustesFechamento!: Table<AjusteFechamento, string>;
  notasFiscais!: Table<NotaFiscalSalva, string>;
  cnpjsCategoria!: Table<CnpjCategoria, string>;

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
      ajustesFechamento: 'id, cartaoId, [cartaoId+mes]',
    });
    // `compraCartaoId` é índice NÃO-único de propósito. `&compraCartaoId` seria a expressão
    // natural de "uma nota por compra", mas faria o merge de dois backups com notas
    // diferentes da mesma compra estourar ConstraintError no meio da transação — e a
    // importação inteira falharia, num app onde importar backup é caminho crítico.
    this.version(6).stores({
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
      ajustesFechamento: 'id, cartaoId, [cartaoId+mes]',
      notasFiscais: 'id, compraCartaoId',
    });
    // `raiz` é índice NÃO-único pelo mesmo motivo de `compraCartaoId`: o merge de dois backups
    // pode trazer duas categorias para a mesma raiz, e a importação não pode estourar por isso.
    this.version(7).stores({
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
      ajustesFechamento: 'id, cartaoId, [cartaoId+mes]',
      notasFiscais: 'id, compraCartaoId',
      cnpjsCategoria: 'id, raiz',
    });
  }
}

export const db = new FlowDB();
