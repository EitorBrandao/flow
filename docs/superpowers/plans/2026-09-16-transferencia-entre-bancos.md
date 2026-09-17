# Transferência entre bancos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o usuário mover saldo declarado entre dois bancos da mesma box (ex.: salário no Bradesco → parte pro Nubank, parte pro Santander como reserva), com o movimento visível no Fluxo de caixa e fora dos totais de Análises.

**Architecture:** Duas categorias ocultas por box (uma `gasto`, uma `ganho`, criadas sob demanda) recebem os dois lançamentos de cada transferência — ligados por um `transferenciaId` compartilhado e carimbados com `bancoId` cada um. A ação (`repo.transferirEntreBancos`) grava os dois lançamentos e ajusta o saldo declarado dos dois bancos na mesma transação. A UI vive na Hoje → Conferir (botão ↔ por linha de banco) e num sheet de detalhe somente leitura no Fluxo, no mesmo padrão do `FaturaResumo.tsx` já existente.

**Tech Stack:** TypeScript, React 18, Zustand, Dexie (IndexedDB), Vitest + Testing Library.

## Global Constraints

- Valores monetários em centavos inteiros; datas em `ISODate` (`"AAAA-MM-DD"`).
- Nenhum `{ timeout: n }` local em `findBy*`/`waitFor` — os timeouts globais já são generosos de propósito.
- **Sem migração Dexie e sem novo schema de backup.** Os campos novos (`Box.categoriaTransferenciaSaidaId`/`EntradaId`, `Lancamento.bancoId`/`transferenciaId`) são opcionais e sem índice — mesmo raciocínio de `Cartao.bancoId` (entrega 1 de bancos, v0.20.0). Não crie `this.version(n)` em `src/db/database.ts`; não toque em `src/backup/backup.ts`.
- Transferência só entre bancos **da mesma box** — decisão do usuário, registrada na spec.
- `bancoId`/`transferenciaId` não são índices Dexie: use `.filter()`, nunca `.where()`, para consultá-los (mesmo idioma de `excluirBanco` com `bancoId`).
- Mockups já aprovados nesta sessão: o botão ↔ inline na Hoje → Conferir (não em Ajustes → Bancos, não em tela separada), e o sheet de detalhe da transferência com o layout real do `FaturaResumo.tsx` (cabeçalho + item + aviso + botão de excluir).
- A Task 6 cria um componente novo (`TransferenciaSheet.tsx`) — cataloga-lo em `docs/estilo/catalogo.md` no mesmo commit; as Tasks 1–5 só reaproveitam classes já cadastradas.
- Todo texto para o usuário (UI, avisos, mensagens de commit) é em português.
- Trabalho já está no branch `transferencia-bancos`, worktree `.worktrees/transferencia-bancos/` — todos os caminhos abaixo são relativos à raiz do repositório; execute os comandos dentro dessa worktree.
- Spec completa: `docs/superpowers/specs/2026-09-16-transferencia-entre-bancos-design.md`.

---

### Task 1: Tipos novos e `categoriasTransferenciaIds`

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/transferencia.ts`
- Create: `src/domain/transferencia.test.ts`

**Interfaces:**
- Produces: `Box.categoriaTransferenciaSaidaId?: ID`; `Box.categoriaTransferenciaEntradaId?: ID`; `Lancamento.bancoId?: ID`; `Lancamento.transferenciaId?: ID`; `OrigemLancamento` ganha `'transferencia'`; `export function categoriasTransferenciaIds(boxes: Box[]): Set<ID>`.

Campos opcionais em tipos existentes não quebram nenhum fixture de teste — nenhum outro arquivo precisa mudar nesta tarefa.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/domain/transferencia.test.ts`:

```ts
import type { Box } from './types';
import { categoriasTransferenciaIds } from './transferencia';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };

function box(p: Partial<Box> & Pick<Box, 'id'>): Box {
  return { nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, ...ts, ...p };
}

describe('categoriasTransferenciaIds', () => {
  it('retorna as duas categorias ocultas de cada box que já transferiu', () => {
    const a = box({ id: 'b1', categoriaTransferenciaSaidaId: 's1', categoriaTransferenciaEntradaId: 'e1' });
    const b = box({ id: 'b2', categoriaTransferenciaSaidaId: 's2', categoriaTransferenciaEntradaId: 'e2' });
    expect(categoriasTransferenciaIds([a, b])).toEqual(new Set(['s1', 'e1', 's2', 'e2']));
  });

  it('box que nunca transferiu não contribui id nenhum', () => {
    expect(categoriasTransferenciaIds([box({ id: 'b1' })])).toEqual(new Set());
  });

  it('lista vazia de boxes retorna conjunto vazio', () => {
    expect(categoriasTransferenciaIds([])).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/transferencia.test.ts`
Expected: FAIL — não existe `src/domain/transferencia.ts`.

