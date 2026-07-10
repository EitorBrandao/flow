# Ordenação de categorias na fonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda listagem/dropdown de categorias segue a ordem definida pelo usuário em Ajustes (ganhos primeiro, depois `ordem`, nome como desempate), ordenando uma única vez em `repo.carregarTudo()`.

**Architecture:** Dois comparadores puros novos em `src/domain/categorias.ts`, aplicados no snapshot montado por `repo.carregarTudo()` (fonte única de `Dados` para o store Zustand). Sorts locais duplicados na UI são removidos; `aggregations.ts` mantém seu sort mas passa a usar o comparador compartilhado.

**Tech Stack:** TypeScript, Vitest (jsdom + fake-indexeddb, globals habilitados — `it`/`expect` sem import), Dexie.

**Spec:** `docs/superpowers/specs/2026-07-10-ordenacao-categorias-design.md`

## Global Constraints

- Código, UI e docs em **português**; valores em centavos inteiros; datas ISO `AAAA-MM-DD`.
- Nunca trabalhar direto na `master`; sessões concorrentes → worktree próprio. Executar este plano num worktree novo com branch `feat/ordenacao-categorias` criada a partir de `spec/ordenacao-categorias` (que contém spec + plano). Atenção: neste repo `main` é o branch de **deploy** (gh-pages); integração é na `master`.
- Nunca commitar `*.xlsx` / `*.json.backup` (dados financeiros reais).
- Rodar testes: `npx vitest run <arquivo>` (um arquivo) ou `npm test` (suíte inteira).
- Nenhuma mudança de schema Dexie e nenhuma mudança visual de CSS/classe (não é preciso tocar no guia de estilo).

---

### Task 1: Comparadores puros em `src/domain/categorias.ts`

**Files:**
- Create: `src/domain/categorias.ts`
- Test: `src/domain/categorias.test.ts`

**Interfaces:**
- Consumes: `Categoria`, `CategoriaCartao` de `src/domain/types.ts` (já existem).
- Produces: `compararCategorias(a: Categoria, b: Categoria): number` e `compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number`, exportados — Tasks 2 e 4 importam exatamente esses nomes.

- [ ] **Step 1: Write the failing tests**

Criar `src/domain/categorias.test.ts`:

```ts
import type { Categoria, CategoriaCartao } from './types';
import { compararCategorias, compararCategoriasCartao } from './categorias';

const ts = { criadoEm: '2026-07-10T12:00:00.000Z', alteradoEm: '2026-07-10T12:00:00.000Z' };

const salario: Categoria = { id: 'sal', boxId: 'b', nome: 'salário', tipo: 'ganho', ordem: 2, arquivada: false, ...ts };
const aluguel: Categoria = { id: 'alu', boxId: 'b', nome: 'aluguel', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const mercado: Categoria = { id: 'mer', boxId: 'b', nome: 'mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...ts };
const pix: Categoria = { id: 'pix', boxId: 'b', nome: 'pix', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };

it('ganhos vêm antes de gastos, mesmo com ordem maior', () => {
  expect([mercado, salario].sort(compararCategorias).map((c) => c.id)).toEqual(['sal', 'mer']);
});

it('dentro do mesmo tipo, ordena pela ordem definida', () => {
  expect([mercado, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'mer']);
});

it('empate de ordem desempata por nome', () => {
  expect([pix, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'pix']);
});

const catsCartao: CategoriaCartao[] = [
  { id: 'c1', cartaoId: 'k', nome: 'streaming', ordem: 1, arquivada: false, ...ts },
  { id: 'c2', cartaoId: 'k', nome: 'mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'c3', cartaoId: 'k', nome: 'farmácia', ordem: 0, arquivada: false, ...ts },
];

it('categorias de cartão: ordem, depois nome', () => {
  expect([...catsCartao].sort(compararCategoriasCartao).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: FAIL — módulo `./categorias` não existe.

- [ ] **Step 3: Write minimal implementation**

Criar `src/domain/categorias.ts`:

```ts
import type { Categoria, CategoriaCartao } from './types';

