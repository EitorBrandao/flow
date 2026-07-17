# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

**Flow** — app de controle financeiro pessoal (fluxo de caixa diário com saldo projetado). PWA local-first: React 18 + TypeScript + Vite, estado em Zustand, persistência em IndexedDB via Dexie, gráficos em Recharts, animação em framer-motion. Não existe servidor — todos os dados vivem no IndexedDB do navegador, por isso backup/export é funcionalidade crítica. Código, UI e docs são em **português**.

## Comandos

```
npm run dev          # servidor de desenvolvimento (Vite)
npm run build        # tsc -b && vite build
npm test             # vitest run (uma passada)
npm run test:watch   # vitest em modo watch
npx vitest run src/domain/fatura.test.ts        # um arquivo de teste
npx vitest run -t "nome do teste"               # um teste pelo nome
npm run deploy       # build + publica dist/ via gh-pages no branch main de EitorBrandao/flow
                     # → usuário testa em https://eitorbrandao.github.io/flow/
```

Testes usam jsdom + fake-indexeddb (`src/test-setup.ts`) e são colocados ao lado do código (`*.test.ts(x)`). O Vitest exclui `.worktrees/` de propósito — worktrees paralelos têm node_modules próprio e coletar testes de lá quebra os hooks do React.

## Arquitetura

Camadas, de baixo para cima:

- **`src/domain/`** — lógica pura, sem IO. `types.ts` define as entidades (Box, Categoria, Lancamento, Recorrencia, Cartao, CompraCartao, ConferenciaFatura, Cenario, Config). `projection.ts` (`projetarBoxes`) calcula o saldo dia a dia até `config.horizonteProjecao`. `recurrence.ts` materializa recorrências em lançamentos `previsto`. `fatura.ts` calcula ciclos de fechamento/vencimento do cartão e gera as faturas. `aggregations.ts` alimenta a aba Análises. `money.ts`/`dates.ts` são os únicos lugares de parse/format.
- **`src/db/`** — `database.ts` é o schema Dexie (versionado; nova tabela/índice = nova `this.version(n)`). `repo.ts` concentra TODA a persistência. Mutations que afetam recorrências ou cartões recebem `horizonte` e re-materializam/sincronizam (`materializarTodas`, `sincronizarCartoes`) — faturas viram lançamentos com `origem: 'cartao'` na categoria de fatura do cartão.
- **`src/state/store.ts`** — um único store Zustand. `iniciar()` carrega tudo (`repo.carregarTudo()`), materializa e sincroniza; depois de qualquer mutation a UI chama `recarregar()`, que recarrega o snapshot inteiro (`dados: Dados`). `boxSel` aceita um ID de box ou o sentinela `'casa'` (todas as boxes consolidadas). `aba` define a tela ativa.
- **`src/ui/`** — uma `Tela*.tsx` por aba (Hoje, Fluxo, Cartão, Análises, Ajustes...), `Shell.tsx` é a navegação. Sheets/modais compartilhados (`Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`).
- **`src/backup/`** — export/import de backup JSON com merge (`mesclar`).

Convenções do domínio: valores monetários são **centavos inteiros**; datas são strings ISO `"AAAA-MM-DD"`. Lançamentos têm `status` (`efetivo`/`previsto`) e `origem` (`manual`/`recorrencia`/`import`/`cartao`). Cenários são lançamentos hipotéticos ligáveis/desligáveis na projeção — nunca `efetivo`.

## Regras do repositório

- **Antes de QUALQUER edição de UI, consulte `docs/estilo-visual.md`** — é um índice que aponta para o capítulo certo em `docs/estilo/` conforme o nível da mudança (editar tela, nova classe, novo token, novo componente, nova tela, mudança de linguagem). Quem cria classe/componente cataloga em `docs/estilo/catalogo.md`. Se código e guia divergirem, o código manda — atualize o guia junto.
- Specs e planos de features ficam em `docs/superpowers/specs/` e `docs/superpowers/plans/`; o backlog com contexto e decisões em aberto está em `TODO.md`.
- **Nunca commitar dados financeiros reais** — `*.xlsx` e `*.json.backup` estão no `.gitignore` de propósito.
- Nunca trabalhar direto na `main`: criar branch antes de alterar arquivos. Sessões concorrentes rodam no mesmo checkout — trabalho com commits deve ir para um git worktree próprio (`.worktrees/`).