- [ ] **Step 3: Adicionar os campos em `types.ts`**

Em `src/domain/types.ts`, na interface `Box` (depois de `dataSaldoDeclarado?: ISODate | null;`):

```ts
  categoriaTransferenciaSaidaId?: ID;   // categoria oculta "Transferência" (gasto), criada sob demanda
  categoriaTransferenciaEntradaId?: ID; // categoria oculta "Transferência" (ganho), criada sob demanda
```

No `type OrigemLancamento`:

```ts
export type OrigemLancamento = 'manual' | 'recorrencia' | 'cartao' | 'transferencia';
```

Na interface `Lancamento` (depois de `viagemId?: ID;`):

```ts
  bancoId?: ID;          // qual banco esta perna afeta (só em lançamentos de transferência)
  transferenciaId?: ID;  // liga as duas pernas do mesmo movimento
```

- [ ] **Step 4: Implementar `categoriasTransferenciaIds` em `src/domain/transferencia.ts`**

```ts
import type { Box, ID } from './types';

/** Ids das duas categorias ocultas de transferência de cada box (saída e entrada) — não
 *  devem aparecer em nenhuma lista de seleção manual de categoria. Mesmo formato de
 *  `categoriasFaturaIds` (`src/domain/fatura.ts`). */
export function categoriasTransferenciaIds(boxes: Box[]): Set<ID> {
  const ids = new Set<ID>();
  for (const b of boxes) {
    if (b.categoriaTransferenciaSaidaId) ids.add(b.categoriaTransferenciaSaidaId);
    if (b.categoriaTransferenciaEntradaId) ids.add(b.categoriaTransferenciaEntradaId);
  }
  return ids;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/transferencia.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: PASS, sem erro novo — os campos são opcionais, nenhum literal de `Box`/`Lancamento` existente deixa de compilar.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/transferencia.ts src/domain/transferencia.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): tipos e categoriasTransferenciaIds da transferência entre bancos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

### Task 2: `repo.transferirEntreBancos` e `repo.excluirTransferencia`

**Files:**
- Modify: `src/db/repo.ts`
- Modify: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: `categoriasTransferenciaIds` não é usado aqui; usa só os tipos da Task 1.
- Produces: `export async function transferirEntreBancos(bancoOrigemId: ID, bancoDestinoId: ID, valorCent: number, data: ISODate): Promise<void>`; `export async function excluirTransferencia(transferenciaId: ID): Promise<void>`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/db/repo.test.ts`, adicionar ao fim do arquivo:

