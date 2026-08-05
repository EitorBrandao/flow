# Bancos dentro da box (entrega 1) — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox
> (`- [ ]`) para acompanhamento.

**Objetivo:** permitir cadastrar bancos dentro de uma box e informar o saldo real de cada um,
com a conferência da tela Hoje comparando a soma contra o saldo que o Flow projeta.

**Arquitetura:** entidade nova `Banco` numa tabela Dexie nova (v4), puramente aditiva —
nenhum dado existente é migrado e lançamento não muda. Box sem banco cadastrado se comporta
exatamente como hoje, usando o `saldoDeclaradoCent` que já vive na `Box`.

**Stack:** React 18 + TypeScript + Vite, Zustand, Dexie, Vitest + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-08-05-bancos-na-box-design.md` — leia antes de começar.

## Restrições globais

- Valores monetários são **centavos inteiros**; datas são strings ISO `"AAAA-MM-DD"`.
- Código, UI, comentários e mensagens de commit em **português**.
- **Nunca commitar dados financeiros reais** — testes e fixtures usam só dados sintéticos.
- Nova `this.version(n)` no Dexie exige **teste do caminho de upgrade no mesmo commit**.
- Mudança em `src/backup/` exige **testes adversariais**; `validarBackup` só endurece.
- Edição de UI exige consultar `docs/estilo-visual.md` e o capítulo do nível antes do código.
  Classe ou componente novo se cataloga em `docs/estilo/catalogo.md` **no mesmo commit**.
- Não editar `package.json` (`version`) nem o topo do `CHANGELOG.md` — a versão sai na
  integração, via `npm run release`.
- Rodar a suíte inteira (`npm test`), nunca só o arquivo tocado.
- Trabalhar no worktree `.worktrees/bancos`, branch `bancos`. Nunca na `main`.

---

### Tarefa 1: entidade `Banco` e schema Dexie v4

**Arquivos:**
- Modificar: `src/domain/types.ts`
- Modificar: `src/db/database.ts`
- Testar: `src/db/database.test.ts`

**Interfaces:**
- Produz: `interface Banco`, `Dados.bancos: Banco[]`, `Cartao.bancoId?: ID`, tabela
  `db.bancos` com índice `boxId`, `FlowDB.verno === 4`.

- [ ] **Passo 1: escrever o teste de upgrade que falha**

Em `src/db/database.test.ts`, junto dos outros literais históricos, adicione o schema da v3
(ele é história congelada a partir de agora — nunca mude este literal):

```ts
/** Schema da v3 do FlowDB — literal, histórico, nunca mude. */
const SCHEMA_V3 = {
  boxes: 'id',
  categorias: 'id, boxId',
  lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
  recorrencias: 'id, boxId, origem',
  cenarios: 'id',
  config: 'id',
  cartoes: 'id, boxId',
  categoriasCartao: 'id, cartaoId',
  comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
  recorrenciasCartao: 'id, cartaoId',
  conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
  viagens: 'id, dataInicio, dataFim',
};
```

E, dentro do `describe('caminho de upgrade do schema Dexie (FlowDB real)')`:

```ts
it('salto v3 → v4: dados sobrevivem e bancos nasce vazia', async () => {
  const nome = `flow-teste-v3-${novoId()}`;
  const { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config } = dadosBase();
  const { cartao, categoriaCartao, compraCartao, recorrenciaCartao, conferenciaFatura } = dadosCartao(box.id);

  const antigo = new Dexie(nome);
  antigo.version(1).stores(SCHEMA_V1);
  antigo.version(2).stores(SCHEMA_V2);
  antigo.version(3).stores(SCHEMA_V3);
  try {
    await antigo.open();
    await antigo.table('boxes').add(box);
    await antigo.table('categorias').bulkAdd([categoriaGanho, categoriaGasto]);
    await antigo.table('lancamentos').bulkAdd([lancamentoEfetivo, lancamentoPrevisto]);
    await antigo.table('recorrencias').add(recorrencia);
    await antigo.table('cenarios').add(cenario);
    await antigo.table('config').put(config);
    await antigo.table('cartoes').add(cartao);
    await antigo.table('categoriasCartao').add(categoriaCartao);
    await antigo.table('comprasCartao').add(compraCartao);
    await antigo.table('recorrenciasCartao').add(recorrenciaCartao);
    await antigo.table('conferenciasFatura').add(conferenciaFatura);
  } finally {
    await antigo.close();
  }

  const flow = new FlowDB(nome);
  try {
    await flow.open();
    expect(flow.verno).toBe(4);

    expect(await flow.boxes.get(box.id)).toEqual(box);
    expect(await flow.lancamentos.get(lancamentoEfetivo.id)).toEqual(lancamentoEfetivo);
    expect(await flow.cartoes.get(cartao.id)).toEqual(cartao);
    expect(await flow.comprasCartao.get(compraCartao.id)).toEqual(compraCartao);
    expect(await flow.conferenciasFatura.get(conferenciaFatura.id)).toEqual(conferenciaFatura);
    expect(await flow.config.get('config')).toEqual(config);

    await expect(flow.bancos.count()).resolves.toBe(0);
  } finally {
    await flow.close();
    await Dexie.delete(nome);
  }
});
```

Os testes de salto v1→v3 e v2→v3 que já existem passam a testar v1→v4 e v2→v4. Atualize os
dois `expect(flow.verno).toBe(3)` para `toBe(4)` e acrescente a cada um
`await expect(flow.bancos.count()).resolves.toBe(0);`.

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/db/database.test.ts`
Esperado: FALHA com `Property 'bancos' does not exist on type 'FlowDB'`.

