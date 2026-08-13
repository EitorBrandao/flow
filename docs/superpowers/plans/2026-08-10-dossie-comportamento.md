# Dossiê de comportamento — plano de implementação

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam caixa (`- [ ]`) para acompanhamento.

**Objetivo:** fazer a suíte emitir um dossiê determinístico e commitado do app se comportando ao longo de 12 meses sintéticos, para um agente revisor ler em dois recortes.

**Arquitetura:** um roteiro declarativo de passos datados roda pelas mutations de verdade (`src/db/repo.ts`) sobre `fake-indexeddb`, com relógio congelado e ids sequenciais. Em seis datas de corte, o executor tira um `Retrato`. Invariantes julgam os retratos; um extrator lê as telas renderizadas como texto; um serializador escreve quatro arquivos markdown em `docs/dossie/`. O `npm test` compara o resultado com o disco.

**Tecnologias:** TypeScript, Vitest, Testing Library, Dexie sobre `fake-indexeddb`, Zustand.

**Spec:** `docs/superpowers/specs/2026-08-10-dossie-comportamento-design.md`

## Restrições globais

Valem para **todas** as tarefas. Não repetidas em cada uma.

- **Texto em português.** Código, comentários, nomes de variável, mensagens de erro, descrições do roteiro, conteúdo do dossiê e mensagens de commit. Nunca palavra solta em inglês no meio.
- **Estilo do `CLAUDE.md`:** frases curtas, uma ideia por frase, voz ativa.
- **Dados sintéticos, sempre.** O dossiê é arquivo versionado num repositório público. Nomes, valores e estabelecimentos do roteiro são inventados. Nada de valor plausível de conta real.
- **Não aperte timeouts.** Nunca passe `{ timeout: n }` a um `findBy*`. Nunca mexa em `testTimeout`, `hookTimeout` nem `asyncUtilTimeout`.
- **Valores monetários são centavos inteiros. Datas são `"AAAA-MM-DD"`.**
- **Não toque em `src/ui/**`, `src/styles.css` nem `index.html`.** Esta feature lê a UI; não a altera. Se algo parecer exigir mudança de UI, pare e pergunte.
- **Não mexa em `src/domain/`, `src/db/` nem `src/backup/`.** Mesmo motivo.
- **Toda mensagem de commit termina com os dois trailers do repositório:**
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HuNSC4zkgWP7HXr1NMMS3P
  ```
- **Branch:** trabalhe em `dossie-comportamento`, no worktree `.worktrees/dossie-comportamento`. Nunca na `main`.
- **`npm test` roda a suíte inteira.** Para um arquivo só: `npx vitest run src/dossie/ambiente.test.ts`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/dossie/ambiente.ts` | Congela o relógio e sequencia os ids. Nada mais. |
| `src/dossie/retrato.ts` | Define o tipo `Retrato` e o extrai de um `Dados` numa data. |
| `src/dossie/executar.ts` | Roda um roteiro passo a passo e devolve os retratos. |
| `src/dossie/roteiro.ts` | O roteiro de 12 meses e as datas de corte. Só dado, sem lógica. |
| `src/dossie/tela.ts` | Renderiza uma aba e devolve o texto normalizado. |
| `src/dossie/invariantes.ts` | Os predicados, em duas formas e duas classes. |
| `src/dossie/serializar.ts` | Monta os quatro markdown. Determinístico. |
| `src/dossie/dossie.test.ts` | O guarda: regenera e compara com o disco. |
| `scripts/dossie.mjs` | `npm run dossie` — regenera e grava. |
| `docs/dossie/*.md` | A saída, commitada. |
| `.claude/skills/revisar-dossie/SKILL.md` | Os dois recortes de leitura. |

Cada módulo tem uma fronteira: o ambiente não sabe do roteiro, o roteiro não sabe do serializador, o extrator de tela não sabe dos invariantes.

---

### Tarefa 1: Ambiente determinístico

**Arquivos:**
- Criar: `src/dossie/ambiente.ts`
- Testar: `src/dossie/ambiente.test.ts`

**Interfaces:**
- Consome: `agoraISO`, `novoId` de `src/domain/types.ts`; `hojeISO` de `src/domain/dates.ts`.
- Produz:
  ```ts
  export interface Ambiente {
    avancarPara(data: ISODate): void;
    restaurar(): void;
  }
  export function instalarAmbiente(dataInicial: ISODate): Ambiente;
  ```

**Por que esta tarefa existe:** o app tem três fontes de não-determinismo, todas verificadas no código atual. `novoId()` (`src/domain/types.ts:156`) chama `crypto.randomUUID()`. `agoraISO()` (`types.ts:170`), `hojeISO()` (`src/domain/dates.ts:13`) e o horizonte padrão (`src/db/repo.ts:17` e `:30`) chamam `new Date()`. Sem controlar os três, o dossiê muda a cada rodada e não serve para nada.

**Duas armadilhas, ambas obrigatórias:**

1. `vi.useFakeTimers({ toFake: ['Date'] })` — **o `toFake` não é opcional.** Falsear `setTimeout` trava o Dexie, que depende dele para resolver transações. O teste vai pendurar até o timeout.
2. `crypto.randomUUID` pode ser somente-leitura no ambiente do jsdom. Use `Object.defineProperty`, não atribuição direta.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/ambiente.test.ts`:

```ts
import { hojeISO } from '../domain/dates';
import { agoraISO, novoId } from '../domain/types';
import { instalarAmbiente } from './ambiente';

it('sequencia os ids em ordem lexicográfica', () => {
  const amb = instalarAmbiente('2026-01-01');
  try {
    expect(novoId()).toBe('id-0001');
    expect(novoId()).toBe('id-0002');
    expect(novoId()).toBe('id-0003');
  } finally {
    amb.restaurar();
  }
});

it('congela o relógio na data inicial', () => {
  const amb = instalarAmbiente('2026-03-15');
  try {
    expect(hojeISO()).toBe('2026-03-15');
    expect(agoraISO()).toBe('2026-03-15T12:00:00.000Z');
  } finally {
    amb.restaurar();
  }
});

it('avança o relógio sem reiniciar o contador de ids', () => {
  const amb = instalarAmbiente('2026-01-01');
  try {
    expect(novoId()).toBe('id-0001');
    amb.avancarPara('2026-06-30');
    expect(hojeISO()).toBe('2026-06-30');
    expect(novoId()).toBe('id-0002');
  } finally {
    amb.restaurar();
  }
});

it('restaurar devolve o relógio e o gerador de id reais', () => {
  const amb = instalarAmbiente('2026-01-01');
  amb.restaurar();
  expect(novoId()).not.toBe('id-0002');
  expect(novoId()).toMatch(/^[0-9a-f]{8}-/);
});

it('recusa avançar para trás', () => {
  const amb = instalarAmbiente('2026-06-01');
  try {
    expect(() => amb.avancarPara('2026-05-31')).toThrow(/para trás/);
  } finally {
    amb.restaurar();
  }
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/ambiente.test.ts
```

Esperado: FALHA, com `Failed to resolve import "./ambiente"`.

- [ ] **Passo 3: implementar**

Criar `src/dossie/ambiente.ts`:

```ts
import { vi } from 'vitest';
import type { ISODate } from '../domain/types';

/**
 * Congela o relógio e sequencia os ids, para o dossiê sair igual a cada rodada.
 *
 * O meio-dia UTC não é arbitrário: `hojeISO()` deriva a data do fuso local, e uma hora
 * perto da meia-noite faria a data virar num fuso e não noutro.
 */
const HORA_FIXA = 'T12:00:00.000Z';

export interface Ambiente {
  /** Move o relógio para a data indicada. Só para a frente. */
  avancarPara(data: ISODate): void;
  /** Devolve relógio e gerador de id reais. Sempre num `finally`. */
  restaurar(): void;
}

export function instalarAmbiente(dataInicial: ISODate): Ambiente {
  let dataAtual = dataInicial;
  let contador = 0;

  // `toFake: ['Date']` é obrigatório: falsear setTimeout trava o Dexie, que depende dele
  // para resolver transação — o teste pendura até o timeout em vez de falhar.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${dataInicial}${HORA_FIXA}`));

  // `novoId()` consulta `crypto.randomUUID` na hora da chamada, não na carga do módulo —
  // por isso trocar a função aqui basta. Zero padding para a ordem lexicográfica do id
  // coincidir com a ordem de criação: `carregarTudo` desempata por chave primária.
  const original = globalThis.crypto.randomUUID;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: () => `id-${String(++contador).padStart(4, '0')}`,
  });

  return {
    avancarPara(data: ISODate) {
      if (data < dataAtual) {
        throw new Error(`o roteiro não anda para trás: ${dataAtual} → ${data}`);
      }
      dataAtual = data;
      vi.setSystemTime(new Date(`${data}${HORA_FIXA}`));
    },
    restaurar() {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: original,
      });
      vi.useRealTimers();
    },
  };
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

```
npx vitest run src/dossie/ambiente.test.ts
```

Esperado: 5 testes passando.

- [ ] **Passo 5: commitar**

```bash
git add src/dossie/ambiente.ts src/dossie/ambiente.test.ts
git commit -m "Ambiente determinístico do dossiê: relógio congelado e ids sequenciais"
```

---

### Tarefa 2: Retrato e executor, com roteiro mínimo

**Arquivos:**
- Criar: `src/dossie/retrato.ts`, `src/dossie/executar.ts`
- Testar: `src/dossie/executar.test.ts`