```ts
describe('transferirEntreBancos', () => {
  it('cria as duas categorias ocultas, grava os dois lançamentos ligados e ajusta os dois saldos', async () => {
    const { box } = await boxECategoria();
    const origem = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
    const destino = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
    await repo.atualizarBanco(origem.id, { saldoDeclaradoCent: 300000, dataSaldoDeclarado: '2026-07-01' });

    await repo.transferirEntreBancos(origem.id, destino.id, 50000, '2026-07-05');

    const boxAtualizado = await db.boxes.get(box.id);
    expect(boxAtualizado?.categoriaTransferenciaSaidaId).toBeTruthy();
    expect(boxAtualizado?.categoriaTransferenciaEntradaId).toBeTruthy();
    const catSaida = await db.categorias.get(boxAtualizado!.categoriaTransferenciaSaidaId!);
    const catEntrada = await db.categorias.get(boxAtualizado!.categoriaTransferenciaEntradaId!);
    expect(catSaida).toMatchObject({ nome: 'Transferência', tipo: 'gasto', boxId: box.id });
    expect(catEntrada).toMatchObject({ nome: 'Transferência', tipo: 'ganho', boxId: box.id });

    const pernas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia');
    expect(pernas).toHaveLength(2);
    const saida = pernas.find((l) => l.bancoId === origem.id)!;
    const entrada = pernas.find((l) => l.bancoId === destino.id)!;
    expect(saida).toMatchObject({
      categoriaId: catSaida!.id, valor: 50000, data: '2026-07-05',
      status: 'efetivo', boxId: box.id, nota: 'Bradesco → Nubank',
    });
    expect(entrada).toMatchObject({
      categoriaId: catEntrada!.id, valor: 50000, data: '2026-07-05',
      status: 'efetivo', boxId: box.id, nota: 'Bradesco → Nubank',
    });
    expect(saida.transferenciaId).toBe(entrada.transferenciaId);

    expect((await db.bancos.get(origem.id))?.saldoDeclaradoCent).toBe(250000);
    expect((await db.bancos.get(origem.id))?.dataSaldoDeclarado).toBe('2026-07-05');
    expect((await db.bancos.get(destino.id))?.saldoDeclaradoCent).toBe(50000);
    expect((await db.bancos.get(destino.id))?.dataSaldoDeclarado).toBe('2026-07-05');
  });

  it('reaproveita as categorias ocultas já criadas nas transferências seguintes', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });

    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');
    await repo.transferirEntreBancos(b.id, a.id, 5000, '2026-07-06');

    // 2 categorias de boxECategoria (ganho/gasto) + 2 ocultas de transferência, nunca mais
    expect(await db.categorias.count()).toBe(4);
  });

  it('trata saldo não informado como zero', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });

    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');

    expect((await db.bancos.get(a.id))?.saldoDeclaradoCent).toBe(-10000);
    expect((await db.bancos.get(b.id))?.saldoDeclaradoCent).toBe(10000);
  });

  it('recusa origem igual a destino', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    await expect(repo.transferirEntreBancos(a.id, a.id, 10000, '2026-07-05')).rejects.toThrow();
  });

  it('recusa bancos de boxes diferentes', async () => {
    const { box } = await boxECategoria();
    const agora = agoraISO();
    const outraBox: Box = {
      id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01',
      criadoEm: agora, alteradoEm: agora,
    };
    await repo.salvarBox(outraBox);
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: outraBox.id, nome: 'B', ordem: 0 });
    await expect(repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05')).rejects.toThrow();
  });

  it('recusa valor zero ou negativo', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });
    await expect(repo.transferirEntreBancos(a.id, b.id, 0, '2026-07-05')).rejects.toThrow();
    await expect(repo.transferirEntreBancos(a.id, b.id, -100, '2026-07-05')).rejects.toThrow();
  });
});

describe('excluirTransferencia', () => {
  it('apaga as duas pernas e não mexe no saldo declarado', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });
    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');
    const perna = (await db.lancamentos.toArray()).find((l) => l.origem === 'transferencia')!;

    await repo.excluirTransferencia(perna.transferenciaId!);

    expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(0);
    expect((await db.bancos.get(a.id))?.saldoDeclaradoCent).toBe(-10000);
    expect((await db.bancos.get(b.id))?.saldoDeclaradoCent).toBe(10000);
  });

  it('não mexe em outra transferência', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });
    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');
    await repo.transferirEntreBancos(a.id, b.id, 20000, '2026-07-06');
    const primeira = (await db.lancamentos.toArray()).find((l) => l.origem === 'transferencia')!;

    await repo.excluirTransferencia(primeira.transferenciaId!);

    expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/db/repo.test.ts -t "transferirEntreBancos|excluirTransferencia"`
Expected: FAIL — `repo.transferirEntreBancos` não existe.

- [ ] **Step 3: Implementar em `repo.ts`**

Adicionar ao fim de `src/db/repo.ts` (nenhum import novo — `Lancamento`, `Box`, `ID`, `ISODate`, `agoraISO`, `novoId` já estão importados no topo do arquivo):

