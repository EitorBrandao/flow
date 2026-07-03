import * as XLSX from 'xlsx';
import { serialExcelParaISO } from '../domain/dates';
import type { ISODate, TipoCategoria } from '../domain/types';

export interface CategoriaSheet {
  nome: string;
  tipo: TipoCategoria;
  linha: number;
}

export interface CelulaImportada {
  data: ISODate;
  categoria: CategoriaSheet;
  valorCent: number;
}

export interface BoxImportada {
  nome: string;
  saldoInicialCent: number | null;
  dataSaldoInicial: ISODate | null;
  datas: ISODate[];
  saldosPlanilhaCent: (number | null)[];
  categorias: CategoriaSheet[];
  celulas: CelulaImportada[];
}

function rangeDoSum(formula: string | undefined, padrao: [number, number]): [number, number] {
  const m = formula?.match(/SUM\([A-Z]+(\d+):[A-Z]+(\d+)\)/i);
  return m ? [Number(m[1]), Number(m[2])] : padrao;
}

export function lerBoxSheet(
  ws: XLSX.WorkSheet,
  nome: string,
  ignorarCategorias: string[] = [],
): BoxImportada {
  // Colunas de datas: a partir de B (índice 1), enquanto a linha 2 tiver número
  const colunas: string[] = [];
  const datas: ISODate[] = [];
  for (let c = 1; ; c++) {
    const cel = ws[XLSX.utils.encode_cell({ r: 1, c })];
    if (!cel || typeof cel.v !== 'number') break;
    colunas.push(XLSX.utils.encode_col(c));
    datas.push(serialExcelParaISO(cel.v));
  }
  if (colunas.length === 0) {
    throw new Error(`Aba "${nome}": nenhuma data encontrada na linha 2.`);
  }

  const col0 = colunas[0];
  const [g1, g2] = rangeDoSum(ws[`${col0}8`]?.f, [9, 14]);
  const [d1, d2] = rangeDoSum(ws[`${col0}15`]?.f, [16, 30]);

  const categorias: CategoriaSheet[] = [];
  const lerCategorias = (de: number, ate: number, tipo: TipoCategoria) => {
    for (let r = de; r <= ate; r++) {
      const rotulo = ws[`A${r}`];
      const texto = rotulo?.v != null ? String(rotulo.v).trim() : '';
      if (!texto || ignorarCategorias.includes(texto)) continue;
      categorias.push({ nome: texto, tipo, linha: r });
    }
  };
  lerCategorias(g1, g2, 'ganho');
  lerCategorias(d1, d2, 'gasto');

  const celulas: CelulaImportada[] = [];
  colunas.forEach((col, i) => {
    for (const cat of categorias) {
      const cel = ws[`${col}${cat.linha}`];
      if (cel && typeof cel.v === 'number' && cel.v !== 0) {
        celulas.push({ data: datas[i], categoria: cat, valorCent: Math.round(cel.v * 100) });
      }
    }
  });

  const saldosPlanilhaCent = colunas.map((col) => {
    const cel = ws[`${col}7`];
    return cel && typeof cel.v === 'number' ? Math.round(cel.v * 100) : null;
  });

  return {
    nome,
    saldoInicialCent: saldosPlanilhaCent[0],
    dataSaldoInicial: datas[0] ?? null,
    datas,
    saldosPlanilhaCent,
    categorias,
    celulas,
  };
}
