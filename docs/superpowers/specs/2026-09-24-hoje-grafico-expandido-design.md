# Hoje abre o gráfico expandido — design

Fecha o item 8 do TODO (entrega 2 e o resto da entrega 1) e o item 24, juntos.

## Contexto

O item 8 previa, na entrega 2, um tooltip ao tocar no `BalanceChart`, em três lugares: Hoje,
Fluxo e gráfico expandido. A exploração mostrou que o gráfico expandido (`FluxoChartModal`)
**já tem** leitura por toque: arrastar o dedo mostra o saldo e a data do dia no cabeçalho. O
card do Fluxo já abre esse modal ao toque.

O único gráfico sem resposta ao toque é o mini-gráfico da Hoje. O item 24 pedia justo isso:
tocar nele leva à projeção inteira.

## Decisão

Um único gesto de leitura em todo o app: o do gráfico expandido. Nenhum tooltip novo. Um
tooltip num gráfico de 120 px ficaria minúsculo, e disputaria o toque com a navegação.

## 1. Hoje → gráfico expandido

- O card da Visão (rótulo, saldo, pílula, projetado e mini-gráfico) vira um botão inteiro.
- O botão usa as classes do card do Fluxo: `card grafico-expandido-abrir`. O ícone ⤢
  (`Maximize2`, classe `grafico-expandido-icone`) fica no canto superior direito. Nenhuma
  classe nova.
- O botão tem `aria-label="Expandir gráfico de saldo"`, igual ao do Fluxo.
- Tocar abre o `FluxoChartModal` por cima da Hoje. O modal recebe a **série inteira** (`serie`,
  a mesma de `projetarBoxes` que o Fluxo usa: boxes selecionadas e cenários ligados), não a
  janela de 35 dias do mini-gráfico.
- Fechar o modal volta para a Hoje, na aba Visão.
- Série com menos de 2 dias: o card fica como hoje, sem botão e sem ícone — igual ao Fluxo.
- O botão "Último backup" continua fora do card. Não há botão dentro de botão.
- O modal carrega com `lazy` + `Suspense`, como no Fluxo.
- O conteúdo do card usa só elementos de frase dentro do botão (`span` com `display: block`
  no lugar de `p`), porque `button` não aceita `p` como filho. Se a troca mudar a aparência, o
  estilo inline existente se mantém nos `span`.

## 2. Fluxo: "A projeção começa em …"

- Com filtro por data ativo, um dia **anterior** ao primeiro dia da série mostra hoje `—` e
  "Nenhum lançamento neste dia.", sem explicar o traço.
- Passa a mostrar também `A projeção começa em DD/MM/AAAA.`, com a data do primeiro dia da
  série, no molde de `A projeção vai até DD/MM/AAAA.` (depois do horizonte).
- A frase "Nenhum lançamento neste dia." continua como está.

## Consistência

- Os dois cards com gráfico (Hoje e Fluxo) passam a ter o mesmo sinal (⤢), o mesmo gesto e o
  mesmo destino.
- As duas frases de borda da projeção usam a mesma forma e a mesma classe (`sub`).

## Testes

- Hoje: tocar no card abre o gráfico expandido; o modal mostra o período da série inteira;
  fechar volta à Hoje.
- Hoje: série curta não mostra o botão.
- Fluxo: filtrar um dia antes do início da série mostra "A projeção começa em …".

## Entrega

- Mockup aprovado antes do código (mudança de UI).
- Wiki: `docs/wiki/6-telas.md`, parágrafo da Visão (toque no card abre em tela cheia) e, se
  couber, o do filtro por data do Fluxo.
- Fragmento `changelog.d/alterado-hoje-grafico-expandido.md`.
- TODO: itens 8 e 24 fecham.