```ts
async function categoriaTransferenciaSaidaDe(boxId: ID): Promise<ID> {
  const box = (await db.boxes.get(boxId))!;
  if (box.categoriaTransferenciaSaidaId) return box.categoriaTransferenciaSaidaId;
  const agora = agoraISO();
  const categoriaId = novoId();
  await db.categorias.add({
    id: categoriaId, boxId, nome: 'Transferência', tipo: 'gasto', ordem: 0,
    arquivada: false, criadoEm: agora, alteradoEm: agora,
  });
  await db.boxes.update(boxId, { categoriaTransferenciaSaidaId: categoriaId, alteradoEm: agora });
  return categoriaId;
}

async function categoriaTransferenciaEntradaDe(boxId: ID): Promise<ID> {
  const box = (await db.boxes.get(boxId))!;
  if (box.categoriaTransferenciaEntradaId) return box.categoriaTransferenciaEntradaId;
  const agora = agoraISO();
  const categoriaId = novoId();
  await db.categorias.add({
    id: categoriaId, boxId, nome: 'Transferência', tipo: 'ganho', ordem: 0,
    arquivada: false, criadoEm: agora, alteradoEm: agora,
  });
  await db.boxes.update(boxId, { categoriaTransferenciaEntradaId: categoriaId, alteradoEm: agora });
  return categoriaId;
}

/** Move saldo declarado de um banco para outro DA MESMA BOX, gravando dois lançamentos
 *  ligados (`transferenciaId` compartilhado) numa categoria oculta "Transferência" — um de
 *  saída (gasto) na origem, um de entrada (ganho) no destino — e ajustando o saldo declarado
 *  dos dois bancos na mesma transação. Ver `docs/superpowers/specs/2026-09-16-transferencia-
 *  entre-bancos-design.md`. */
export async function transferirEntreBancos(
  bancoOrigemId: ID, bancoDestinoId: ID, valorCent: number, data: ISODate,
): Promise<void> {
  if (bancoOrigemId === bancoDestinoId) throw new Error('Escolha dois bancos diferentes.');
  if (valorCent <= 0) throw new Error('O valor da transferência precisa ser maior que zero.');
  const origem = await db.bancos.get(bancoOrigemId);
  const destino = await db.bancos.get(bancoDestinoId);
  if (!origem || !destino) throw new Error('Banco não encontrado.');
  if (origem.boxId !== destino.boxId) throw new Error('Transferência só entre bancos da mesma box.');

  await db.transaction('rw', db.bancos, db.categorias, db.boxes, db.lancamentos, db.config, async () => {
    const categoriaSaidaId = await categoriaTransferenciaSaidaDe(origem.boxId);
    const categoriaEntradaId = await categoriaTransferenciaEntradaDe(origem.boxId);
    const agora = agoraISO();
    const transferenciaId = novoId();
    const nota = `${origem.nome} → ${destino.nome}`;
    const lancamentos: Lancamento[] = [
      {
        id: novoId(), boxId: origem.boxId, categoriaId: categoriaSaidaId, data, valor: valorCent,
        nota, status: 'efetivo', origem: 'transferencia', bancoId: origem.id, transferenciaId,
        criadoEm: agora, alteradoEm: agora,
      },
      {
        id: novoId(), boxId: destino.boxId, categoriaId: categoriaEntradaId, data, valor: valorCent,
        nota, status: 'efetivo', origem: 'transferencia', bancoId: destino.id, transferenciaId,
        criadoEm: agora, alteradoEm: agora,
      },
    ];
    await db.lancamentos.bulkAdd(lancamentos);
    await db.bancos.update(origem.id, {
      saldoDeclaradoCent: (origem.saldoDeclaradoCent ?? 0) - valorCent,
      dataSaldoDeclarado: data, alteradoEm: agora,
    });
    await db.bancos.update(destino.id, {
      saldoDeclaradoCent: (destino.saldoDeclaradoCent ?? 0) + valorCent,
      dataSaldoDeclarado: data, alteradoEm: agora,
    });
    await marcarMudanca();
  });
}

/** Apaga as duas pernas de uma transferência. Não toca em `saldoDeclaradoCent` dos bancos —
 *  reverter exigiria saber se o banco já foi conferido de novo depois; corrigir o saldo é
 *  manual, em Ajustes → Bancos. `transferenciaId` não é índice: `.filter()`, não `.where()`. */
export async function excluirTransferencia(transferenciaId: ID): Promise<void> {
  await db.transaction('rw', db.lancamentos, db.config, async () => {
    await db.lancamentos.filter((l) => l.transferenciaId === transferenciaId).delete();
    await marcarMudanca();
  });
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/db/repo.test.ts`
Expected: PASS — toda a suíte de `repo.test.ts`, incluindo os testes novos.

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "$(cat <<'EOF'
feat(db): repo.transferirEntreBancos e repo.excluirTransferencia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

### Task 3: Excluir transferência dos totais de Análises

**Files:**
- Modify: `src/domain/aggregations.ts`
- Modify: `src/domain/aggregations.test.ts`

