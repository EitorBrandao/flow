# Drill-down de lançamentos por categoria (Análises) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao tocar numa linha da tabela "Por categoria" na aba Análises, abrir um sheet com os
lançamentos daquele mês agrupados por descrição/nota (normalizada), cada grupo com subtotal e
suas datas de ocorrência.

**Architecture:** Nova função pura em `src/domain/aggregations.ts` (`lancamentosDaCategoria`)
que filtra e agrupa; novo componente `src/ui/LancamentosSheet.tsx` que reusa o `Sheet.tsx`
existente para exibir os grupos; `src/ui/TelaAnalises.tsx` ganha estado local para controlar
qual categoria está aberta e monta o sheet.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Dexie (IndexedDB) para os testes
de integração da tela.

## Global Constraints

- Reaproveitar o filtro privado `filtrar()` já existente em `aggregations.ts` (box, mês,
  status, exclui `cenarioId`) — não duplicar essa lógica.
- Agrupar por nota normalizada: `(l.nota ?? '').trim().toLowerCase()`; chave vazia vira o
  grupo `"sem nota"`.
- `notaExibicao` preserva o texto original (trim, sem lowercase) da primeira ocorrência do
  grupo.
- Grupos ordenados por `subtotal` decrescente; itens de cada grupo por `data` decrescente.
- UI usa o `Sheet` existente (`src/ui/Sheet.tsx`) e as classes CSS já existentes
  (`.lista`, `.item`, `.rotulo-grupo`, `.linha`, `.sub`, `.valor-ganho`/`.valor-gasto`,
  `.tela h2`/`h2` padrão) — nenhuma classe CSS nova é necessária.
- Formatação de data no padrão já usado em `ItemFaturaBotao`
  (`src/ui/TelaCartao.tsx:159`): `data.split('-').reverse().join('/')` → `dd/mm/aaaa`.
- Valor monetário sempre positivo em centavos (`Lancamento.valor`); o sinal ganho/gasto vem do
  `tipo` da categoria, não do valor — seguir a convenção já usada nos fixtures de
  `aggregations.test.ts` (não inverter sinal nos testes novos).

---

### Task 1: Função de domínio `lancamentosDaCategoria`

**Files:**
- Modify: `src/domain/aggregations.ts`
- Test: `src/domain/aggregations.test.ts`

**Interfaces:**
- Consumes: `filtrar(mes, boxIds, lancamentos, incluirPrevistos): Lancamento[]` (função
  privada já existente em `aggregations.ts`, linha 20); tipos `ID`, `ISODate`, `Lancamento`
  de `./types`.
- Produces:
  ```ts
  export interface ItemLancamento {
    data: ISODate;
    valor: number;
  }

  export interface GrupoLancamentos {
    notaChave: string;
    notaExibicao: string;
    subtotal: number;
    itens: ItemLancamento[];
  }

  export function lancamentosDaCategoria(
    mes: string,
    categoriaId: ID,
    boxIds: readonly ID[],
    lancamentos: Lancamento[],
    incluirPrevistos: boolean,
  ): GrupoLancamentos[]
  ```
  Task 2 e Task 3 consomem `lancamentosDaCategoria` e os tipos `GrupoLancamentos`/`ItemLancamento`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `src/domain/aggregations.test.ts`:

```ts
it('lancamentosDaCategoria agrupa por nota normalizada, soma subtotal e ordena', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria Silva' }),
    lanc({ id: 'p2', data: '2026-07-12', valor: 20000, categoriaId: 'car', nota: ' maria silva ' }),
    lanc({ id: 'p3', data: '2026-07-08', valor: 15000, categoriaId: 'car', nota: 'Padaria' }),
    lanc({ id: 'p4', data: '2026-07-01', valor: 5000, categoriaId: 'car' }), // sem nota
  ];
  const grupos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);

  expect(grupos).toHaveLength(3);
  expect(grupos[0].notaExibicao).toBe('Maria Silva');
  expect(grupos[0].notaChave).toBe('maria silva');
  expect(grupos[0].subtotal).toBe(50000);
  expect(grupos[0].itens.map((i) => i.data)).toEqual(['2026-07-12', '2026-07-05']); // recente primeiro
  expect(grupos[1].notaExibicao).toBe('Padaria');
  expect(grupos[1].subtotal).toBe(15000);
  expect(grupos[2].notaExibicao).toBe('sem nota');
  expect(grupos[2].subtotal).toBe(5000);
});

it('lancamentosDaCategoria respeita o filtro de box/mês/status/cenário', () => {
  const lancsPix: Lancamento[] = [
    lanc({ id: 'p1', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }),
    lanc({ id: 'p2', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', boxId: 'outra' }),
    lanc({ id: 'p3', data: '2026-06-05', valor: 30000, categoriaId: 'car', nota: 'Maria' }), // mês errado
    lanc({ id: 'p4', data: '2026-07-05', valor: 30000, categoriaId: 'car', nota: 'Maria', status: 'previsto' }),
    lanc({ id: 'p5', data: '2026-07-05', valor: 999999, categoriaId: 'car', nota: 'Maria', status: 'previsto', cenarioId: 'x' }),
  ];
  const semPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, false);
  expect(semPrevistos[0].subtotal).toBe(30000); // só p1

  const comPrevistos = lancamentosDaCategoria('2026-07', 'car', ['be'], lancsPix, true);
  expect(comPrevistos[0].subtotal).toBe(60000); // p1 + p4, cenário fora
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/domain/aggregations.test.ts`
Expected: FAIL — `lancamentosDaCategoria is not a function` (ou erro de import).

- [ ] **Step 3: Implementar a função**

Em `src/domain/aggregations.ts`, trocar a linha de import do topo:

```ts
import type { Categoria, ID, ISODate, Lancamento, TipoCategoria } from './types';
```

E adicionar ao final do arquivo:

```ts
export interface ItemLancamento {
  data: ISODate;
  valor: number;
}

export interface GrupoLancamentos {
  notaChave: string;
  notaExibicao: string;
  subtotal: number;
  itens: ItemLancamento[];
}

export function lancamentosDaCategoria(
  mes: string,
  categoriaId: ID,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): GrupoLancamentos[] {
  const doCategoria = filtrar(mes, boxIds, lancamentos, incluirPrevistos).filter(
    (l) => l.categoriaId === categoriaId,
  );
  const grupos = new Map<string, GrupoLancamentos>();
  for (const l of doCategoria) {
    const chave = (l.nota ?? '').trim().toLowerCase();
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { notaChave: chave, notaExibicao: chave === '' ? 'sem nota' : l.nota!.trim(), subtotal: 0, itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.subtotal += l.valor;
    grupo.itens.push({ data: l.data, valor: l.valor });
  }
  for (const g of grupos.values()) {
    g.itens.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }
  return [...grupos.values()].sort((a, b) => b.subtotal - a.subtotal);
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/domain/aggregations.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os pré-existentes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/aggregations.ts src/domain/aggregations.test.ts
git commit -m "feat(analises): adiciona lancamentosDaCategoria agrupada por nota"
```

---

### Task 2: Componente `LancamentosSheet`

