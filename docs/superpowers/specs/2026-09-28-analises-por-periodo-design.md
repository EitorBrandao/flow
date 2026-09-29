# Análises por período e barra fixa sob o topo — design

Data: 2026-09-28. Branch: `analises-periodo`.
Mockup aprovado: `analises-periodo-mockup.html` (v2, enviado pelo chat em 2026-09-28).
A classe da barra fixa chamava `.seletor-fixo` no mockup; aqui ela é `.barra-fixa`, genérica, e a Wiki passa a usá-la.

## Objetivo

1. A aba Análises passa a analisar um **período**, não só um mês: o mês, os últimos 12 meses, um ano, ou um intervalo livre de meses.
2. O seletor de mês (ou de período) fica **fixo** logo abaixo da barra do topo, nas Análises e no Cartão. Hoje ele sai da tela ao rolar, e o usuário precisa voltar ao topo para trocar o mês.

## Parte 1 — Seletor de período (Análises)

Pílulas no topo da aba (`SeletorPills`): `Mês · 12 meses · Ano · Período`. O modo inicial é **Mês**, com o mês de hoje — o comportamento de hoje.

| Modo | Meses do período | Linha fixa `‹ rótulo ›` | Setas |
|---|---|---|---|
| Mês | só o mês escolhido | `setembro de 2026` (`nomeDoMes`) | ±1 mês |
| 12 meses | 12 meses que terminam no mês final; começa no mês de hoje | `out/2025 – set/2026` | ±1 mês na janela |
| Ano | jan a dez do ano; começa no **último ano fechado** (ano de hoje − 1) | `2025`; o ano de hoje leva a badge `até agora` | ±1 ano |
| Período | de `de` até `até`, inclusive; começa em `mês de hoje − 6` até o mês de hoje | `mar/2026 – set/2026` | desloca a janela inteira ±1 mês, sem mudar o tamanho |

- As setas não têm limite em nenhum modo, como o modo Mês de hoje. (O mockup desabilitava a seta › depois do ano de hoje; o design final remove esse limite, para não criar o estado de botão desabilitado, que não existe no catálogo.)
- **Período:** acima da linha fixa, e rolando junto com a tela, ficam duas linhas `de ‹ mar/2026 ›` e `até ‹ set/2026 ›`, e a nota `7 meses · máximo de 24`.
  - Mover `de` para depois de `até` arrasta `até` junto (e vice-versa): o período nunca fica invertido.
  - O período tem no máximo **24 meses**. Mover uma ponta além disso arrasta a outra ponta, e o total fica em 24.
- Trocar de modo não zera o estado dos outros modos. O estado vive na tela (`useState`), como o `mes` de hoje: sair da aba volta tudo ao modo Mês.
- "incluir previstos" continua igual e vale para todos os modos.

## Parte 2 — Os cards com vários meses

Com um mês só, todos os cards ficam **idênticos aos de hoje**. As regras abaixo valem para 2 meses ou mais (N = número de meses).

- **Resumo:** ganhos, gastos e sobra somados no período. Embaixo, a linha `média por mês: ganhos X · gastos Y · sobra Z` (arredondada ao centavo, `Math.round(total / N)`). As barras usam a mesma escala: 100% = o maior entre ganhos e gastos do período.
- **Por categoria:** total de cada categoria no período, e o percentual da renda do período. A linha Assinaturas soma as assinaturas de todas as faturas do período. Cada viagem com gasto no período ganha uma linha, com a soma dos meses. O subtítulo diz "…ganhos e gastos do período". Sem movimento: "Sem movimentos no período."
- **Evolução mensal:** um par de barras por mês do período (no modo Mês, continua com os 6 meses até o mês escolhido, com o mês escolhido em destaque; nos outros modos, nenhum mês fica em destaque).
  - A fileira de valores de sobra sobre as barras aparece só com **até 6 meses** no gráfico. Acima disso, ela dá lugar a uma linha única: `sobra do período R$ X`.
  - Com mais de 12 meses, o eixo mostra um rótulo a cada 3 meses, no formato `jan/25`.
