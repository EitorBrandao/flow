import { bancosDaBox, totalDeclaradoCent } from './bancos';
import { saldosPorBox } from './saldoPorBox';
import type { Banco, Dados, ID, ISODate } from './types';

export interface LinhaConferenciaBox {
  boxId: ID;
  nome: string;
  /** Bancos da box. Vazio = a box se confere sozinha. */
  bancos: Banco[];
  /** Soma dos bancos informados, ou o saldo declarado da box. `null` = nada informado. */
  declaradoCent: number | null;
  /** Saldo efetivo de hoje da box no Flow. */
  flowCent: number;
}

export interface ConferenciaCasa {
  linhas: LinhaConferenciaBox[];
  /** Soma dos declarados informados; `null` se nenhum. */
  totalInformadoCent: number | null;
  totalFlowCent: number;
  /** Nomes das boxes sem saldo informado. */
  faltam: string[];
  /** Total informado menos total do Flow. Só existe com `faltam` vazio e ao menos uma linha. */
  diffCent: number | null;
}

/** Conferência da visão casa: uma linha por box com saldo próprio. A box sem saldo próprio
 *  (como a box `"casa"`) não entra: não há saldo real dela para conferir. */
export function conferenciaDaCasa(
  dados: Dados, boxIds: readonly ID[], hoje: ISODate, ligados: ReadonlySet<ID>,
): ConferenciaCasa {
  const flows = new Map(saldosPorBox(boxIds, {
    boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
    cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
  }, hoje).map((s) => [s.boxId, s.saldoEfetivo]));

  const linhas: LinhaConferenciaBox[] = dados.boxes
    .filter((b) => boxIds.includes(b.id) && b.saldoInicial !== null)
    .map((b) => {
      const bancos = bancosDaBox(dados.bancos, [b.id]);
      return {
        boxId: b.id,
        nome: b.nome,
        bancos,
        declaradoCent: bancos.length > 0 ? totalDeclaradoCent(bancos) : (b.saldoDeclaradoCent ?? null),
        flowCent: flows.get(b.id) ?? 0,
      };
    });

  const informados = linhas.filter((l) => l.declaradoCent !== null);
  const totalInformadoCent = informados.length > 0
    ? informados.reduce((s, l) => s + l.declaradoCent!, 0)
    : null;
  const totalFlowCent = linhas.reduce((s, l) => s + l.flowCent, 0);
  const faltam = linhas.filter((l) => l.declaradoCent === null).map((l) => l.nome);
  const diffCent = faltam.length === 0 && linhas.length > 0 ? totalInformadoCent! - totalFlowCent : null;
  return { linhas, totalInformadoCent, totalFlowCent, faltam, diffCent };
}
