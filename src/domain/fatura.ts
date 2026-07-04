import { addMeses, dataComDia, mesDe } from './dates';
import type { Cartao, ISODate } from './types';

export type CicloCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>;

/** Mês ('AAAA-MM') cujo fechamento recolhe a compra. Compra no dia do fechamento
 *  entra na fatura seguinte (o primeiro fechamento ESTRITAMENTE posterior à data). */
export function mesFechamentoDaCompra(cartao: CicloCartao, data: ISODate): string {
  const [ano, mes] = data.split('-').map(Number);
  const fechamentoDoMes = dataComDia(ano, mes, cartao.diaFechamento);
  return data < fechamentoDoMes ? mesDe(data) : addMeses(mesDe(data), 1);
}

/** Mês do vencimento da fatura que fecha no mês dado. */
export function mesVencimentoDoFechamento(cartao: CicloCartao, mesFechamento: string): string {
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : addMeses(mesFechamento, 1);
}

/** Mês ('AAAA-MM' do vencimento — a chave da fatura) onde cai a parcela 1 da compra. */
export function mesFaturaDaCompra(cartao: CicloCartao, data: ISODate): string {
  return mesVencimentoDoFechamento(cartao, mesFechamentoDaCompra(cartao, data));
}

/** Datas de fechamento e vencimento da fatura cujo vencimento cai no mês dado. */
export function datasFaturaDoMes(
  cartao: CicloCartao,
  mesVencimento: string,
): { dataFechamento: ISODate; dataVencimento: ISODate } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento
    ? mesVencimento
    : addMeses(mesVencimento, -1);
  const [anoF, mesF] = mesFechamento.split('-').map(Number);
  const [anoV, mesV] = mesVencimento.split('-').map(Number);
  return {
    dataFechamento: dataComDia(anoF, mesF, cartao.diaFechamento),
    dataVencimento: dataComDia(anoV, mesV, cartao.diaVencimento),
  };
}
