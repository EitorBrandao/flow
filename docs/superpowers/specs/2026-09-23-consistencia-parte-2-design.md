# Consistência entre telas — parte 2: fatura, card de destaque e seletor de mês

Status: aprovada em 2026-09-23 — não implementada

Item 25 do `TODO.md`, itens 5 a 8 da auditoria de consistência de 2026-09-23. A parte 1
(itens 1 a 4) vai num branch próprio, `consistencia-parte-1`; **este trabalho só começa a
mexer em código depois que a parte 1 entrar na `main`**, porque as duas mudam `TelaHoje.tsx`,
`TelaAnalises.tsx` e `src/styles.css`.

Regra que motiva tudo (`CLAUDE.md`): o mesmo conceito aparece do mesmo jeito em toda tela —
mesmo texto, mesma cor, mesmo sinal, mesmo ponto de vista.

## Decisões (tomadas com o usuário em 2026-09-23)

### 1. Resumo por categoria da fatura

Onde aparece: aba Cartão → Resumo (`TelaCartao.tsx`) e `FaturaCategoriaSheet` (aberta pelas
Análises).

- Cada categoria é um `.item` com o nome à esquerda e o valor em pílula (`span.valor-gasto`) à
  direita — o formato das linhas do Fluxo e dos lançamentos da fatura.
- A lista aparece **sempre**, mesmo com uma categoria só. Hoje o Cartão a esconde
  (`resumo.length > 1`).
- No Cartão, cada linha continua sendo um botão que filtra os lançamentos e troca para a aba
  Lançamentos, com `aria-pressed`. Na sheet, a linha não é tocável (`div.item`, como hoje).

### 2. Cabeçalho de fatura

Um formato só, nos três lugares que mostram uma fatura: card da aba Cartão, `FaturaResumo`
(aberta pelo Fluxo) e `FaturaCategoriaSheet` (aberta pelas Análises).

- **Título:** `{cartão} · fatura de {mês por nome}` — "Nubank · fatura de outubro de 2026".
  O mês vai por nome, igual ao seletor de mês (decisão 5).
- **Linha de datas:** `fecha DD/MM/AAAA · vence DD/MM/AAAA`, sempre com ano. Hoje o Cartão
  mostra "vence DD/MM" sem ano, e as sheets não mostram o fechamento.
- **Total:** no card do Cartão, `.saldo-grande`; nas sheets, a pílula do valor, na linha de
  datas, antes do "fecha".
- **Sheets:** o título e a linha de datas ficam no cabeçalho fixo (prop `cabecalho` do
  `Sheet`); a lista rola por baixo. Hoje só a `FaturaResumo` faz assim.
- **Fatura vazia:** "Nenhum gasto nesta fatura." em todo lugar. A `FaturaResumo` hoje diz
  "Nenhum lançamento nesta fatura.".

No card do Cartão o mês já aparece no seletor, logo acima; por isso o card não repete o
título inteiro — ver decisão 4.

### 3. Total de fatura igual a zero

Fatura sem gasto não é dívida. Total zero aparece na cor normal do texto: `.saldo-grande` sem
`negativo` no card, e `strong` sem `valor-gasto` nas sheets. Total maior que zero continua
vermelho, como hoje.

### 4. Card de destaque

O texto acima do valor grande usa `.rotulo` (maiúsculo, 12px), como o "SALDO HOJE · CASA" da
Hoje. No Cartão ele passa a ser `Fatura · {cartão}` — o `.rotulo` põe em maiúsculas. Abaixo do
valor, a linha de datas da decisão 2.

### 5. Seletor de mês

Componente novo, **`SeletorMes`** (`src/ui/SeletorMes.tsx`, nível 4 do guia), usado pelas
Análises e pelo Cartão:

- Setas `‹` e `›` em `.botao`, com `aria-label` "Mês anterior" e "Mês seguinte". As Análises
  hoje usam ◀ ▶ e "Próximo mês".
- Entre as setas, o mês por nome: "outubro de 2026".
- Props mínimas: `mes` (`'AAAA-MM'`) e `onMudar(mes)`.
- No Cartão, o seletor sai de dentro do card e vai para uma linha própria, acima dele, como
  nas Análises.

O nome do mês sai de uma função só, `nomeDoMes(mes)`, em `src/domain/dates.ts` — hoje é uma
função local da `TelaAnalises` (`nomeMes`). O título de fatura (decisão 2) usa a mesma função.

## Fora de escopo

- Item 20 (diferença da fatura) — mexe no mesmo cabeçalho do Cartão; vem depois deste.
- Qualquer outra tela com seletor de período (o gráfico expandido do Fluxo tem o seu, de dias).

## Testes que mudam de expectativa

- `TelaAnalises.test.tsx`: "Próximo mês" → "Mês seguinte".
- `FaturaResumo.test.tsx`: "Total:" seguido do valor → a pílula do total na linha de datas.
- `TelaCartao.test.tsx`: lista do resumo com uma categoria passa a aparecer.

## Entrega

Mockup aprovado antes do código (a parte 1 já entrou na `main`, v0.35.2). Plano: `docs/superpowers/plans/2026-09-23-consistencia-parte-2.md`. Wiki (`6-telas.md`: Cartão, Análises e as sheets de fatura),
dossiê regenerado, catálogo com o `SeletorMes`, fragmento `changelog.d/alterado-consistencia-fatura.md`.
