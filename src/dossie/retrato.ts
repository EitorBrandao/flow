import { calcularFaturas, type Fatura } from '../domain/fatura';
import { projetarBoxes, type DiaSaldo } from '../domain/projection';
import type { Dados, ID, ISODate } from '../domain/types';

export interface SaldoBox {
  boxId: ID;
  nome: string;
  efetivo: number;
  projetado: number;
  comCenarios: number;
}

export interface MarcosProjecao {
  minimo: DiaSaldo;
  maximo: DiaSaldo;
  fimDeMes: DiaSaldo[];
}

export interface Retrato {
  data: ISODate;
  rotulo: string;
  saldos: SaldoBox[];
  marcos: MarcosProjecao;
  /** Série consolidada dia a dia. Serve aos invariantes; não entra no dossiê. */
  serie: DiaSaldo[];
  faturas: Fatura[];
  contagemPorStatusOrigem: Record<string, number>;
  dados: Dados;
}

function marcosDe(serie: DiaSaldo[]): MarcosProjecao {
  const minimo = serie.reduce((a, b) => (b.saldoProjetado < a.saldoProjetado ? b : a));
  const maximo = serie.reduce((a, b) => (b.saldoProjetado > a.saldoProjetado ? b : a));
  const fimDeMes = serie.filter((d, i) => i === serie.length - 1 || serie[i + 1].data.slice(0, 7) !== d.data.slice(0, 7));
  return { minimo, maximo, fimDeMes };
}

export function tirarRetrato(dados: Dados, data: ISODate, rotulo: string): Retrato {
  const cenariosLigados = new Set(dados.cenarios.filter((c) => c.ligado).map((c) => c.id));
  const entrada = {
    boxes: dados.boxes,
    categorias: dados.categorias,
    lancamentos: dados.lancamentos,
    cenariosLigados,
    horizonte: dados.config.horizonteProjecao,
  };

  const todasAsBoxes = dados.boxes.map((b) => b.id);
  const serie = projetarBoxes(todasAsBoxes, entrada);

  const saldos: SaldoBox[] = [...dados.boxes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((box) => {
      const doDia = projetarBoxes([box.id], entrada).find((d) => d.data === data);
      return {
        boxId: box.id,
        nome: box.nome,
        efetivo: doDia?.saldoEfetivo ?? 0,
        projetado: doDia?.saldoProjetado ?? 0,
        comCenarios: doDia?.saldoComCenarios ?? 0,
      };
    });

  const faturas = [...dados.cartoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .flatMap((cartao) => calcularFaturas(
      cartao,
      dados.comprasCartao.filter((c) => c.cartaoId === cartao.id),
      dados.config.horizonteProjecao,
    ));

  const contagemPorStatusOrigem: Record<string, number> = {};
  for (const l of dados.lancamentos) {
    const chave = `${l.status}/${l.origem}`;
    contagemPorStatusOrigem[chave] = (contagemPorStatusOrigem[chave] ?? 0) + 1;
  }

  return { data, rotulo, saldos, marcos: marcosDe(serie), serie, faturas, contagemPorStatusOrigem, dados };
}
