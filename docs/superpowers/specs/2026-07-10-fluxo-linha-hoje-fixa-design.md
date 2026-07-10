# Linha de "hoje" fixa na aba Fluxo

**Data:** 2026-07-10
**Status:** aprovado em brainstorming

## Objetivo

Na aba Fluxo, a lista de dias (`TelaFluxo`) só mostra um dia se houver ao menos um
lançamento nele (`porDia` é montado a partir de `dados.lancamentos`). Isso significa que, se
hoje ainda não tem nenhum gasto ou ganho lançado, o dia de hoje simplesmente não aparece na
lista — o usuário perde a referência visual de "onde estou" na linha do tempo.

Este spec faz o dia de hoje aparecer **sempre** na lista padrão (sem busca/filtro ativo),
mesmo sem lançamentos, com um cabeçalho destacado (fundo verde sólido, cor diferente do verde
já usado para dinheiro) pra ficar claro que aquela linha é "hoje" e não mais um dia com
lançamento.

## Decisões (validadas com o usuário)

1. **Só na lista padrão.** A linha de hoje só é forçada a aparecer quando não há busca nem
   filtro de data/período ativo (`!filtroAtivo`). Buscando texto ou filtrando por
   data/período, a lista mostra só os resultados reais, sem forçar hoje a aparecer.
2. **Ordem cronológica normal.** O dia de hoje entra no mesmo conjunto ordenado dos outros
   dias (`dias = [...set].sort()`), podendo aparecer entre lançamentos passados e futuros
   (previstos), conforme a data.
3. **Sem lançamentos hoje → só o cabeçalho.** Quando `porDia.get(hoje)` é vazio/indefinido,
   o bloco do dia mostra só a linha de cabeçalho (data + saldo projetado), sem lista de itens
   embaixo e sem texto de "nenhum lançamento".
4. **Destaque é uma cor nova, não a de dinheiro.** O guia visual (`docs/estilo-visual.md`)
   reserva verde (`--pos`/`--pos-bg`) exclusivamente pra ganho/saldo positivo. O destaque de
   "hoje" usa um token novo, `--hoje-bg: #0d4a32` (verde-esmeralda escuro, sólido — não
   translúcido, pro contraste ficar visível contra o `--bg` quase preto do app; testado e
   aprovado via mockup interativo com 3 opções de tom).
5. **Destaque cobre só a linha de cabeçalho**, não o bloco inteiro do dia (itens de hoje,
   quando existirem, continuam com o estilo `.item` normal, sem fundo diferenciado).
6. **Texto da data volta à cor padrão.** Hoje o `<strong>` da data de hoje usa a classe
   `valor-ganho` (texto verde). Com o fundo sólido novo, o texto passa a usar a cor padrão
   (`--fg`) — o destaque agora é o fundo, não mais a cor do texto. O sufixo "· hoje" continua.

## Componentes afetados

### `src/styles.css`

- Novo token em `:root`: `--hoje-bg: #0d4a32;` (perto de `--aviso-bg`/`--aviso-fg`).
- Novas classes:
  ```css
  .cabecalho-dia {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding: 10px 4px 4px;
  }
  .cabecalho-dia.dia-hoje {
    background: var(--hoje-bg); padding: 12px 14px; border-radius: 12px;
  }
  ```
  `.cabecalho-dia` sozinha reproduz exatamente o espaçamento que hoje é feito com
  `className="linha"` + `style={{ padding: '10px 4px 4px', justifyContent: 'space-between' }}`
  — nenhuma mudança visual pros dias que não são hoje. `.dia-hoje` é o modificador que muda
  fundo/padding/raio só na linha de hoje.

### `src/ui/TelaFluxo.tsx`

- Construção de `dias` (linha 74 atual): passa a incluir `hoje` quando `!filtroAtivo`, antes
  de ordenar:
  ```ts
  const diasSet = new Set(porDia.keys());
  if (!filtroAtivo) diasSet.add(hoje);
  const dias = [...diasSet].sort();
  ```
- Render do cabeçalho do dia (linhas 122-125 atuais): troca `className="linha"` +
  `style={{ padding: ..., justifyContent: ... }}` por `className` derivada de
  `.cabecalho-dia`/`.dia-hoje`, remove a classe `valor-ganho` do `<strong>`:
  ```tsx
  <div className={dia === hoje ? 'cabecalho-dia dia-hoje' : 'cabecalho-dia'}>
    <strong>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
    <span className="sub">{formatarBRL(saldoPorDia.get(dia) ?? 0)}</span>
  </div>
  ```
- Render dos itens do dia (linha 126 atual, `porDia.get(dia)!.map(...)`): troca o
  non-null assertion por fallback de lista vazia, já que `porDia.get(hoje)` pode ser
  `undefined` agora: `(porDia.get(dia) ?? []).map((l) => ...)`.
- Nenhuma mudança em `porDia`, `saldoPorDia`, `bate`, `nomeCat`, `tipoCat` ou nos filtros de
  busca/data/período existentes.

## Testes

- `TelaFluxo.test.tsx`: novo caso cobrindo que, sem nenhum lançamento cadastrado para hoje e
  sem busca/filtro ativo, a linha de hoje aparece na lista (data + "· hoje" + saldo), sem
  itens embaixo. Novo caso cobrindo que, com busca ou filtro de data ativo e hoje sem
  lançamentos batendo no filtro, a linha de hoje **não** aparece forçada.

## Critérios de sucesso

1. `npm run test` verde.
2. `npm run build` sem erros.
3. Conferido no celular via `npm run preview -- --host`: aba Fluxo, dia de hoje sem
   lançamentos aparece destacado (fundo verde-esmeralda sólido) entre os outros dias, na
   posição cronológica certa; ao lançar algo hoje, o item aparece normalmente embaixo do
   cabeçalho destacado; buscar por texto/filtrar por data não força hoje a aparecer se não
   bater no filtro.

## Fora de escopo

- Mudar o destaque de hoje em outras telas (`TelaHoje`, `TelaAnalises`, `TelaSimulador`,
  `BalanceChart`/`FluxoChartModal`, que já têm seus próprios marcadores de "hoje") — este spec
  é só o cabeçalho de dia da lista em `TelaFluxo`.
- Qualquer mudança nos filtros de busca/data/período já existentes além de não forçarem hoje
  a aparecer (decisão 1).
