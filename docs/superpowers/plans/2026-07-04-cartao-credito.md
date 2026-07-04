# Aba Cartão de Crédito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Cartão" com compras itemizadas por cartão (um por box), faturas derivadas por ciclo de fechamento, e um lançamento `previsto` sincronizado no Flow por fatura — incluindo conferência com o valor do app do banco.

**Architecture:** Fatura nunca é armazenada: `src/domain/fatura.ts` calcula faturas por função pura a partir das compras + ciclo do cartão, e um diff puro (`diffSincronizacao`) mantém lançamentos `previstos` no Flow com a mesma disciplina da materialização de recorrências (efetivo intocável, descartado não ressuscita). Assinaturas materializam `CompraCartao` reusando `materializar` de `recurrence.ts`.

**Tech Stack:** React 18 + TypeScript + Vite, Dexie (IndexedDB), Zustand, Vitest + Testing Library + fake-indexeddb. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-07-04-cartao-credito-design.md`

## Global Constraints

- Código e UI em **português** (padrão do repo: `salvarCompraCartao`, "fatura", "vence dia 5").
- Dinheiro sempre em **centavos inteiros**.
- **Sem dependências novas** no package.json.
- TDD: teste falhando antes da implementação; `npm test` verde antes de cada commit.
- Testes que dependem de "hoje" fixam o relógio: `vi.useFakeTimers({ toFake: ['Date'] }); try { vi.setSystemTime(new Date('2026-07-01T12:00:00')); ... } finally { vi.useRealTimers(); }` (lição do commit d76ab06). Testes de UI também fixam `useApp.setState({ hoje: '...' })`.
- Compras do cartão **nunca** entram no motor de projeção (`projection.ts` não muda); só o lançamento da fatura entra no Flow.
- Commits pequenos com mensagens em português no padrão do repo (`feat:`/`fix:`/`test:`).
- Comandos de teste: suíte toda `npm test`; um arquivo `npx vitest run src/domain/fatura.test.ts`.

## File Structure

| Arquivo | Papel |
|---|---|
| `src/domain/types.ts` (modificar) | Entidades novas + campos novos em `Lancamento` e `Dados` |
| `src/db/database.ts` (modificar) | Dexie `version(2)` com 5 tabelas novas |
| `src/domain/fatura.ts` (criar) | Ciclo, parcelas, `calcularFaturas`, `valorSincronizado`, `diffSincronizacao` — tudo puro |
| `src/domain/recurrence.ts` (modificar) | Alargar assinatura de `materializar` (tipo estrutural) para reuso pelas assinaturas |
| `src/db/repo.ts` (modificar) | CRUD cartão/categoria/compra/assinatura/conferência + `sincronizarCartoes` |
| `src/state/store.ts` (modificar) | `Aba` ganha `'cartao'`; boot sincroniza cartões |
| `src/backup/backup.ts` (modificar) | Schema 2 com as tabelas novas; aceita schema 1 |
| `src/ui/Shell.tsx` (modificar) | Aba "Cartão" na barra |
| `src/ui/TelaCartao.tsx` (criar) | Tela da fatura: navegação por mês, itens, + compra, conferência |
| `src/ui/ajustes/Cartoes.tsx` (criar) | Cadastro de cartões |
| `src/ui/ajustes/CategoriasCartao.tsx` (criar) | Categorias do cartão |
| `src/ui/ajustes/Assinaturas.tsx` (criar) | Assinaturas (recorrências do cartão) |
| `src/ui/TelaAjustes.tsx` (modificar) | 3 entradas novas no menu |

---

### Task 1: Commitar o WIP pendente da árvore

A árvore de trabalho contém mudanças não commitadas de que o master **precisa** (`TelaHoje.tsx` já commitado usa `parseValorDigitado(..., { permitirZero: true })`, que só existe no diff pendente de `money.ts`). Nada de cartão aqui — só destravar a base.

**Files:**
- Já modificados na árvore: `src/domain/money.ts`, `src/domain/money.test.ts`, `src/domain/types.ts` (fallback de `novoId`), `src/ui/ajustes/Boxes.tsx`, `src/ui/ajustes/Boxes.test.tsx` (novo)

- [ ] **Step 1: Rodar a suíte**

Run: `npm test`
Expected: PASS (todas as suítes verdes com o WIP presente).

- [ ] **Step 2: Commitar**

```bash
git add src/domain/money.ts src/domain/money.test.ts src/domain/types.ts src/ui/ajustes/Boxes.tsx src/ui/ajustes/Boxes.test.tsx
git commit -m "fix: permitirZero no saldo de boxes e fallback de UUID para WebView antigo"
```

---

### Task 2: Tipos, schema Dexie v2 e carregamento

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/database.ts`
- Modify: `src/db/repo.ts` (`carregarTudo`, `substituirTudo`)
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Produces: tipos `Cartao`, `CategoriaCartao`, `CompraCartao`, `RecorrenciaCartao`, `ConferenciaFatura`; `Lancamento.cartaoId?`/`faturaMes?`; `OrigemLancamento` com `'cartao'`; `Dados` com os 5 arrays; tabelas Dexie `db.cartoes`, `db.categoriasCartao`, `db.comprasCartao`, `db.recorrenciasCartao`, `db.conferenciasFatura`.

- [ ] **Step 1: Escrever os testes que falham** (adicionar ao fim de `src/db/repo.test.ts`)

```ts
describe('tabelas do cartão', () => {
  it('carregarTudo devolve as tabelas novas (vazias num banco novo)', async () => {
    const dados = await repo.carregarTudo();
    expect(dados.cartoes).toEqual([]);
    expect(dados.categoriasCartao).toEqual([]);
    expect(dados.comprasCartao).toEqual([]);
    expect(dados.recorrenciasCartao).toEqual([]);
    expect(dados.conferenciasFatura).toEqual([]);
  });

  it('substituirTudo limpa e regrava as tabelas do cartão', async () => {
    const agora = agoraISO();
    await db.cartoes.add({
      id: 'velho', boxId: 'b', nome: 'Velho', diaFechamento: 1, diaVencimento: 10,
      categoriaFaturaId: 'c', ativo: true, criadoEm: agora, alteradoEm: agora,
    });
    const dados = await repo.carregarTudo();
    await repo.substituirTudo({
      ...dados,
      cartoes: [{
        id: 'novo', boxId: 'b', nome: 'Novo', diaFechamento: 28, diaVencimento: 5,
        categoriaFaturaId: 'c', ativo: true, criadoEm: agora, alteradoEm: agora,
      }],
    });
    const depois = await db.cartoes.toArray();
    expect(depois.map((c) => c.id)).toEqual(['novo']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/repo.test.ts`
Expected: FAIL (`dados.cartoes` é `undefined`; `db.cartoes` não existe).

- [ ] **Step 3: Implementar tipos** — em `src/domain/types.ts`:

Trocar a linha do union:

```ts
export type OrigemLancamento = 'manual' | 'recorrencia' | 'import' | 'cartao';
```

Em `Lancamento`, adicionar após `cenarioId?: ID;`:

```ts
  cartaoId?: ID;     // lançamento de fatura: cartão dono
  faturaMes?: string; // 'AAAA-MM' do vencimento — chave estável da fatura
```

Adicionar após a interface `Recorrencia`:

```ts
export interface Cartao extends Entidade {
  boxId: ID;
  nome: string;
  diaFechamento: number; // 1-31, clampado ao fim do mês
  diaVencimento: number; // 1-31, clampado
  categoriaFaturaId: ID; // categoria de gasto do Flow que recebe a fatura
  ativo: boolean;
}

export interface CategoriaCartao extends Entidade {
  cartaoId: ID;
  nome: string;
  ordem: number;
  arquivada: boolean;
}

export interface CompraCartao extends Entidade {
  cartaoId: ID;
  categoriaCartaoId: ID;
  data: ISODate;   // data da compra
  valorTotal: number; // centavos, total da compra
  parcelas: number;   // >= 1; 1 = à vista
  descricao?: string;
  recorrenciaCartaoId?: ID; // se gerada por assinatura
}

export interface RecorrenciaCartao extends Entidade {
  cartaoId: ID;
  categoriaCartaoId: ID;
  valor: number; // centavos
  dataInicio: ISODate;
  diaDoMes: number;
  parcelas: number | null; // null = sem fim
  descricao?: string;
  ativa: boolean;
}

/** Valor de conferência da fatura digitado a partir do app do banco (máx. 1 por cartão+mês). */
export interface ConferenciaFatura extends Entidade {
  cartaoId: ID;
  mes: string; // 'AAAA-MM' do vencimento
  valorAppCent: number;
  usarValorApp: boolean; // marcado: o previsto no Flow usa valorAppCent no lugar da soma
}
```

Em `Dados`, adicionar os arrays:

```ts
export interface Dados {
  boxes: Box[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  recorrencias: Recorrencia[];
  cenarios: Cenario[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  recorrenciasCartao: RecorrenciaCartao[];
  conferenciasFatura: ConferenciaFatura[];
  config: Config;
}
```

- [ ] **Step 4: Implementar schema** — em `src/db/database.ts` (versão 1 fica intacta; adicionar campos e `version(2)`):

