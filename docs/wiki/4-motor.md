# Motor por baixo dos panos

Não há estado escondido: tudo é recalculado em memória a partir dos dados brutos a cada mudança.

## Projeção de saldo

O app calcula o saldo dia a dia, do início da box selecionada até o [[horizonte de projeção]], em três versões: o saldo efetivo (só o que já é confirmado), o saldo projetado (efetivo mais previstos) e o saldo com cenários (projetado mais os lançamentos dos [cenários](#glossario/cenario) ligados).

É a mesma conta que alimenta o gráfico do Fluxo, o card do Hoje e a linha tracejada de cenário. [Como o motor calcula por dentro](#codigo/motor-de-projecao).

## Fronteira do hoje e pendentes

Um previsto com data igual ou anterior a hoje não vira efetivo sozinho: entra na fila de **pendentes**, no topo da tela Hoje. Vale para previstos de qualquer origem (manual, recorrência ou fatura de cartão), exceto os de um cenário.

- **Confirmar** (✓): marca como efetivo, com chance de ajustar o valor antes.
- **Descartar** (✕): exclui o lançamento — e ele não volta sozinho depois.

> Com um previsto **futuro** é o contrário: apagá-lo pelo Fluxo não adianta, se ele veio de uma recorrência ou de uma fatura de cartão — ele volta sozinho, porque a regra ainda o espera. Para mudar de vez, edite a regra: a recorrência em Ajustes → Recorrências, ou as compras do cartão.

Resultado: o saldo efetivo nunca contém suposição, só o que de fato aconteceu.

## Consolidação da casa

Selecionar **casa** no topo não troca para uma box de verdade: soma {{boxA}} + {{boxB}} + os lançamentos próprios da box casa (energia, água, ajustes), sempre na hora. Como o valor nunca fica guardado à parte, ele nunca destoa das boxes individuais.