**Interfaces:**
- Consome: `instalarAmbiente` da Tarefa 1; `carregarTudo`, `salvarBox`, `salvarCategoria`, `salvarLancamento` de `src/db/repo.ts`; `projetarBoxes` de `src/domain/projection.ts`; `calcularFaturas` de `src/domain/fatura.ts`; `limparDb` de `src/test-setup.ts`.
- Produz:
  ```ts
  // retrato.ts
  export interface SaldoBox { boxId: ID; nome: string; efetivo: number; projetado: number; comCenarios: number }
  export interface MarcosProjecao { minimo: DiaSaldo | null; maximo: DiaSaldo | null; fimDeMes: DiaSaldo[] }
  export interface Retrato {
    data: ISODate;
    rotulo: string;
    saldos: SaldoBox[];
    marcos: MarcosProjecao;
    /** Série dia a dia consolidada. Fica em memória para os invariantes; não vai ao dossiê. */
    serie: DiaSaldo[];
    faturas: Fatura[];
    contagemPorStatusOrigem: Record<string, number>;
    dados: Dados;
  }
  export function tirarRetrato(dados: Dados, data: ISODate, rotulo: string): Retrato;

  // executar.ts
  export interface Passo {
    data: ISODate;
    descricao: string;
    executar(dados: Dados): Promise<void>;
  }
  export interface Corte { data: ISODate; rotulo: string }
  export interface Roteiro { passos: Passo[]; cortes: Corte[] }
  export async function executarRoteiro(roteiro: Roteiro): Promise<Retrato[]>;
  ```

**Notas de implementação, todas verificadas no código:**

- `executarRoteiro` intercala passos e cortes em ordem cronológica. Antes de cada passo, `ambiente.avancarPara(passo.data)`; depois, `carregarTudo()` para o passo seguinte receber o snapshot fresco.
- Chame `repo.materializarTodas(horizonte)` e `repo.sincronizarCartoes(horizonte)` **antes de cada corte**. É o que `iniciar()` (`src/state/store.ts:43-44`) faz, e sem isso o retrato não vê recorrência nem fatura do período que acabou de passar.
- A box `'casa'` é autocriada por `iniciar()`, não pelo `repo`. O executor a cria explicitamente no começo, do mesmo jeito que `store.ts:38-41`.
- `projetarBoxes` recebe `boxIds` e uma `EntradaProjecao`. Para o retrato consolidado, passe **todas** as boxes — é o que `boxIdsSelecionadas(dados, 'casa')` devolve.
- Passo que estoura interrompe tudo. Embrulhe com o número, a data e a descrição do passo.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/executar.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import * as repo from '../db/repo';
import { executarRoteiro, type Roteiro } from './executar';

beforeEach(async () => {
  await limparDb();
});

/** Roteiro mínimo: uma box, uma categoria, um ganho, um gasto previsto. */
function roteiroMinimo(): Roteiro {
  return {
    passos: [
      {
        data: '2026-01-01',
        descricao: 'abre a box "carteira" com saldo inicial de R$ 1.000,00',
        async executar() {
          await repo.salvarBox({
            id: 'box-carteira', nome: 'carteira',
            saldoInicial: 100000, dataSaldoInicial: '2026-01-01',
            criadoEm: '2026-01-01T12:00:00.000Z', alteradoEm: '2026-01-01T12:00:00.000Z',
          });
          await repo.salvarCategoria({ boxId: 'box-carteira', nome: 'renda', tipo: 'ganho', ordem: 0 });
        },
      },
      {
        data: '2026-02-10',
        descricao: 'recebe R$ 300,00 de renda',
        async executar(dados) {
          const renda = dados.categorias.find((c) => c.nome === 'renda')!;
          await repo.salvarLancamento({
            boxId: 'box-carteira', categoriaId: renda.id,
            data: '2026-02-10', valor: 30000, status: 'efetivo',
          });
        },
      },
    ],
    cortes: [
      { data: '2026-01-15', rotulo: 'depois da abertura' },
      { data: '2026-02-20', rotulo: 'depois do primeiro ganho' },
    ],
  };
}

it('devolve um retrato por corte, na ordem cronológica', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  expect(retratos).toHaveLength(2);
  expect(retratos.map((r) => r.data)).toEqual(['2026-01-15', '2026-02-20']);
  expect(retratos[0].rotulo).toBe('depois da abertura');
});

it('o corte só enxerga os passos anteriores a ele', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  const carteiraAntes = retratos[0].saldos.find((s) => s.nome === 'carteira')!;
  const carteiraDepois = retratos[1].saldos.find((s) => s.nome === 'carteira')!;
  expect(carteiraAntes.efetivo).toBe(100000);
  expect(carteiraDepois.efetivo).toBe(130000);
});

it('cria a box "casa" como o iniciar() do store faz', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  const casa = retratos[0].dados.boxes.find((b) => b.nome === 'casa');
  expect(casa).toBeDefined();
  expect(casa!.saldoInicial).toBeNull();
});

it('conta os lançamentos pela matriz status × origem', async () => {
  const retratos = await executarRoteiro(roteiroMinimo());
  expect(retratos[1].contagemPorStatusOrigem['efetivo/manual']).toBe(1);
});

it('duas execuções dão retratos idênticos', async () => {
  const primeira = await executarRoteiro(roteiroMinimo());
  await limparDb();
  const segunda = await executarRoteiro(roteiroMinimo());
  expect(JSON.stringify(segunda)).toBe(JSON.stringify(primeira));
});

