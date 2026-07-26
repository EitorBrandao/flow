# Motor por baixo dos panos

Não há estado escondido: tudo é recalculado em memória a partir dos dados brutos a cada mudança.

## Projeção de saldo

`projetarBoxes(boxIds, dados)` é uma função pura que devolve, para cada dia entre o início das boxes selecionadas e o horizonte de projeção, três números:

: `saldoEfetivo` | soma apenas de lançamentos confirmados
: `saldoProjetado` | efetivo + previstos
: `saldoComCenarios` | projetado + lançamentos dos cenários ligados

É a mesma série que alimenta o gráfico do Fluxo, o card do Hoje e a linha tracejada de cenário.

## Fronteira do hoje e pendentes

Um lançamento `previsto` com data igual ou anterior a hoje não vira efetivo sozinho — ele entra na fila de **pendentes**, mostrada no topo da tela Hoje. Isso vale para previstos de qualquer origem (manual, recorrência ou fatura de cartão), exceto os que pertencem a um cenário.

- **Confirmar** (✓): marca `efetivo`, com chance de ajustar o valor antes.
- **Descartar** (✕): exclui o lançamento — e ele não é recriado na próxima materialização.

Resultado: o saldo efetivo nunca contém suposição, só o que de fato aconteceu.

## Consolidação da casa

Selecionar **casa** no topo não troca para uma box de verdade — soma `{{boxA}}` + `{{boxB}}` + os lançamentos próprios da box casa (energia, água, ajustes). O resultado é calculado a cada renderização; não existe uma tabela "saldo da casa" gravada em disco, então o valor nunca dessincroniza das boxes individuais.
