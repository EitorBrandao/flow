# Ajustes: Recorrências, Cartões, Categorias do cartão e Assinaturas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix box-scoping bugs and native-`<select>` pickers across Ajustes (Recorrências, Cartões, Categorias do cartão, Assinaturas), allow multiple active cartões per box, make assinaturas use an automatic "Assinaturas" category instead of a manual pick, reorder the Ajustes menu, and add a cross-card "Assinaturas" view in Análises.

**Architecture:** Two new shared UI components (`SeletorCategoria`, `SeletorPills`) replace native `<select>` pickers app-wide. A new `Cartao.categoriaAssinaturasId` field + `repo.categoriaAssinaturasDe()` lazily creates one hidden `CategoriaCartao` per cartão for assinaturas, mirroring the existing `categoriaFaturaId` pattern. A new domain function `resumoAssinaturasDoMes` (in `fatura.ts`, reusing `calcularFaturas`) powers a new "Assinaturas" row + sheet in Análises.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library + fake-indexeddb, Dexie (IndexedDB), no new dependencies.

## Global Constraints

- Código, UI e nomes de teste em português.
- Nenhuma classe CSS nova sem token existente (`docs/estilo/fundamentos.md`); `.grade-categorias` já existe, `.pills` é nova (nível 2, ver Task 6).
- Formulário de criar/adicionar sempre antes da lista (regra registrada em
  `docs/estilo/nivel-5-nova-tela.md`).
- Formulários de Ajustes ficam **inline**, nunca em `Sheet` (decisão de nível 6).
- Todo arquivo de tela/componente novo ganha `.test.tsx` no mesmo commit.
- Spec de referência: `docs/superpowers/specs/2026-07-22-ajustes-recorrencias-cartoes-design.md`.
- Branch de trabalho: `ajustes-recorrencias-cartoes` (já criada e com o spec commitado).

---

## File Structure

**Novos:**
- `src/ui/SeletorCategoria.tsx` + `.test.tsx` — grid de botões pra escolher categoria (substitui `<select>`).
- `src/ui/SeletorPills.tsx` + `.test.tsx` — pílulas em linha pra escolher Box/Cartão (substitui `<select>` de poucas opções).
- `src/ui/AssinaturasResumoSheet.tsx` + `.test.tsx` — sheet de Análises, assinaturas agrupadas por cartão.
- `src/ui/ajustes/Assinaturas.test.tsx` — não existia teste pra essa tela.

**Modificados:**
- `src/domain/types.ts` — `Cartao.categoriaAssinaturasId?`.
- `src/domain/categorias.ts` — `categoriasAssinaturasIds`.
- `src/domain/fatura.ts` + `.test.ts` — `resumoAssinaturasDoMes`.
- `src/db/repo.ts` + `.test.ts` — `categoriaAssinaturasDe`.
- `src/styles.css` — classe `.pills`.
- `src/ui/TelaLancar.tsx` + `.test.tsx` — usa `SeletorCategoria` (sem mudança de comportamento).
- `src/ui/ajustes/Recorrencias.tsx` + `.test.tsx` — box + tipo + `SeletorCategoria`, form no topo.
- `src/ui/ajustes/Cartoes.tsx` + `.test.tsx` — remove bloqueio de 1 cartão ativo, form no topo.
- `src/ui/TelaAjustes.tsx` — reordena o menu.
- `src/ui/ajustes/CategoriasCartao.tsx` — `SeletorPills` no lugar do `<select>` de cartão.
- `src/ui/ajustes/Assinaturas.tsx` — `SeletorPills` de cartão, sem campo de categoria, form no topo.
- `src/ui/FormCompra.tsx` + `.test.tsx` — `SeletorCategoria`, exclui a categoria oculta de assinaturas.
- `src/ui/LancEditor.tsx` + `.test.tsx` — `SeletorCategoria`.
- `src/ui/TelaSimulador.tsx` + `.test.tsx` — `SeletorCategoria` no formulário hipotético.
- `src/ui/TelaAnalises.tsx` + `.test.tsx` — linha "Assinaturas" + sheet.
- `docs/estilo/catalogo.md` — cataloga `.pills`, `SeletorCategoria`, `SeletorPills`, `AssinaturasResumoSheet`.

**Ordem de execução** (dependências): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16.

---

### Task 1: `Cartao.categoriaAssinaturasId` + `categoriasAssinaturasIds`

**Files:**
- Modify: `src/domain/types.ts:57-64`
- Modify: `src/domain/categorias.ts`
- Test: `src/domain/categorias.test.ts` (arquivo não existe — criar)

**Interfaces:**
- Produces: `Cartao.categoriaAssinaturasId?: ID`; `categoriasAssinaturasIds(cartoes: Cartao[]): Set<ID>` exportada de `src/domain/categorias.ts`.

- [ ] **Step 1: Adicionar o campo ao tipo `Cartao`**

Em `src/domain/types.ts`, dentro da interface `Cartao` (linhas 57-64), adicionar o campo logo
depois de `categoriaFaturaId`:

```ts
export interface Cartao extends Entidade {
  boxId: ID;
  nome: string;
  diaFechamento: number; // 1-31, clampado ao fim do mês
  diaVencimento: number; // 1-31, clampado
  categoriaFaturaId: ID; // categoria de gasto do Flow que recebe a fatura
  categoriaAssinaturasId?: ID; // CategoriaCartao oculta reservada p/ assinaturas; criada sob demanda
  ativo: boolean;
}
```

- [ ] **Step 2: Escrever o teste de `categoriasAssinaturasIds` (vai falhar)**

Criar `src/domain/categorias.test.ts`:

```ts
import type { Cartao } from './types';
import { categoriasAssinaturasIds } from './categorias';

function cartao(id: string, categoriaAssinaturasId?: string): Cartao {
  return {
    id, boxId: 'b1', nome: `cartao-${id}`, diaFechamento: 10, diaVencimento: 20,
    categoriaFaturaId: `fat-${id}`, categoriaAssinaturasId, ativo: true,
    criadoEm: '', alteradoEm: '',
  };
}

describe('categoriasAssinaturasIds', () => {
  it('retorna só os ids de categoriaAssinaturasId definidos', () => {
    const cartoes = [cartao('k1', 'ass1'), cartao('k2'), cartao('k3', 'ass3')];
    expect(categoriasAssinaturasIds(cartoes)).toEqual(new Set(['ass1', 'ass3']));
  });

  it('retorna conjunto vazio quando nenhum cartão tem categoria de assinaturas', () => {
    expect(categoriasAssinaturasIds([cartao('k1')])).toEqual(new Set());
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: FAIL — `categoriasAssinaturasIds` não existe em `./categorias`.

- [ ] **Step 4: Implementar `categoriasAssinaturasIds`**

Em `src/domain/categorias.ts`, trocar a linha de import do topo:

```ts
import type { Cartao, Categoria, CategoriaCartao, ID } from './types';
```

E adicionar ao fim do arquivo:

```ts
/** Ids das CategoriaCartao reservadas para assinaturas automáticas — não devem aparecer em
 *  nenhuma lista de seleção manual de categoria de cartão. */
