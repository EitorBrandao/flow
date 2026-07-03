import * as XLSX from 'xlsx';
import { serialExcelParaISO } from '../domain/dates';
import { agoraISO, novoId } from '../domain/types';
import type { ISODate, TipoCategoria, Box, Categoria, Lancamento, Recorrencia } from '../domain/types';

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

export interface EmprestimoImportado {
  nome: string;
  dataInicio: ISODate;
  diaDoMes: number;
  parcelas: number;
  valorMensalCent: number;
}

export function lerSimulacoes(ws: XLSX.WorkSheet): EmprestimoImportado[] {
  const out: EmprestimoImportado[] = [];
  const ref = ws['!ref'];
  if (!ref) return out;
  const ultimaLinha = XLSX.utils.decode_range(ref).e.r + 1;
  for (let r = 1; r <= ultimaLinha; r++) {
    const rotulo = String(ws[`A${r}`]?.v ?? '').trim().toLowerCase();
    if (rotulo !== 'data inicio') continue;
    let nome = `Emprestimo ${out.length + 1}`;
    for (let k = r - 1; k >= 1; k--) {
      const acima = String(ws[`A${k}`]?.v ?? '').trim();
      if (acima && acima.toLowerCase() !== 'valor total') { nome = acima; break; }
    }
    const inicio = ws[`B${r}`]?.v;
    const dia = ws[`B${r + 1}`]?.v;
    const parcelas = ws[`B${r + 2}`]?.v;
    const valor = ws[`B${r + 3}`]?.v;
    if (typeof inicio !== 'number' || typeof dia !== 'number'
      || typeof parcelas !== 'number' || typeof valor !== 'number') continue;
    out.push({
      nome,
      dataInicio: serialExcelParaISO(inicio),
      diaDoMes: dia,
      parcelas,
      valorMensalCent: Math.round(valor * 100),
    });
  }
  return out;
}

export interface ResultadoImport {
  boxes: Box[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  recorrencias: Recorrencia[];
  boxesImportadas: BoxImportada[];
}

export function montarResultado(
  imps: BoxImportada[],
  emprestimos: EmprestimoImportado[],
  hoje: ISODate,
): ResultadoImport {
  const agora = agoraISO();
  const boxes: Box[] = [];
  const categorias: Categoria[] = [];
  const lancamentos: Lancamento[] = [];
  const recorrencias: Recorrencia[] = [];
  const catPorChave = new Map<string, Categoria>();

  for (const imp of imps) {
    const semSaldoProprio = imp.nome === 'casa';
    const box: Box = {
      id: novoId(), nome: imp.nome,
      saldoInicial: semSaldoProprio ? null : imp.saldoInicialCent,
      dataSaldoInicial: semSaldoProprio ? null : imp.dataSaldoInicial,
      criadoEm: agora, alteradoEm: agora,
    };
    boxes.push(box);
    imp.categorias.forEach((cs, i) => {
      const cat: Categoria = {
        id: novoId(), boxId: box.id, nome: cs.nome, tipo: cs.tipo, ordem: i,
        arquivada: false, criadoEm: agora, alteradoEm: agora,
      };
      categorias.push(cat);
      catPorChave.set(`${box.id}|${cs.nome}|${cs.tipo}`, cat);
    });
    for (const cel of imp.celulas) {
      const cat = catPorChave.get(`${box.id}|${cel.categoria.nome}|${cel.categoria.tipo}`)!;
      lancamentos.push({
        id: novoId(), boxId: box.id, categoriaId: cat.id, data: cel.data, valor: cel.valorCent,
        status: cel.data <= hoje ? 'efetivo' : 'previsto', origem: 'import',
        criadoEm: agora, alteradoEm: agora,
      });
    }
  }

  const eitor = boxes.find((b) => b.nome === 'eitor');
  if (eitor) {
    for (const emp of emprestimos) {
      let cat = catPorChave.get(`${eitor.id}|${emp.nome}|gasto`);
      if (!cat) {
        cat = {
          id: novoId(), boxId: eitor.id, nome: emp.nome, tipo: 'gasto',
          ordem: categorias.filter((c) => c.boxId === eitor.id).length,
          arquivada: false, criadoEm: agora, alteradoEm: agora,
        };
        categorias.push(cat);
        catPorChave.set(`${eitor.id}|${emp.nome}|gasto`, cat);
      }
      const rec: Recorrencia = {
        id: novoId(), boxId: eitor.id, categoriaId: cat.id, valor: emp.valorMensalCent,
        dataInicio: emp.dataInicio, diaDoMes: emp.diaDoMes, parcelas: emp.parcelas,
        nota: emp.nome, ativa: true, origem: 'import', criadoEm: agora, alteradoEm: agora,
      };
      recorrencias.push(rec);
      for (const l of lancamentos) {
        if (l.categoriaId === cat.id) l.recorrenciaId = rec.id;
      }
    }
  }

  return { boxes, categorias, lancamentos, recorrencias, boxesImportadas: imps };
}

const ABAS_OBRIGATORIAS = ['box (eitor)', 'box (Ju)', 'box (casa)', 'Simulacoes_Eitor'] as const;

export function lerPlanilha(dados: ArrayBuffer | Uint8Array, hoje: ISODate): ResultadoImport {
  const u8 = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  const wb = XLSX.read(u8, { type: 'array', cellFormula: true });
  for (const aba of ABAS_OBRIGATORIAS) {
    if (!wb.Sheets[aba]) {
      throw new Error(`Aba "${aba}" não encontrada — este arquivo é o "flow of the box" 2026?`);
    }
  }
  const imps = [
    lerBoxSheet(wb.Sheets['box (eitor)'], 'eitor'),
    lerBoxSheet(wb.Sheets['box (Ju)'], 'ju'),
    lerBoxSheet(wb.Sheets['box (casa)'], 'casa', ['Eitor', 'Ju']),
  ];
  return montarResultado(imps, lerSimulacoes(wb.Sheets['Simulacoes_Eitor']), hoje);
}
