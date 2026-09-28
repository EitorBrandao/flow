# Categorias do cartão na aba Análises

Data: 2026-09-28. Branch: `categorias-cartao-analises`.

Status: desenho e mockup aprovados em 2026-09-28.

O branch tem duas partes, nesta ordem:

1. **Texto não dança** — correção do app inteiro (seção própria abaixo). Vem antes porque o
   Comparativo e a tabela nova dependem dela.
2. **Categorias do cartão** — a funcionalidade nova.

## Problema

O usuário quer ver quanto uma categoria do cartão (Mercado, Restaurante etc.) pesou ao longo
dos meses. Hoje o app mostra essas categorias só um mês por vez: no Cartão → Resumo e na folha
da fatura em Análises. O Comparativo e a Evolução mensal de Análises usam só as categorias da
box. Nelas, o cartão inteiro é uma linha só: a categoria da fatura.

## Decisões (com o usuário, 2026-09-28)

1. **Lugar:** um card novo, **"Categorias do cartão"**, na aba Análises, logo abaixo do card
   Comparativo.
2. **Formato:** tabela com as colunas do Comparativo — Categoria, mês escolhido, mês anterior,
   ano passado, média 3m. Tocar numa linha abre uma folha com os últimos 6 meses da categoria.
3. **Vários cartões:** um bloco por cartão, com o nome do cartão como subtítulo. Com um só
   cartão no card, o subtítulo não aparece. Categorias de cartões diferentes nunca se somam,
   mesmo com nomes iguais.

## Parte 1 — Texto não dança

Regra do usuário (2026-09-28): nenhum texto "dança" no app. Itens da mesma coluna ou da mesma
lista têm o mesmo tamanho, o mesmo peso e números de largura fixa, com cor ou sem; os
centavos ficam alinhados.

**Causa:** `classeEfeito` (`src/domain/money.ts`) devolve `undefined` para zero. Sem classe, o
valor perde junto a tipografia de `.valor-ganho`/`.valor-gasto` (14,5px, peso 700,
`tabular-nums`) e herda a do container (em geral 16px, peso 400).

**Correção:**

- Classe nova **`.valor-neutro`** em `src/styles.css`, ao lado de `.valor-ganho`/`.valor-gasto`:
  a mesma tipografia, o mesmo `padding`, `border-radius` e `white-space`, sem cor própria e sem
  fundo. Entra em todas as regras que hoje listam `.valor-ganho, .valor-gasto`: a exceção de
  pílula em `.tabela` e em `strong`, o peso 400 de `.lista-fluxo .item`, e o `.editavel`.
- `classeEfeito` passa a devolver `'valor-neutro'` para zero. O tipo de retorno perde o
  `undefined`. Zero continua sem cor: a regra de cor não muda.
- Pontos que escolhem a classe na mão passam a usar a classe neutra no zero:
  - `TabelaSimulacao.tsx`: o "—" da coluna Diferença vai dentro de
    `<strong className="valor-neutro">`.
  - `TelaAnalises.tsx`, Comparativo: a célula "—" da média 3m (sem dados) recebe
    `valor-neutro`.
  - `FaturaCategoriaSheet.tsx` e `FaturaResumo.tsx`: o total do cabeçalho troca o ternário
    manual por `classeEfeito(-total)`, com sinal de gasto.
  - `TelaHoje.tsx` (Pendentes): o `?? ''` sai, porque `classeEfeito` não devolve mais
    `undefined`.
- **Coluna fixa das tabelas (`table.tabela`):** a primeira célula ganha uma sombra de 2px na
  cor do card à esquerda (`-2px 0 0 var(--surface)`), antes da sombra atual. Ela cobre a fresta
  de 1px por onde o valor que rola aparecia como um fiapo vermelho na tela do celular
  (densidade 2,63).
- Docs: `docs/estilo/fundamentos.md` (movimento zero: sem cor, mesma tipografia) e
  `docs/estilo/catalogo.md` (`.valor-neutro`).

Pontos de chamada de `classeEfeito` (grep, 2026-09-28): `LinhaConferencia.tsx`,
`Recorrencias.tsx`, `CenarioCard.tsx` (3), `ComposicaoBarChart.tsx`, `LancamentosSheet.tsx`,
`TabelaSimulacao.tsx`, `TelaAnalises.tsx` (8), `TelaFluxo.tsx`, `TelaHoje.tsx` (2),
`ViagemSheet.tsx` (3). Todos passam a receber a classe neutra no zero sem mudança no próprio
arquivo, fora os listados acima.

Testes: `money.test.ts` troca `toBeUndefined()` por `toBe('valor-neutro')`. Os testes de UI que
conferem "sem cor" com `not.toHaveClass('valor-gasto')` continuam valendo; os casos de zero
ganham `toHaveClass('valor-neutro')`.

## Regras da conta

- **Mês = mês de vencimento da fatura**, a mesma chave de `Fatura.mes`. Cada parcela conta na
  fatura em que cai, com o valor de `valorParcela`. A conta é a de `calcularFaturas`, com os
  ajustes de fechamento do cartão (`ajustesDoCartao`). Consequência verificável: a coluna do
  mês escolhido é igual, centavo a centavo, ao Cartão → Resumo da mesma fatura.
- **Linhas = as mesmas do Cartão → Resumo.** Entram as categorias reservadas (Assinaturas e
  Parcelamento de fatura), quando têm valor. Categoria arquivada entra se tiver valor em algum
  mês comparado: é histórico.
