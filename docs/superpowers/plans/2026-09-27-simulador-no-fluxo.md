# Simulador no Fluxo — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa.
> Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a aba Simular volta como terceira opção do Fluxo. O usuário cria cenários com
itens hipotéticos (gasto ou ganho; uma vez, parcelado ou todo mês) e vê, mês a mês, o saldo
sem e com os cenários.

**Arquitetura:** funções puras novas em `src/domain/simulacao.ts` resumem a série de
`projetarBoxes` por mês. A UI nova (`SimuladorFluxo`, `CenarioCard`, `TabelaSimulacao`,
`FormItemCenario`, `ItemCenarioSheet`) grava pelos repositórios que já existem. Sem mudança de
schema.

**Tecnologias:** React 18, TypeScript, Zustand, Dexie, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-simulador-no-fluxo-design.md` (aprovada).
**Mockup aprovado:** `C:\Users\eitor\Claude\flow-mockups\2026-09-26-simulador-no-fluxo-mockup.html`
(fora do git). Siga-o à risca; um desvio precisa de nova aprovação do usuário.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\simulador-fluxo`, branch
  `simulador-fluxo`. **Não toque no checkout principal.** Antes da primeira edição, rode
  `git rev-parse --show-toplevel` e confira que a saída é o worktree. Não use `git stash`.
- Todo texto de UI, comentário, mensagem de commit e doc em **português**.
- Valores monetários são centavos inteiros. Só dados sintéticos. Nenhum valor em real com
  centavos escrito por extenso em docs, spec ou plano (o verificador de dados reais barra).
- **Regra de sinal (v0.47.0):** movimento sem sinal, cor por `classeEfeito`; saldo abaixo de
  zero com o "−", cor por `classeSaldo`. Funções em `src/domain/money.ts`: `formatarBRL`
  (sem sinal), `formatarSaldo` (com "−" abaixo de zero), `formatarSemSimbolo` (sem "R$", sem
  sinal), `efeitoNoSaldo`, `classeEfeito`, `classeSaldo`. Estorno (valor < 0) leva
  `<span className="badge" style={{ marginLeft: 6 }}>estorno</span>` ao lado do nome.
- Nenhuma dependência nova. Não mexa em `scripts/`, `vite.config.ts`, `tsconfig.json`,
  `package.json` nem `.claude/`.
- Não use `{ timeout: n }` em `findBy*`.
- Antes de editar `src/ui/**` ou `src/styles.css`, leia `docs/estilo-visual.md` e o capítulo
  do nível (classe nova = nível 2; componente novo = nível 4). Todo componente novo em
  `src/ui/*.tsx` (menos `Tela*`) e toda classe nova de `src/styles.css` entram em
  `docs/estilo/catalogo.md` **no mesmo commit**.
- Cada tarefa termina com `npm test` **inteiro** verde. Se o teste do dossiê acusar
  desatualizado, rode `npm run dossie` e inclua `docs/dossie/`.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017FzHH4B7r6fEmfS8JwUHVB
  ```
- O texto `chore(release)` é proibido em mensagens de commit.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/domain/dates.ts` | + `mesCurto` |
| `src/domain/money.ts` | + `formatarSaldoSemSimbolo` |
| `src/domain/simulacao.ts` (novo) | `resumoMensal`, `primeiroMesNegativo`, `extremosPossiveis`, `larguraColunaValor`, `itensDoCenario` |
| `src/db/repo.ts` | trava da F2 (cenário nunca `efetivo`) |
| `src/ui/LancEditor.tsx` | sem "Confirmar" em lançamento de cenário |
| `src/styles.css` | + `table.tabela.tabela-fixa` |
| `src/ui/TabelaSimulacao.tsx` (novo) | tabela Mês · Com · Diferença · Sem |
| `src/ui/FormItemCenario.tsx` (novo) | formulário de item (novo e edição) |
| `src/ui/ItemCenarioSheet.tsx` (novo) | editar ou excluir um item |
| `src/ui/CenarioCard.tsx` (novo) | card de um cenário |
| `src/ui/SimuladorFluxo.tsx` (novo) | a tela Simular |
| `src/state/store.ts`, `src/ui/Shell.tsx`, `src/ui/TelaFluxo.tsx` | navegação |
| `src/ui/TelaSimulador.tsx`, `src/ui/TelaSimulador.test.tsx` | apagados |
| docs | catálogo, domínio, wiki, `src/ui/CLAUDE.md`, fragmento |

---

### Tarefa 1: domínio — resumo mensal e itens do cenário

**Arquivos:**
- Modificar: `src/domain/dates.ts`, `src/domain/dates.test.ts`
- Modificar: `src/domain/money.ts`, `src/domain/money.test.ts`
- Criar: `src/domain/simulacao.ts`, `src/domain/simulacao.test.ts`

**Interfaces (produz):**
```ts
// dates.ts
export function mesCurto(mes: string): string;            // "2026-10" → "out/26"
// money.ts
export function formatarSaldoSemSimbolo(centavos: number): string; // -50000 → "−500,00"
// simulacao.ts
export interface LinhaMes { mes: string; sem: number; com: number; dif: number }
export function resumoMensal(serie: DiaSaldo[], hoje: ISODate): LinhaMes[];
export function primeiroMesNegativo(linhas: LinhaMes[]): string | null;
export function extremosPossiveis(sem: number[], efeitos: number[][]): { min: number[]; max: number[] };
export function larguraColunaValor(sem: number[], ext: { min: number[]; max: number[] }): number;
export type Repeticao = 'unica' | 'parcelado' | 'mensal';
export type ItemCenario =
  | { repeticao: 'unica'; id: ID; data: ISODate; lancamento: Lancamento }
  | { repeticao: 'parcelado' | 'mensal'; id: ID; data: ISODate; recorrencia: Recorrencia };
export function itensDoCenario(dados: Pick<Dados, 'lancamentos' | 'recorrencias'>, cenarioId: ID): ItemCenario[];
```

- [ ] **Passo 1: testes que falham**

Em `src/domain/dates.test.ts`, acrescente `mesCurto` à importação de `./dates` e:

```ts
describe('mesCurto', () => {
  it('abrevia o mês e o ano em dois dígitos', () => {
    expect(mesCurto('2026-10')).toBe('out/26');
    expect(mesCurto('2027-01')).toBe('jan/27');
    expect(mesCurto('2026-12')).toBe('dez/26');
  });
});
```

Em `src/domain/money.test.ts`, acrescente `formatarSaldoSemSimbolo` à importação e:

```ts
describe('formatarSaldoSemSimbolo', () => {
  it('saldo sem "R$": abaixo de zero leva o "−" (U+2212)', () => {
    expect(formatarSaldoSemSimbolo(123456)).toBe('1.234,56');
    expect(formatarSaldoSemSimbolo(0)).toBe('0,00');
    expect(formatarSaldoSemSimbolo(-50000)).toBe('−500,00');
  });
});
```

Crie `src/domain/simulacao.test.ts`:

