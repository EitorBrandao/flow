# Ajuste excepcional de fechamento de fatura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar, por cartão e por mês, um dia de fechamento diferente do padrão do cartão — sem mudar o padrão para os outros meses — e refletir isso em toda fatura calculada pelo app.

**Architecture:** Nova entidade `AjusteFechamento` (padrão idêntico a `ConferenciaFatura`), persistida numa tabela Dexie nova e num schema de backup novo. As funções puras de `src/domain/fatura.ts` que calculam faturas ganham um parâmetro opcional de override (mês calendário → dia de fechamento); todo consumidor (repositório, telas, dossiê) passa a montar e repassar esse mapa a partir de `Dados.ajustesFechamento`. A UI ganha um bloco novo na aba "Conferência" da fatura, no mesmo idioma visual do bloco de conferência de valor que já existe ali.

**Tech Stack:** TypeScript, React 18, Zustand, Dexie (IndexedDB), Vitest + Testing Library.

## Global Constraints

- Valores monetários em centavos inteiros; datas em `ISODate` (`"AAAA-MM-DD"`); mês de fatura no formato `"AAAA-MM"`.
- Nenhum `{ timeout: n }` local em `findBy*`/`waitFor` — os timeouts globais (`vite.config.ts`, `src/test-setup.ts`) já são generosos de propósito.
- Toda nova `this.version(n)` no Dexie exige teste do caminho de upgrade no mesmo commit (`src/db/CLAUDE.md`).
- Toda mudança em `src/backup/` exige testes adversariais e nunca afrouxa `validarBackup` (`src/backup/CLAUDE.md`).
- Só o dia de fechamento é ajustável; o vencimento nunca muda (decisão do usuário, spec `docs/superpowers/specs/2026-09-02-ajuste-fechamento-fatura-design.md`).
- Nenhuma classe CSS ou componente novo é esperado — a UI reaproveita o padrão visual existente (`BlocoConferencia`). Se algo novo surgir, catalogar em `docs/estilo/catalogo.md` no mesmo commit.
- Trabalho já está no branch `ajuste-fechamento-fatura`, worktree `.worktrees/ajuste-fechamento-fatura/` — todos os caminhos abaixo são relativos à raiz do repositório, execute os comandos dentro dessa worktree.

---

### Task 1: Tipo `AjusteFechamento` e ajuste dos fixtures de `Dados`

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/aggregations.test.ts:139`
- Modify: `src/db/repo.test.ts:255`
- Modify: `src/backup/backup.test.ts:9`
- Modify: `src/dossie/invariantes.test.ts:37`

**Interfaces:**
- Produces: `export interface AjusteFechamento extends Entidade { cartaoId: ID; mes: string; diaFechamento: number }`; `Dados.ajustesFechamento: AjusteFechamento[]`.

`Dados.ajustesFechamento` é um campo obrigatório novo — todo lugar que hoje monta um objeto `Dados` completo por literal (não via `repo.carregarTudo()`) para de compilar até ganhar essa chave. É mecânico: adicionar `ajustesFechamento: []` ao lado de `bancos: []` em cada um dos 4 arquivos de teste listados.

- [ ] **Step 1: Adicionar `AjusteFechamento` e o campo em `Dados`**

Em `src/domain/types.ts`, logo depois da interface `ConferenciaFatura` (linha 115):

```ts
/** Exceção pontual de fechamento: sobrescreve `Cartao.diaFechamento` só no mês calendário em
 *  que o fechamento aconteceu (não no mês de vencimento da fatura resultante — ver
 *  docs/superpowers/specs/2026-09-02-ajuste-fechamento-fatura-design.md). Única por
 *  cartão+mês; vencimento nunca é afetado. */
export interface AjusteFechamento extends Entidade {
  cartaoId: ID;
  mes: string; // 'AAAA-MM' — mês CALENDÁRIO em que o fechamento aconteceu
  diaFechamento: number; // 1-31, clampado ao fim do mês
}
```

No `interface Dados`, logo depois de `bancos: Banco[];` (linha 151):

```ts
  ajustesFechamento: AjusteFechamento[];