it('passo que estoura interrompe e diz qual passo', async () => {
  const roteiro = roteiroMinimo();
  roteiro.passos.push({
    data: '2026-03-01',
    descricao: 'passo que quebra de propósito',
    async executar() { throw new Error('falha interna'); },
  });
  await expect(executarRoteiro(roteiro)).rejects.toThrow(
    /passo 3 \(2026-03-01, "passo que quebra de propósito"\)/,
  );
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/executar.test.ts
```

Esperado: FALHA, com `Failed to resolve import "./executar"`.

- [ ] **Passo 3: implementar o retrato**

Criar `src/dossie/retrato.ts`:

```ts
import { calcularFaturas, type Fatura } from '../domain/fatura';
import { projetarBoxes, type DiaSaldo } from '../domain/projection';
import type { Dados, ID, ISODate } from '../domain/types';

export interface SaldoBox {
  boxId: ID;
  nome: string;
  efetivo: number;
  projetado: number;
  comCenarios: number;
}

export interface MarcosProjecao {
  /** `null` quando a série vem vazia — ver a nota abaixo. */
  minimo: DiaSaldo | null;
  maximo: DiaSaldo | null;
  fimDeMes: DiaSaldo[];
}

export interface Retrato {
  data: ISODate;
  rotulo: string;
  saldos: SaldoBox[];
  marcos: MarcosProjecao;
  /** Série consolidada dia a dia. Serve aos invariantes; não entra no dossiê. */
  serie: DiaSaldo[];
  faturas: Fatura[];
  contagemPorStatusOrigem: Record<string, number>;
  dados: Dados;
}

function marcosDe(serie: DiaSaldo[]): MarcosProjecao {
  // `projetarBoxes` devolve [] quando não há box com `dataSaldoInicial` nem lançamento antes
  // do horizonte (`src/domain/projection.ts`). É o estado real depois de o executor criar a
  // box 'casa', que tem `saldoInicial: null`, e antes do primeiro passo. Um `reduce` sem
  // valor inicial estoura aí. `null` é honesto; um dia falso com saldo zero mentiria no dossiê.
  if (serie.length === 0) return { minimo: null, maximo: null, fimDeMes: [] };
  const minimo = serie.reduce((a, b) => (b.saldoProjetado < a.saldoProjetado ? b : a));
  const maximo = serie.reduce((a, b) => (b.saldoProjetado > a.saldoProjetado ? b : a));
  const fimDeMes = serie.filter((d, i) => i === serie.length - 1 || serie[i + 1].data.slice(0, 7) !== d.data.slice(0, 7));
  return { minimo, maximo, fimDeMes };
}

export function tirarRetrato(dados: Dados, data: ISODate, rotulo: string): Retrato {
  const cenariosLigados = new Set(dados.cenarios.filter((c) => c.ligado).map((c) => c.id));
  const entrada = {
    boxes: dados.boxes,
    categorias: dados.categorias,
    lancamentos: dados.lancamentos,
    cenariosLigados,
    horizonte: dados.config.horizonteProjecao,
  };

  const todasAsBoxes = dados.boxes.map((b) => b.id);
  const serie = projetarBoxes(todasAsBoxes, entrada);

  const saldos: SaldoBox[] = [...dados.boxes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((box) => {
      const doDia = projetarBoxes([box.id], entrada).find((d) => d.data === data);
      return {
        boxId: box.id,
        nome: box.nome,
        efetivo: doDia?.saldoEfetivo ?? 0,
        projetado: doDia?.saldoProjetado ?? 0,
        comCenarios: doDia?.saldoComCenarios ?? 0,
      };
    });

  const faturas = [...dados.cartoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .flatMap((cartao) => calcularFaturas(
      cartao,
      dados.comprasCartao.filter((c) => c.cartaoId === cartao.id),
      dados.config.horizonteProjecao,
    ));

  const contagemPorStatusOrigem: Record<string, number> = {};
  for (const l of dados.lancamentos) {
    const chave = `${l.status}/${l.origem}`;
    contagemPorStatusOrigem[chave] = (contagemPorStatusOrigem[chave] ?? 0) + 1;
  }

  return { data, rotulo, saldos, marcos: marcosDe(serie), serie, faturas, contagemPorStatusOrigem, dados };
}
```

- [ ] **Passo 4: implementar o executor**

Criar `src/dossie/executar.ts`:

```ts
import * as repo from '../db/repo';
import type { Dados, ISODate } from '../domain/types';
import { instalarAmbiente } from './ambiente';
import { tirarRetrato, type Retrato } from './retrato';

export interface Passo {
  data: ISODate;
  descricao: string;
  executar(dados: Dados): Promise<void>;
}

export interface Corte {
  data: ISODate;
  rotulo: string;
}

export interface Roteiro {
  passos: Passo[];
  cortes: Corte[];
}

/**
 * Roda o roteiro do começo ao fim e tira um retrato em cada corte.
 *
 * Materializa e sincroniza antes de cada corte, igual ao `iniciar()` do store
 * (`src/state/store.ts`): sem isso o retrato não enxerga recorrência nem fatura do
 * período que acabou de passar.
 */
export async function executarRoteiro(roteiro: Roteiro): Promise<Retrato[]> {
  const inicio = roteiro.passos[0]?.data ?? roteiro.cortes[0]?.data;
  if (!inicio) throw new Error('roteiro vazio: nenhum passo e nenhum corte');

  const ambiente = instalarAmbiente(inicio);
  const retratos: Retrato[] = [];

  try {
    // A box "casa" nasce em iniciar() (src/state/store.ts), não no repo. O dossiê roda sem
    // a UI, então precisa criá-la aqui — senão o sentinela 'casa' não resolve para box nenhuma.
    await repo.salvarBox({
      id: 'box-casa', nome: 'casa', saldoInicial: null, dataSaldoInicial: null,
      criadoEm: `${inicio}T12:00:00.000Z`, alteradoEm: `${inicio}T12:00:00.000Z`,
    });

    const agenda = [
      ...roteiro.passos.map((p, i) => ({ data: p.data, tipo: 'passo' as const, indice: i, passo: p })),
      ...roteiro.cortes.map((c, i) => ({ data: c.data, tipo: 'corte' as const, indice: i, corte: c })),
    ].sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      // Na mesma data, todo passo roda antes de todo corte.
      if (a.tipo !== b.tipo) return a.tipo === 'passo' ? -1 : 1;
      // Entre itens do mesmo tipo, vale a ordem de declaração no roteiro. Sem este
      // desempate o comparador fica inconsistente (devolve o mesmo sinal nos dois
      // sentidos) e a ordem relativa passa a depender do motor.
      return a.indice - b.indice;
    });

    for (const item of agenda) {
      ambiente.avancarPara(item.data);
      const dados = await repo.carregarTudo();

      if (item.tipo === 'passo') {
        try {
          await item.passo.executar(dados);
        } catch (erro) {
          const causa = erro instanceof Error ? erro.message : String(erro);
          throw new Error(
            `o roteiro parou no passo ${item.indice + 1} (${item.passo.data}, "${item.passo.descricao}"): ${causa}`,
          );
        }
      } else {
        const horizonte = dados.config.horizonteProjecao;
        await repo.materializarTodas(horizonte);
        await repo.sincronizarCartoes(horizonte);
        retratos.push(tirarRetrato(await repo.carregarTudo(), item.corte.data, item.corte.rotulo));
      }
    }
  } finally {
    ambiente.restaurar();
  }

  return retratos;
}
```

- [ ] **Passo 5: rodar e confirmar que passa**

```
npx vitest run src/dossie/executar.test.ts
```

Esperado: 6 testes passando.

Se `duas execuções dão retratos idênticos` falhar, o culpado quase sempre é ordenação: alguma lista sai do Dexie em ordem diferente. Ordene por chave estável dentro de `tirarRetrato`, nunca ajuste o teste.

- [ ] **Passo 6: commitar**

```bash
git add src/dossie/retrato.ts src/dossie/executar.ts src/dossie/executar.test.ts
git commit -m "Executor do dossiê: roda o roteiro e tira retrato em cada corte"
```

---

### Tarefa 3: O roteiro de 12 meses

**Arquivos:**
- Criar: `src/dossie/roteiro.ts`
- Testar: `src/dossie/roteiro.test.ts`

**Interfaces:**
- Consome: os tipos `Passo`, `Corte` e `Roteiro` da Tarefa 2; as mutations de `src/db/repo.ts`.
- Produz: `export const ROTEIRO: Roteiro;`

**Assinaturas do `repo` que o roteiro usa** — copiadas do código, para não haver adivinhação:

```ts
salvarBox(box: Box): Promise<void>
salvarBanco(n: { boxId: ID; nome: string; ordem: number }): Promise<Banco>
salvarCategoria(n: { boxId: ID; nome: string; tipo: 'ganho' | 'gasto'; ordem: number }): Promise<Categoria>
atualizarCategoria(id: ID, patch: Partial<Pick<Categoria, 'nome' | 'ordem' | 'arquivada'>>): Promise<void>
salvarLancamento(n: { boxId: ID; categoriaId: ID; data: ISODate; valor: number; nota?: string; status: 'efetivo' | 'previsto'; cenarioId?: ID; viagemId?: ID }): Promise<Lancamento>
confirmarPendente(id: ID, valorReal?: number): Promise<void>
salvarRecorrencia(n: { boxId: ID; categoriaId: ID; valor: number; dataInicio: ISODate; diaDoMes: number; parcelas: number | null; nota?: string; cenarioId?: ID }, horizonte: ISODate): Promise<Recorrencia>
salvarCartao(n: { boxId: ID; nome: string; diaFechamento: number; diaVencimento: number; bancoId?: ID }, horizonte: ISODate): Promise<Cartao>
salvarCategoriaCartao(n: { cartaoId: ID; nome: string; ordem: number }): Promise<CategoriaCartao>
salvarCompraCartao(n: { cartaoId: ID; categoriaCartaoId: ID; data: ISODate; valorTotal: number; parcelas: number; descricao?: string; viagemId?: ID }, horizonte: ISODate): Promise<CompraCartao>
salvarAssinatura(n: { cartaoId: ID; categoriaCartaoId: ID; valor: number; dataInicio: ISODate; diaDoMes: number; parcelas: number | null; descricao?: string }, horizonte: ISODate): Promise<RecorrenciaCartao>
salvarConferenciaFatura(cartaoId: ID, mes: string, valorAppCent: number, usarValorApp: boolean, horizonte: ISODate): Promise<void>
registrarPagamentoFatura(p: { lancamentoId: ID; cartaoId: ID; faturaMes: string; valorPagoCent: number; dataPagamento: ISODate; parcelamento?: { parcelas: number; valorParcelaCent: number }; horizonte: ISODate }): Promise<void>
salvarViagem(n: { nome: string; dataInicio: ISODate; dataFim: ISODate }): Promise<Viagem>
salvarCenario(c: Cenario): Promise<void>
```

**O roteiro cobre, no mínimo:**

| # | Data | O que acontece |
|---|---|---|
| 1 | 2026-01-05 | Abre as boxes `carteira` (R$ 4.000,00) e `reserva` (R$ 12.000,00), com um banco em cada. |
| 2 | 2026-01-05 | Cria categorias: `salário` e `extra` (ganho); `mercado`, `transporte` e `moradia` (gasto). |
| 3 | 2026-01-08 | Cria as recorrências: salário no dia 5, moradia no dia 10. |
| 4 | 2026-01-20 | Cadastra o cartão `roxo`, fechamento dia 25, vencimento dia 5. |
| 5 | 2026-01-21 | Cria as categorias do cartão: `compras` e `serviços`. |
| 6 | 2026-01-22 | Compra à vista de R$ 180,00 e parcelada de R$ 900,00 em 6 vezes. |
| 7 | 2026-02-01 | Assina um serviço de R$ 39,90 por mês, sem fim. |
| 8 | 2026-03-06 | Confirma o pendente da moradia com o valor previsto. |
| 9 | 2026-04-06 | Confirma o pendente do salário com valor diferente do previsto. |
| 10 | 2026-05-04 | Registra uma conferência de fatura divergente da soma das compras. |
| 11 | 2026-06-05 | Paga a fatura de junho parcialmente e parcela o resto em 3 vezes. |
| 12 | 2026-07-10 | Cria a viagem `praia`, de 2026-07-15 a 2026-07-22. |
| 13 | 2026-07-17 | Lança um gasto dentro da viagem e faz uma compra de cartão dentro dela. |
| 14 | 2026-09-01 | Arquiva a categoria `extra`, que já tem histórico. |
| 15 | 2026-10-01 | Cria um cenário ligado, com um lançamento hipotético. |
| 16 | 2026-11-01 | Desliga o cenário. |

**As seis datas de corte:**

| Data | Rótulo | Por quê |
|---|---|---|
| 2026-01-24 | `antes do primeiro fechamento` | Cartão com compra, fatura ainda aberta. |
| 2026-01-28 | `entre fechamento e vencimento` | O trecho do ciclo mais fácil de errar. |
| 2026-02-10 | `depois do primeiro vencimento` | A fatura virou lançamento `origem: 'cartao'`. |
| 2026-06-20 | `depois do pagamento parcial` | Parcelamento virou `CompraCartao` na categoria reservada. |
| 2026-07-18 | `no meio da viagem` | Viagem ativa, com item de lançamento e de cartão. |
| 2026-11-30 | `fim do roteiro` | Cenário desligado, categoria arquivada, tudo acumulado. |

**Regras do roteiro:**

- Toda `descricao` é uma frase em português, no presente, sem valor real. Ela vai literal para `docs/dossie/00-roteiro.md`.
- Nunca guarde ids em variável de módulo. Cada passo recebe `dados` e acha o que precisa por nome:
  ```ts
  const mercado = dados.categorias.find((c) => c.nome === 'mercado')!;
  ```
  Isso mantém o passo legível e independente da ordem de criação.
- O `horizonte` vem sempre de `dados.config.horizonteProjecao`. Nunca escreva uma data de horizonte à mão.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/roteiro.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';

beforeEach(async () => {
  await limparDb();
});

it('tem os passos em ordem cronológica', () => {
  const datas = ROTEIRO.passos.map((p) => p.data);
  expect([...datas].sort()).toEqual(datas);
});

it('tem seis cortes, em ordem cronológica', () => {
  const datas = ROTEIRO.cortes.map((c) => c.data);
  expect(datas).toHaveLength(6);
  expect([...datas].sort()).toEqual(datas);
});

it('todo passo tem descrição em prosa', () => {
  for (const p of ROTEIRO.passos) {
    expect(p.descricao.length).toBeGreaterThan(15);
    expect(p.descricao).not.toMatch(/^[a-z-]+$/); // não é slug
  }
});

it('roda inteiro e produz seis retratos', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  expect(retratos).toHaveLength(6);
});

it('exercita a matriz status × origem inteira', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const chaves = Object.keys(retratos[5].contagemPorStatusOrigem);
  expect(chaves).toEqual(expect.arrayContaining([
    'efetivo/manual', 'previsto/manual', 'previsto/recorrencia',
    'efetivo/recorrencia', 'previsto/cartao', 'efetivo/cartao',
  ]));
});

it('gera fatura no cartão', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  expect(retratos[2].faturas.length).toBeGreaterThan(0);
});

it('duas execuções dão retratos idênticos', async () => {
  const primeira = await executarRoteiro(ROTEIRO);
  await limparDb();
  const segunda = await executarRoteiro(ROTEIRO);
  expect(JSON.stringify(segunda)).toBe(JSON.stringify(primeira));
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/roteiro.test.ts
```

Esperado: FALHA, com `Failed to resolve import "./roteiro"`.

- [ ] **Passo 3: escrever o roteiro**

Criar `src/dossie/roteiro.ts` com a tabela de 16 passos e os 6 cortes acima. Modelo do primeiro passo, para o formato ficar claro:

```ts
import * as repo from '../db/repo';
import type { Roteiro } from './executar';

export const ROTEIRO: Roteiro = {
  passos: [
    {
      data: '2026-01-05',
      descricao: 'Abre as boxes "carteira" e "reserva", cada uma com um banco dentro.',
      async executar() {
        await repo.salvarBox({
          id: 'box-carteira', nome: 'carteira',
          saldoInicial: 400000, dataSaldoInicial: '2026-01-05',
          criadoEm: '2026-01-05T12:00:00.000Z', alteradoEm: '2026-01-05T12:00:00.000Z',
        });
        await repo.salvarBox({
          id: 'box-reserva', nome: 'reserva',
          saldoInicial: 1200000, dataSaldoInicial: '2026-01-05',
          criadoEm: '2026-01-05T12:00:00.000Z', alteradoEm: '2026-01-05T12:00:00.000Z',
        });
        await repo.salvarBanco({ boxId: 'box-carteira', nome: 'banco azul', ordem: 0 });
        await repo.salvarBanco({ boxId: 'box-reserva', nome: 'banco verde', ordem: 0 });
      },
    },
    // … os outros 15 passos, seguindo a tabela do plano
  ],
  cortes: [
    { data: '2026-01-24', rotulo: 'antes do primeiro fechamento' },
    { data: '2026-01-28', rotulo: 'entre fechamento e vencimento' },
    { data: '2026-02-10', rotulo: 'depois do primeiro vencimento' },
    { data: '2026-06-20', rotulo: 'depois do pagamento parcial' },
    { data: '2026-07-18', rotulo: 'no meio da viagem' },
    { data: '2026-11-30', rotulo: 'fim do roteiro' },
  ],
};
```

Modelo do passo 3, porque toda mutation que mexe em recorrência ou cartão exige o `horizonte`:

```ts
{
  data: '2026-01-08',
  descricao: 'Cria as recorrências do salário, no dia 5, e da moradia, no dia 10.',
  async executar(dados) {
    const horizonte = dados.config.horizonteProjecao;
    const salario = dados.categorias.find((c) => c.nome === 'salário')!;
    const moradia = dados.categorias.find((c) => c.nome === 'moradia')!;
    await repo.salvarRecorrencia({
      boxId: 'box-carteira', categoriaId: salario.id, valor: 500000,
      dataInicio: '2026-02-05', diaDoMes: 5, parcelas: null,
    }, horizonte);
    await repo.salvarRecorrencia({
      boxId: 'box-carteira', categoriaId: moradia.id, valor: 150000,
      dataInicio: '2026-02-10', diaDoMes: 10, parcelas: null,
    }, horizonte);
  },
}
```

**Atenção ao sinal, que é contraintuitivo.** `valor` é sempre magnitude **positiva**, inclusive em gasto. Quem dá o sinal é o **tipo da categoria**: `projetarBoxes` faz `(tipo === 'ganho' ? 1 : -1) * l.valor` (`src/domain/projection.ts:53`). Um `valor` negativo numa categoria de gasto significa **estorno** — soma em vez de subtrair. Não escreva gasto com valor negativo no roteiro, a não ser no passo que existir de propósito para exercitar o estorno.

Modelo do passo 11, o mais difícil, porque depende do lançamento que a sincronização criou:

```ts
{
  data: '2026-06-05',
  descricao: 'Paga a fatura de junho por menos que o total e parcela o resto em três vezes.',
  async executar(dados) {
    const cartao = dados.cartoes.find((c) => c.nome === 'roxo')!;
    const fatura = dados.lancamentos.find(
      (l) => l.origem === 'cartao' && l.categoriaId === cartao.categoriaFaturaId && l.data.startsWith('2026-06'),
    )!;
    await repo.registrarPagamentoFatura({
      lancamentoId: fatura.id,
      cartaoId: cartao.id,
      faturaMes: '2026-06',
      valorPagoCent: 20000,
      dataPagamento: '2026-06-05',
      parcelamento: { parcelas: 3, valorParcelaCent: 15000 },
      horizonte: dados.config.horizonteProjecao,
    });
  },
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

```
npx vitest run src/dossie/roteiro.test.ts
```

Esperado: 7 testes passando.

O teste `exercita a matriz status × origem inteira` é o que mais dá trabalho. Se `efetivo/cartao` não aparecer, o pagamento do passo 11 não achou o lançamento da fatura — quase sempre porque o corte anterior não sincronizou, ou porque o mês do vencimento não é o que você supôs. Confira com `datasFaturaDoMes` em vez de chutar.

- [ ] **Passo 5: commitar**

```bash
git add src/dossie/roteiro.ts src/dossie/roteiro.test.ts
git commit -m "Roteiro de 12 meses do dossiê: 16 passos e 6 cortes"
```

---

### Tarefa 4: Extrator de tela

**Arquivos:**
- Criar: `src/dossie/tela.tsx` (extensão `.tsx`, porque tem JSX)
- Testar: `src/dossie/tela.test.tsx`

**Interfaces:**
- Consome: `render`, `cleanup` de `@testing-library/react`; `useApp`, `Aba` de `src/state/store.ts`; `Shell` de `src/ui/Shell.tsx`; `Retrato` da Tarefa 2.
- Produz:
  ```ts
  export const ABAS_DO_DOSSIE: Aba[];  // ['hoje','fluxo','cartao','analises','lancar','ajustes']
  export const PREFIXO_EXCECAO = '⚠ a tela lançou exceção: ';
  export interface TelasDoCorte { rotulo: string; textos: Record<string, string> }
  export function resumirNo(container: HTMLElement): string;
  export async function textoDaTela(retrato: Retrato, aba: Aba): Promise<string>;
  export async function coletarTelas(retratos: Retrato[]): Promise<TelasDoCorte[]>;
  ```

**A regra que decide se este arquivo presta:**

- Mudar uma classe de CSS **não pode** mexer na saída.
- Mudar um rótulo, um valor, a ordem de uma lista ou um estado vazio **tem que** mexer.

Por isso a extração recolhe **texto de folha**: percorre a árvore e emite o texto de cada elemento que não tem filho-elemento com texto. Atributo `class`, `style` e `id` são ignorados por construção. Onde o elemento tiver papel explícito ou implícito, o papel entra como prefixo.

Consequência aceita e que precisa estar clara: reestruturar markup **move** o dossiê. Isso é desejado — reestruturação é mudança de verdade, e merece um olhar. Só CSS puro é invisível.

**Como renderizar:** as telas leem tudo do store. Então preencha o store e monte o `Shell`, que já escolhe a tela pela aba:

```ts
useApp.setState({ dados: retrato.dados, hoje: retrato.data, aba, boxSel: 'casa', carregado: true });
const { container } = render(<Shell />);
```

`TelaAnalises` importa Recharts sob demanda, então o texto não está pronto no primeiro quadro. Estabilize antes de ler: leia o texto, espere, leia de novo, e pare quando dois valores seguidos forem iguais. Nada de `{ timeout: n }` em `findBy*` — o `CLAUDE.md` proíbe.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/tela.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render } from '@testing-library/react';
import { resumirNo } from './tela';

it('ignora classe, estilo e id', () => {
  const { container: a } = render(
    <div><h2 className="titulo">Saldo</h2><span className="valor">R$ 10,00</span></div>,
  );
  const antes = resumirNo(a);
  const { container: b } = render(
    <div id="x"><h2 className="titulo-novo destaque">Saldo</h2><span style={{ color: 'red' }}>R$ 10,00</span></div>,
  );
  expect(resumirNo(b)).toBe(antes);
});

it('enxerga mudança de rótulo', () => {
  const { container: a } = render(<div><h2>Saldo</h2></div>);
  const { container: b } = render(<div><h2>Saldo total</h2></div>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('enxerga mudança de valor', () => {
  const { container: a } = render(<div><span>R$ 10,00</span></div>);
  const { container: b } = render(<div><span>R$ 11,00</span></div>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('enxerga mudança de ordem numa lista', () => {
  const { container: a } = render(<ul><li>mercado</li><li>transporte</li></ul>);
  const { container: b } = render(<ul><li>transporte</li><li>mercado</li></ul>);
  expect(resumirNo(b)).not.toBe(resumirNo(a));
});

it('marca o papel quando existe', () => {
  const { container } = render(<div><button>Salvar</button><h2>Hoje</h2></div>);
  expect(resumirNo(container)).toContain('button: Salvar');
  expect(resumirNo(container)).toContain('heading: Hoje');
});

it('normaliza espaço em branco', () => {
  const { container: a } = render(<div><p>{'  Saldo   do   dia  '}</p></div>);
  const { container: b } = render(<div><p>Saldo do dia</p></div>);
  expect(resumirNo(b)).toBe(resumirNo(a));
});

it('não emite linha para elemento sem texto', () => {
  const { container } = render(<div><svg /><p>Texto</p></div>);
  expect(resumirNo(container).split('\n')).toEqual(['Texto']);
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/tela.test.tsx
```

Esperado: FALHA, com `Failed to resolve import "./tela"`.

- [ ] **Passo 3: implementar**

Criar `src/dossie/tela.tsx`:

```tsx
import { render, cleanup } from '@testing-library/react';
import { useApp, type Aba } from '../state/store';
import Shell from '../ui/Shell';
import type { Retrato } from './retrato';

/** Uma tela que estoura não derruba a geração — o estrago entra no dossiê e é julgado lá. */
export const PREFIXO_EXCECAO = '⚠ a tela lançou exceção: ';

export interface TelasDoCorte { rotulo: string; textos: Record<string, string> }

/** As telas que entram no dossiê. Sheets e subtelas de Ajustes ficam fora nesta volta. */
export const ABAS_DO_DOSSIE: Aba[] = ['hoje', 'fluxo', 'cartao', 'analises', 'lancar', 'ajustes'];

const PAPEL_POR_TAG: Record<string, string> = {
  H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading',
  BUTTON: 'button', A: 'link', LI: 'listitem', OPTION: 'option',
  TD: 'cell', TH: 'columnheader', LABEL: 'label',
};

function papelDe(el: Element): string | null {
  return el.getAttribute('role') ?? PAPEL_POR_TAG[el.tagName] ?? null;
}

function temFilhoComTexto(el: Element): boolean {
  return Array.from(el.children).some((f) => (f.textContent ?? '').trim() !== '');
}

/**
 * Recolhe o texto de folha da árvore, em ordem de documento.
 *
 * Só o texto e o papel entram. Classe, estilo e id ficam de fora por construção — é o que
 * impede o dossiê de mexer quando alguém troca uma classe de CSS. Reestruturar markup
 * move a saída, e isso é desejado: reestruturação é mudança de verdade.
 */
export function resumirNo(container: HTMLElement): string {
  const linhas: string[] = [];
  const visitar = (el: Element) => {
    const texto = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (texto === '') return;
    if (temFilhoComTexto(el)) {
      for (const filho of Array.from(el.children)) visitar(filho);
      return;
    }
    const papel = papelDe(el);
    linhas.push(papel ? `${papel}: ${texto}` : texto);
  };
  for (const filho of Array.from(container.children)) visitar(filho);
  return linhas.join('\n');
}

/** Espera o texto parar de mudar. TelaAnalises importa Recharts sob demanda. */
async function estabilizar(container: HTMLElement): Promise<string> {
  let anterior = '';
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const atual = resumirNo(container);
    if (atual !== '' && atual === anterior) return atual;
    anterior = atual;
    await new Promise((r) => setTimeout(r, 50));
  }
  return anterior;
}

export async function textoDaTela(retrato: Retrato, aba: Aba): Promise<string> {
  useApp.setState({
    dados: retrato.dados, hoje: retrato.data, aba,
    boxSel: 'casa', carregado: true, ajustesSecao: null,
  });
  try {
    const { container } = render(<Shell />);
    return await estabilizar(container);
  } catch (erro) {
    // A geração não para. O invariante `nenhuma tela lança` reprova depois, e o revisor lê
    // o estrago no dossiê em vez de receber um stack trace no lugar do relatório inteiro.
    return PREFIXO_EXCECAO + (erro instanceof Error ? erro.message : String(erro));
  } finally {
    cleanup();
  }
}

export async function coletarTelas(retratos: Retrato[]): Promise<TelasDoCorte[]> {
  const saida: TelasDoCorte[] = [];
  for (const r of retratos) {
    const textos: Record<string, string> = {};
    for (const aba of ABAS_DO_DOSSIE) textos[aba] = await textoDaTela(r, aba);
    saida.push({ rotulo: r.rotulo, textos });
  }
  return saida;
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

```
npx vitest run src/dossie/tela.test.tsx
```

Esperado: 7 testes passando.

- [ ] **Passo 5: testar contra uma tela de verdade**

Acrescentar ao fim de `src/dossie/tela.test.tsx`:

```tsx
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';
import { ABAS_DO_DOSSIE, coletarTelas, textoDaTela } from './tela';

it('cada aba do dossiê rende texto não vazio no primeiro corte', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  for (const aba of ABAS_DO_DOSSIE) {
    const texto = await textoDaTela(retratos[0], aba);
    expect(texto, `aba ${aba} veio vazia`).not.toBe('');
  }
});

it('duas leituras da mesma tela dão o mesmo texto', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const primeira = await textoDaTela(retratos[2], 'cartao');
  const segunda = await textoDaTela(retratos[2], 'cartao');
  expect(segunda).toBe(primeira);
});