```ts
import type { DiaSaldo } from './projection';
import type { Lancamento, Recorrencia } from './types';
import {
  extremosPossiveis, itensDoCenario, larguraColunaValor, primeiroMesNegativo, resumoMensal,
} from './simulacao';

const dia = (data: string, sem: number, com: number): DiaSaldo =>
  ({ data, saldoEfetivo: 0, saldoProjetado: sem, saldoComCenarios: com });

describe('resumoMensal', () => {
  it('pega o último dia de cada mês, do mês de hoje em diante', () => {
    const serie = [
      dia('2026-08-31', 900, 900),   // antes do mês de hoje: fica de fora
      dia('2026-09-29', 1000, 1000),
      dia('2026-09-30', 1200, 1100),
      dia('2026-10-01', 1200, 900),
      dia('2026-10-31', 1500, 700),
      dia('2026-11-15', 1600, 600),  // último dia presente na série de novembro
    ];
    expect(resumoMensal(serie, '2026-09-29')).toEqual([
      { mes: '2026-09', sem: 1200, com: 1100, dif: -100 },
      { mes: '2026-10', sem: 1500, com: 700, dif: -800 },
      { mes: '2026-11', sem: 1600, com: 600, dif: -1000 },
    ]);
  });

  it('série vazia dá lista vazia', () => {
    expect(resumoMensal([], '2026-09-29')).toEqual([]);
  });
});

describe('primeiroMesNegativo', () => {
  it('devolve o primeiro mês com saldo com cenários abaixo de zero', () => {
    const linhas = [
      { mes: '2026-09', sem: 100, com: 50, dif: -50 },
      { mes: '2026-10', sem: 100, com: -10, dif: -110 },
      { mes: '2026-11', sem: 100, com: -20, dif: -120 },
    ];
    expect(primeiroMesNegativo(linhas)).toBe('2026-10');
  });
  it('zero não é negativo; sem negativo devolve null', () => {
    expect(primeiroMesNegativo([{ mes: '2026-09', sem: 0, com: 0, dif: 0 }])).toBeNull();
  });
});

describe('extremosPossiveis', () => {
  it('soma separadamente os efeitos negativos e os positivos de cada mês', () => {
    const sem = [1000, 2000];
    const efeitos = [[-300, -600], [500, 200], [-100, 50]];
    // mês 0: min = 1000 − 300 − 100 = 600; max = 1000 + 500 = 1500
    // mês 1: min = 2000 − 600 = 1400;       max = 2000 + 200 + 50 = 2250
    expect(extremosPossiveis(sem, efeitos)).toEqual({ min: [600, 1400], max: [1500, 2250] });
  });
  it('sem cenários, min e max são o próprio sem', () => {
    expect(extremosPossiveis([10, 20], [])).toEqual({ min: [10, 20], max: [10, 20] });
  });
});

describe('larguraColunaValor', () => {
  it('conta o texto mais longo entre saldos (com "−") e diferenças (sem sinal)', () => {
    // tamanhos: sem 100000 → 8; min −250000 → 9 (com o "−"); max 150000 → 8;
    //           dif min −350000 → 8 (sem sinal); dif max 50000 → 6 → maior = 9
    expect(larguraColunaValor([100000], { min: [-250000], max: [150000] })).toBe(9);
  });
  it('nunca fica abaixo de 4 (cabe o "—")', () => {
    expect(larguraColunaValor([], { min: [], max: [] })).toBe(4);
  });
});

describe('itensDoCenario', () => {
  const base = { boxId: 'b', categoriaId: 'c', criadoEm: 'x', alteradoEm: 'x' };
  it('une lançamentos avulsos e recorrências do cenário, pela data, sem os materializados', () => {
    const lancamentos: Lancamento[] = [
      { ...base, id: 'l1', data: '2026-11-05', valor: 100, status: 'previsto', origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'l2', data: '2026-10-10', valor: 50, status: 'previsto', origem: 'recorrencia', cenarioId: 'k', recorrenciaId: 'r1' },
      { ...base, id: 'l3', data: '2026-10-01', valor: 70, status: 'previsto', origem: 'manual', cenarioId: 'outro' },
      { ...base, id: 'l4', data: '2026-10-01', valor: 70, status: 'previsto', origem: 'manual' },
    ];
    const recorrencias: Recorrencia[] = [
      { ...base, id: 'r1', valor: 50, dataInicio: '2026-10-10', diaDoMes: 10, parcelas: 4, ativa: true, origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'r2', valor: 30, dataInicio: '2026-09-20', diaDoMes: 20, parcelas: null, ativa: true, origem: 'manual', cenarioId: 'k' },
      { ...base, id: 'r3', valor: 30, dataInicio: '2026-09-20', diaDoMes: 20, parcelas: null, ativa: true, origem: 'manual' },
    ];
    const itens = itensDoCenario({ lancamentos, recorrencias }, 'k');
    expect(itens.map((i) => [i.id, i.repeticao, i.data])).toEqual([
      ['r2', 'mensal', '2026-09-20'],
      ['r1', 'parcelado', '2026-10-10'],
      ['l1', 'unica', '2026-11-05'],
    ]);
  });
});
```

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/domain/dates.test.ts src/domain/money.test.ts src/domain/simulacao.test.ts`
Esperado: FALHA — funções inexistentes.

- [ ] **Passo 3: implemente**

`src/domain/dates.ts`, logo depois de `mesAbreviado`:

```ts
/** "AAAA-MM" → "out/26": mês curto com o ano em dois dígitos, para colunas estreitas. */
export function mesCurto(mes: string): string {
  const abrev = new Date(`${mes}-15T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  return `${abrev}/${mes.slice(2, 4)}`;
}
```

`src/domain/money.ts`, logo depois de `formatarSemSimbolo`:

```ts
/** Saldo sem "R$" — abaixo de zero leva o "−", como `formatarSaldo`. Para colunas estreitas
 *  de saldo (tabela do Simular). */
export function formatarSaldoSemSimbolo(centavos: number): string {
  return (centavos < 0 ? '−' : '') + formatarSemSimbolo(centavos);
}
```

Crie `src/domain/simulacao.ts`:

```ts
import { mesDe } from './dates';
import { formatarSaldoSemSimbolo, formatarSemSimbolo } from './money';
import type { DiaSaldo } from './projection';
import type { Dados, ID, ISODate, Lancamento, Recorrencia } from './types';

/** Um mês da tabela do Simular: saldo no último dia do mês sem e com os cenários. */
export interface LinhaMes { mes: string; sem: number; com: number; dif: number }

/** Resume a série de `projetarBoxes` por mês, do mês de `hoje` em diante. Usa o último dia de
 *  cada mês presente na série. `sem` é o saldo projetado (efetivo + previsto, sem cenário);
 *  `com` soma os cenários ligados na projeção. */
export function resumoMensal(serie: DiaSaldo[], hoje: ISODate): LinhaMes[] {
  const mesHoje = mesDe(hoje);
  const ultimoDoMes = new Map<string, DiaSaldo>();
  for (const d of serie) {
    const mes = mesDe(d.data);
    if (mes < mesHoje) continue;
    ultimoDoMes.set(mes, d); // a série vem em ordem: o último que entra é o último dia
  }
  return [...ultimoDoMes.entries()].map(([mes, d]) => ({
    mes, sem: d.saldoProjetado, com: d.saldoComCenarios, dif: d.saldoComCenarios - d.saldoProjetado,
  }));
}

/** Primeiro mês com o saldo com cenários abaixo de zero, ou `null`. */
export function primeiroMesNegativo(linhas: LinhaMes[]): string | null {
  return linhas.find((l) => l.com < 0)?.mes ?? null;
}

/** Faixa em que o saldo com cenários pode cair, qualquer que seja a combinação ligada.
 *  `efeitos[i][k]` é a diferença do cenário `i` sozinho no mês `k`. */
export function extremosPossiveis(
  sem: number[], efeitos: number[][],
): { min: number[]; max: number[] } {
  return {
    min: sem.map((s, k) => s + efeitos.reduce((t, e) => t + Math.min(0, e[k] ?? 0), 0)),
    max: sem.map((s, k) => s + efeitos.reduce((t, e) => t + Math.max(0, e[k] ?? 0), 0)),
  };
}

/** Largura, em caracteres, da coluna de valor da tabela do Simular: o texto mais longo entre
 *  os saldos possíveis (com "−") e as diferenças possíveis (sem sinal). Nunca menos de 4. */
export function larguraColunaValor(sem: number[], ext: { min: number[]; max: number[] }): number {
  const textos = sem.flatMap((s, k) => [
    formatarSaldoSemSimbolo(s),
    formatarSaldoSemSimbolo(ext.min[k]),
    formatarSaldoSemSimbolo(ext.max[k]),
    formatarSemSimbolo(ext.min[k] - s),
    formatarSemSimbolo(ext.max[k] - s),
  ]);
  return Math.max(4, ...textos.map((t) => t.length));
}

export type Repeticao = 'unica' | 'parcelado' | 'mensal';

/** Item de um cenário: um lançamento avulso ("uma vez") ou uma recorrência (parcelado ou
 *  todo mês). Os lançamentos materializados da recorrência não são itens. */
export type ItemCenario =
  | { repeticao: 'unica'; id: ID; data: ISODate; lancamento: Lancamento }
  | { repeticao: 'parcelado' | 'mensal'; id: ID; data: ISODate; recorrencia: Recorrencia };

export function itensDoCenario(
  dados: Pick<Dados, 'lancamentos' | 'recorrencias'>, cenarioId: ID,
): ItemCenario[] {
  const avulsos: ItemCenario[] = dados.lancamentos
    .filter((l) => l.cenarioId === cenarioId && l.recorrenciaId == null)
    .map((l) => ({ repeticao: 'unica', id: l.id, data: l.data, lancamento: l }));
  const recorrentes: ItemCenario[] = dados.recorrencias
    .filter((r) => r.cenarioId === cenarioId)
    .map((r) => ({
      repeticao: r.parcelas == null ? 'mensal' : 'parcelado', id: r.id, data: r.dataInicio, recorrencia: r,
    }));
  return [...avulsos, ...recorrentes].sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Passo 4: rode e veja passar**

Run: `npx vitest run src/domain/dates.test.ts src/domain/money.test.ts src/domain/simulacao.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: suíte inteira e commit**

Run: `npm test` — verde.

```bash
git add src/domain/
git commit -m "feat(simulacao): resumo mensal, extremos e itens do cenário"
```

---

### Tarefa 2: F2 — lançamento de cenário nunca vira efetivo

**Arquivos:**
- Modificar: `src/db/repo.ts` (`salvarLancamento`, `atualizarLancamento`)
- Modificar: `src/db/repo.test.ts`
- Modificar: `src/ui/LancEditor.tsx` (botão "✓ Confirmar", ~linha 79)
- Modificar: `src/ui/LancEditor.test.tsx`
- Modificar: `docs/dominio.md` (seção sobre cenário virando `efetivo`, ~linhas 143–163 e 423)

**Interfaces:** `confirmarPendente` passa por `atualizarLancamento`, então herda a trava.

- [ ] **Passo 1: testes que falham**

Em `src/db/repo.test.ts`, acrescente (siga as importações e o `beforeEach` do arquivo):

```ts
describe('lançamento de cenário nunca é efetivo', () => {
  async function lancDeCenario() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'b', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'c', tipo: 'gasto', ordem: 0 });
    const cenario = { id: novoId(), nome: 'e se', ligado: true, criadoEm: agora, alteradoEm: agora };
    await repo.salvarCenario(cenario);
    const lanc = await repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-10-10', valor: 5000, status: 'previsto', cenarioId: cenario.id,
    });
    return { box, cat, lanc };
  }

  it('confirmarPendente recusa e não grava', async () => {
    const { lanc } = await lancDeCenario();
    await expect(repo.confirmarPendente(lanc.id)).rejects.toThrow(/cenário/);
    expect((await db.lancamentos.get(lanc.id))?.status).toBe('previsto');
  });

  it('atualizarLancamento recusa status efetivo, mas aceita editar o resto', async () => {
    const { lanc } = await lancDeCenario();
    await expect(repo.atualizarLancamento(lanc.id, { status: 'efetivo' })).rejects.toThrow(/cenário/);
    await repo.atualizarLancamento(lanc.id, { valor: 7000 });
    expect((await db.lancamentos.get(lanc.id))?.valor).toBe(7000);
  });

  it('salvarLancamento recusa criar lançamento de cenário já efetivo', async () => {
    const { box, cat } = await lancDeCenario();
    await expect(repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-10-10', valor: 1, status: 'efetivo', cenarioId: 'x',
    })).rejects.toThrow(/cenário/);
  });

  it('lançamento comum continua confirmando', async () => {
    const { box, cat } = await lancDeCenario();
    const comum = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-10-10', valor: 1, status: 'previsto' });
    await repo.confirmarPendente(comum.id);
    expect((await db.lancamentos.get(comum.id))?.status).toBe('efetivo');
  });
});
```

Se `db`, `agoraISO` ou `novoId` não estiverem importados no arquivo, importe de
`./database` e `../domain/types`.

Em `src/ui/LancEditor.test.tsx`, acrescente um teste que abre o `LancEditor` com um
lançamento `previsto` que tem `cenarioId` (siga o preparo dos testes existentes no arquivo) e
confere `expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument()`,
e que "Salvar" e "Excluir" continuam lá.

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/db/repo.test.ts src/ui/LancEditor.test.tsx`
Esperado: FALHA nos testes novos.

- [ ] **Passo 3: implemente**

`src/db/repo.ts` — acrescente, perto de `salvarLancamento`:

```ts
/** Cenário é hipotético: um lançamento dele nunca é `efetivo` (docs/dominio.md). Para trazer
 *  um cenário para os dados reais, use `converterCenarioEmReal`. */
function recusarEfetivoDeCenario(cenarioId: ID | undefined, status: StatusLancamento | undefined): void {
  if (cenarioId && status === 'efetivo') {
    throw new Error('Lançamento de cenário não pode ser efetivo: use "Tornar real" no cenário.');
  }
}
```

Em `salvarLancamento`, antes de montar `l`: `recusarEfetivoDeCenario(n.cenarioId, n.status);`

Em `atualizarLancamento`, dentro da transação, antes do `update`:

```ts
    if (patch.status === 'efetivo') {
      const atual = await db.lancamentos.get(id);
      recusarEfetivoDeCenario(atual?.cenarioId, 'efetivo');
    }
```

(`StatusLancamento` já é importado de `../domain/types`; confira.)

`src/ui/LancEditor.tsx`: a condição do botão Confirmar passa a
`{lanc.status === 'previsto' && !lanc.cenarioId && (`.

`docs/dominio.md`: a ressalva "Expectativa não garantida — cenário virando `efetivo`" vira
garantia: "`repo.salvarLancamento` e `repo.atualizarLancamento` (e, por ela,
`confirmarPendente`) recusam `status: 'efetivo'` em lançamento com `cenarioId`; o `LancEditor`
não mostra 'Confirmar' nele." Atualize também a linha da lista de invariantes (~423) e as
referências a `TelaSimulador.tsx` na tabela status × origem (~128–144): a tela que cria
lançamento de cenário passa a ser `SimuladorFluxo` (Fluxo › Simular), alcançável.

- [ ] **Passo 4: rode e veja passar; suíte inteira; commit**

Run: `npx vitest run src/db/repo.test.ts src/ui/LancEditor.test.tsx` e `npm test` — verde.

```bash
git add src/db/repo.ts src/db/repo.test.ts src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx docs/dominio.md
git commit -m "fix(cenario): lançamento de cenário nunca vira efetivo (F2)"
```

---

### Tarefa 3: tabela do Simular

**Arquivos:**
- Modificar: `src/styles.css` (depois do bloco `table.tabela`, ~linha 265)
- Criar: `src/ui/TabelaSimulacao.tsx`, `src/ui/TabelaSimulacao.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (classe `.tabela-fixa` e componente `TabelaSimulacao.tsx`)

**Interfaces:**
- Consome: `LinhaMes` (Tarefa 1), `mesCurto`, `formatarSaldoSemSimbolo`,
  `formatarSemSimbolo`, `classeSaldo`, `classeEfeito`.
- Produz: `export default function TabelaSimulacao(props: { linhas: LinhaMes[]; larguraCh: number })`.

- [ ] **Passo 1: teste que falha** — crie `src/ui/TabelaSimulacao.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import TabelaSimulacao from './TabelaSimulacao';

const linhas = [
  { mes: '2026-10', sem: 100000, com: 100000, dif: 0 },
  { mes: '2026-11', sem: 100000, com: 70000, dif: -30000 },
  { mes: '2026-12', sem: 100000, com: -50000, dif: -150000 },
  { mes: '2027-01', sem: 100000, com: 120000, dif: 20000 },
];

it('mostra Mês · Com · Diferença · Sem, com mês curto e "Valores em R$"', () => {
  render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  expect(screen.getByText('Valores em R$')).toBeInTheDocument();
  const cab = screen.getAllByRole('columnheader').map((th) => th.textContent);
  expect(cab).toEqual(['Mês', 'Com', 'Diferença', 'Sem']);
  expect(screen.getByText('nov/26')).toBeInTheDocument();
});

it('saldo abaixo de zero leva "−" e vermelho; diferença sem sinal, pela cor; zero vira "—"', () => {
  render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  const [, , dez, jan] = screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell'));
  expect(dez[1]).toHaveTextContent('−500,00');
  expect(dez[1].querySelector('strong')).toHaveClass('total-dia', 'neg');
  expect(dez[2]).toHaveTextContent(/^1\.500,00$/);
  expect(dez[2].querySelector('strong')).toHaveClass('valor-gasto');
  expect(jan[2]).toHaveTextContent(/^200,00$/);
  expect(jan[2].querySelector('strong')).toHaveClass('valor-ganho');
  const out = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
  expect(out[2]).toHaveTextContent('—');
  expect(out[3].querySelector('strong')).toHaveClass('total-dia', 'pos');
});

it('largura mínima vem só de larguraCh, não do conteúdo', () => {
  const { container, rerender } = render(<TabelaSimulacao linhas={linhas} larguraCh={9} />);
  const antes = (container.querySelector('table') as HTMLElement).style.minWidth;
  rerender(<TabelaSimulacao linhas={linhas.map((l) => ({ ...l, com: l.sem, dif: 0 }))} larguraCh={9} />);
  expect((container.querySelector('table') as HTMLElement).style.minWidth).toBe(antes);
  expect(container.querySelector('table')).toHaveClass('tabela', 'tabela-fixa');
});
```

- [ ] **Passo 2: rode e veja falhar** — `npx vitest run src/ui/TabelaSimulacao.test.tsx`: FALHA.

- [ ] **Passo 3: implemente**

`src/styles.css`, logo depois das regras de `table.tabela`:

```css
/* Tabela de colunas com largura fixa (Simular, no Fluxo): o conteúdo não muda as colunas.
   A 1ª coluna recebe largura pelo <col>; as demais dividem o resto por igual. O min-width,
   posto pelo componente, impede valor espremido — abaixo dele o .rolavel rola. */
table.tabela.tabela-fixa { table-layout: fixed; width: 100%; }
table.tabela.tabela-fixa th, table.tabela.tabela-fixa td { padding: 8px; }
table.tabela.tabela-fixa th:first-child, table.tabela.tabela-fixa td:first-child { width: auto; max-width: none; }
```

Crie `src/ui/TabelaSimulacao.tsx`:

```tsx
import { mesCurto } from '../domain/dates';
import { classeEfeito, classeSaldo, formatarSaldoSemSimbolo, formatarSemSimbolo } from '../domain/money';
import type { LinhaMes } from '../domain/simulacao';

interface Props {
  linhas: LinhaMes[];
  /** Largura de cada coluna de valor, em caracteres (`larguraColunaValor`). Vem dos extremos
   *  possíveis de todos os cenários, então ligar ou desligar um cenário não a muda. */
  larguraCh: number;
}

// "out/26": 6 caracteres; o padding de cada célula é 8px de cada lado.
const MES_CH = 6;
const PADDING_PX = 16;

/** Tabela mês a mês do Simular: saldo com e sem os cenários, e a diferença. Com e Sem são
 *  saldos (abaixo de zero levam "−"); Diferença é movimento (sem sinal, a cor diz). */
export default function TabelaSimulacao({ linhas, larguraCh }: Props) {
  const minWidth = `calc(${MES_CH + 3 * larguraCh}ch + ${4 * PADDING_PX}px)`;
  return (
    <>
      <p className="sub" style={{ margin: '0 8px 4px', textAlign: 'right' }}>Valores em R$</p>
      <div className="rolavel">
        <table className="tabela tabela-fixa" style={{ minWidth }}>
          <colgroup>
            <col style={{ width: `calc(${MES_CH}ch + ${PADDING_PX}px)` }} />
            <col /><col /><col />
          </colgroup>
          <thead>
            <tr><th>Mês</th><th>Com</th><th>Diferença</th><th>Sem</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.mes}>
                <td>{mesCurto(l.mes)}</td>
                <td><strong className={classeSaldo(l.com)}>{formatarSaldoSemSimbolo(l.com)}</strong></td>
                <td>
                  {l.dif === 0 ? '—' : <strong className={classeEfeito(l.dif)}>{formatarSemSimbolo(l.dif)}</strong>}
                </td>
                <td><strong className={classeSaldo(l.sem)}>{formatarSaldoSemSimbolo(l.sem)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

`docs/estilo/catalogo.md`: acrescente a classe `.tabela-fixa` junto das entradas de
`.tabela` (siga o formato vizinho) e o componente, no formato dos outros:
`- **\`TabelaSimulacao.tsx\`** — tabela mês a mês do Simular (Mês · Com · Diferença · Sem), em
\`.tabela.tabela-fixa\`; largura mínima vinda dos extremos possíveis, para ligar ou desligar
cenários não mexer nas colunas.`

- [ ] **Passo 4: rode; `node scripts/verificar-catalogo.mjs`; suíte inteira; commit**

```bash
git add src/styles.css src/ui/TabelaSimulacao.tsx src/ui/TabelaSimulacao.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): tabela do Simular com colunas de largura fixa"
```

---

### Tarefa 4: formulário e edição de item de cenário

**Arquivos:**
- Criar: `src/ui/FormItemCenario.tsx`, `src/ui/FormItemCenario.test.tsx`
- Criar: `src/ui/ItemCenarioSheet.tsx`, `src/ui/ItemCenarioSheet.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (os dois componentes)

**Interfaces:**
- Consome: `Repeticao`, `ItemCenario` (Tarefa 1); `CampoValor` (`id`, `valorCentavos`,
  `onChange`, `style`), `CampoData` (`id`, `value`, `onChange`), `SeletorPills`
  (`opcoes`, `selecionadaId`, `onSelecionar`, `rotulo`) e `OPCOES_TIPO`, `SeletorCategoria`
  (`categorias`, `selecionadaId`, `onSelecionar`), `Sheet` (`aberto`, `onFechar`, `rotulo`).
- Produz:
```ts
export interface ValoresItem {
  valor: number; descricao: string; tipo: TipoCategoria; categoriaId: ID | null;
  repeticao: Repeticao; data: ISODate; parcelas: number;
}
export function categoriasDoItem(dados: Dados, boxId: ID, tipo: TipoCategoria): Categoria[];
export async function gravarItemNovo(cenarioId: ID, boxId: ID, v: ValoresItem, horizonte: ISODate): Promise<void>;
export default function FormItemCenario(props: {
  boxId: ID; inicial: ValoresItem; repeticaoFixa?: boolean; rotuloBotao: string;
  onSalvar: (v: ValoresItem) => Promise<void>;
}): JSX.Element;
// ItemCenarioSheet.tsx
export default function ItemCenarioSheet(props: { item: ItemCenario; onFechar: () => void }): JSX.Element;
```

- [ ] **Passo 1: testes que falham**

Crie `src/ui/FormItemCenario.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import FormItemCenario, { gravarItemNovo, type ValoresItem } from './FormItemCenario';

beforeEach(async () => { await limparDb(); });

async function preparar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const casa = await repo.salvarCategoria({ boxId: box.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const extra = await repo.salvarCategoria({ boxId: box.id, nome: 'Extra', tipo: 'ganho', ordem: 1 });
  const cenario = { id: novoId(), nome: 'Mudança', ligado: true, criadoEm: agora, alteradoEm: agora };
  await repo.salvarCenario(cenario);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, casa, extra, cenario };
}

const vazio = (data = '2026-09-15'): ValoresItem =>
  ({ valor: 0, descricao: '', tipo: 'gasto', categoriaId: null, repeticao: 'unica', data, parcelas: 2 });

it('Adicionar fica desativado sem valor ou sem categoria', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  const botao = screen.getByRole('button', { name: 'Adicionar ao cenário' });
  expect(botao).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  expect(botao).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  expect(botao).toBeEnabled();
});

it('Parcelado exige 2 parcelas ou mais e mostra o valor da parcela', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.type(screen.getByLabelText('Valor'), '1000,00');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Parcelado' }));
  const parcelas = screen.getByLabelText('Parcelas');
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '1');
  expect(screen.getByRole('button', { name: 'Adicionar ao cenário' })).toBeDisabled();
  await userEvent.clear(parcelas);
  await userEvent.type(parcelas, '4');
  expect(screen.getByRole('button', { name: 'Adicionar ao cenário' })).toBeEnabled();
  // 100000 / 4 = 25000 centavos
  expect(screen.getByText(/cada parcela sai por R\$\s*250,00/)).toBeInTheDocument();
});

it('Todo mês mostra a dica de lançar só a diferença', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Todo mês' }));
  expect(screen.getByText(/lance só a diferença/)).toBeInTheDocument();
});