- **Viagens:** não muda (lista todas as viagens, com o total de cada uma).
- **Comparativo** e **Categorias do cartão:** colunas `período · anterior · ano anterior · média/mês`.
  - Cabeçalho da 1ª coluna de valor: o ano (`2025`) no modo Ano, `12 meses` no modo 12 meses, `N meses` no modo Período.
  - **anterior** = os N meses imediatamente antes do período. **ano anterior** = os mesmos meses, 12 meses antes.
  - Com N = 12, os dois intervalos são iguais: a coluna "ano anterior" some.
  - Uma linha fina sob o título diz os intervalos: `anterior = out/2024 – set/2025 (é também o ano anterior)`, ou `anterior = ago/2025 – fev/2026 · ano anterior = mar/2025 – set/2025`. No card do cartão, ela vem depois de `pelo mês da fatura · `.
  - **média/mês** = total do período ÷ N, arredondado.
  - Uma linha aparece se alguma coluna tem valor, como hoje. Categorias do cartão continuam em ordem decrescente da 1ª coluna, e "incluir previstos" continua sem mudar esse card.

## Parte 3 — Toque numa categoria com vários meses

- **Categoria comum ou de fatura** (card Por categoria): abre a folha nova `CategoriaPeriodoSheet`. Cabeçalho: nome e total do período; embaixo, `out/2025 – set/2026 · toque num mês para ver os lançamentos` (ou `…ver a fatura`, na categoria de fatura). Conteúdo: uma barra por mês (classes `composicao-*`, a mesma composição do `CategoriaCartaoHistoricoSheet`) e, no fim, `média por mês X`.
  - Tocar num mês fecha essa folha e abre a folha de hoje daquele mês: `LancamentosSheet`, ou `FaturaCategoriaSheet` na categoria de fatura. Essa folha mostra `‹ voltar ao período` no topo, que volta para a folha do período.
- **Assinaturas:** abre a `AssinaturasResumoSheet` de hoje, com os itens somados por assinatura no período.
- **Viagem:** abre a `ViagemSheet` de hoje (ela já mostra a viagem inteira).
- **Categoria do cartão** (nome tocável no card do cartão): a `CategoriaCartaoHistoricoSheet` passa a receber a lista de meses. No modo Mês, continua com os 6 meses até o mês escolhido e `média 6m`. Nos outros modos, mostra os meses do período, o subtítulo `out/2025 – set/2026, pelo mês da fatura` e `média por mês`.

## Parte 4 — Barra fixa sob o topo (Análises, Cartão e Wiki)

Um mecanismo só, para toda barra que gruda logo abaixo do `.topo`.

- Classe nova e genérica `.barra-fixa` (nível 2, catalogada em `docs/estilo/catalogo.md`), definida **antes** do bloco da Wiki em `src/styles.css`:
  `position: sticky; top: var(--topo-altura, 0px); z-index: 9; margin: 0 -16px; padding: 6px 16px; background: var(--bg);`
  - O `margin` negativo anula o padding lateral de `.conteudo`. O `z-index` 9 fica abaixo do `.topo` (10).