it('coleta uma entrada por corte, com todas as abas', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  expect(telas).toHaveLength(6);
  expect(Object.keys(telas[0].textos).sort()).toEqual([...ABAS_DO_DOSSIE].sort());
  expect(telas[0].rotulo).toBe(retratos[0].rotulo);
});
```

Rodar de novo:

```
npx vitest run src/dossie/tela.test.tsx
```

Esperado: 10 testes passando.

- [ ] **Passo 6: commitar**

```bash
git add src/dossie/tela.tsx src/dossie/tela.test.tsx
git commit -m "Extrator de tela do dossiê: texto de folha, imune a classe de CSS"
```

---

### Tarefa 5: Invariantes

**Arquivos:**
- Criar: `src/dossie/invariantes.ts`
- Testar: `src/dossie/invariantes.test.ts`

**Interfaces:**
- Consome: `Retrato` da Tarefa 2; `TelasDoCorte` e `PREFIXO_EXCECAO` da Tarefa 4; `gerarBackup`, `validarBackup` de `src/backup/backup.ts`; `categoriasFaturaIds` de `src/domain/fatura.ts`; `categoriasCartaoReservadasIds` de `src/domain/categorias.ts`; `viagensSobrepoem` de `src/domain/viagem.ts`.
- Produz:
  ```ts
  export type ClasseInvariante = 'garantido' | 'expectativa';
  export interface Achado { ok: boolean; detalhe: string }
  export interface Invariante {
    nome: string;
    classe: ClasseInvariante;
    /** Sobre um corte. */
    checar?(r: Retrato): Achado;
    /** Sobre dois cortes seguidos. Não roda no primeiro. */
    checarPar?(anterior: Retrato, atual: Retrato): Achado;
  }
  export const INVARIANTES: Invariante[];
  export interface ResultadoInvariante {
    nome: string; classe: ClasseInvariante; corte: string; ok: boolean; detalhe: string;
  }
  export function checarTudo(retratos: Retrato[]): ResultadoInvariante[];
  /** `nenhuma tela lança` mora aqui porque o texto de tela não cabe no Retrato. */
  export function checarTelas(telas: TelasDoCorte[]): ResultadoInvariante[];
  ```

**Por que `checarTelas` é separado.** O `Retrato` sai do executor, que não conhece a UI. O texto de tela sai do extrator, que roda depois. Juntar os dois no `Retrato` criaria dependência circular entre `executar.ts` e `tela.tsx`. Duas funções e uma concatenação no chamador resolvem, sem acoplar as camadas.

**As duas classes, e o motivo de existirem.** O `docs/dominio.md` separa o que o código **garante** do que é só **expectativa** — e diz, com todas as letras, que "cenário nunca é efetivo" e "viagens não se sobrepõem" **não** são garantidos. Reprovar a suíte por uma regra que o código nunca prometeu cumprir seria mentira. Então: `garantido` violado reprova; `expectativa` violado vira achado no dossiê e nada mais.

**Os invariantes garantidos:**

| Nome | O que checa |
|---|---|
| `referências resolvem` | Todo lançamento aponta para `boxId` e `categoriaId` que existem. |
| `fatura bate com os itens` | Para cada fatura, a soma dos itens é igual ao valor do lançamento `origem: 'cartao'` daquele ciclo. |
| `efetivo não some` | Par de cortes: todo lançamento `efetivo` no corte anterior ainda existe no atual. |
| `efetivo não volta a previsto` | Par de cortes: nenhum lançamento `efetivo` no corte anterior aparece como `previsto` no atual. |
| `uma conferência por cartão e mês` | Nenhum par `cartaoId` + `mes` repetido. |
| `categoria de fatura fica escondida` | Nenhuma categoria de `categoriasFaturaIds` aparece na lista de seleção manual; idem para `categoriasCartaoReservadasIds`. |
| `backup dá a volta` | `validarBackup(JSON.parse(JSON.stringify(gerarBackup(dados))))` devolve os mesmos `dados`. |
| `projeção acumula` | Para cada dia da série, `saldoProjetado` é igual ao do dia anterior mais os lançamentos não-cenário daquele dia, **com o sinal do tipo da categoria**: `(tipo === 'ganho' ? 1 : -1) * valor`. Pule os lançamentos com `data <= dataSaldoInicial` da box, que a projeção ignora por já estarem no saldo inicial. |

E um nono, garantido, que vive em `checarTelas` porque lê texto de tela, não `Retrato`:

| Nome | O que checa |
|---|---|
| `nenhuma tela lança` | Nenhum texto de tela começa com `PREFIXO_EXCECAO`. |

**Os invariantes de expectativa:**

| Nome | O que checa |
|---|---|
| `cenário nunca é efetivo` | Nenhum lançamento com `cenarioId` e `status: 'efetivo'`. |
| `viagens não se sobrepõem` | `viagensSobrepoem` é falso para todo par. |
| `dinheiro é inteiro` | Todo `valor`, `valorTotal` e `saldoInicial` passa por `Number.isInteger`. |
| `datas são AAAA-MM-DD` | Todo campo de data casa com `/^\d{4}-\d{2}-\d{2}$/`. |

**Cuidado ao escrever os dois de par.** A tentação é checar "nenhum `efetivo` mudou de valor". Isso **dispararia falso**: `registrarPagamentoFatura` (`src/db/repo.ts`) reescreve um lançamento já `efetivo`, e o próprio `docs/dominio.md` chama esse de "o único caminho do app que reescreve um `efetivo`" — é legítimo, e o roteiro faz isso no passo 11. As duas formulações da tabela — não sumir e não regredir para `previsto` — são verdadeiras sem exceção, e ainda assim pegam a regressão que importa: `materializar` ou `diffSincronizacao` passando a mexer em histórico.

**Regra de mensagem:** `detalhe` sempre nomeia o registro. `"lançamento id-0042 aponta para categoria id-9999, que não existe"`, nunca `"referência inválida"`. O revisor lê essa linha sem abrir o código.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/invariantes.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { ROTEIRO } from './roteiro';
import { INVARIANTES, checarTudo } from './invariantes';

beforeEach(async () => {
  await limparDb();
});

it('todo invariante declara nome e classe', () => {
  for (const inv of INVARIANTES) {
    expect(inv.nome.length).toBeGreaterThan(3);
    expect(['garantido', 'expectativa']).toContain(inv.classe);
    expect(inv.checar ?? inv.checarPar).toBeDefined();
  }
});

it('o roteiro passa em todos os invariantes garantidos', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const reprovados = checarTudo(retratos)
    .filter((r) => r.classe === 'garantido' && !r.ok);
  expect(reprovados.map((r) => `${r.nome} @ ${r.corte}: ${r.detalhe}`)).toEqual([]);
});

it('checa cada invariante em cada corte', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  const resultados = checarTudo(retratos);
  const soDeUmCorte = INVARIANTES.filter((i) => i.checar).length;
  const dePar = INVARIANTES.filter((i) => i.checarPar).length;
  expect(resultados).toHaveLength(soDeUmCorte * 6 + dePar * 5);
});

it('detecta referência quebrada e nomeia o registro', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  retratos[0].dados.lancamentos[0].categoriaId = 'id-inexistente';
  const achado = checarTudo(retratos)
    .find((r) => r.nome === 'referências resolvem' && !r.ok);
  expect(achado).toBeDefined();
  expect(achado!.detalhe).toContain('id-inexistente');
});

it('violação de expectativa não conta como garantida', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  retratos[0].dados.lancamentos[0].cenarioId = 'cen-x';
  retratos[0].dados.lancamentos[0].status = 'efetivo';
  const resultados = checarTudo(retratos);
  const violado = resultados.find((r) => r.nome === 'cenário nunca é efetivo' && !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('expectativa');
  expect(resultados.filter((r) => r.classe === 'garantido' && !r.ok)).toEqual([]);
});

it('tela que estourou reprova e diz qual aba', () => {
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: `${PREFIXO_EXCECAO}saldo indefinido` } },
  ]);
  const violado = resultados.find((r) => !r.ok);
  expect(violado).toBeDefined();
  expect(violado!.classe).toBe('garantido');
  expect(violado!.detalhe).toContain('cartao');
  expect(violado!.detalhe).toContain('saldo indefinido');
});

it('telas sem exceção passam', () => {
  const resultados = checarTelas([
    { rotulo: 'corte de teste', textos: { hoje: 'button: Hoje', cartao: 'heading: Cartão' } },
  ]);
  expect(resultados.every((r) => r.ok)).toBe(true);
});
```