```ts
import Dexie, { type Table } from 'dexie';
import type {
  Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, Recorrencia, RecorrenciaCartao,
} from '../domain/types';

export class FlowDB extends Dexie {
  boxes!: Table<Box, string>;
  categorias!: Table<Categoria, string>;
  lancamentos!: Table<Lancamento, string>;
  recorrencias!: Table<Recorrencia, string>;
  cenarios!: Table<Cenario, string>;
  config!: Table<Config, string>;
  cartoes!: Table<Cartao, string>;
  categoriasCartao!: Table<CategoriaCartao, string>;
  comprasCartao!: Table<CompraCartao, string>;
  recorrenciasCartao!: Table<RecorrenciaCartao, string>;
  conferenciasFatura!: Table<ConferenciaFatura, string>;

  constructor() {
    super('flow');
    this.version(1).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
    });
    this.version(2).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
    });
  }
}

export const db = new FlowDB();
```

- [ ] **Step 5: Atualizar `carregarTudo` e `substituirTudo`** — em `src/db/repo.ts`:

`carregarTudo` — trocar o bloco do `Promise.all` e o `return` por:

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
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, config,
  };
```

`substituirTudo` — versão completa nova:

```ts
export async function substituirTudo(d: Dados): Promise<void> {
  const tabelas = [
    db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios,
    db.cartoes, db.categoriasCartao, db.comprasCartao, db.recorrenciasCartao,
    db.conferenciasFatura, db.config,
  ];
  await db.transaction('rw', tabelas, async () => {
    await Promise.all(tabelas.map((t) => t.clear()));
    await db.boxes.bulkAdd(d.boxes);
    await db.categorias.bulkAdd(d.categorias);
    await db.lancamentos.bulkAdd(d.lancamentos);
    await db.recorrencias.bulkAdd(d.recorrencias);
    await db.cenarios.bulkAdd(d.cenarios);
    await db.cartoes.bulkAdd(d.cartoes);
    await db.categoriasCartao.bulkAdd(d.categoriasCartao);
    await db.comprasCartao.bulkAdd(d.comprasCartao);
    await db.recorrenciasCartao.bulkAdd(d.recorrenciasCartao);
    await db.conferenciasFatura.bulkAdd(d.conferenciasFatura);
    await db.config.put({ ...d.config, mudancasDesdeBackup: false });
  });
}
```

Nota: outros pontos que constroem `Dados` na mão (ex.: fixtures de teste do importer, `mesclar` em backup) vão acusar erro de tipo — nesta task, corrigir apenas o que o `tsc` apontar adicionando arrays vazios `cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: []` onde um `Dados` literal for montado. O backup em si é a Task 8.

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test` e `npx tsc -b`
Expected: PASS / sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(cartao): tipos, schema Dexie v2 e carregamento das tabelas do cartão"
```

---

### Task 3: Ciclo da fatura (`fatura.ts`, parte 1)

**Files:**
- Create: `src/domain/fatura.ts`
- Test: `src/domain/fatura.test.ts` (criar)

**Interfaces:**
- Consumes: `addMeses`, `dataComDia`, `mesDe` de `./dates`; tipo `Cartao` de `./types`.
- Produces: `type CicloCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>`; `mesFechamentoDaCompra(cartao, data): string`; `mesVencimentoDoFechamento(cartao, mesFechamento): string`; `mesFaturaDaCompra(cartao, data): string`; `datasFaturaDoMes(cartao, mesVencimento): { dataFechamento: ISODate; dataVencimento: ISODate }`.

- [ ] **Step 1: Escrever os testes que falham** — `src/domain/fatura.test.ts`:

```ts
import { datasFaturaDoMes, mesFaturaDaCompra, mesFechamentoDaCompra } from './fatura';

const nubank = { diaFechamento: 28, diaVencimento: 5 }; // vence no mês seguinte ao fechamento
const outro = { diaFechamento: 10, diaVencimento: 20 }; // vence no mesmo mês do fechamento

describe('mesFechamentoDaCompra', () => {
  it('compra antes do fechamento cai no ciclo do próprio mês', () => {
    expect(mesFechamentoDaCompra(nubank, '2026-07-10')).toBe('2026-07');
  });
  it('compra no dia do fechamento entra na fatura seguinte', () => {
    expect(mesFechamentoDaCompra(nubank, '2026-07-28')).toBe('2026-08');
  });
  it('clampa o fechamento ao fim do mês (dia 31 em fevereiro)', () => {
    const c = { diaFechamento: 31, diaVencimento: 7 };
    expect(mesFechamentoDaCompra(c, '2026-02-27')).toBe('2026-02');
    expect(mesFechamentoDaCompra(c, '2026-02-28')).toBe('2026-03'); // 28 = fechamento clampado
  });
});

