import { addMeses, dataComDia, mesDe } from './dates';
import type { Cartao, CompraCartao, ID, ISODate } from './types';

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

export interface ItemFatura {
  compraId: ID;
  data: ISODate; // data da compra
  categoriaCartaoId: ID;
  descricao?: string;
  parcela: number; // 1-based
  totalParcelas: number;
  valorCent: number;
}

export interface Fatura {
  mes: string; // 'AAAA-MM' do vencimento (chave da fatura)
  dataFechamento: ISODate;
  dataVencimento: ISODate;
  itens: ItemFatura[];
  totalCent: number;
}

/** Parcela n (1-based) em centavos; o resto da divisão inteira vai na primeira. */
export function valorParcela(valorTotal: number, parcelas: number, n: number): number {
  const base = Math.floor(valorTotal / parcelas);
  return n === 1 ? valorTotal - base * (parcelas - 1) : base;
}

/** Faturas derivadas das compras até `ate` (vencimento), ordenadas por mês. Função pura. */
export function calcularFaturas(cartao: CicloCartao, compras: CompraCartao[], ate: ISODate): Fatura[] {
  const porMes = new Map<string, Fatura>();
  for (const c of compras) {
    const mesFech1 = mesFechamentoDaCompra(cartao, c.data);
    for (let n = 1; n <= c.parcelas; n++) {
      const mes = mesVencimentoDoFechamento(cartao, addMeses(mesFech1, n - 1));
      const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes);
      if (dataVencimento > ate) break;
      let f = porMes.get(mes);
      if (!f) {
        f = { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
        porMes.set(mes, f);
      }
      const valorCent = valorParcela(c.valorTotal, c.parcelas, n);
      f.itens.push({
        compraId: c.id, data: c.data, categoriaCartaoId: c.categoriaCartaoId,
        ...(c.descricao ? { descricao: c.descricao } : {}),
        parcela: n, totalParcelas: c.parcelas, valorCent,
      });
      f.totalCent += valorCent;
    }
  }
  const out = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  for (const f of out) {
    f.itens.sort((a, b) => a.data.localeCompare(b.data) || a.compraId.localeCompare(b.compraId));
  }
  return out;
}
