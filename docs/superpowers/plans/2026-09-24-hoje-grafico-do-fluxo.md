# Hoje leva ao gráfico do Fluxo — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** a Visão da Hoje ganha o link "Ver gráfico completo ›", que abre o Fluxo já na aba Gráfico; o filtro por data do Fluxo explica o `—` de um dia anterior ao início da projeção.

**Arquitetura:** o store ganha `fluxoAba` + `abrirFluxo(aba)` + `limparFluxoAba()`, no molde de `ajustesSecao`/`abrirAjustes`. O `TelaFluxo` lê `fluxoAba` como estado inicial e o limpa. A Hoje só chama `abrirFluxo('grafico')`.

**Stack:** React 18, TypeScript, Zustand, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-24-hoje-grafico-expandido-design.md`.

## Restrições globais

- Todo texto de UI, teste, doc e commit em português.
- Nenhuma classe CSS nova. `src/styles.css` não muda. O link usa `.botao-ver-mais`.
- `style` inline só com layout (`marginTop`).
- Não usar `{ timeout: n }` em `findBy*`/`waitFor`.
- Não mudar `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json` nem `.claude/`.
- Nenhuma dependência nova.
- Não editar `"version"` do `package.json` nem o topo do `CHANGELOG.md`.
- Só dados sintéticos em testes e docs.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs
  ```
- Rodar tudo no worktree `.worktrees/hoje-grafico-expandido` (branch `hoje-grafico-expandido`).

---

### Tarefa 1: store — `abrirFluxo(aba)`

**Arquivos:**
- Modificar: `src/state/store.ts`
- Teste: `src/state/store.test.ts`

**Interfaces:**
- Produz: `export type AbaFluxo = 'lista' | 'grafico'`; no estado, `fluxoAba: AbaFluxo | null`, `abrirFluxo(aba: AbaFluxo): void` (define `aba: 'fluxo'` e `fluxoAba: aba`) e `limparFluxoAba(): void` (define `fluxoAba: null`).

- [ ] **Passo 1: teste que falha** — no fim de `src/state/store.test.ts`:

```ts
it('abrirFluxo troca para a aba Fluxo e guarda a aba interna pedida, até ser limpa', () => {
  useApp.setState({ aba: 'hoje', fluxoAba: null });

  useApp.getState().abrirFluxo('grafico');
  expect(useApp.getState().aba).toBe('fluxo');
  expect(useApp.getState().fluxoAba).toBe('grafico');

  useApp.getState().limparFluxoAba();
  expect(useApp.getState().fluxoAba).toBeNull();
  expect(useApp.getState().aba).toBe('fluxo');
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/state/store.test.ts -t "abrirFluxo"`
Esperado: FAIL (`abrirFluxo is not a function`).

- [ ] **Passo 3: implementar** em `src/state/store.ts`:

Depois da linha de `SecaoAjustes`:

```ts
/** Aba interna do Fluxo; `abrirFluxo` escolhe qual abre na chegada. */
export type AbaFluxo = 'lista' | 'grafico';
```

Em `interface AppState`, depois de `ajustesSecao: SecaoAjustes | null;`:

```ts
  fluxoAba: AbaFluxo | null;
```

e depois de `limparAjustesSecao(): void;`:

```ts
  abrirFluxo(aba: AbaFluxo): void;
  limparFluxoAba(): void;
```

No objeto do `create`, depois de `ajustesSecao: null,`:

```ts
  fluxoAba: null,
```

e depois de `limparAjustesSecao: ...`:

```ts
  abrirFluxo: (aba) => set({ aba: 'fluxo', fluxoAba: aba }),
  limparFluxoAba: () => set({ fluxoAba: null }),
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/state/store.test.ts`
Esperado: PASS.

- [ ] **Passo 5: `src/dossie/tela.tsx`** — a linha 187 zera o estado de navegação do store (`ajustesSecao: null`) antes de cada retrato. Acrescentar `fluxoAba: null,` ao lado, para o dossiê sempre abrir o Fluxo na Lista. Rodar `npx tsc -b` e confirmar zero erros.

- [ ] **Passo 6: commit**

