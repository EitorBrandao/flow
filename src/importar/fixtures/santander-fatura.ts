/** Texto sintético no formato da fatura do Santander, escrito à mão. Nenhum dado real do
 *  usuário entra no repositório — ver o guard `scripts/verificar-dados-reais.mjs`.
 *
 *  A última linha de Despesas está com transações grudadas DE PROPÓSITO: é assim que a
 *  extração de texto do PDF entregou a página 3 do arquivo real. */
export const FATURA_SANTANDER = [
  'Detalhamento da Fatura',
  'FULANO DE TAL - 0000 XXXX XXXX 0000',
  'Pagamento e Demais Créditos',
  'Compra Data Descrição Parcela R$ US$',
  '03/08 PAGAMENTO DE FATURA-INTERNET -1.234,56',
  '10/07 LOJA GAMA -0,02',
  'Parcelamentos',
  'Compra Data Descrição Parcela R$ US$',
  '02/07 LOJA GAMA 03/10 100,00',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '3 07/08 MERCADO ALFA 103 45,00',
  '3 19/08 POSTO BETA 51,90 3 20/08 FARMACIA DELTA 39,90',
  'VALOR TOTAL 236,80 0,00',
  '2/4',
].join('\n');