- `Shell.tsx` mede a altura do `.topo` e grava `--topo-altura` no `.shell`, na montagem e no `resize`. É a **única** medição do topo no app.
- **Análises:** a linha `‹ rótulo ›` de todos os modos fica dentro de `.barra-fixa`. As pílulas e, no modo Período, as linhas `de`/`até` ficam fora dela e rolam com a tela.
- **Cartão:** o nome do cartão (`h2`) e o `SeletorMes` ficam juntos dentro de `.barra-fixa`. Cada cartão ganha um `div` próprio em volta do bloco inteiro, para o sticky valer só dentro do bloco: na visão casa, o bloco do cartão seguinte empurra o anterior.
- **Wiki** (refatoração, sem mudança visível):
  - O botão da barra do índice passa a usar `className="barra-fixa wiki-barra"`.
  - `.wiki-barra` perde `position`, `top`, `z-index`, `margin` e `background` (vêm de `.barra-fixa`) e fica só com a aparência própria: `display: flex`, `gap`, `min-height: 44px`, `padding: 8px 16px` (sobrepõe o 6px da `.barra-fixa`, por vir depois no CSS), `border`, `text-align`, `color`, `font-weight`.
  - `--wiki-topo` deixa de existir. O `Wiki.tsx` para de medir o `.topo` e mede só a própria barra: grava `--wiki-barra-altura`.
  - `scroll-margin-top` passa a `calc(var(--topo-altura, 0px) + var(--wiki-barra-altura, 0px) + 8px)`. `--wiki-rolagem` deixa de existir. O `FOLGA = 8` do `Wiki.tsx` continua para a detecção da seção atual, que já usa `getBoundingClientRect()` da barra.
  - Os testes da Wiki que existirem para a barra e o salto até a seção continuam passando sem mudança de expectativa.
- No desktop (≥ 900px), `.topo` também é sticky; a mesma regra vale.

## Domínio

Arquivo novo `src/domain/periodo.ts` (puro, sem React):

- `type ModoPeriodo = 'mes' | '12m' | 'ano' | 'periodo'`.
- `mesesEntre(de, ate): string[]` — lista inclusiva de `AAAA-MM`.
- `periodoAnterior(meses)`, `periodoAnoAnterior(meses)` — os N meses antes; os mesmos meses −12.
- `anoAnteriorRepete(meses): boolean` — `meses.length === 12`.
- `ajustarDe(de, ate, novoDe)` e `ajustarAte(de, ate, novoAte)` — aplicam o arraste e o teto de 24 meses; devolvem `{ de, ate }`.
- `rotuloIntervalo(meses)` — `mesAbreviado(primeiro) – mesAbreviado(último)`, ou só `mesAbreviado` com um mês.
- `MAX_MESES_PERIODO = 24`.

`src/domain/aggregations.ts`:

- `filtrar` passa a aceitar um conjunto de meses. `resumoPeriodo(meses, …)` devolve o mesmo formato de `resumoMensal`; `resumoMensal(mes, …)` vira `resumoPeriodo([mes], …)` e mantém o contrato.
- `compararPeriodos(meses, …): ComparativoPeriodo[]` — período, anterior, ano anterior (`null` com 12 meses) e média por mês de cada categoria; base do Comparativo com vários meses. `compararMeses` continua no modo Mês.
- `serieMensalResumo` e `serieMensal` não mudam (já recebem a lista de meses).

`src/domain/fatura.ts`: `resumoAssinaturasDoPeriodo(meses, …)` soma `resumoAssinaturasDoMes` mês a mês e junta os itens pela chave `cartaoId + recorrenciaCartaoId`. `totaisCategoriaCartaoPorMes` não muda.

`src/domain/viagem.ts`: sem mudança; a UI soma `totalViagemNoMes` nos meses do período.

A soma é sempre **mês a mês**, com as mesmas funções do modo Mês. Por isso, o total de um período é, por construção, a soma dos meses que a aba Cartão e o modo Mês mostram.

## Pontos de chamada (grep)

| Função | Chamadores |
|---|---|
| `resumoMensal` (aggregations) | `TelaAnalises.tsx` (o `resumoMensal` de `SimuladorFluxo` é outro, de `simulacao.ts`) |
| `compararMeses` | `TelaAnalises.tsx` |
| `serieMensal`, `mediaMovel3`, `serieMensalResumo` | `TelaAnalises.tsx`, `CategoriasCartaoCard.tsx` (`mediaMovel3`) |
| `resumoAssinaturasDoMes` | `TelaAnalises.tsx` |
| `totalViagemNoMes` | `TelaAnalises.tsx` |
| `totaisCategoriaCartaoPorMes` | `CategoriasCartaoCard.tsx`, `CategoriaCartaoHistoricoSheet.tsx` |
| `lancamentosDaCategoria` | `LancamentosSheet.tsx` |
| `SeletorMes` | `TelaAnalises.tsx`, `TelaCartao.tsx` |