Troque a linha de import dos invariantes, no topo do arquivo, e acrescente a do prefixo:

```ts
import { INVARIANTES, checarTelas, checarTudo } from './invariantes';
import { PREFIXO_EXCECAO } from './tela';
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/invariantes.test.ts
```

Esperado: FALHA, com `Failed to resolve import "./invariantes"`.

- [ ] **Passo 3: implementar**

Criar `src/dossie/invariantes.ts` com os 12 invariantes das duas tabelas. Modelo de um de cada forma:

```ts
import { gerarBackup, validarBackup } from '../backup/backup';
import type { Retrato } from './retrato';

export type ClasseInvariante = 'garantido' | 'expectativa';

export interface Achado { ok: boolean; detalhe: string }

export interface Invariante {
  nome: string;
  classe: ClasseInvariante;
  checar?(r: Retrato): Achado;
  checarPar?(anterior: Retrato, atual: Retrato): Achado;
}

const OK: Achado = { ok: true, detalhe: '—' };

export const INVARIANTES: Invariante[] = [
  {
    nome: 'referências resolvem',
    classe: 'garantido',
    checar(r) {
      const boxes = new Set(r.dados.boxes.map((b) => b.id));
      const categorias = new Set(r.dados.categorias.map((c) => c.id));
      for (const l of r.dados.lancamentos) {
        if (!boxes.has(l.boxId)) {
          return { ok: false, detalhe: `lançamento ${l.id} aponta para a box ${l.boxId}, que não existe` };
        }
        if (!categorias.has(l.categoriaId)) {
          return { ok: false, detalhe: `lançamento ${l.id} aponta para a categoria ${l.categoriaId}, que não existe` };
        }
      }
      return OK;
    },
  },
  {
    nome: 'backup dá a volta',
    classe: 'garantido',
    checar(r) {
      const ida = gerarBackup(r.dados);
      const volta = validarBackup(JSON.parse(JSON.stringify(ida)));
      const antes = JSON.stringify(ida.dados);
      const depois = JSON.stringify(volta.dados);
      return antes === depois
        ? OK
        : { ok: false, detalhe: 'exportar e reimportar mudou os dados' };
    },
  },
  {
    nome: 'cenário nunca é efetivo',
    classe: 'expectativa',
    checar(r) {
      const culpado = r.dados.lancamentos.find((l) => l.cenarioId && l.status === 'efetivo');
      return culpado
        ? { ok: false, detalhe: `lançamento ${culpado.id} é de cenário e está efetivo` }
        : OK;
    },
  },
  {
    nome: 'efetivo não some',
    classe: 'garantido',
    checarPar(anterior, atual) {
      const agora = new Set(atual.dados.lancamentos.map((l) => l.id));
      const sumido = anterior.dados.lancamentos.find((l) => l.status === 'efetivo' && !agora.has(l.id));
      return sumido
        ? { ok: false, detalhe: `lançamento efetivo ${sumido.id} (${sumido.data}) existia em "${anterior.rotulo}" e sumiu` }
        : OK;
    },
  },
  // Faltam 7 do tipo `checar` e 1 de par. As tabelas acima dizem exatamente quais:
  // 10 `checar` no total (6 garantidos + 4 de expectativa) e 2 `checarPar`, ambos garantidos.
];

export interface ResultadoInvariante {
  nome: string;
  classe: ClasseInvariante;
  corte: string;
  ok: boolean;
  detalhe: string;
}

export function checarTudo(retratos: Retrato[]): ResultadoInvariante[] {
  const saida: ResultadoInvariante[] = [];
  for (const inv of INVARIANTES) {
    retratos.forEach((r, i) => {
      if (inv.checar) {
        const a = inv.checar(r);
        saida.push({ nome: inv.nome, classe: inv.classe, corte: r.rotulo, ...a });
      }
      if (inv.checarPar && i > 0) {
        const a = inv.checarPar(retratos[i - 1], r);
        saida.push({ nome: inv.nome, classe: inv.classe, corte: r.rotulo, ...a });
      }
    });
  }
  return saida;
}

/**
 * O invariante das telas mora aqui, e não em INVARIANTES, porque lê texto de tela — que o
 * Retrato não carrega. Juntar os dois acoplaria o executor à UI.
 */
export function checarTelas(telas: TelasDoCorte[]): ResultadoInvariante[] {
  return telas.map((t) => {
    const quebrada = Object.entries(t.textos).find(([, texto]) => texto.startsWith(PREFIXO_EXCECAO));
    return {
      nome: 'nenhuma tela lança',
      classe: 'garantido' as const,
      corte: t.rotulo,
      ok: !quebrada,
      detalhe: quebrada
        ? `a aba ${quebrada[0]} estourou: ${quebrada[1].slice(PREFIXO_EXCECAO.length)}`
        : '—',
    };
  });
}
```