it('trocar para Ganho mostra só categorias de ganho', async () => {
  const { box } = await preparar();
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async () => {}} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Ganho' }));
  expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Casa' })).not.toBeInTheDocument();
});

it('onSalvar recebe os valores digitados', async () => {
  const { box } = await preparar();
  let recebido: ValoresItem | null = null;
  render(<FormItemCenario boxId={box.id} inicial={vazio()} rotuloBotao="Adicionar ao cenário" onSalvar={async (v) => { recebido = v; }} />);
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await userEvent.type(screen.getByLabelText('Descrição'), 'Geladeira');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-12-05' } });
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
  expect(recebido).toMatchObject({ valor: 30000, descricao: 'Geladeira', repeticao: 'unica', data: '2026-12-05' });
});

describe('gravarItemNovo', () => {
  it('uma vez vira lançamento previsto do cenário, com a descrição na nota', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-12-05'), valor: 30000, categoriaId: casa.id, descricao: 'Geladeira' }, '2027-12-31');
    const [l] = await db.lancamentos.where('cenarioId').equals(cenario.id).toArray();
    expect(l).toMatchObject({ valor: 30000, status: 'previsto', nota: 'Geladeira', data: '2026-12-05', recorrenciaId: undefined });
  });
  it('parcelado vira recorrência com a parcela arredondada e N parcelas', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-10-10'), valor: 100000, categoriaId: casa.id, repeticao: 'parcelado', parcelas: 3 }, '2027-12-31');
    const [r] = (await db.recorrencias.toArray()).filter((x) => x.cenarioId === cenario.id);
    // 100000 / 3 = 33333,33 → 33333
    expect(r).toMatchObject({ valor: 33333, parcelas: 3, dataInicio: '2026-10-10', diaDoMes: 10 });
  });
  it('todo mês vira recorrência sem fim', async () => {
    const { box, casa, cenario } = await preparar();
    await gravarItemNovo(cenario.id, box.id, { ...vazio('2026-10-10'), valor: 40000, categoriaId: casa.id, repeticao: 'mensal' }, '2027-12-31');
    const [r] = (await db.recorrencias.toArray()).filter((x) => x.cenarioId === cenario.id);
    expect(r).toMatchObject({ valor: 40000, parcelas: null });
  });
});
```

Crie `src/ui/ItemCenarioSheet.test.tsx`: com o mesmo `preparar()` (copie a função), grave um
item "uma vez" (`gravarItemNovo`, valor 30000, Casa, descrição "Geladeira") e um "parcelado"
(100000 em 4x, Casa); rode `useApp.getState().recarregar()`; monte o item com
`itensDoCenario(useApp.getState().dados!, cenario.id)`. Testes:

1. Editar o "uma vez": render `<ItemCenarioSheet item={itemUnica} onFechar={fn} />`; o campo
   Valor mostra "R$ 300,00" e Descrição "Geladeira"; limpe a descrição e digite "Fogão";
   clique "Salvar"; o lançamento no banco tem `nota: 'Fogão'`; `onFechar` foi chamado.
2. Editar o parcelado: o campo Valor mostra o **total** (25000 × 4 = 100000 → "R$ 1.000,00");
   o seletor de repetição não aparece (`queryByRole('radio', { name: 'Uma vez' })` ausente);
   troque Parcelas para 5 e salve; a recorrência tem `parcelas: 5` e `valor: 20000`
   (100000 / 5).
3. Excluir: com `vi.spyOn(window, 'confirm').mockReturnValue(true)`, clique "Excluir item";
   o item some do banco (lançamento ou recorrência).

- [ ] **Passo 2: rode e veja falhar** — `npx vitest run src/ui/FormItemCenario.test.tsx src/ui/ItemCenarioSheet.test.tsx`.

- [ ] **Passo 3: implemente**

Crie `src/ui/FormItemCenario.tsx`:

```tsx
import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Repeticao } from '../domain/simulacao';
import { categoriasTransferenciaIds } from '../domain/transferencia';
import type { Categoria, Dados, ID, ISODate, TipoCategoria } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';
import SeletorPills, { OPCOES_TIPO } from './SeletorPills';