Nenhuma função de `src/db/` ou `src/backup/` muda: a feature só lê o snapshot `Dados`.

## Componentes

- Novo `SeletorPeriodo.tsx` (+ teste): pílulas, linhas `de`/`até` e a linha fixa. Props: modo, estado de cada modo, callbacks.
- Novo `CategoriaPeriodoSheet.tsx` (+ teste).
- `CategoriasCartaoCard.tsx`: recebe `meses` em vez de `mes`; monta as colunas do modo Mês (como hoje) ou do modo de vários meses.
- `CategoriaCartaoHistoricoSheet.tsx`: recebe `meses` e o texto do subtítulo e da média.
- `EvolucaoMensalChart.tsx`: prop `mesAtual` passa a aceitar `null`; esconde a fileira de sobra acima de 6 meses; `interval` do eixo acima de 12 meses.
- `LancamentosSheet.tsx` e `FaturaCategoriaSheet.tsx`: prop opcional `onVoltar`, que mostra `‹ voltar ao período` (`.botao-ver-mais`).
- `TelaAnalises.tsx`: estado do período e composição dos cards. Se passar de ~300 linhas, o cálculo dos cards sai para um hook `usePeriodoAnalises` no mesmo arquivo ou num arquivo ao lado.
- `TelaCartao.tsx`: `div` por cartão e `.barra-fixa` em volta do nome e do `SeletorMes`.
- `Shell.tsx`: medição de `--topo-altura`.
- `ajustes/Wiki.tsx` e o bloco da Wiki em `styles.css`: passam a usar `.barra-fixa` (Parte 4).
- Catálogo: `.barra-fixa` (e o texto de `.wiki-barra` atualizado), `SeletorPeriodo`, `CategoriaPeriodoSheet`.

## Testes

- `periodo.test.ts`: `mesesEntre` na virada de ano (nov/2025–fev/2026 = 4 meses); `periodoAnterior` de out/2025–set/2026 = out/2024–set/2025; `periodoAnoAnterior` de mar–set/2026 = mar–set/2025; teto de 24 nos dois sentidos; arraste de `de` além de `até`; período de 1 mês.
- `aggregations.test.ts`: `resumoPeriodo([m])` igual a `resumoMensal(m)`; soma de 2 meses = soma dos dois `resumoMensal`; transferência e cenário continuam fora.
- `fatura.test.ts`: `resumoAssinaturasDoPeriodo` junta a mesma assinatura de dois meses num item só; cartão fora das boxes fica fora.
- UI: troca de modo e rótulos; linha fixa com `.barra-fixa`; Wiki com `barra-fixa wiki-barra`; `de`/`até` com teto; coluna "ano anterior" some com 12 meses; folha do período abre a folha do mês e volta; Categorias do cartão com vários meses; Cartão com o nome dentro de `.barra-fixa`.
- Varredura com Playwright no S25+: rolar e trocar o mês/período nas duas abas; os quatro modos; folhas.

## Fora do escopo

- Guardar o modo/período escolhido entre sessões.
- Seletor fixo em outras telas (Fluxo, Hoje) — não têm seletor de mês.
- Período por dia (decidido: só mês a mês).

## Documentação

- `docs/wiki/6-telas.md`: seção Análises (modos, cards com vários meses, folha do período) e Cartão (seletor fixo).
- Fragmento `changelog.d/adicionado-analises-por-periodo.md` e `changelog.d/alterado-seletor-mes-fixo.md`.
