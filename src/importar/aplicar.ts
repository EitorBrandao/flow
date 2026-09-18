import * as repo from '../db/repo';
import type { ID, ISODate } from '../domain/types';
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

/**
 * Executa as decisões da conferência.
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
          boxId: ctx.boxId, categoriaId: acao.categoriaId,
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
          cartaoId: ctx.cartaoId, categoriaCartaoId: acao.categoriaCartaoId,
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
