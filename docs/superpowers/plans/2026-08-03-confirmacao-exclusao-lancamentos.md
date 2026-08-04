# Confirmação ao excluir/descartar lançamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `window.confirm(...)` antes de excluir/descartar um lançamento nos dois pontos do app que hoje fazem isso sem perguntar nada.

**Architecture:** Nenhum componente novo. Segue o idioma já usado em `Recorrencias.tsx`, `Assinaturas.tsx`, `Viagens.tsx`, `FormCompra.tsx` e `TelaSimulador.tsx`: `if (!window.confirm(mensagem)) return;` logo no início da função que já existe, antes da chamada a `repo.excluirLancamento`.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library + `vi.spyOn(window, 'confirm')` (mesmo padrão de `TelaCartao.test.tsx` e `Viagens.test.tsx`).

## Global Constraints

- Não criar componente de modal — usar `window.confirm` nativo, igual ao resto do app.
- Não alterar o comportamento de `repo.excluirLancamento` nem de `recurrence.ts`.
- Não é edição de UI visual (nenhuma classe/componente/token novo) — não aciona `docs/estilo-visual.md` nem o catálogo.
- Mensagens de confirmação em português, no mesmo tom direto e curto já usado no resto do app (ex.: `"Excluir a recorrência e seus previstos? (confirmados são mantidos)"`).
- Testes usam `vi.spyOn(window, 'confirm')` — sempre restaurar com `.mockRestore()` em `finally` quando combinado com `vi.useFakeTimers`, ou deixar o spy solto quando não há fake timers (padrão já usado em `Viagens.test.tsx`, que não restaura explicitamente).

---

### Task 1: Confirmação ao excluir no `LancEditor`

**Files:**
- Modify: `src/ui/LancEditor.tsx:40-44` (função `excluir`)
- Test: `src/ui/LancEditor.test.tsx` (adicionar ao final do arquivo)

**Interfaces:**
- Consumes: `repo.excluirLancamento(id: ID): Promise<void>` (já existe em `src/db/repo.ts:87`), `lanc.status: 'previsto' | 'efetivo'` (já existe em `Lancamento`).
- Produces: nada consumido por outras tasks — mudança isolada nesse arquivo.

- [ ] **Step 1: Escrever os dois testes que falham**

Adicionar ao final de `src/ui/LancEditor.test.tsx`:

```tsx
it('excluir pede confirmação: cancelar mantém o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'efetivo',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const onFechar = vi.fn();
  render(<LancEditor lanc={lanc} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  expect(confirmSpy).toHaveBeenCalledWith('Excluir este lançamento?');
  expect(onFechar).not.toHaveBeenCalled();
  expect(await db.lancamentos.get(lanc.id)).toBeDefined();
  confirmSpy.mockRestore();
});

it('excluir pede confirmação: confirmar apaga o lançamento', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const previsto = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'previsto',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const onFechar = vi.fn();
  render(<LancEditor lanc={previsto} onFechar={onFechar} />);

  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

  expect(confirmSpy).toHaveBeenCalledWith('Excluir este previsto?');
  await waitFor(() => {
    expect(onFechar).toHaveBeenCalledOnce();
  });
  expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
  confirmSpy.mockRestore();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: os dois testes novos falham — o de "cancelar" falha porque `db.lancamentos.get(lanc.id)` já não existe (excluído sem perguntar); o de "confirmar" falha na asserção `toHaveBeenCalledWith` (confirm nunca é chamado hoje).

- [ ] **Step 3: Implementar a confirmação**

Em `src/ui/LancEditor.tsx`, substituir a função `excluir` (linhas 40-44):

```ts
  async function excluir() {
    const msg = lanc.status === 'previsto' ? 'Excluir este previsto?' : 'Excluir este lançamento?';
    if (!window.confirm(msg)) return;
    await repo.excluirLancamento(lanc.id);
    await recarregar();
    onFechar();
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: todos os testes do arquivo passam (os 3 pré-existentes + os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx
git commit -m "fix: pede confirmação antes de excluir lançamento no editor"
```

---

### Task 2: Confirmação ao descartar na fila de pendentes (`TelaHoje`)

**Files:**
- Modify: `src/ui/TelaHoje.tsx:114-117` (função `descartar`)
- Test: `src/ui/TelaHoje.test.tsx` (adicionar próximo ao teste existente `'pendente que não é fatura continua com "Descartar"'`, dentro do mesmo `describe`/bloco onde esse teste já vive)

**Interfaces:**
- Consumes: `repo.excluirLancamento(id: ID): Promise<void>` (já existe em `src/db/repo.ts:87`).
- Produces: nada consumido por outras tasks — mudança isolada nesse arquivo. Independente da Task 1 (arquivos diferentes).

- [ ] **Step 1: Escrever os dois testes que falham**

Adicionar em `src/ui/TelaHoje.test.tsx`, logo depois do teste `'pendente que não é fatura continua com "Descartar"'` (mesmo nível de indentação desse bloco):

```tsx
  it('descartar pede confirmação: cancelar mantém o pendente na fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(await db.lancamentos.get(previsto.id)).toBeDefined();
    confirmSpy.mockRestore();
  });

  it('descartar pede confirmação: confirmar remove o pendente da fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    });
    expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
    confirmSpy.mockRestore();
  });
```

`waitFor` ainda não está importado em `src/ui/TelaHoje.test.tsx`. Trocar a linha 3 de:

```ts
import { act, render, screen } from '@testing-library/react';
```

para:

```ts
import { act, render, screen, waitFor } from '@testing-library/react';
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Expected: os dois testes novos falham (mesmo motivo da Task 1 — `descartar` hoje apaga direto sem chamar `window.confirm`).

- [ ] **Step 3: Implementar a confirmação**

Em `src/ui/TelaHoje.tsx`, substituir a função `descartar` (linhas 114-117):

```ts
  async function descartar(id: string) {
    if (!window.confirm('Descartar este previsto?')) return;
    await repo.excluirLancamento(id);
    await recarregar();
  }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Expected: todos os testes do arquivo passam, incluindo os 2 novos.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "fix: pede confirmação antes de descartar previsto na fila de pendentes"
```

---

### Task 3: Suíte completa e changelog

**Files:**
- Create: `changelog.d/alterado-confirmacao-exclusao-lancamentos.md`

**Interfaces:**
- Consumes: nenhuma interface de código — depende apenas das Tasks 1 e 2 estarem commitadas.
- Produces: nada.

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam, incluindo os arquivos tocados nas Tasks 1 e 2.

- [ ] **Step 2: Criar o fragmento de changelog**

Formato de bullets planos, ver `changelog.d/README.md`. Criar `changelog.d/alterado-confirmacao-exclusao-lancamentos.md`:

```markdown
- Excluir um lançamento ou descartar um previsto agora pede confirmação antes de apagar
```

- [ ] **Step 3: Mostrar o fragmento ao usuário e esperar confirmação literal**

Segundo a skill `ciclo-de-entrega`: mostrar o conteúdo do fragmento ao usuário e esperar confirmação explícita antes de prosseguir para merge/release. Não seguir para o Step 4 sem essa confirmação.

- [ ] **Step 4: Commit do fragmento**

```bash
git add changelog.d/alterado-confirmacao-exclusao-lancamentos.md
git commit -m "docs: fragmento de changelog para confirmação ao excluir/descartar lançamentos"
```

Depois disso, a skill `ciclo-de-entrega` cobre o resto: merge na `main`, `npm run release`, push, `npm run deploy`.