describe('mesFaturaDaCompra e datasFaturaDoMes', () => {
  it('vencimento menor que o fechamento: vence no mês seguinte', () => {
    expect(mesFaturaDaCompra(nubank, '2026-07-10')).toBe('2026-08');
    expect(datasFaturaDoMes(nubank, '2026-08'))
      .toEqual({ dataFechamento: '2026-07-28', dataVencimento: '2026-08-05' });
  });
  it('vencimento maior que o fechamento: vence no mesmo mês', () => {
    expect(mesFaturaDaCompra(outro, '2026-07-05')).toBe('2026-07');
    expect(datasFaturaDoMes(outro, '2026-07'))
      .toEqual({ dataFechamento: '2026-07-10', dataVencimento: '2026-07-20' });
  });
  it('atravessa a virada de ano', () => {
    expect(mesFaturaDaCompra(nubank, '2026-12-28')).toBe('2027-02'); // fecha 2027-01-28, vence 2027-02-05
    expect(mesFaturaDaCompra(nubank, '2026-12-27')).toBe('2027-01');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: FAIL ("Cannot find module './fatura'").

- [ ] **Step 3: Implementar** — `src/domain/fatura.ts`:

```ts
import { addMeses, dataComDia, mesDe } from './dates';
import type { Cartao, ISODate } from './types';

export type CicloCartao = Pick<Cartao, 'diaFechamento' | 'diaVencimento'>;

/** Mês ('AAAA-MM') cujo fechamento recolhe a compra. Compra no dia do fechamento
 *  entra na fatura seguinte (o primeiro fechamento ESTRITAMENTE posterior à data). */
export function mesFechamentoDaCompra(cartao: CicloCartao, data: ISODate): string {
  const [ano, mes] = data.split('-').map(Number);
  const fechamentoDoMes = dataComDia(ano, mes, cartao.diaFechamento);
  return data < fechamentoDoMes ? mesDe(data) : addMeses(mesDe(data), 1);
}

/** Mês do vencimento da fatura que fecha no mês dado. */
export function mesVencimentoDoFechamento(cartao: CicloCartao, mesFechamento: string): string {
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : addMeses(mesFechamento, 1);
}

/** Mês ('AAAA-MM' do vencimento — a chave da fatura) onde cai a parcela 1 da compra. */
export function mesFaturaDaCompra(cartao: CicloCartao, data: ISODate): string {
  return mesVencimentoDoFechamento(cartao, mesFechamentoDaCompra(cartao, data));
}

/** Datas de fechamento e vencimento da fatura cujo vencimento cai no mês dado. */
export function datasFaturaDoMes(
  cartao: CicloCartao,
  mesVencimento: string,
): { dataFechamento: ISODate; dataVencimento: ISODate } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento
    ? mesVencimento
    : addMeses(mesVencimento, -1);
  const [anoF, mesF] = mesFechamento.split('-').map(Number);
  const [anoV, mesV] = mesVencimento.split('-').map(Number);
  return {
    dataFechamento: dataComDia(anoF, mesF, cartao.diaFechamento),
    dataVencimento: dataComDia(anoV, mesV, cartao.diaVencimento),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(cartao): ciclo da fatura — fechamento, vencimento e clamp de fim de mês"
```

---

### Task 4: Parcelas e `calcularFaturas` (`fatura.ts`, parte 2)

**Files:**
- Modify: `src/domain/fatura.ts`
- Test: `src/domain/fatura.test.ts`

**Interfaces:**
- Produces: `interface ItemFatura { compraId: ID; data: ISODate; categoriaCartaoId: ID; descricao?: string; parcela: number; totalParcelas: number; valorCent: number }`; `interface Fatura { mes: string; dataFechamento: ISODate; dataVencimento: ISODate; itens: ItemFatura[]; totalCent: number }`; `valorParcela(valorTotal, parcelas, n): number`; `calcularFaturas(cartao: CicloCartao, compras: CompraCartao[], ate: ISODate): Fatura[]` (ordenadas por `mes`).

- [ ] **Step 1: Escrever os testes que falham** (adicionar em `fatura.test.ts`):

```ts
import type { CompraCartao } from './types';
import { calcularFaturas, valorParcela } from './fatura';

function compra(data: string, valorTotal: number, parcelas = 1): CompraCartao {
  return {
    id: `c-${data}-${valorTotal}-${parcelas}`, cartaoId: 'k1', categoriaCartaoId: 'cat1',
    data, valorTotal, parcelas, criadoEm: '', alteradoEm: '',
  };
}

describe('valorParcela', () => {
  it('divide ao centavo, resto na primeira parcela', () => {
    expect(valorParcela(10000, 3, 1)).toBe(3334);
    expect(valorParcela(10000, 3, 2)).toBe(3333);
    expect(valorParcela(10000, 3, 3)).toBe(3333);
    expect(valorParcela(9999, 2, 1)).toBe(5000);
    expect(valorParcela(9999, 2, 2)).toBe(4999);
    expect(valorParcela(5000, 1, 1)).toBe(5000);
  });
});

describe('calcularFaturas', () => {
  it('agrupa compras nas faturas certas e soma ao centavo', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 5000), compra('2026-07-28', 2000)], '2026-12-31');
    expect(fs.map((f) => [f.mes, f.totalCent])).toEqual([['2026-08', 5000], ['2026-09', 2000]]);
    expect(fs[0].dataVencimento).toBe('2026-08-05');
  });

  it('espalha parcelas pelas faturas seguintes, resto na primeira', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 10000, 3)], '2026-12-31');
    expect(fs.map((f) => [f.mes, f.totalCent]))
      .toEqual([['2026-08', 3334], ['2026-09', 3333], ['2026-10', 3333]]);
    expect(fs[0].itens[0]).toMatchObject({ parcela: 1, totalParcelas: 3, valorCent: 3334 });
    expect(fs[1].itens[0]).toMatchObject({ parcela: 2, totalParcelas: 3, valorCent: 3333 });
  });

  it('corta parcelas com vencimento além do horizonte', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 12000, 12)], '2026-10-31');
    expect(fs.map((f) => f.mes)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('parcelas atravessam a virada de ano', () => {
    const fs = calcularFaturas(nubank, [compra('2026-11-10', 6000, 3)], '2027-12-31');
    expect(fs.map((f) => f.mes)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('soma múltiplas compras e parcelas na mesma fatura', () => {
    const fs = calcularFaturas(nubank, [compra('2026-07-10', 10000, 3), compra('2026-08-01', 500)], '2026-12-31');
    expect(fs.find((f) => f.mes === '2026-09')?.totalCent).toBe(3333 + 500);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: FAIL (`valorParcela` não exportado).

- [ ] **Step 3: Implementar** (adicionar em `fatura.ts`; ampliar o import de types para incluir `CompraCartao` e `ID`):

```ts
export interface ItemFatura {
  compraId: ID;
  data: ISODate; // data da compra
  categoriaCartaoId: ID;
  descricao?: string;
  parcela: number; // 1-based
  totalParcelas: number;
  valorCent: number;
}

export interface Fatura {
  mes: string; // 'AAAA-MM' do vencimento (chave da fatura)
  dataFechamento: ISODate;
  dataVencimento: ISODate;
  itens: ItemFatura[];
  totalCent: number;
}

/** Parcela n (1-based) em centavos; o resto da divisão inteira vai na primeira. */
export function valorParcela(valorTotal: number, parcelas: number, n: number): number {
  const base = Math.floor(valorTotal / parcelas);
  return n === 1 ? valorTotal - base * (parcelas - 1) : base;
}

/** Faturas derivadas das compras até `ate` (vencimento), ordenadas por mês. Função pura. */
export function calcularFaturas(cartao: CicloCartao, compras: CompraCartao[], ate: ISODate): Fatura[] {
  const porMes = new Map<string, Fatura>();
  for (const c of compras) {
    const mesFech1 = mesFechamentoDaCompra(cartao, c.data);
    for (let n = 1; n <= c.parcelas; n++) {
      const mes = mesVencimentoDoFechamento(cartao, addMeses(mesFech1, n - 1));
      const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes);
      if (dataVencimento > ate) break;
      let f = porMes.get(mes);
      if (!f) {
        f = { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
        porMes.set(mes, f);
      }
      const valorCent = valorParcela(c.valorTotal, c.parcelas, n);
      f.itens.push({
        compraId: c.id, data: c.data, categoriaCartaoId: c.categoriaCartaoId,
        ...(c.descricao ? { descricao: c.descricao } : {}),
        parcela: n, totalParcelas: c.parcelas, valorCent,
      });
      f.totalCent += valorCent;
    }
  }
  const out = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  for (const f of out) {
    f.itens.sort((a, b) => a.data.localeCompare(b.data) || a.compraId.localeCompare(b.compraId));
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(cartao): calcularFaturas com parcelas ao centavo"
```

---

### Task 5: `valorSincronizado` e `diffSincronizacao` (`fatura.ts`, parte 3)

**Files:**
- Modify: `src/domain/fatura.ts`
- Test: `src/domain/fatura.test.ts`

**Interfaces:**
- Produces: `valorSincronizado(fatura: Fatura, conf: ConferenciaFatura | undefined): number`; `interface DiffSincronizacao { criar: { faturaMes: string; data: ISODate; valor: number }[]; atualizar: { id: ID; valor: number; data: ISODate }[]; excluirIds: ID[] }`; `diffSincronizacao(cartao: Cartao, faturas: Fatura[], conferencias: ConferenciaFatura[], existentes: Lancamento[], hoje: ISODate): DiffSincronizacao`.

Regras (do spec): efetivo nunca é tocado; previsto novo só com vencimento `> hoje` (descartado não ressuscita); previsto existente segue valor/data mesmo com vencimento `<= hoje`; valor = soma dos itens, ou `valorAppCent` se `usarValorApp`; alvo zerado/cartão inativo ⇒ excluir previsto; conferência `usarValorApp` com valor > 0 e sem itens ⇒ fatura existe mesmo assim.

- [ ] **Step 1: Escrever os testes que falham** (adicionar em `fatura.test.ts`):

```ts
import type { Cartao, ConferenciaFatura, Lancamento } from './types';
import { diffSincronizacao } from './fatura';

const cartaoK: Cartao = {
  id: 'k1', boxId: 'b1', nome: 'Nu', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catFlow', ativo: true, criadoEm: '', alteradoEm: '',
};

function lancFatura(faturaMes: string, valor: number, status: 'previsto' | 'efetivo', data: string): Lancamento {
  return {
    id: `l-${faturaMes}`, boxId: 'b1', categoriaId: 'catFlow', data, valor, status,
    origem: 'cartao', cartaoId: 'k1', faturaMes, criadoEm: '', alteradoEm: '',
  };
}

function conf(mes: string, valorAppCent: number, usarValorApp: boolean): ConferenciaFatura {
  return { id: `cf-${mes}`, cartaoId: 'k1', mes, valorAppCent, usarValorApp, criadoEm: '', alteradoEm: '' };
}

describe('diffSincronizacao', () => {
  const faturas = calcularFaturas(cartaoK, [compra('2026-07-10', 10000, 2)], '2026-12-31');
  // faturas: 2026-08 (5000, vence 08-05) e 2026-09 (5000, vence 09-05)

  it('cria previstos para faturas futuras', () => {
    const d = diffSincronizacao(cartaoK, faturas, [], [], '2026-07-15');
    expect(d.criar).toEqual([
      { faturaMes: '2026-08', data: '2026-08-05', valor: 5000 },
      { faturaMes: '2026-09', data: '2026-09-05', valor: 5000 },
    ]);
    expect(d.atualizar).toEqual([]);
    expect(d.excluirIds).toEqual([]);
  });

  it('não recria fatura já vencida que o usuário descartou', () => {
    const d = diffSincronizacao(cartaoK, faturas, [], [], '2026-08-10');
    expect(d.criar).toEqual([{ faturaMes: '2026-09', data: '2026-09-05', valor: 5000 }]);
  });

  it('atualiza previsto existente quando o total muda (mesmo já vencido/pendente)', () => {
    const exist = [lancFatura('2026-08', 4000, 'previsto', '2026-08-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-08-10');
    expect(d.atualizar).toEqual([{ id: 'l-2026-08', valor: 5000, data: '2026-08-05' }]);
  });

  it('nunca toca lançamento efetivo', () => {
    const exist = [lancFatura('2026-08', 4000, 'efetivo', '2026-08-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-08-10');
    expect(d.atualizar).toEqual([]);
    expect(d.excluirIds).toEqual([]);
  });

  it('remove previsto de fatura que zerou', () => {
    const exist = [lancFatura('2026-10', 999, 'previsto', '2026-10-05')];
    const d = diffSincronizacao(cartaoK, faturas, [], exist, '2026-07-15');
    expect(d.excluirIds).toEqual(['l-2026-10']);
  });

  it('usarValorApp substitui a soma; desmarcado, a soma vale', () => {
    const usando = diffSincronizacao(cartaoK, faturas, [conf('2026-08', 7777, true)], [], '2026-07-15');
    expect(usando.criar[0]).toEqual({ faturaMes: '2026-08', data: '2026-08-05', valor: 7777 });
    const semUsar = diffSincronizacao(cartaoK, faturas, [conf('2026-08', 7777, false)], [], '2026-07-15');
    expect(semUsar.criar[0]).toEqual({ faturaMes: '2026-08', data: '2026-08-05', valor: 5000 });
  });

  it('conferência com usarValorApp e sem itens cria previsto mesmo assim', () => {
    const d = diffSincronizacao(cartaoK, [], [conf('2026-11', 3000, true)], [], '2026-07-15');
    expect(d.criar).toEqual([{ faturaMes: '2026-11', data: '2026-11-05', valor: 3000 }]);
  });

  it('cartão inativo remove todos os previstos e não cria nada', () => {
    const exist = [lancFatura('2026-08', 5000, 'previsto', '2026-08-05')];
    const d = diffSincronizacao({ ...cartaoK, ativo: false }, faturas, [], exist, '2026-07-15');
    expect(d.criar).toEqual([]);
    expect(d.excluirIds).toEqual(['l-2026-08']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: FAIL (`diffSincronizacao` não exportado).

- [ ] **Step 3: Implementar** (adicionar em `fatura.ts`; ampliar import de types com `Cartao`, `ConferenciaFatura`, `Lancamento` — `Cartao` já está):

```ts
/** Valor que a fatura leva ao Flow: soma dos itens, ou o valor do app se o usuário marcou. */
export function valorSincronizado(fatura: Fatura, conf: ConferenciaFatura | undefined): number {
  return conf?.usarValorApp ? conf.valorAppCent : fatura.totalCent;
}

export interface DiffSincronizacao {
  criar: { faturaMes: string; data: ISODate; valor: number }[];
  atualizar: { id: ID; valor: number; data: ISODate }[];
  excluirIds: ID[];
}

/** Diff entre as faturas calculadas e os lançamentos de fatura no Flow (mesma disciplina
 *  de `materializar`): efetivo nunca é tocado; previsto novo só com vencimento > hoje
 *  (não dá para distinguir "nunca criado" de "descartado" no passado); previsto existente
 *  segue valor/data do alvo; alvo ausente ou zerado ⇒ previsto excluído. */
export function diffSincronizacao(
  cartao: Cartao,
  faturas: Fatura[],
  conferencias: ConferenciaFatura[],
  existentes: Lancamento[],
  hoje: ISODate,
): DiffSincronizacao {
  const confPorMes = new Map(conferencias.map((c) => [c.mes, c]));
  const alvo = new Map<string, { valor: number; data: ISODate }>();
  if (cartao.ativo) {
    for (const f of faturas) {
      const valor = valorSincronizado(f, confPorMes.get(f.mes));
      if (valor > 0) alvo.set(f.mes, { valor, data: f.dataVencimento });
    }
    for (const c of conferencias) {
      if (c.usarValorApp && c.valorAppCent > 0 && !alvo.has(c.mes)) {
        alvo.set(c.mes, { valor: c.valorAppCent, data: datasFaturaDoMes(cartao, c.mes).dataVencimento });
      }
    }
  }
  const diff: DiffSincronizacao = { criar: [], atualizar: [], excluirIds: [] };
  const vistos = new Set<string>();
  for (const l of existentes) {
    if (l.faturaMes == null) continue;
    vistos.add(l.faturaMes);
    if (l.status === 'efetivo') continue;
    const a = alvo.get(l.faturaMes);
    if (!a) diff.excluirIds.push(l.id);
    else if (a.valor !== l.valor || a.data !== l.data) diff.atualizar.push({ id: l.id, ...a });
  }
  for (const [faturaMes, a] of alvo) {
    if (!vistos.has(faturaMes) && a.data > hoje) diff.criar.push({ faturaMes, ...a });
  }
  diff.criar.sort((a, b) => a.faturaMes.localeCompare(b.faturaMes));
  return diff;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(cartao): diff de sincronização fatura→Flow com conferência do app"
```

---

### Task 6: Repo do cartão — CRUD, assinaturas e `sincronizarCartoes`

**Files:**
- Modify: `src/domain/recurrence.ts` (alargar assinatura de `materializar`)
- Modify: `src/db/repo.ts`
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: `calcularFaturas`, `diffSincronizacao` de `../domain/fatura`; `materializar`, `ocorrencias` de `../domain/recurrence`.
- Produces (todas em `repo.ts`):
  - `salvarCartao(n: NovoCartao | Cartao, horizonte: ISODate): Promise<Cartao>` com `interface NovoCartao { boxId: ID; nome: string; diaFechamento: number; diaVencimento: number; categoriaFaturaId: ID }`
  - `salvarCategoriaCartao(n: NovaCategoriaCartao): Promise<CategoriaCartao>` com `interface NovaCategoriaCartao { cartaoId: ID; nome: string; ordem: number }`
  - `atualizarCategoriaCartao(id: ID, patch: Partial<Pick<CategoriaCartao, 'nome' | 'ordem' | 'arquivada'>>): Promise<void>`
  - `salvarCompraCartao(n: NovaCompraCartao, horizonte: ISODate): Promise<CompraCartao>` com `interface NovaCompraCartao { cartaoId: ID; categoriaCartaoId: ID; data: ISODate; valorTotal: number; parcelas: number; descricao?: string }`
  - `atualizarCompraCartao(id: ID, patch: Partial<Pick<CompraCartao, 'data' | 'valorTotal' | 'parcelas' | 'descricao' | 'categoriaCartaoId'>>, horizonte: ISODate): Promise<void>`
  - `excluirCompraCartao(id: ID, horizonte: ISODate): Promise<void>`
  - `salvarAssinatura(n: NovaAssinatura | RecorrenciaCartao, horizonte: ISODate): Promise<RecorrenciaCartao>` com `interface NovaAssinatura { cartaoId: ID; categoriaCartaoId: ID; valor: number; dataInicio: ISODate; diaDoMes: number; parcelas: number | null; descricao?: string }`
  - `excluirAssinatura(id: ID, horizonte: ISODate): Promise<void>`
  - `salvarConferenciaFatura(cartaoId: ID, mes: string, valorAppCent: number, usarValorApp: boolean, horizonte: ISODate): Promise<void>` (upsert por `[cartaoId+mes]`)
  - `removerConferenciaFatura(cartaoId: ID, mes: string, horizonte: ISODate): Promise<void>`
  - `sincronizarCartoes(horizonte: ISODate): Promise<void>` — materializa assinaturas e aplica `diffSincronizacao` de cada cartão

- [ ] **Step 1: Escrever os testes que falham** (adicionar ao fim de `src/db/repo.test.ts`; usa o mesmo padrão de fake timers dos testes existentes):

```ts
describe('cartão de crédito', () => {
  async function montarCartao() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    return { box, catFlow, cartao, catCartao };
  }

  it('compra parcelada gera um previsto por fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 10000, parcelas: 3,
      }, '2027-12-31');
      const previstos = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(previstos.map((l) => [l.faturaMes, l.data, l.valor, l.status])).toEqual([
        ['2026-08', '2026-08-05', 3334, 'previsto'],
        ['2026-09', '2026-09-05', 3333, 'previsto'],
        ['2026-10', '2026-10-05', 3333, 'previsto'],
      ]);
    } finally { vi.useRealTimers(); }
  });

  it('editar e excluir compra atualizam os previstos; efetivo confirmado fica intacto', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const compra = await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 6000, parcelas: 2,
      }, '2027-12-31');
      const ago = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      await repo.confirmarPendente(ago.id, 3100); // confirma a 1ª fatura com valor ajustado

      await repo.atualizarCompraCartao(compra.id, { valorTotal: 8000 }, '2027-12-31');
      const depois = await db.lancamentos.toArray();
      expect(depois.find((l) => l.faturaMes === '2026-08')!.valor).toBe(3100); // efetivo intocado
      expect(depois.find((l) => l.faturaMes === '2026-09')!.valor).toBe(4000); // previsto seguiu

      await repo.excluirCompraCartao(compra.id, '2027-12-31');
      const fim = await db.lancamentos.toArray();
      expect(fim.find((l) => l.faturaMes === '2026-08')!.valor).toBe(3100); // história preservada
      expect(fim.find((l) => l.faturaMes === '2026-09')).toBeUndefined();   // previsto removido
    } finally { vi.useRealTimers(); }
  });

  it('assinatura materializa compras futuras e pausar remove as não passadas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      const ass = await repo.salvarAssinatura({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, valor: 4990,
        dataInicio: '2026-07-15', diaDoMes: 15, parcelas: null, descricao: 'Netflix',
      }, '2026-12-31');
      const compras = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
      // compras materializadas até o horizonte (2026-12-31); a de 12-15 cai na fatura de
      // vencimento 2027-01-05, que passa do horizonte — a compra existe, o previsto não.
      expect(compras.map((c) => c.data).sort()).toEqual([
        '2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15', '2026-12-15',
      ]);
      expect(compras.every((c) => c.valorTotal === 4990 && c.parcelas === 1)).toBe(true);

      await repo.salvarAssinatura({ ...ass, ativa: false }, '2026-12-31');
      expect(await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).count()).toBe(0);
      // (nada é "passado" aqui: hoje=2026-07-01 é antes da 1ª ocorrência)
    } finally { vi.useRealTimers(); }
  });

  it('conferência usarValorApp muda o valor do previsto; desmarcar volta à soma', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 8000, parcelas: 1,
      }, '2027-12-31');
      await repo.salvarConferenciaFatura(cartao.id, '2026-08', 10000, true, '2027-12-31');
      let previsto = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      expect(previsto.valor).toBe(10000);
      await repo.salvarConferenciaFatura(cartao.id, '2026-08', 10000, false, '2027-12-31');
      previsto = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-08')!;
      expect(previsto.valor).toBe(8000);
    } finally { vi.useRealTimers(); }
  });

  it('desativar cartão remove os previstos e preserva efetivos e compras', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
        valorTotal: 5000, parcelas: 1,
      }, '2027-12-31');
      await repo.salvarCartao({ ...cartao, ativo: false }, '2027-12-31');
      expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao')).toEqual([]);
      expect(await db.comprasCartao.count()).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/repo.test.ts`
Expected: FAIL (`repo.salvarCartao` não existe).

- [ ] **Step 3: Alargar `materializar`** — em `src/domain/recurrence.ts`, trocar só a assinatura (corpo intacto):

```ts
import { dataComDia } from './dates';
import type { ID, ISODate, Recorrencia, StatusLancamento } from './types';
```

```ts
export function materializar(
  rec: Pick<Recorrencia, 'ativa' | 'dataInicio' | 'diaDoMes' | 'parcelas'>,
  existentes: { id: ID; data: ISODate; status: StatusLancamento }[],
  hoje: ISODate,
  ate: ISODate,
): DiffMaterializacao {
```

- [ ] **Step 4: Implementar o repo** — adicionar em `src/db/repo.ts` (ampliar imports: `calcularFaturas, diffSincronizacao` de `'../domain/fatura'`; tipos `Cartao, CategoriaCartao, CompraCartao, RecorrenciaCartao` de `'../domain/types'`):

```ts
// ---------- Cartão de crédito ----------

export interface NovoCartao {
  boxId: ID; nome: string; diaFechamento: number; diaVencimento: number; categoriaFaturaId: ID;
}

export async function salvarCartao(n: NovoCartao | Cartao, horizonte: ISODate): Promise<Cartao> {
  const agora = agoraISO();
  const cartao: Cartao = 'id' in n
    ? { ...n, alteradoEm: agora }
    : { id: novoId(), ativo: true, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.cartoes, db.config, async () => {
    await db.cartoes.put(cartao);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return cartao;
}

export interface NovaCategoriaCartao { cartaoId: ID; nome: string; ordem: number }

export async function salvarCategoriaCartao(n: NovaCategoriaCartao): Promise<CategoriaCartao> {
  const agora = agoraISO();
  const c: CategoriaCartao = { id: novoId(), arquivada: false, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.add(c);
    await marcarMudanca();
  });
  return c;
}

export async function atualizarCategoriaCartao(
  id: ID,
  patch: Partial<Pick<CategoriaCartao, 'nome' | 'ordem' | 'arquivada'>>,
): Promise<void> {
  await db.transaction('rw', db.categoriasCartao, db.config, async () => {
    await db.categoriasCartao.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

export interface NovaCompraCartao {
  cartaoId: ID; categoriaCartaoId: ID; data: ISODate; valorTotal: number;
  parcelas: number; descricao?: string;
}

export async function salvarCompraCartao(n: NovaCompraCartao, horizonte: ISODate): Promise<CompraCartao> {
  const agora = agoraISO();
  const c: CompraCartao = { id: novoId(), criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.add(c);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return c;
}

export async function atualizarCompraCartao(
  id: ID,
  patch: Partial<Pick<CompraCartao, 'data' | 'valorTotal' | 'parcelas' | 'descricao' | 'categoriaCartaoId'>>,
  horizonte: ISODate,
): Promise<void> {
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function excluirCompraCartao(id: ID, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.delete(id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export interface NovaAssinatura {
  cartaoId: ID; categoriaCartaoId: ID; valor: number; dataInicio: ISODate;
  diaDoMes: number; parcelas: number | null; descricao?: string;
}

export async function salvarAssinatura(
  n: NovaAssinatura | RecorrenciaCartao,
  horizonte: ISODate,
): Promise<RecorrenciaCartao> {
  const agora = agoraISO();
  const ass: RecorrenciaCartao = 'id' in n
    ? { ...n, alteradoEm: agora }
    : { id: novoId(), ativa: true, criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.recorrenciasCartao, db.config, async () => {
    await db.recorrenciasCartao.put(ass);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return ass;
}

export async function excluirAssinatura(id: ID, horizonte: ISODate): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', db.recorrenciasCartao, db.comprasCartao, db.config, async () => {
    const futuras = await db.comprasCartao.where('recorrenciaCartaoId').equals(id)
      .filter((c) => c.data > hoje).primaryKeys();
    await db.comprasCartao.bulkDelete(futuras);
    await db.recorrenciasCartao.delete(id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function salvarConferenciaFatura(
  cartaoId: ID, mes: string, valorAppCent: number, usarValorApp: boolean, horizonte: ISODate,
): Promise<void> {
  await db.transaction('rw', db.conferenciasFatura, db.config, async () => {
    const agora = agoraISO();
    const ex = await db.conferenciasFatura.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.conferenciasFatura.update(ex.id, { valorAppCent, usarValorApp, alteradoEm: agora });
    else {
      await db.conferenciasFatura.add({
        id: novoId(), cartaoId, mes, valorAppCent, usarValorApp, criadoEm: agora, alteradoEm: agora,
      });
    }
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function removerConferenciaFatura(cartaoId: ID, mes: string, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.conferenciasFatura, db.config, async () => {
    const ex = await db.conferenciasFatura.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.conferenciasFatura.delete(ex.id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

/** Materializa CompraCartao futuras da assinatura (reusa o diff de recorrências:
 *  compra passada é história ≈ efetivo; futura acompanha a regra ≈ previsto). */
async function materializarAssinatura(ass: RecorrenciaCartao, hoje: ISODate, ate: ISODate): Promise<void> {
  const existentes = await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id).toArray();
  const diff = materializar(ass, existentes.map((c) => ({
    id: c.id, data: c.data, status: (c.data <= hoje ? 'efetivo' : 'previsto') as StatusLancamento,
  })), hoje, ate);
  const agora = agoraISO();
  await db.comprasCartao.bulkDelete(diff.excluirIds);
  await db.comprasCartao.bulkAdd(diff.criarDatas.map((data): CompraCartao => ({
    id: novoId(), cartaoId: ass.cartaoId, categoriaCartaoId: ass.categoriaCartaoId,
    data, valorTotal: ass.valor, parcelas: 1,
    ...(ass.descricao ? { descricao: ass.descricao } : {}),
    recorrenciaCartaoId: ass.id, criadoEm: agora, alteradoEm: agora,
  })));
  await db.comprasCartao.where('recorrenciaCartaoId').equals(ass.id)
    .filter((c) => c.data > hoje)
    .modify((c) => {
      c.valorTotal = ass.valor;
      c.categoriaCartaoId = ass.categoriaCartaoId;
      if (ass.descricao) c.descricao = ass.descricao;
      c.alteradoEm = agora;
    });
}

/** Materializa assinaturas e sincroniza os lançamentos de fatura de todos os cartões. */
export async function sincronizarCartoes(horizonte: ISODate): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', [
    db.cartoes, db.comprasCartao, db.recorrenciasCartao, db.conferenciasFatura, db.lancamentos,
  ], async () => {
    for (const ass of await db.recorrenciasCartao.toArray()) {
      await materializarAssinatura(ass, hoje, horizonte);
    }
    for (const cartao of await db.cartoes.toArray()) {
      const [compras, conferencias, existentes] = await Promise.all([
        db.comprasCartao.where('cartaoId').equals(cartao.id).toArray(),
        db.conferenciasFatura.where('cartaoId').equals(cartao.id).toArray(),
        db.lancamentos.where('cartaoId').equals(cartao.id).toArray(),
      ]);
      const faturas = calcularFaturas(cartao, compras, horizonte);
      const diff = diffSincronizacao(cartao, faturas, conferencias, existentes, hoje);
      const agora = agoraISO();
      await db.lancamentos.bulkDelete(diff.excluirIds);
      for (const a of diff.atualizar) {
        await db.lancamentos.update(a.id, { valor: a.valor, data: a.data, alteradoEm: agora });
      }
      await db.lancamentos.bulkAdd(diff.criar.map((n): Lancamento => ({
        id: novoId(), boxId: cartao.boxId, categoriaId: cartao.categoriaFaturaId,
        data: n.data, valor: n.valor, status: 'previsto', origem: 'cartao',
        cartaoId: cartao.id, faturaMes: n.faturaMes,
        criadoEm: agora, alteradoEm: agora,
      })));
    }
  });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/db/repo.test.ts` e depois `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/recurrence.ts src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(cartao): repo com CRUD, assinaturas materializadas e sincronização fatura→Flow"
```

---

### Task 7: Sincronização no boot

**Files:**
- Modify: `src/state/store.ts` (método `iniciar`)
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `repo.sincronizarCartoes(horizonte)` da Task 6.

- [ ] **Step 1: Escrever o teste que falha** (adicionar em `src/state/store.test.ts`):

```ts
it('boot sincroniza faturas de cartão montado direto no banco', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await db.boxes.add(box);
    const catFlow = { id: novoId(), boxId: box.id, nome: 'cartão', tipo: 'gasto' as const, ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora };
    await db.categorias.add(catFlow);
    const cartao = { id: novoId(), boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id, ativo: true, criadoEm: agora, alteradoEm: agora };
    await db.cartoes.add(cartao);
    const catCartao = { id: novoId(), cartaoId: cartao.id, nome: 'mercado', ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora };
    await db.categoriasCartao.add(catCartao);
    await db.comprasCartao.add({
      id: novoId(), cartaoId: cartao.id, categoriaCartaoId: catCartao.id,
      data: '2026-07-10', valorTotal: 5000, parcelas: 1, criadoEm: agora, alteradoEm: agora,
    });

    await useApp.getState().iniciar();

    const previstos = useApp.getState().dados!.lancamentos.filter((l) => l.origem === 'cartao');
    expect(previstos).toHaveLength(1);
    expect(previstos[0]).toMatchObject({ faturaMes: '2026-08', data: '2026-08-05', valor: 5000, status: 'previsto' });
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL (0 previstos — boot não sincroniza).

- [ ] **Step 3: Implementar** — em `src/state/store.ts`, dentro de `iniciar()`, logo após `await repo.materializarTodas(...)`:

```ts
    await repo.sincronizarCartoes(inicial.config.horizonteProjecao);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(cartao): boot sincroniza faturas dos cartões"
```

---

### Task 8: Backup schema 2

**Files:**
- Modify: `src/backup/backup.ts`
- Test: `src/backup/backup.test.ts`

**Interfaces:**
- Produces: `Backup.schema: 2`; `validarBackup` aceita schema 1 (preenche tabelas do cartão vazias) e 2; rejeita o resto; `mesclar` cobre as 5 tabelas novas.

- [ ] **Step 1: Escrever os testes que falham** (adicionar em `src/backup/backup.test.ts`; se o arquivo já tiver um builder de `Dados`, acrescentar as tabelas novas a ele e usá-lo no lugar deste):

```ts
import type { Dados } from '../domain/types';

function dadosVazios(): Dados {
  return {
    boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
    conferenciasFatura: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
  };
}

it('gerarBackup emite schema 2', () => {
  const b = gerarBackup(dadosVazios());
  expect(b.schema).toBe(2);
});

it('aceita backup schema 1 preenchendo as tabelas do cartão vazias', () => {
  const v1 = {
    app: 'flow', schema: 1, exportadoEm: '2026-01-01T00:00:00Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      config: { id: 'config' },
    },
  };
  const b = validarBackup(v1);
  expect(b.schema).toBe(2);
  expect(b.dados.cartoes).toEqual([]);
  expect(b.dados.conferenciasFatura).toEqual([]);
});

it('rejeita schema desconhecido', () => {
  expect(() => validarBackup({ app: 'flow', schema: 3, dados: {} }))
    .toThrow(/versão incompatível/);
});

it('mescla cartões e compras pelo alteradoEm mais recente', () => {
  const a = dadosVazios();
  const b = dadosVazios();
  const base = { boxId: 'b', nome: 'Nu', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: 'c', ativo: true, criadoEm: '2026-01-01' };
  a.cartoes = [{ ...base, id: 'k1', nome: 'Velho', alteradoEm: '2026-01-01' }];
  b.cartoes = [{ ...base, id: 'k1', nome: 'Novo', alteradoEm: '2026-02-01' }];
  expect(mesclar(a, b).cartoes[0].nome).toBe('Novo');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/backup/backup.test.ts`
Expected: FAIL (schema é 1; `dados.cartoes` undefined em schema 1).

- [ ] **Step 3: Implementar** — `src/backup/backup.ts` completo:

```ts
import type { Dados } from '../domain/types';

export interface Backup {
  app: 'flow';
  schema: 2;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 2, exportadoEm: new Date().toISOString(), dados };
}

const TABELAS_V1 = ['boxes', 'categorias', 'lancamentos', 'recorrencias', 'cenarios'] as const;
const TABELAS_CARTAO = [
  'cartoes', 'categoriasCartao', 'comprasCartao', 'recorrenciasCartao', 'conferenciasFatura',
] as const;

export function validarBackup(json: unknown): Backup {
  const b = json as { app?: unknown; schema?: unknown; exportadoEm?: unknown; dados?: Record<string, unknown> } | null;
  if (!b || typeof b !== 'object' || b.app !== 'flow') {
    throw new Error('Este arquivo não é um backup do Flow.');
  }
  if (b.schema !== 1 && b.schema !== 2) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
  const d = b.dados;
  if (!d || TABELAS_V1.some((t) => !Array.isArray(d[t])) || typeof d.config !== 'object') {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  if (b.schema === 2 && TABELAS_CARTAO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  const dados = { ...d } as unknown as Dados;
  if (b.schema === 1) {
    // backup antigo: tabelas do cartão nasceram depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_CARTAO) md[t] = [];
  }
  return {
    app: 'flow', schema: 2,
    exportadoEm: typeof b.exportadoEm === 'string' ? b.exportadoEm : new Date().toISOString(),
    dados,
  };
}

/** Mescla por id; em conflito vence o alteradoEm mais recente. Config local é mantida. */
export function mesclar(atual: Dados, doBackup: Dados): Dados {
  function mesclarTabela<T extends { id: string; alteradoEm: string }>(a: T[], b: T[]): T[] {
    const porId = new Map(a.map((x) => [x.id, x]));
    for (const x of b) {
      const existente = porId.get(x.id);
      if (!existente || x.alteradoEm > existente.alteradoEm) porId.set(x.id, x);
    }
    return [...porId.values()];
  }
  return {
    boxes: mesclarTabela(atual.boxes, doBackup.boxes),
    categorias: mesclarTabela(atual.categorias, doBackup.categorias),
    lancamentos: mesclarTabela(atual.lancamentos, doBackup.lancamentos),
    recorrencias: mesclarTabela(atual.recorrencias, doBackup.recorrencias),
    cenarios: mesclarTabela(atual.cenarios, doBackup.cenarios),
    cartoes: mesclarTabela(atual.cartoes, doBackup.cartoes),
    categoriasCartao: mesclarTabela(atual.categoriasCartao, doBackup.categoriasCartao),
    comprasCartao: mesclarTabela(atual.comprasCartao, doBackup.comprasCartao),
    recorrenciasCartao: mesclarTabela(atual.recorrenciasCartao, doBackup.recorrenciasCartao),
    conferenciasFatura: mesclarTabela(atual.conferenciasFatura, doBackup.conferenciasFatura),
    config: atual.config,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/backup/backup.test.ts` e `npm test`
Expected: PASS (inclui `Backup.tsx` e testes existentes intactos).

- [ ] **Step 5: Commit**

```bash
git add src/backup
git commit -m "feat(cartao): backup schema 2 com tabelas do cartão; aceita schema 1"
```

---

### Task 9: Aba Cartão — Shell + TelaCartao

**Files:**
- Modify: `src/state/store.ts` (tipo `Aba`)
- Modify: `src/ui/Shell.tsx`
- Create: `src/ui/TelaCartao.tsx`
- Test: `src/ui/TelaCartao.test.tsx` (criar)

**Interfaces:**
- Consumes: `calcularFaturas`, `datasFaturaDoMes`, `mesFaturaDaCompra`, tipo `Fatura` de `../domain/fatura`; repo da Task 6.

- [ ] **Step 1: Escrever os testes que falham** — `src/ui/TelaCartao.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaCartao from './TelaCartao';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}

it('box sem cartão oferece cadastro', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
  render(<TelaCartao />);
  expect(screen.getByText(/Nenhum cartão cadastrado/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cadastrar cartão' })).toBeInTheDocument();
});

it('adiciona compra parcelada e navega entre faturas', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.click(screen.getByRole('button', { name: '+ compra' }));
    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), screen.getByRole('option', { name: 'mercado' }));
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // fatura padrão = 08/2026 (compra 2026-07-01, fecha 28/07, vence 05/08): parcela 1
    expect(await screen.findByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getAllByText(/33,34/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
    expect(await screen.findByText(/2\/3/)).toBeInTheDocument();
    expect(screen.getAllByText(/33,33/).length).toBeGreaterThan(0);
  } finally { vi.useRealTimers(); }
});

it('conferência mostra a diferença e a caixa troca o valor do previsto', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 8000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.type(screen.getByLabelText('Valor no app do banco'), '100,00');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência' }));
    expect(await screen.findByText(/Falta bater/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*20,00/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/usar este valor no Flow/));
    await vi.waitFor(async () => {
      const previsto = (await db.lancamentos.toArray()).find((l) => l.origem === 'cartao');
      expect(previsto?.valor).toBe(10000);
    });
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/TelaCartao.test.tsx`
Expected: FAIL ("Cannot find module './TelaCartao'").

- [ ] **Step 3: Implementar aba e navegação**

Em `src/state/store.ts`:

```ts
export type Aba = 'hoje' | 'fluxo' | 'lancar' | 'cartao' | 'analises' | 'simulador' | 'ajustes';
```

Em `src/ui/Shell.tsx` — importar `TelaCartao` e:

```ts
const ABAS: { id: Aba; rotulo: string; central?: boolean }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'fluxo', rotulo: 'Fluxo' },
  { id: 'lancar', rotulo: '+', central: true },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'analises', rotulo: 'Análises' },
  { id: 'simulador', rotulo: 'Simular' },
];
```

E no corpo, junto das outras telas:

```tsx
          {aba === 'cartao' && <TelaCartao />}
```

- [ ] **Step 4: Implementar a tela** — `src/ui/TelaCartao.tsx`:

```tsx
import { useState } from 'react';
import * as repo from '../db/repo';
import { addMeses } from '../domain/dates';
import {
  calcularFaturas, datasFaturaDoMes, mesFaturaDaCompra, type Fatura,
} from '../domain/fatura';
import { formatarBRL, parseValorDigitado } from '../domain/money';
import type { Cartao, CompraCartao } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';

function centavosParaTexto(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

function fmtDia(d: string): string {
  const [, m, dia] = d.split('-');
  return `${dia}/${m}`;
}

function FormCompra({ cartao, compra, onFechar }: {
  cartao: Cartao; compra?: CompraCartao; onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra ? centavosParaTexto(compra.valorTotal) : '');
  const [data, setData] = useState(compra?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState(compra?.categoriaCartaoId ?? '');
  const [parcelas, setParcelas] = useState(compra ? String(compra.parcelas) : '1');
  const [descricao, setDescricao] = useState(compra?.descricao ?? '');
  if (!dados) return null;
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartao.id && !c.arquivada);
  const horizonte = dados.config.horizonteProjecao;

  async function salvar() {
    const cents = parseValorDigitado(valor);
    const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));
    if (cents == null || !categoriaId) return;
    const campos = {
      data, valorTotal: cents, parcelas: parcelasNum, categoriaCartaoId: categoriaId,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
    };
    if (compra) await repo.atualizarCompraCartao(compra.id, campos, horizonte);
    else await repo.salvarCompraCartao({ cartaoId: cartao.id, ...campos }, horizonte);
    await recarregar();
    onFechar();
  }

  async function excluir() {
    if (!compra) return;
    if (!window.confirm('Excluir a compra e todas as suas parcelas?')) return;
    await repo.excluirCompraCartao(compra.id, horizonte);
    await recarregar();
    onFechar();
  }

  return (
    <div className="card">
      <h3>{compra ? 'Editar compra' : 'Nova compra'}</h3>
      <div className="linha">
        <input aria-label="Valor" placeholder="valor" inputMode="decimal" value={valor}
          onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        <input aria-label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <select aria-label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input aria-label="Parcelas" type="number" min={1} max={48} value={parcelas}
          onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
      </div>
      <div className="linha">
        <input aria-label="Descrição" placeholder="descrição (opcional)" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} className="cresce" />
        <button className="botao botao-primario" onClick={salvar}>Salvar</button>
        <button className="botao" onClick={onFechar}>Cancelar</button>
        {compra && <button className="botao botao-perigo" onClick={excluir}>Excluir</button>}
      </div>
    </div>
  );
}

function BlocoConferencia({ cartao, mes, totalCent }: { cartao: Cartao; mes: string; totalCent: number }) {
  const { dados, recarregar } = useApp();
  const conf = dados?.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const [valor, setValor] = useState(conf ? centavosParaTexto(conf.valorAppCent) : '');
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;

  async function salvar() {
    if (!valor.trim()) {
      if (conf) {
        await repo.removerConferenciaFatura(cartao.id, mes, horizonte);
        await recarregar();
      }
      return;
    }
    const cents = parseValorDigitado(valor);
    if (cents == null) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, cents, conf?.usarValorApp ?? false, horizonte);
    await recarregar();
  }

  async function alternarUsar(usar: boolean) {
    if (!conf) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, conf.valorAppCent, usar, horizonte);
    await recarregar();
  }

  const diff = conf != null ? conf.valorAppCent - totalCent : null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="linha">
        <input aria-label="Valor no app do banco" placeholder="valor no app do banco" inputMode="decimal"
          value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 140 }} />
        <button className="botao" aria-label="Salvar conferência" onClick={salvar}>Salvar</button>
      </div>
      {diff != null && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          {diff === 0
            ? '✓ Batido com o app.'
            : diff > 0
              ? `Falta bater ${formatarBRL(diff)} — tem gasto ainda não lançado aqui.`
              : `Itens somam ${formatarBRL(-diff)} a mais que o app.`}
        </p>
      )}
      {conf && (
        <label className="sub" style={{ display: 'block', marginTop: 4 }}>
          <input type="checkbox" checked={conf.usarValorApp}
            onChange={(e) => alternarUsar(e.target.checked)} />
          {' '}usar este valor no Flow
        </label>
      )}
    </div>
  );
}

function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<CompraCartao | null>(null);
  if (!dados) return null;

  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes);
  const ate = dataVencimento > dados.config.horizonteProjecao ? dataVencimento : dados.config.horizonteProjecao;
  const fatura: Fatura = calcularFaturas(cartao, compras, ate).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };

  const nomeCat = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const porCategoria = new Map<string, number>();
  for (const i of fatura.itens) {
    porCategoria.set(i.categoriaCartaoId, (porCategoria.get(i.categoriaCartaoId) ?? 0) + i.valorCent);
  }
  const resumo = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="card">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button className="botao" aria-label="Mês anterior" onClick={() => setMes(addMeses(mes, -1))}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p className="sub" style={{ margin: 0 }}>{cartao.nome} · fatura {mes.split('-').reverse().join('/')}</p>
          <p className="saldo-grande" style={{ margin: '4px 0' }}>{formatarBRL(fatura.totalCent)}</p>
          <p className="sub" style={{ margin: 0 }}>
            fecha {fmtDia(fatura.dataFechamento)} · vence {fmtDia(fatura.dataVencimento)}
          </p>
        </div>
        <button className="botao" aria-label="Mês seguinte" onClick={() => setMes(addMeses(mes, 1))}>›</button>
      </div>
      <BlocoConferencia key={`${cartao.id}:${mes}`} cartao={cartao} mes={mes} totalCent={fatura.totalCent} />
      {resumo.length > 1 && (
        <div style={{ marginTop: 8 }}>
          {resumo.map(([catId, cent]) => (
            <p className="sub" key={catId} style={{ margin: 0 }}>{nomeCat(catId)}: {formatarBRL(cent)}</p>
          ))}
        </div>
      )}
      <div className="lista" style={{ marginTop: 8 }}>
        {fatura.itens.map((i) => (
          <button className="item" key={`${i.compraId}:${i.parcela}`}
            style={{ cursor: 'pointer', textAlign: 'left' }}
            onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)}>
            <div className="cresce">
              <div>{i.descricao ?? nomeCat(i.categoriaCartaoId)}</div>
              <div className="sub">
                {i.data.split('-').reverse().join('/')} · {nomeCat(i.categoriaCartaoId)}
                {i.totalParcelas > 1 ? ` · ${i.parcela}/${i.totalParcelas}` : ''}
              </div>
            </div>
            <span className="valor-gasto">{formatarBRL(i.valorCent)}</span>
          </button>
        ))}
        {fatura.itens.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
      </div>
      {(formAberto || editando) ? (
        <FormCompra cartao={cartao} compra={editando ?? undefined}
          onFechar={() => { setFormAberto(false); setEditando(null); }} />
      ) : (
        <button className="botao botao-primario" style={{ marginTop: 8 }}
          onClick={() => setFormAberto(true)}>+ compra</button>
      )}
    </div>
  );
}