```bash
git add src/state/store.ts src/state/store.test.ts src/dossie/tela.tsx
git commit -m "feat(store): abrirFluxo escolhe a aba interna do Fluxo na chegada"
```

---

### Tarefa 2: Fluxo — abre na aba pedida e explica o início da projeção

**Arquivos:**
- Modificar: `src/ui/TelaFluxo.tsx`
- Teste: `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consome: `AbaFluxo`, `fluxoAba`, `limparFluxoAba` (Tarefa 1).

- [ ] **Passo 1: testes que falham** — em `src/ui/TelaFluxo.test.tsx`, no `beforeEach` do topo, depois de `await limparDb();`:

```ts
  useApp.setState({ fluxoAba: null });
```

E no fim do arquivo:

```ts
it('abre na aba Gráfico quando pedida por abrirFluxo, e só na chegada', async () => {
  const { box } = await seedBoxComCategoria();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });
  useApp.getState().abrirFluxo('grafico');

  const { unmount } = render(<TelaFluxo />);
  expect(screen.getByRole('tab', { name: 'Gráfico' })).toHaveAttribute('aria-selected', 'true');
  expect(useApp.getState().fluxoAba).toBeNull();

  unmount();
  render(<TelaFluxo />);
  expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true');
});

it('dia antes do início da projeção mostra traço e quando a projeção começa', async () => {
  const { box } = await seedBoxComCategoria(); // dataSaldoInicial 2025-01-01
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);
  await abrirFiltros();
  fireEvent.change(screen.getByLabelText('Buscar por data'), { target: { value: '2024-06-01' } });

  expect(await screen.findByText(`A projeção começa em ${formatarDataBR('2025-01-01')}.`)).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByText('Nenhum lançamento neste dia.')).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx -t "abrirFluxo|início da projeção"`
Esperado: os dois FAIL (aba Lista selecionada; frase ausente).

- [ ] **Passo 3: implementar** em `src/ui/TelaFluxo.tsx`:

Imports: trocar `import { Suspense, lazy, useMemo, useState } from 'react';` por

```ts
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
```

e `import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';` por

```ts
import { boxIdsSelecionadas, cenariosLigados, useApp, type AbaFluxo } from '../state/store';
```

Apagar a linha local `type AbaFluxo = 'grafico' | 'lista';` (o comentário "NOTA DE PATCH" acima dela fica).

Trocar `const { dados, boxSel, hoje } = useApp();` por

```ts
  const { dados, boxSel, hoje, fluxoAba, limparFluxoAba } = useApp();
```

Trocar `const [abaFluxo, setAbaFluxo] = useState<AbaFluxo>('lista');` por

```ts
  // A aba pedida de fora (Hoje → "Ver gráfico completo") vale só na chegada.
  const [abaFluxo, setAbaFluxo] = useState<AbaFluxo>(() => fluxoAba ?? 'lista');
  useEffect(() => {
    if (fluxoAba) limparFluxoAba();
  }, [fluxoAba, limparFluxoAba]);
```

Esses hooks ficam **antes** do `if (!dados) return null;` (regra dos hooks).

Depois de `const horizonte = dados.config.horizonteProjecao;` acrescentar:

```ts
  const inicioSerie = serie[0]?.data;
```

E logo depois do bloco `{saldo == null && dia > horizonte && (...)}`, acrescentar:

```tsx
                  {saldo == null && inicioSerie != null && dia < inicioSerie && (
                    <p className="sub">A projeção começa em {formatarDataBR(inicioSerie)}.</p>
                  )}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Esperado: PASS (arquivo inteiro).

- [ ] **Passo 5: commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(fluxo): abre na aba pedida e diz quando a projeção começa"
```

---

### Tarefa 3: Hoje — link "Ver gráfico completo ›"

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (card da Visão, perto da linha 380)
- Teste: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `abrirFluxo` (Tarefa 1).

- [ ] **Passo 1: testes que falham** — em `src/ui/TelaHoje.test.tsx`, no `beforeEach`, trocar `useApp.setState({ aba: 'hoje', ajustesSecao: null });` por

```ts
  useApp.setState({ aba: 'hoje', ajustesSecao: null, fluxoAba: null });
```

E no fim do arquivo:

```ts
it('link sob o mini-gráfico leva ao Fluxo na aba Gráfico', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.click(screen.getByRole('button', { name: 'Ver gráfico completo ›' }));

  expect(useApp.getState().aba).toBe('fluxo');
  expect(useApp.getState().fluxoAba).toBe('grafico');
});

it('sem série para desenhar, não mostra o link do gráfico', async () => {
  const agora = agoraISO();
  // saldo começa depois de hoje + 28: a janela do mini-gráfico fica vazia
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-12-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText(/Saldo hoje/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver gráfico completo ›' })).not.toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx -t "link"`
Esperado: o primeiro FAIL (botão não encontrado); o segundo pode passar já — tudo bem, ele protege a condição.

- [ ] **Passo 3: implementar** em `src/ui/TelaHoje.tsx`:

Trocar `const { dados, boxSel, hoje, recarregar, abrirAjustes } = useApp();` (linha 247) por `const { dados, boxSel, hoje, recarregar, abrirAjustes, abrirFluxo } = useApp();`.

Logo depois de

```tsx
              <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
```

acrescentar:

```tsx
              {/* mesma condição do BalanceChart, que não desenha com menos de 2 dias */}
              {janela.length >= 2 && (
                <button type="button" className="botao-ver-mais" style={{ marginTop: 10 }} onClick={() => abrirFluxo('grafico')}>
                  Ver gráfico completo ›
                </button>
              )}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Esperado: PASS (arquivo inteiro).

- [ ] **Passo 5: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(hoje): link do mini-gráfico para o gráfico completo do Fluxo"
```

---

### Tarefa 4: docs, dossiê e fragmento

**Arquivos:**
- Modificar: `docs/estilo/catalogo.md` (linha de `.botao-ver-mais`)
- Modificar: `docs/wiki/6-telas.md` (bullet **Visão** da Hoje; bullet **Lista** do Fluxo)
- Criar: `changelog.d/alterado-hoje-grafico-do-fluxo.md`
- Regenerar: `docs/dossie/` se o teste do dossiê acusar

- [ ] **Passo 1: catálogo** — trocar a descrição de `.botao-ver-mais` por:

```
| `.botao-ver-mais` | link azul de texto: mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) ou levar a outra tela a partir de um card (ex.: "Ver gráfico completo ›" na Hoje, "abrir o cartão" na fatura) |
```

- [ ] **Passo 2: wiki** — em `docs/wiki/6-telas.md`, no bullet **Visão**, trocar a frase final `Mini-gráfico da janela de 7 dias atrás a 28 dias à frente.` por:

```
Mini-gráfico da janela de 7 dias atrás a 28 dias à frente; embaixo dele, "Ver gráfico completo ›" abre o Fluxo direto na aba Gráfico, com a projeção inteira.
```

Na seção do Fluxo, bullet **Lista**, trocar a última frase `Um dia depois do fim da projeção mostra um traço no lugar do saldo e até quando a projeção vai.` por:

```
Um dia fora da projeção mostra um traço no lugar do saldo: depois do fim, diz até quando a projeção vai; antes do começo, diz quando ela começa.
```

Validar o parser: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS.

- [ ] **Passo 3: fragmento** — criar `changelog.d/alterado-hoje-grafico-do-fluxo.md`:

```
- Hoje: novo link "Ver gráfico completo ›" sob o mini-gráfico, que abre o Fluxo direto na aba Gráfico
- Fluxo: filtrar um dia anterior ao início da projeção agora diz quando ela começa
```

- [ ] **Passo 4: suíte inteira**

Run: `npm test`
Se `src/dossie/dossie.test.ts` acusar dossiê desatualizado: `npm run dossie`, conferir o diff de `docs/dossie/` (só o link novo e/ou a frase nova devem aparecer) e rodar `npm test` de novo.
Esperado: tudo PASS.

- [ ] **Passo 5: build**

Run: `npm run build`
Esperado: sem erros.

- [ ] **Passo 6: commit**

```bash
git add docs/estilo/catalogo.md docs/wiki/6-telas.md changelog.d/alterado-hoje-grafico-do-fluxo.md docs/dossie
git commit -m "docs: wiki, catálogo e changelog do link da Hoje para o gráfico do Fluxo"
```
