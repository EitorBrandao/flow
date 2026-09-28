# Categorias do cartão na aba Análises

Data: 2026-09-28. Branch: `categorias-cartao-analises`.

Status: desenho aprovado em 2026-09-28; mockup pendente.

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
  Ordem dos blocos: a ordem de `dados.cartoes`. Ordem das linhas: `compararCategorias`.
- **Média 3m:** `mediaMovel3` sobre os meses `[mês − 2, mês − 1, mês]`, último valor. Mesma
  função da coluna do Comparativo.
- **"incluir previstos" não afeta o card.** Compra no cartão não tem `status`; o resumo de
  Assinaturas já segue essa regra.
- **Cor:** a do Comparativo — `classeEfeito(efeitoNoSaldo(valor, 'gasto'))`. Gasto fica
  vermelho, estorno maior que o gasto fica verde, zero fica sem cor. Valor sem sinal.

## Folha de detalhe

- Título: `<categoria> · <cartão>`.
- Corpo: os 6 meses que terminam no mês escolhido, do mais antigo ao mais novo, um por linha,
  em barras horizontais. Reaproveita as classes `.composicao-lista`, `.composicao-linha`,
  `.composicao-rotulo`, `.composicao-nome`, `.composicao-valores`, `.composicao-trilho` e
  `.composicao-preenchimento gasto`. As linhas da folha não são clicáveis: sem `role="button"`.
- Escala: 100% = o maior valor absoluto entre os 6 meses. Todos zero: barras vazias.
- Rodapé: "média 6m" com a média arredondada dos 6 meses, na mesma cor da regra acima.
- Nenhuma classe nova. Se o mockup mostrar que falta uma, ela passa pelo catálogo
  (`docs/estilo/catalogo.md`).

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

Mockup com as classes reais, pelo chat, antes do código. Depois: wiki (`docs/wiki/`, capítulo
de Análises), fragmento `adicionado-categorias-cartao-analises.md`, varredura com Playwright
no Galaxy S25+, e o ciclo de entrega.

## Fora do escopo

- Somar categorias de cartões diferentes pelo nome.
- Gráfico de linha ou colunas por mês na tabela.
- Atalho da folha para a aba Cartão.