**Files:**
- Create: `src/ui/LancamentosSheet.tsx`
- Test: `src/ui/LancamentosSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`src/ui/Sheet.tsx`, props `{ aberto: boolean; onFechar: () => void;
  rotulo?: string; children: ReactNode }`); `lancamentosDaCategoria`, `GrupoLancamentos` de
  `../domain/aggregations` (Task 1); `formatarBRL` de `../domain/money`; tipos `ID`,
  `Lancamento`, `TipoCategoria` de `../domain/types`.
- Produces: componente default `LancamentosSheet` com props:
  ```ts
  interface Props {
    aberto: boolean;
    categoriaId: ID | null;
    nome: string;
    tipo: TipoCategoria;
    mes: string;
    boxIds: readonly ID[];
    lancamentos: Lancamento[];
    incluirPrevistos: boolean;
    onFechar: () => void;
  }
  ```
  Task 3 monta `<LancamentosSheet ... />` com essas props exatas.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/LancamentosSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Lancamento } from '../domain/types';
import LancamentosSheet from './LancamentosSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
function lanc(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor'>): Lancamento {
  return { boxId: 'be', categoriaId: 'pix', status: 'efetivo', origem: 'manual', ...ts, ...p };
}

describe('LancamentosSheet', () => {
  it('agrupa por nota, mostra subtotal do grupo e total da categoria', () => {
    const lancamentos: Lancamento[] = [
      lanc({ id: '1', data: '2026-07-05', valor: 30000, nota: 'Maria Silva' }),
      lanc({ id: '2', data: '2026-07-12', valor: 20000, nota: ' maria silva ' }),
      lanc({ id: '3', data: '2026-07-08', valor: 15000, nota: 'Padaria' }),
    ];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancamentos} incluirPrevistos={false} onFechar={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Pix' })).toBeInTheDocument();
    expect(screen.getByText('R$ 650,00')).toBeInTheDocument(); // total da categoria
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('R$ 500,00')).toBeInTheDocument(); // subtotal do grupo Maria Silva
    expect(screen.getByText('12/07/2026')).toBeInTheDocument();
    expect(screen.getByText('05/07/2026')).toBeInTheDocument();
  });

  it('lançamento sem nota cai no grupo "sem nota"', () => {
    const lancamentos: Lancamento[] = [lanc({ id: '1', data: '2026-07-05', valor: 5000 })];
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={lancamentos} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    expect(screen.getByText('sem nota')).toBeInTheDocument();
  });

  it('fechado não renderiza nada', () => {
    render(
      <LancamentosSheet
        aberto={false} categoriaId={null} nome="" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={[]} incluirPrevistos={false} onFechar={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/LancamentosSheet.test.tsx`
Expected: FAIL — não é possível resolver o módulo `./LancamentosSheet` (arquivo não existe).

- [ ] **Step 3: Implementar o componente**

Criar `src/ui/LancamentosSheet.tsx`:

```tsx
import { lancamentosDaCategoria } from '../domain/aggregations';
import { formatarBRL } from '../domain/money';
import type { ID, Lancamento, TipoCategoria } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  categoriaId: ID | null;
  nome: string;
  tipo: TipoCategoria;
  mes: string;
  boxIds: readonly ID[];
  lancamentos: Lancamento[];
  incluirPrevistos: boolean;
  onFechar: () => void;
}

function dataFormatada(iso: string): string {
  return iso.split('-').reverse().join('/');
}

export default function LancamentosSheet({
  aberto, categoriaId, nome, tipo, mes, boxIds, lancamentos, incluirPrevistos, onFechar,
}: Props) {
  const grupos = categoriaId
    ? lancamentosDaCategoria(mes, categoriaId, boxIds, lancamentos, incluirPrevistos)
    : [];
  const total = grupos.reduce((soma, g) => soma + g.subtotal, 0);
  const classeValor = tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto';

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={nome}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{nome}</h2>
        <strong className={classeValor}>{formatarBRL(total)}</strong>
      </div>
      <div className="lista" style={{ marginTop: 12 }}>
        {grupos.map((g) => (
          <div key={g.notaChave}>
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <p className="rotulo-grupo">{g.notaExibicao}</p>
              <span className={classeValor}>{formatarBRL(g.subtotal)}</span>
            </div>
            <div className="lista" style={{ marginTop: 6 }}>
              {g.itens.map((it, i) => (
                <div className="item" key={`${it.data}:${i}`} style={{ cursor: 'default' }}>
                  <div className="cresce">{dataFormatada(it.data)}</div>
                  <span className={classeValor}>{formatarBRL(it.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grupos.length === 0 && <p className="sub">Sem lançamentos no mês.</p>}
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/LancamentosSheet.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/LancamentosSheet.tsx src/ui/LancamentosSheet.test.tsx
git commit -m "feat(analises): LancamentosSheet exibe lancamentos agrupados por nota"
```

---