export interface ValoresItem {
  valor: number; descricao: string; tipo: TipoCategoria; categoriaId: ID | null;
  repeticao: Repeticao; data: ISODate; parcelas: number;
}

const OPCOES_REPETICAO: { id: Repeticao; nome: string }[] = [
  { id: 'unica', nome: 'Uma vez' },
  { id: 'parcelado', nome: 'Parcelado' },
  { id: 'mensal', nome: 'Todo mês' },
];

/** Categorias que um item de cenário pode usar: da box, do tipo, ativas, sem as de fatura e
 *  de transferência (as mesmas que Lançar esconde). */
export function categoriasDoItem(dados: Dados, boxId: ID, tipo: TipoCategoria): Categoria[] {
  const ocultas = new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)]);
  return dados.categorias.filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id));
}

/** Grava um item novo no cenário: "uma vez" vira lançamento previsto; "parcelado" e "todo
 *  mês" viram recorrência (parcela = total ÷ N, arredondada). A descrição vai na nota. */
export async function gravarItemNovo(cenarioId: ID, boxId: ID, v: ValoresItem, horizonte: ISODate): Promise<void> {
  const nota = v.descricao.trim() || undefined;
  if (v.repeticao === 'unica') {
    await repo.salvarLancamento({
      boxId, categoriaId: v.categoriaId!, data: v.data, valor: v.valor, status: 'previsto', cenarioId, nota,
    });
    return;
  }
  const parcelado = v.repeticao === 'parcelado';
  await repo.salvarRecorrencia({
    boxId, categoriaId: v.categoriaId!, dataInicio: v.data, diaDoMes: Number(v.data.slice(8, 10)),
    valor: parcelado ? Math.round(v.valor / v.parcelas) : v.valor,
    parcelas: parcelado ? v.parcelas : null, nota, cenarioId,
  }, horizonte);
}

