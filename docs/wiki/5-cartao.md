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
- Previsto descartado pelo usuário não ressuscita — por isso, um **novo** previsto só é criado se o vencimento for depois de hoje.
- Um previsto já existente continua sendo atualizado ao vivo mesmo com vencimento no passado (é aí que ele vira pendente).
- Fatura que zera (ou cartão desativado) remove o previsto; lançamentos efetivos ficam intactos.

No vencimento, a confirmação é a mesma fila de pendentes de qualquer outro lançamento — nenhum fluxo novo.

## Pagar a fatura: valor, data e parcelamento

Nem toda fatura é paga inteira nem no dia do vencimento. Na fila de pendentes da tela Hoje, a fatura troca o "Descartar" por **"Paguei outro valor"** — fatura sempre acontece, o que varia é quanto foi pago dela. A aba Cartão oferece o mesmo pela fatura exibida, para quando você só lembra dias depois.

- **Quanto pagou:** já vem preenchido com o total, então confirmar sem mexer é o caminho curto.
- **Quando pagou:** numa fatura ainda em aberto vem com hoje, o que permite registrar pagamento adiantado — o valor sai da conta no dia certo, não no vencimento. Numa fatura já paga, o campo preserva a data registrada, para corrigir um valor não mover o dia sem querer.
- **Parcelou o restante no banco:** informe em quantas vezes e quanto é cada parcela, como o app do banco mostra.

> O Flow não calcula juros. Você digita a parcela que o banco cobrou; se houver juros, eles já estão embutidos ali. A tela só mostra a diferença entre o que vai ser pago e o que ficou de fora.

Sobrou valor e você não informou parcelamento? A tela avisa **em destaque** que esse valor some da projeção e não volta em nenhuma fatura. Salvar assim continua permitido — desconto e estorno existem —, mas depois de você ler o que vai acontecer.

O parcelamento vira uma compra parcelada numa categoria reservada chamada "Parcelamento", então ele aparece nas faturas seguintes como qualquer outra parcelada, com a contagem `1/3`. Quem manda na data das parcelas é o fechamento do cartão, não o dia em que você quitou a fatura anterior.

- Parcelas cujo vencimento já passou não viram lançamento — registrar um parcelamento meses depois não ressuscita faturas antigas nem cobra duas vezes.
- Excluir a compra do parcelamento remove as parcelas futuras, mas **não** devolve o valor original à fatura que já foi paga. Essa reversão é na mão.