Importe `PREFIXO_EXCECAO` e o tipo `TelasDoCorte` de `./tela` no topo do arquivo.

- [ ] **Passo 4: rodar e confirmar que passa**

```
npx vitest run src/dossie/invariantes.test.ts
```

Esperado: 7 testes passando.

**Se `o roteiro passa em todos os invariantes garantidos` reprovar, pare e pense antes de mexer.** Duas leituras possíveis, e elas se excluem:

1. O invariante está mal escrito. Corrija o invariante.
2. O invariante está certo e achou um defeito real no app. **Esse é o resultado mais valioso possível desta feature.** Não mexa no invariante nem no roteiro: registre o achado, avise o usuário e pergunte antes de seguir.

Nunca afrouxe um invariante para a suíte ficar verde.

- [ ] **Passo 5: commitar**

```bash
git add src/dossie/invariantes.ts src/dossie/invariantes.test.ts
git commit -m "Invariantes do dossiê: 8 garantidos e 4 expectativas, tirados do docs/dominio.md"
```

---

### Tarefa 6: Serializador

**Arquivos:**
- Criar: `src/dossie/serializar.ts`
- Testar: `src/dossie/serializar.test.ts`

**Interfaces:**
- Consome: `Roteiro` de `./executar`; `Retrato` de `./retrato`; `ResultadoInvariante` de `./invariantes`; `TelasDoCorte` e `ABAS_DO_DOSSIE` de `./tela`; `formatarBRL` de `src/domain/money.ts`.
- Produz:
  ```ts
  export interface ArquivoDossie { nome: string; conteudo: string }
  export function montarDossie(
    roteiro: Roteiro,
    retratos: Retrato[],
    resultados: ResultadoInvariante[],
    telas: TelasDoCorte[],
  ): ArquivoDossie[];
  ```
  Nomes: `00-roteiro.md`, `01-invariantes.md`, `02-motor.md`, `03-telas.md`.

