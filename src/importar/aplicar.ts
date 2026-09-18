import * as repo from '../db/repo';
import type { ID, ISODate } from '../domain/types';
import { CATEGORIA_A_CLASSIFICAR } from './conferencia';
import type { ItemConferencia } from './tipos';

export interface ContextoAplicar {
  boxId: ID;
  cartaoId?: ID;
  horizonte: ISODate;
}

export interface ResumoAplicacao {
  confirmados: number;
  adicionados: number;
  excluidos: number;
  ignorados: number;
  /** Item que caiu numa guarda defensiva (faltou `lancamentoId`, `bruto` ou `cartaoId`) e por
   *  isso não pôde ser aplicado. `aplicar` é pública, e nada garante que só `conferir` monte
   *  os itens — sem este contador, um item malformado seria descartado em silêncio, e a soma
   *  dos outros campos ficaria menor que a quantidade de itens sem ninguém perceber. */
  invalidos: number;
}

/** Verdadeiro quando algum item usa a sentinela `s` como categoria de destino. */
function usaSentinela(itens: ItemConferencia[], s: ID): boolean {
  return itens.some((item) => {
    const acao = item.acao;
    return (acao.tipo === 'adicionarLancamento' && acao.categoriaId === s)
      || (acao.tipo === 'adicionarCompra' && acao.categoriaCartaoId === s);
  });
}

/**
 * Executa as decisões da conferência.
 *
 * Antes de processar os itens, troca cada sentinela de `CATEGORIA_A_CLASSIFICAR` pela
 * categoria real — achada pelo nome ou criada, via `repo.categoriaAClassificarDe` e
 * `repo.categoriaCartaoAClassificarDe`. A categoria só é criada se algum item precisar dela:
 * sem isso, uma conferência onde tudo foi descartado criaria categoria à toa.
 *
 * As compras de cartão vão todas juntas por `salvarComprasCartaoEmLote`, para que
 * `sincronizarCartoes` rode uma vez só. O resto vai item a item, porque são operações
 * pontuais e o `repo` já as trata em transação própria.
 */
export async function aplicar(
  itens: ItemConferencia[], ctx: ContextoAplicar,
): Promise<ResumoAplicacao> {
  const resumo: ResumoAplicacao = {
    confirmados: 0, adicionados: 0, excluidos: 0, ignorados: 0, invalidos: 0,
  };
  const compras: repo.NovaCompraCartao[] = [];

  const categoriaGanhoId = usaSentinela(itens, CATEGORIA_A_CLASSIFICAR.ganho)
    ? await repo.categoriaAClassificarDe(ctx.boxId, 'ganho')
    : undefined;
  const categoriaGastoId = usaSentinela(itens, CATEGORIA_A_CLASSIFICAR.gasto)
    ? await repo.categoriaAClassificarDe(ctx.boxId, 'gasto')
    : undefined;
  const categoriaCartaoId = ctx.cartaoId != null && usaSentinela(itens, CATEGORIA_A_CLASSIFICAR.cartao)
    ? await repo.categoriaCartaoAClassificarDe(ctx.cartaoId)
    : undefined;

  // Troca a sentinela pela categoria real. `categoriaGanhoId`/`categoriaGastoId`/
  // `categoriaCartaoId` só ficam `undefined` quando NENHUM item usa a sentinela
  // correspondente — e nesse caso `categoriaReal` nunca é chamada com essa sentinela, porque
  // ela só aparece na `categoriaId`/`categoriaCartaoId` de um item que a usa.
  function categoriaReal(id: ID): ID {
    if (id === CATEGORIA_A_CLASSIFICAR.ganho && categoriaGanhoId != null) return categoriaGanhoId;
    if (id === CATEGORIA_A_CLASSIFICAR.gasto && categoriaGastoId != null) return categoriaGastoId;
    if (id === CATEGORIA_A_CLASSIFICAR.cartao && categoriaCartaoId != null) return categoriaCartaoId;
    return id;
  }

  for (const item of itens) {
    const acao = item.acao;
    switch (acao.tipo) {
      case 'ignorar':
        resumo.ignorados++;
        break;

      case 'confirmar': {
        if (!item.lancamentoId) { resumo.invalidos++; break; }
        await repo.confirmarPendente(item.lancamentoId);
        resumo.confirmados++;
        break;
      }

      case 'confirmarComValor': {
        if (!item.lancamentoId) { resumo.invalidos++; break; }
        await repo.confirmarPendente(item.lancamentoId, acao.valorCent, acao.data);
        resumo.confirmados++;
        break;
      }

      case 'adicionarLancamento': {
        if (!item.bruto) { resumo.invalidos++; break; }
        await repo.salvarLancamento({
          boxId: ctx.boxId, categoriaId: categoriaReal(acao.categoriaId),
          data: item.bruto.data, valor: Math.abs(item.bruto.valorCent),
          status: 'efetivo', nota: item.bruto.descricao,
        });
        resumo.adicionados++;
        break;
      }

      case 'adicionarCompra': {
        if (!item.bruto || !ctx.cartaoId) { resumo.invalidos++; break; }
        const reconstruida = item.compraReconstruida;
        compras.push({
          cartaoId: ctx.cartaoId, categoriaCartaoId: categoriaReal(acao.categoriaCartaoId),
          data: reconstruida?.data ?? item.bruto.data,
          valorTotal: reconstruida?.valorTotalCent ?? Math.abs(item.bruto.valorCent),
          parcelas: reconstruida?.parcelas ?? item.bruto.parcela?.total ?? 1,
          descricao: item.bruto.descricao,
        });
        resumo.adicionados++;
        break;
      }

      case 'excluir': {
        if (item.compraCartaoId) {
          await repo.excluirCompraCartao(item.compraCartaoId, ctx.horizonte);
        } else if (item.lancamentoId) {
          await repo.excluirLancamento(item.lancamentoId);
        }
        resumo.excluidos++;
        break;
      }
    }
  }

  if (compras.length > 0) await repo.salvarComprasCartaoEmLote(compras, ctx.horizonte);
  return resumo;
}
