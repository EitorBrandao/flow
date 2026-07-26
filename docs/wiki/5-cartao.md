# Cartão de crédito

Itemização das compras no cartão, com a fatura calculada — não armazenada — e reduzida a um único lançamento no fluxo de caixa da box, no dia do vencimento.

## Cartão, compras e assinaturas

Quatro entidades novas. Nenhuma "fatura" é gravada — ela é sempre recalculada.

: `Cartao` | um por box; `diaFechamento`, `diaVencimento`, e a `categoriaFaturaId` (categoria de gasto da box que recebe o lançamento da fatura — por padrão, "cartão")
: `CategoriaCartao` | categorias próprias do cartão (mercado, restaurante, assinatura…), separadas das categorias da box
: `CompraCartao` | `valorTotal`, `parcelas` (1 = à vista), `data` da compra, `descricao?`
: `RecorrenciaCartao` | uma assinatura — mesma lógica de materialização das recorrências do Flow, gerando `CompraCartao` futuras
: `ConferenciaFatura` | valor digitado a partir do app do banco, por cartão + mês, com a opção de **usar esse valor** no lugar da soma dos itens

Um cartão **ativo** por box: cadastrar um segundo exige desativar o anterior primeiro.

## Ciclo de fechamento e fatura

- **Compra no dia do fechamento entra na fatura seguinte** — é assim na maioria dos cartões. A fatura que fecha em `F/M` contém compras de `F/(M−1)` até `(F−1)/M`, inclusive.
- **Vencimento:** se `diaVencimento > diaFechamento`, vence no mesmo mês do fechamento; senão, no mês seguinte.
- **Parcelas ao centavo:** o valor total é dividido em N parcelas inteiras; o resto vai na primeira (ex.: R$ 100,00 em 3x → 33,34 + 33,33 + 33,33). A parcela 1 cai na fatura da data da compra; a parcela k cai k−1 meses depois.
- **Fronteira rígida:** compras do cartão nunca entram no motor de projeção — só o lançamento-resumo da fatura entra no fluxo da box. Sem contagem dupla.

Faturas passadas não ficam "congeladas": mudar o dia de fechamento reagrupa o detalhamento histórico. O que já foi confirmado no Flow (lançamento efetivo) não muda — só a "explicação" itemizada se reorganiza.

## Sincronização com o Flow

Para cada fatura com valor > 0, o app mantém um lançamento `previsto` na box do cartão, na categoria da fatura, com data = vencimento. O valor sincronizado é a soma dos itens — **a menos que** a conferência daquele mês tenha "usar valor do app" marcado, caso em que vale o valor digitado.

- Lançamento já `efetivo` (fatura confirmada) nunca é tocado nem recriado.
- Previsto descartado pelo usuário não ressuscita — por isso, um previsto *novo* só é criado se o vencimento for depois de hoje.
- Um previsto já existente continua sendo atualizado ao vivo mesmo com vencimento no passado (é aí que ele vira pendente).
- Fatura que zera (ou cartão desativado) remove o previsto; lançamentos efetivos ficam intactos.

No vencimento, a confirmação é a mesma fila de pendentes de qualquer outro lançamento — nenhum fluxo novo.
