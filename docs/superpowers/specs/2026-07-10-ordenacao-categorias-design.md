# Spec: ordenação de categorias na fonte

**Data:** 2026-07-10
**Status:** aprovada em brainstorm, aguardando plano de implementação

## Problema

O usuário define a ordem das categorias na tela de Ajustes (campo `Categoria.ordem`,
setinhas de subir/descer em `src/ui/ajustes/Categorias.tsx`), mas nem toda tela
respeita essa ordem:

- **Sem ordenação nenhuma** (ficam na ordem bruta do IndexedDB, aleatória na
  prática): o `<select>` de categoria do Simulador (`src/ui/TelaSimulador.tsx:17`),
  o `<select>` de Recorrências em Ajustes (`src/ui/ajustes/Recorrencias.tsx:109`),
  o `<select>` de categoria de cartão em FormCompra (`src/ui/FormCompra.tsx:20`)
  e em Assinaturas (`src/ui/ajustes/Assinaturas.tsx:104`).
- **Ordenação divergente:** `src/ui/TelaLancar.tsx:31` ordena só por `ordem`,
  sem separar ganhos de gastos como a tela de Ajustes faz.
- **Comparador duplicado:** o mesmo sort "ganho primeiro, depois ordem" está
  copiado em `LancEditor.tsx:22`, `Categorias.tsx:20` e
  `src/domain/aggregations.ts:51`.

A causa-raiz é que cada tela ordena por conta própria (ou esquece): telas novas
tendem a repetir o bug.

## Decisões (do brainstorm)

1. **Ordem canônica:** ganhos primeiro, gastos depois, cada grupo pela `ordem`
   definida pelo usuário — igual à tela de Ajustes exibe hoje.
2. **Exceção única:** o resumo por categoria da aba Cartão
   (`src/ui/TelaCartao.tsx:99`) continua ordenado por valor gasto decrescente
   ("onde gastei mais" é a informação útil ali).
3. **Abordagem:** ordenar **na fonte** (`repo.carregarTudo()`), não tela a tela,
   para que todo consumidor do snapshot `Dados` fique correto por padrão —
   inclusive telas futuras.

## Design

### 1. Novo módulo `src/domain/categorias.ts`

Dois comparadores puros, exportados:

- `compararCategorias(a: Categoria, b: Categoria): number`
  — `tipo` (`ganho` antes de `gasto`) → `ordem` crescente → `nome` (desempate).
- `compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number`
  — `ordem` crescente → `nome` (desempate).

O desempate por `nome` é obrigatório: existem `ordem` duplicadas na prática
(ex.: a categoria de fatura é criada com `ordem: 0` em `src/db/repo.ts:329`) e,
sem desempate, empates ficariam instáveis entre recargas porque a ordem vinda
do banco é arbitrária. Usar `localeCompare` para o nome, coerente com o resto
do código.

### 2. `repo.carregarTudo()` ordena antes de montar `Dados`

Em `src/db/repo.ts`, após o `Promise.all`, aplicar
`categorias.sort(compararCategorias)` e
`categoriasCartao.sort(compararCategoriasCartao)` antes de devolver o snapshot.
Como toda mutation é seguida de `recarregar()` no store (que chama
`carregarTudo()`), o snapshot no Zustand está sempre ordenado. `filter`/`map`
preservam ordem, então os quatro pontos sem ordenação (Simulador, Recorrências,
FormCompra, Assinaturas) ficam corretos sem serem tocados.

### 3. Remover sorts locais redundantes na UI

- `src/ui/TelaLancar.tsx:31` — remove o `.sort()`; de quebra a tela passa a
  separar ganhos de gastos, batendo com Ajustes (mudança de comportamento
  desejada, decisão 1).
- `src/ui/LancEditor.tsx:22` — remove o `.sort()`.
- `src/ui/ajustes/Categorias.tsx:20` — remove o `.sort()`.
- `src/ui/ajustes/CategoriasCartao.tsx:18` — remove o `.sort()`.

### 4. `aggregations.ts` mantém o sort, via helper

`src/domain/aggregations.ts:51` troca o comparador inline por
`compararCategorias`. O sort permanece porque é função de domínio pura chamada
com arrays arbitrários (inclusive direto em testes) — não deve depender de o
chamador ter ordenado.

## Testes

- Unit tests dos dois comparadores em `src/domain/categorias.test.ts`:
  ganho antes de gasto, `ordem` dentro do grupo, desempate por nome com
  `ordem` empatada.
- Teste em `src/db/repo.test.ts`: `carregarTudo()` devolve `categorias` e
  `categoriasCartao` já ordenadas (inserir fora de ordem, verificar snapshot).
- Suíte existente (`npm test`) roda inteira; testes que dependam da ordem de
  inserção são ajustados para a ordem canônica.

## Fora de escopo

- Tela de Ajustes (já é a fonte da `ordem`; nada muda nela).
- Resumo por valor da aba Cartão (exceção mantida).
- Schema do banco / migração Dexie (nenhum campo novo).
- Ordenação de boxes ou de lançamentos.