// Ordem canônica definida pelo usuário em Ajustes: ganhos antes de gastos,
// depois `ordem`; nome desempata porque existem `ordem` duplicadas
// (ex.: categoria de fatura nasce com ordem 0) e a ordem do banco é arbitrária.
export function compararCategorias(a: Categoria, b: Categoria): number {
  if (a.tipo !== b.tipo) return a.tipo === 'ganho' ? -1 : 1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

export function compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number {
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/categorias.ts src/domain/categorias.test.ts
git commit -m "feat(dominio): comparadores canonicos de categoria (tipo, ordem, nome)"
```

---

### Task 2: `repo.carregarTudo()` devolve categorias ordenadas

**Files:**
- Modify: `src/db/repo.ts:28-52` (função `carregarTudo`) e o bloco de imports no topo
- Test: `src/db/repo.test.ts` (novos testes no fim do arquivo)

**Interfaces:**
- Consumes: `compararCategorias`, `compararCategoriasCartao` de `src/domain/categorias.ts` (Task 1).
- Produces: garantia de que `Dados.categorias` e `Dados.categoriasCartao` chegam ordenados a todo consumidor do store — Tasks 3 e 4 dependem disso.

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `src/db/repo.test.ts` (o arquivo já importa `repo`, `Box`, `agoraISO`, `novoId`; `beforeEach` já reseta o banco):

```ts
it('carregarTudo devolve categorias na ordem canônica (ganho→gasto, ordem, nome)', async () => {
  const agora = agoraISO();
  const box: Box = {
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 1 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'pix', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 5 });
  const dados = await repo.carregarTudo();
  expect(dados.categorias.map((c) => c.nome)).toEqual(['salário', 'aluguel', 'pix', 'mercado']);
});

it('carregarTudo devolve categorias de cartão ordenadas por ordem e nome', async () => {
  const agora = agoraISO();
  const box: Box = {
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'streaming', ordem: 1 });
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'farmácia', ordem: 0 });
  const dados = await repo.carregarTudo();
  expect(dados.categoriasCartao.map((c) => c.nome)).toEqual(['farmácia', 'mercado', 'streaming']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db/repo.test.ts -t 'carregarTudo devolve'`
Expected: os 2 testes novos FALHAM (ordem vem da inserção no banco, não da canônica). Os demais testes do arquivo continuam passando.

- [ ] **Step 3: Implement**

Em `src/db/repo.ts`, adicionar o import (junto aos imports existentes de `../domain/...` no topo do arquivo):

```ts
import { compararCategorias, compararCategoriasCartao } from '../domain/categorias';
```

E em `carregarTudo`, ordenar após o `Promise.all` — o trecho:

```ts
  const [
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(),
  ]);
  return {
```

vira:

```ts
  const [
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(),
  ]);
  // ordem canônica na fonte: todo consumidor do snapshot herda a ordem de Ajustes
  categorias.sort(compararCategorias);
  categoriasCartao.sort(compararCategoriasCartao);
  return {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db/repo.test.ts`
Expected: PASS (arquivo inteiro, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(db): carregarTudo devolve categorias na ordem canonica"
```

---

### Task 3: Remover sorts locais redundantes na UI

**Files:**
- Modify: `src/ui/TelaLancar.tsx:28-33`
- Modify: `src/ui/LancEditor.tsx:20-22`
- Modify: `src/ui/ajustes/Categorias.tsx:18-20`
- Modify: `src/ui/ajustes/CategoriasCartao.tsx:16-18`
- Test: suíte existente (sem testes novos — comportamento coberto pelos testes das telas)

**Interfaces:**
- Consumes: snapshot ordenado do store (Task 2). `filter` preserva ordem, então remover o `.sort()` mantém a ordem canônica.
- Produces: nada novo — só remoção de duplicação.

- [ ] **Step 1: TelaLancar**

Em `src/ui/TelaLancar.tsx`, o trecho:

```ts
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id))
      .sort((a, b) => a.ordem - b.ordem),
    [dados, boxId, tipo, ocultas],
  );
```

vira:

```ts
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id)),
    [dados, boxId, tipo, ocultas],
  );
```

- [ ] **Step 2: LancEditor**

Em `src/ui/LancEditor.tsx`, o trecho:

```ts
  const categorias = dados.categorias
    .filter((c) => c.boxId === lanc.boxId && !c.arquivada && !ocultas.has(c.id))
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));
```

vira:

```ts
  const categorias = dados.categorias
    .filter((c) => c.boxId === lanc.boxId && !c.arquivada && !ocultas.has(c.id));
```

- [ ] **Step 3: Ajustes → Categorias**

Em `src/ui/ajustes/Categorias.tsx`, o trecho:

```ts
  const cats = dados.categorias
    .filter((c) => c.boxId === boxId && !ocultas.has(c.id))
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));
```

vira:

```ts
  const cats = dados.categorias
    .filter((c) => c.boxId === boxId && !ocultas.has(c.id));
```

Atenção: NÃO alterar `criar()` nem `mover()` — a troca de `ordem` com o vizinho continua funcionando porque `cats` mantém a mesma ordem de antes (agora vinda do store).

- [ ] **Step 4: Ajustes → Categorias do cartão**

Em `src/ui/ajustes/CategoriasCartao.tsx`, o trecho:

```ts
  const cats = dados.categoriasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .sort((a, b) => a.ordem - b.ordem);
```

vira:

```ts
  const cats = dados.categoriasCartao
    .filter((c) => c.cartaoId === cartaoId);
```

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS. Se algum teste de tela falhar por esperar ordem de inserção, ajustar a expectativa para a ordem canônica (ganhos primeiro, depois `ordem`, depois nome) — a expectativa antiga é que estava acoplada ao acaso do banco.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaLancar.tsx src/ui/LancEditor.tsx src/ui/ajustes/Categorias.tsx src/ui/ajustes/CategoriasCartao.tsx
git commit -m "refactor(ui): remove sorts locais de categoria; ordem vem da fonte"
```

---

### Task 4: `aggregations.ts` usa o comparador compartilhado

**Files:**
- Modify: `src/domain/aggregations.ts:1-2` (imports) e `:50-52` (sort em `resumoMensal`)
- Test: suíte existente `src/domain/aggregations.test.ts` (sem testes novos)

**Interfaces:**
- Consumes: `compararCategorias` de `src/domain/categorias.ts` (Task 1).
- Produces: nada novo — o sort permanece (função de domínio pura não deve depender de o chamador ter ordenado), só troca o comparador inline pelo compartilhado.

- [ ] **Step 1: Implement**

Em `src/domain/aggregations.ts`, adicionar ao bloco de imports:

```ts
import { compararCategorias } from './categorias';
```

E o trecho em `resumoMensal`:

```ts
  const catsOrdenadas = [...categorias].sort(
    (a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1),
  );
```

vira:

```ts
  const catsOrdenadas = [...categorias].sort(compararCategorias);
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/domain/aggregations.test.ts`
Expected: PASS (comparador é equivalente ao inline, com desempate por nome a mais).

- [ ] **Step 3: Commit**

```bash
git add src/domain/aggregations.ts
git commit -m "refactor(dominio): aggregations usa compararCategorias compartilhado"
```

---

### Task 5: Verificação final e deploy de teste

**Files:**
- Nenhum arquivo novo; verificação de ponta a ponta.

**Interfaces:**
- Consumes: tudo das Tasks 1–4.
- Produces: branch pronta para integração na `master` e preview publicado.

- [ ] **Step 1: Full suite + build**

Run: `npm test` — Expected: PASS (suíte inteira).
Run: `npm run build` — Expected: `tsc -b` e `vite build` sem erros.

- [ ] **Step 2: Verificação manual (checklist da spec)**

Rodar `npm run dev` e conferir que a ordem de Ajustes → Categorias se reflete em: grade da tela Lançar, dropdown do editor de lançamento, Simulador, Recorrências, FormCompra (nova compra no cartão) e Assinaturas. Conferir que o resumo por categoria da aba Cartão continua por valor decrescente. Mover uma categoria com as setinhas em Ajustes e ver a mudança refletir nas outras telas.

- [ ] **Step 3: Deploy para teste do usuário**

Run: `npm run deploy`
(publica em https://eitorbrandao.github.io/flow/ — preferência registrada do usuário: sempre publicar após mudanças de código para ele testar no celular.)

- [ ] **Step 4: Integração**

Usar a skill superpowers:finishing-a-development-branch para decidir merge/PR na `master` (NUNCA na `main`, que é o branch de deploy do gh-pages).
