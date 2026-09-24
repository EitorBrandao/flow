# Conceitos e modelo de dados

Os conceitos por trás de tudo que o app guarda.

## Box

Um fluxo de caixa com saldo próprio — nos exemplos desta documentação, {{boxA}} e {{boxB}}. O saldo inicial e a data de início ficam no cadastro da box (veja [A primeira box](#primeiros-passos/a-primeira-box)); o saldo que o banco mostra, informado de vez em quando para conferir, é um dado à parte.

A [[box casa]] é especial: não tem saldo próprio, só guarda os lançamentos compartilhados. A visão consolidada da casa soma {{boxA}} + {{boxB}} + os lançamentos da box casa, sempre na hora — nunca fica guardada pronta. Veja [Consolidação da casa](#motor/consolidacao-da-casa), no capítulo Motor por baixo dos panos.

## Categoria

Pertence a uma box. Tem um tipo — ganho ou gasto — e uma ordem, que decide a posição nas listas e na grade de Lançar.

- "pix" pode existir duas vezes na mesma box: uma vez como ganho, outra como gasto.
- Arquivar tira a categoria da tela Lançar e dos formulários, mas preserva o histórico dos lançamentos já feitos com ela.

## Lançamento

O registro central do fluxo de caixa. Tem um status — efetivo ou previsto — e uma origem, que diz de onde ele veio: digitado na hora, gerado por uma recorrência, ou o resumo de uma fatura do cartão.

[[efetivo]] entra no saldo real; [[previsto]] só entra na projeção. Um previsto cuja data já passou vira um [[pendente]] — veja [Fronteira do hoje e pendentes](#motor/fronteira-do-hoje-e-pendentes), no capítulo Motor por baixo dos panos. [Os campos por trás do lançamento](#codigo/lancamentos-status-e-origem).

## Recorrência

Regra que gera lançamentos previstos automaticamente no futuro — salário, aluguel, empréstimos, assinaturas do Flow (fora do cartão).

Editar a regra ajusta na hora os previstos ainda não confirmados que não batem mais com ela — pendentes (data já passada) inclusive. Desativar tira da projeção todos os previstos ainda não confirmados da regra; ativar volta a gerar os previstos a partir de hoje. Um previsto já confirmado nunca é mexido, mesmo que a regra mude depois. [Como o app mantém os previstos em dia](#codigo/recorrencias-e-materializacao).

## Cenário

Um "e se?" — lançamentos hipotéticos (pontuais ou parcelados) agrupados sob um nome, com um interruptor ligado/desligado.

- Só entra na projeção de saldo quando está ligado — aparece como linha tracejada extra no gráfico do Fluxo e do Hoje.
- Lançamentos de cenário nunca contam como confirmados; não entram nas Análises nem nos totais mensais.
- **Tornar real** converte os lançamentos (ou a recorrência) do cenário em dados reais da box de origem.

## Viagem

Um período com nome — data inicial e data final, inclusive — que junta os gastos feitos nele, para você ver quanto a viagem custou no total.

- **Cadastro:** em Ajustes → Viagens. Duas viagens não podem ter períodos que se sobrepõem.
- **Marcação:** em Lançar e em Nova compra do cartão, quando a data do lançamento cai numa viagem, aparece a opção "Viagem: nome", já marcada. Desmarque se o gasto não for da viagem.
- **Onde aparece:** nas [Análises](#telas/analises), o card Viagens lista cada viagem com o total gasto; tocar abre o detalhamento, agrupado pela descrição. Em "Por categoria", a viagem vira uma linha própria com o que ela pesou naquele mês.
- Compra parcelada no cartão conta pelo valor cheio no total da viagem, mas, em "Por categoria", cada parcela cai no mês da fatura em que vence.
- Excluir uma viagem não apaga nada: os lançamentos e as compras continuam existindo, só perdem a marcação.

## Configurações

Preferências do app: qual box abre sozinha ao iniciar — só vale para uma com saldo próprio — e até quando o app projeta o saldo à frente. [Os campos de configuração](#codigo/modelo-de-dados).