### Task 3: Ligar o drill-down na `TelaAnalises`

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`
- Test: `src/ui/TelaAnalises.test.tsx` (novo arquivo — a tela ainda não tem testes)

**Interfaces:**
- Consumes: `LancamentosSheet` (Task 2) com as props exatas definidas ali; `dados.categorias`
  e `dados.lancamentos` de `useApp()` (`../state/store`); `resumo.linhas` (já existente,
  `{ categoriaId, nome, tipo, total, pctDaRenda }`).
- Produces: nenhuma interface nova consumida por outras tasks — esta é a task final.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ui/TelaAnalises.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaAnalises from './TelaAnalises';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seedBoxComCategoria() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catPix = await repo.salvarCategoria({ boxId: box.id, nome: 'pix', tipo: 'gasto', ordem: 0 });
  return { box, catPix };
}

it('clicar numa linha da tabela abre o sheet com os lançamentos agrupados por nota', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 15000, status: 'efetivo', nota: 'Padaria' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByText('pix'));

  expect(await screen.findByRole('dialog', { name: 'pix' })).toBeInTheDocument();
  expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  expect(screen.getByText('Padaria')).toBeInTheDocument();
});

it('trocar o mês com o sheet aberto atualiza os grupos exibidos', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const hoje = '2026-07-15';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo', nota: 'Maria Silva' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-06-05', valor: 20000, status: 'efetivo', nota: 'João' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaAnalises />);
  await userEvent.click(screen.getByText('pix'));
  expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  expect(screen.queryByText('João')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));

  expect(await screen.findByText('João')).toBeInTheDocument();
  expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: FAIL — clicar em `'pix'` não abre nenhum `dialog` (a linha ainda não é clicável).

- [ ] **Step 3: Implementar a integração**

Em `src/ui/TelaAnalises.tsx`, trocar o topo do arquivo:

```tsx
import { useState } from 'react';
import { compararMeses, mediaMovel3, resumoMensal, serieMensal } from '../domain/aggregations';
import { addMeses, mesDe } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { ID } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import LancamentosSheet from './LancamentosSheet';
```

Dentro de `TelaAnalises`, logo após `const [incluirPrevistos, setIncluirPrevistos] = ...`:

```tsx
  const [categoriaAberta, setCategoriaAberta] = useState<ID | null>(null);
```

Depois de `if (!dados) return null;`, adicionar:

```tsx
  const categoriaObj = dados.categorias.find((c) => c.id === categoriaAberta);
```

Trocar o `<tbody>` da tabela "Por categoria" (dentro do `.map` de `resumo.linhas`):

```tsx
          <tbody>
            {resumo.linhas.map((l) => (
              <tr
                key={l.categoriaId}
                onClick={() => setCategoriaAberta(l.categoriaId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCategoriaAberta(l.categoriaId); }
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <td>{l.nome}</td>
                <td className={l.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(l.total)}</td>
                <td>{pct(l.pctDaRenda)}</td>
              </tr>
            ))}
            {resumo.linhas.length === 0 && <tr><td colSpan={3}>Sem movimentos no mês.</td></tr>}
          </tbody>
```

E, imediatamente antes do `</div>` final que fecha `<div className="tela">` (fim do JSX
retornado), adicionar:

```tsx
      <LancamentosSheet
        aberto={categoriaAberta !== null}
        categoriaId={categoriaAberta}
        nome={categoriaObj?.nome ?? ''}
        tipo={categoriaObj?.tipo ?? 'gasto'}
        mes={mes}
        boxIds={ids}
        lancamentos={dados.lancamentos}
        incluirPrevistos={incluirPrevistos}
        onFechar={() => setCategoriaAberta(null)}
      />
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar a suíte completa**

Run: `npx vitest run`
Expected: PASS — todos os testes do projeto, sem regressão.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): linha da tabela Por categoria abre drill-down de lancamentos"
```

---

## Fora de escopo (já registrado na spec)

- Normalização mais agressiva de nota (prefixos de banco, IDs de transação).
- Editar/excluir lançamento a partir do sheet.
- Busca/filtro dentro do sheet quando há muitos grupos.
