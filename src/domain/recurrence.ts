import { dataComDia } from './dates';
import type { ID, ISODate, Lancamento, Recorrencia } from './types';

export function ocorrencias(
  rec: Pick<Recorrencia, 'dataInicio' | 'diaDoMes' | 'parcelas'>,
  ate: ISODate,
): ISODate[] {
  const [ano, mes] = rec.dataInicio.split('-').map(Number);
  const out: ISODate[] = [];
  let k = dataComDia(ano, mes, rec.diaDoMes) < rec.dataInicio ? 1 : 0;
  for (let n = 0; rec.parcelas == null || n < rec.parcelas; n++, k++) {
    const d = dataComDia(ano, mes + k, rec.diaDoMes);
    if (d > ate) break;
    out.push(d);
  }
  return out;
}

export interface DiffMaterializacao {
  criarDatas: ISODate[];
  excluirIds: ID[];
}

/** Diff entre as ocorrências esperadas e os lançamentos já vinculados à recorrência.
 *  Efetivos (confirmados) nunca são excluídos. */
export function materializar(
  rec: Recorrencia,
  existentes: Lancamento[],
  ate: ISODate,
): DiffMaterializacao {
  if (!rec.ativa) {
    return {
      criarDatas: [],
      excluirIds: existentes.filter((l) => l.status === 'previsto').map((l) => l.id),
    };
  }
  const esperadas = ocorrencias(rec, ate);
  const setEsperadas = new Set(esperadas);
  const datasExistentes = new Set(existentes.map((l) => l.data));
  return {
    criarDatas: esperadas.filter((d) => !datasExistentes.has(d)),
    excluirIds: existentes
      .filter((l) => l.status === 'previsto' && !setEsperadas.has(l.data))
      .map((l) => l.id),
  };
}
