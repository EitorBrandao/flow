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

/** Duas faturas de cartão no mesmo PDF: titular e um cartão virtual (prefixo "@ ").
 *  O cabeçalho de colunas do segundo bloco vem COLADO à transação, de propósito: é o formato
 *  que a extração do PDF real produziu, e foi o caso que um filtro de ruído mal ancorado
 *  chegou a engolir por inteiro. */
export const FATURA_DOIS_CARTOES = [
  'Detalhamento da Fatura',
  'FULANO DE TAL - 0000 XXXX XXXX 0000',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '3 07/08 MERCADO ALFA 45,00',
  'VALOR TOTAL 45,00 0,00',
  '@ FULANO DE TAL - 1234 5678 9012 3456',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$ 3 19/08 POSTO BETA 51,90',
  'VALOR TOTAL 51,90 0,00',
  '3/4',
].join('\n');

/**
 * Fatura completa, com a página 1 (cabeçalho, boleto, autenticação mecânica) na frente do
 * detalhamento, e o "Resumo da Fatura" depois dele — a forma real que o pdf.js entrega,
 * descrita pelo usuário com todo conteúdo trocado por dado sintético.
 *
 * O cabeçalho de cartão da página 1 (`FULANO DE TAL - 1234 XXXX XXXX 5678`, sozinho na linha,
 * acima de "Total a Pagar") tem a MESMA forma do cabeçalho de bloco dentro do detalhamento. Sem
 * a delimitação pela primeira linha "Detalhamento da Fatura", ele abre um bloco fantasma, e todo
 * o resto da página 1 — resumo, boleto, autenticação — vira "linha ignorada". É esse bug que
 * esta fixture prova.
 *
 * O título "Detalhamento da Fatura" se repete no meio (página 3 do arquivo real): essa segunda
 * ocorrência é ruído dentro da região, não um novo início.
 */
export const FATURA_SANTANDER_COMPLETA = [
  // --- Página 1: fora do detalhamento. Nada daqui deve virar bloco, transação, ou contar
  // como linha ignorada. ---
  'FULANO DE TAL - 1234 XXXX XXXX 5678',
  'Total a Pagar',
  '136,80',
  'Vencimento',
  '15/10/2026',
  'Seu limite é',
  '10.000,00',
  'Pagamento mínimo',
  '20,52',
  'Ficha de Compensação',
  'Recibo do Pagador',
  'Autenticação Mecânica',
  'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6',
  '1/4',
  // --- Início real do detalhamento. ---
  'Detalhamento da Fatura',
  'FULANO DE TAL - 1234 XXXX XXXX 5678',
  'Pagamento e Demais Créditos',
  'Compra Data Descrição Parcela R$ US$',
  '03/08 PAGAMENTO DE FATURA-INTERNET -1.234,56',
  'Parcelamentos',
  'Compra Data Descrição Parcela R$ US$',
  '05/04 FARMACIA DELTA 10/10 51,90',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '3 12/03 LOJA GAMA 45,00',
  'VALOR TOTAL 96,90 0,00',
  // Página 3: o título se repete, mas segue sendo a mesma região.
  '2/4',
  'Detalhamento da Fatura',
  '@ FULANO DE TAL - 1234 XXXX XXXX 5678',
  'Pagamento e Demais Créditos',
  'Compra Data Descrição Parcela R$ US$',
  '08/02 POSTO BETA -12,34',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '19/08 POSTO BETA 39,90',
  'VALOR TOTAL 39,90 0,00',
  '3/4',
  // --- Fim do detalhamento: nada daqui em diante deve ser lido. ---
  'Resumo da Fatura',
  '(+) Compras e Saques 136,80',
  '(+) IOF 0,00',
  '(-) Pagamentos -1.234,56',
  '(=) Total 136,80',
  '4/4',
].join('\n');