```

- [ ] **Step 2: Corrigir os 4 fixtures de `Dados` que ainda não compilam**

Em `src/domain/aggregations.test.ts:139`, `src/db/repo.test.ts:255` e `src/dossie/invariantes.test.ts:37`, cada um tem uma linha `bancos: [],` (ou `..., bancos: [],`) dentro de um objeto `Dados` literal. Adicione `ajustesFechamento: [],` logo depois, em cada um dos 3 arquivos. Exemplo em `src/dossie/invariantes.test.ts`:

```ts
    conferenciasFatura: [],
    viagens: [],
    bancos: [],
    ajustesFechamento: [],
    config: {
```

Em `src/backup/backup.test.ts`, a função `dados()` (linha 4-12) tem:

```ts
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [],
```

Troque para:

```ts
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [], ajustesFechamento: [],
```

- [ ] **Step 3: Rodar o typecheck e confirmar que só falta a persistência**

Run: `npx tsc -b --noEmit`
Expected: erros restantes só em `src/db/database.ts`, `src/db/repo.ts` e `src/backup/backup.ts` (ainda não leem/gravam `ajustesFechamento` — resolvido nas próximas tarefas). Nenhum erro em `src/domain/types.ts` nem nos 4 arquivos de teste editados.

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/domain/aggregations.test.ts src/db/repo.test.ts src/backup/backup.test.ts src/dossie/invariantes.test.ts
git commit -m "feat(domain): adiciona a entidade AjusteFechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 2: Schema Dexie versão 5

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/db/database.test.ts`

**Interfaces:**
- Consumes: `AjusteFechamento` (Task 1).
- Produces: `db.ajustesFechamento: Table<AjusteFechamento, string>`, índice `[cartaoId+mes]`.

- [ ] **Step 1: Escrever o teste de upgrade que falha (guarda de versão)**

Em `src/db/database.test.ts`, troque o teste "a versão atual do schema é 4" (linhas 383-393) por:

```ts
  // Guarda de versão: ao adicionar `this.version(6)` em database.ts, este teste falha de
  // propósito — é o lembrete forçado para escrever o salto 5 → 6 (schema congelado + teste
  // de migração) antes de mexer no schema real.
  it('a versão atual do schema é 5 — subiu de versão? adicione o salto novo aqui', async () => {
    const nome = `flow-teste-guarda-versao-${novoId()}`;
    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(5);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/db/database.test.ts -t "a versão atual do schema é 5"`
Expected: FAIL — `flow.verno` ainda é `4`.

- [ ] **Step 3: Adicionar `this.version(5)` em `database.ts`**

Em `src/db/database.ts`, adicione o import do tipo e a tabela:

```ts
import type {
  AjusteFechamento, Banco, Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, Recorrencia, RecorrenciaCartao, Viagem,
} from '../domain/types';
```

```ts
  bancos!: Table<Banco, string>;
  ajustesFechamento!: Table<AjusteFechamento, string>;
```

E depois do bloco `this.version(4).stores({...})` (linha 73), adicione:

```ts
    this.version(5).stores({
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
      ajustesFechamento: 'id, cartaoId, [cartaoId+mes]',
    });
```

- [ ] **Step 4: Rodar o teste da guarda e confirmar que passa**

Run: `npx vitest run src/db/database.test.ts -t "a versão atual do schema é 5"`
Expected: PASS

- [ ] **Step 5: Escrever o teste do salto v4 → v5**

Em `src/db/database.test.ts`, adicione o schema v4 congelado (cópia literal do `this.version(4).stores` atual) logo depois de `SCHEMA_V3` (depois da linha 68):

```ts
/** Schema da v4 do FlowDB — literal, histórico, nunca mude. */
const SCHEMA_V4 = {
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
};
```

E um `dadosBanco` auxiliar, logo depois de `dadosCartao` (depois da linha 232):

```ts
/** Dado de banco introduzido na v4. */
function dadosBanco(boxId: string) {
  const agora = agoraISO();
  const banco: Banco = {
    id: novoId(), boxId, nome: 'banco teste', ordem: 0,
    saldoDeclaradoCent: 12345, dataSaldoDeclarado: '2026-07-01',
    criadoEm: agora, alteradoEm: agora,
  };
  return { banco };
}
```

Adicione `Banco` ao import de tipos no topo do arquivo (linha 4-7):

```ts
import type {
  Banco, Box, Cartao, Categoria, CategoriaCartao, Cenario, CompraCartao, Config,
  ConferenciaFatura, Lancamento, Recorrencia, RecorrenciaCartao,
} from '../domain/types';
```

E, depois do teste "salto v3 → v4" (antes do teste de guarda de versão, que já foi reescrito no Step 1), adicione:

```ts
  it('salto v4 → v5: dados de banco sobrevivem e ajustesFechamento nasce vazia', async () => {
    const nome = `flow-teste-v4-${novoId()}`;
    const { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config } = dadosBase();
    const { cartao, categoriaCartao, compraCartao, recorrenciaCartao, conferenciaFatura } = dadosCartao(box.id);
    const { banco } = dadosBanco(box.id);

    const antigo = new Dexie(nome);
    antigo.version(1).stores(SCHEMA_V1);
    antigo.version(2).stores(SCHEMA_V2);
    antigo.version(3).stores(SCHEMA_V3);
    antigo.version(4).stores(SCHEMA_V4);
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
      await antigo.table('bancos').add(banco);
    } finally {
      await antigo.close();
    }

    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(5);

      expect(await flow.boxes.get(box.id)).toEqual(box);
      expect(await flow.lancamentos.get(lancamentoEfetivo.id)).toEqual(lancamentoEfetivo);
      expect(await flow.cartoes.get(cartao.id)).toEqual(cartao);
      expect(await flow.comprasCartao.get(compraCartao.id)).toEqual(compraCartao);
      expect(await flow.conferenciasFatura.get(conferenciaFatura.id)).toEqual(conferenciaFatura);
      expect(await flow.bancos.get(banco.id)).toEqual(banco);
      expect(await flow.config.get('config')).toEqual(config);

      await expect(flow.ajustesFechamento.count()).resolves.toBe(0);

      // Índice `[cartaoId+mes]` só existe a partir da v5 — a consulta não deve lançar.
      await expect(flow.ajustesFechamento.where('[cartaoId+mes]').equals([cartao.id, '2026-08']).toArray())
        .resolves.toEqual([]);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });
```

- [ ] **Step 6: Atualizar os 3 testes de salto anteriores (v1→v5, v2→v5, v3→v5) para a versão atual**

Nos 3 testes existentes ("salto v1 → v4", "salto v2 → v4", "salto v3 → v4"), troque cada `expect(flow.verno).toBe(4);` por `expect(flow.verno).toBe(5);`, e no final de cada bloco de asserções (antes do `finally`) adicione `await expect(flow.ajustesFechamento.count()).resolves.toBe(0);`. Renomeie os títulos dos `it(...)` de "v1 → v4" para "v1 → v5" etc., mantendo o resto do texto.

- [ ] **Step 7: Rodar a suíte inteira de `database.test.ts` e confirmar que passa**

Run: `npx vitest run src/db/database.test.ts`
Expected: PASS — todos os testes, incluindo o novo salto v4 → v5.

- [ ] **Step 8: Commit**

```bash
git add src/db/database.ts src/db/database.test.ts
git commit -m "feat(db): tabela ajustesFechamento no schema Dexie v5

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 3: `src/domain/fatura.ts` — override de fechamento nas funções centrais

**Files:**
- Modify: `src/domain/fatura.ts`
- Modify: `src/domain/fatura.test.ts`

**Interfaces:**
- Consumes: `AjusteFechamento` (Task 1).
- Produces: `export function ajustesDoCartao(ajustes: AjusteFechamento[], cartaoId: ID): Map<string, number>`; `export function dedupAjustesFechamento(as: AjusteFechamento[]): AjusteFechamento[]`; `mesFechamentoDaCompra`, `datasFaturaDoMes`, `mesFaturaDaCompra`, `calcularFaturas` ganham parâmetro opcional final `ajustes?: ReadonlyMap<string, number>` — comportamento idêntico ao atual quando omitido.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/domain/fatura.test.ts`, adicione o import de `AjusteFechamento` e das duas funções novas:

```ts
import type { AjusteFechamento, Cartao, CompraCartao, ConferenciaFatura, Lancamento, RecorrenciaCartao } from './types';
import {
  ajustesDoCartao, calcularFaturas, categoriasFaturaIds, datasFaturaDoMes, dedupAjustesFechamento,
  diffSincronizacao, mesFaturaDaCompra, mesFechamentoDaCompra, resumoAssinaturasDoMes, resumoParcelamento,
  resumoPorCategoria, valorParcela,
} from './fatura';
```

E, logo depois do `describe('mesFaturaDaCompra e datasFaturaDoMes', ...)` (depois da linha 36), adicione:

```ts
function ajusteFechamento(cartaoId: string, mes: string, diaFechamento: number): AjusteFechamento {
  return { id: `af-${cartaoId}-${mes}`, cartaoId, mes, diaFechamento, criadoEm: '', alteradoEm: '' };
}

describe('ajustesDoCartao e override de fechamento', () => {
  it('sem ajuste, comportamento idêntico ao de hoje', () => {
    expect(mesFechamentoDaCompra(nubank, '2026-07-29')).toBe('2026-08');
  });

  it('ajuste no mês da compra move o limite do fechamento', () => {
    const ajustes = ajustesDoCartao([ajusteFechamento('k1', '2026-07', 30)], 'k1');
    // sem ajuste, dia 29 já passou do fechamento padrão (28) e cairia em agosto
    expect(mesFechamentoDaCompra(nubank, '2026-07-29', ajustes)).toBe('2026-07');
    // dia 30 (o novo fechamento) ainda cai no ciclo seguinte, igual à regra do dia exato
    expect(mesFechamentoDaCompra(nubank, '2026-07-30', ajustes)).toBe('2026-08');
  });

  it('ajustesDoCartao ignora ajustes de outro cartão', () => {
    const ajustes = ajustesDoCartao([ajusteFechamento('k2', '2026-07', 30)], 'k1');
    expect(ajustes.size).toBe(0);
  });

  it('datasFaturaDoMes usa o ajuste do mês de fechamento da fatura', () => {
    const ajustes = ajustesDoCartao([ajusteFechamento('k1', '2026-07', 30)], 'k1');
    // fatura de vencimento 2026-08 fecha em 2026-07 (nubank: diaVencimento 5 < diaFechamento 28)
    expect(datasFaturaDoMes(nubank, '2026-08', ajustes))
      .toEqual({ dataFechamento: '2026-07-30', dataVencimento: '2026-08-05' });
  });

  it('calcularFaturas reclassifica compra perto da virada quando o fechamento é adiado', () => {
    const ajustes = ajustesDoCartao([ajusteFechamento('k1', '2026-07', 30)], 'k1');
    const fs = calcularFaturas(nubank, [compra('2026-07-29', 5000)], '2026-12-31', ajustes);
    // sem ajuste essa compra cairia em 2026-09 (fecha 07-28, rola pra fatura de vencimento 09);
    // com o fechamento adiado pro dia 30, o dia 29 fica antes do fechamento e cai em 2026-08
    expect(fs.map((f) => f.mes)).toEqual(['2026-08']);
  });

  it('ajuste que empurra o fechamento além do vencimento produz o ciclo invertido, sem travar', () => {
    // outro: diaFechamento 10, diaVencimento 20 — ajuste move o fechamento de julho pro dia 25
    const ajustes = ajustesDoCartao([ajusteFechamento('k1', '2026-07', 25)], 'k1');
    expect(datasFaturaDoMes(outro, '2026-07', ajustes))
      .toEqual({ dataFechamento: '2026-07-25', dataVencimento: '2026-07-20' });
  });
});

describe('dedupAjustesFechamento', () => {
  it('mesmo cartão e mês: vence o alteradoEm mais recente, empate pelo id', () => {
    const a = { id: 'a1', cartaoId: 'k1', mes: '2026-07', diaFechamento: 28, criadoEm: '', alteradoEm: '2026-01-01' };
    const b = { id: 'a2', cartaoId: 'k1', mes: '2026-07', diaFechamento: 30, criadoEm: '', alteradoEm: '2026-02-01' };
    expect(dedupAjustesFechamento([a, b]).map((x) => x.id)).toEqual(['a2']);
    const empateA = { ...a, alteradoEm: '2026-02-01' };
    const empateB = { ...b, alteradoEm: '2026-02-01', id: 'a0' };
    expect(dedupAjustesFechamento([empateA, empateB]).map((x) => x.id)).toEqual(['a1']);
  });

  it('cartões ou meses diferentes: nenhum é descartado', () => {
    const a = ajusteFechamento('k1', '2026-07', 28);
    const b = ajusteFechamento('k1', '2026-08', 28);
    const c = ajusteFechamento('k2', '2026-07', 28);
    expect(dedupAjustesFechamento([a, b, c]).map((x) => x.id).sort()).toEqual(
      [a.id, b.id, c.id].sort(),
    );
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/domain/fatura.test.ts -t "ajustesDoCartao"`
Expected: FAIL — `ajustesDoCartao` e `dedupAjustesFechamento` não existem em `./fatura`.

- [ ] **Step 3: Implementar em `fatura.ts`**

No topo do arquivo, troque o import de tipos:

```ts
import { addMeses, dataComDia, mesDe } from './dates';
import type {
  AjusteFechamento, Cartao, CompraCartao, ConferenciaFatura, ID, ISODate, Lancamento, RecorrenciaCartao,
} from './types';
```

Substitua as 4 funções a seguir (mantendo tudo o resto do arquivo igual):

```ts
/** Mês ('AAAA-MM') cujo fechamento recolhe a compra. Compra no dia do fechamento
 *  entra na fatura seguinte (o primeiro fechamento ESTRITAMENTE posterior à data).
 *  `ajustes` (mês calendário de fechamento → dia override, ver `ajustesDoCartao`) substitui
 *  `cartao.diaFechamento` quando existe entrada para o mês da própria compra. */
export function mesFechamentoDaCompra(
  cartao: CicloCartao, data: ISODate, ajustes?: ReadonlyMap<string, number>,
): string {
  const [ano, mes] = data.split('-').map(Number);
  const mesCompra = mesDe(data);
  const diaFechamento = ajustes?.get(mesCompra) ?? cartao.diaFechamento;
  const fechamentoDoMes = dataComDia(ano, mes, diaFechamento);
  return data < fechamentoDoMes ? mesCompra : addMeses(mesCompra, 1);
}

/** Mês do vencimento da fatura que fecha no mês dado. */
export function mesVencimentoDoFechamento(cartao: CicloCartao, mesFechamento: string): string {
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : addMeses(mesFechamento, 1);
}

/** Mês ('AAAA-MM' do vencimento — a chave da fatura) onde cai a parcela 1 da compra. */
export function mesFaturaDaCompra(
  cartao: CicloCartao, data: ISODate, ajustes?: ReadonlyMap<string, number>,
): string {
  return mesVencimentoDoFechamento(cartao, mesFechamentoDaCompra(cartao, data, ajustes));
}

/** Datas de fechamento e vencimento da fatura cujo vencimento cai no mês dado. O mês
 *  calendário de fechamento é sempre calculado a partir do `diaVencimento`/`diaFechamento`
 *  PADRÃO do cartão (não do override) — só o dia dentro desse mês pode vir de `ajustes`. */
export function datasFaturaDoMes(
  cartao: CicloCartao, mesVencimento: string, ajustes?: ReadonlyMap<string, number>,
): { dataFechamento: ISODate; dataVencimento: ISODate } {
  const mesFechamento = cartao.diaVencimento > cartao.diaFechamento
    ? mesVencimento
    : addMeses(mesVencimento, -1);
  const [anoF, mesF] = mesFechamento.split('-').map(Number);
  const [anoV, mesV] = mesVencimento.split('-').map(Number);
  const diaFechamento = ajustes?.get(mesFechamento) ?? cartao.diaFechamento;
  return {
    dataFechamento: dataComDia(anoF, mesF, diaFechamento),
    dataVencimento: dataComDia(anoV, mesV, cartao.diaVencimento),
  };
}
```

E `calcularFaturas` (mesma assinatura, um parâmetro a mais no fim, repassado às duas chamadas internas):

```ts
/** Faturas derivadas das compras até `ate` (vencimento), ordenadas por mês. Função pura. */
export function calcularFaturas(
  cartao: CicloCartao, compras: CompraCartao[], ate: ISODate, ajustes?: ReadonlyMap<string, number>,
): Fatura[] {
  const porMes = new Map<string, Fatura>();
  for (const c of compras) {
    const mesFech1 = mesFechamentoDaCompra(cartao, c.data, ajustes);
    for (let n = 1; n <= c.parcelas; n++) {
      const mes = mesVencimentoDoFechamento(cartao, addMeses(mesFech1, n - 1));
      const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
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

Por fim, adicione as duas funções novas depois de `dedupConferencias` (depois da linha 152):

```ts
/** Filtra os ajustes de fechamento de um cartão específico e converte para o formato que
 *  `mesFechamentoDaCompra`/`datasFaturaDoMes`/`calcularFaturas` consultam: mês calendário
 *  do fechamento → dia override. Assume a entrada já deduplicada (`dedupAjustesFechamento`) —
 *  mesma divisão de responsabilidade de `valorSincronizado` em relação a `dedupConferencias`. */
export function ajustesDoCartao(ajustes: AjusteFechamento[], cartaoId: ID): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const a of ajustes) {
    if (a.cartaoId === cartaoId) mapa.set(a.mes, a.diaFechamento);
  }
  return mapa;
}

