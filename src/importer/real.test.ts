import { existsSync, readFileSync } from 'node:fs';
import { hojeISO } from '../domain/dates';
import { conferir } from './reconcile';
import { lerPlanilha } from './xlsx';

const CAMINHO = process.env.FLOW_XLSX ?? '';

describe.skipIf(!CAMINHO || !existsSync(CAMINHO))('planilha real (FLOW_XLSX)', () => {
  it('importa as 3 boxes e confere eitor e ju ao centavo', () => {
    const buf = readFileSync(CAMINHO);
    const res = lerPlanilha(new Uint8Array(buf), hojeISO());
    expect(res.boxes.map((b) => b.nome).sort()).toEqual(['casa', 'eitor', 'ju']);
    expect(res.recorrencias.length).toBeGreaterThan(0);
    for (const imp of res.boxesImportadas.filter((b) => b.nome !== 'casa')) {
      const divs = conferir(imp, res);
      expect(divs.slice(0, 5)).toEqual([]); // mostra as 5 primeiras divergências se falhar
    }
  });
});