export function categoriasAssinaturasIds(cartoes: Cartao[]): Set<ID> {
  return new Set(
    cartoes.map((c) => c.categoriaAssinaturasId).filter((id): id is ID => id != null),
  );
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 6: Rodar a suíte completa pra checar quebras**

Run: `npm test`
Expected: PASS (o campo novo é opcional; nenhum objeto `Cartao` existente em teste quebra)

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/categorias.ts src/domain/categorias.test.ts
git commit -m "feat(cartao): adiciona categoriaAssinaturasId e categoriasAssinaturasIds"
```

---

### Task 2: `repo.categoriaAssinaturasDe`

**Files:**
- Modify: `src/db/repo.ts` (inserir depois de `atualizarCategoriaCartao`, antes de `NovaCompraCartao`, por volta da linha 299)
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: `db.cartoes` / `db.categoriasCartao` (Dexie tables já existentes), `novoId`, `agoraISO`, `marcarMudanca` (privado do módulo).
- Produces: `export async function categoriaAssinaturasDe(cartaoId: ID): Promise<ID>` em `src/db/repo.ts`.

- [ ] **Step 1: Escrever o teste (vai falhar)**

Adicionar ao fim de `src/db/repo.test.ts`:

```ts
describe('categoriaAssinaturasDe', () => {
  it('cria a categoria "Assinaturas" do cartão na primeira chamada', async () => {
    const { box } = await boxECategoria();
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    const categoriaId = await repo.categoriaAssinaturasDe(cartao.id);

    const categoria = await db.categoriasCartao.get(categoriaId);
    expect(categoria).toMatchObject({ cartaoId: cartao.id, nome: 'Assinaturas', arquivada: false });
    const cartaoAtualizado = await db.cartoes.get(cartao.id);
    expect(cartaoAtualizado?.categoriaAssinaturasId).toBe(categoriaId);
  });

  it('reaproveita a categoria já criada nas chamadas seguintes', async () => {
    const { box } = await boxECategoria();
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    const primeira = await repo.categoriaAssinaturasDe(cartao.id);
    const segunda = await repo.categoriaAssinaturasDe(cartao.id);

    expect(segunda).toBe(primeira);
    expect(await db.categoriasCartao.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/db/repo.test.ts -t "categoriaAssinaturasDe"`
Expected: FAIL — `repo.categoriaAssinaturasDe is not a function`

- [ ] **Step 3: Implementar `categoriaAssinaturasDe`**

Em `src/db/repo.ts`, inserir depois de `atualizarCategoriaCartao` (antes da interface
`NovaCompraCartao`, linha ~299 atual):

```ts
export async function categoriaAssinaturasDe(cartaoId: ID): Promise<ID> {
  const cartao = (await db.cartoes.get(cartaoId))!;
  if (cartao.categoriaAssinaturasId) return cartao.categoriaAssinaturasId;
  const agora = agoraISO();
  const categoriaId = novoId();
  await db.transaction('rw', db.cartoes, db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.add({
      id: categoriaId, cartaoId, nome: 'Assinaturas', ordem: 0,
      arquivada: false, criadoEm: agora, alteradoEm: agora,
    });
    await db.cartoes.update(cartaoId, { categoriaAssinaturasId: categoriaId, alteradoEm: agora });
    await marcarMudanca();
  });
  return categoriaId;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/db/repo.test.ts -t "categoriaAssinaturasDe"`
Expected: PASS (2 testes)

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(repo): categoriaAssinaturasDe cria/reaproveita categoria oculta por cartao"
```

---

### Task 3: `resumoAssinaturasDoMes`

**Files:**
- Modify: `src/domain/fatura.ts` (adicionar ao fim do arquivo)
- Test: `src/domain/fatura.test.ts`

**Interfaces:**
- Consumes: `calcularFaturas`, `datasFaturaDoMes` (já existentes no mesmo arquivo); tipos `Cartao`, `CompraCartao`, `RecorrenciaCartao`, `ID` de `./types`.
- Produces: `export interface ItemResumoAssinaturas { cartaoId: ID; cartaoNome: string; recorrenciaCartaoId: ID; descricao: string; valorCent: number }`; `export interface ResumoAssinaturas { totalCent: number; itens: ItemResumoAssinaturas[] }`; `export function resumoAssinaturasDoMes(mes: string, boxIds: readonly ID[], cartoes: Cartao[], comprasCartao: CompraCartao[], recorrenciasCartao: RecorrenciaCartao[]): ResumoAssinaturas`.

- [ ] **Step 1: Escrever o teste (vai falhar)**

No topo de `src/domain/fatura.test.ts`, trocar a linha de import de tipos:

```ts
import type { Cartao, CompraCartao, ConferenciaFatura, Lancamento, RecorrenciaCartao } from './types';
```

E a linha de import de `./fatura`:

```ts
import { calcularFaturas, categoriasFaturaIds, datasFaturaDoMes, diffSincronizacao, mesFaturaDaCompra, mesFechamentoDaCompra, resumoAssinaturasDoMes, resumoPorCategoria, valorParcela } from './fatura';
```

Adicionar ao fim do arquivo (depois do `describe('resumoPorCategoria', ...)`):

```ts
describe('resumoAssinaturasDoMes', () => {
  const cartaoNubank: Cartao = {
    id: 'k1', boxId: 'b1', nome: 'Nubank', diaFechamento: 10, diaVencimento: 20,
    categoriaFaturaId: 'catfat1', ativo: true, criadoEm: '', alteradoEm: '',
  };
  const assNetflix: RecorrenciaCartao = {
    id: 'ass1', cartaoId: 'k1', categoriaCartaoId: 'catass1', valor: 3990,
    dataInicio: '2026-01-05', diaDoMes: 5, parcelas: null, descricao: 'Netflix',
    ativa: true, criadoEm: '', alteradoEm: '',
  };

  it('soma só compras marcadas com recorrenciaCartaoId, na fatura do mês certo', () => {
    const compraAssinatura = { ...compra('2026-07-05', 3990), recorrenciaCartaoId: 'ass1' };
    const compraAvulsa = compra('2026-07-06', 5000); // sem recorrenciaCartaoId — não entra
    const resumo = resumoAssinaturasDoMes(
      '2026-07', ['b1'], [cartaoNubank], [compraAssinatura, compraAvulsa], [assNetflix],
    );
    expect(resumo.totalCent).toBe(3990);
    expect(resumo.itens).toEqual([
      { cartaoId: 'k1', cartaoNome: 'Nubank', recorrenciaCartaoId: 'ass1', descricao: 'Netflix', valorCent: 3990 },
    ]);
  });

  it('ignora cartões fora das boxes selecionadas', () => {
    const compraAssinatura = { ...compra('2026-07-05', 3990), recorrenciaCartaoId: 'ass1' };
    const resumo = resumoAssinaturasDoMes(
      '2026-07', ['outra-box'], [cartaoNubank], [compraAssinatura], [assNetflix],
    );
    expect(resumo).toEqual({ totalCent: 0, itens: [] });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/fatura.test.ts -t "resumoAssinaturasDoMes"`
Expected: FAIL — `resumoAssinaturasDoMes` não existe em `./fatura`.

- [ ] **Step 3: Implementar `resumoAssinaturasDoMes`**

Em `src/domain/fatura.ts`, trocar o import de tipos do topo (linha 2):

```ts
import type { Cartao, CompraCartao, ConferenciaFatura, ID, ISODate, Lancamento, RecorrenciaCartao } from './types';
```

E adicionar ao fim do arquivo:

```ts
export interface ItemResumoAssinaturas {
  cartaoId: ID;
  cartaoNome: string;
  recorrenciaCartaoId: ID;
  descricao: string;
  valorCent: number;
}

export interface ResumoAssinaturas {
  totalCent: number;
  itens: ItemResumoAssinaturas[];
}

/** Total e detalhamento (por cartão > assinatura) das compras geradas por assinatura que
 *  caem na fatura do mês dado, entre os cartões das boxes selecionadas. */
export function resumoAssinaturasDoMes(
  mes: string,
  boxIds: readonly ID[],
  cartoes: Cartao[],
  comprasCartao: CompraCartao[],
  recorrenciasCartao: RecorrenciaCartao[],
): ResumoAssinaturas {
  const itens: ItemResumoAssinaturas[] = [];
  for (const cartao of cartoes) {
    if (!boxIds.includes(cartao.boxId)) continue;
    const comprasDoCartao = comprasCartao.filter(
      (c) => c.cartaoId === cartao.id && c.recorrenciaCartaoId != null,
    );
    if (comprasDoCartao.length === 0) continue;
    const ate = datasFaturaDoMes(cartao, mes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDoCartao, ate).find((f) => f.mes === mes);
    if (!fatura) continue;
    const porAssinatura = new Map<ID, number>();
    for (const item of fatura.itens) {
      const compra = comprasDoCartao.find((c) => c.id === item.compraId)!;
      const chave = compra.recorrenciaCartaoId!;
      porAssinatura.set(chave, (porAssinatura.get(chave) ?? 0) + item.valorCent);
    }
    for (const [recorrenciaCartaoId, valorCent] of porAssinatura) {
      const ass = recorrenciasCartao.find((a) => a.id === recorrenciaCartaoId);
      itens.push({
        cartaoId: cartao.id, cartaoNome: cartao.nome, recorrenciaCartaoId,
        descricao: ass?.descricao ?? 'Assinatura', valorCent,
      });
    }
  }
  return { totalCent: itens.reduce((s, i) => s + i.valorCent, 0), itens };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os 2 novos)

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(fatura): resumoAssinaturasDoMes agrega compras de assinatura por cartao"
```

---

### Task 4: Componente `SeletorCategoria`

**Files:**
- Create: `src/ui/SeletorCategoria.tsx`
- Test: `src/ui/SeletorCategoria.test.tsx`
- Modify: `docs/estilo/catalogo.md`

**Interfaces:**
- Produces: `export default function SeletorCategoria({ categorias, selecionadaId, onSelecionar }: { categorias: { id: string; nome: string }[]; selecionadaId: string | null; onSelecionar: (id: string) => void })`.

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `src/ui/SeletorCategoria.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorCategoria from './SeletorCategoria';

it('marca a categoria selecionada e chama onSelecionar ao clicar em outra', async () => {
  const onSelecionar = vi.fn();
  render(
    <SeletorCategoria
      categorias={[{ id: 'a', nome: 'Mercado' }, { id: 'b', nome: 'Uber' }]}
      selecionadaId="a"
      onSelecionar={onSelecionar}
    />,
  );
  expect(screen.getByRole('button', { name: 'Mercado' })).toHaveClass('selecionada');
  expect(screen.getByRole('button', { name: 'Uber' })).not.toHaveClass('selecionada');

  await userEvent.click(screen.getByRole('button', { name: 'Uber' }));
  expect(onSelecionar).toHaveBeenCalledWith('b');
});

it('mostra aviso quando não há categorias', () => {
  render(<SeletorCategoria categorias={[]} selecionadaId={null} onSelecionar={() => {}} />);
  expect(screen.getByText('Nenhuma categoria — crie em Ajustes.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/SeletorCategoria.test.tsx`
Expected: FAIL — não consegue resolver `./SeletorCategoria`

- [ ] **Step 3: Implementar `SeletorCategoria.tsx`**

```tsx
interface Props {
  categorias: { id: string; nome: string }[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

export default function SeletorCategoria({ categorias, selecionadaId, onSelecionar }: Props) {
  return (
    <div className="grade-categorias">
      {categorias.map((c) => (
        <button
          key={c.id}
          className={`botao ${selecionadaId === c.id ? 'selecionada' : ''}`}
          onClick={() => onSelecionar(c.id)}
        >{c.nome}</button>
      ))}
      {categorias.length === 0 && <p className="sub">Nenhuma categoria — crie em Ajustes.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/SeletorCategoria.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Catalogar o componente**

Em `docs/estilo/catalogo.md`, na seção "Componentes compartilhados (em `src/ui/`)", adicionar
(ordem alfabética não é exigida — seguir a ordem de inserção do arquivo, ao fim da lista):

```markdown
- **`SeletorCategoria.tsx`** — grid de 3 colunas (`.grade-categorias`) pra escolher uma
  categoria por toque, sem abrir o picker nativo do `<select>`. Usado em `TelaLancar.tsx`,
  `Recorrencias.tsx`, `FormCompra.tsx`, `LancEditor.tsx`, `TelaSimulador.tsx`.
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/SeletorCategoria.tsx src/ui/SeletorCategoria.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): componente SeletorCategoria substitui select nativo de categoria"
```

---

### Task 5: `TelaLancar.tsx` usa `SeletorCategoria`

**Files:**
- Modify: `src/ui/TelaLancar.tsx:67-76`

**Interfaces:**
- Consumes: `SeletorCategoria` (Task 4).

- [ ] **Step 1: Confirmar que os testes atuais passam antes da mudança**

Run: `npx vitest run src/ui/TelaLancar.test.tsx`
Expected: PASS (baseline antes do refactor)

- [ ] **Step 2: Trocar o grid inline pelo componente**

Em `src/ui/TelaLancar.tsx`, adicionar o import (junto dos outros, no topo):

```tsx
import SeletorCategoria from './SeletorCategoria';
```

E substituir o bloco (linhas 67-76):

```tsx
      <div className="grade-categorias">
        {categorias.map((c) => (
          <button
            key={c.id}
            className={`botao ${categoriaId === c.id ? 'selecionada' : ''}`}
            onClick={() => setCategoriaId(c.id)}
          >{c.nome}</button>
        ))}
        {categorias.length === 0 && <p className="sub">Nenhuma categoria — crie em Ajustes.</p>}
      </div>
```

por:

```tsx
      <SeletorCategoria categorias={categorias} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
```

- [ ] **Step 3: Rodar os testes e confirmar que ainda passam (sem mudança de comportamento)**

Run: `npx vitest run src/ui/TelaLancar.test.tsx`
Expected: PASS (mesmos 5 testes de antes, sem alteração)

- [ ] **Step 4: Commit**

```bash
git add src/ui/TelaLancar.tsx
git commit -m "refactor(lancar): usa SeletorCategoria compartilhado"
```

---

### Task 6: Componente `SeletorPills` + classe `.pills`

**Files:**
- Create: `src/ui/SeletorPills.tsx`
- Test: `src/ui/SeletorPills.test.tsx`
- Modify: `src/styles.css`
- Modify: `docs/estilo/catalogo.md`

**Interfaces:**
- Produces: `export default function SeletorPills({ opcoes, selecionadaId, onSelecionar }: { opcoes: { id: string; nome: string }[]; selecionadaId: string; onSelecionar: (id: string) => void })`; classe CSS `.pills` (+ `.pills button.ativo`).

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `src/ui/SeletorPills.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorPills from './SeletorPills';

it('marca a opção selecionada e chama onSelecionar ao clicar em outra', async () => {
  const onSelecionar = vi.fn();
  render(
    <SeletorPills
      opcoes={[{ id: 'a', nome: 'Eitor' }, { id: 'b', nome: 'Conjunta' }]}
      selecionadaId="a"
      onSelecionar={onSelecionar}
    />,
  );
  expect(screen.getByRole('button', { name: 'Eitor' })).toHaveClass('ativo');
  expect(screen.getByRole('button', { name: 'Conjunta' })).not.toHaveClass('ativo');

  await userEvent.click(screen.getByRole('button', { name: 'Conjunta' }));
  expect(onSelecionar).toHaveBeenCalledWith('b');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/SeletorPills.test.tsx`
Expected: FAIL — não consegue resolver `./SeletorPills`

- [ ] **Step 3: Implementar `SeletorPills.tsx`**

```tsx
interface Props {
  opcoes: { id: string; nome: string }[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
}

export default function SeletorPills({ opcoes, selecionadaId, onSelecionar }: Props) {
  return (
    <div className="pills" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.id}
          className={selecionadaId === o.id ? 'ativo' : ''}
          onClick={() => onSelecionar(o.id)}
        >{o.nome}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Adicionar a classe `.pills` em `src/styles.css`**

Inserir logo depois do bloco `.grade-categorias` (linhas 109-113 atuais):

```css
.pills { display: flex; gap: 8px; background: var(--surface); padding: 4px; border-radius: 14px; flex-wrap: wrap; }
.pills button { flex: 1; background: none; padding: 9px 4px; border-radius: 10px; color: var(--muted); font-weight: 600; font-size: 13.5px; min-height: 0; white-space: nowrap; border: none; }
.pills button.ativo { background: var(--ac); color: #fff; }
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/SeletorPills.test.tsx`
Expected: PASS (1 teste)

- [ ] **Step 6: Catalogar classe e componente**

Em `docs/estilo/catalogo.md`, tabela de classes, adicionar uma linha depois de
`.grade-categorias`:

```markdown
| `.pills` | pílulas em linha pra escolher entre poucas opções (Box, Cartão); `button.ativo` marca a opção atual |
```

Na seção "Componentes compartilhados", adicionar:

```markdown
- **`SeletorPills.tsx`** — pílulas em linha (`.pills`) pra escolher entre poucas opções sem
  abrir o picker nativo do `<select>`. Usado em `Recorrencias.tsx` (Box),
  `CategoriasCartao.tsx` e `Assinaturas.tsx` (Cartão).
```

- [ ] **Step 7: Commit**

```bash
git add src/ui/SeletorPills.tsx src/ui/SeletorPills.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(ui): componente SeletorPills + classe .pills"
```

---

### Task 7: `Cartoes.tsx` — permite múltiplos ativos, formulário no topo

**Files:**
- Modify: `src/ui/ajustes/Cartoes.tsx`
- Test: `src/ui/ajustes/Cartoes.test.tsx`

**Interfaces:**
- Nenhuma nova — só remove um bloqueio e reordena JSX existente.

- [ ] **Step 1: Atualizar o teste que hoje espera o bloqueio (vai falhar até o Step 3)**

Em `src/ui/ajustes/Cartoes.test.tsx`, substituir o teste `'impede segundo cartão ativo na mesma box'` (linhas 43-57) por:

```ts
it('permite dois cartões ativos na mesma box', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText(/Inter/)).toBeInTheDocument());
  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(2);
  expect(cartoes.every((c) => c.ativo)).toBe(true);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que o novo falha**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: FAIL no teste novo — a UI ainda mostra "já tem um cartão ativo" e bloqueia.

- [ ] **Step 3: Reescrever `Cartoes.tsx` sem o bloqueio, com o form antes da lista**

Substituir o conteúdo inteiro de `src/ui/ajustes/Cartoes.tsx` por:

```tsx
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function Cartoes() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState(dados?.boxes.find((b) => b.saldoInicial != null)?.id ?? '');
  const [nome, setNome] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('28');
  const [diaVencimento, setDiaVencimento] = useState('5');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const nomeBox = (id: string) => dados.boxes.find((b) => b.id === id)?.nome ?? '?';

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  function editar(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    setEditandoId(id); setBoxId(c.boxId); setNome(c.nome);
    setDiaFechamento(String(c.diaFechamento)); setDiaVencimento(String(c.diaVencimento));
  }

  async function salvar() {
    if (!nome.trim() || !boxId) return;
    const campos = {
      boxId, nome: nome.trim(), diaFechamento: clampDia(diaFechamento),
      diaVencimento: clampDia(diaVencimento),
    };
    if (editandoId) {
      const original = dados!.cartoes.find((c) => c.id === editandoId)!;
      await repo.salvarCartao({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarCartao(campos, horizonte);
    }
    setEditandoId(null); setNome('');
    await recarregar();
  }

  async function alternarAtivo(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    await repo.salvarCartao({ ...c, ativo: !c.ativo }, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>{editandoId ? 'Editar cartão' : 'Novo cartão'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-box`}>Box do cartão</label>
          <select id={`${uid}-box`} value={boxId}
            onChange={(e) => setBoxId(e.target.value)}>
            {dados.boxes.filter((b) => b.saldoInicial != null).map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo cresce">
          <label htmlFor={`${uid}-nome`}>Nome do cartão</label>
          <input id={`${uid}-nome`} placeholder="ex.: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Dia de fechamento</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-vence`}>Dia de vencimento</label>
          <input id={`${uid}-vence`} type="number" min={1} max={31} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>
          {editandoId ? 'Salvar' : 'Criar'}
        </button>
      </div>

      <p className="rotulo-grupo">Cadastrados</p>
      <div className="lista">
        {dados.cartoes.map((c) => (
          <div className="item" key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
            <div className="cresce">
              {c.nome} <span className="badge">{nomeBox(c.boxId)}</span>
              <div className="sub">fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}</div>
            </div>
            <button className="botao" onClick={() => editar(c.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtivo(c.id)}>
              {c.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ))}
        {dados.cartoes.length === 0 && <p className="sub">Nenhum cartão cadastrado.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: PASS (2 testes: o de criação sem categoria + o novo de dois ativos)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/Cartoes.tsx src/ui/ajustes/Cartoes.test.tsx
git commit -m "feat(cartoes): permite mais de um cartao ativo por box, form no topo"
```

---

### Task 8: `TelaAjustes.tsx` — reordena o menu

**Files:**
- Modify: `src/ui/TelaAjustes.tsx:16-26`

- [ ] **Step 1: Reordenar o array `ITENS`**

Em `src/ui/TelaAjustes.tsx`, substituir o array (linhas 16-26):

```ts
const ITENS: { id: Secao; rotulo: string }[] = [
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'recorrencias', rotulo: 'Recorrências' },
  { id: 'boxes', rotulo: 'Boxes' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'categoriasCartao', rotulo: 'Categorias do cartão' },
  { id: 'assinaturas', rotulo: 'Assinaturas do cartão' },
  { id: 'backup', rotulo: 'Backup e restauração' },
  { id: 'wiki', rotulo: 'Wiki' },
  { id: 'versao', rotulo: 'Versão' },
];
```

por:

```ts
const ITENS: { id: Secao; rotulo: string }[] = [
  { id: 'boxes', rotulo: 'Boxes' },
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'recorrencias', rotulo: 'Recorrências' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'categoriasCartao', rotulo: 'Categorias do cartão' },
  { id: 'assinaturas', rotulo: 'Assinaturas do cartão' },
  { id: 'backup', rotulo: 'Backup e restauração' },
  { id: 'wiki', rotulo: 'Wiki' },
  { id: 'versao', rotulo: 'Versão' },
];
```

- [ ] **Step 2: Rodar a suíte completa**

Run: `npm test`
Expected: PASS (não existe `TelaAjustes.test.tsx`; nenhum outro teste depende da ordem do menu)

- [ ] **Step 3: Commit**

```bash
git add src/ui/TelaAjustes.tsx
git commit -m "refactor(ajustes): reordena menu por hierarquia (Boxes primeiro)"
```

---

### Task 9: `Recorrencias.tsx` — box + tipo + `SeletorCategoria`, form no topo

**Files:**
- Modify: `src/ui/ajustes/Recorrencias.tsx`
- Test: `src/ui/ajustes/Recorrencias.test.tsx`

**Interfaces:**
- Consumes: `SeletorCategoria` (Task 4), `SeletorPills` (Task 6).

- [ ] **Step 1: Atualizar o teste que usa `getByRole('option', ...)` (vai falhar até o Step 3)**

Em `src/ui/ajustes/Recorrencias.test.tsx`, substituir o segundo teste (linhas 45-58):

```ts
it('categoria da fatura de um cartão não aparece no select de categoria da recorrência', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);

  expect(screen.getByRole('option', { name: /assinatura/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
});
```

por:

```ts
it('categoria da fatura de um cartão não aparece no grid de categoria da recorrência', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);

  expect(screen.getByRole('button', { name: 'assinatura' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument();
});

it('trocar de box na tela de Recorrências mostra só as recorrências e categorias daquela box', async () => {
  const agora = agoraISO();
  const eitor = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  const conjunta = { id: novoId(), nome: 'conjunta', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(eitor);
  await repo.salvarBox(conjunta);
  const catEitor = await repo.salvarCategoria({ boxId: eitor.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  const catConjunta = await repo.salvarCategoria({ boxId: conjunta.id, nome: 'contas da casa', tipo: 'gasto', ordem: 0 });
  await repo.salvarRecorrencia(
    { boxId: eitor.id, categoriaId: catEitor.id, valor: 180000, dataInicio: '2026-07-01', diaDoMes: 5, parcelas: null },
    '2027-12-31',
  );
  await repo.salvarRecorrencia(
    { boxId: conjunta.id, categoriaId: catConjunta.id, valor: 45000, dataInicio: '2026-07-01', diaDoMes: 10, parcelas: null },
    '2027-12-31',
  );
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-02' });

  render(<Recorrencias />);
  expect(screen.getByText('aluguel')).toBeInTheDocument();
  expect(screen.queryByText('contas da casa')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'aluguel' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'contas da casa' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'conjunta' }));

  expect(screen.getByText('contas da casa')).toBeInTheDocument();
  expect(screen.queryByText('aluguel')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'contas da casa' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'aluguel' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/ajustes/Recorrencias.test.tsx`
Expected: FAIL — ainda é um `<select>`, não há seletor de box.

- [ ] **Step 3: Reescrever `Recorrencias.tsx`**

Substituir o conteúdo inteiro de `src/ui/ajustes/Recorrencias.tsx` por:

```tsx
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { categoriasFaturaIds } from '../../domain/fatura';
import { formatarBRL } from '../../domain/money';
import type { TipoCategoria } from '../../domain/types';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorCategoria from '../SeletorCategoria';
import SeletorPills from '../SeletorPills';

export default function Recorrencias() {
  const { dados, hoje, recarregar } = useApp();
  const [boxId, setBoxId] = useState(dados?.boxes.find((b) => b.saldoInicial != null)?.id ?? '');
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [valor, setValor] = useState(0);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const recs = dados.recorrencias.filter((r) => !r.cenarioId && r.boxId === boxId);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo;
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const categoriasDaBox = dados.categorias
    .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id));

  function limparForm() {
    setValor(0); setCategoriaId(null); setDataInicio(hoje); setDiaDoMes('1'); setParcelas('');
  }

  function trocarBox(novoBoxId: string) {
    setBoxId(novoBoxId);
    setEditandoId(null);
    limparForm();
  }

  function trocarTipo(novoTipo: TipoCategoria) {
    setTipo(novoTipo);
    setCategoriaId(null);
  }

  function editar(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    setEditandoId(id);
    setTipo(tipoCat(rec.categoriaId) ?? 'gasto');
    setValor(rec.valor);
    setCategoriaId(rec.categoriaId);
    setDataInicio(rec.dataInicio);
    setDiaDoMes(String(rec.diaDoMes));
    setParcelas(rec.parcelas != null ? String(rec.parcelas) : '');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    limparForm();
  }

  async function salvar() {
    if (valor <= 0 || categoriaId == null) return;
    const diaDoMesNum = Math.min(31, Math.max(1, Number(diaDoMes) || 1));
    const parcelasNum = parcelas ? Number(parcelas) : null;
    if (editandoId) {
      const original = recs.find((r) => r.id === editandoId)!;
      await repo.salvarRecorrencia({
        ...original, boxId, categoriaId, valor, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setEditandoId(null);
      limparForm();
    } else {
      await repo.salvarRecorrencia({
        boxId, categoriaId, valor, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setValor(0); setParcelas('');
    }
    await recarregar();
  }

  async function alternarAtiva(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    await repo.salvarRecorrencia({ ...rec, ativa: !rec.ativa }, dados!.config.horizonteProjecao);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir a recorrência e seus previstos? (confirmados são mantidos)')) return;
    await repo.excluirRecorrencia(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Recorrências</h2>

      <div className="campo">
        <label>Box</label>
        <SeletorPills
          opcoes={dados.boxes.filter((b) => b.saldoInicial != null).map((b) => ({ id: b.id, nome: b.nome }))}
          selecionadaId={boxId}
          onSelecionar={trocarBox}
        />
      </div>

      <h2>{editandoId ? 'Editar recorrência' : 'Nova recorrência'}</h2>
      <div className="campo">
        <label htmlFor={`${uid}-valor`}>Valor</label>
        <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 100 }} />
      </div>
      <div className="linha" role="radiogroup" aria-label="Tipo">
        <button
          className={`botao ${tipo === 'gasto' ? 'botao-primario' : ''}`}
          onClick={() => trocarTipo('gasto')}
        >Gasto</button>
        <button
          className={`botao ${tipo === 'ganho' ? 'botao-primario' : ''}`}
          onClick={() => trocarTipo('ganho')}
        >Ganho</button>
      </div>
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={categoriasDaBox} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-dia`}>Dia do mês</label>
          <input id={`${uid}-dia`} type="number" min={1} max={31} value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} placeholder="∞" value={parcelas}
            onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
        {editandoId && <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={cancelarEdicao}>Cancelar</button>}
      </div>

      <p className="rotulo-grupo">Nesta box</p>
      <div className="lista">
        {recs.map((r) => (
          <div className="item item-coluna" key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
            <div className="linha-topo linha-topo-2-1">
              <div className="cresce">
                <div>{nomeCat(r.categoriaId)}{r.nota ? ` · ${r.nota}` : ''}</div>
                <div className="sub">desde {r.dataInicio}</div>
                <div className="sub">todo dia {r.diaDoMes}, {r.parcelas == null ? 'sem fim' : `${r.parcelas}x`}</div>
              </div>
              <span className={tipoCat(r.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                {formatarBRL(r.valor)}
              </span>
            </div>
            <div className="acoes">
              <button className="botao" onClick={() => editar(r.id)}>Editar</button>
              <button className="botao" onClick={() => alternarAtiva(r.id)}>{r.ativa ? 'Pausar' : 'Ativar'}</button>
              <button className="botao botao-perigo" onClick={() => excluir(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
        {recs.length === 0 && <p className="sub">Nenhuma recorrência nesta box.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/Recorrencias.test.tsx`
Expected: PASS (3 testes: edição de valor, grid sem categoria de fatura, troca de box)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/Recorrencias.tsx src/ui/ajustes/Recorrencias.test.tsx
git commit -m "feat(recorrencias): escopo por box, grid de categoria, form no topo"
```

---

### Task 10: `CategoriasCartao.tsx` — `SeletorPills` no lugar do `<select>`

**Files:**
- Modify: `src/ui/ajustes/CategoriasCartao.tsx:56-62,121-129`

**Interfaces:**
- Consumes: `SeletorPills` (Task 6).

- [ ] **Step 1: Confirmar que os testes atuais passam antes da mudança**

Run: `npx vitest run src/ui/ajustes/CategoriasCartao.test.tsx`
Expected: PASS (baseline — nenhum teste existente interage com o `<select>` de cartão)

- [ ] **Step 2: Trocar o `<select>` por `SeletorPills`**

Em `src/ui/ajustes/CategoriasCartao.tsx`, adicionar o import:

```tsx
import SeletorPills from '../SeletorPills';
```

Substituir o bloco (linhas 124-129):

```tsx
      <div className="campo">
        <label htmlFor={`${uid}-cartao`}>Cartão</label>
        <select id={`${uid}-cartao`} value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
          {dados.cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
```

por:

```tsx
      <div className="campo">
        <label>Cartão</label>
        <SeletorPills
          opcoes={dados.cartoes.map((c) => ({ id: c.id, nome: c.nome }))}
          selecionadaId={cartaoId}
          onSelecionar={setCartaoId}
        />
      </div>
```

- [ ] **Step 3: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/CategoriasCartao.test.tsx`
Expected: PASS (3 testes, sem mudança — nenhum dependia do `<select>`)

- [ ] **Step 4: Commit**

```bash
git add src/ui/ajustes/CategoriasCartao.tsx
git commit -m "refactor(categorias-cartao): SeletorPills no lugar do select de cartao"
```

---

### Task 11: `Assinaturas.tsx` — escolhe Cartão, categoria automática, form no topo

**Files:**
- Modify: `src/ui/ajustes/Assinaturas.tsx`
- Create: `src/ui/ajustes/Assinaturas.test.tsx`

**Interfaces:**
- Consumes: `SeletorPills` (Task 6); `repo.categoriaAssinaturasDe` (Task 2).

- [ ] **Step 1: Escrever os testes (vão falhar)**

Criar `src/ui/ajustes/Assinaturas.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Assinaturas from './Assinaturas';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function prepararCartao(nome = 'Nubank') {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return repo.salvarCartao({ boxId: box.id, nome, diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
}

it('cria uma assinatura sem pedir categoria, usando a categoria Assinaturas automática', async () => {
  const cartao = await prepararCartao();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Assinaturas />);

  expect(screen.queryByLabelText('Categoria')).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Valor'), '39,90');
  await userEvent.type(screen.getByLabelText('Descrição (opcional)'), 'Netflix');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument());
  const assinaturas = await db.recorrenciasCartao.toArray();
  expect(assinaturas).toHaveLength(1);
  expect(assinaturas[0]).toMatchObject({ cartaoId: cartao.id, valor: 3990, descricao: 'Netflix' });
  const categoria = await db.categoriasCartao.get(assinaturas[0].categoriaCartaoId);
  expect(categoria).toMatchObject({ cartaoId: cartao.id, nome: 'Assinaturas' });
});

it('trocar de cartão mostra só as assinaturas daquele cartão', async () => {
  const nubank = await prepararCartao('Nubank');
  const inter = await prepararCartao('Inter');
  await repo.salvarAssinatura({
    cartaoId: nubank.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(nubank.id),
    valor: 3990, dataInicio: '2026-07-01', diaDoMes: 8, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await repo.salvarAssinatura({
    cartaoId: inter.id, categoriaCartaoId: await repo.categoriaAssinaturasDe(inter.id),
    valor: 1200, dataInicio: '2026-07-01', diaDoMes: 3, parcelas: null, descricao: 'iCloud',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });

  render(<Assinaturas />);
  expect(await screen.findByText('Netflix')).toBeInTheDocument();
  expect(screen.queryByText('iCloud')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Inter' }));

  expect(await screen.findByText('iCloud')).toBeInTheDocument();
  expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/ajustes/Assinaturas.test.tsx`
Expected: FAIL — a tela atual ainda pede categoria e não filtra por cartão.

- [ ] **Step 3: Reescrever `Assinaturas.tsx`**

Substituir o conteúdo inteiro de `src/ui/ajustes/Assinaturas.tsx` por:

```tsx
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL } from '../../domain/money';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorPills from '../SeletorPills';

export default function Assinaturas() {
  const { dados, hoje, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes.find((c) => c.ativo)?.id ?? '');
  const [valor, setValor] = useState<number>(0);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Assinaturas</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const horizonte = dados.config.horizonteProjecao;
  const assinsDoCartao = dados.recorrenciasCartao.filter((a) => a.cartaoId === cartaoId);

  function limparForm() {
    setValor(0); setDataInicio(hoje); setDiaDoMes('1');
    setParcelas(''); setDescricao(''); setEditandoId(null);
  }

  function trocarCartao(novoCartaoId: string) {
    setCartaoId(novoCartaoId);
    limparForm();
  }

  function editar(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    setEditandoId(id);
    setCartaoId(a.cartaoId);
    setValor(a.valor);
    setDataInicio(a.dataInicio);
    setDiaDoMes(String(a.diaDoMes));
    setParcelas(a.parcelas != null ? String(a.parcelas) : '');
    setDescricao(a.descricao ?? '');
  }

  async function salvar() {
    if (valor <= 0 || !cartaoId) return;
    const categoriaCartaoId = await repo.categoriaAssinaturasDe(cartaoId);
    const campos = {
      cartaoId, categoriaCartaoId, valor, dataInicio,
      diaDoMes: Math.min(31, Math.max(1, Number(diaDoMes) || 1)),
      parcelas: parcelas ? Number(parcelas) : null,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
    };
    if (editandoId) {
      const original = dados!.recorrenciasCartao.find((x) => x.id === editandoId)!;
      await repo.salvarAssinatura({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarAssinatura(campos, horizonte);
    }
    limparForm();
    await recarregar();
  }

  async function alternarAtiva(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    await repo.salvarAssinatura({ ...a, ativa: !a.ativa }, horizonte);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir a assinatura e suas compras futuras? (passadas são mantidas)')) return;
    await repo.excluirAssinatura(id, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Assinaturas</h2>

      <h2>{editandoId ? 'Editar assinatura' : 'Nova assinatura'}</h2>
      <div className="campo">
        <label>Cartão</label>
        <SeletorPills
          opcoes={dados.cartoes.map((c) => ({ id: c.id, nome: c.nome }))}
          selecionadaId={cartaoId}
          onSelecionar={trocarCartao}
        />
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor}
            onChange={setValor} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-dia`}>Dia do mês</label>
          <input id={`${uid}-dia`} type="number" min={1} max={31} value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} placeholder="∞" value={parcelas}
            onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
        <input id={`${uid}-desc`} placeholder="ex.: Netflix" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <p className="sub">Categoria Assinaturas — automática, não precisa escolher.</p>
      <button className="botao botao-primario" onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
      {editandoId && <button className="botao" onClick={limparForm}>Cancelar</button>}

      <p className="rotulo-grupo">Assinaturas deste cartão</p>
      <div className="lista">
        {assinsDoCartao.map((a) => (
          <div className="item item-coluna" key={a.id} style={{ opacity: a.ativa ? 1 : 0.5 }}>
            <div className="linha-topo linha-topo-2-1">
              <div className="cresce">
                <div>{a.descricao ?? 'Assinatura'}</div>
                <div className="sub">desde {a.dataInicio}</div>
                <div className="sub">todo dia {a.diaDoMes}, {a.parcelas == null ? 'sem fim' : `${a.parcelas}x`}</div>
              </div>
              <span className="valor-gasto">{formatarBRL(a.valor)}</span>
            </div>
            <div className="acoes">
              <button className="botao" onClick={() => editar(a.id)}>Editar</button>
              <button className="botao" onClick={() => alternarAtiva(a.id)}>{a.ativa ? 'Pausar' : 'Ativar'}</button>
              <button className="botao botao-perigo" onClick={() => excluir(a.id)}>Excluir</button>
            </div>
          </div>
        ))}
        {assinsDoCartao.length === 0 && <p className="sub">Nenhuma assinatura neste cartão.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/Assinaturas.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/Assinaturas.tsx src/ui/ajustes/Assinaturas.test.tsx
git commit -m "feat(assinaturas): escolhe cartao em vez de categoria, categoria automatica, form no topo"
```

---

### Task 12: `FormCompra.tsx` — `SeletorCategoria` + exclui categoria de assinaturas

**Files:**
- Modify: `src/ui/FormCompra.tsx`
- Test: `src/ui/FormCompra.test.tsx:39`

**Interfaces:**
- Consumes: `SeletorCategoria` (Task 4), `categoriasAssinaturasIds` (Task 1).

- [ ] **Step 1: Atualizar o teste que usa `selectOptions` (vai falhar até o Step 3)**

Em `src/ui/FormCompra.test.tsx`, dentro do teste `'cria uma compra parcelada'`, trocar a linha
39:

```ts
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), screen.getByRole('option', { name: 'mercado' }));
```

por:

```ts
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/FormCompra.test.tsx`
Expected: FAIL — `mercado` ainda é uma `<option>`, não um botão.

- [ ] **Step 3: Trocar o `<select>` por `SeletorCategoria` e ocultar a categoria de assinaturas**

Em `src/ui/FormCompra.tsx`, atualizar os imports do topo:

```tsx
import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { addMesesData } from '../domain/dates';
import { categoriasAssinaturasIds } from '../domain/categorias';
import type { Cartao, CompraCartao } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';
```

Trocar a declaração de `categoriaId` (linha 15) por:

```tsx
  const [categoriaId, setCategoriaId] = useState<string | null>(compra?.categoriaCartaoId ?? null);
```

Trocar a linha de `cats` (linha 21) por:

```tsx
  const ocultas = categoriasAssinaturasIds(dados.cartoes);
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartao.id && !c.arquivada && !ocultas.has(c.id));
```

No JSX, tirar o campo Categoria de dentro do primeiro `<div className="linha">` (era o terceiro
campo, entre Data e Parcelas) e colocar como bloco próprio logo depois dessa linha. O bloco
inteiro do formulário (a partir do `return`) fica:

```tsx
  return (
    <>
      <h2 style={{ marginTop: 0 }}>{compra ? 'Editar compra' : 'Nova compra'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} max={48} value={parcelas}
            onChange={(e) => onParcelasChange(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelaspagas`}>Parcelas já pagas</label>
          <input id={`${uid}-parcelaspagas`} type="number" min={0} max={Math.max(0, parcelasNum - 1)}
            disabled={parcelasNum <= 1}
            value={parcelasNum <= 1 ? '' : parcelasPagas}
            onChange={(e) => onParcelasPagasChange(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={cats} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
          <input id={`${uid}-desc`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={onFechar}>Cancelar</button>
        {compra && <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} onClick={excluir}>Excluir</button>}
      </div>
    </>
  );
```

A função `salvar` continua igual (`if (valor <= 0 || !categoriaId) return;` já funciona com
`categoriaId: string | null`).

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/FormCompra.test.tsx`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/ui/FormCompra.tsx src/ui/FormCompra.test.tsx
git commit -m "refactor(compra): SeletorCategoria, oculta categoria automatica de assinaturas"
```

---

### Task 13: `LancEditor.tsx` — `SeletorCategoria`

**Files:**
- Modify: `src/ui/LancEditor.tsx:61-68`
- Test: `src/ui/LancEditor.test.tsx:88-89`

**Interfaces:**
- Consumes: `SeletorCategoria` (Task 4).

- [ ] **Step 1: Atualizar o teste que usa `getByRole('option', ...)` (vai falhar até o Step 3)**

Em `src/ui/LancEditor.test.tsx`, trocar as linhas 88-89:

```ts
  expect(screen.getByRole('option', { name: /mercado/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
```

por:

```ts
  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: FAIL — ainda é um `<select>`.

- [ ] **Step 3: Trocar o `<select>` por `SeletorCategoria`**

Em `src/ui/LancEditor.tsx`, adicionar o import:

```tsx
import SeletorCategoria from './SeletorCategoria';
```

Substituir o bloco (linhas 61-68):

```tsx
        <div className="campo">
          <label htmlFor="ed-cat">Categoria</label>
          <select id="ed-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
            ))}
          </select>
        </div>
```

por:

```tsx
        <div className="campo">
          <label>Categoria</label>
          <SeletorCategoria categorias={categorias} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
        </div>
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx
git commit -m "refactor(lanc-editor): usa SeletorCategoria compartilhado"
```

---

### Task 14: `TelaSimulador.tsx` — `SeletorCategoria` no formulário hipotético

**Files:**
- Modify: `src/ui/TelaSimulador.tsx:10-67`
- Test: `src/ui/TelaSimulador.test.tsx:29-30`

**Interfaces:**
- Consumes: `SeletorCategoria` (Task 4).

- [ ] **Step 1: Atualizar o teste que usa `getByRole('option', ...)` (vai falhar até o Step 3)**

Em `src/ui/TelaSimulador.test.tsx`, trocar as linhas 29-30:

```ts
  expect(screen.getByRole('option', { name: /mercado/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
```

por:

```ts
  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/TelaSimulador.test.tsx`
Expected: FAIL — ainda é um `<select>`.

- [ ] **Step 3: Trocar o `<select>` por `SeletorCategoria` em `FormHipotetico`**

Em `src/ui/TelaSimulador.tsx`, adicionar o import:

```tsx
import SeletorCategoria from './SeletorCategoria';
```

Na função `FormHipotetico` (linhas 10-67), trocar a declaração de `categoriaId` (linha 13):

```tsx
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
```

Trocar a função `boxDe` (linha 20) para aceitar `null`:

```tsx
  const boxDe = (catId: string | null) => dados.categorias.find((c) => c.id === catId)?.boxId;
```

Trocar o guard em `adicionar` (linha 26):

```tsx
    if (cents <= 0 || !boxId || categoriaId == null) return;
```

Substituir o bloco JSX do campo Categoria (linhas 48-54):

```tsx
      <div className="campo">
        <label htmlFor={`${uid}-cat`}>Categoria</label>
        <select id={`${uid}-cat`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
        </select>
      </div>
```

por:

```tsx
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={categorias} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      </div>
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaSimulador.test.tsx`
Expected: PASS (1 teste)

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaSimulador.tsx src/ui/TelaSimulador.test.tsx
git commit -m "refactor(simulador): usa SeletorCategoria compartilhado"
```

---

### Task 15: Componente `AssinaturasResumoSheet`

**Files:**
- Create: `src/ui/AssinaturasResumoSheet.tsx`
- Test: `src/ui/AssinaturasResumoSheet.test.tsx`
- Modify: `docs/estilo/catalogo.md`

**Interfaces:**
- Consumes: `Sheet` (`src/ui/Sheet.tsx`, já existente), `formatarBRL` (`src/domain/money.ts`), `ItemResumoAssinaturas` (Task 3, `src/domain/fatura.ts`).
- Produces: `export default function AssinaturasResumoSheet({ aberto, itens, totalCent, onFechar }: { aberto: boolean; itens: ItemResumoAssinaturas[]; totalCent: number; onFechar: () => void })`.

- [ ] **Step 1: Escrever o teste (vai falhar)**

Criar `src/ui/AssinaturasResumoSheet.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';

it('agrupa os itens por cartão e mostra o total', () => {
  render(
    <AssinaturasResumoSheet
      aberto
      totalCent={5190}
      itens={[
        { cartaoId: 'k1', cartaoNome: 'Nubank', recorrenciaCartaoId: 'a1', descricao: 'Netflix', valorCent: 3990 },
        { cartaoId: 'k2', cartaoNome: 'Inter', recorrenciaCartaoId: 'a2', descricao: 'iCloud', valorCent: 1200 },
      ]}
      onFechar={() => {}}
    />,
  );
  const dialog = screen.getByRole('dialog', { name: 'Assinaturas' });
  expect(within(dialog).getByText('R$ 51,90')).toBeInTheDocument();
  expect(within(dialog).getByText('Nubank')).toBeInTheDocument();
  expect(within(dialog).getByText('Netflix')).toBeInTheDocument();
  expect(within(dialog).getByText('Inter')).toBeInTheDocument();
  expect(within(dialog).getByText('iCloud')).toBeInTheDocument();
});

it('não renderiza nada quando fechado', () => {
  render(<AssinaturasResumoSheet aberto={false} totalCent={0} itens={[]} onFechar={() => {}} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/AssinaturasResumoSheet.test.tsx`
Expected: FAIL — não consegue resolver `./AssinaturasResumoSheet`

- [ ] **Step 3: Implementar `AssinaturasResumoSheet.tsx`**

```tsx
import { formatarBRL } from '../domain/money';
import type { ItemResumoAssinaturas } from '../domain/fatura';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  itens: ItemResumoAssinaturas[];
  totalCent: number;
  onFechar: () => void;
}

export default function AssinaturasResumoSheet({ aberto, itens, totalCent, onFechar }: Props) {
  const porCartao = new Map<string, { cartaoNome: string; itens: ItemResumoAssinaturas[] }>();
  for (const item of itens) {
    let grupo = porCartao.get(item.cartaoId);
    if (!grupo) {
      grupo = { cartaoNome: item.cartaoNome, itens: [] };
      porCartao.set(item.cartaoId, grupo);
    }
    grupo.itens.push(item);
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo="Assinaturas">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Assinaturas</h2>
        <strong className="valor-gasto">{formatarBRL(totalCent)}</strong>
      </div>
      <div className="lista" style={{ marginTop: 12 }}>
        {[...porCartao.entries()].map(([cartaoId, grupo]) => (
          <div key={cartaoId}>
            <p className="rotulo-grupo">{grupo.cartaoNome}</p>
            <div className="lista recuo-1" style={{ marginTop: 6 }}>
              {grupo.itens.map((it) => (
                <div className="item" key={it.recorrenciaCartaoId}>
                  <span className="cresce">{it.descricao}</span>
                  <span className="valor-gasto">{formatarBRL(it.valorCent)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {itens.length === 0 && <p className="sub">Sem assinaturas no mês.</p>}
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/AssinaturasResumoSheet.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Catalogar o componente**

Em `docs/estilo/catalogo.md`, seção "Componentes compartilhados", adicionar:

```markdown
- **`AssinaturasResumoSheet.tsx`** — sheet de Análises com o total de assinaturas do mês,
  agrupado por cartão (`.rotulo-grupo` + `.recuo-1`, mesmo padrão do `LancamentosSheet`).
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/AssinaturasResumoSheet.tsx src/ui/AssinaturasResumoSheet.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): AssinaturasResumoSheet agrupa assinaturas por cartao"
```

---

### Task 16: `TelaAnalises.tsx` — linha "Assinaturas" + sheet

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`
- Test: `src/ui/TelaAnalises.test.tsx`

**Interfaces:**
- Consumes: `resumoAssinaturasDoMes` (Task 3), `AssinaturasResumoSheet` (Task 15), `repo.categoriaAssinaturasDe` (Task 2, usado só no teste), `repo.salvarAssinatura` (já existente).

- [ ] **Step 1: Escrever o teste (vai falhar)**

Adicionar ao fim de `src/ui/TelaAnalises.test.tsx`:

```tsx
it('linha Assinaturas soma as compras de assinatura de todos os cartões e abre o resumo agrupado', async () => {
  const { box } = await seedBoxComCategoria();
  const nubank = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  const inter = await repo.salvarCartao({ boxId: box.id, nome: 'Inter', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31');
  const catAssNubank = await repo.categoriaAssinaturasDe(nubank.id);
  const catAssInter = await repo.categoriaAssinaturasDe(inter.id);
  await repo.salvarAssinatura({
    cartaoId: nubank.id, categoriaCartaoId: catAssNubank, valor: 3990,
    dataInicio: '2026-07-05', diaDoMes: 5, parcelas: null, descricao: 'Netflix',
  }, '2027-12-31');
  await repo.salvarAssinatura({
    cartaoId: inter.id, categoriaCartaoId: catAssInter, valor: 1200,
    dataInicio: '2026-07-05', diaDoMes: 5, parcelas: null, descricao: 'iCloud',
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('button', { name: /Assinaturas/ }));

  const dialog = await screen.findByRole('dialog', { name: 'Assinaturas' });
  expect(within(dialog).getByText('R$ 51,90')).toBeInTheDocument();
  expect(within(dialog).getByText('Nubank')).toBeInTheDocument();
  expect(within(dialog).getByText('Netflix')).toBeInTheDocument();
  expect(within(dialog).getByText('Inter')).toBeInTheDocument();
  expect(within(dialog).getByText('iCloud')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx -t "linha Assinaturas"`
Expected: FAIL — não existe a linha/botão "Assinaturas".

- [ ] **Step 3: Adicionar a linha e o sheet em `TelaAnalises.tsx`**

Atualizar os imports do topo:

```tsx
import { useState } from 'react';
import { compararMeses, mediaMovel3, resumoMensal, serieMensal } from '../domain/aggregations';
import { addMeses, mesDe } from '../domain/dates';
import { resumoAssinaturasDoMes } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { ID } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';
import LancamentosSheet from './LancamentosSheet';
```

Dentro do componente, depois da linha `const comparativo = compararMeses(...)`, adicionar:

```tsx
  const resumoAssinaturas = resumoAssinaturasDoMes(mes, ids, dados.cartoes, dados.comprasCartao, dados.recorrenciasCartao);
```

E o novo estado, junto dos outros `useState` no topo do componente:

```tsx
  const [assinaturasAberto, setAssinaturasAberto] = useState(false);
```

No `<tbody>` da tabela "Por categoria", depois do `.map((l) => ...)` e antes do fallback de
lista vazia, adicionar a linha:

```tsx
            {resumoAssinaturas.totalCent > 0 && (
              <tr
                onClick={() => setAssinaturasAberto(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAssinaturasAberto(true); }
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <td>Assinaturas <span className="badge">todos os cartões</span></td>
                <td className="valor-gasto">{formatarBRL(resumoAssinaturas.totalCent)}</td>
                <td>—</td>
              </tr>
            )}
```

E trocar a condição do fallback de "sem movimentos" para considerar as duas fontes:

```tsx
            {resumo.linhas.length === 0 && resumoAssinaturas.totalCent === 0 && <tr><td colSpan={3}>Sem movimentos no mês.</td></tr>}
```

Por fim, depois do bloco `{cartaoDaCategoria ? (...) : (...)}` que renderiza
`FaturaCategoriaSheet`/`LancamentosSheet`, adicionar:

```tsx
      <AssinaturasResumoSheet
        aberto={assinaturasAberto}
        itens={resumoAssinaturas.itens}
        totalCent={resumoAssinaturas.totalCent}
        onFechar={() => setAssinaturasAberto(false)}
      />
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS (4 testes: os 3 existentes + o novo)

- [ ] **Step 5: Rodar a suíte inteira do projeto**

Run: `npm test`
Expected: PASS (todos os arquivos de teste do projeto)

- [ ] **Step 6: Rodar o build pra checar erros de tipo**

Run: `npm run build`
Expected: build concluído sem erros de TypeScript

- [ ] **Step 7: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): linha Assinaturas consolidada, agrupada por cartao no sheet"
```

---

## Self-Review

**Cobertura do spec:** os 6 itens originais (box leak, form no topo, multi-cartão, categoria
automática, sem picker nativo, sem "categoria…") estão cobertos pelas Tasks 7, 9, 11 (form no
topo + box leak), 7 (multi-cartão), 11 (categoria automática) e 4/5/6/9/10/11/12/13/14 (sem
picker nativo, em toda tela de categoria/box/cartão). Os itens que surgiram na conversa —
reordenar o menu (Task 8), telas de Categorias do cartão/Assinaturas continuarem separadas
(Tasks 10/11, sem fusão), form sempre no topo em todo lugar (Tasks 7/9/11), e a linha
Assinaturas em Análises (Tasks 3/15/16) — também estão cobertos.

**Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem código completo.

**Consistência de tipos:** `SeletorCategoria.categorias` é sempre `{ id: string; nome: string }[]`
e `selecionadaId: string | null` em todos os 5 usos (TelaLancar, Recorrencias, FormCompra,
LancEditor, TelaSimulador). `SeletorPills.opcoes` é `{ id: string; nome: string }[]` e
`selecionadaId: string` (não-nulo — sempre há uma seleção default) nos 3 usos (Recorrencias,
CategoriasCartao, Assinaturas). `repo.categoriaAssinaturasDe(cartaoId: ID): Promise<ID>` tem a
mesma assinatura em todo lugar que a chama (Task 11 no app, Tasks 11/16 nos testes).
`resumoAssinaturasDoMes` e `ItemResumoAssinaturas`/`ResumoAssinaturas` têm a mesma forma em
Task 3 (definição), Task 15 (consumo no componente) e Task 16 (consumo na tela).