/**
 * Ajuste de fechamento é único por cartão e mês, mas o índice `[cartaoId+mes]` do Dexie não é
 * unique — mesmo cuidado de `dedupConferencias`. Vence o `alteradoEm` mais recente; empate
 * desempata pelo id. Aplicado em todo caminho que grava o snapshot inteiro.
 */
export function dedupAjustesFechamento(as: AjusteFechamento[]): AjusteFechamento[] {
  const porCartaoMes = new Map<string, AjusteFechamento>();
  for (const a of as) {
    const chave = `${a.cartaoId}|${a.mes}`;
    const atual = porCartaoMes.get(chave);
    const vence = !atual
      || a.alteradoEm > atual.alteradoEm
      || (a.alteradoEm === atual.alteradoEm && a.id > atual.id);
    if (vence) porCartaoMes.set(chave, a);
  }
  return [...porCartaoMes.values()];
}
```

- [ ] **Step 4: Rodar os testes de `fatura.ts` e confirmar que passam**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS — toda a suíte, incluindo os testes novos desta tarefa.

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: erros restantes só em `src/db/repo.ts` e `src/backup/backup.ts` (ainda não usam as funções novas — resolvido nas próximas tarefas).

- [ ] **Step 6: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(fatura): override de dia de fechamento por mês nas funções de cálculo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 4: Backup schema 5

**Files:**
- Modify: `src/backup/backup.ts`
- Modify: `src/backup/backup.test.ts`

**Interfaces:**
- Consumes: `AjusteFechamento` (Task 1), `dedupAjustesFechamento` (Task 3).
- Produces: `Backup.schema: 5`; `validarBackup` exige `ajustesFechamento` a partir do schema 5; `mesclar` mescla e deduplica `ajustesFechamento`.

- [ ] **Step 1: Escrever os testes adversariais que falham**

Em `src/backup/backup.test.ts`, ajuste as duas asserções de schema existentes:

```ts
it('round-trip: gerar → serializar → validar', () => {
  const b = gerarBackup(dados());
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.boxes).toHaveLength(1);
  expect(volta.schema).toBe(5);
});
```

```ts
it('gerarBackup emite schema 5', () => {
  const b = gerarBackup(dados());
  expect(b.schema).toBe(5);
});
```

E adicione, no fim do arquivo, um novo bloco:

```ts
// ---------- ajuste de fechamento: schema 5 ----------