`montarDossie` é **síncrona**. Ela recebe as telas já coletadas; renderizar é trabalho da Tarefa 4, não dela.

**Regras de formato:**

- Todo valor monetário sai por `formatarBRL` (`src/domain/money.ts`). Nunca centavos crus no dossiê — o revisor lê reais.
- Toda lista sai ordenada por chave estável. Nunca pela ordem que veio do Dexie.
- Todo arquivo termina com uma quebra de linha, e nenhuma linha tem espaço no fim. Sem isso, o `git diff` fica sujo.
- Cabeçalho de cada arquivo: uma frase dizendo o que ele é e que foi gerado por `npm run dossie`. Sem data nem versão no cabeçalho — data no arquivo faria o dossiê mudar sozinho a cada rodada.

- [ ] **Passo 1: escrever o teste que falha**

Criar `src/dossie/serializar.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { checarTelas, checarTudo } from './invariantes';
import { ROTEIRO } from './roteiro';
import { montarDossie } from './serializar';
import { coletarTelas } from './tela';

beforeEach(async () => {
  await limparDb();
});

async function gerar() {
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const resultados = [...checarTudo(retratos), ...checarTelas(telas)];
  return montarDossie(ROTEIRO, retratos, resultados, telas);
}

it('monta os quatro arquivos, na ordem', async () => {
  const arquivos = await gerar();
  expect(arquivos.map((a) => a.nome)).toEqual([
    '00-roteiro.md', '01-invariantes.md', '02-motor.md', '03-telas.md',
  ]);
});

it('não deixa espaço no fim da linha nem falta quebra final', async () => {
  for (const a of await gerar()) {
    expect(a.conteudo.endsWith('\n'), `${a.nome} não termina com quebra`).toBe(true);
    expect(a.conteudo, `${a.nome} tem espaço no fim de linha`).not.toMatch(/[ \t]+\n/);
  }
});

it('escreve dinheiro em reais, não em centavos', async () => {
  const motor = (await gerar()).find((a) => a.nome === '02-motor.md')!;
  expect(motor.conteudo).toContain('R$');
});

it('traz a descrição de cada passo do roteiro', async () => {
  const roteiro = (await gerar()).find((a) => a.nome === '00-roteiro.md')!;
  for (const p of ROTEIRO.passos) {
    expect(roteiro.conteudo).toContain(p.descricao);
  }
});

it('traz cada invariante com a sua classe', async () => {
  const inv = (await gerar()).find((a) => a.nome === '01-invariantes.md')!;
  expect(inv.conteudo).toContain('garantido');
  expect(inv.conteudo).toContain('expectativa');
});

it('duas montagens dão byte igual', async () => {
  const primeira = await gerar();
  await limparDb();
  const segunda = await gerar();
  expect(segunda).toEqual(primeira);
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```
npx vitest run src/dossie/serializar.test.ts
```

Esperado: FALHA, com `Failed to resolve import "./serializar"`.

- [ ] **Passo 3: implementar**

Criar `src/dossie/serializar.ts`. Modelo do arquivo de invariantes, para o formato de tabela ficar claro:

```ts
function montarInvariantes(resultados: ResultadoInvariante[]): string {
  const linhas = [
    '# Invariantes',
    '',
    'Gerado por `npm run dossie`. Não edite à mão.',
    '',
    'Um invariante **garantido** violado reprova o `npm test`. Um de **expectativa** só',
    'aparece aqui: o `docs/dominio.md` diz que o código não o promete.',
    '',
    '| Invariante | Classe | Corte | Resultado | Detalhe |',
    '|---|---|---|---|---|',
  ];
  for (const r of [...resultados].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR') || a.corte.localeCompare(b.corte, 'pt-BR'))) {
    linhas.push(`| ${r.nome} | ${r.classe} | ${r.corte} | ${r.ok ? 'passa' : '**viola**'} | ${r.detalhe} |`);
  }
  return `${linhas.join('\n')}\n`;
}
```

Os outros três seguem o mesmo molde. O formato de saída de cada um, para não haver dúvida:

`00-roteiro.md` — uma linha por passo, na ordem cronológica:

```markdown
## 2026-01-05

1. Abre as boxes "carteira" e "reserva", cada uma com um banco dentro.
2. Cria as categorias de ganho e de gasto das duas boxes.
```

`02-motor.md` — uma seção por corte:

```markdown
## 2026-01-28 — entre fechamento e vencimento

### Saldos

| Box | Efetivo | Projetado | Com cenários |
|---|---|---|---|
| carteira | R$ 4.000,00 | R$ 3.820,00 | R$ 3.820,00 |

### Marcos da projeção

- Mínimo: R$ 1.240,00 em 2026-11-04
- Máximo: R$ 12.000,00 em 2026-01-05
- Fim de janeiro: R$ 3.820,00
```

Quando `minimo` e `maximo` vêm `null` — série vazia, num corte anterior à primeira box com
saldo —, escreva `Sem projeção neste corte.` no lugar da lista. Nunca `R$ 0,00`: inventar um
saldo mentiria no dossiê.

```markdown

### Faturas

| Cartão | Ciclo | Itens | Total |
|---|---|---|---|
| roxo | 2026-02 | 3 | R$ 480,00 |

### Lançamentos por status e origem

| Combinação | Quantos |
|---|---|
| efetivo/manual | 4 |
```

`03-telas.md` — uma seção por corte, uma subseção por aba, o texto num bloco de código:

```markdown
## 2026-01-28 — entre fechamento e vencimento

### Aba Hoje