export default function TelaCartao() {
  const { dados, boxSel, setAba } = useApp();
  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoes = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));
  if (cartoes.length === 0) {
    return (
      <div className="tela">
        <h2>Cartão</h2>
        <p className="sub">Nenhum cartão cadastrado para esta seleção.</p>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-start' }}
          onClick={() => setAba('ajustes')}>Cadastrar cartão</button>
      </div>
    );
  }
  return (
    <div className="tela">
      {cartoes.map((c) => <CartaoFatura key={c.id} cartao={c} />)}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/ui/TelaCartao.test.tsx` e `npm test`
Expected: PASS (incluindo `App.test.tsx`/`Shell` intactos).

- [ ] **Step 6: Commit**

```bash
git add src/state/store.ts src/ui/Shell.tsx src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx
git commit -m "feat(cartao): aba Cartão com fatura, compras parceladas e conferência do app"
```

---

### Task 10: Ajustes — Cartões, Categorias do cartão e Assinaturas

**Files:**
- Create: `src/ui/ajustes/Cartoes.tsx`
- Create: `src/ui/ajustes/CategoriasCartao.tsx`
- Create: `src/ui/ajustes/Assinaturas.tsx`
- Modify: `src/ui/TelaAjustes.tsx`
- Test: `src/ui/ajustes/Cartoes.test.tsx` (criar)

**Interfaces:**
- Consumes: repo da Task 6.

- [ ] **Step 1: Escrever os testes que falham** — `src/ui/ajustes/Cartoes.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Cartoes from './Cartoes';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  return { box, cat };
}

