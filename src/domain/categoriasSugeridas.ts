import type { TipoCategoria } from './types';

export interface CategoriasSugeridas {
  nome: string;
  tipo: TipoCategoria;
  marcadaPorPadrao: boolean;
}

export const CATEGORIAS_SUGERIDAS: readonly CategoriasSugeridas[] = [
  // Ganhos
  { nome: 'salário', tipo: 'ganho', marcadaPorPadrao: true },
  { nome: 'pix', tipo: 'ganho', marcadaPorPadrao: true },
  { nome: 'outros', tipo: 'ganho', marcadaPorPadrao: false },
  // Gastos
  { nome: 'mercado', tipo: 'gasto', marcadaPorPadrao: true },
  { nome: 'transporte', tipo: 'gasto', marcadaPorPadrao: true },
  { nome: 'moradia', tipo: 'gasto', marcadaPorPadrao: true },
  { nome: 'contas', tipo: 'gasto', marcadaPorPadrao: true },
  { nome: 'saúde', tipo: 'gasto', marcadaPorPadrao: false },
  { nome: 'lazer', tipo: 'gasto', marcadaPorPadrao: false },
  { nome: 'pix', tipo: 'gasto', marcadaPorPadrao: true },
];