- [ ] **Passo 3: declarar a entidade**

Em `src/domain/types.ts`, depois de `Box`:

```ts
/** Conta bancária dentro de uma box. Nesta entrega o saldo é informado pelo usuário, não
 *  calculado: lançamento ainda não aponta para banco (ver a spec, entrega 2). */
export interface Banco extends Entidade {
  boxId: ID;
  nome: string;
  ordem: number;
  saldoDeclaradoCent: number | null;
  dataSaldoDeclarado: ISODate | null;
}
```

No mesmo arquivo, em `Cartao`, acrescente o campo opcional:

```ts
  bancoId?: ID; // banco dono do cartão; organizacional nesta entrega
```

E em `Dados`, junto das outras coleções:

```ts
  bancos: Banco[];
```

- [ ] **Passo 4: subir o schema**

Em `src/db/database.ts`, importe `Banco` no bloco de tipos, declare a tabela na classe:

```ts
  bancos!: Table<Banco, string>;
```

e acrescente a versão nova depois da `version(3)`, repetindo as tabelas existentes sem mudança:

```ts
    this.version(4).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
      viagens: 'id, dataInicio, dataFim',
      bancos: 'id, boxId',
    });
```

- [ ] **Passo 5: rodar e confirmar que passa**

Rode: `npx vitest run src/db/database.test.ts`
Esperado: PASSA, incluindo os três saltos (v1→v4, v2→v4, v3→v4).

- [ ] **Passo 6: commitar**

```bash
git add src/domain/types.ts src/db/database.ts src/db/database.test.ts
git commit -m "Cria a entidade Banco e sobe o schema Dexie para a v4"
```

---

### Tarefa 2: domínio puro dos bancos

**Arquivos:**
- Criar: `src/domain/bancos.ts`
- Testar: `src/domain/bancos.test.ts`

**Interfaces:**
- Consome: `Banco`, `ID` de `src/domain/types.ts` (Tarefa 1).
- Produz: `bancosDaBox(bancos: Banco[], boxIds: readonly ID[]): Banco[]` e
  `totalDeclaradoCent(bancos: Banco[]): number | null`.

- [ ] **Passo 1: escrever os testes que falham**

Crie `src/domain/bancos.test.ts`:

```ts
import type { Banco } from './types';
import { bancosDaBox, totalDeclaradoCent } from './bancos';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };

function banco(id: string, boxId: string, nome: string, ordem: number, declarado: number | null): Banco {
  return { id, boxId, nome, ordem, saldoDeclaradoCent: declarado, dataSaldoDeclarado: declarado != null ? '2026-08-01' : null, ...ts };
}

describe('bancosDaBox', () => {
  it('filtra pelas boxes pedidas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.id)).toEqual(['b1']);
  });

  it('ordena por ordem e desempata por nome', () => {
    const bancos = [
      banco('b3', 'box1', 'Zeta', 1, null),
      banco('b1', 'box1', 'Beta', 0, null),
      banco('b2', 'box1', 'Alfa', 0, null),
    ];
    expect(bancosDaBox(bancos, ['box1']).map((b) => b.nome)).toEqual(['Alfa', 'Beta', 'Zeta']);
  });

  it('boxes múltiplas (visão casa) trazem os bancos de todas', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box2', 'Beta', 0, null)];
    expect(bancosDaBox(bancos, ['box1', 'box2'])).toHaveLength(2);
  });
});

describe('totalDeclaradoCent', () => {
  it('soma só os informados, ignorando os nulos', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, 50000), banco('b2', 'box1', 'Beta', 1, null), banco('b3', 'box1', 'Gama', 2, 30000)];
    expect(totalDeclaradoCent(bancos)).toBe(80000);
  });

  it('devolve null quando nenhum banco foi informado', () => {
    // distinguir "informou zero" de "não informou" é o que impede a tela de afirmar
    // uma diferença que não existe
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box1', 'Beta', 1, null)];
    expect(totalDeclaradoCent(bancos)).toBe(null);
  });

  it('zero informado conta como informado, e não como ausente', () => {
    expect(totalDeclaradoCent([banco('b1', 'box1', 'Alfa', 0, 0)])).toBe(0);
  });

  it('lista vazia devolve null', () => {
    expect(totalDeclaradoCent([])).toBe(null);
  });
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/domain/bancos.test.ts`
Esperado: FALHA — o módulo `./bancos` não existe.

- [ ] **Passo 3: implementar**

Crie `src/domain/bancos.ts`:

```ts
import type { Banco, ID } from './types';

/** Bancos das boxes pedidas, na ordem canônica de Ajustes (mesma disciplina das
 *  categorias de cartão: `ordem` decide, `nome` desempata). */
export function bancosDaBox(bancos: Banco[], boxIds: readonly ID[]): Banco[] {
  return bancos
    .filter((b) => boxIds.includes(b.boxId))
    .sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.nome.localeCompare(b.nome)));
}

/** Soma dos saldos informados, ignorando os que não foram informados. Devolve `null`
 *  quando NENHUM banco tem valor — "informou zero" e "não informou" são coisas
 *  diferentes, e confundi-las faz a tela acusar uma diferença inexistente. */
export function totalDeclaradoCent(bancos: Banco[]): number | null {
  const informados = bancos.filter((b) => b.saldoDeclaradoCent != null);
  if (informados.length === 0) return null;
  return informados.reduce((s, b) => s + b.saldoDeclaradoCent!, 0);
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

Rode: `npx vitest run src/domain/bancos.test.ts`
Esperado: PASSA (7 testes).

- [ ] **Passo 5: commitar**

```bash
git add src/domain/bancos.ts src/domain/bancos.test.ts
git commit -m "Domínio dos bancos: filtro por box e total informado"
```

---

### Tarefa 3: backup schema 4

**Arquivos:**
- Modificar: `src/backup/backup.ts`
- Testar: `src/backup/backup.test.ts`

**Interfaces:**
- Consome: `Dados.bancos` (Tarefa 1).
- Produz: `Backup.schema === 4`; `validarBackup` aceita schema 1–4 e preenche
  `bancos: []` para schema < 4.

- [ ] **Passo 1: escrever os testes adversariais que falham**

Em `src/backup/backup.test.ts`, no helper que monta os dados vazios (linha ~8), acrescente
`bancos: []` à lista de coleções. Depois adicione:

```ts
it('aceita backup schema 3 preenchendo bancos vazia', () => {
  const b = validarBackup({
    app: 'flow', schema: 3, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' },
    },
  });
  expect(b.schema).toBe(4);
  expect(b.dados.bancos).toEqual([]);
});