interface Props {
  boxId: ID;
  inicial: ValoresItem;
  /** Na edição, a repetição não muda: para trocar, exclui-se o item e cria-se outro. */
  repeticaoFixa?: boolean;
  rotuloBotao: string;
  onSalvar: (v: ValoresItem) => Promise<void>;
}

export default function FormItemCenario({ boxId, inicial, repeticaoFixa, rotuloBotao, onSalvar }: Props) {
  const { dados } = useApp();
  const uid = useId();
  const [v, setV] = useState<ValoresItem>(inicial);
  const [parcelasTexto, setParcelasTexto] = useState(String(inicial.parcelas));
  const [salvando, setSalvando] = useState(false);
  if (!dados) return null;
  const mudar = (patch: Partial<ValoresItem>) => setV((atual) => ({ ...atual, ...patch }));
  const categorias = categoriasDoItem(dados, boxId, v.tipo);
  const parcelas = Number(parcelasTexto) || 0;
  const valido = v.valor > 0 && v.categoriaId != null && (v.repeticao !== 'parcelado' || parcelas >= 2);

  async function salvar() {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({ ...v, parcelas });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="tela">
      <div className="campo">
        <label htmlFor={`${uid}-valor`}>Valor</label>
        <CampoValor id={`${uid}-valor`} valorCentavos={v.valor} onChange={(valor) => mudar({ valor })} style={{ fontSize: 28 }} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-descricao`}>Descrição</label>
        <input
          id={`${uid}-descricao`} placeholder="ex.: diferença do aluguel" value={v.descricao}
          onChange={(e) => mudar({ descricao: e.target.value })}
        />
      </div>
      <SeletorPills
        rotulo="Tipo" opcoes={OPCOES_TIPO} selecionadaId={v.tipo}
        onSelecionar={(id) => mudar({ tipo: id as TipoCategoria, categoriaId: null })}
      />
      <SeletorCategoria categorias={categorias} selecionadaId={v.categoriaId} onSelecionar={(categoriaId) => mudar({ categoriaId })} />
      {!repeticaoFixa && (
        <SeletorPills
          rotulo="Repetição" opcoes={OPCOES_REPETICAO} selecionadaId={v.repeticao}
          onSelecionar={(id) => mudar({ repeticao: id as Repeticao })}
        />
      )}
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-data`}>{v.repeticao === 'unica' ? 'Data' : 'A partir de'}</label>
          <CampoData id={`${uid}-data`} value={v.data} onChange={(data) => mudar({ data })} />
        </div>
        {v.repeticao === 'parcelado' && (
          <div className="campo">
            <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
            <input
              id={`${uid}-parcelas`} inputMode="numeric" value={parcelasTexto}
              onChange={(e) => setParcelasTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
      </div>
      {v.repeticao === 'parcelado' && parcelas >= 2 && v.valor > 0 && (
        <p className="sub" style={{ margin: 0 }}>
          O valor é o total: cada parcela sai por {formatarBRL(Math.round(v.valor / parcelas))}.
        </p>
      )}
      {v.repeticao === 'mensal' && (
        <p className="sub" style={{ margin: 0 }}>
          Repete todo mês até o fim da projeção. Para algo que já existe, como aluguel ou salário, lance só a diferença.
        </p>
      )}
      <button className="botao botao-primario" style={{ padding: 14 }} disabled={!valido || salvando} onClick={salvar}>
        {rotuloBotao}
      </button>
    </div>
  );
}
```

Confira o rótulo que `CampoData` expõe: o teste usa `getByLabelText('Data')` com
`fireEvent.change` no `<input type="date">` interno (veja `src/ui/CampoData.tsx` e como
`TelaLancar.test.tsx` muda a data). Se o input interno não for o elemento rotulado, ajuste o
**teste** para o mesmo jeito que `TelaLancar.test.tsx` usa.

Crie `src/ui/ItemCenarioSheet.tsx`:

```tsx
import * as repo from '../db/repo';
import type { ItemCenario } from '../domain/simulacao';
import { useApp } from '../state/store';
import FormItemCenario, { type ValoresItem } from './FormItemCenario';
import Sheet from './Sheet';

interface Props { item: ItemCenario; onFechar: () => void }

/** Editar ou excluir um item de cenário. A repetição fica fixa. */
export default function ItemCenarioSheet({ item, onFechar }: Props) {
  const { dados, recarregar } = useApp();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const tipoDe = (categoriaId: string) => dados.categorias.find((c) => c.id === categoriaId)?.tipo ?? 'gasto';

  const inicial: ValoresItem = item.repeticao === 'unica'
    ? {
      valor: item.lancamento.valor, descricao: item.lancamento.nota ?? '', tipo: tipoDe(item.lancamento.categoriaId),
      categoriaId: item.lancamento.categoriaId, repeticao: 'unica', data: item.lancamento.data, parcelas: 2,
    }
    : {
      valor: item.recorrencia.valor * (item.recorrencia.parcelas ?? 1), descricao: item.recorrencia.nota ?? '',
      tipo: tipoDe(item.recorrencia.categoriaId), categoriaId: item.recorrencia.categoriaId, repeticao: item.repeticao,
      data: item.recorrencia.dataInicio, parcelas: item.recorrencia.parcelas ?? 2,
    };
  const boxId = item.repeticao === 'unica' ? item.lancamento.boxId : item.recorrencia.boxId;

  async function salvar(v: ValoresItem) {
    const nota = v.descricao.trim() || undefined;
    if (item.repeticao === 'unica') {
      await repo.atualizarLancamento(item.id, { valor: v.valor, data: v.data, categoriaId: v.categoriaId!, nota });
    } else {
      const parcelado = item.repeticao === 'parcelado';
      await repo.salvarRecorrencia({
        ...item.recorrencia, categoriaId: v.categoriaId!, dataInicio: v.data, diaDoMes: Number(v.data.slice(8, 10)),
        valor: parcelado ? Math.round(v.valor / v.parcelas) : v.valor, parcelas: parcelado ? v.parcelas : null, nota,
      }, horizonte);
    }
    await recarregar();
    onFechar();
  }

  async function excluir() {
    if (!window.confirm('Excluir este item do cenário?')) return;
    if (item.repeticao === 'unica') await repo.excluirLancamento(item.id);
    else await repo.excluirRecorrencia(item.id);
    await recarregar();
    onFechar();
  }

  return (
    <Sheet aberto onFechar={onFechar} rotulo="Item do cenário">
      <h2 style={{ marginTop: 0 }}>Item do cenário</h2>
      <FormItemCenario boxId={boxId} inicial={inicial} repeticaoFixa rotuloBotao="Salvar" onSalvar={salvar} />
      <div className="acoes" style={{ marginTop: 12 }}>
        <button className="botao botao-perigo" onClick={excluir}>Excluir item</button>
        <button className="botao" onClick={onFechar}>Fechar</button>
      </div>
    </Sheet>
  );
}
```

`docs/estilo/catalogo.md`: entradas para `FormItemCenario.tsx` (formulário de item de
cenário, novo e edição: valor, descrição, Gasto/Ganho, categoria, Uma vez/Parcelado/Todo mês,
data, parcelas) e `ItemCenarioSheet.tsx` (sheet de editar ou excluir um item; repetição fixa).
Acrescente `FormItemCenario.tsx` à lista de quem usa `SeletorCategoria` (linha ~130) — e,
nessa mesma linha, **tire** `TelaSimulador.tsx` (ele sai na Tarefa 5; o verificador não
cobra `Tela*`, mas a lista não pode citar arquivo morto).

- [ ] **Passo 4: rode; verificador de catálogo; suíte inteira; commit**

```bash
git add src/ui/FormItemCenario.tsx src/ui/FormItemCenario.test.tsx src/ui/ItemCenarioSheet.tsx src/ui/ItemCenarioSheet.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): formulário e edição de item de cenário"
```

---

### Tarefa 5: tela Simular no Fluxo e navegação

**Arquivos:**
- Criar: `src/ui/CenarioCard.tsx`, `src/ui/SimuladorFluxo.tsx`, `src/ui/SimuladorFluxo.test.tsx`
- Modificar: `src/state/store.ts` (`Aba`, `AbaFluxo`)
- Modificar: `src/ui/Shell.tsx` (import, comentário de `ABAS`, `NOMES_ABA`, render)
- Modificar: `src/ui/TelaFluxo.tsx` (terceira pílula e render)
- Modificar: `src/ui/TelaFluxo.test.tsx` (um teste da pílula)
- Apagar: `src/ui/TelaSimulador.tsx`, `src/ui/TelaSimulador.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (`CenarioCard.tsx`, `SimuladorFluxo.tsx`)

**Interfaces:**
- Consome: Tarefas 1, 3 e 4; `projetarBoxes` (`src/domain/projection.ts`);
  `boxIdsSelecionadas`, `boxIdEfetivo`, `cenariosLigados` (`src/state/store.ts`);
  `mesAbreviado` (`src/domain/dates.ts`, "2026-10" → "out/2026").
- Produz: `export default function SimuladorFluxo()`;
  `export default function CenarioCard(props: { cenario: Cenario; linhas: LinhaMes[]; larguraCh: number; aberto: boolean; onAlternar: () => void; boxIdNovo: ID | null })`.

- [ ] **Passo 1: testes que falham** — crie `src/ui/SimuladorFluxo.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import SimuladorFluxo from './SimuladorFluxo';

beforeEach(async () => { await limparDb(); });

/** Box com 1.000,00 desde 01/09/2026, hoje 15/09/2026, sem outros lançamentos: o saldo "sem"
 *  é 100000 centavos em todo mês. */
async function preparar() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-09-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const casa = await repo.salvarCategoria({ boxId: box.id, nome: 'Casa', tipo: 'gasto', ordem: 0 });
  const extra = await repo.salvarCategoria({ boxId: box.id, nome: 'Extra', tipo: 'ganho', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, casa, extra };
}

async function cenarioCom(nome: string, ligado: boolean, lanc: { categoriaId: string; boxId: string; data: string; valor: number; nota?: string }) {
  const agora = agoraISO();
  const c = { id: novoId(), nome, ligado, criadoEm: agora, alteradoEm: agora };
  await repo.salvarCenario(c);
  await repo.salvarLancamento({ ...lanc, status: 'previsto', cenarioId: c.id });
  await useApp.getState().recarregar();
  return c;
}

const linhaDoMes = (tabela: HTMLElement, mes: string) =>
  within(tabela).getByText(mes).closest('tr') as HTMLElement;

it('criar cenário: formulário no topo, o cenário nasce ligado e aberto', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  expect(await screen.findByRole('checkbox', { name: 'Ligar Mudança' })).toBeChecked();
  expect(screen.getByText('Novo item')).toBeInTheDocument();
  expect((await db.cenarios.toArray())[0]).toMatchObject({ nome: 'Mudança', ligado: true });
});

it('Criar fica desativado com o nome vazio', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
});

it('resumo combinado: gasto de 300,00 em outubro tira 300,00 de outubro em diante', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Geladeira', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  const tabela = within(resumo).getByRole('table');
  const set = within(linhaDoMes(tabela, 'set/26')).getAllByRole('cell');
  expect(set[2]).toHaveTextContent('—');
  const out = within(linhaDoMes(tabela, 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('700,00');     // com: 100000 − 30000
  expect(out[2]).toHaveTextContent(/^300,00$/);   // diferença, sem sinal
  expect(out[2].querySelector('strong')).toHaveClass('valor-gasto');
  expect(out[3]).toHaveTextContent('1.000,00');   // sem
  expect(within(resumo).getByText(/segue positivo/)).toBeInTheDocument();
});

it('saldo negativo: aviso com o mês e o "−" na coluna Com', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('Carro', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 150000 });
  render(<SimuladorFluxo />);
  const resumo = screen.getByRole('region', { name: 'Cenários ligados' });
  expect(within(resumo).getByText(/o saldo fica negativo em out\/2026/)).toBeInTheDocument();
  const out = within(linhaDoMes(within(resumo).getByRole('table'), 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent('−500,00');    // 100000 − 150000 = −50000
  expect(out[1].querySelector('strong')).toHaveClass('total-dia', 'neg');
});

it('cenário desligado não entra no resumo, mas o impacto dele aparece ao abrir', async () => {
  const { box, extra } = await preparar();
  await cenarioCom('Freela', false, { boxId: box.id, categoriaId: extra.id, data: '2026-10-10', valor: 20000, nota: 'Pagamento' });
  render(<SimuladorFluxo />);
  expect(screen.getByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Freela/ }));
  const impacto = screen.getByRole('region', { name: 'Impacto só deste cenário' });
  const out = within(linhaDoMes(within(impacto).getByRole('table'), 'out/26')).getAllByRole('cell');
  expect(out[1]).toHaveTextContent(formatarSaldoSemSimbolo(120000));
  expect(out[2].querySelector('strong')).toHaveClass('valor-ganho');
  // o item de ganho aparece verde
  expect(screen.getByText('Pagamento').closest('.item')?.querySelector('.valor-ganho')).not.toBeNull();
});

it('ligar e desligar muda o resumo sem mudar a largura da tabela', async () => {
  const { box, casa } = await preparar();
  const c = await cenarioCom('Geladeira', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 30000 });
  render(<SimuladorFluxo />);
  const tabelaAntes = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
  const larguraAntes = tabelaAntes.style.minWidth;
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ligar Geladeira' }));
  expect(await screen.findByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  expect((await db.cenarios.get(c.id))?.ligado).toBe(false);
  const tabelaDepois = within(screen.getByRole('region', { name: 'Cenários ligados' })).getByRole('table');
  expect(tabelaDepois.style.minWidth).toBe(larguraAntes);
});

it('só um cenário aberto por vez; a seta abre; o checkbox não abre', async () => {
  const { box, casa } = await preparar();
  await cenarioCom('A', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  await cenarioCom('B', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Ligar A' }));
  expect(screen.queryByText('Novo item')).not.toBeInTheDocument();
  const botaoA = screen.getByRole('button', { name: /^A/ });
  await userEvent.click(within(botaoA).getByText('▼'));
  expect(botaoA).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(screen.getByRole('button', { name: /^B/ }));
  expect(botaoA).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getAllByText('Novo item')).toHaveLength(1);
});

it('adicionar item pelo cenário grava no cenário certo', async () => {
  await preparar();
  render(<SimuladorFluxo />);
  await userEvent.type(screen.getByLabelText('Novo cenário'), 'Mudança');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  await screen.findByText('Novo item');
  await userEvent.type(screen.getByLabelText('Valor'), '300,00');
  await userEvent.click(screen.getByRole('button', { name: 'Casa' }));
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao cenário' }));
  const [c] = await db.cenarios.toArray();
  const lancs = await db.lancamentos.where('cenarioId').equals(c.id).toArray();
  expect(lancs).toHaveLength(1);
  expect(lancs[0]).toMatchObject({ valor: 30000, status: 'previsto' });
});

it('Tornar real e Excluir cenário pedem confirmação', async () => {
  const { box, casa } = await preparar();
  const c = await cenarioCom('X', true, { boxId: box.id, categoriaId: casa.id, data: '2026-10-10', valor: 100 });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SimuladorFluxo />);
  await userEvent.click(screen.getByRole('button', { name: /^X/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Excluir cenário' }));
  expect(confirmar).toHaveBeenCalled();
  expect(await db.cenarios.get(c.id)).toBeDefined();
  confirmar.mockRestore();
});
```

Em `src/ui/TelaFluxo.test.tsx`, acrescente um teste: com `seedBoxComCategoria()` e
`iniciar()`, render `<TelaFluxo />`, clique na aba `getByRole('tab', { name: 'Simular' })` e
confira `screen.getByLabelText('Novo cenário')`.

- [ ] **Passo 2: rode e veja falhar** — `npx vitest run src/ui/SimuladorFluxo.test.tsx src/ui/TelaFluxo.test.tsx`.

- [ ] **Passo 3: implemente**

Crie `src/ui/CenarioCard.tsx`:

```tsx
import { useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR, mesAbreviado } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { itensDoCenario, primeiroMesNegativo, type ItemCenario, type LinhaMes } from '../domain/simulacao';
import type { Cenario, ID } from '../domain/types';
import { useApp } from '../state/store';
import FormItemCenario, { gravarItemNovo, type ValoresItem } from './FormItemCenario';
import ItemCenarioSheet from './ItemCenarioSheet';
import TabelaSimulacao from './TabelaSimulacao';

interface Props {
  cenario: Cenario;
  /** Resumo mensal do cenário sozinho (só ele ligado). */
  linhas: LinhaMes[];
  larguraCh: number;
  aberto: boolean;
  onAlternar: () => void;
  /** Box que recebe item novo (`boxIdEfetivo`); `null` = sem box "casa". */
  boxIdNovo: ID | null;
}

export default function CenarioCard({ cenario, linhas, larguraCh, aberto, onAlternar, boxIdNovo }: Props) {
  const { dados, hoje, recarregar } = useApp();
  const [editando, setEditando] = useState<ItemCenario | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (!dados) return null;
  const itens = itensDoCenario(dados, cenario.id);
  const efeitoFinal = linhas.at(-1)?.dif ?? 0;
  const ultimoMes = linhas.at(-1)?.mes;
  const negativoEm = primeiroMesNegativo(linhas);
  const cat = (id: string) => dados.categorias.find((c) => c.id === id);

  async function alternarLigado() {
    await repo.salvarCenario({ ...cenario, ligado: !cenario.ligado });
    await recarregar();
  }
  async function tornarReal() {
    if (!window.confirm(`Converter "${cenario.nome}" em lançamentos reais?`)) return;
    await repo.converterCenarioEmReal(cenario.id);
    await recarregar();
  }
  async function excluir() {
    if (!window.confirm(`Excluir o cenário "${cenario.nome}" e seus itens?`)) return;
    await repo.excluirCenario(cenario.id);
    await recarregar();
  }
  async function adicionar(v: ValoresItem) {
    await gravarItemNovo(cenario.id, boxIdNovo!, v, dados!.config.horizonteProjecao);
    await recarregar();
    setFormKey((k) => k + 1); // formulário volta limpo
  }

  function linhaDoItem(item: ItemCenario) {
    if (item.repeticao === 'unica') {
      const l = item.lancamento;
      const c = cat(l.categoriaId);
      return {
        titulo: l.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `uma vez · ${formatarDataBR(l.data)}`,
        valor: formatarBRL(l.valor), classe: classeEfeito(efeitoNoSaldo(l.valor, c?.tipo ?? 'gasto')), estorno: l.valor < 0,
      };
    }
    const r = item.recorrencia;
    const c = cat(r.categoriaId);
    const classe = classeEfeito(efeitoNoSaldo(r.valor, c?.tipo ?? 'gasto'));
    return item.repeticao === 'parcelado'
      ? {
        titulo: r.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `${r.parcelas}x de ${formatarBRL(r.valor)} · a partir de ${formatarDataBR(r.dataInicio)}`,
        valor: formatarBRL(r.valor * (r.parcelas ?? 1)), classe, estorno: r.valor < 0,
      }
      : {
        titulo: r.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `todo mês · a partir de ${formatarDataBR(r.dataInicio)}`,
        valor: `${formatarBRL(r.valor)}/mês`, classe, estorno: r.valor < 0,
      };
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="linha-topo">
        <input
          type="checkbox" checked={cenario.ligado} onChange={alternarLigado}
          aria-label={`Ligar ${cenario.nome}`} style={{ width: 22, height: 22 }}
        />
        <button
          type="button" className="cresce linha-topo" aria-expanded={aberto} onClick={onAlternar}
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }}
        >
          <span className="cresce">
            <strong>{cenario.nome}</strong>
            <span className="sub" style={{ display: 'block' }}>
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              {ultimoMes && <> · até {mesAbreviado(ultimoMes)}: <strong className={classeEfeito(efeitoFinal)}>{formatarBRL(efeitoFinal)}</strong></>}
              {negativoEm && <> · negativo em {mesAbreviado(negativoEm)}</>}
            </span>
          </span>
          <span className="sub" aria-hidden="true">{aberto ? '▲' : '▼'}</span>
        </button>
      </div>

      {aberto && (
        <div className="tela" style={{ marginTop: 14 }}>
          <p className="rotulo-grupo">Itens</p>
          <div className="lista">
            {itens.map((item) => {
              const d = linhaDoItem(item);
              return (
                <button
                  key={item.id} type="button" className="item" style={{ background: 'var(--surface2)', cursor: 'pointer' }}
                  onClick={() => setEditando(item)}
                >
                  <div className="cresce">
                    <div>
                      {d.titulo}
                      {d.estorno && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
                    <div className="sub">{d.categoria} · {d.detalhe}</div>
                  </div>
                  <span className={d.classe}>{d.valor}</span>
                </button>
              );
            })}
            {itens.length === 0 && <p className="sub">Nenhum item ainda.</p>}
          </div>

          <section aria-label="Impacto só deste cenário">
            <p className="rotulo-grupo">Impacto só deste cenário</p>
            <div style={{ margin: '0 -16px' }}>
              <TabelaSimulacao linhas={linhas} larguraCh={larguraCh} />
            </div>
          </section>

          <p className="rotulo-grupo">Novo item</p>
          {boxIdNovo == null ? (
            <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
          ) : (
            <FormItemCenario
              key={formKey} boxId={boxIdNovo} rotuloBotao="Adicionar ao cenário" onSalvar={adicionar}
              inicial={{ valor: 0, descricao: '', tipo: 'gasto', categoriaId: null, repeticao: 'unica', data: hoje, parcelas: 2 }}
            />
          )}

          <div className="acoes">
            <button className="botao" onClick={tornarReal}>Tornar real</button>
            <button className="botao botao-perigo" onClick={excluir}>Excluir cenário</button>
          </div>
        </div>
      )}

      {editando && <ItemCenarioSheet item={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
```

Crie `src/ui/SimuladorFluxo.tsx`:

```tsx
import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { mesAbreviado } from '../domain/dates';
import { projetarBoxes } from '../domain/projection';
import { extremosPossiveis, larguraColunaValor, primeiroMesNegativo, resumoMensal } from '../domain/simulacao';
import { agoraISO, novoId, type ID } from '../domain/types';
import { boxIdEfetivo, boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import CenarioCard from './CenarioCard';
import TabelaSimulacao from './TabelaSimulacao';

/** Fluxo › Simular: cenários de gastos e ganhos futuros e o efeito deles no saldo, mês a mês. */
export default function SimuladorFluxo() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [nomeNovo, setNomeNovo] = useState('');
  const [aberto, setAberto] = useState<ID | null>(null);
  const uid = useId();
  if (!dados) return null;

  const ids = boxIdsSelecionadas(dados, boxSel);
  const resumo = (ligados: ReadonlySet<ID>) => resumoMensal(projetarBoxes(ids, {
    boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
    cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
  }), hoje);
  const ligados = cenariosLigados(dados);
  const combinado = resumo(ligados);
  const porCenario = new Map(dados.cenarios.map((c) => [c.id, resumo(new Set([c.id]))]));
  const sem = combinado.map((l) => l.sem);
  const ext = extremosPossiveis(sem, [...porCenario.values()].map((ls) => ls.map((l) => l.dif)));
  const larguraCh = larguraColunaValor(sem, ext);
  const negativoEm = primeiroMesNegativo(combinado);
  const ultimoMes = combinado.at(-1)?.mes;

  async function criar() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const agora = agoraISO();
    const id = novoId();
    await repo.salvarCenario({ id, nome, ligado: true, criadoEm: agora, alteradoEm: agora });
    await recarregar();
    setNomeNovo('');
    setAberto(id);
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-novo`}>Novo cenário</label>
          <input id={`${uid}-novo`} placeholder="ex.: bike em 10x" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
        </div>
        <button className="botao botao-primario" disabled={!nomeNovo.trim()} onClick={criar}>Criar</button>
      </div>

      <section aria-label="Cenários ligados">
        <p className="rotulo-grupo">Cenários ligados · {ligados.size}</p>
        <div className="card" style={{ padding: '16px 0 4px' }}>
          <div style={{ padding: '0 16px' }}>
            {ligados.size === 0 ? (
              <p className="sub" style={{ margin: '0 0 12px' }}>Nenhum cenário ligado: a tabela mostra só o saldo real.</p>
            ) : negativoEm ? (
              <p className="aviso aviso-urgente" style={{ margin: '0 0 12px' }}>
                Com os cenários ligados, o saldo fica negativo em {mesAbreviado(negativoEm)}.
              </p>
            ) : (
              <p className="sub" style={{ margin: '0 0 12px' }}>
                Com os cenários ligados, o saldo segue positivo{ultimoMes ? ` até ${mesAbreviado(ultimoMes)}` : ''}.
              </p>
            )}
          </div>
          <TabelaSimulacao linhas={combinado} larguraCh={larguraCh} />
        </div>
      </section>

      <p className="rotulo-grupo">Cenários</p>
      <div className="lista">
        {dados.cenarios.map((c) => (
          <CenarioCard
            key={c.id} cenario={c} linhas={porCenario.get(c.id) ?? []} larguraCh={larguraCh}
            aberto={aberto === c.id} onAlternar={() => setAberto(aberto === c.id ? null : c.id)}
            boxIdNovo={boxIdEfetivo(dados, boxSel)}
          />
        ))}
        {dados.cenarios.length === 0 && <p className="sub">Nenhum cenário ainda.</p>}
      </div>
    </>
  );
}
```

`src/state/store.ts`: `export type AbaFluxo = 'lista' | 'grafico' | 'simular';` e tire
`'simulador'` de `Aba`.

`src/ui/Shell.tsx`: apague o `import TelaSimulador`, a linha
`{aba === 'simulador' && <TelaSimulador />}`, a entrada `simulador: 'Simulador'` de
`NOMES_ABA` e o comentário "aba 'simulador' ocultada…" em `ABAS`.

`src/ui/TelaFluxo.tsx`: depois da pílula "Gráfico", acrescente

```tsx
        <button role="tab" aria-selected={abaFluxo === 'simular'} className={abaFluxo === 'simular' ? 'ativo' : ''} onClick={() => setAbaFluxo('simular')}>Simular</button>