​```
button: Hoje
heading: Hoje
R$ 3.820,00
​```
```

- [ ] **Passo 4: rodar e confirmar que passa**

```
npx vitest run src/dossie/serializar.test.ts
```

Esperado: 6 testes passando.

- [ ] **Passo 5: commitar**

```bash
git add src/dossie/serializar.ts src/dossie/serializar.test.ts
git commit -m "Serializador do dossiê: quatro markdown determinísticos"
```

---

### Tarefa 7: O guarda, o comando e a primeira geração

**Arquivos:**
- Criar: `src/dossie/dossie.test.ts`, `scripts/dossie.mjs`, `docs/dossie/*.md`, `docs/dossie/README.md`
- Modificar: `package.json` (só o campo `scripts`), `scripts/verificar-dados-reais.mjs` (só as duas listas de exceção)

**Autorização:** o `CLAUDE.md` reserva `scripts/` e os scripts do `package.json` a pedido explícito do usuário. Concedido em 2026-08-10 e ampliado em 2026-08-12, registrado na seção "Autorizações concedidas" da spec. **Não mexa em mais nada nesses arquivos.**

#### A colisão com o verificador de dados reais, e como resolvê-la

`scripts/verificar-dados-reais.mjs` casa qualquer texto no formato `R$ 1.234,56`. O
`docs/dossie/02-motor.md` é **feito** de dinheiro formatado: todo saldo e todo total de
fatura, em seis cortes. Sem tratamento, o verificador acumula centenas de achados e o
`npm run release`, que o chama com `--strict`, aborta.

Nenhum desses valores pode ser real: o dossiê é função pura de um roteiro sintético.

**A resolução, decidida pelo usuário em 2026-08-12,** mantém o crivo onde ele protege e o
remove onde não protege nada:

1. **Isente só a saída gerada.** Acrescente os quatro arquivos de `docs/dossie/` a
   `EXCECOES_ARQUIVO`, com um comentário dizendo por quê:

   ```js
   // Gerado por `npm run dossie` a partir de um roteiro sintético (src/dossie/roteiro.ts).
   // Dado real não tem por onde entrar aqui: a saída é função pura da entrada, que é checada.
   'docs/dossie/00-roteiro.md',
   'docs/dossie/01-invariantes.md',
   'docs/dossie/02-motor.md',
   'docs/dossie/03-telas.md',
   ```

2. **Mantenha `src/dossie/roteiro.ts` sob checagem.** É onde uma pessoa escreve valor à mão,
   e é justamente ali que o crivo vale. Os valores sintéticos deste trabalho vão para
   `EXCECOES_VALOR`, aprovados um a um:

   ```js
   // roteiro e plano do dossiê de comportamento (sintéticos, 2026-08-12)
   'R$ 4.000,00', 'R$ 12.000,00', 'R$ 3.820,00', 'R$ 1.240,00', 'R$ 480,00',
   'R$ 300,00', 'R$ 180,00', 'R$ 900,00', 'R$ 39,90', 'R$ 10,00', 'R$ 11,00',
   ```

**Não** isente `src/dossie/`. **Não** mexa nos padrões de casamento nem no código de saída do
verificador. A única mudança autorizada nesse arquivo são as duas listas acima.

Se, depois disso, o verificador ainda acusar um valor, **o valor é que muda** — troque-o no
roteiro ou no plano por um dos já aprovados. Só acrescente à lista o que você não conseguir
evitar, e diga no relatório qual foi e por quê.

**Interfaces:**
- Consome: tudo das tarefas anteriores.
- Produz: `npm run dossie`, e a reprovação de `npm test` quando o dossiê está velho.

**Como a variável de ambiente chega ao Vitest sem `cross-env`:** o `npm run dossie` chama `node scripts/dossie.mjs`, que define `DOSSIE=escrever` no ambiente e sobe o Vitest com `spawn`. Isso funciona igual no Windows e no Linux, e não acrescenta dependência.

- [ ] **Passo 1: escrever o guarda**

Criar `src/dossie/dossie.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { limparDb } from '../test-setup';
import { executarRoteiro } from './executar';
import { checarTelas, checarTudo } from './invariantes';
import { ROTEIRO } from './roteiro';
import { montarDossie } from './serializar';
import { coletarTelas } from './tela';

const PASTA = join(process.cwd(), 'docs', 'dossie');

it('o dossiê no disco reflete o comportamento atual do app', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const resultados = [...checarTudo(retratos), ...checarTelas(telas)];
  const arquivos = montarDossie(ROTEIRO, retratos, resultados, telas);

  if (process.env.DOSSIE === 'escrever') {
    mkdirSync(PASTA, { recursive: true });
    for (const a of arquivos) writeFileSync(join(PASTA, a.nome), a.conteudo, 'utf8');
    return;
  }

  const desatualizados = arquivos.filter((a) => {
    const caminho = join(PASTA, a.nome);
    return !existsSync(caminho) || readFileSync(caminho, 'utf8') !== a.conteudo;
  });

  expect(
    desatualizados.map((a) => a.nome),
    'o dossiê está desatualizado — rode `npm run dossie` e commite o resultado',
  ).toEqual([]);
});

it('nenhum invariante garantido está violado', async () => {
  await limparDb();
  const retratos = await executarRoteiro(ROTEIRO);
  const telas = await coletarTelas(retratos);
  const violados = [...checarTudo(retratos), ...checarTelas(telas)]
    .filter((r) => r.classe === 'garantido' && !r.ok)
    .map((r) => `${r.nome} @ ${r.corte}: ${r.detalhe}`);
  expect(violados).toEqual([]);
});
```

- [ ] **Passo 2: escrever o comando**

Criar `scripts/dossie.mjs`:

```js
#!/usr/bin/env node
// Regenera o dossiê de comportamento em docs/dossie/.
//
// Existe porque o gerador precisa do jsdom e do fake-indexeddb — ele roda dentro do Vitest,
// não como script solto. E precisa de uma variável de ambiente, que o npm não sabe passar
// igual no Windows e no Linux. Um spawn resolve os dois sem dependência nova.
import { spawn } from 'node:child_process';

const filho = spawn(
  'npx',
  ['vitest', 'run', 'src/dossie/dossie.test.ts'],
  { stdio: 'inherit', shell: true, env: { ...process.env, DOSSIE: 'escrever' } },
);

filho.on('exit', (codigo) => process.exit(codigo ?? 1));
```

- [ ] **Passo 3: acrescentar o script ao `package.json`**

Só esta linha, no bloco `scripts`, depois de `"test:watch"`:

```json
"dossie": "node scripts/dossie.mjs",
```

- [ ] **Passo 4: gerar o dossiê pela primeira vez**

```
npm run dossie
```

Esperado: quatro arquivos novos em `docs/dossie/`.

- [ ] **Passo 5: ler o dossiê inteiro, com atenção**

Este passo não é formalidade. É a primeira vez que alguém vê o app inteiro descrito de uma vez.

Abra os quatro arquivos e procure:

- Número que não faz sentido para o roteiro que você escreveu.
- Fatura com item repetido, ou com total que não bate.
- Tela que rende texto vazio, ou que mostra estado vazio quando deveria ter dado.
- Categoria arquivada aparecendo onde não devia.

**Achado aqui é o produto desta feature, não um contratempo.** Se achar, registre e avise o usuário antes de seguir. Não conserte o app dentro deste plano — é outro branch.

- [ ] **Passo 6: confirmar que o guarda pega dossiê velho**

```
node -e "require('fs').appendFileSync('docs/dossie/02-motor.md','sujeira\n')"
npx vitest run src/dossie/dossie.test.ts
```

Esperado: FALHA, com `o dossiê está desatualizado`. Depois:

```
npm run dossie
npx vitest run src/dossie/dossie.test.ts
```

Esperado: 2 testes passando.

- [ ] **Passo 7: escrever o README da pasta**

Criar `docs/dossie/README.md`, dizendo em poucas linhas: o que é o dossiê, que ele é gerado e nunca editado à mão, que `npm run dossie` regenera, e que conflito de merge se resolve regenerando — nunca à mão.

- [ ] **Passo 8: verificar a suíte inteira e os guards**

```
npm test
npm run build
node scripts/verificar-dados-reais.mjs
```

Esperado: suíte verde, build limpo, e o verificador sem achado em `docs/dossie/`.

Se o verificador acusar algo, **o roteiro é que muda** — troque o valor sintético. Nunca acrescente exceção ao verificador.

- [ ] **Passo 9: commitar**

```bash
git add src/dossie/dossie.test.ts scripts/dossie.mjs package.json docs/dossie/
git commit -m "Guarda do dossiê: npm test compara com o disco, npm run dossie regenera"
```

---

### Tarefa 8: A skill do revisor e a documentação

**Arquivos:**
- Criar: `.claude/skills/revisar-dossie/SKILL.md`
- Modificar: `.claude/skills/ciclo-de-entrega/SKILL.md`, `CLAUDE.md`

**Autorização:** o `CLAUDE.md` reserva `.claude/` a pedido explícito do usuário. Concedido em 2026-08-10, registrado na spec.

- [ ] **Passo 1: ler o que já existe**

```
cat .claude/skills/ciclo-de-entrega/SKILL.md
```

Aprenda o formato do frontmatter e o tom antes de escrever. A skill nova segue o mesmo padrão.

- [ ] **Passo 2: escrever a skill**

Criar `.claude/skills/revisar-dossie/SKILL.md`. O frontmatter, literal:

```markdown
---
name: revisar-dossie
description: Use ao ler o dossiê de comportamento do Flow (docs/dossie/) — para julgar o que um branch mudou no comportamento do app antes do merge, ou para fazer uma varredura larga procurando o implausível.
---
```

O corpo tem os dois recortes.

**Recorte por branch.** Entrada: `git diff main...HEAD -- docs/dossie/` mais a intenção declarada do branch. Uma pergunta só — cada mudança de comportamento era pretendida? Saída: uma lista curta, cada item apontando arquivo e trecho. O achado que importa é mudança fora do escopo declarado. Diff vazio é resultado legítimo e vale dizer em voz alta: "o branch não mudou comportamento nenhum".

**Varredura larga.** Entrada: os quatro arquivos inteiros, sem baseline. Procura o implausível — fatura com item repetido, categoria arquivada num seletor, salto de saldo sem lançamento que explique, tela com estado vazio onde há dado.

A skill precisa dizer, com todas as letras, o que **não** fazer: não repetir o que os invariantes já checaram (isso é determinístico e já reprovou, se fosse o caso), e não opinar sobre estilo de código. O dossiê é sobre comportamento.

- [ ] **Passo 3: encaixar no ciclo de entrega**

Em `.claude/skills/ciclo-de-entrega/SKILL.md`, inserir o passo **depois** do `npm test` verde e **antes** do fragmento de `changelog.d/`:

> **Revisão do dossiê.** Rode `npm run dossie`. Se `docs/dossie/` mudou, commite a regeneração e invoque a skill `revisar-dossie` no recorte por branch. Entregue a leitura ao usuário. Não é guarda que aborta — é leitura que ele recebe.

- [ ] **Passo 4: atualizar o `CLAUDE.md`**

Duas edições, nada além:

1. Na tabela "Guardas automáticas", uma linha nova:

| Guarda | Onde | O que bloqueia |
|---|---|---|
| Dossiê | `src/dossie/dossie.test.ts`, rodado por `npm test` | dossiê em `docs/dossie/` desatualizado, ou invariante **garantido** violado. Regenere com `npm run dossie` |

2. Na seção "Comandos", uma linha nova:

```
npm run dossie       # regenera o dossiê de comportamento em docs/dossie/
```

- [ ] **Passo 5: verificar**

```
npm test
```

Esperado: suíte verde.

- [ ] **Passo 6: commitar**

```bash
git add .claude/skills/revisar-dossie/SKILL.md .claude/skills/ciclo-de-entrega/SKILL.md CLAUDE.md
git commit -m "Skill revisar-dossie e encaixe no ciclo de entrega"
```

---

## Fechamento

Esta mudança **não é visível ao usuário do app**. É ferramenta e documentação. Pelo `CLAUDE.md`, o ciclo dela termina no merge: **sem fragmento em `changelog.d/`, sem wiki, sem release, sem deploy.**

Antes de integrar, invoque a skill `ciclo-de-entrega`.

Verificação final, no worktree:

```
npm test
npm run build
node scripts/verificar-dados-reais.mjs
node scripts/verificar-catalogo.mjs
```

Os quatro precisam passar. O do catálogo é relevante mesmo sem mudança de UI: confirma que nada em `src/ui/` foi tocado por engano.