it('cadastra um cartão com a categoria "cartão" pré-selecionada', async () => {
  const { box, cat } = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(1);
  expect(cartoes[0]).toMatchObject({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    categoriaFaturaId: cat.id, ativo: true,
  });
});

it('impede segundo cartão ativo na mesma box', async () => {
  const { box, cat } = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: cat.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Inter');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText(/já tem um cartão ativo/)).toBeInTheDocument();
  expect(await db.cartoes.count()).toBe(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: FAIL ("Cannot find module './Cartoes'").

- [ ] **Step 3: Implementar `Cartoes.tsx`**:

```tsx
import { useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function Cartoes() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState(dados?.boxes.find((b) => b.saldoInicial != null)?.id ?? '');
  const [nome, setNome] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('28');
  const [diaVencimento, setDiaVencimento] = useState('5');
  const [categoriaFaturaId, setCategoriaFaturaId] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const catsGasto = dados.categorias.filter((c) => c.boxId === boxId && c.tipo === 'gasto' && !c.arquivada);
  const categoriaPadrao = catsGasto.find((c) => c.nome === 'cartão')?.id ?? '';
  const catSel = categoriaFaturaId || categoriaPadrao;
  const nomeBox = (id: string) => dados.boxes.find((b) => b.id === id)?.nome ?? '?';

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  function editar(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    setEditandoId(id); setBoxId(c.boxId); setNome(c.nome);
    setDiaFechamento(String(c.diaFechamento)); setDiaVencimento(String(c.diaVencimento));
    setCategoriaFaturaId(c.categoriaFaturaId); setAviso('');
  }

  async function salvar() {
    if (!nome.trim() || !catSel || !boxId) return;
    if (dados!.cartoes.some((c) => c.boxId === boxId && c.ativo && c.id !== editandoId)) {
      setAviso('Esta box já tem um cartão ativo — desative-o antes de cadastrar outro.');
      return;
    }
    const campos = {
      boxId, nome: nome.trim(), diaFechamento: clampDia(diaFechamento),
      diaVencimento: clampDia(diaVencimento), categoriaFaturaId: catSel,
    };
    if (editandoId) {
      const original = dados!.cartoes.find((c) => c.id === editandoId)!;
      await repo.salvarCartao({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarCartao(campos, horizonte);
    }
    setEditandoId(null); setNome(''); setCategoriaFaturaId(''); setAviso('');
    await recarregar();
  }

  async function alternarAtivo(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    if (!c.ativo && dados!.cartoes.some((x) => x.boxId === c.boxId && x.ativo && x.id !== id)) {
      setAviso('Esta box já tem um cartão ativo.');
      return;
    }
    await repo.salvarCartao({ ...c, ativo: !c.ativo }, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Cartões</h2>
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
      <h2>{editandoId ? 'Editar cartão' : 'Novo cartão'}</h2>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="linha">
        <select aria-label="Box do cartão" value={boxId}
          onChange={(e) => { setBoxId(e.target.value); setCategoriaFaturaId(''); }}>
          {dados.boxes.filter((b) => b.saldoInicial != null).map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        <input aria-label="Nome do cartão" placeholder="nome (ex.: Nubank)" value={nome}
          onChange={(e) => setNome(e.target.value)} className="cresce" />
      </div>
      <div className="linha">
        <input aria-label="Dia de fechamento" type="number" min={1} max={31} value={diaFechamento}
          onChange={(e) => setDiaFechamento(e.target.value)} style={{ width: 64 }} />
        <input aria-label="Dia de vencimento" type="number" min={1} max={31} value={diaVencimento}
          onChange={(e) => setDiaVencimento(e.target.value)} style={{ width: 64 }} />
        <select aria-label="Categoria da fatura" value={catSel}
          onChange={(e) => setCategoriaFaturaId(e.target.value)}>
          <option value="">categoria da fatura…</option>
          {catsGasto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button className="botao botao-primario" onClick={salvar}>
          {editandoId ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implementar `CategoriasCartao.tsx`** (espelho de `Categorias.tsx`, sem tipo — itens de cartão são sempre gasto):

```tsx
import { useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function CategoriasCartao() {
  const { dados, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Categorias do cartão</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const cats = dados.categoriasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .sort((a, b) => a.ordem - b.ordem);

  async function criar() {
    if (!nome.trim() || !cartaoId) return;
    const ordem = Math.max(-1, ...cats.map((c) => c.ordem)) + 1;
    await repo.salvarCategoriaCartao({ cartaoId, nome: nome.trim(), ordem });
    await recarregar();
    setNome('');
  }

  async function mover(id: string, direcao: -1 | 1) {
    const cat = cats.find((c) => c.id === id)!;
    const i = cats.findIndex((c) => c.id === id);
    const alvo = cats[i + direcao];
    if (!alvo) return;
    await repo.atualizarCategoriaCartao(cat.id, { ordem: alvo.ordem });
    await repo.atualizarCategoriaCartao(alvo.id, { ordem: cat.ordem });
    await recarregar();
  }

  async function alternarArquivada(id: string, arquivada: boolean) {
    await repo.atualizarCategoriaCartao(id, { arquivada: !arquivada });
    await recarregar();
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return;
    await repo.atualizarCategoriaCartao(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Categorias do cartão</h2>
      <select aria-label="Cartão" value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
        {dados.cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div className="lista">
        {cats.map((c) => (
          <div className="item" key={c.id} style={{ opacity: c.arquivada ? 0.5 : 1 }}>
            {editandoId === c.id ? (
              <>
                <input aria-label="Editar nome" className="cresce" value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)} />
                <button className="botao botao-primario" onClick={salvarEdicao}>Salvar</button>
                <button className="botao" onClick={() => { setEditandoId(null); setNomeEdit(''); }}>Cancelar</button>
              </>
            ) : (
              <>
                <span className="cresce">
                  {c.nome}{c.arquivada && <span className="badge"> arquivada</span>}
                </span>
                <button className="botao" aria-label="Subir" onClick={() => mover(c.id, -1)}>↑</button>
                <button className="botao" aria-label="Descer" onClick={() => mover(c.id, 1)}>↓</button>
                <button className="botao" aria-label="Editar"
                  onClick={() => { setEditandoId(c.id); setNomeEdit(c.nome); }}>✏️</button>
                <button className="botao" onClick={() => alternarArquivada(c.id, c.arquivada)}>
                  {c.arquivada ? 'Restaurar' : 'Arquivar'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="linha">
        <input aria-label="Nova categoria do cartão" placeholder="nova categoria" value={nome}
          onChange={(e) => setNome(e.target.value)} style={{ flex: 1 }} />
        <button className="botao botao-primario" onClick={criar}>Criar</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implementar `Assinaturas.tsx`** (espelho de `Recorrencias.tsx` para o cartão):

```tsx
import { useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL, parseValorDigitado } from '../../domain/money';
import { useApp } from '../../state/store';

export default function Assinaturas() {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Assinaturas</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const horizonte = dados.config.horizonteProjecao;
  const nomeCat = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const cartaoDe = (catId: string) => dados.categoriasCartao.find((c) => c.id === catId)?.cartaoId;

  function limparForm() {
    setValor(''); setCategoriaId(''); setDataInicio(hoje); setDiaDoMes('1');
    setParcelas(''); setDescricao(''); setEditandoId(null);
  }

  function editar(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    setEditandoId(id);
    setValor((a.valor / 100).toFixed(2).replace('.', ','));
    setCategoriaId(a.categoriaCartaoId);
    setDataInicio(a.dataInicio);
    setDiaDoMes(String(a.diaDoMes));
    setParcelas(a.parcelas != null ? String(a.parcelas) : '');
    setDescricao(a.descricao ?? '');
  }

  async function salvar() {
    const cents = parseValorDigitado(valor);
    const cartaoId = cartaoDe(categoriaId);
    if (cents == null || !cartaoId) return;
    const campos = {
      cartaoId, categoriaCartaoId: categoriaId, valor: cents, dataInicio,
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
      <h2>Assinaturas do cartão</h2>
      <div className="lista">
        {dados.recorrenciasCartao.map((a) => (
          <div className="item" key={a.id} style={{ opacity: a.ativa ? 1 : 0.5 }}>
            <div className="cresce">
              {a.descricao ?? nomeCat(a.categoriaCartaoId)}
              <div className="sub">
                dia {a.diaDoMes} · {a.parcelas == null ? 'sem fim' : `${a.parcelas}x`} · desde {a.dataInicio}
              </div>
            </div>
            <span>{formatarBRL(a.valor)}</span>
            <button className="botao" onClick={() => editar(a.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtiva(a.id)}>{a.ativa ? 'Pausar' : 'Ativar'}</button>
            <button className="botao botao-perigo" onClick={() => excluir(a.id)}>Excluir</button>
          </div>
        ))}
        {dados.recorrenciasCartao.length === 0 && <p className="sub">Nenhuma assinatura.</p>}
      </div>
      <h2>{editandoId ? 'Editar assinatura' : 'Nova assinatura'}</h2>
      <div className="linha">
        <input aria-label="Valor" placeholder="valor" inputMode="decimal" value={valor}
          onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        <select aria-label="Categoria do cartão" value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {dados.categoriasCartao.filter((c) => !c.arquivada).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({dados.cartoes.find((k) => k.id === c.cartaoId)?.nome ?? '?'})
            </option>
          ))}
        </select>
        <input aria-label="Início" type="date" value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)} />
        <input aria-label="Dia do mês" type="number" min={1} max={31} value={diaDoMes}
          onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        <input aria-label="Parcelas" type="number" min={1} placeholder="∞" value={parcelas}
          onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
      </div>
      <div className="linha">
        <input aria-label="Descrição" placeholder="descrição (ex.: Netflix)" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} className="cresce" />
        <button className="botao botao-primario" onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
        {editandoId && <button className="botao" onClick={limparForm}>Cancelar</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Ligar no menu de Ajustes** — em `src/ui/TelaAjustes.tsx`:

```tsx
import Assinaturas from './ajustes/Assinaturas';
import Cartoes from './ajustes/Cartoes';
import CategoriasCartao from './ajustes/CategoriasCartao';
```

```ts
type Secao = 'menu' | 'categorias' | 'recorrencias' | 'boxes' | 'cartoes'
  | 'categoriasCartao' | 'assinaturas' | 'backup' | 'importar';

const ITENS: { id: Secao; rotulo: string }[] = [
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'recorrencias', rotulo: 'Recorrências' },
  { id: 'boxes', rotulo: 'Boxes' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'categoriasCartao', rotulo: 'Categorias do cartão' },
  { id: 'assinaturas', rotulo: 'Assinaturas do cartão' },
  { id: 'backup', rotulo: 'Backup e restauração' },
  { id: 'importar', rotulo: 'Importar planilha' },
];
```

E no corpo:

```tsx
      {secao === 'cartoes' && <Cartoes />}
      {secao === 'categoriasCartao' && <CategoriasCartao />}
      {secao === 'assinaturas' && <Assinaturas />}
```

- [ ] **Step 7: Rodar tudo e ver passar**

Run: `npm test` e `npx tsc -b`
Expected: PASS / sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat(cartao): ajustes de cartões, categorias do cartão e assinaturas"
```

---

## Verificação final (após a última task)

- [ ] `npm test` — suíte inteira verde.
- [ ] `npx tsc -b` — sem erros de tipo.
- [ ] `npm run build` — build de produção ok (PWA).
- [ ] Fumaça manual (`npm run preview -- --host`, preferência do usuário: deixar rodando para teste no celular): cadastrar cartão nos Ajustes → lançar compra 3x na aba Cartão → ver previstos no Fluxo → digitar valor do app e marcar a caixa → conferir que o previsto mudou.

## Notas para o implementador

- **Nunca** somar compras do cartão no motor de projeção; só o lançamento da fatura (origem `'cartao'`) entra no Flow. `projection.ts` e `aggregations.ts` não mudam.
- Lançamentos de fatura aparecem no Fluxo/LancEditor como qualquer previsto; se o usuário editar valor por lá, a próxima sincronização realinha com a fatura (mesma semântica dos previstos de recorrência). Confirmação com ajuste de valor é pelo fluxo de pendentes (`confirmarPendente`), que os congela como efetivos.
- A exclusão definitiva de cartão não tem UI (só desativar); desativar remove previstos e preserva compras e efetivos.
- O import da planilha (`importer/`) não muda.
