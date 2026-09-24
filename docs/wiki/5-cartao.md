# Cartão de crédito

Itemização das compras no cartão, com a [[fatura]] calculada — não armazenada — e reduzida a um único lançamento no fluxo de caixa da box, no dia do vencimento.

## Cartão, compras e assinaturas

Quatro entidades novas. Nenhuma "fatura" é gravada — ela é sempre recalculada.

: `Cartao` | um por box; `diaFechamento`, `diaVencimento`, e a `categoriaFaturaId` (categoria de gasto da box que recebe o lançamento da fatura — por padrão, "cartão")
: `CategoriaCartao` | categorias próprias do cartão (mercado, restaurante, assinatura…), separadas das categorias da box
: `CompraCartao` | `valorTotal`, `parcelas` (1 = à vista), `data` da compra, `descricao?`
: `RecorrenciaCartao` | uma assinatura — mesma lógica de materialização das recorrências do Flow, gerando `CompraCartao` futuras
: `ConferenciaFatura` | valor digitado a partir do app do banco, por cartão + mês, com a opção de **usar esse valor** no lugar da soma dos itens

Uma box pode ter vários cartões **ativos** ao mesmo tempo. "Ativo" controla a sincronização da fatura com o Flow (ver [Sincronização com o Flow](#cartao/sincronizacao-com-o-flow), abaixo). Um segundo controle, independente do primeiro, bloqueia só as compras avulsas novas — a fatura e as assinaturas continuam funcionando; ver [Cartões](#ajustes/cartoes), no capítulo Ajustes.

Cada compra pode ter uma nota fiscal anexada. No formulário da compra, "Anexar nota fiscal" aceita o XML da NFC-e — por arquivo ou colando o texto — e guarda a lista de itens.

- A lista mostra item, valor e percentual do total da compra, do maior para o menor.
- A compra manda: o valor dela não muda ao anexar a nota. Quando a soma dos itens não fecha com o valor da compra, uma linha final mostra a diferença (desconto, frete ou acréscimo).
- Uma compra tem no máximo uma nota: anexar de novo substitui a anterior.
- Só os itens ficam guardados; o arquivo XML não.
- Excluir a compra apaga a nota junto.

## Ciclo de fechamento e fatura

- **Compra no dia do fechamento entra na fatura seguinte** — é assim na maioria dos cartões. A fatura que fecha em `F/M` contém compras de `F/(M−1)` até `(F−1)/M`, inclusive.
- **Vencimento:** se `diaVencimento > diaFechamento`, vence no mesmo mês do fechamento; senão, no mês seguinte.
- **Parcelas ao centavo:** o valor total é dividido em N parcelas inteiras; o resto vai na primeira (ex.: R$ 100,00 em 3x → 33,34 + 33,33 + 33,33). A parcela 1 cai na fatura da data da compra; a parcela k cai k−1 meses depois.
- **Fronteira rígida:** compras do cartão nunca entram no motor de projeção — só o lançamento-resumo da fatura entra no fluxo da box. Sem contagem dupla.

Faturas passadas não ficam "congeladas": mudar o dia de fechamento reagrupa o detalhamento histórico. O que já foi confirmado no Flow (lançamento efetivo) não muda — só a "explicação" itemizada se reorganiza.

Fechou num dia diferente do combinado, só naquele mês? A aba Conferência da fatura tem um ajuste pontual para isso, logo abaixo da conferência de valor: o campo **Fechou dia**, com os botões **Salvar fechamento** e **Remover fechamento**. O ajuste vale só para o mês daquela fatura — o dia de fechamento cadastrado no cartão não muda, e os meses seguintes continuam usando o padrão. Como qualquer mudança de fechamento, ele pode mover compras perto da virada para a fatura vizinha; lançamento já confirmado não muda.

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

Quando você paga menos que o total, a folha pergunta o destino da diferença:

- **Mês seguinte** (já vem marcada): o que sobrou vai inteiro para a próxima fatura. O valor vem preenchido; se o banco cobrou juros, digite por cima o valor que ele mostra.
- **Parcelei:** o banco fez um [parcelamento](#glossario/parcelamento-de-fatura). Informe em quantas vezes e quanto é cada parcela, como o app do banco mostra.
- **Não volta:** para desconto ou estorno. A tela avisa **em destaque** que esse valor some da projeção.

> O Flow não calcula juros. Você digita a parcela que o banco cobrou; se houver juros, eles já estão embutidos ali. A tela só mostra a diferença entre o que vai ser pago e o que ficou de fora.

O parcelamento vira uma compra parcelada numa categoria reservada chamada "Parcelamento", então ele aparece nas faturas seguintes como qualquer outra parcelada, com a contagem `1/3`. Quem manda na data das parcelas é o fechamento do cartão, não o dia em que você quitou a fatura anterior.

- Parcelas cujo vencimento já passou não viram lançamento — registrar um parcelamento meses depois não ressuscita faturas antigas nem cobra duas vezes.
- Excluir a compra do parcelamento remove as parcelas futuras, mas **não** devolve o valor original à fatura que já foi paga. Essa reversão é na mão.

O "Mês seguinte" usa o mesmo caminho: vira uma compra de uma parcela só, chamada "Restante da fatura de MM/AAAA", na mesma categoria "Parcelamento".

Corrigindo uma fatura cujo restante já foi lançado, a folha mostra quanto já está na próxima fatura e abre em **Não volta**, para não lançar duas vezes.

Pagou **mais** que a fatura? A folha avisa o excesso. O banco costuma abater da fatura seguinte, mas o Flow ainda não registra esse crédito.

## Quando a fatura não bate com o Fluxo

A aba Cartão mostra um aviso âmbar, logo abaixo das datas da fatura — e a folha que abre ao tocar na fatura no Fluxo mostra o mesmo aviso —, quando o total dela e o que o Fluxo considera são diferentes e o app não tem como explicar a diferença:

- **"Essa fatura ficou de fora do Fluxo":** todas as compras da fatura foram lançadas depois do vencimento, e fatura vencida não vira lançamento novo. Se ela já foi paga no banco, o saldo está certo e não há nada a fazer.
- **"Tem R$ X nessa fatura que não chegaram no Fluxo":** a fatura foi paga, e depois entrou mais compra no mesmo ciclo. Fatura paga nunca é recalculada, então a diferença fica de fora. O link **Corrigir o valor pago** abre a mesma folha de "corrigir ou parcelar", já com o valor que fecha a conta.

O aviso não aparece quando a diferença tem explicação: um parcelamento registrado da fatura, ou um pagamento maior que a fatura (aí o saldo já está certo, e quem mostra as compras que faltam é a aba Conferência).
