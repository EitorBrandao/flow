import { dataComDia } from './dates';
import type { ID, ISODate, Recorrencia, StatusLancamento } from './types';

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
 *  Efetivos (confirmados) nunca são excluídos. Datas esperadas passadas (<= hoje) que
 *  ainda não existem NÃO são (re)criadas: um previsto descartado pelo usuário não deve
 *  ressuscitar na próxima materialização. Isso é um trade-off aceito: uma recorrência
 *  criada com dataInicio no passado não materializa as ocorrências já passadas.
 *
 *  `incluirPassado` desliga esse filtro: todas as datas esperadas até `ate` que ainda não
 *  existem são criadas, inclusive `<= hoje`. Usado só para recorrência de cenário — cenário
 *  nunca entra na fila de Pendentes (`pendentes`, `src/domain/projection.ts`, exclui
 *  `cenarioId`), então não existe "previsto descartado" para não ressuscitar: sem isso, uma
 *  parcela de cenário com início no passado nunca apareceria. */
export function materializar(
  rec: Pick<Recorrencia, 'ativa' | 'dataInicio' | 'diaDoMes' | 'parcelas'>,
  existentes: { id: ID; data: ISODate; status: StatusLancamento }[],
  hoje: ISODate,
  ate: ISODate,
  incluirPassado = false,
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
    criarDatas: esperadas.filter((d) => !datasExistentes.has(d) && (incluirPassado || d > hoje)),
    excluirIds: existentes
      .filter((l) => l.status === 'previsto' && !setEsperadas.has(l.data))
      .map((l) => l.id),
  };
}