- **Uma linha aparece** se a categoria tiver valor diferente de zero no mês escolhido, no mês
  anterior ou no ano passado — a mesma regra de `compararMeses`. Um cartão sem nenhuma linha
  não aparece. Sem nenhuma linha no card inteiro, o card mostra "Sem gastos no cartão para
  comparar.".
- **Cartões do card:** todos os cartões cuja `boxId` está nas boxes selecionadas
  (`boxIdsSelecionadas`), inclusive os inativos — um cartão desativado ainda tem histórico.
  Ordem dos blocos: a ordem de `dados.cartoes`. Ordem das linhas: decrescente pelo valor no mês escolhido; empate pelo mês anterior e depois por `compararCategoriasCartao` (pedido do usuário, 2026-09-28, depois da v0.49.0).
- **Média 3m:** `mediaMovel3` sobre os meses `[mês − 2, mês − 1, mês]`, último valor. Mesma
  função da coluna do Comparativo.
- **"incluir previstos" não afeta o card.** Compra no cartão não tem `status`; o resumo de
  Assinaturas já segue essa regra.
- **Cor:** a do Comparativo — `classeEfeito(efeitoNoSaldo(valor, 'gasto'))`. Gasto fica
  vermelho, estorno maior que o gasto fica verde, zero fica sem cor (`.valor-neutro`). Valor
  sem sinal, formato completo (`formatarBRL`, "R$ 1.240,00").

## Tabela (mockup aprovado)

- Subtítulo do card, sob o título: "pelo mês da fatura" (`.sub`).
- Linha do cartão: a primeira célula leva o nome em `.rotulo-grupo`, sem quebra de linha
  (`white-space: nowrap`); o resto da linha é uma célula vazia com `colSpan={4}`. Nunca
  `colSpan` na primeira célula: a coluna fixa não segura uma célula mais larga que ela, e o
  nome rolaria junto com os valores.
- Nome da categoria: um `<button>` com a classe nova **`.tabela-nome-tocavel`** — sem fundo,
  sem borda, sem padding, cor `var(--ac)`, tamanho e peso herdados da célula, alinhado à
  esquerda. Mesmo tamanho dos nomes do Comparativo (não usar `.botao-ver-mais`, que é 13px).

## Folha de detalhe

- Título: `<categoria> · <cartão>`. Sob ele, em `.sub`: "últimos 6 meses, pelo mês da fatura".
- Rótulo de cada mês: `mesAbreviado` ("abr/2026").
- Corpo: os 6 meses que terminam no mês escolhido, do mais antigo ao mais novo, um por linha,
  em barras horizontais. Reaproveita as classes `.composicao-lista`, `.composicao-linha`,
  `.composicao-rotulo`, `.composicao-nome`, `.composicao-valores`, `.composicao-trilho` e
  `.composicao-preenchimento` (`gasto`; `ganho` quando o mês é estorno líquido). O valor de
  cada mês vai num `<strong>` com `classeEfeito(efeitoNoSaldo(valor, 'gasto'))`. As linhas da
  folha não são clicáveis: sem `role="button"` e com `cursor: default`.
- Escala: 100% = o maior valor absoluto entre os 6 meses. Todos zero: barras vazias.
- Rodapé: "média 6m" com a média arredondada dos 6 meses, na mesma cor da regra acima.
- Classes novas do branch inteiro: só `.valor-neutro` e `.tabela-nome-tocavel`, ambas
  catalogadas em `docs/estilo/catalogo.md`.

## Código

- **Domínio — `src/domain/fatura.ts`:** uma função pura nova,
  `totaisCategoriaCartaoPorMes(cartao, compras, meses, ajustes)`. Devolve
  `Map<categoriaCartaoId, number[]>`, um valor por mês, na ordem de `meses`. Chama
  `calcularFaturas` uma vez, com `ate` igual ao vencimento do maior mês pedido. A tabela e a
  folha usam só essa função, para nunca discordarem.
- **UI:**
  - `src/ui/CategoriasCartaoCard.tsx` — o card, com os blocos por cartão.
  - `src/ui/CategoriaCartaoHistoricoSheet.tsx` — a folha, sobre `Sheet.tsx`.
  - `TelaAnalises.tsx` só monta os dois e guarda qual linha está aberta.
- Catalogar os dois componentes novos em `docs/estilo/catalogo.md`.

## Testes

Domínio (`src/domain/fatura.test.ts`):

- Compra parcelada em 3× conta uma parcela em cada uma das 3 faturas.
- Compra perto do fechamento cai na fatura seguinte; com ajuste de fechamento, na certa.
- Estorno (valor negativo) reduz o total do mês.
- Mês sem compra devolve 0 na posição certa.
- Igualdade com `resumoPorCategoria(fatura)` para o mesmo mês.

UI:

- Card: bloco por cartão só com mais de um cartão; cartão de outra box fora; categoria
  arquivada com valor aparece; linha some quando os três meses são zero; mensagem de vazio.
- Folha: 6 meses na ordem certa, rótulos dos meses, média 6m.

## Entrega

Mockup com as classes reais, pelo chat, antes do código. Depois: wiki (`docs/wiki/6-telas.md`,
seção de Análises), fragmentos `adicionado-categorias-cartao-analises.md` e
`alterado-valores-zerados-alinhados.md`, varredura com Playwright
no Galaxy S25+, e o ciclo de entrega.

## Fora do escopo

- Somar categorias de cartões diferentes pelo nome.
- Gráfico de linha ou colunas por mês na tabela.
- Atalho da folha para a aba Cartão.