it('recusa backup schema 4 sem a tabela bancos', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 4 com bancos que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-08-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], config: { id: 'config' }, bancos: { nome: 'Alfa' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('mescla bancos pelo alteradoEm mais recente', () => {
  const base = { id: '', boxId: 'box1', nome: '', ordem: 0, saldoDeclaradoCent: null, dataSaldoDeclarado: null, criadoEm: '2026-01-01', alteradoEm: '2026-01-01' };
  const a = dados();
  const b = dados();
  a.bancos = [{ ...base, id: 'bk1', nome: 'Nome velho', alteradoEm: '2026-01-01' }];
  b.bancos = [{ ...base, id: 'bk1', nome: 'Nome novo', alteradoEm: '2026-02-01' }];
  expect(mesclar(a, b).bancos[0].nome).toBe('Nome novo');
});
```

O helper é a função `dados()` no topo do arquivo — acrescente `bancos: []` a ela. Há também
um `expect(volta.schema).toBe(3)` no teste "round-trip" que passa a ser `toBe(4)`.

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/backup/backup.test.ts`
Esperado: FALHA — schema 4 é rejeitado como versão incompatível.

- [ ] **Passo 3: implementar**

Em `src/backup/backup.ts`:

```ts
export interface Backup {
  app: 'flow';
  schema: 4;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 4, exportadoEm: new Date().toISOString(), dados };
}
```

Acrescente a constante junto das outras:

```ts
const TABELAS_BANCO = ['bancos'] as const;
```

Em `validarBackup`, amplie a checagem de versão e acrescente as duas regras novas — **sem
afrouxar nenhuma existente**:

```ts
  if (b.schema !== 1 && b.schema !== 2 && b.schema !== 3 && b.schema !== 4) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
```

```ts
  if (b.schema >= 4 && TABELAS_BANCO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
```

```ts
  if (b.schema < 4) {
    // backup antigo: bancos nasceu depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_BANCO) md[t] = [];
  }
```

e o retorno passa a `schema: 4`.

Na função `mesclar`, acrescente `bancos` à lista de coleções mescladas por id, no mesmo
padrão de `viagens`.

- [ ] **Passo 4: rodar e confirmar que passa**

Rode: `npx vitest run src/backup/backup.test.ts`
Esperado: PASSA, incluindo os testes de schema 1, 2 e 3 que já existiam.

- [ ] **Passo 5: commitar**

```bash
git add src/backup/backup.ts src/backup/backup.test.ts
git commit -m "Backup schema 4: inclui bancos e preenche vazio nos backups antigos"
```

---

### Tarefa 4: persistência dos bancos

**Arquivos:**
- Modificar: `src/db/repo.ts`
- Testar: `src/db/repo.test.ts`

**Interfaces:**
- Consome: `Banco`, `db.bancos` (Tarefa 1).
- Produz: `salvarBanco(n: NovoBanco | Banco): Promise<Banco>`,
  `atualizarBanco(id: ID, patch: Partial<Pick<Banco, 'nome' | 'ordem' | 'saldoDeclaradoCent' | 'dataSaldoDeclarado'>>): Promise<void>`,
  `excluirBanco(id: ID): Promise<void>`, e `carregarTudo()` devolvendo `bancos`.
  `interface NovoBanco { boxId: ID; nome: string; ordem: number }`.

- [ ] **Passo 1: escrever os testes que falham**

Em `src/db/repo.test.ts`, ao fim do arquivo:

```ts
describe('bancos', () => {
  it('salvarBanco cria com saldo não informado e aparece em carregarTudo', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });

    expect(banco).toMatchObject({ nome: 'Banco Um', saldoDeclaradoCent: null, dataSaldoDeclarado: null });
    const dados = await repo.carregarTudo();
    expect(dados.bancos.map((b) => b.nome)).toEqual(['Banco Um']);
    expect(dados.config.mudancasDesdeBackup).toBe(true);
  });

  it('atualizarBanco grava o saldo informado com a data', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: 50000, dataSaldoDeclarado: '2026-08-05' });

    expect(await db.bancos.get(banco.id)).toMatchObject({
      saldoDeclaradoCent: 50000, dataSaldoDeclarado: '2026-08-05',
    });
  });

  it('excluirBanco limpa o bancoId dos cartões que apontavam para ele', async () => {
    const { box } = await boxECategoria();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Cartão', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    await db.cartoes.update(cartao.id, { bancoId: banco.id });

    await repo.excluirBanco(banco.id);

    // cartão órfão apontando para banco inexistente é inconsistência silenciosa
    expect(await db.bancos.get(banco.id)).toBeUndefined();
    expect((await db.cartoes.get(cartao.id))?.bancoId).toBeUndefined();
  });

  it('excluirBanco não mexe em cartão de outro banco', async () => {
    const { box } = await boxECategoria();
    const alvo = await repo.salvarBanco({ boxId: box.id, nome: 'Alvo', ordem: 0 });
    const outro = await repo.salvarBanco({ boxId: box.id, nome: 'Outro', ordem: 1 });
    const cartao = await repo.salvarCartao(
      { boxId: box.id, nome: 'Cartão', diaFechamento: 10, diaVencimento: 20 }, '2027-12-31',
    );
    await db.cartoes.update(cartao.id, { bancoId: outro.id });

    await repo.excluirBanco(alvo.id);

    expect((await db.cartoes.get(cartao.id))?.bancoId).toBe(outro.id);
  });
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/db/repo.test.ts`
Esperado: FALHA — `repo.salvarBanco is not a function`.

- [ ] **Passo 3: implementar**

Em `src/db/repo.ts`, importe `type Banco` no bloco de tipos e acrescente, na seção das
entidades de box (antes da seção `// ---------- Cartão de crédito ----------`):

```ts
export interface NovoBanco { boxId: ID; nome: string; ordem: number }

export async function salvarBanco(n: NovoBanco | Banco): Promise<Banco> {
  const agora = agoraISO();
  const b: Banco = 'id' in n
    ? { ...n, alteradoEm: agora }
    : {
      id: novoId(), saldoDeclaradoCent: null, dataSaldoDeclarado: null,
      criadoEm: agora, alteradoEm: agora, ...n,
    };
  await db.transaction('rw', db.bancos, db.config, async () => {
    await db.bancos.put(b);
    await marcarMudanca();
  });
  return b;
}

export async function atualizarBanco(
  id: ID,
  patch: Partial<Pick<Banco, 'nome' | 'ordem' | 'saldoDeclaradoCent' | 'dataSaldoDeclarado'>>,
): Promise<void> {
  await db.transaction('rw', db.bancos, db.config, async () => {
    await db.bancos.update(id, { ...patch, alteradoEm: agoraISO() });
    await marcarMudanca();
  });
}

/** Excluir um banco desliga os cartões que apontavam para ele. Cartão apontando para
 *  banco inexistente é inconsistência silenciosa — o mesmo cuidado que
 *  `converterCenarioEmReal` toma com as recorrências. */
export async function excluirBanco(id: ID): Promise<void> {
  await db.transaction('rw', db.bancos, db.cartoes, db.config, async () => {
    const agora = agoraISO();
    // `bancoId` não é índice (a Tarefa 1 o declarou só como campo), então é `.filter()`
    // e não `.where()` — mesmo idioma de `converterCenarioEmReal` (`repo.ts:212`).
    await db.cartoes.filter((c) => c.bancoId === id).modify((c) => {
      delete c.bancoId;
      c.alteradoEm = agora;
    });
    await db.bancos.delete(id);
    await marcarMudanca();
  });
}
```

Em `carregarTudo`, acrescente `db.bancos.toArray()` ao `Promise.all`, à desestruturação e ao
objeto retornado, junto de `viagens`.

- [ ] **Passo 4: rodar e confirmar que passa**

Rode: `npx vitest run src/db/repo.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: rodar a suíte inteira**

Rode: `npm test`
Esperado: tudo verde. Se algum teste de backup ou store quebrar por falta de `bancos` no
snapshot, corrija a fixture — não a asserção.

- [ ] **Passo 6: commitar**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "Persistência dos bancos, com exclusão desligando os cartões vinculados"
```

---

### Tarefa 5: mockup ⏸ PONTO DE PARADA

**Arquivos:**
- Criar: mockup HTML no diretório de scratchpad (nunca em `public/` nem versionado).

- [ ] **Passo 1: ler o guia de estilo**

Leia `docs/estilo-visual.md` e, por ser tela nova mais possível classe nova,
`docs/estilo/nivel-5-nova-tela.md` e `docs/estilo/nivel-2-nova-classe.md`. Confira as classes
existentes em `docs/estilo/catalogo.md` antes de inventar qualquer coisa.

- [ ] **Passo 2: montar o mockup**

Um HTML único, com `<meta charset="utf-8">` na primeira linha e `<meta name="viewport">`,
usando os tokens de `src/styles.css`. Precisa cobrir:
- a subtela **Ajustes → Bancos**: formulário de criação **no topo** (regra registrada), depois
  a lista com nome, saldo informado + data, e os cartões vinculados;
- a **conferência da tela Hoje** com bancos: uma linha por banco com campo de valor, rodapé
  com total informado e a diferença para o saldo projetado;
- o mesmo bloco no estado **"nenhum banco informado"** (sem diferença, só o convite);
- o mesmo bloco na **visão `casa`**, com os bancos agrupados por box.

- [ ] **Passo 3: entregar ao usuário e PARAR**

Envie o arquivo e espere aprovação explícita. **Silêncio não é aprovação.** Não escreva
nenhuma linha de UI antes do "pode seguir".

---

### Tarefa 6: subtela Ajustes → Bancos

**Arquivos:**
- Criar: `src/ui/ajustes/Bancos.tsx`
- Criar: `src/ui/ajustes/Bancos.test.tsx`
- Modificar: `src/state/store.ts` (tipo `SecaoAjustes`)
- Modificar: `src/ui/TelaAjustes.tsx` (lista `ITENS` e renderização)

**Interfaces:**
- Consome: `bancosDaBox` (Tarefa 2); `salvarBanco`, `atualizarBanco`, `excluirBanco`
  (Tarefa 4).
- Produz: seção `'bancos'` em `SecaoAjustes`, alcançável por `abrirAjustes('bancos')`.

- [ ] **Passo 1: escrever os testes que falham**

Crie `src/ui/ajustes/Bancos.test.tsx` seguindo o molde de `Viagens.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Bancos from './Bancos';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ boxSel: 'casa' });
});

async function comBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-05' });
  return box;
}

it('cria um banco pelo formulário do topo', async () => {
  await comBox();
  render(<Bancos />);
  await userEvent.type(screen.getByLabelText('Nome do banco'), 'Banco Um');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText('Banco Um')).toBeInTheDocument();
  expect((await db.bancos.toArray()).map((b) => b.nome)).toEqual(['Banco Um']);
});

it('criar sem nome avisa em vez de não fazer nada', async () => {
  await comBox();
  render(<Bancos />);
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  expect(await screen.findByText('Dê um nome ao banco para criar.')).toBeInTheDocument();
  expect(await db.bancos.count()).toBe(0);
});

it('estado vazio explica para que serve', async () => {
  await comBox();
  render(<Bancos />);
  expect(screen.getByText(/Nenhum banco cadastrado/)).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/ui/ajustes/Bancos.test.tsx`
Esperado: FALHA — o módulo `./Bancos` não existe.

- [ ] **Passo 3: registrar a seção no store e no menu**

Em `src/state/store.ts`, acrescente `'bancos'` à união `SecaoAjustes`:

```ts
export type SecaoAjustes = 'menu' | 'categorias' | 'recorrencias' | 'boxes' | 'bancos' | 'cartoes'
  | 'categoriasCartao' | 'assinaturas' | 'viagens' | 'backup' | 'wiki' | 'versao';
```

Em `src/ui/TelaAjustes.tsx`, importe `Bancos`, acrescente o item logo depois de Boxes:

```tsx
  { id: 'bancos', rotulo: 'Bancos' },
```

e a renderização junto das outras:

```tsx
      {secao === 'bancos' && <Bancos />}
```

- [ ] **Passo 4: implementar a tela**

Crie `src/ui/ajustes/Bancos.tsx` conforme o mockup aprovado na Tarefa 5, respeitando:
formulário **antes** da lista; `window.confirm` antes de excluir (idioma de todas as
exclusões do app desde a v0.19.0); classes do catálogo sempre que existirem; aviso em vez de
`return` mudo quando o nome estiver vazio. A box de referência vem de
`boxIdsSelecionadas(dados, boxSel)`, e a lista, de `bancosDaBox`.

- [ ] **Passo 5: rodar e confirmar que passa**

Rode: `npx vitest run src/ui/ajustes/Bancos.test.tsx`
Esperado: PASSA.

- [ ] **Passo 6: commitar**

```bash
git add src/ui/ajustes/Bancos.tsx src/ui/ajustes/Bancos.test.tsx src/state/store.ts src/ui/TelaAjustes.tsx
git commit -m "Subtela Ajustes > Bancos: cadastro e saldo informado"
```

---

### Tarefa 7: vincular cartão a banco

**Arquivos:**
- Modificar: `src/ui/ajustes/Cartoes.tsx`
- Testar: `src/ui/ajustes/Cartoes.test.tsx`

**Interfaces:**
- Consome: `bancosDaBox` (Tarefa 2), `Cartao.bancoId` (Tarefa 1).

- [ ] **Passo 1: escrever o teste que falha**

Em `src/ui/ajustes/Cartoes.test.tsx`:

```tsx
it('permite escolher o banco dono do cartão', async () => {
  const box = await montarBox();     // helper já existente no topo do arquivo
  const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  await useApp.getState().recarregar();

  render(<Cartoes />);
  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.selectOptions(screen.getByLabelText('Banco'), banco.id);
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await vi.waitFor(async () => {
    expect((await db.cartoes.toArray())[0].bancoId).toBe(banco.id);
  });
});

it('box sem banco nenhum não mostra o campo', async () => {
  await montarBox();
  render(<Cartoes />);
  // seletor vazio só ocupa espaço e confunde
  expect(screen.queryByLabelText('Banco')).not.toBeInTheDocument();
});
```

Confira o que `montarBox()` devolve e ajuste a desestruturação se ele devolver um objeto.

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Esperado: FALHA — não existe campo com rótulo "Banco".

- [ ] **Passo 3: implementar**

Acrescente ao formulário do cartão um `<select>` com os bancos da box do cartão (via
`bancosDaBox`), mais a opção vazia "— sem banco —", gravando `bancoId` no `repo.salvarCartao`.
Quando a box não tiver banco nenhum, **não renderize o campo**: um seletor vazio só ocupa
espaço e confunde.

- [ ] **Passo 4: rodar e confirmar que passa**

Rode: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Esperado: PASSA.

- [ ] **Passo 5: commitar**

```bash
git add src/ui/ajustes/Cartoes.tsx src/ui/ajustes/Cartoes.test.tsx
git commit -m "Cartão passa a poder pertencer a um banco"
```

---

### Tarefa 8: conferência por banco na tela Hoje

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx`
- Testar: `src/ui/TelaHoje.test.tsx`
- Modificar: `src/styles.css` e `docs/estilo/catalogo.md` (se o mockup pedir classe nova)

**Interfaces:**
- Consome: `bancosDaBox`, `totalDeclaradoCent` (Tarefa 2); `atualizarBanco` (Tarefa 4).

- [ ] **Passo 1: escrever os testes que falham**

Em `src/ui/TelaHoje.test.tsx`:

```tsx
describe('conferência por banco', () => {
  it('box sem banco mantém a conferência de sempre', async () => {
    const box = await comBoxESaldo();      // helper: box com saldoInicial e um lançamento
    render(<TelaHoje />);
    expect(screen.getByLabelText('Saldo real no banco')).toBeInTheDocument();
    expect(screen.queryByText('Total informado')).not.toBeInTheDocument();
    expect(box).toBeDefined();
  });

  it('com bancos, mostra uma linha por banco e o total informado', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await useApp.getState().recarregar();

    render(<TelaHoje />);
    expect(screen.getByLabelText('Banco Um')).toBeInTheDocument();
    expect(screen.getByLabelText('Banco Dois')).toBeInTheDocument();
    expect(screen.queryByLabelText('Saldo real no banco')).not.toBeInTheDocument();
  });

  it('sem nenhum banco informado, não afirma diferença nenhuma', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();

    render(<TelaHoje />);
    // mostrar "diferença = saldo inteiro" seria a tela acusar um descasamento inexistente
    expect(screen.queryByText(/Diferença/)).not.toBeInTheDocument();
  });

  it('excluir todos os bancos devolve a conferência antiga, com o valor preservado', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBox({ ...box, saldoDeclaradoCent: 12345, dataSaldoDeclarado: '2026-07-01' });
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();
    render(<TelaHoje />);
    expect(screen.queryByLabelText('Saldo real no banco')).not.toBeInTheDocument();

    await repo.excluirBanco(banco.id);
    await useApp.getState().recarregar();

    // é isto que torna a entrega reversível: o valor antigo nunca foi apagado
    expect(await screen.findByLabelText('Saldo real no banco')).toHaveValue('R$ 123,45');
  });

  it('na visão casa os bancos aparecem agrupados por box', async () => {
    const box = await comBoxESaldo();
    const agora = agoraISO();
    const outra = { id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(outra);
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: outra.id, nome: 'Banco Dois', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-08-05' });

    render(<TelaHoje />);
    expect(screen.getByLabelText('Banco Um')).toBeInTheDocument();
    expect(screen.getByLabelText('Banco Dois')).toBeInTheDocument();
    expect(screen.getByText('ju')).toBeInTheDocument();
  });

  it('informar o saldo de um banco grava e passa a mostrar a diferença', async () => {
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();

    render(<TelaHoje />);
    await userEvent.click(screen.getByLabelText('Banco Um'));
    await userEvent.keyboard('50000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(banco.id))?.saldoDeclaradoCent).toBe(50000);
    });
    expect(await screen.findByText(/Diferença/)).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx`
Esperado: FALHA — não existe campo com o rótulo do banco.

- [ ] **Passo 3: implementar**

Em `src/ui/TelaHoje.tsx`, acrescente um componente irmão de `ConferenciaSaldo` (por exemplo
`ConferenciaBancos`) e escolha entre os dois pelo número de bancos da seleção:

```tsx
const bancos = bancosDaBox(dados.bancos, ids);
```

Com `bancos.length === 0`, renderize o `ConferenciaSaldo` de hoje, **sem tocar em nada** — é
o que garante zero regressão. Com bancos, renderize a lista, gravando cada valor por
`repo.atualizarBanco(id, { saldoDeclaradoCent, dataSaldoDeclarado: hoje })`. A diferença sai
de `totalDeclaradoCent(bancos)` contra `deHoje?.saldoEfetivo`, e **só aparece quando o total
não é `null`**. Na visão `casa`, agrupe por box com `.rotulo-grupo` + `.recuo-1`.

Classe nova, se o mockup pedir: bloco comentado ao fim de `src/styles.css`, só com tokens
existentes, e linha em `docs/estilo/catalogo.md` **no mesmo commit**.

- [ ] **Passo 4: rodar e confirmar que passa**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx`
Esperado: PASSA, incluindo os testes de conferência que já existiam.

- [ ] **Passo 5: rodar a suíte, o build e os verificadores**

```bash
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```
Esperado: tudo verde; os dois verificadores devem imprimir `✓`.

- [ ] **Passo 6: commitar**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "Conferência da tela Hoje quebrada por banco"
```

---

### Tarefa 9: documentação e changelog

**Arquivos:**
- Modificar: `docs/dominio.md`
- Criar: `changelog.d/adicionado-bancos-na-box.md`

- [ ] **Passo 1: documentar a entidade**

Em `docs/dominio.md`, na lista de entidades, acrescente `Banco` entre `Box` e `Categoria`,
dizendo o que é, que o saldo é **informado e não calculado** nesta entrega, e que a `Box`
mantém o `saldoDeclaradoCent` antigo intacto mas deixa de usá-lo quando há bancos — o que
torna a mudança reversível.

- [ ] **Passo 2: escrever o fragmento**

Crie `changelog.d/adicionado-bancos-na-box.md` com **bullets planos** (o parser do app só
entende isso):

```
- Ajustes ganhou a tela Bancos: dá para cadastrar as contas de cada box e informar quanto tem em cada uma.
- Um cartão pode pertencer a um banco, para você ver quais cartões saem de qual conta.
- Tela Hoje: quando a box tem bancos, a conferência de saldo passa a ter uma linha por banco, com o total informado e a diferença para o que o Flow projeta.
- Quem não cadastrar nenhum banco não vê diferença: a conferência continua exatamente como era.
```

- [ ] **Passo 3: commitar**

```bash
git add docs/dominio.md changelog.d/adicionado-bancos-na-box.md
git commit -m "Documenta os bancos e escreve o fragmento de changelog"
```

---

### Tarefa 10: integração ⏸ PONTO DE PARADA

- [ ] **Passo 1: invocar a skill do ciclo**

Invoque `ciclo-de-entrega` e siga o passo a passo.

- [ ] **Passo 2: apresentar a revisão do changelog e PARAR**

Mostre a revisão (Adicionado/Alterado/Removido) e espere **confirmação literal** do usuário
antes de qualquer merge.

- [ ] **Passo 3: integrar**

Depois da confirmação: merge na `main`, `npm run release -- minor` (recurso novo),
`git push origin main --follow-tags`, `npm run deploy`, CI verde, worktree removido.

## Verificação final

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

No celular, depois do deploy: cadastrar dois bancos numa box, informar o saldo de cada um,
conferir que o total e a diferença batem com o que a tela mostrava antes de dividir, exportar
o backup e reimportá-lo conferindo que os bancos voltam, e excluir um banco conferindo que o
cartão vinculado não fica órfão.