**Interfaces:**
- Consumes: `OrigemLancamento` (Task 1).
- Produces: `filtrar()` (função interna) passa a excluir `origem: 'transferencia'`; nenhuma assinatura pública muda.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/domain/aggregations.test.ts`, depois do teste `'resumoMensal com previstos inclui o previsto mas nunca o cenário'`, adicionar:

```ts
it('resumoMensal ignora lançamentos de transferência entre bancos', () => {
  const comTransferencia = [
    ...lancs,
    lanc({ id: 't1', data: '2026-07-15', valor: 20000, categoriaId: 'car', origem: 'transferencia' }),
    lanc({ id: 't2', data: '2026-07-15', valor: 20000, categoriaId: 'sal', origem: 'transferencia' }),
  ];
  const semTransferencia = resumoMensal('2026-07', ['be'], cats, lancs, false);
  const r = resumoMensal('2026-07', ['be'], cats, comTransferencia, false);
  expect(r.totalGanhos).toBe(semTransferencia.totalGanhos);
  expect(r.totalGastos).toBe(semTransferencia.totalGastos);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/aggregations.test.ts -t "ignora lançamentos de transferência"`
Expected: FAIL — os dois lançamentos de transferência ainda entram na soma.

- [ ] **Step 3: Implementar em `aggregations.ts`**

Em `src/domain/aggregations.ts`, a função `filtrar` (linhas 21-35):

```ts
function filtrar(
  mes: string,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): Lancamento[] {
  const sel = new Set(boxIds);
  return lancamentos.filter(
    (l) =>
      sel.has(l.boxId) &&
      !l.cenarioId &&
      l.origem !== 'transferencia' &&
      mesDe(l.data) === mes &&
      (l.status === 'efetivo' || incluirPrevistos),
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/domain/aggregations.test.ts`
Expected: PASS — toda a suíte, incluindo o teste novo. `filtrar` também alimenta `compararMeses`, `serieMensal`, `serieMensalResumo` e `lancamentosDaCategoria` — todos ganham a exclusão de graça.

- [ ] **Step 5: Commit**

```bash
git add src/domain/aggregations.ts src/domain/aggregations.test.ts
git commit -m "$(cat <<'EOF'
fix(analises): exclui lançamentos de transferência dos totais de ganho/gasto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

### Task 4: Esconder as duas categorias dos seletores manuais

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/ui/TelaLancar.tsx`
- Modify: `src/ui/LancEditor.tsx`
- Modify: `src/ui/TelaSimulador.tsx`
- Modify: `src/ui/ajustes/Categorias.tsx`
- Modify: `src/ui/ajustes/Recorrencias.tsx`

**Interfaces:**
- Consumes: `categoriasTransferenciaIds` (Task 1).
- Produces: nenhuma função nova — só une o conjunto oculto nos seis lugares que já filtram `categoriasFaturaIds`.

Nenhum destes seis arquivos tem hoje um teste dedicado a "a categoria da fatura some do seletor" (só `src/state/store.test.ts` testa `estadoPrimeiroUso`, e não cobre esse ângulo) — a garantia mora no teste de `categoriasTransferenciaIds` (Task 1) mais a suíte cheia deste passo, que confirma que nada quebrou ao mudar as seis linhas.

- [ ] **Step 1: `src/state/store.ts`**

Trocar o import:

```ts
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
```

E a linha de `estadoPrimeiroUso`:

```ts
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
  const categoriasVisiveis = dados.categorias.filter((c) => !ocultas.has(c.id));
```

- [ ] **Step 2: `src/ui/TelaLancar.tsx`**

Trocar o import (linha 6):

```ts
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
```

E a linha `ocultas` (linha 52):

```ts
  const ocultas = useMemo(
    () => new Set([
      ...categoriasFaturaIds(dados?.cartoes ?? []),
      ...categoriasTransferenciaIds(dados?.boxes ?? []),
    ]),
    [dados],
  );
```

- [ ] **Step 3: `src/ui/LancEditor.tsx`**

Trocar o import (linha 3):

```ts
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
```

E a linha `ocultas` (linha 21):

```ts
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
```

- [ ] **Step 4: `src/ui/TelaSimulador.tsx`**

Trocar o import (linha 3):

```ts
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
```

E a linha `ocultas` (linha 23):

```ts
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
```

- [ ] **Step 5: `src/ui/ajustes/Categorias.tsx`**

Trocar o import (linha 6):

```ts
import { categoriasFaturaIds } from '../../domain/fatura';
import { categoriasTransferenciaIds } from '../../domain/transferencia';
```

E a linha `ocultas` (linha 81):

```ts
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
```

- [ ] **Step 6: `src/ui/ajustes/Recorrencias.tsx`**

Trocar o import (linha 3):

```ts
import { categoriasFaturaIds } from '../../domain/fatura';
import { categoriasTransferenciaIds } from '../../domain/transferencia';
```

E a linha `ocultas` (linha 40):

```ts
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
```

- [ ] **Step 7: Rodar a suíte inteira e o typecheck**

Run: `npm test`
Expected: PASS — nenhum teste existente quebra (as boxes de teste não têm as categorias ocultas de transferência, então `categoriasTransferenciaIds` devolve conjunto vazio e o comportamento é idêntico ao de antes).

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/state/store.ts src/ui/TelaLancar.tsx src/ui/LancEditor.tsx src/ui/TelaSimulador.tsx src/ui/ajustes/Categorias.tsx src/ui/ajustes/Recorrencias.tsx
git commit -m "$(cat <<'EOF'
feat: esconde as categorias ocultas de transferência dos seletores manuais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

### Task 5: Botão ↔ na Hoje → Conferir

**Files:**
- Modify: `src/ui/TelaHoje.tsx`
- Modify: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consumes: `repo.transferirEntreBancos` (Task 2).
- Produces: `ConferenciaBancos` ganha a prop `onTransferir: () => Promise<void>`; novo componente interno `FormTransferencia`.

Reaproveita só classes já cadastradas (`.item`, `.item-coluna`, `.campo`, `.linha`, `.cresce`, `.acoes`, `.botao`, `.botao-primario`, `.botao-sinal`) — nada para catalogar.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/ui/TelaHoje.test.tsx`, dentro do `describe` que já testa `ConferenciaBancos` (dois ou mais bancos), adicionar:

```ts
it('duas contas mostram o botão de transferir; uma conta só, não', async () => {
  const box = await comBoxESaldo();
  await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: box.id });

  const { unmount } = render(<TelaHoje />);
  await abrirAba('Conferir');
  expect(screen.queryByRole('button', { name: /Transferir de/ })).not.toBeInTheDocument();
  unmount();

  await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await useApp.getState().recarregar();
  render(<TelaHoje />);
  await abrirAba('Conferir');
  expect(screen.getByRole('button', { name: 'Transferir de Bradesco' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Transferir de Nubank' })).toBeInTheDocument();
});

it('confirmar a transferência ajusta os dois saldos e cria os dois lançamentos ligados', async () => {
  const box = await comBoxESaldo();
  const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  const bancoB = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await repo.atualizarBanco(bancoA.id, { saldoDeclaradoCent: 300000, dataSaldoDeclarado: '2026-07-01' });
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await abrirAba('Conferir');
  await userEvent.click(screen.getByRole('button', { name: 'Transferir de Bradesco' }));
  await userEvent.click(screen.getByLabelText('Valor'));
  await userEvent.keyboard('50000');
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));

  await vi.waitFor(async () => {
    expect((await db.bancos.get(bancoA.id))?.saldoDeclaradoCent).toBe(250000);
  });
  expect((await db.bancos.get(bancoB.id))?.saldoDeclaradoCent).toBe(50000);
  const pernas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia');
  expect(pernas).toHaveLength(2);
  expect(pernas[0].transferenciaId).toBe(pernas[1].transferenciaId);
});

it('cancelar fecha o formulário sem transferir nada', async () => {
  const box = await comBoxESaldo();
  const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await useApp.getState().recarregar();
  useApp.setState({ boxSel: box.id });

  render(<TelaHoje />);
  await abrirAba('Conferir');
  await userEvent.click(screen.getByRole('button', { name: 'Transferir de Bradesco' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(screen.queryByRole('button', { name: 'Confirmar transferência' })).not.toBeInTheDocument();
  expect((await db.bancos.get(bancoA.id))?.saldoDeclaradoCent).toBeNull();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/TelaHoje.test.tsx -t "Transferir de"`
Expected: FAIL — o botão "Transferir de ..." não existe ainda.

- [ ] **Step 3: Implementar em `TelaHoje.tsx`**

No import do React (linha 1), adicionar `Fragment`:

```ts
import { Fragment, useId, useMemo, useRef, useState } from 'react';
```

Antes da função `ConferenciaBancos` (antes da linha 94), adicionar:

```tsx
/** Formulário embutido por banco, na aba Conferir: move saldo declarado para outro banco da
 *  mesma box e cria os dois lançamentos ligados (`repo.transferirEntreBancos`). Só aparece
 *  quando a box tem 2+ bancos — com um banco só não há para onde transferir. */
function FormTransferencia({ bancoOrigem, destinos, hoje, onFeito, onCancelar }: {
  bancoOrigem: Banco;
  destinos: Banco[];
  hoje: ISODate;
  onFeito: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '');
  const [valor, setValor] = useState(0);
  const [data, setData] = useState<ISODate>(hoje);
  const uid = useId();

  async function confirmar() {
    if (valor <= 0 || !destinoId) return;
    await repo.transferirEntreBancos(bancoOrigem.id, destinoId, valor, data);
    await onFeito();
  }

  return (
    <div className="item item-coluna">
      <div className="campo">
        <label htmlFor={`${uid}-destino`}>Transferir de {bancoOrigem.nome} para</label>
        <select id={`${uid}-destino`} value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
          {destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
      </div>
      <div className="acoes">
        <button className="botao botao-primario" onClick={confirmar}>Confirmar transferência</button>
        <button className="botao" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}
```

Na assinatura de `ConferenciaBancos` (linha 94), adicionar a prop `onTransferir`:

```tsx
function ConferenciaBancos({ bancos, boxes, agruparPorBox, saldoApp, hoje, onSalvarBancos, onTransferir }: {
  bancos: Banco[];
  boxes: Box[];
  agruparPorBox: boolean;
  saldoApp: number;
  hoje: ISODate;
  onSalvarBancos: (mudancas: { id: string; cents: number }[], data: ISODate) => Promise<void>;
  onTransferir: () => Promise<void>;
}) {
```

Logo depois de `const editados = useRef<Set<string>>(new Set());` (linha 108), adicionar:

```tsx
  const [transferindoDe, setTransferindoDe] = useState<string | null>(null);
```

Trocar o bloco `{g.itens.map((b) => ( ... ))}` (linhas 147-164) por:

```tsx
          {g.itens.map((b) => (
            <Fragment key={b.id}>
              <div className={`linha-banco${agruparPorBox ? ' recuo-1' : ''}`}>
                <span>{b.nome}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)"
                    onClick={() => alternarSinal(b.id)}
                  >
                    {negativos[b.id] ? '−' : '+'}
                  </button>
                  <CampoValor
                    id={`banco-${b.id}`} valorCentavos={magnitudes[b.id] ?? 0}
                    onChange={(v) => mudarValor(b.id, v)}
                    ariaLabel={b.nome} style={{ width: 110 }}
                  />
                  {g.itens.length > 1 && (
                    <button
                      type="button" className="botao botao-sinal" aria-label={`Transferir de ${b.nome}`}
                      onClick={() => setTransferindoDe((atual) => (atual === b.id ? null : b.id))}
                    >
                      ↔
                    </button>
                  )}
                </div>
              </div>
              {transferindoDe === b.id && (
                <FormTransferencia
                  bancoOrigem={b} destinos={g.itens.filter((x) => x.id !== b.id)} hoje={hoje}
                  onFeito={async () => { setTransferindoDe(null); await onTransferir(); }}
                  onCancelar={() => setTransferindoDe(null)}
                />
              )}
            </Fragment>
          ))}
```

No corpo de `TelaHoje` (por volta da linha 330), passar a prop nova:

```tsx
            <ConferenciaBancos key={`${boxSel}-${chaveBancos}`} bancos={bancos} boxes={dados.boxes}
              agruparPorBox={boxSel === 'casa'} saldoApp={deHoje?.saldoEfetivo ?? 0} hoje={hoje}
              onSalvarBancos={salvarSaldosBancos} onTransferir={recarregar} />
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Expected: PASS — toda a suíte, incluindo os três testes novos e os já existentes de `ConferenciaBancos` (nada nesta mudança altera o comportamento de salvar a conferência manual).

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "$(cat <<'EOF'
feat(hoje): botão de transferir saldo entre bancos na aba Conferir

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

### Task 6: Sheet de detalhe no Fluxo e catálogo

**Files:**
- Create: `src/ui/TransferenciaSheet.tsx`
- Create: `src/ui/TransferenciaSheet.test.tsx`
- Modify: `src/ui/TelaFluxo.tsx`
- Modify: `src/ui/TelaFluxo.test.tsx`
- Modify: `docs/estilo/catalogo.md`

**Interfaces:**
- Consumes: `repo.excluirTransferencia` (Task 2); `Sheet` (`src/ui/Sheet.tsx`).
- Produces: `export default function TransferenciaSheet({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void })`.

- [ ] **Step 1: Escrever o teste do sheet que falha**

Criar `src/ui/TransferenciaSheet.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import TransferenciaSheet from './TransferenciaSheet';

beforeEach(async () => {
  await limparDb();
});

async function seedTransferencia() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const bradesco = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  const nubank = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await repo.transferirEntreBancos(bradesco.id, nubank.id, 50000, '2026-07-05');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });
  const saida = (await db.lancamentos.toArray())
    .find((l) => l.origem === 'transferencia' && l.bancoId === bradesco.id) as Lancamento;
  return { saida };
}

it('mostra os bancos, a data e o valor, e exclui as duas pernas ao confirmar', async () => {
  const { saida } = await seedTransferencia();
  const onFechar = vi.fn();
  window.confirm = vi.fn(() => true);
  render(<TransferenciaSheet lanc={saida} onFechar={onFechar} />);

  expect(await screen.findByRole('dialog', { name: 'Transferência' })).toBeInTheDocument();
  expect(screen.getByText('Bradesco → Nubank')).toBeInTheDocument();
  expect(screen.getByText('R$ 500,00')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Excluir transferência' }));

  expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(0);
  expect(onFechar).toHaveBeenCalledOnce();
});

it('cancelar a confirmação de exclusão não apaga nada', async () => {
  const { saida } = await seedTransferencia();
  window.confirm = vi.fn(() => false);
  render(<TransferenciaSheet lanc={saida} onFechar={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir transferência' }));

  expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(2);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TransferenciaSheet.test.tsx`
Expected: FAIL — `./TransferenciaSheet` não existe.

- [ ] **Step 3: Implementar `TransferenciaSheet.tsx`**

```tsx
import { formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import * as repo from '../db/repo';
import { useApp } from '../state/store';
import Sheet from './Sheet';

/** Sheet somente leitura com o detalhe de uma transferência entre bancos (nota já traz
 *  "banco origem → banco destino", gravada por `repo.transferirEntreBancos`). Excluir apaga
 *  as duas pernas juntas, mas não reverte o saldo declarado dos bancos — aviso explícito
 *  aqui, correção manual em Ajustes → Bancos se precisar. */
export default function TransferenciaSheet({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { recarregar } = useApp();

  async function excluir() {
    if (!lanc.transferenciaId) return;
    if (!window.confirm('Excluir esta transferência? Isso não desfaz o ajuste de saldo nos bancos.')) return;
    await repo.excluirTransferencia(lanc.transferenciaId);
    await recarregar();
    onFechar();
  }

  return (
    <Sheet
      aberto onFechar={onFechar} rotulo="Transferência"
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{lanc.nota}</h2>
          <p className="sub" style={{ margin: 0 }}>{formatarDataBR(lanc.data)}</p>
        </>
      )}
    >
      <div className="lista" style={{ marginTop: 8 }}>
        <div className="item">
          <div className="cresce">Valor transferido</div>
          <span className="valor-gasto">{formatarBRL(lanc.valor)}</span>
        </div>
      </div>
      <p className="aviso" style={{ marginTop: 14 }}>
        Excluir apaga os dois lançamentos, mas não desfaz o ajuste de saldo nos bancos —
        corrija em Ajustes → Bancos se precisar.
      </p>
      <button className="botao botao-perigo" style={{ marginTop: 14, width: '100%' }} onClick={excluir}>
        Excluir transferência
      </button>
    </Sheet>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TransferenciaSheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Escrever o teste de roteamento no Fluxo que falha**

Em `src/ui/TelaFluxo.test.tsx`, adicionar:

```ts
it('clicar num lançamento de transferência abre o sheet de detalhe, não o editor genérico', async () => {
  const { box } = await seedBoxComCategoria();
  const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
  const bancoB = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
  await repo.transferirEntreBancos(bancoA.id, bancoB.id, 50000, '2026-07-05');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);
  await userEvent.click(screen.getAllByText('Bradesco → Nubank')[0]);

  expect(await screen.findByRole('dialog', { name: 'Transferência' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Lançamento' })).not.toBeInTheDocument();
});
```

(`seedBoxComCategoria` já existe no arquivo e devolve `{ box, catMercado, catSalario }` — só o `box` é usado aqui.)

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx -t "abre o sheet de detalhe"`
Expected: FAIL — clicar ainda abre `LancEditor` (`origem: 'transferencia'` cai no `else` de `setEditando`).

- [ ] **Step 7: Ligar `TransferenciaSheet` em `TelaFluxo.tsx`**

Adicionar o import (perto de `import LancEditor from './LancEditor';`):

```ts
import TransferenciaSheet from './TransferenciaSheet';
```

Adicionar o estado (perto de `const [faturaSel, setFaturaSel] = useState<Lancamento | null>(null);`):

```ts
  const [transferenciaSel, setTransferenciaSel] = useState<Lancamento | null>(null);
```

Trocar o `onClick` do item (linha 190):

```tsx
                  <button
                    key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => (
                      l.origem === 'cartao' ? setFaturaSel(l)
                      : l.origem === 'transferencia' ? setTransferenciaSel(l)
                      : setEditando(l)
                    )}
                  >
```

E, ao lado de `{faturaSel && <FaturaResumo lanc={faturaSel} onFechar={() => setFaturaSel(null)} />}` (linha 219):

```tsx
      {transferenciaSel && (
        <TransferenciaSheet lanc={transferenciaSel} onFechar={() => setTransferenciaSel(null)} />
      )}
```

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: PASS — toda a suíte, incluindo o teste novo.

- [ ] **Step 9: Catalogar o componente novo**

Em `docs/estilo/catalogo.md`, ao fim da seção "Componentes compartilhados", depois da entrada de `EscanearNotaSheet.tsx`:

```markdown
- **`TransferenciaSheet.tsx`** — sheet somente leitura com o detalhe de uma transferência
  entre bancos (a nota do lançamento, "banco origem → banco destino", mais valor e data), com
  o botão que exclui as duas pernas ligadas por `transferenciaId`. Mesmo padrão do
  `FaturaResumo.tsx`. Usado pela `TelaFluxo` ao clicar num lançamento `origem: 'transferencia'`.
```

- [ ] **Step 10: Rodar o guard do catálogo, a suíte inteira, o typecheck e o build**

Run: `node scripts/verificar-catalogo.mjs`
Expected: sem aviso sobre `TransferenciaSheet.tsx`.

Run: `npm test`
Expected: PASS — suíte inteira.

Run: `npx tsc -b --noEmit`
Expected: PASS

Run: `npm run build`
Expected: build conclui sem erro.

Run: `node scripts/verificar-dados-reais.mjs`
Expected: sem aviso — todo dado desta tarefa (testes, mockups) é sintético.

- [ ] **Step 11: Commit**

```bash
git add src/ui/TransferenciaSheet.tsx src/ui/TransferenciaSheet.test.tsx src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx docs/estilo/catalogo.md
git commit -m "$(cat <<'EOF'
feat(fluxo): sheet de detalhe da transferência entre bancos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VGz5s9roPHDx26dYLPAS6u
EOF
)"
```

---

## Depois do plano

Este trabalho é **visível ao usuário** — invoque a skill `ciclo-de-entrega` antes de integrar: fragmento em `changelog.d/`, wiki (`docs/wiki/`) atualizada, confirmação do usuário sobre o changelog, merge na `main`, `npm run release` e `npm run deploy`.