```

e, depois do bloco `abaFluxo === 'lista'`, `{abaFluxo === 'simular' && <SimuladorFluxo />}`
(com o import).

Apague `src/ui/TelaSimulador.tsx` e `src/ui/TelaSimulador.test.tsx` (`git rm`).

`docs/estilo/catalogo.md`: entradas para `CenarioCard.tsx` (card de um cenário: checkbox
liga e desliga; o resto do cabeçalho, com a seta, abre e fecha; aberto mostra itens, impacto
só dele, novo item, Tornar real e Excluir) e `SimuladorFluxo.tsx` (Fluxo › Simular: novo
cenário no topo, resumo dos ligados, lista de cenários, um aberto por vez).

- [ ] **Passo 4: rode; `npx tsc -b`; verificador de catálogo; suíte inteira; commit**

Run: `npx vitest run src/ui/SimuladorFluxo.test.tsx src/ui/TelaFluxo.test.tsx`, `npx tsc -b`,
`node scripts/verificar-catalogo.mjs`, `npm test`.

```bash
git add -A src/ docs/estilo/catalogo.md
git commit -m "feat(ui): Simular volta como terceira opção do Fluxo"
```

---

### Tarefa 6: wiki, docs, dossiê e fragmento

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md` (seção "Simulador (oculta da navegação)" → seção nova
  dentro do Fluxo), `docs/wiki/2-visao-geral.md` (a nota da aba oculta, com o link
  `#telas/simulador-oculta-da-navegacao`), `docs/wiki/8-glossario.md` (entrada "cenário")