it('aceita backup schema 4 preenchendo ajustesFechamento vazia', () => {
  const b = validarBackup({
    app: 'flow', schema: 4, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
    },
  });
  expect(b.schema).toBe(5);
  expect(b.dados.ajustesFechamento).toEqual([]);
});

it('recusa backup schema 5 sem a tabela ajustesFechamento', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 5, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

it('recusa backup schema 5 com ajustesFechamento que não é array', () => {
  expect(() => validarBackup({
    app: 'flow', schema: 5, exportadoEm: '2026-09-01T00:00:00.000Z',
    dados: {
      boxes: [], categorias: [], lancamentos: [], recorrencias: [], cenarios: [],
      cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
      conferenciasFatura: [], viagens: [], bancos: [], config: { id: 'config' },
      ajustesFechamento: { dia: 30 },
    },
  })).toThrow(/estrutura de dados inesperada/);
});

function ajuste(id: string, mes: string, diaFechamento: number, alteradoEm: string) {
  return { id, cartaoId: 'k1', mes, diaFechamento, criadoEm: '2026-01-01', alteradoEm };
}

it('mesclar deixa um só ajuste de fechamento por cartão e mês, o mais recente', () => {
  const a = dados();
  const b = dados();
  a.ajustesFechamento = [ajuste('af1', '2026-07', 28, '2026-07-01')];
  b.ajustesFechamento = [ajuste('af2', '2026-07', 30, '2026-07-10')];
  const m = mesclar(a, b).ajustesFechamento;
  expect(m).toHaveLength(1);
  expect(m[0]).toMatchObject({ id: 'af2', diaFechamento: 30 });
});

it('mesclar preserva ajustes de meses e cartões diferentes', () => {
  const a = dados();
  const b = dados();
  a.ajustesFechamento = [ajuste('af1', '2026-07', 28, '2026-07-01')];
  b.ajustesFechamento = [
    ajuste('af2', '2026-08', 15, '2026-08-01'),
    { ...ajuste('af3', '2026-07', 20, '2026-07-01'), cartaoId: 'k2' },
  ];
  expect(mesclar(a, b).ajustesFechamento.map((x) => x.id).sort()).toEqual(['af1', 'af2', 'af3']);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/backup/backup.test.ts`
Expected: FAIL — `validarBackup`/`gerarBackup`/`mesclar` ainda não sabem de `ajustesFechamento`.

- [ ] **Step 3: Implementar o schema 5 em `backup.ts`**

```ts
import { dedupAjustesFechamento, dedupConferencias } from '../domain/fatura';
import type { Dados } from '../domain/types';

export interface Backup {
  app: 'flow';
  schema: 5;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 5, exportadoEm: new Date().toISOString(), dados };
}

const TABELAS_V1 = ['boxes', 'categorias', 'lancamentos', 'recorrencias', 'cenarios'] as const;
const TABELAS_CARTAO = [
  'cartoes', 'categoriasCartao', 'comprasCartao', 'recorrenciasCartao', 'conferenciasFatura',
] as const;
const TABELAS_VIAGEM = ['viagens'] as const;
const TABELAS_BANCO = ['bancos'] as const;
const TABELAS_AJUSTE_FECHAMENTO = ['ajustesFechamento'] as const;

export function validarBackup(json: unknown): Backup {
  const b = json as { app?: unknown; schema?: unknown; exportadoEm?: unknown; dados?: Record<string, unknown> } | null;
  if (!b || typeof b !== 'object' || b.app !== 'flow') {
    throw new Error('Este arquivo não é um backup do Flow.');
  }
  if (b.schema !== 1 && b.schema !== 2 && b.schema !== 3 && b.schema !== 4 && b.schema !== 5) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
  const d = b.dados;
  if (!d || TABELAS_V1.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // `typeof null === 'object'` e `typeof [] === 'object'`: sem estes dois testes um config
  // nulo atravessa a validação inteira e só quebra no `db.config.put` do repo, com mensagem
  // obscura (o import cai fora por rollback da transação, sem perder dados, mas sem explicar).
  if (!d.config || typeof d.config !== 'object' || Array.isArray(d.config)) {
    throw new Error('Backup corrompido: configuração ausente ou inválida.');
  }
  if (b.schema >= 2 && TABELAS_CARTAO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // >= e não ===: schema 3 era o mais novo quando esta checagem nasceu, mas todo schema
  // seguinte também tem que ter viagens bem formada — do contrário um backup mais novo sem
  // viagens passaria batido (não é < 3, não backfila; não é === 3, não valida).
  if (b.schema >= 3 && TABELAS_VIAGEM.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // bancos nasceu no schema 4: a partir daqui é obrigatória e bem formada.
  if (b.schema >= 4 && TABELAS_BANCO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // backups de schema < 4 já existentes (gerados antes do bump) podem trazer `bancos` mesmo
  // assim, porque a entidade nasceu no código antes do schema subir — nesse caso ela é opcional
  // (backfill abaixo), mas se vier, tem que vir como array.
  if (d.bancos !== undefined && TABELAS_BANCO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // ajustesFechamento nasceu no schema 5: a partir daqui é obrigatória e bem formada.
  if (b.schema >= 5 && TABELAS_AJUSTE_FECHAMENTO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  if (d.ajustesFechamento !== undefined && TABELAS_AJUSTE_FECHAMENTO.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  const dados = { ...d } as unknown as Dados;
  // 'config' é a chave primária do registro único; um backup sem ela faz o `put` do repo
  // gravar sem chave e falhar. O id é constante por definição — impor aqui é barato.
  dados.config = { ...dados.config, id: 'config' };
  if (b.schema === 1) {
    // backup antigo: tabelas do cartão nasceram depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_CARTAO) md[t] = [];
  }
  if (b.schema < 3) {
    // backup antigo: viagens nasceu depois
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_VIAGEM) md[t] = [];
  }
  if (!Array.isArray(dados.bancos)) {
    // backup de schema < 4 sem a chave bancos: entidade nasceu antes do bump de schema.
    // Para schema >= 4 este ramo é inalcançável — a checagem obrigatória acima já teria
    // lançado antes de chegar aqui — mas a condição por array (em vez de por schema) evita
    // sobrescrever com [] um `bancos` real que já exista num backup de schema < 4.
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_BANCO) md[t] = [];
  }
  if (!Array.isArray(dados.ajustesFechamento)) {
    // mesmo raciocínio de `bancos`: backfill por ausência do array, não por número de schema.
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_AJUSTE_FECHAMENTO) md[t] = [];
  }
  return {
    app: 'flow', schema: 5,
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
    conferenciasFatura: dedupConferencias(
      mesclarTabela(atual.conferenciasFatura, doBackup.conferenciasFatura),
    ),
    viagens: mesclarTabela(atual.viagens, doBackup.viagens),
    bancos: mesclarTabela(atual.bancos, doBackup.bancos),
    ajustesFechamento: dedupAjustesFechamento(
      mesclarTabela(atual.ajustesFechamento, doBackup.ajustesFechamento),
    ),
    config: atual.config,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/backup/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: erros restantes só em `src/db/repo.ts` (ainda não persiste `ajustesFechamento` — resolvido na Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/backup/backup.ts src/backup/backup.test.ts
git commit -m "feat(backup): schema 5 com ajustesFechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 5: `resumoAssinaturasDoMes` passa a considerar o ajuste

**Files:**
- Modify: `src/domain/fatura.ts`
- Modify: `src/domain/fatura.test.ts`

**Interfaces:**
- Consumes: `ajustesDoCartao` (Task 3).
- Produces: `resumoAssinaturasDoMes` ganha parâmetro opcional final `ajustesFechamento: AjusteFechamento[] = []`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/domain/fatura.test.ts`, dentro do `describe('resumoAssinaturasDoMes', ...)`, depois do teste "ignora cartões fora das boxes selecionadas" (linha 224-230), adicione:

```ts
  it('aplica o ajuste de fechamento do cartão ao agrupar a compra de assinatura', () => {
    const compraAssinatura = { ...compra('2026-07-12', 3990), recorrenciaCartaoId: 'ass1' };
    const ajustes = [ajusteFechamento('k1', '2026-07', 15)];
    // cartaoNubank: diaFechamento 10 — sem ajuste, dia 12 já passou do fechamento e cai em agosto
    const semAjuste = resumoAssinaturasDoMes('2026-07', ['b1'], [cartaoNubank], [compraAssinatura], [assNetflix]);
    expect(semAjuste.totalCent).toBe(0);
    // com o fechamento adiado pro dia 15, o dia 12 volta a cair em julho
    const comAjuste = resumoAssinaturasDoMes(
      '2026-07', ['b1'], [cartaoNubank], [compraAssinatura], [assNetflix], ajustes,
    );
    expect(comAjuste.totalCent).toBe(3990);
  });
```

(`ajusteFechamento` já foi definido na Task 3, no topo do arquivo — reaproveite.)

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/fatura.test.ts -t "aplica o ajuste de fechamento do cartão ao agrupar"`
Expected: FAIL — `resumoAssinaturasDoMes` ainda ignora o 6º argumento.

- [ ] **Step 3: Implementar**

Em `src/domain/fatura.ts`, troque a assinatura e o corpo de `resumoAssinaturasDoMes`:

```ts
/** Total e detalhamento (por cartão > assinatura) das compras geradas por assinatura que
 *  caem na fatura do mês dado, entre os cartões das boxes selecionadas. */
export function resumoAssinaturasDoMes(
  mes: string,
  boxIds: readonly ID[],
  cartoes: Cartao[],
  comprasCartao: CompraCartao[],
  recorrenciasCartao: RecorrenciaCartao[],
  ajustesFechamento: AjusteFechamento[] = [],
): ResumoAssinaturas {
  const itens: ItemResumoAssinaturas[] = [];
  for (const cartao of cartoes) {
    if (!boxIds.includes(cartao.boxId)) continue;
    const comprasDoCartao = comprasCartao.filter(
      (c) => c.cartaoId === cartao.id && c.recorrenciaCartaoId != null,
    );
    if (comprasDoCartao.length === 0) continue;
    const ajustes = ajustesDoCartao(ajustesFechamento, cartao.id);
    const ate = datasFaturaDoMes(cartao, mes, ajustes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDoCartao, ate, ajustes).find((f) => f.mes === mes);
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

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS — toda a suíte de `fatura.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(fatura): resumoAssinaturasDoMes considera o ajuste de fechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 6: Persistência em `src/db/repo.ts`

**Files:**
- Modify: `src/db/repo.ts`
- Modify: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: `AjusteFechamento` (Task 1), `ajustesDoCartao`, `dedupAjustesFechamento` (Task 3).
- Produces: `export async function salvarAjusteFechamento(cartaoId: ID, mes: string, diaFechamento: number, horizonte: ISODate): Promise<void>`; `export async function removerAjusteFechamento(cartaoId: ID, mes: string, horizonte: ISODate): Promise<void>`; `carregarTudo()` devolve `ajustesFechamento`; `substituirTudo` grava (deduplicado); `sincronizarCartoes` passa o ajuste de cada cartão para `calcularFaturas`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/db/repo.test.ts`, adicione ao fim do arquivo:

```ts
describe('AjusteFechamento', () => {
  it('salvarAjusteFechamento reclassifica a fatura; removerAjusteFechamento volta ao padrão', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao(); // diaFechamento 28, diaVencimento 5
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-29',
        valorTotal: 5000, parcelas: 1,
      }, '2027-12-31');
      // sem ajuste: dia 29 já passou do fechamento (28) e a compra cai na fatura de 2026-09
      let previstos = (await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao');
      expect(previstos.find((l) => l.faturaMes === '2026-09')?.valor).toBe(5000);
      expect(previstos.find((l) => l.faturaMes === '2026-08')).toBeUndefined();

      await repo.salvarAjusteFechamento(cartao.id, '2026-07', 30, '2027-12-31');
      previstos = (await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao');
      expect(previstos.find((l) => l.faturaMes === '2026-08')?.valor).toBe(5000);
      expect(previstos.find((l) => l.faturaMes === '2026-09')).toBeUndefined();

      await repo.removerAjusteFechamento(cartao.id, '2026-07', '2027-12-31');
      previstos = (await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao');
      expect(previstos.find((l) => l.faturaMes === '2026-09')?.valor).toBe(5000);
      expect(previstos.find((l) => l.faturaMes === '2026-08')).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });

  it('sincronização depois do ajuste nunca reescreve um lançamento de fatura já efetivo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { cartao, catCartao } = await montarCartao();
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-29',
        valorTotal: 5000, parcelas: 1,
      }, '2027-12-31');
      const previsto = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-09')!;
      await repo.atualizarLancamento(previsto.id, { status: 'efetivo' });

      await repo.salvarAjusteFechamento(cartao.id, '2026-07', 30, '2027-12-31');

      const efetivo = await db.lancamentos.get(previsto.id);
      expect(efetivo).toMatchObject({ status: 'efetivo', faturaMes: '2026-09', valor: 5000 });
    } finally { vi.useRealTimers(); }
  });

  it('carregarTudo devolve a tabela nova (vazia num banco novo)', async () => {
    const dados = await repo.carregarTudo();
    expect(dados.ajustesFechamento).toEqual([]);
  });

  it('substituirTudo deduplica ajustes de fechamento do mesmo cartão e mês', async () => {
    const dados = await repo.carregarTudo();
    const base = { cartaoId: 'k1', mes: '2026-07', criadoEm: '2026-07-01' };
    await repo.substituirTudo({
      ...dados,
      ajustesFechamento: [
        { ...base, id: 'af1', diaFechamento: 28, alteradoEm: '2026-07-01' },
        { ...base, id: 'af2', diaFechamento: 30, alteradoEm: '2026-07-10' },
      ],
    });
    const depois = await db.ajustesFechamento.toArray();
    expect(depois.map((a) => a.id)).toEqual(['af2']);
    expect(depois[0].diaFechamento).toBe(30);
  });
});
```

(A Task 1 já adicionou `ajustesFechamento: []` ao objeto `dadosNovos: Dados` do teste "substituirTudo troca completamente os dados..." — nenhuma mudança extra aí.)

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/db/repo.test.ts -t "AjusteFechamento"`
Expected: FAIL — `repo.salvarAjusteFechamento` não existe.

- [ ] **Step 3: Implementar em `repo.ts`**

Atualize os imports do topo:

```ts
import { compararCategorias, compararCategoriasCartao } from '../domain/categorias';
import { hojeISO } from '../domain/dates';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, dedupAjustesFechamento, dedupConferencias,
  diffSincronizacao, type PlanoParcelamento,
} from '../domain/fatura';
import { materializar, ocorrencias } from '../domain/recurrence';
import {
  agoraISO, novoId,
  type AjusteFechamento, type Banco, type Box, type Cartao, type Categoria, type CategoriaCartao,
  type Cenario, type CompraCartao, type Config, type Dados, type ID, type ISODate, type Lancamento,
  type Recorrencia, type RecorrenciaCartao, type StatusLancamento, type TipoCategoria, type Viagem,
} from '../domain/types';
import { db } from './database';
```

Em `carregarTudo`, adicione `ajustesFechamento` ao `Promise.all` e ao objeto de retorno:

```ts
  const [
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos,
    ajustesFechamento,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(), db.viagens.toArray(), db.bancos.toArray(),
    db.ajustesFechamento.toArray(),
  ]);
  // ordem canônica na fonte: todo consumidor do snapshot herda a ordem de Ajustes
  categorias.sort(compararCategorias);
  categoriasCartao.sort(compararCategoriasCartao);
  // mais recente primeiro: id (UUID) não reflete ordem de criação, então listas que
  // dependem da ordem de inserção (ex.: lançamentos do mesmo dia no Fluxo) precisam
  // disso na fonte, não em cada tela.
  lancamentos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return {
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos,
    ajustesFechamento, config,
  };
```

Em `substituirTudo`, adicione a tabela e o `bulkAdd` deduplicado:

```ts
export async function substituirTudo(d: Dados): Promise<void> {
  const tabelas = [
    db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios,
    db.cartoes, db.categoriasCartao, db.comprasCartao, db.recorrenciasCartao,
    db.conferenciasFatura, db.viagens, db.bancos, db.ajustesFechamento, db.config,
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
    // o modo "substituir" do import não passa por `mesclar`: sem isto, um backup com duas
    // conferências do mesmo cartão e mês grava as duas e uma fica órfã (ver dedupConferencias)
    await db.conferenciasFatura.bulkAdd(dedupConferencias(d.conferenciasFatura));
    await db.viagens.bulkAdd(d.viagens);
    await db.bancos.bulkAdd(d.bancos);
    await db.ajustesFechamento.bulkAdd(dedupAjustesFechamento(d.ajustesFechamento));
    await db.config.put({ ...d.config, mudancasDesdeBackup: false });
  });
}
```

Adicione as duas funções de CRUD depois de `removerConferenciaFatura` (depois da linha 580):

```ts
export async function salvarAjusteFechamento(
  cartaoId: ID, mes: string, diaFechamento: number, horizonte: ISODate,
): Promise<void> {
  await db.transaction('rw', db.ajustesFechamento, db.config, async () => {
    const agora = agoraISO();
    const ex = await db.ajustesFechamento.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.ajustesFechamento.update(ex.id, { diaFechamento, alteradoEm: agora });
    else {
      await db.ajustesFechamento.add({
        id: novoId(), cartaoId, mes, diaFechamento, criadoEm: agora, alteradoEm: agora,
      });
    }
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}

export async function removerAjusteFechamento(cartaoId: ID, mes: string, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.ajustesFechamento, db.config, async () => {
    const ex = await db.ajustesFechamento.where('[cartaoId+mes]').equals([cartaoId, mes]).first();
    if (ex) await db.ajustesFechamento.delete(ex.id);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}
```

Por fim, em `sincronizarCartoes`, inclua `db.ajustesFechamento` na transação, busque os ajustes de cada cartão e repasse para `calcularFaturas`:

```ts
export async function sincronizarCartoes(
  horizonte: ISODate, opts?: { permitirCicloAtualPara?: ID },
): Promise<void> {
  const hoje = hojeISO();
  await db.transaction('rw', [
    db.cartoes, db.comprasCartao, db.recorrenciasCartao, db.conferenciasFatura, db.ajustesFechamento,
    db.lancamentos,
  ], async () => {
    for (const ass of await db.recorrenciasCartao.toArray()) {
      await materializarAssinatura(ass, hoje, horizonte, {
        permitirCicloAtual: ass.id === opts?.permitirCicloAtualPara,
      });
    }
    for (const cartao of await db.cartoes.toArray()) {
      const [compras, conferencias, ajustes, existentes] = await Promise.all([
        db.comprasCartao.where('cartaoId').equals(cartao.id).toArray(),
        db.conferenciasFatura.where('cartaoId').equals(cartao.id).toArray(),
        db.ajustesFechamento.where('cartaoId').equals(cartao.id).toArray(),
        db.lancamentos.where('cartaoId').equals(cartao.id).toArray(),
      ]);
      const faturas = calcularFaturas(cartao, compras, horizonte, ajustesDoCartao(ajustes, cartao.id));
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

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/db/repo.test.ts`
Expected: PASS — toda a suíte de `repo.test.ts`.

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(repo): CRUD de AjusteFechamento e sincronização considera o ajuste

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 7: `totalViagemNoMes` e chamadas em `TelaAnalises.tsx`

**Files:**
- Modify: `src/domain/viagem.ts`
- Modify: `src/domain/viagem.test.ts`
- Modify: `src/ui/TelaAnalises.tsx`

**Interfaces:**
- Consumes: `ajustesDoCartao` (Task 3), `resumoAssinaturasDoMes` (Task 5).
- Produces: `totalViagemNoMes` ganha parâmetro opcional final `ajustesFechamento: AjusteFechamento[] = []`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/domain/viagem.test.ts`, verifique o import de tipos no topo e garanta que inclui `AjusteFechamento`, `Cartao` e `CompraCartao` (adicione o que faltar, mantendo o resto):

```ts
import { itensDaViagem, totalViagemNoMes, viagemAtivaEm, viagensSobrepoem } from './viagem';
import type { AjusteFechamento, Cartao, CompraCartao, Viagem } from './types';
```

Depois do bloco de testes existentes de `totalViagemNoMes` que usa compras de cartão (linhas ~144-165), adicione:

```ts
it('totalViagemNoMes aplica o ajuste de fechamento do cartão', () => {
  const v: Viagem = { id: 'v1', nome: 'x', dataInicio: '2026-07-01', dataFim: '2026-07-31', criadoEm: '', alteradoEm: '' };
  const cartao: Cartao = {
    id: 'k1', boxId: 'box1', nome: 'Nu', diaFechamento: 28, diaVencimento: 5,
    categoriaFaturaId: 'catFlow', ativo: true, criadoEm: '', alteradoEm: '',
  };
  const c: CompraCartao = {
    id: 'c1', cartaoId: 'k1', categoriaCartaoId: 'cat1', viagemId: 'v1',
    data: '2026-07-29', valorTotal: 5000, parcelas: 1, criadoEm: '', alteradoEm: '',
  };
  const ajustes: AjusteFechamento[] = [
    { id: 'af1', cartaoId: 'k1', mes: '2026-07', diaFechamento: 30, criadoEm: '', alteradoEm: '' },
  ];
  // sem ajuste: dia 29 já passou do fechamento (28), cai na fatura de vencimento 2026-09
  expect(totalViagemNoMes(v, '2026-09', ['box1'], [], [c], [cartao], true)).toBe(5000);
  expect(totalViagemNoMes(v, '2026-08', ['box1'], [], [c], [cartao], true)).toBe(0);
  // com o ajuste: fechamento adiado pro dia 30, cai na fatura de vencimento 2026-08
  expect(totalViagemNoMes(v, '2026-08', ['box1'], [], [c], [cartao], true, ajustes)).toBe(5000);
  expect(totalViagemNoMes(v, '2026-09', ['box1'], [], [c], [cartao], true, ajustes)).toBe(0);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/viagem.test.ts -t "totalViagemNoMes aplica o ajuste"`
Expected: FAIL — `totalViagemNoMes` ainda não aceita o 8º argumento (o resultado com ajuste sai igual ao sem ajuste).

- [ ] **Step 3: Implementar em `viagem.ts`**

Atualize os imports e a assinatura/corpo de `totalViagemNoMes`:

```ts
import { mesDe } from './dates';
import { ajustesDoCartao, calcularFaturas, datasFaturaDoMes } from './fatura';
import type { AjusteFechamento, Cartao, CompraCartao, ID, ISODate, Lancamento, Viagem } from './types';
```

```ts
/** Total gasto numa viagem restrito a um mês específico. Débito conta pela data do
 *  lançamento; compra de cartão conta pelo mês de VENCIMENTO de cada parcela (reaproveita
 *  `calcularFaturas`), não pelo mês da compra — uma compra parcelada durante a viagem
 *  continua aparecendo nos meses seguintes enquanto houver parcela pendente. */
export function totalViagemNoMes(
  viagem: Viagem,
  mes: string,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  comprasCartao: CompraCartao[],
  cartoes: Cartao[],
  incluirPrevistos: boolean,
  ajustesFechamento: AjusteFechamento[] = [],
): number {
  const sel = new Set(boxIds);
  let total = 0;
  for (const l of lancamentos) {
    if (l.viagemId !== viagem.id) continue;
    if (!sel.has(l.boxId) || mesDe(l.data) !== mes) continue;
    if (l.status !== 'efetivo' && !incluirPrevistos) continue;
    total += l.valor;
  }
  for (const cartao of cartoes) {
    if (!sel.has(cartao.boxId)) continue;
    const comprasDaViagem = comprasCartao.filter((c) => c.viagemId === viagem.id && c.cartaoId === cartao.id);
    if (comprasDaViagem.length === 0) continue;
    const ajustes = ajustesDoCartao(ajustesFechamento, cartao.id);
    const ate = datasFaturaDoMes(cartao, mes, ajustes).dataVencimento;
    const fatura = calcularFaturas(cartao, comprasDaViagem, ate, ajustes).find((f) => f.mes === mes);
    if (fatura) total += fatura.totalCent;
  }
  return total;
}
```

- [ ] **Step 4: Atualizar os chamadores em `TelaAnalises.tsx`**

Em `src/ui/TelaAnalises.tsx`, as chamadas de `resumoAssinaturasDoMes` (linha 37) e `totalViagemNoMes` (linha 46):

```ts
  const resumoAssinaturas = resumoAssinaturasDoMes(
    mes, ids, dados.cartoes, dados.comprasCartao, dados.recorrenciasCartao, dados.ajustesFechamento,
  );
```

```ts
  const viagensNoMes = dados.viagens
    .map((v) => ({
      viagem: v,
      total: totalViagemNoMes(
        v, mes, ids, dados.lancamentos, dados.comprasCartao, dados.cartoes, incluirPrevistos,
        dados.ajustesFechamento,
      ),
    }))
    .filter((x) => x.total !== 0);
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/domain/viagem.test.ts src/ui/TelaAnalises.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/viagem.ts src/domain/viagem.test.ts src/ui/TelaAnalises.tsx
git commit -m "feat(viagem): totalViagemNoMes considera o ajuste de fechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 8: Dossiê — `faturasPorCartao` e regeneração

**Files:**
- Modify: `src/dossie/retrato.ts`

**Interfaces:**
- Consumes: `ajustesDoCartao` (Task 3).
- Produces: `faturasPorCartao` passa a repassar `dados.ajustesFechamento` a `calcularFaturas`.

- [ ] **Step 1: Implementar**

Em `src/dossie/retrato.ts`, atualize o import e a função:

```ts
import { ajustesDoCartao, calcularFaturas, type Fatura } from '../domain/fatura';
```

```ts
/** Todas as faturas do snapshot, em ordem estável: por nome de cartão, depois por ciclo. */
export function faturasPorCartao(dados: Dados): FaturaDeCartao[] {
  return [...dados.cartoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .flatMap((cartao) => calcularFaturas(
      cartao,
      dados.comprasCartao.filter((c) => c.cartaoId === cartao.id),
      dados.config.horizonteProjecao,
      ajustesDoCartao(dados.ajustesFechamento, cartao.id),
    ).map((fatura) => ({ cartao, fatura })));
}
```

- [ ] **Step 2: Regenerar o dossiê e confirmar que não há diff de conteúdo**

Run: `npm run dossie`
Run: `git status --short docs/dossie/`
Expected: sem saída (nenhum arquivo mudou) — o roteiro do dossiê (`src/dossie/roteiro.ts`) não cadastra nenhum `AjusteFechamento`, então o mapa de ajustes fica sempre vazio e o comportamento é byte a byte idêntico ao de antes.

- [ ] **Step 3: Rodar a suíte do dossiê**

Run: `npx vitest run src/dossie`
Expected: PASS — inclui `dossie.test.ts` (confirma que `docs/dossie/` está em dia) e `invariantes.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/dossie/retrato.ts
git commit -m "feat(dossie): faturasPorCartao considera o ajuste de fechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

(Se o Step 2 mostrar arquivos alterados em `docs/dossie/`, inclua-os neste commit também — significa que o roteiro já tocava nalgum cenário sensível ao mês de fechamento, o que não é esperado, mas não deve ser descartado sem olhar o diff.)

---

### Task 9: `FaturaResumo.tsx`, `FaturaCategoriaSheet.tsx` e `TelaFluxo.tsx`

**Files:**
- Modify: `src/ui/FaturaResumo.tsx`
- Modify: `src/ui/FaturaCategoriaSheet.tsx`
- Modify: `src/ui/TelaFluxo.tsx`
- Modify: `src/ui/TelaAnalises.tsx`

**Interfaces:**
- Consumes: `ajustesDoCartao` (Task 3).
- Produces: as três telas passam a exibir a fatura já considerando o ajuste do mês.

Estas três telas hoje calculam faturas sem saber de ajustes; a lógica em si já foi validada nas Tasks 3-8, então esta tarefa é só plumbing — sem teste novo dedicado (a suíte existente dessas telas continua verde porque `dados.ajustesFechamento` é `[]` nos fixtures atuais, e o comportamento com `[]` é idêntico ao de antes).

- [ ] **Step 1: `FaturaResumo.tsx`**

```ts
import { ajustesDoCartao, calcularFaturas, type Fatura } from '../domain/fatura';
```

```ts
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const fatura = calcularFaturas(cartao, compras, dados.config.horizonteProjecao, ajustes)
    .find((f) => f.mes === lanc.faturaMes);
```

- [ ] **Step 2: `FaturaCategoriaSheet.tsx`**

Adicione a prop `ajustesFechamento` (opcional, default `[]` para não quebrar os 3 testes existentes que não a passam):

```ts
import { ajustesDoCartao, calcularFaturas, datasFaturaDoMes, resumoPorCategoria } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ISODate } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  cartao: Cartao | null;
  mes: string;
  comprasCartao: CompraCartao[];
  categoriasCartao: CategoriaCartao[];
  horizonteProjecao: ISODate;
  ajustesFechamento?: AjusteFechamento[];
  onFechar: () => void;
  onAbrirCartao: () => void;
}

export default function FaturaCategoriaSheet({
  aberto, cartao, mes, comprasCartao, categoriasCartao, horizonteProjecao, ajustesFechamento = [],
  onFechar, onAbrirCartao,
}: Props) {
  if (!cartao) return null;
  const compras = comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const ajustes = ajustesDoCartao(ajustesFechamento, cartao.id);
  const { dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
  const ate = dataVencimento > horizonteProjecao ? dataVencimento : horizonteProjecao;
  const fatura = calcularFaturas(cartao, compras, ate, ajustes).find((f) => f.mes === mes)
    ?? { mes, dataFechamento: dataVencimento, dataVencimento, itens: [], totalCent: 0 };
```

(o resto do arquivo continua igual.)

- [ ] **Step 3: `TelaAnalises.tsx` — passar a nova prop ao `FaturaCategoriaSheet`**

```ts
        <FaturaCategoriaSheet
          aberto={categoriaAberta !== null}
          cartao={cartaoDaCategoria}
          mes={mes}
          comprasCartao={dados.comprasCartao}
          categoriasCartao={dados.categoriasCartao}
          horizonteProjecao={dados.config.horizonteProjecao}
          ajustesFechamento={dados.ajustesFechamento}
          onFechar={() => setCategoriaAberta(null)}
          onAbrirCartao={() => { setAba('cartao'); setCategoriaAberta(null); }}
        />
```

- [ ] **Step 4: `TelaFluxo.tsx`**

```ts
import { ajustesDoCartao, calcularFaturas, type Fatura } from '../domain/fatura';
```

```ts
  const faturasCache = new Map<string, Fatura[]>();
  const faturasDoCartao = (cartaoId: string): Fatura[] => {
    let f = faturasCache.get(cartaoId);
    if (!f) {
      const cartao = dados.cartoes.find((c) => c.id === cartaoId);
      const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartaoId);
      f = cartao
        ? calcularFaturas(cartao, compras, dados.config.horizonteProjecao, ajustesDoCartao(dados.ajustesFechamento, cartaoId))
        : [];
      faturasCache.set(cartaoId, f);
    }
    return f;
  };
```

- [ ] **Step 5: Rodar as suítes dessas 4 telas e confirmar que passam sem mudança**

Run: `npx vitest run src/ui/FaturaResumo.test.tsx src/ui/FaturaCategoriaSheet.test.tsx src/ui/TelaFluxo.test.tsx src/ui/TelaAnalises.test.tsx`
Expected: PASS — nenhum teste existente muda de comportamento.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/ui/FaturaResumo.tsx src/ui/FaturaCategoriaSheet.tsx src/ui/TelaFluxo.tsx src/ui/TelaAnalises.tsx
git commit -m "feat(ui): FaturaResumo, FaturaCategoriaSheet e TelaFluxo consideram o ajuste de fechamento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 10: `TelaCartao.tsx` — bloco "Fechou dia ___ neste mês"

**Files:**
- Modify: `src/ui/TelaCartao.tsx`
- Modify: `src/ui/TelaCartao.test.tsx`

**Interfaces:**
- Consumes: `ajustesDoCartao` (Task 3), `repo.salvarAjusteFechamento`/`repo.removerAjusteFechamento` (Task 6).
- Produces: novo bloco `BlocoAjusteFechamento` na aba "Conferência" da fatura, abaixo de `BlocoConferencia`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/ui/TelaCartao.test.tsx`, depois do teste "botão Remover remove a conferência salva" (linha 99-138), adicione:

```ts
it('bloco de fechamento: salvar reclassifica a fatura, remover volta ao padrão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao(); // fecha dia 28
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-29',
      valorTotal: 5000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    // sem ajuste, a fatura mostrada por padrão (a próxima a vencer) é a de setembro
    expect(screen.getByText(/fatura 09\/2026/)).toBeInTheDocument();
    await abrirAba(/Conferência/);

    await userEvent.clear(screen.getByLabelText('Fechou dia'));
    await userEvent.type(screen.getByLabelText('Fechou dia'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar fechamento' }));

    await waitFor(async () => {
      const ajustes = await db.ajustesFechamento.toArray();
      expect(ajustes).toHaveLength(1);
      expect(ajustes[0]).toMatchObject({ cartaoId: cartao.id, mes: '2026-07', diaFechamento: 30 });
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remover fechamento' }));
    await waitFor(async () => {
      expect(await db.ajustesFechamento.count()).toBe(0);
    });
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaCartao.test.tsx -t "bloco de fechamento"`
Expected: FAIL — não existe rótulo "Fechou dia" nem botões "Salvar fechamento"/"Remover fechamento".

- [ ] **Step 3: Implementar o bloco em `TelaCartao.tsx`**

Atualize o import do domínio:

```ts
import { addMeses } from '../domain/dates';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, mesFaturaDaCompra, resumoPorCategoria, type Fatura,
} from '../domain/fatura';
```

Logo depois de `BlocoConferencia` (depois da linha 90), adicione:

```ts
/** Exceção pontual do dia de fechamento — mesmo idioma de `BlocoConferencia`, mas chaveada
 *  pelo mês CALENDÁRIO de fechamento (derivado de `fatura.dataFechamento`), não pelo mês de
 *  vencimento: é essa a chave que `AjusteFechamento` usa (ver docs/superpowers/specs/
 *  2026-09-02-ajuste-fechamento-fatura-design.md). */
function BlocoAjusteFechamento({ cartao, mesFechamento }: { cartao: Cartao; mesFechamento: string }) {
  const { dados, recarregar } = useApp();
  const existente = dados?.ajustesFechamento.find((a) => a.cartaoId === cartao.id && a.mes === mesFechamento);
  const [dia, setDia] = useState<string>(String(existente?.diaFechamento ?? cartao.diaFechamento));
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  async function salvar() {
    await repo.salvarAjusteFechamento(cartao.id, mesFechamento, clampDia(dia), horizonte);
    await recarregar();
  }

  async function remover() {
    if (existente) {
      await repo.removerAjusteFechamento(cartao.id, mesFechamento, horizonte);
      await recarregar();
      setDia(String(cartao.diaFechamento));
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Fechou dia</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={dia}
            onChange={(e) => setDia(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} aria-label="Salvar fechamento" onClick={salvar}>Salvar fechamento</button>
        {existente && (
          <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} aria-label="Remover fechamento" onClick={remover}>Remover fechamento</button>
        )}
      </div>
      <p className="sub" style={{ margin: '4px 0 0' }}>
        {existente
          ? `Este mês fechou dia ${existente.diaFechamento} em vez do padrão (dia ${cartao.diaFechamento}).`
          : `Padrão do cartão: dia ${cartao.diaFechamento}. Preencha só se este mês fechou num dia diferente.`}
      </p>
    </div>
  );
}
```

Em `CartaoFatura`, calcule `ajustes` e `mesFechamento` (o mês calendário da fatura já calculada) e repasse aos cálculos de fatura:

```ts
function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [editando, setEditando] = useState<CompraCartao | null>(null);
  const [filtroCategoriaId, setFiltroCategoriaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pagando, setPagando] = useState(false);
  const [abaCartao, setAbaCartao] = useState<AbaCartao>('resumo');
  if (!dados) return null;

  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
  const ate = dataVencimento > dados.config.horizonteProjecao ? dataVencimento : dados.config.horizonteProjecao;
  const fatura: Fatura = calcularFaturas(cartao, compras, ate, ajustes).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
  // prefixo de 7 caracteres de um ISODate = mês calendário (mesma conta de `mesDe`, sem
  // precisar importar de dates.ts aqui) — é essa a chave que `AjusteFechamento.mes` indexa.
  const mesFechamento = fatura.dataFechamento.slice(0, 7);
```

Na aba "Conferência", adicione o bloco novo abaixo do existente:

```tsx
      {abaCartao === 'conferencia' && (
        <div style={{ marginTop: 12 }}>
          <BlocoConferencia key={`${cartao.id}:${mes}`} cartao={cartao} mes={mes} totalCent={fatura.totalCent} />
          <BlocoAjusteFechamento key={`${cartao.id}:${mesFechamento}`} cartao={cartao} mesFechamento={mesFechamento} />
        </div>
      )}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaCartao.test.tsx`
Expected: PASS — toda a suíte de `TelaCartao.test.tsx`, incluindo o teste novo.

- [ ] **Step 5: Typecheck e build**

Run: `npx tsc -b --noEmit`
Run: `npm run build`
Expected: sem erros nos dois.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx
git commit -m "feat(ui): bloco de ajuste excepcional de fechamento na aba Conferência da fatura

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

---

### Task 11: Verificação final

**Files:** nenhum arquivo novo — só comandos de verificação, e a wiki se a leitura no Step 5 indicar necessidade.

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: PASS — toda a suíte, incluindo `src/dossie/dossie.test.ts`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros de TypeScript nem de bundling.

- [ ] **Step 3: Catálogo de estilo**

Run: `node scripts/verificar-catalogo.mjs`
Expected: sem avisos — nenhuma classe ou componente novo foi introduzido fora do já catalogado.

- [ ] **Step 4: Dados reais**

Run: `node scripts/verificar-dados-reais.mjs`
Expected: sem avisos.

- [ ] **Step 5: Conferir a wiki**

A feature muda o que o usuário vê (um controle novo na tela Cartão). Abra `docs/wiki/5-cartao.md` e adicione, na seção que já descreve fechamento/vencimento e a conferência de fatura, um parágrafo curto sobre o ajuste pontual — mesmo nível de detalhe do que já existe para a conferência de valor. Depois:

Run: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Expected: PASS — a wiki continua dentro do subconjunto de markdown que o parser aceita.

Este passo não tem código para mostrar aqui porque depende do texto atual de `docs/wiki/5-cartao.md` — leia o arquivo antes de editar e siga o estilo ASD-STE100 do resto do documento (frases curtas, uma ideia por frase, voz ativa).

- [ ] **Step 6: Commit da wiki (se houver mudança)**

```bash
git add docs/wiki/5-cartao.md
git commit -m "docs(wiki): documenta o ajuste excepcional de fechamento de fatura

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LVrW4MG56gPSkZAQFQLLnq"
```

- [ ] **Step 7: Não integrar ainda**

Esta tarefa termina o trabalho de implementação. **Não** rode `npm run release` nem `npm run deploy` — isso é o passo seguinte do ciclo de entrega (skill `ciclo-de-entrega`), que cobre fragmento de changelog, confirmação do usuário e merge na `main`.
