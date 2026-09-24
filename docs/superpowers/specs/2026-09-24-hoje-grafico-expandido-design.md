# Hoje leva ao gráfico do Fluxo — design

Fecha o item 8 do TODO (entrega 2 e o resto da entrega 1) e o item 24, juntos.

## Contexto

O item 8 previa, na entrega 2, um tooltip ao tocar no `BalanceChart`, em três lugares: Hoje,
Fluxo e gráfico expandido. A exploração mostrou que o gráfico expandido (`FluxoChartModal`)
**já tem** leitura por toque: arrastar o dedo mostra o saldo e a data do dia no cabeçalho. O
card da aba Gráfico do Fluxo já abre esse modal ao toque.

O item 24 pedia que a Hoje levasse ao gráfico do Fluxo. Hoje isso exige dois toques, e o
segundo é descoberta: o Fluxo abre sempre na Lista.

## Decisão

Cada gráfico tem um papel:

- **Hoje:** resumo curto, de 7 dias atrás a 28 à frente. Não responde a toque. A janela não
  muda.
- **Fluxo, aba Gráfico:** a projeção inteira, com a leitura dia a dia no gráfico expandido.

A Hoje ganha um link para o gráfico do Fluxo. Nenhum tooltip novo: a leitura de um dia fica
só no gráfico expandido, que já existe.

## 1. Link na Hoje

- Abaixo do mini-gráfico, dentro do card da Visão, um botão `Ver gráfico completo ›` com a
  classe `.botao-ver-mais`. Nenhuma classe nova.
- O botão leva à aba Fluxo, já na aba Gráfico.
- O card em si não fica tocável.
- Série com menos de 2 dias (o mini-gráfico não aparece): o link também não aparece.

## 2. Abrir o Fluxo numa aba escolhida

- A aba interna do Fluxo hoje é estado local (`useState<AbaFluxo>('lista')`, `TelaFluxo.tsx`).
- O store ganha `fluxoAba: AbaFluxo | null` e `abrirFluxo(aba)`, no molde de `ajustesSecao` e
  `abrirAjustes(secao)`. `abrirFluxo` troca `aba` para `'fluxo'` e guarda a aba pedida.
- O `TelaFluxo` usa `fluxoAba` como estado inicial, quando presente, e o limpa em seguida
  (`limparFluxoAba`), como a tela de Ajustes faz com `ajustesSecao`.
- A aba pedida vale **só na chegada**. Entrar no Fluxo pela barra de navegação continua
  abrindo na Lista.
- O tipo `AbaFluxo` sai de `TelaFluxo.tsx` para um lugar que o store importa sem depender da
  UI.

## 3. Fluxo: "A projeção começa em …"

- Com filtro por data ativo, um dia **anterior** ao primeiro dia da série mostra hoje `—` e
  "Nenhum lançamento neste dia.", sem explicar o traço.
- Passa a mostrar também `A projeção começa em DD/MM/AAAA.`, com a data do primeiro dia da
  série, no molde de `A projeção vai até DD/MM/AAAA.` (depois do horizonte).
- A frase "Nenhum lançamento neste dia." continua como está.

## Consistência

- O link reusa o precedente de `.botao-ver-mais` como navegação (`FaturaCategoriaSheet`,
  "abrir o cartão"). O `catalogo.md` hoje descreve a classe só como "mostrar/ocultar uma
  lista longa" — a descrição passa a incluir o uso como link de navegação dentro de um card.
- As duas frases de borda da projeção usam a mesma forma e a mesma classe (`sub`).

## Testes

- Hoje: o link aparece sob o mini-gráfico; tocar leva ao Fluxo na aba Gráfico.
- Hoje: série curta não mostra o link.
- Fluxo: entrar pela navegação depois disso abre na Lista.
- Fluxo: filtrar um dia antes do início da série mostra "A projeção começa em …".

## Entrega

- Mockup aprovado antes do código (mudança de UI).
- Wiki: `docs/wiki/6-telas.md`, parágrafo da Visão (o link) e, se couber, o do filtro por data
  do Fluxo.
- Fragmento `changelog.d/alterado-hoje-grafico-do-fluxo.md`.
- TODO: itens 8 e 24 fecham.