- Modificar: `src/ui/CLAUDE.md` (tira `TelaSimulador` da lista e a frase "nenhum `setAba` a
  alcança"; cita `SimuladorFluxo` dentro do Fluxo)
- Regenerar: `docs/dossie/`
- Criar: `changelog.d/adicionado-simulador-no-fluxo.md`

- [ ] **Passo 1: wiki** — leia `docs/wiki/README.md` (subconjunto fechado de markdown). Em
`6-telas.md`, na seção do Fluxo, descreva a terceira opção **Simular**, no estilo do arquivo:
  - "Novo cenário" no topo; o cenário nasce ligado e aberto.
  - "Cenários ligados": tabela mês a mês — Mês · Com · Diferença · Sem —, valores em reais sem
    o "R$"; aviso em vermelho quando o saldo com os cenários fica negativo.
  - Cada cenário: o quadradinho liga e desliga; tocar no nome ou na seta abre. Aberto: itens,
    "Impacto só deste cenário", "Novo item", "Tornar real" e "Excluir cenário".
  - Item: gasto ou ganho; uma vez, parcelado (o valor é o total) ou todo mês (até o fim da
    projeção). Para trocar algo que já existe, como aluguel ou salário, lance só a diferença.
  - Tocar num item abre para editar ou excluir; a repetição não muda.
  - Lançamento de cenário nunca é confirmado: para trazê-lo aos dados reais, use "Tornar real".
Apague a seção "Simulador (oculta da navegação)". Em `2-visao-geral.md`, troque a nota da aba
oculta por uma frase curta que leve a `[Simular](#telas/<id da seção nova>)`. No glossário,
"cenário" passa a apontar para Fluxo › Simular (sem "temporariamente oculta"). Valide:
`npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 2: `src/ui/CLAUDE.md`** — ajuste como descrito acima.

- [ ] **Passo 3: dossiê** — `npm run dossie`; leia `git diff --stat docs/dossie/` e o diff:
deve refletir só a mudança de navegação/tela. Qualquer outra diferença, investigue.

- [ ] **Passo 4: fragmento** — leia `changelog.d/README.md` e crie
`changelog.d/adicionado-simulador-no-fluxo.md`:

```md
- Simular volta como terceira opção do Fluxo: crie cenários de gastos e ganhos futuros e veja o saldo mês a mês.
  - Cada cenário tem itens de uma vez, parcelados ou todo mês.
  - A tabela mostra o saldo com e sem os cenários, e a diferença.
  - Um aviso diz o mês em que o saldo fica negativo.
```

- [ ] **Passo 5: verificações, suíte e commit**

Run: `node scripts/verificar-catalogo.mjs && node scripts/verificar-dados-reais.mjs && npm test`.

```bash
git add docs/ src/ui/CLAUDE.md changelog.d/adicionado-simulador-no-fluxo.md
git commit -m "docs: Simular no Fluxo na wiki, no dossiê e no changelog"
```

---

## Depois do plano (fora dos subagentes)

Varredura com Playwright no Galaxy S25+ (411 × 744), a partir do worktree, com dados
sintéticos gravados por `src/db/repo.ts`: criar cenário, adicionar os três tipos de item,
ligar e desligar (colunas paradas), saldo negativo no resumo, editar e excluir item, Tornar
real. Comparar com o mockup aprovado. Capturas enviadas ao usuário. Depois, o ciclo de entrega.
