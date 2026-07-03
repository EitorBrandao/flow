import { projetarBoxes } from '../domain/projection';
import type { ISODate } from '../domain/types';
import type { BoxImportada, ResultadoImport } from './xlsx';

export interface Divergencia {
  data: ISODate;
  saldoAppCent: number;
  saldoPlanilhaCent: number;
}

export function conferir(imp: BoxImportada, res: ResultadoImport): Divergencia[] {
  const box = res.boxes.find((b) => b.nome === imp.nome);
  if (!box || imp.datas.length === 0) return [];
  const serie = projetarBoxes([box.id], {
    boxes: res.boxes,
    categorias: res.categorias,
    lancamentos: res.lancamentos,
    cenariosLigados: new Set(),
    horizonte: imp.datas[imp.datas.length - 1],
  });
  const appPorData = new Map(serie.map((s) => [s.data, s.saldoProjetado]));
  const divergencias: Divergencia[] = [];
  imp.datas.forEach((data, i) => {
    const planilha = imp.saldosPlanilhaCent[i];
    if (planilha == null) return;
    const app = appPorData.get(data);
    if (app == null || Math.abs(app - planilha) > 1) {
      divergencias.push({ data, saldoAppCent: app ?? 0, saldoPlanilhaCent: planilha });
    }
  });
  return divergencias;
}
