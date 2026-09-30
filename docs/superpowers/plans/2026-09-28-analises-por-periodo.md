# Análises por período e barra fixa sob o topo — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a aba Análises passa a analisar um período (Mês, 12 meses, Ano, Período livre de até 24 meses), e o seletor de mês/período fica fixo sob a barra do topo nas Análises, no Cartão e na Wiki.

**Arquitetura:** um módulo de domínio novo (`src/domain/periodo.ts`) define os meses de cada modo e as janelas de comparação. As agregações existentes ganham versões por lista de meses, que somam mês a mês com as mesmas contas do modo Mês. Uma classe CSS genérica `.barra-fixa` gruda sob o `.topo`, cuja altura o `Shell` mede uma vez e publica em `--topo-altura`.

**Tecnologias:** React 18, TypeScript, Vitest + Testing Library, Recharts (já instalado).

**Spec:** `docs/superpowers/specs/2026-09-28-analises-por-periodo-design.md`.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\analises-periodo`. Não toque no checkout principal (`C:\Users\eitor\Claude\ProjetoFinancas`). Antes da primeira edição, `git rev-parse --show-toplevel` tem de devolver o worktree.
- Todo texto de UI, comentário e commit em português. Nada de inglês solto.
- Nenhuma dependência nova. Não mexa em `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.claude/`, `public/`.
- `style={{ }}` inline só com layout (`margin*`, `width`, `opacity`, `flex*`, `gap`, `justifyContent`). Nunca cor, fonte, raio, borda.
- Dinheiro: centavos inteiros, `formatarBRL` + `classeEfeito(efeitoNoSaldo(v, tipo))`.
- Dados de teste só sintéticos.
- Arquivos em UTF-8 sem BOM.
- Antes de dizer que terminou uma tarefa: `npm test` inteiro verde. Se só o teste do dossiê falhar por dossiê desatualizado, rode `npm run dossie` e inclua `docs/dossie/` no commit.
- Todo commit termina com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs
  ```
- Siga o mockup aprovado (spec, seção "Mockup aprovado"). Desvio precisa de aprovação do usuário.

---

### Tarefa 1: Domínio do período (`periodo.ts`)

**Arquivos:**
- Criar: `src/domain/periodo.ts`
- Criar: `src/domain/periodo.test.ts`

**Interfaces — produz:**
- `type ModoPeriodo = 'mes' | '12m' | 'ano' | 'periodo'`
- `interface EstadoPeriodo { modo: ModoPeriodo; mes: string; fim12: string; ano: number; de: string; ate: string }`
- `const MAX_MESES_PERIODO = 24`
- `estadoInicial(mesHoje: string): EstadoPeriodo`
- `mesesDoPeriodo(e: EstadoPeriodo): string[]`
- `mesesEntre(de: string, ate: string): string[]`
- `periodoAnterior(meses: readonly string[]): string[]`
- `periodoAnoAnterior(meses: readonly string[]): string[]`
- `anoAnteriorRepete(meses: readonly string[]): boolean`
- `ajustarDe(de: string, ate: string, novoDe: string): { de: string; ate: string }`
- `ajustarAte(de: string, ate: string, novoAte: string): { de: string; ate: string }`
- `rotuloIntervalo(meses: readonly string[]): string`
- `rotuloColunaPeriodo(modo: ModoPeriodo, meses: readonly string[]): string`
- `notaComparacao(meses: readonly string[]): string`

- [ ] **Passo 1: escrever os testes (falham)**

`src/domain/periodo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ajustarAte, ajustarDe, anoAnteriorRepete, estadoInicial, mesesDoPeriodo, mesesEntre, notaComparacao,
  periodoAnoAnterior, periodoAnterior, rotuloColunaPeriodo, rotuloIntervalo,
} from './periodo';

describe('mesesEntre', () => {
  it('inclui as duas pontas e atravessa a virada de ano', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('um mês só', () => {
    expect(mesesEntre('2026-09', '2026-09')).toEqual(['2026-09']);
  });
  it('de depois de até dá lista vazia', () => {
    expect(mesesEntre('2026-10', '2026-09')).toEqual([]);
  });
});

describe('estadoInicial e mesesDoPeriodo', () => {
  const e = estadoInicial('2026-09');
  it('começa no modo Mês, com o mês de hoje', () => {
    expect(e.modo).toBe('mes');
    expect(mesesDoPeriodo(e)).toEqual(['2026-09']);
  });
  it('12 meses termina no mês de hoje', () => {
    const m = mesesDoPeriodo({ ...e, modo: '12m' });
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-10');
    expect(m[11]).toBe('2026-09');
  });
  it('Ano começa no último ano fechado', () => {
    const m = mesesDoPeriodo({ ...e, modo: 'ano' });
    expect(m[0]).toBe('2025-01');
    expect(m[11]).toBe('2025-12');
  });
  it('Período começa em 6 meses atrás até hoje (7 meses)', () => {
    expect(mesesDoPeriodo({ ...e, modo: 'periodo' })).toEqual(mesesEntre('2026-03', '2026-09'));
  });
});

describe('janelas de comparação', () => {
  const doze = mesesEntre('2025-10', '2026-09');
  it('anterior = os N meses antes', () => {
    const a = periodoAnterior(doze);
    expect(a[0]).toBe('2024-10');
    expect(a[11]).toBe('2025-09');
  });
  it('ano anterior = os mesmos meses, 12 antes', () => {
    expect(periodoAnoAnterior(mesesEntre('2026-03', '2026-09'))).toEqual(mesesEntre('2025-03', '2025-09'));
  });
  it('com 12 meses, anterior e ano anterior se repetem', () => {
    expect(anoAnteriorRepete(doze)).toBe(true);
    expect(anoAnteriorRepete(mesesEntre('2026-03', '2026-09'))).toBe(false);
    expect(anoAnteriorRepete(mesesEntre('2024-10', '2026-09'))).toBe(false);
  });
});

describe('ajustarDe e ajustarAte', () => {
  it('de além de até arrasta até', () => {
    expect(ajustarDe('2026-03', '2026-09', '2026-10')).toEqual({ de: '2026-10', ate: '2026-10' });
  });
  it('até antes de de arrasta de', () => {
    expect(ajustarAte('2026-03', '2026-09', '2026-02')).toEqual({ de: '2026-02', ate: '2026-02' });
  });
  it('de recuando além de 24 meses puxa até', () => {
    // 2024-09 → 2026-09 = 25 meses; até cai para 2024-09 + 23 = 2026-08
    expect(ajustarDe('2024-10', '2026-09', '2024-09')).toEqual({ de: '2024-09', ate: '2026-08' });
  });
  it('até avançando além de 24 meses puxa de', () => {
    // 2024-10 → 2026-10 = 25 meses; de sobe para 2026-10 − 23 = 2024-11
    expect(ajustarAte('2024-10', '2026-09', '2026-10')).toEqual({ de: '2024-11', ate: '2026-10' });
  });
  it('dentro do limite, só a ponta mexida muda', () => {
    expect(ajustarDe('2026-03', '2026-09', '2026-02')).toEqual({ de: '2026-02', ate: '2026-09' });
  });
});

describe('rótulos', () => {
  it('rotuloIntervalo', () => {
    expect(rotuloIntervalo(mesesEntre('2025-10', '2026-09'))).toBe('out/2025 – set/2026');
    expect(rotuloIntervalo(['2026-09'])).toBe('set/2026');
  });
  it('rotuloColunaPeriodo', () => {
    expect(rotuloColunaPeriodo('ano', mesesEntre('2025-01', '2025-12'))).toBe('2025');
    expect(rotuloColunaPeriodo('12m', mesesEntre('2025-10', '2026-09'))).toBe('12 meses');
    expect(rotuloColunaPeriodo('periodo', mesesEntre('2026-03', '2026-09'))).toBe('7 meses');
  });
  it('notaComparacao', () => {
    expect(notaComparacao(mesesEntre('2025-10', '2026-09')))
      .toBe('anterior = out/2024 – set/2025 (é também o ano anterior)');
    expect(notaComparacao(mesesEntre('2026-03', '2026-09')))
      .toBe('anterior = ago/2025 – fev/2026 · ano anterior = mar/2025 – set/2025');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/domain/periodo.test.ts`
Esperado: FAIL — módulo `./periodo` não existe.

- [ ] **Passo 3: implementar**

`src/domain/periodo.ts`:

```ts
import { addMeses, mesAbreviado } from './dates';

/** Modo do seletor de período da aba Análises. */
export type ModoPeriodo = 'mes' | '12m' | 'ano' | 'periodo';

/** Estado de todos os modos ao mesmo tempo: trocar de modo não perde o que os outros tinham. */
export interface EstadoPeriodo {
  modo: ModoPeriodo;
  /** modo Mês: o mês escolhido */
  mes: string;
  /** modo 12 meses: o último mês da janela */
  fim12: string;
  /** modo Ano */
  ano: number;
  /** modo Período: primeiro e último mês, inclusive */
  de: string;
  ate: string;
}

/** Teto do modo Período: acima disso o gráfico de evolução não cabe no celular. */
export const MAX_MESES_PERIODO = 24;

export function estadoInicial(mesHoje: string): EstadoPeriodo {
  return {
    modo: 'mes',
    mes: mesHoje,
    fim12: mesHoje,
    ano: Number(mesHoje.slice(0, 4)) - 1, // último ano fechado
    de: addMeses(mesHoje, -6),
    ate: mesHoje,
  };
}

/** Lista inclusiva de meses `AAAA-MM`; vazia se `de` vem depois de `ate`. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let m = de; m <= ate; m = addMeses(m, 1)) out.push(m);
  return out;
}

export function mesesDoPeriodo(e: EstadoPeriodo): string[] {
  switch (e.modo) {
    case 'mes': return [e.mes];
    case '12m': return mesesEntre(addMeses(e.fim12, -11), e.fim12);
    case 'ano': return mesesEntre(`${e.ano}-01`, `${e.ano}-12`);
    case 'periodo': return mesesEntre(e.de, e.ate);
  }
}

/** Os N meses imediatamente antes do período. */
export function periodoAnterior(meses: readonly string[]): string[] {
  return meses.map((m) => addMeses(m, -meses.length));
}

/** Os mesmos meses do período, 12 meses antes. */
export function periodoAnoAnterior(meses: readonly string[]): string[] {
  return meses.map((m) => addMeses(m, -12));
}

/** Com 12 meses, "anterior" e "ano anterior" são o mesmo intervalo: a coluna repetida some. */
export function anoAnteriorRepete(meses: readonly string[]): boolean {
  return meses.length === 12;
}

/** Move o início do período. Passar do fim arrasta o fim; passar do teto puxa o fim. */
export function ajustarDe(de: string, ate: string, novoDe: string): { de: string; ate: string } {
  let novoAte = novoDe > ate ? novoDe : ate;
  if (mesesEntre(novoDe, novoAte).length > MAX_MESES_PERIODO) novoAte = addMeses(novoDe, MAX_MESES_PERIODO - 1);
  return { de: novoDe, ate: novoAte };
}

/** Move o fim do período. Voltar antes do início arrasta o início; passar do teto puxa o início. */
export function ajustarAte(de: string, ate: string, novoAte: string): { de: string; ate: string } {
  let novoDe = novoAte < de ? novoAte : de;
  if (mesesEntre(novoDe, novoAte).length > MAX_MESES_PERIODO) novoDe = addMeses(novoAte, -(MAX_MESES_PERIODO - 1));
  return { de: novoDe, ate: novoAte };
}

/** "out/2025 – set/2026"; com um mês só, "set/2026". */
export function rotuloIntervalo(meses: readonly string[]): string {
  if (meses.length === 0) return '';
  const primeiro = mesAbreviado(meses[0]);
  return meses.length === 1 ? primeiro : `${primeiro} – ${mesAbreviado(meses[meses.length - 1])}`;
}

/** Cabeçalho da 1ª coluna de valor das tabelas de comparação com vários meses. */
export function rotuloColunaPeriodo(modo: ModoPeriodo, meses: readonly string[]): string {
  if (modo === 'ano') return meses[0]?.slice(0, 4) ?? '';
  if (modo === '12m') return '12 meses';
  return `${meses.length} meses`;
}

/** Linha fina sob o título das tabelas de comparação: diz que intervalo cada coluna usa. */
export function notaComparacao(meses: readonly string[]): string {
  const anterior = `anterior = ${rotuloIntervalo(periodoAnterior(meses))}`;
  return anoAnteriorRepete(meses)
    ? `${anterior} (é também o ano anterior)`
    : `${anterior} · ano anterior = ${rotuloIntervalo(periodoAnoAnterior(meses))}`;
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/domain/periodo.test.ts` → PASS.

- [ ] **Passo 5: suíte completa e commit**

Run: `npm test` → verde.

```bash
git add src/domain/periodo.ts src/domain/periodo.test.ts
git commit -m "feat(dominio): período de análise (modos, janelas de comparação, rótulos)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 2: Agregações por lista de meses

**Arquivos:**
- Modificar: `src/domain/aggregations.ts`
- Modificar: `src/domain/aggregations.test.ts`
- Modificar: `src/domain/fatura.ts` (fim do arquivo)
- Modificar: `src/domain/fatura.test.ts` (bloco `describe('resumoAssinaturasDoMes'`)

**Interfaces:**
- Consome: `periodoAnterior`, `periodoAnoAnterior`, `anoAnteriorRepete` (Tarefa 1).
- Produz:
  - `resumoPeriodo(meses: readonly string[], boxIds: readonly ID[], categorias: Categoria[], lancamentos: Lancamento[], incluirPrevistos: boolean): ResumoMensal` — o campo `mes` do retorno é o último mês da lista.
  - `interface ComparativoPeriodo { categoriaId: ID; nome: string; tipo: TipoCategoria; atual: number; anterior: number; anoAnterior: number | null; mediaMensal: number }`
  - `compararPeriodos(meses: readonly string[], boxIds, categorias, lancamentos, incluirPrevistos): ComparativoPeriodo[]` — `anoAnterior` é `null` quando `anoAnteriorRepete(meses)`.
  - `resumoAssinaturasDoPeriodo(meses: readonly string[], boxIds, cartoes, comprasCartao, recorrenciasCartao, ajustesFechamento = []): ResumoAssinaturas`

- [ ] **Passo 1: testes (falham)**

Em `src/domain/aggregations.test.ts`, trocar a linha de import por:

```ts
import { compararMeses, compararPeriodos, lancamentosDaCategoria, mediaMovel3, resumoMensal, resumoPeriodo, serieMensal, serieMensalResumo, frequentes } from './aggregations';
```

e acrescentar no fim do arquivo:

```ts
it('resumoPeriodo com um mês é igual ao resumoMensal', () => {
  expect(resumoPeriodo(['2026-07'], ['be'], cats, lancs, true)).toEqual(resumoMensal('2026-07', ['be'], cats, lancs, true));
});

it('resumoPeriodo soma os meses do período', () => {
  // jun: car 90000 · jul: sal 550000, car 110000, psi 80000 (só efetivos)
  const r = resumoPeriodo(['2026-06', '2026-07'], ['be'], cats, lancs, false);
  expect(r.totalGanhos).toBe(550000);
  expect(r.totalGastos).toBe(280000);
  expect(r.sobra).toBe(270000);
  expect(r.linhas.find((l) => l.categoriaId === 'car')?.total).toBe(200000);
  expect(r.mes).toBe('2026-07');
});

it('resumoPeriodo deixa de fora transferência e cenário', () => {
  const comExtras = [
    ...lancs,
    lanc({ id: 't', data: '2026-06-15', valor: 40000, categoriaId: 'car', origem: 'transferencia' }),
  ];
  const r = resumoPeriodo(['2026-06', '2026-07'], ['be'], cats, comExtras, true);
  // car: 90000 + 110000 + 50000 (previsto); o cenário (999999) e a transferência ficam fora
  expect(r.linhas.find((l) => l.categoriaId === 'car')?.total).toBe(250000);
});

it('compararPeriodos: período, anterior, ano anterior e média por mês', () => {
  const r = compararPeriodos(['2026-06', '2026-07'], ['be'], cats, lancs, false);
  const car = r.find((c) => c.categoriaId === 'car')!;
  expect(car.atual).toBe(200000);       // 90000 + 110000
  expect(car.anterior).toBe(0);         // abr–mai/2026
  expect(car.anoAnterior).toBe(70000);  // jun–jul/2025
  expect(car.mediaMensal).toBe(100000);
  expect(r.find((c) => c.categoriaId === 'psi')?.mediaMensal).toBe(40000);
});

it('compararPeriodos com 12 meses: ano anterior é null (igual ao anterior)', () => {
  const doze = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
    '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
  const r = compararPeriodos(doze, ['be'], cats, lancs, false);
  const car = r.find((c) => c.categoriaId === 'car')!;
  expect(car.anoAnterior).toBeNull();
  expect(car.anterior).toBe(70000); // 2025-07 cai em ago/2024–jul/2025
  expect(car.mediaMensal).toBe(Math.round(200000 / 12)); // 16667
});

it('compararPeriodos só traz categoria com algum valor', () => {
  const r = compararPeriodos(['2024-01'], ['be'], cats, lancs, false);
  expect(r).toEqual([]);
});
```

Em `src/domain/fatura.test.ts`, acrescentar `resumoAssinaturasDoPeriodo` ao import de `./fatura` e, dentro de `describe('resumoAssinaturasDoMes', ...)`, logo depois do último `it`, acrescentar:

```ts
  it('resumoAssinaturasDoPeriodo junta a mesma assinatura de meses diferentes num item só', () => {
    // fecha 10, vence 20: compra de 05/07 → fatura 07; de 05/08 → fatura 08
    const jul = { ...compra('2026-07-05', 3990), recorrenciaCartaoId: 'ass1' };
    const ago = { ...compra('2026-08-05', 3990), recorrenciaCartaoId: 'ass1' };
    const r = resumoAssinaturasDoPeriodo(['2026-07', '2026-08'], ['b1'], [cartaoNubank], [jul, ago], [assNetflix]);
    expect(r.totalCent).toBe(7980);
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({ descricao: 'Netflix', valorCent: 7980 });
  });

  it('resumoAssinaturasDoPeriodo ignora cartão de box fora da seleção', () => {
    const jul = { ...compra('2026-07-05', 3990), recorrenciaCartaoId: 'ass1' };
    const r = resumoAssinaturasDoPeriodo(['2026-07'], ['outra'], [cartaoNubank], [jul], [assNetflix]);
    expect(r).toEqual({ totalCent: 0, itens: [] });
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/domain/aggregations.test.ts src/domain/fatura.test.ts` → FAIL (funções não exportadas).

- [ ] **Passo 3: implementar**

Em `src/domain/aggregations.ts`:

1. Acrescentar ao topo: `import { anoAnteriorRepete, periodoAnoAnterior, periodoAnterior } from './periodo';`
2. Trocar `filtrar` por uma versão que recebe uma lista de meses:

```ts
function filtrar(
  meses: readonly string[],
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): Lancamento[] {
  const sel = new Set(boxIds);
  const noPeriodo = new Set(meses);
  return lancamentos.filter(
    (l) =>
      sel.has(l.boxId) &&
      !l.cenarioId &&
      l.origem !== 'transferencia' &&
      noPeriodo.has(mesDe(l.data)) &&
      (l.status === 'efetivo' || incluirPrevistos),
  );
}
```

3. Em **toda** chamada existente de `filtrar(` neste arquivo, embrulhar o primeiro argumento num array: `filtrar(mes, …)` → `filtrar([mes], …)`, `filtrar(addMeses(mes, -1), …)` → `filtrar([addMeses(mes, -1)], …)`, e assim por diante. Confira com `grep -n "filtrar(" src/domain/aggregations.ts`: toda chamada, fora a definição, tem `[` logo depois do parêntese.

4. Trocar o corpo de `resumoMensal` por uma delegação e criar `resumoPeriodo` com o corpo antigo:

```ts
export function resumoMensal(
  mes: string,
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ResumoMensal {
  return resumoPeriodo([mes], boxIds, categorias, lancamentos, incluirPrevistos);
}

/** Resumo de vários meses somados. Mesma conta do `resumoMensal`; `mes` = último mês da lista. */
export function resumoPeriodo(
  meses: readonly string[],
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ResumoMensal {
  const totais = totaisPorCategoria(filtrar(meses, boxIds, lancamentos, incluirPrevistos));
  const catsOrdenadas = [...categorias].sort(compararCategorias);
  let totalGanhos = 0;
  let totalGastos = 0;
  for (const c of catsOrdenadas) {
    const t = totais.get(c.id) ?? 0;
    if (c.tipo === 'ganho') totalGanhos += t;
    else totalGastos += t;
  }
  const linhas: LinhaResumo[] = catsOrdenadas
    .filter((c) => totais.has(c.id))
    .map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      tipo: c.tipo,
      total: totais.get(c.id)!,
      pctDaRenda:
        c.tipo === 'gasto' && totalGanhos > 0 ? totais.get(c.id)! / totalGanhos : null,
    }));
  return { mes: meses[meses.length - 1] ?? '', linhas, totalGanhos, totalGastos, sobra: totalGanhos - totalGastos };
}
```

5. Logo depois de `compararMeses`, acrescentar:

```ts
export interface ComparativoPeriodo {
  categoriaId: ID;
  nome: string;
  tipo: TipoCategoria;
  atual: number;
  anterior: number;
  /** `null` com 12 meses: o ano anterior é o próprio período anterior */
  anoAnterior: number | null;
  mediaMensal: number;
}

/** Comparativo de um período de vários meses: período × os N meses antes × os mesmos meses do
 *  ano anterior × média por mês. A linha aparece se o período, o anterior ou o ano anterior têm valor. */
export function compararPeriodos(
  meses: readonly string[],
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ComparativoPeriodo[] {
  const repete = anoAnteriorRepete(meses);
  const atual = totaisPorCategoria(filtrar(meses, boxIds, lancamentos, incluirPrevistos));
  const anterior = totaisPorCategoria(filtrar(periodoAnterior(meses), boxIds, lancamentos, incluirPrevistos));
  const anoAnterior = repete
    ? null
    : totaisPorCategoria(filtrar(periodoAnoAnterior(meses), boxIds, lancamentos, incluirPrevistos));
  return categorias
    .filter((c) => atual.has(c.id) || anterior.has(c.id) || (anoAnterior?.has(c.id) ?? false))
    .map((c) => {
      const total = atual.get(c.id) ?? 0;
      return {
        categoriaId: c.id,
        nome: c.nome,
        tipo: c.tipo,
        atual: total,
        anterior: anterior.get(c.id) ?? 0,
        anoAnterior: anoAnterior ? anoAnterior.get(c.id) ?? 0 : null,
        mediaMensal: Math.round(total / meses.length),
      };
    });
}
```

Em `src/domain/fatura.ts`, no fim do arquivo:

```ts
/** Assinaturas de vários meses de fatura: soma `resumoAssinaturasDoMes` mês a mês e junta a mesma
 *  assinatura (mesmo cartão e mesma `recorrenciaCartaoId`) num item só. */
export function resumoAssinaturasDoPeriodo(
  meses: readonly string[],
  boxIds: readonly ID[],
  cartoes: Cartao[],
  comprasCartao: CompraCartao[],
  recorrenciasCartao: RecorrenciaCartao[],
  ajustesFechamento: AjusteFechamento[] = [],
): ResumoAssinaturas {
  const porAssinatura = new Map<string, ItemResumoAssinaturas>();
  for (const mes of meses) {
    const doMes = resumoAssinaturasDoMes(mes, boxIds, cartoes, comprasCartao, recorrenciasCartao, ajustesFechamento);
    for (const item of doMes.itens) {
      const chave = `${item.cartaoId}|${item.recorrenciaCartaoId}`;
      const existente = porAssinatura.get(chave);
      if (existente) existente.valorCent += item.valorCent;
      else porAssinatura.set(chave, { ...item });
    }
  }
  const itens = [...porAssinatura.values()];
  return { totalCent: itens.reduce((s, i) => s + i.valorCent, 0), itens };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/domain/aggregations.test.ts src/domain/fatura.test.ts` → PASS (os testes antigos inclusive).

- [ ] **Passo 5: suíte completa e commit**

Run: `npm test` → verde.

```bash
git add src/domain/aggregations.ts src/domain/aggregations.test.ts src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(dominio): resumo, comparativo e assinaturas de um período de vários meses" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 3: Barra fixa sob o topo (Shell, Cartão, Wiki)

Antes de editar, leia `docs/estilo-visual.md` e `docs/estilo/nivel-2-nova-classe.md`.

**Arquivos:**
- Modificar: `src/styles.css` (nova regra antes de `/* --- Wiki`; bloco `.wiki-barra` e `scroll-margin-top`)
- Modificar: `src/ui/Shell.tsx`
- Modificar: `src/ui/TelaCartao.tsx` (`CartaoFatura`, `return` em ~linha 194)
- Modificar: `src/ui/ajustes/Wiki.tsx` (efeito de medição, ~linhas 119–130; botão da barra, ~linha 201)
- Modificar: `docs/estilo/catalogo.md`
- Testes: `src/ui/Shell.test.tsx`, `src/ui/TelaCartao.test.tsx`, `src/ui/ajustes/Wiki.test.tsx`

**Interfaces — produz:** classe `.barra-fixa`; variável CSS `--topo-altura` no `.shell`.

- [ ] **Passo 1: testes (falham)**

Em `src/ui/Shell.test.tsx`, acrescentar no fim:

```ts
it('publica a altura do topo em --topo-altura no .shell', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains('topo') ? 60 : 0; },
  });
  try {
    const { container } = render(<Shell />);
    const shell = container.querySelector('.shell') as HTMLElement;
    expect(shell.style.getPropertyValue('--topo-altura')).toBe('60px');
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
  }
});
```

Em `src/ui/TelaCartao.test.tsx`, acrescentar no fim (use o `montarCartao` do arquivo e o mesmo preparo de store dos outros testes do arquivo — `iniciar()` e `useApp.setState({ boxSel: box.id })`):

```ts
it('nome do cartão e seletor de mês ficam juntos na barra fixa', async () => {
  const { box } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<TelaCartao />);
  const nome = await screen.findByRole('heading', { name: 'Nubank' });
  const barra = nome.closest('.barra-fixa') as HTMLElement;
  expect(barra).not.toBeNull();
  expect(within(barra).getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
});
```

(Se `within` não estiver importado no arquivo, acrescente ao import de `@testing-library/react`.)

Em `src/ui/ajustes/Wiki.test.tsx`, dentro do `describe('Wiki'`, logo depois do teste `'a barra do índice mostra o capítulo atual'`:

```ts
  it('a barra do índice usa a barra fixa comum do app', async () => {
    render(<Wiki />);
    await screen.findByRole('article');
    expect(screen.getByRole('button', { name: /^Índice/ })).toHaveClass('barra-fixa', 'wiki-barra');
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/Shell.test.tsx src/ui/TelaCartao.test.tsx src/ui/ajustes/Wiki.test.tsx` → os três testes novos falham.

- [ ] **Passo 3: CSS**

Em `src/styles.css`, logo **antes** da linha `/* --- Wiki ------------------------------------------------------------- */`, inserir:

```css
/* Barra que gruda logo abaixo do .topo (seletor de mês/período nas Análises e no Cartão, índice
   da Wiki). --topo-altura vem do Shell.tsx, que mede o .topo. A margem negativa anula o padding
   lateral de .conteudo e o fundo cobre o que rola por baixo. z-index 9: abaixo do .topo (10). */
.barra-fixa {
  position: sticky; top: var(--topo-altura, 0px); z-index: 9;
  margin: 0 -16px; padding: 6px 16px; background: var(--bg);
}

```

Trocar o bloco da `.wiki-barra` e a regra de `scroll-margin-top` por:

```css
/* Barra do índice: a posição fixa vem de .barra-fixa (o botão usa as duas classes); aqui fica só
   a aparência. O padding de 8px sobrepõe o 6px da .barra-fixa, por vir depois. */
.wiki-barra {
  display: flex; align-items: center; gap: 10px; min-height: 44px;
  padding: 8px 16px; border: none; text-align: left;
  color: var(--fg); font-weight: 600;
}
```

e

```css
/* Destino de rolagem para abaixo do topo e da barra do índice, não por trás deles. */
.wiki-corpo h3[id], .wiki-campos > div {
  scroll-margin-top: calc(var(--topo-altura, 0px) + var(--wiki-barra-altura, 0px) + 8px);
}
```

(`.wiki-barra-texto` e `.wiki-barra-secao` não mudam.)

- [ ] **Passo 4: Shell mede o topo**

Em `src/ui/Shell.tsx`:

```tsx
import { useLayoutEffect, useRef, useState } from 'react';
```

Dentro de `Shell`, **antes** de `if (!dados) return null;`:

```tsx
  const shellRef = useRef<HTMLDivElement>(null);
  const topoRef = useRef<HTMLElement>(null);
  const carregado = dados != null;
  // Altura do .topo para toda barra fixa logo abaixo dele (.barra-fixa): medida uma vez aqui.
  useLayoutEffect(() => {
    const medir = () => {
      shellRef.current?.style.setProperty('--topo-altura', `${topoRef.current?.offsetHeight ?? 0}px`);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [carregado]);
```

E no JSX: `<div className="shell">` → `<div className="shell" ref={shellRef}>`; `<header className="topo">` → `<header className="topo" ref={topoRef}>`.

- [ ] **Passo 5: Cartão**

Em `src/ui/TelaCartao.tsx`, no `return` de `CartaoFatura`, trocar o fragmento de abertura e o início:

```tsx
  return (
    <>
      {/* O nome do cartão abre o bloco, acima do seletor de mês: na visão casa, com vários
          cartões, o seletor do segundo ficava entre os dois cards e parecia do de cima. */}
      <h2>{cartao.nome}</h2>
      <SeletorMes mes={mes} onMudar={setMes} />
```

por:

```tsx
  return (
    // Um bloco por cartão: a barra fixa só gruda dentro do próprio bloco, e na visão casa o
    // bloco do cartão seguinte empurra o anterior para fora.
    <div className="tela">
      {/* O nome do cartão abre o bloco, acima do seletor de mês: na visão casa, com vários
          cartões, o seletor do segundo ficava entre os dois cards e parecia do de cima. Os dois
          grudam juntos sob o topo: o mês nunca aparece sem o nome do cartão. */}
      <div className="barra-fixa">
        <h2 style={{ margin: '2px 0 6px' }}>{cartao.nome}</h2>
        <SeletorMes mes={mes} onMudar={setMes} />
      </div>
```

e o `</>` que fecha esse `return` (logo antes do `);` final de `CartaoFatura`, ~linha 309) por `</div>`.

- [ ] **Passo 6: Wiki**

Em `src/ui/ajustes/Wiki.tsx`, trocar o efeito de medição:

```tsx
  // A barra gruda logo abaixo do .topo do app; títulos e campos param FOLGA px abaixo da barra ao rolar até eles.
  useEffect(() => {
    const medir = () => {
      const topo = document.querySelector<HTMLElement>('.topo')?.offsetHeight ?? 0;
      const altura = barra.current?.offsetHeight ?? 0;
      raiz.current?.style.setProperty('--wiki-topo', `${topo}px`);
      raiz.current?.style.setProperty('--wiki-rolagem', `${topo + altura + FOLGA}px`);
    };
```

por:

```tsx
  // A barra gruda logo abaixo do .topo do app (.barra-fixa, que usa --topo-altura do Shell).
  // Aqui só a altura da própria barra: títulos e campos param FOLGA px abaixo dela (ver styles.css).
  useEffect(() => {
    const medir = () => {
      raiz.current?.style.setProperty('--wiki-barra-altura', `${barra.current?.offsetHeight ?? 0}px`);
    };
```

(o resto do efeito — `medir()`, `addEventListener('resize')` e a limpeza — fica igual). O `+ 8px` do CSS é a mesma `FOLGA = 8`; acrescente ao comentário da constante `FOLGA`: `// mesma folga do scroll-margin-top da wiki em styles.css`.

No botão da barra: `ref={barra} className="wiki-barra"` → `ref={barra} className="barra-fixa wiki-barra"`.

- [ ] **Passo 7: catálogo**

Em `docs/estilo/catalogo.md`, na tabela de classes:

- Substituir a linha da `.wiki-barra` por:
  `| \`.wiki-barra\` | aparência da barra do índice da wiki (\`<button className="barra-fixa wiki-barra">\`): flex, 44px mínimo, padding 8px 16px, \`--fg\` em peso 600; \`☰ Capítulo · Seção atual\`. A posição fixa vem de \`.barra-fixa\`. \`h3[id]\` e \`.wiki-campos > div\` ganham \`scroll-margin-top\` = \`--topo-altura\` + \`--wiki-barra-altura\` (medida no Wiki.tsx) + 8px |`
- Acrescentar, logo antes dela:
  `| \`.barra-fixa\` | barra que gruda logo abaixo do \`.topo\` (\`top: var(--topo-altura)\`, medido no Shell.tsx), z-index 9, largura total (margem −16px), fundo \`--bg\`, padding 6px 16px. Usada pelo seletor de período (Análises), pelo nome + seletor de mês de cada cartão (Cartão, um \`div.tela\` por cartão para o sticky valer só no bloco) e pela barra do índice da Wiki. Toda barra nova que precise ficar à vista ao rolar usa esta classe |`

Na lista de componentes, no item `SeletorMes.tsx`, acrescentar ao fim: `No Cartão, fica dentro de \`.barra-fixa\` junto com o nome do cartão; nas Análises, entra pelo \`SeletorPeriodo\` no modo Mês.` (O `SeletorPeriodo` nasce na Tarefa 4 — a frase já pode entrar agora.)

- [ ] **Passo 8: verificar**

Run: `npx vitest run src/ui/Shell.test.tsx src/ui/TelaCartao.test.tsx src/ui/ajustes/Wiki.test.tsx` → PASS (os testes antigos da Wiki, inclusive os de seção atual, continuam passando sem mudança).
Run: `node scripts/verificar-catalogo.mjs` → sem aviso sobre `.barra-fixa` nem `.wiki-barra`.
Run: `npm test` → verde.

- [ ] **Passo 9: commit**

```bash
git add src/styles.css src/ui/Shell.tsx src/ui/Shell.test.tsx src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): barra fixa sob o topo no Cartão, compartilhada com a Wiki" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 4: `SeletorPeriodo`

Antes de editar, leia `docs/estilo/nivel-4-novo-componente.md`.

**Arquivos:**
- Criar: `src/ui/SeletorPeriodo.tsx`
- Criar: `src/ui/SeletorPeriodo.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (componentes)

**Interfaces:**
- Consome: `EstadoPeriodo`, `ModoPeriodo`, `ajustarDe`, `ajustarAte`, `mesesDoPeriodo`, `mesesEntre`, `rotuloIntervalo`, `MAX_MESES_PERIODO` (Tarefa 1); `.barra-fixa` (Tarefa 3); `SeletorMes`, `SeletorPills`.
- Produz: `export default function SeletorPeriodo(props: { estado: EstadoPeriodo; mesHoje: string; onMudar: (e: EstadoPeriodo) => void })`.

Rótulos de acessibilidade (os testes dependem deles):
- modo Mês: os do `SeletorMes` — "Mês anterior", "Mês seguinte".
- modo 12 meses e a linha fixa do modo Período: "Período anterior", "Período seguinte".
- modo Ano: "Ano anterior", "Ano seguinte".
- linhas de edição do modo Período: "Mês inicial anterior", "Mês inicial seguinte", "Mês final anterior", "Mês final seguinte".

- [ ] **Passo 1: testes (falham)**

`src/ui/SeletorPeriodo.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { estadoInicial, type EstadoPeriodo } from '../domain/periodo';
import SeletorPeriodo from './SeletorPeriodo';

function Harness({ inicial }: { inicial?: Partial<EstadoPeriodo> }) {
  const [e, setE] = useState<EstadoPeriodo>({ ...estadoInicial('2026-09'), ...inicial });
  return <div className="tela"><SeletorPeriodo estado={e} mesHoje="2026-09" onMudar={setE} /></div>;
}
const barra = () => document.querySelector('.barra-fixa') as HTMLElement;

describe('SeletorPeriodo', () => {
  it('mostra as quatro pílulas, com Mês marcada', () => {
    render(<Harness />);
    const grupo = screen.getByRole('radiogroup', { name: 'Período' });
    expect(within(grupo).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Mês', '12 meses', 'Ano', 'Período']);
    expect(within(grupo).getByRole('radio', { name: 'Mês' })).toHaveAttribute('aria-checked', 'true');
  });

  it('modo Mês: o seletor de mês fica na barra fixa e anda de mês em mês', async () => {
    render(<Harness />);
    expect(within(barra()).getByText('setembro de 2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mês anterior' }));
    expect(within(barra()).getByText('agosto de 2026')).toBeInTheDocument();
  });

  it('modo 12 meses: janela até o mês de hoje, deslizando de mês em mês', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
    expect(within(barra()).getByText('out/2025 – set/2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Período seguinte' }));
    expect(within(barra()).getByText('nov/2025 – out/2026')).toBeInTheDocument();
  });

  it('modo Ano: abre no último ano fechado; o ano de hoje leva "até agora"', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
    expect(within(barra()).getByText('2025')).toBeInTheDocument();
    expect(screen.queryByText('até agora')).not.toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Ano seguinte' }));
    expect(within(barra()).getByText('2026')).toBeInTheDocument();
    expect(within(barra()).getByText('até agora')).toHaveClass('badge');
  });

  it('modo Período: de/até fora da barra fixa, nota de tamanho, e a barra desliza a janela', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Período' }));
    expect(screen.getByText('7 meses · máximo de 24')).toBeInTheDocument();
    const inicial = screen.getByRole('button', { name: 'Mês inicial anterior' });
    expect(barra().contains(inicial)).toBe(false);
    expect(within(barra()).getByText('mar/2026 – set/2026')).toBeInTheDocument();
    await userEvent.click(within(barra()).getByRole('button', { name: 'Período anterior' }));
    expect(within(barra()).getByText('fev/2026 – ago/2026')).toBeInTheDocument();
    expect(screen.getByText('7 meses · máximo de 24')).toBeInTheDocument();
  });

  it('modo Período: início além do fim arrasta o fim; nunca passa de 24 meses', async () => {
    render(<Harness inicial={{ modo: 'periodo', de: '2026-09', ate: '2026-09' }} />);
    expect(screen.getByText('1 mês · máximo de 24')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mês inicial seguinte' }));
    expect(within(barra()).getByText('out/2026')).toBeInTheDocument();
  });

  it('modo Período: recuar o início no teto puxa o fim', async () => {
    render(<Harness inicial={{ modo: 'periodo', de: '2024-10', ate: '2026-09' }} />);
    expect(screen.getByText('24 meses · máximo de 24')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mês inicial anterior' }));
    expect(within(barra()).getByText('set/2024 – ago/2026')).toBeInTheDocument();
    expect(screen.getByText('24 meses · máximo de 24')).toBeInTheDocument();
  });

  it('trocar de modo preserva o estado dos outros modos', async () => {
    render(<Harness />);
    await userEvent.click(within(barra()).getByRole('button', { name: 'Mês anterior' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Mês' }));
    expect(within(barra()).getByText('agosto de 2026')).toBeInTheDocument();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/SeletorPeriodo.test.tsx` → FAIL (componente não existe).

- [ ] **Passo 3: implementar**

`src/ui/SeletorPeriodo.tsx`:

```tsx
import { addMeses, mesAbreviado } from '../domain/dates';
import {
  MAX_MESES_PERIODO, ajustarAte, ajustarDe, mesesDoPeriodo, rotuloIntervalo,
  type EstadoPeriodo, type ModoPeriodo,
} from '../domain/periodo';
import SeletorMes from './SeletorMes';
import SeletorPills from './SeletorPills';

const OPCOES: { id: ModoPeriodo; nome: string }[] = [
  { id: 'mes', nome: 'Mês' },
  { id: '12m', nome: '12 meses' },
  { id: 'ano', nome: 'Ano' },
  { id: 'periodo', nome: 'Período' },
];

interface Props {
  estado: EstadoPeriodo;
  /** mês de hoje ('AAAA-MM'): marca o ano corrente como "até agora" */
  mesHoje: string;
  onMudar: (e: EstadoPeriodo) => void;
}

/** Uma linha ‹ rótulo ›, no mesmo desenho do SeletorMes. */
function LinhaNav({ rotulo, prefixo, nome, onAnterior, onSeguinte }: {
  rotulo: React.ReactNode; prefixo?: string; nome: string; onAnterior: () => void; onSeguinte: () => void;
}) {
  return (
    <div className="linha" style={{ justifyContent: 'space-between' }}>
      <button className="botao" aria-label={`${nome} anterior`} onClick={onAnterior}>‹</button>
      <span>
        {prefixo && <><span className="sub">{prefixo}</span>{' '}</>}
        <strong>{rotulo}</strong>
      </span>
      <button className="botao" aria-label={`${nome} seguinte`} onClick={onSeguinte}>›</button>
    </div>
  );
}

/** Seletor de período das Análises: pílulas de modo, as linhas de/até (modo Período) e a linha
 *  ‹ período › dentro de `.barra-fixa`, que gruda sob o topo ao rolar. Deve ser filho direto de
 *  `.tela`, para o sticky valer na tela inteira. */
export default function SeletorPeriodo({ estado: e, mesHoje, onMudar }: Props) {
  const meses = mesesDoPeriodo(e);
  const anoHoje = Number(mesHoje.slice(0, 4));

  let fixa: React.ReactNode;
  if (e.modo === 'mes') {
    fixa = <SeletorMes mes={e.mes} onMudar={(mes) => onMudar({ ...e, mes })} />;
  } else if (e.modo === '12m') {
    fixa = (
      <LinhaNav
        nome="Período" rotulo={rotuloIntervalo(meses)}
        onAnterior={() => onMudar({ ...e, fim12: addMeses(e.fim12, -1) })}
        onSeguinte={() => onMudar({ ...e, fim12: addMeses(e.fim12, 1) })}
      />
    );
  } else if (e.modo === 'ano') {
    fixa = (
      <LinhaNav
        nome="Ano"
        rotulo={<>{e.ano}{e.ano === anoHoje && <> <span className="badge">até agora</span></>}</>}
        onAnterior={() => onMudar({ ...e, ano: e.ano - 1 })}
        onSeguinte={() => onMudar({ ...e, ano: e.ano + 1 })}
      />
    );
  } else {
    fixa = (
      <LinhaNav
        nome="Período" rotulo={rotuloIntervalo(meses)}
        onAnterior={() => onMudar({ ...e, de: addMeses(e.de, -1), ate: addMeses(e.ate, -1) })}
        onSeguinte={() => onMudar({ ...e, de: addMeses(e.de, 1), ate: addMeses(e.ate, 1) })}
      />
    );
  }

  return (
    <>
      <SeletorPills
        opcoes={OPCOES} selecionadaId={e.modo} rotulo="Período"
        onSelecionar={(id) => onMudar({ ...e, modo: id as ModoPeriodo })}
      />
      {e.modo === 'periodo' && (
        <>
          <LinhaNav
            nome="Mês inicial" prefixo="de" rotulo={mesAbreviado(e.de)}
            onAnterior={() => onMudar({ ...e, ...ajustarDe(e.de, e.ate, addMeses(e.de, -1)) })}
            onSeguinte={() => onMudar({ ...e, ...ajustarDe(e.de, e.ate, addMeses(e.de, 1)) })}
          />
          <LinhaNav
            nome="Mês final" prefixo="até" rotulo={mesAbreviado(e.ate)}
            onAnterior={() => onMudar({ ...e, ...ajustarAte(e.de, e.ate, addMeses(e.ate, -1)) })}
            onSeguinte={() => onMudar({ ...e, ...ajustarAte(e.de, e.ate, addMeses(e.ate, 1)) })}
          />
          <div className="linha" style={{ justifyContent: 'center' }}>
            <span className="sub">
              {meses.length} {meses.length === 1 ? 'mês' : 'meses'} · máximo de {MAX_MESES_PERIODO}
            </span>
          </div>
        </>
      )}
      <div className="barra-fixa">{fixa}</div>
    </>
  );
}
```

(Se o projeto não expõe o namespace `React` global nos tipos, troque `React.ReactNode` por `import type { ReactNode } from 'react'` e use `ReactNode`.)

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/ui/SeletorPeriodo.test.tsx` → PASS.

- [ ] **Passo 5: catálogo**

Em `docs/estilo/catalogo.md`, na lista de componentes, logo depois do item `SeletorMes.tsx`:

`- **\`SeletorPeriodo.tsx\`** — seletor de período das Análises: pílulas \`Mês · 12 meses · Ano · Período\` (\`SeletorPills\`), as linhas \`de ‹ › \` e \`até ‹ ›\` com a nota "N meses · máximo de 24" (só no modo Período) e a linha \`‹ período ›\` dentro de \`.barra-fixa\` (no modo Mês, é o próprio \`SeletorMes\`). Props \`estado\` (\`EstadoPeriodo\`, de \`domain/periodo.ts\`), \`mesHoje\` e \`onMudar\`. Filho direto de \`.tela\`.`

Run: `node scripts/verificar-catalogo.mjs` → sem aviso sobre `SeletorPeriodo`.

- [ ] **Passo 6: suíte completa e commit**

Run: `npm test` → verde.

```bash
git add src/ui/SeletorPeriodo.tsx src/ui/SeletorPeriodo.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): seletor de período (mês, 12 meses, ano, período livre)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 5: Componentes de cards e folhas aceitam um período

**Arquivos:**
- Modificar: `src/ui/EvolucaoMensalChart.tsx` e `.test.tsx`
- Modificar: `src/ui/ComposicaoBarChart.tsx` e `.test.tsx`
- Modificar: `src/ui/CategoriasCartaoCard.tsx` e `.test.tsx`
- Modificar: `src/ui/CategoriaCartaoHistoricoSheet.tsx` e `.test.tsx`
- Modificar: `src/ui/LancamentosSheet.tsx` e `.test.tsx`
- Modificar: `src/ui/FaturaCategoriaSheet.tsx` e `.test.tsx`
- Criar: `src/ui/CategoriaPeriodoSheet.tsx` e `.test.tsx`
- Modificar: `docs/estilo/catalogo.md`

**Interfaces:**
- Consome: `rotuloIntervalo`, `notaComparacao`, `periodoAnterior`, `periodoAnoAnterior`, `anoAnteriorRepete` (Tarefa 1).
- Produz (props novas, todas opcionais — sem elas, o componente se comporta como hoje):
  - `EvolucaoMensalChart`: `mesAtual: string | null`.
  - `ComposicaoBarChart`: `vazio?: string` (padrão `'Sem movimentos no mês.'`).
  - `CategoriasCartaoCard`: `periodo?: readonly string[]` e `rotuloPeriodo?: string` (usados quando `periodo` tem 2+ meses).
  - `CategoriaCartaoHistoricoSheet`: `periodo?: readonly string[]`.
  - `LancamentosSheet` e `FaturaCategoriaSheet`: `onVoltar?: () => void`.
  - `CategoriaPeriodoSheet` (novo): `{ aberto: boolean; nome: string; tipo: TipoCategoria; meses: readonly string[]; serie: readonly number[]; verMes: string; onAbrirMes: (mes: string) => void; onFechar: () => void }`.

- [ ] **Passo 1: testes (falham)**

`src/ui/EvolucaoMensalChart.test.tsx` — acrescentar no fim:

```tsx
function serieDe(n: number): ResumoMesSimples[] {
  return Array.from({ length: n }, (_, i) => {
    const mes = `2026-${String(i + 1).padStart(2, '0')}`;
    return { mes, ganhos: 100000, gastos: 90000, sobra: 10000 };
  });
}

it('até 6 meses: um rótulo de sobra por mês', () => {
  const { container } = render(<EvolucaoMensalChart serie={serieDe(6)} mesAtual={null} />);
  expect(container.querySelectorAll('.evolucao-sobra')).toHaveLength(6);
});

it('acima de 6 meses: a fileira de sobra dá lugar à sobra do período', () => {
  const { container } = render(<EvolucaoMensalChart serie={serieDe(7)} mesAtual={null} />);
  expect(container.querySelectorAll('.evolucao-sobra')).toHaveLength(0);
  const linha = screen.getByText('sobra do período');
  expect(linha.querySelector('strong')?.textContent).toBe(formatarBRL(70000)); // 7 × 10000
  expect(linha.querySelector('strong')).toHaveClass('valor-ganho');
});
```

`src/ui/ComposicaoBarChart.test.tsx` — acrescentar no fim:

```tsx
it('texto de vazio configurável', () => {
  render(<ComposicaoBarChart linhas={[]} base={1} onClicarLinha={() => {}} vazio="Sem movimentos no período." />);
  expect(screen.getByText('Sem movimentos no período.')).toBeInTheDocument();
});
```

`src/ui/CategoriasCartaoCard.test.tsx` — trocar a função `renderizar` por uma que aceite o período:

```tsx
function renderizar(p: {
  cartoes?: Cartao[]; compras: CompraCartao[]; boxIds?: string[]; onAbrir?: () => void;
  periodo?: string[]; rotuloPeriodo?: string;
}) {
  render(
    <CategoriasCartaoCard
      mes="2026-09" boxIds={p.boxIds ?? ['b1']} cartoes={p.cartoes ?? [azul]} categoriasCartao={cats}
      comprasCartao={p.compras} ajustesFechamento={[]} onAbrir={p.onAbrir ?? (() => {})}
      periodo={p.periodo} rotuloPeriodo={p.rotuloPeriodo}
    />,
  );
  return screen.getByText('Categorias do cartão').closest('.card') as HTMLElement;
}
```

e acrescentar, dentro do `describe`:

```tsx
  const mesesEntre = (de: string, n: number) => Array.from({ length: n }, (_, i) => {
    const [a, m] = de.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    return d.toISOString().slice(0, 7);
  });

  // fecha 28, vence 5: compra de 10/08/2026 → fatura 09/2026; 10/09/2025 → 10/2025; 10/08/2025 → 09/2025
  it('12 meses: período · anterior · média/mês, sem a coluna ano anterior', () => {
    const card = renderizar({
      periodo: mesesEntre('2025-10', 12), rotuloPeriodo: '12 meses',
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 124000),
        compra('b', 'k1', 'mercado', '2025-09-10', 10000),
        compra('c', 'k1', 'mercado', '2025-08-10', 50000),
      ],
    });
    const cabecalhos = within(card).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Categoria', '12 meses', 'anterior', 'média/mês']);
    expect(within(card).getByText('pelo mês da fatura · anterior = out/2024 – set/2025 (é também o ano anterior)')).toBeInTheDocument();
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const valores = within(linha).getAllByRole('cell').slice(1).map((td) => td.textContent);
    // 124000 + 10000 = 134000; anterior (out/2024–set/2025) = 50000; média = round(134000 / 12) = 11167
    expect(valores).toEqual([formatarBRL(134000), formatarBRL(50000), formatarBRL(11167)]);
  });

  it('7 meses: inclui a coluna ano anterior', () => {
    const card = renderizar({
      periodo: mesesEntre('2026-03', 7), rotuloPeriodo: '7 meses',
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 124000),
        compra('c', 'k1', 'mercado', '2025-08-10', 50000),
      ],
    });
    const cabecalhos = within(card).getAllByRole('columnheader').map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Categoria', '7 meses', 'anterior', 'ano anterior', 'média/mês']);
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const valores = within(linha).getAllByRole('cell').slice(1).map((td) => td.textContent);
    // fatura 09/2025 cai no anterior (ago/2025–fev/2026) e no ano anterior (mar–set/2025);
    // média = round(124000 / 7) = 17714
    expect(valores).toEqual([formatarBRL(124000), formatarBRL(50000), formatarBRL(50000), formatarBRL(17714)]);
  });
```

`src/ui/CategoriaCartaoHistoricoSheet.test.tsx` — acrescentar dentro do `describe`:

```tsx
  it('com período: mostra os meses do período, o intervalo e a média por mês', () => {
    render(
      <CategoriaCartaoHistoricoSheet
        aberto cartao={cartao} categoria={mercado} mes="2026-09"
        periodo={['2026-07', '2026-08', '2026-09']}
        comprasCartao={[compra('b', '2026-07-10', 60000), compra('c', '2026-08-10', 90000)]}
        ajustesFechamento={[]} onFechar={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mercado · Cartão Azul' });
    const rotulos = within(dialog).getAllByText(/^[a-z]{3}\/2026$/).map((e) => e.textContent);
    expect(rotulos).toEqual(['jul/2026', 'ago/2026', 'set/2026']);
    expect(within(dialog).getByText('jul/2026 – set/2026, pelo mês da fatura')).toBeInTheDocument();
    // (0 + 60000 + 90000) / 3 = 50000
    expect(within(dialog).getByText('média por mês').querySelector('strong')?.textContent).toBe(formatarBRL(50000));
  });
```

`src/ui/LancamentosSheet.test.tsx` — trocar os imports do topo por:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
```

(o resto dos imports fica) e acrescentar dentro do `describe('LancamentosSheet'`:

```tsx
  function abrirPix(onVoltar?: () => void) {
    render(
      <LancamentosSheet
        aberto categoriaId="pix" nome="Pix" tipo="gasto" mes="2026-07" boxIds={['be']}
        lancamentos={[lanc({ id: '1', data: '2026-07-05', valor: 30000, nota: 'Padaria' })]}
        incluirPrevistos={false} onFechar={() => {}} onVoltar={onVoltar}
      />,
    );
  }

  it('com onVoltar, mostra "‹ voltar ao período" e chama a função', async () => {
    const voltar = vi.fn();
    abrirPix(voltar);
    await userEvent.click(screen.getByRole('button', { name: /voltar ao período/ }));
    expect(voltar).toHaveBeenCalledOnce();
  });

  it('sem onVoltar, não mostra o botão de voltar', () => {
    abrirPix();
    expect(screen.queryByRole('button', { name: /voltar ao período/ })).not.toBeInTheDocument();
  });
```

`src/ui/FaturaCategoriaSheet.test.tsx` — acrescentar dentro do `describe('FaturaCategoriaSheet'`:

```tsx
  function abrirFatura(onVoltar?: () => void) {
    render(
      <FaturaCategoriaSheet
        aberto cartao={cartao} mes="2026-08"
        comprasCartao={[compra({ id: 'c1', data: '2026-07-10', valorTotal: 62000, categoriaCartaoId: 'mercado' })]}
        categoriasCartao={categoriasCartao} horizonteProjecao="2027-12-31"
        onFechar={() => {}} onAbrirCartao={() => {}} onVoltar={onVoltar}
      />,
    );
  }

  it('com onVoltar, mostra "‹ voltar ao período" e chama a função', async () => {
    const voltar = vi.fn();
    abrirFatura(voltar);
    await userEvent.click(screen.getByRole('button', { name: /voltar ao período/ }));
    expect(voltar).toHaveBeenCalledOnce();
  });

  it('sem onVoltar, não mostra o botão de voltar', () => {
    abrirFatura();
    expect(screen.queryByRole('button', { name: /voltar ao período/ })).not.toBeInTheDocument();
  });
```

`src/ui/CategoriaPeriodoSheet.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CategoriaPeriodoSheet from './CategoriaPeriodoSheet';

function abrir(onAbrirMes = vi.fn()) {
  render(
    <CategoriaPeriodoSheet
      aberto nome="Mercado" tipo="gasto" meses={['2026-07', '2026-08', '2026-09']}
      serie={[30000, 0, 90000]} verMes="os lançamentos" onAbrirMes={onAbrirMes} onFechar={() => {}}
    />,
  );
  return screen.getByRole('dialog', { name: 'Mercado' });
}

describe('CategoriaPeriodoSheet', () => {
  it('cabeçalho com total e intervalo; uma barra por mês; média por mês', () => {
    const dialog = abrir();
    expect(within(dialog).getByText(formatarBRL(120000))).toHaveClass('valor-gasto'); // 30000 + 90000
    expect(within(dialog).getByText('jul/2026 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();
    expect(within(dialog).getByText(formatarBRL(0))).toHaveClass('valor-neutro');
    const barras = dialog.querySelectorAll<HTMLElement>('.composicao-preenchimento');
    expect([...barras].map((b) => b.style.width)).toEqual(['33.33%', '0%', '100%']);
    // 120000 / 3 = 40000
    expect(within(dialog).getByText('média por mês').querySelector('strong')?.textContent).toBe(formatarBRL(40000));
  });

  it('tocar num mês chama onAbrirMes com o mês; Enter também', async () => {
    const onAbrirMes = vi.fn();
    const dialog = abrir(onAbrirMes);
    await userEvent.click(within(dialog).getByRole('button', { name: /ago\/2026/ }));
    expect(onAbrirMes).toHaveBeenLastCalledWith('2026-08');
    within(dialog).getByRole('button', { name: /set\/2026/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onAbrirMes).toHaveBeenLastCalledWith('2026-09');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/EvolucaoMensalChart.test.tsx src/ui/ComposicaoBarChart.test.tsx src/ui/CategoriasCartaoCard.test.tsx src/ui/CategoriaCartaoHistoricoSheet.test.tsx src/ui/LancamentosSheet.test.tsx src/ui/FaturaCategoriaSheet.test.tsx src/ui/CategoriaPeriodoSheet.test.tsx` → os testes novos falham.

- [ ] **Passo 3: `EvolucaoMensalChart`**

Substituir o arquivo por:

```tsx
import {
  Bar, ComposedChart, Line, ResponsiveContainer, XAxis,
} from 'recharts';
import type { ResumoMesSimples } from '../domain/aggregations';
import { mesCurto } from '../domain/dates';
import { classeEfeito, formatarBRL, formatarSobraCompacta } from '../domain/money';

interface Props {
  serie: ResumoMesSimples[];
  /** mês em destaque no eixo; `null` = nenhum (período de vários meses) */
  mesAtual: string | null;
}

interface TickProps {
  x: number | string;
  y: number | string;
  payload: { value: string };
}

/** Acima disso, os rótulos de sobra de cada mês se sobrepõem no celular. */
const MAX_ROTULOS_SOBRA = 6;
/** Acima disso, o eixo mostra um mês a cada 3, com o ano (jan/25). */
const MAX_ROTULOS_EIXO = 12;

function rotuloMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
}

export default function EvolucaoMensalChart({ serie, mesAtual }: Props) {
  const longo = serie.length > MAX_ROTULOS_EIXO;
  const sobraTotal = serie.reduce((s, m) => s + m.sobra, 0);
  return (
    <div>
      {serie.length <= MAX_ROTULOS_SOBRA ? (
        <div className="evolucao-rotulos-sobra">
          {serie.map((s) => (
            <span
              key={s.mes}
              className={`evolucao-sobra${s.sobra > 0 ? ' pos' : s.sobra < 0 ? ' neg' : ''}`}
            >
              {formatarSobraCompacta(s.sobra)}
            </span>
          ))}
        </div>
      ) : (
        <p className="sub" style={{ margin: '0 0 4px' }}>
          sobra do período <strong className={classeEfeito(sobraTotal)}>{formatarBRL(sobraTotal)}</strong>
        </p>
      )}
      <div className="evolucao-area">
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="mes"
              interval={longo ? 2 : 0}
              tick={({ x, y, payload }: TickProps) => {
                const ativo = payload.value === mesAtual;
                return (
                  <text
                    x={x} y={Number(y) + 12} textAnchor="middle" fontSize={11}
                    fontWeight={ativo ? 700 : 400} fill={ativo ? 'var(--fg)' : 'var(--muted)'}
                  >
                    {longo ? mesCurto(payload.value) : rotuloMes(payload.value)}
                  </text>
                );
              }}
              axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <Bar dataKey="ganhos" fill="var(--pos)" radius={[3, 3, 0, 0]} barSize={longo ? 4 : 9} isAnimationActive={false} />
            <Bar dataKey="gastos" fill="var(--neg)" radius={[3, 3, 0, 0]} barSize={longo ? 4 : 9} isAnimationActive={false} />
            <Line
              type="linear" dataKey="ganhos" stroke="var(--pos)" strokeWidth={1.6}
              strokeDasharray="5 4" dot={false} isAnimationActive={false}
            />
            <Line
              type="linear" dataKey="gastos" stroke="var(--neg)" strokeWidth={1.6}
              strokeDasharray="5 4" dot={false} isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="evolucao-legenda">
        <span><i className="evolucao-legenda-cor ganho" /> ganhos</span>
        <span><i className="evolucao-legenda-cor gasto" /> gastos</span>
        <span>‐ ‐ linha tracejada = tendência</span>
      </div>
    </div>
  );
}
```

- [ ] **Passo 4: `ComposicaoBarChart`**

Na interface `Props`, acrescentar `/** texto quando não há linhas */ vazio?: string;`; na assinatura, `{ linhas, base, onClicarLinha, vazio = 'Sem movimentos no mês.' }`; e trocar `<p className="sub">Sem movimentos no mês.</p>` por `<p className="sub">{vazio}</p>`.

- [ ] **Passo 5: `CategoriasCartaoCard`**

Substituir o arquivo por:

```tsx
import { Fragment } from 'react';
import { compararCategoriasCartao } from '../domain/categorias';
import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import {
  anoAnteriorRepete, notaComparacao, periodoAnoAnterior, periodoAnterior,
} from '../domain/periodo';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ID } from '../domain/types';

export interface LinhaCategoriaCartao {
  cartaoId: ID;
  categoriaCartaoId: ID;
}

interface Props {
  mes: string;
  /** período de 2+ meses (Análises fora do modo Mês); sem ele, as colunas do modo Mês */
  periodo?: readonly string[];
  /** cabeçalho da coluna do período ("2025", "12 meses", "7 meses") */
  rotuloPeriodo?: string;
  boxIds: readonly ID[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onAbrir: (linha: LinhaCategoriaCartao) => void;
}

/** Uma coluna de valor: soma dos meses listados, dividida por `divisor` (média) e arredondada. */
interface Coluna {
  cabecalho: string;
  meses: readonly string[];
  divisor: number;
  /** coluna de média: não conta para decidir se a linha aparece */
  media: boolean;
}

function colunasDoMes(mes: string): Coluna[] {
  return [
    { cabecalho: mesAbreviado(mes), meses: [mes], divisor: 1, media: false },
    { cabecalho: 'mês anterior', meses: [addMeses(mes, -1)], divisor: 1, media: false },
    { cabecalho: 'ano passado', meses: [addMeses(mes, -12)], divisor: 1, media: false },
    { cabecalho: 'média 3m', meses: [addMeses(mes, -2), addMeses(mes, -1), mes], divisor: 3, media: true },
  ];
}

function colunasDoPeriodo(meses: readonly string[], rotulo: string): Coluna[] {
  return [
    { cabecalho: rotulo, meses, divisor: 1, media: false },
    { cabecalho: 'anterior', meses: periodoAnterior(meses), divisor: 1, media: false },
    ...(anoAnteriorRepete(meses)
      ? []
      : [{ cabecalho: 'ano anterior', meses: periodoAnoAnterior(meses), divisor: 1, media: false }]),
    { cabecalho: 'média/mês', meses, divisor: meses.length, media: true },
  ];
}

/**
 * Card "Categorias do cartão" de Análises: para cada cartão das boxes selecionadas (ativo ou
 * não — desativado ainda tem histórico), cada categoria do cartão pelo mês da fatura. No modo
 * Mês: mês × mês anterior × mesmo mês do ano passado × média 3m. Com um período de vários
 * meses: período × anterior × ano anterior (some com 12 meses) × média/mês — as mesmas colunas
 * do Comparativo. A linha aparece se alguma coluna que não é média tem valor. Linhas em ordem
 * decrescente da 1ª coluna.
 */
export default function CategoriasCartaoCard({
  mes, periodo, rotuloPeriodo, boxIds, cartoes, categoriasCartao, comprasCartao, ajustesFechamento, onAbrir,
}: Props) {
  const varios = periodo != null && periodo.length > 1;
  const colunas = varios ? colunasDoPeriodo(periodo, rotuloPeriodo ?? `${periodo.length} meses`) : colunasDoMes(mes);
  const todos = [...new Set(colunas.flatMap((c) => c.meses))];
  const blocos = cartoes
    .filter((cartao) => boxIds.includes(cartao.boxId))
    .map((cartao) => {
      const totais = totaisCategoriaCartaoPorMes(
        cartao,
        comprasCartao.filter((c) => c.cartaoId === cartao.id),
        todos,
        ajustesDoCartao(ajustesFechamento, cartao.id),
      );
      const linhas = categoriasCartao
        .filter((cat) => cat.cartaoId === cartao.id && totais.has(cat.id))
        .sort(compararCategoriasCartao)
        .map((cat) => {
          const serie = totais.get(cat.id)!;
          const valores = colunas.map((col) =>
            Math.round(col.meses.reduce((s, m) => s + serie[todos.indexOf(m)], 0) / col.divisor));
          return { categoria: cat, valores };
        })
        .filter((l) => l.valores.some((v, i) => !colunas[i].media && v !== 0))
        // maior gasto primeiro, como o Cartão → Resumo; empate pela 2ª coluna e, por fim, pela
        // ordem das categorias do cartão (o sort é estável)
        .sort((a, b) => b.valores[0] - a.valores[0] || b.valores[1] - a.valores[1]);
      return { cartao, linhas };
    })
    .filter((b) => b.linhas.length > 0);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));

  return (
    <div className="card">
      <h2>Categorias do cartão</h2>
      <p className="sub" style={{ margin: '2px 2px 0' }}>
        pelo mês da fatura{varios ? ` · ${notaComparacao(periodo)}` : ''}
      </p>
      {blocos.length === 0 ? (
        <p className="sub">Sem gastos no cartão para comparar.</p>
      ) : (
        <div className="rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Categoria</th>{colunas.map((c) => <th key={c.cabecalho}>{c.cabecalho}</th>)}</tr>
            </thead>
            <tbody>
              {blocos.map(({ cartao, linhas }) => (
                <Fragment key={cartao.id}>
                  {blocos.length > 1 && (
                    <tr>
                      {/* o nome vai na 1ª célula (a coluna fixa), nunca num colSpan: uma célula
                          mais larga que a coluna fixa rola junto com os valores */}
                      <td style={{ whiteSpace: 'nowrap' }}><span className="rotulo-grupo">{cartao.nome}</span></td>
                      <td colSpan={colunas.length} />
                    </tr>
                  )}
                  {linhas.map((l) => (
                    <tr key={l.categoria.id}>
                      <td>
                        <button
                          className="tabela-nome-tocavel"
                          onClick={() => onAbrir({ cartaoId: cartao.id, categoriaCartaoId: l.categoria.id })}
                        >
                          {l.categoria.nome}
                        </button>
                      </td>
                      {l.valores.map((v, i) => (
                        <td key={colunas[i].cabecalho} className={cor(v)}>{formatarBRL(v)}</td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

Atenção: antes de substituir, compare com o arquivo atual — se ele tiver algo que este código não traz (fora `mediaMovel3`, que deixa de ser usado), preserve. Os testes antigos do arquivo têm de passar sem mudança.

- [ ] **Passo 6: `CategoriaCartaoHistoricoSheet`**

- Import: `import { rotuloIntervalo } from '../domain/periodo';`.
- Em `Props`, depois de `mes: string;`: `/** meses do período (2+); sem ele, os 6 meses até \`mes\` */ periodo?: readonly string[];`.
- Na desestruturação: `aberto, cartao, categoria, mes, periodo, comprasCartao, ajustesFechamento, onFechar,`.
- Trocar `const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));` por
  `const meses: readonly string[] = periodo ?? [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));`.
- Trocar o texto `últimos 6 meses, pelo mês da fatura` por
  `{periodo ? `${rotuloIntervalo(periodo)}, pelo mês da fatura` : 'últimos 6 meses, pelo mês da fatura'}`.
- Trocar o texto `média 6m` por `{periodo ? 'média por mês' : 'média 6m'}`.
- Atualizar o comentário do componente: "…nos 6 meses de fatura que terminam em `mes`, ou nos meses de `periodo`…".

- [ ] **Passo 7: `onVoltar` nas duas folhas**

`LancamentosSheet.tsx`: em `Props`, `/** mostra "‹ voltar ao período" (folha aberta a partir da folha de um período) */ onVoltar?: () => void;`; desestruturar `onVoltar`; logo depois de `<Sheet …>`, antes do `<div className="linha" …>`:

```tsx
      {onVoltar && <button className="botao-ver-mais" onClick={onVoltar}>‹ voltar ao período</button>}
```

`FaturaCategoriaSheet.tsx`: mesma prop; dentro do `cabecalho`, antes do `<h2>`:

```tsx
          {onVoltar && <button className="botao-ver-mais" onClick={onVoltar}>‹ voltar ao período</button>}
```

- [ ] **Passo 8: `CategoriaPeriodoSheet`**

`src/ui/CategoriaPeriodoSheet.tsx`:

```tsx
import { mesAbreviado } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { rotuloIntervalo } from '../domain/periodo';
import type { TipoCategoria } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  nome: string;
  tipo: TipoCategoria;
  meses: readonly string[];
  /** total da categoria em cada mês de `meses`, na mesma ordem */
  serie: readonly number[];
  /** o que o toque num mês abre: "os lançamentos" ou "a fatura" */
  verMes: string;
  onAbrirMes: (mes: string) => void;
  onFechar: () => void;
}

/** Folha de uma categoria num período de vários meses (Análises): total, uma barra por mês
 *  (100% = maior mês, mesmas classes `composicao-*` do ComposicaoBarChart) e a média por mês.
 *  Tocar num mês abre a folha daquele mês. */
export default function CategoriaPeriodoSheet({
  aberto, nome, tipo, meses, serie, verMes, onAbrirMes, onFechar,
}: Props) {
  const total = serie.reduce((a, b) => a + b, 0);
  const maior = Math.max(0, ...serie.map(Math.abs));
  const media = meses.length > 0 ? Math.round(total / meses.length) : 0;
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, tipo));

  return (
    <Sheet
      aberto={aberto} onFechar={onFechar} rotulo={nome}
      cabecalho={(
        <>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{nome}</h2>
            <strong className={cor(total)}>{formatarBRL(total)}</strong>
          </div>
          <p className="sub" style={{ margin: 0 }}>{rotuloIntervalo(meses)} · toque num mês para ver {verMes}</p>
        </>
      )}
    >
      <div className="composicao-lista">
        {meses.map((m, i) => {
          const v = serie[i] ?? 0;
          const largura = maior === 0 ? 0 : Math.round((Math.abs(v) / maior) * 10000) / 100;
          return (
            <div
              key={m}
              className="composicao-linha"
              role="button"
              tabIndex={0}
              onClick={() => onAbrirMes(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrirMes(m); }
              }}
            >
              <div className="composicao-rotulo">
                <span className="composicao-nome">{mesAbreviado(m)}</span>
                <span className="composicao-valores"><strong className={cor(v)}>{formatarBRL(v)}</strong></span>
              </div>
              <div className="composicao-trilho">
                <div
                  className={`composicao-preenchimento ${efeitoNoSaldo(v, tipo) > 0 ? 'ganho' : 'gasto'}`}
                  style={{ width: `${largura}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        média por mês <strong className={cor(media)}>{formatarBRL(media)}</strong>
      </p>
    </Sheet>
  );
}
```

- [ ] **Passo 9: rodar e ver passar**

Run: o mesmo comando do Passo 2 → PASS (antigos e novos).

- [ ] **Passo 10: catálogo**

Em `docs/estilo/catalogo.md`, componentes:
- Novo item, logo depois de `CategoriaCartaoHistoricoSheet.tsx`:
  `- **\`CategoriaPeriodoSheet.tsx\`** — sheet de uma categoria num período de vários meses (Análises): total no cabeçalho, uma barra por mês (\`.composicao-*\`, 100% = maior mês) e a média por mês; tocar num mês (\`role="button"\`, Enter/espaço) chama \`onAbrirMes\`, e a Análises abre o \`LancamentosSheet\` ou o \`FaturaCategoriaSheet\` daquele mês com "‹ voltar ao período".`
- `CategoriaCartaoHistoricoSheet.tsx`: acrescentar "…ou nos meses do período (\`periodo\`), com 'média por mês'".
- `CategoriasCartaoCard.tsx`: acrescentar "Com \`periodo\` (2+ meses): período · anterior · ano anterior (some com 12 meses) · média/mês, e a nota de intervalos no subtítulo".
- `EvolucaoMensalChart.tsx`: acrescentar "Recebe a série de meses do período; acima de 6 meses, a fileira de sobra vira a linha 'sobra do período'; acima de 12, o eixo mostra um mês a cada 3 (\`jan/25\`)".
- `LancamentosSheet.tsx` e `FaturaCategoriaSheet.tsx`: acrescentar "Prop opcional \`onVoltar\`: '‹ voltar ao período' (\`.botao-ver-mais\`) no topo".

Run: `node scripts/verificar-catalogo.mjs` → sem aviso sobre estes componentes.

- [ ] **Passo 11: suíte completa e commit**

Run: `npm test` → verde.

```bash
git add src/ui/EvolucaoMensalChart.tsx src/ui/EvolucaoMensalChart.test.tsx src/ui/ComposicaoBarChart.tsx src/ui/ComposicaoBarChart.test.tsx src/ui/CategoriasCartaoCard.tsx src/ui/CategoriasCartaoCard.test.tsx src/ui/CategoriaCartaoHistoricoSheet.tsx src/ui/CategoriaCartaoHistoricoSheet.test.tsx src/ui/LancamentosSheet.tsx src/ui/LancamentosSheet.test.tsx src/ui/FaturaCategoriaSheet.tsx src/ui/FaturaCategoriaSheet.test.tsx src/ui/CategoriaPeriodoSheet.tsx src/ui/CategoriaPeriodoSheet.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): cards e folhas das Análises aceitam um período de vários meses" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 6: `TelaAnalises` com período

**Arquivos:**
- Modificar: `src/ui/TelaAnalises.tsx`
- Modificar: `src/ui/TelaAnalises.test.tsx`

**Interfaces — consome:** tudo das Tarefas 1, 2, 4 e 5.

- [ ] **Passo 1: testes (falham)**

Em `src/ui/TelaAnalises.test.tsx`, acrescentar no fim (usa o `seedBoxComCategoria` do arquivo):

```tsx
async function seedDoisMeses() {
  const { box, catPix } = await seedBoxComCategoria();
  // out/2025 e set/2026: os dois cabem em "12 meses" terminando em set/2026
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2025-10-05', valor: 10000, status: 'efetivo', nota: 'Padaria' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-09-05', valor: 25000, status: 'efetivo', nota: 'Feira' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-09-15' });
  return { box, catPix };
}

it('12 meses: soma o período e mostra a média por mês', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  expect(screen.getByText('out/2025 – set/2026')).toBeInTheDocument();
  // pix: 10000 + 25000 = 35000
  const linha = screen.getByRole('button', { name: /pix/ });
  expect(within(linha).getByText(formatarBRL(35000))).toBeInTheDocument();
  expect(screen.getByText(/^média por mês:/)).toBeInTheDocument();
});

it('Comparativo com 12 meses: sem a coluna ano anterior, com a nota do intervalo', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  const card = screen.getByRole('heading', { name: 'Comparativo' }).closest('.card') as HTMLElement;
  const cabecalhos = within(card).getAllByRole('columnheader').map((th) => th.textContent);
  expect(cabecalhos).toEqual(['Categoria', '12 meses', 'anterior', 'média/mês']);
  expect(within(card).getByText('anterior = out/2024 – set/2025 (é também o ano anterior)')).toBeInTheDocument();
  const linha = within(card).getByText('pix').closest('tr') as HTMLElement;
  // média = round(35000 / 12) = 2917
  expect(within(linha).getAllByRole('cell').map((td) => td.textContent))
    .toEqual(['pix', formatarBRL(35000), formatarBRL(0), formatarBRL(2917)]);
});

it('Período: 7 meses por padrão, com a coluna ano anterior', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: 'Período' }));
  expect(screen.getByText('mar/2026 – set/2026')).toBeInTheDocument();
  const card = screen.getByRole('heading', { name: 'Comparativo' }).closest('.card') as HTMLElement;
  expect(within(card).getAllByRole('columnheader').map((th) => th.textContent))
    .toEqual(['Categoria', '7 meses', 'anterior', 'ano anterior', 'média/mês']);
});

it('Ano: abre no último ano fechado', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: 'Ano' }));
  expect(document.querySelector('.barra-fixa')).toHaveTextContent('2025');
  // só out/2025 cai em 2025
  expect(within(screen.getByRole('button', { name: /pix/ })).getByText(formatarBRL(10000))).toBeInTheDocument();
});

it('categoria com vários meses: folha do período → folha do mês → volta ao período', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  await userEvent.click(screen.getByRole('radio', { name: '12 meses' }));
  await userEvent.click(screen.getByRole('button', { name: /pix/ }));
  const periodo = await screen.findByRole('dialog', { name: 'pix' });
  expect(within(periodo).getByText('out/2025 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();

  await userEvent.click(within(periodo).getByRole('button', { name: /out\/2025/ }));
  expect(await screen.findByText('Padaria')).toBeInTheDocument();
  expect(screen.queryByText('Feira')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /voltar ao período/ }));
  expect(await screen.findByText('out/2025 – set/2026 · toque num mês para ver os lançamentos')).toBeInTheDocument();
});

it('modo Mês: o seletor de mês fica na barra fixa', async () => {
  await seedDoisMeses();
  render(<TelaAnalises />);
  const barra = document.querySelector('.barra-fixa') as HTMLElement;
  expect(within(barra).getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
  expect(within(barra).getByText('setembro de 2026')).toBeInTheDocument();
});
```

Observação para o implementador: o botão da linha "pix" do card Por categoria é a `.composicao-linha` (`role="button"`), cujo nome acessível inclui o valor; por isso `within(linha).getByText(formatarBRL(35000))` funciona. Se o nome `/pix/` casar com mais de um botão (a tabela do Comparativo não tem botão; confira), refine com `getAllByRole(...)[0]` e explique no commit.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx` → os testes novos falham; os antigos passam.

- [ ] **Passo 3: implementar**

Em `src/ui/TelaAnalises.tsx`:

1. Imports — trocar os de `aggregations`, `fatura` e `SeletorMes` e acrescentar os novos:

```tsx
import {
  compararMeses, compararPeriodos, mediaMovel3, resumoPeriodo, serieMensal, serieMensalResumo,
} from '../domain/aggregations';
import { addMeses, formatarDataBR, mesAbreviado, mesDe } from '../domain/dates';
import { resumoAssinaturasDoPeriodo } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import {
  anoAnteriorRepete, estadoInicial, mesesDoPeriodo, notaComparacao, rotuloColunaPeriodo,
  type EstadoPeriodo,
} from '../domain/periodo';
```

remover `import SeletorMes from './SeletorMes';` e acrescentar:

```tsx
import CategoriaPeriodoSheet from './CategoriaPeriodoSheet';
import SeletorPeriodo from './SeletorPeriodo';
```

2. Estado — trocar `const [mes, setMes] = useState(() => mesDe(hoje));` e `const [categoriaAberta, setCategoriaAberta] = useState<ID | null>(null);` por:

```tsx
  const [periodo, setPeriodo] = useState<EstadoPeriodo>(() => estadoInicial(mesDe(hoje)));
  // folha de um mês (lançamentos ou fatura); `doPeriodo` = aberta pela folha do período
  const [detalhe, setDetalhe] = useState<{ categoriaId: ID; mes: string; doPeriodo: boolean } | null>(null);
  // folha do período (vários meses) de uma categoria
  const [categoriaPeriodo, setCategoriaPeriodo] = useState<ID | null>(null);
```

3. Logo depois de `if (!dados) return null;`, antes de qualquer uso de `mes`:

```tsx
  const meses = mesesDoPeriodo(periodo);
  const varios = meses.length > 1;
  // no modo Mês, o próprio mês; nos outros, o último do período (base das folhas por mês)
  const mes = meses[meses.length - 1];
  const categoriaAberta = detalhe?.categoriaId ?? null;
  // aberta pela folha do período: fica no mês tocado; no modo Mês, acompanha o seletor
  const mesDetalhe = detalhe?.doPeriodo ? detalhe.mes : mes;
```

4. Trocar os cálculos:
- `const resumo = resumoMensal(mes, …)` → `const resumo = resumoPeriodo(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos);`
- `const comparativo = compararMeses(mes, …)` → mantém, mas só no modo Mês:
  `const comparativo = varios ? [] : compararMeses(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);`
  e logo abaixo:
  `const comparativoPeriodo = varios ? compararPeriodos(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos) : [];`
  `const repete = anoAnteriorRepete(meses);`
- `resumoAssinaturasDoMes(mes, …)` → `resumoAssinaturasDoPeriodo(meses, ids, dados.cartoes, dados.comprasCartao, dados.recorrenciasCartao, dados.ajustesFechamento)`.
- O bloco `const meses = [-5, …].map(…)` da evolução vira:
  `const mesesEvolucao = varios ? meses : [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));`
  e as duas linhas seguintes passam a usar `mesesEvolucao` no lugar de `meses`.
- `viagensNoMes` vira `viagensNoPeriodo`, somando os meses:

```tsx
  const viagensNoPeriodo = dados.viagens
    .map((v) => ({
      viagem: v,
      total: meses.reduce((soma, m) => soma + totalViagemNoMes(
        v, m, ids, dados.lancamentos, dados.comprasCartao, dados.cartoes, incluirPrevistos,
        dados.categorias, dados.ajustesFechamento,
      ), 0),
    }))
    .filter((x) => x.total !== 0);
```

  (e troque o uso em `linhasComposicao`).

5. `abrirComposicao` — a última linha `setCategoriaAberta(chave);` vira:

```tsx
    if (varios) { setCategoriaPeriodo(chave); return; }
    setDetalhe({ categoriaId: chave, mes, doPeriodo: false });
```

6. Antes do `return`, acrescentar:

```tsx
  const categoriaPeriodoObj = dados.categorias.find((c) => c.id === categoriaPeriodo);
  const seriePeriodo = categoriaPeriodo
    ? serieMensal(categoriaPeriodo, meses, ids, dados.lancamentos, incluirPrevistos)
    : [];
  const periodoEhFatura = dados.cartoes.some((c) => c.categoriaFaturaId === categoriaPeriodo);
  const fecharDetalhe = () => setDetalhe(null);
  const voltarAoPeriodo = detalhe?.doPeriodo
    ? () => { setCategoriaPeriodo(detalhe.categoriaId); setDetalhe(null); }
    : undefined;
  const media = (v: number) => Math.round(v / meses.length);
```

7. JSX:
- `<SeletorMes mes={mes} onMudar={setMes} />` → `<SeletorPeriodo estado={periodo} mesHoje={mesDe(hoje)} onMudar={setPeriodo} />`
- No card do resumo, logo depois do `<div className="linha" …>…</div>` com Ganhos/Gastos/Sobra:

```tsx
        {varios && (
          <p className="sub" style={{ margin: '8px 0 0' }}>
            média por mês: ganhos <strong className={classeEfeito(resumo.totalGanhos)}>{formatarBRL(media(resumo.totalGanhos))}</strong>
            {' · '}gastos <strong className={classeEfeito(-resumo.totalGastos)}>{formatarBRL(media(resumo.totalGastos))}</strong>
            {' · '}sobra <strong className={classeEfeito(resumo.sobra)}>{formatarBRL(media(resumo.sobra))}</strong>
          </p>
        )}
```

- Subtítulo do Por categoria: `…(100% = maior entre ganhos e gastos do mês)` → `…(100% = maior entre ganhos e gastos {varios ? 'do período' : 'do mês'})`; e o `ComposicaoBarChart` ganha `vazio={varios ? 'Sem movimentos no período.' : 'Sem movimentos no mês.'}`.
- Evolução: `<EvolucaoMensalChart serie={serieEvolucao} mesAtual={varios ? null : mes} />`.
- Comparativo: trocar o card inteiro por:

```tsx
      <div className="card">
        <h2>Comparativo</h2>
        {varios && <p className="sub" style={{ margin: '2px 2px 0' }}>{notaComparacao(meses)}</p>}
        <div className="rolavel">
          <table className="tabela">
            {varios ? (
              <>
                <thead>
                  <tr>
                    <th>Categoria</th><th>{rotuloColunaPeriodo(periodo.modo, meses)}</th><th>anterior</th>
                    {!repete && <th>ano anterior</th>}<th>média/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativoPeriodo.map((c) => {
                    const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, c.tipo));
                    return (
                      <tr key={c.categoriaId}>
                        <td>{c.nome}</td>
                        <td className={cor(c.atual)}>{formatarBRL(c.atual)}</td>
                        <td className={cor(c.anterior)}>{formatarBRL(c.anterior)}</td>
                        {c.anoAnterior != null && <td className={cor(c.anoAnterior)}>{formatarBRL(c.anoAnterior)}</td>}
                        <td className={cor(c.mediaMensal)}>{formatarBRL(c.mediaMensal)}</td>
                      </tr>
                    );
                  })}
                  {comparativoPeriodo.length === 0 && <tr><td colSpan={repete ? 4 : 5}>Sem dados para comparar.</td></tr>}
                </tbody>
              </>
            ) : (
              <>
                {/* modo Mês: o thead e o tbody atuais, sem mudança */}
              </>
            )}
          </table>
        </div>
      </div>
```

  No ramo do modo Mês, coloque exatamente o `<thead>…</thead>` e o `<tbody>…</tbody>` que o card tem hoje.

- `CategoriasCartaoCard`: acrescentar `periodo={varios ? meses : undefined}` e `rotuloPeriodo={rotuloColunaPeriodo(periodo.modo, meses)}`.
- `FaturaCategoriaSheet`: `mes={mesDetalhe}`, `onFechar={fecharDetalhe}`, `onVoltar={voltarAoPeriodo}`, `onAbrirCartao={() => { setAba('cartao'); fecharDetalhe(); }}`.
- `LancamentosSheet`: `mes={mesDetalhe}`, `onFechar={fecharDetalhe}`, `onVoltar={voltarAoPeriodo}`.
- Logo depois do `LancamentosSheet`/`FaturaCategoriaSheet`:

```tsx
      <CategoriaPeriodoSheet
        aberto={categoriaPeriodo !== null}
        nome={categoriaPeriodoObj?.nome ?? ''}
        tipo={categoriaPeriodoObj?.tipo ?? 'gasto'}
        meses={meses}
        serie={seriePeriodo}
        verMes={periodoEhFatura ? 'a fatura' : 'os lançamentos'}
        onAbrirMes={(m) => {
          if (categoriaPeriodo) setDetalhe({ categoriaId: categoriaPeriodo, mes: m, doPeriodo: true });
          setCategoriaPeriodo(null);
        }}
        onFechar={() => setCategoriaPeriodo(null)}
      />
```

- `CategoriaCartaoHistoricoSheet`: acrescentar `periodo={varios ? meses : undefined}`.

8. Confira que não sobrou referência a `setMes`, `setCategoriaAberta`, `resumoMensal`, `resumoAssinaturasDoMes` nem `viagensNoMes`: `grep -n "setMes\|setCategoriaAberta\|resumoMensal\|resumoAssinaturasDoMes\|viagensNoMes" src/ui/TelaAnalises.tsx` → nada.

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx` → PASS, antigos inclusive ("trocar o mês com o sheet aberto atualiza os grupos exibidos" depende do `mesDetalhe` acompanhar o seletor no modo Mês).

- [ ] **Passo 5: suíte, build e commit**

Run: `npm test` → verde. Run: `npm run build` → sem erro de tipo.

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): análise por período — 12 meses, ano e período livre" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

### Tarefa 7: Wiki e changelog

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md` (seção `## Análises`, ~linhas 92–101; seção do Cartão)
- Criar: `changelog.d/adicionado-analises-por-periodo.md`
- Criar: `changelog.d/alterado-seletor-mes-fixo.md`

- [ ] **Passo 1: wiki — Análises**

Em `docs/wiki/6-telas.md`, trocar o parágrafo de abertura da seção `## Análises` e os bullets **Resumo**, **Por categoria**, **Comparativo** e **Categorias do cartão** por:

```markdown
Resumo e comparativos de um período. No topo, quatro opções:

- **Mês:** um mês, navegando com as setas ‹ › — o mês aparece por nome (janeiro, fevereiro etc.).
- **12 meses:** os 12 meses que terminam no mês atual; as setas deslizam a janela um mês por vez.
- **Ano:** de janeiro a dezembro. Abre no último ano fechado; o ano atual aparece marcado "até agora".
- **Período:** um intervalo livre, de um mês a outro (no máximo 24 meses), escolhido nas linhas "de" e "até". As setas da linha de baixo deslizam o intervalo inteiro.

A linha com as setas fica presa logo abaixo da barra do topo: dá para trocar o mês ou o período sem voltar ao começo da tela.

- Caixa "incluir previstos" — desligada, mostra só o que já é efetivo no período.
- **Resumo:** ganhos, gastos e sobra do período. Com mais de um mês, mostra também a média por mês.
- **Por categoria:** total de cada categoria e seu percentual da renda do período (só para categorias de gasto). Tocar numa categoria de cartão abre a fatura (veja o capítulo [Cartão de crédito](#cartao)). Uma [viagem](#conceitos/viagem) com gasto no período aparece aqui como linha própria. Com mais de um mês, tocar numa categoria abre uma barra por mês; tocar num mês abre os lançamentos (ou a fatura) daquele mês, com "‹ voltar ao período".
```

manter o bullet **Viagens** como está, e trocar os bullets **Comparativo** e **Categorias do cartão** por:

```markdown
- **Comparativo:** por categoria. No modo Mês: mês atual × mês anterior × mesmo mês do ano passado × média móvel de 3 meses; a coluna do mês atual mostra o mês abreviado (out/2026). Nos outros modos: período × período anterior (os mesmos tantos meses, logo antes) × mesmo período do ano anterior × média por mês. Com 12 meses, o período anterior já é o ano anterior, e essa coluna aparece uma vez só. Uma linha sob o título diz os meses de cada coluna.
- **Categorias do cartão:** as categorias do cartão (Mercado, Restaurante etc.) com as mesmas colunas do Comparativo. O mês é o da fatura: cada parcela conta na fatura em que cai, então a coluna do mês bate com o Resumo da mesma fatura na aba Cartão. Com mais de um cartão, cada um vem num bloco com o nome dele. Dentro de cada bloco, as categorias vêm do maior para o menor valor na primeira coluna. A caixa "incluir previstos" não muda este card. Tocar no nome de uma categoria abre os meses dela em barras, com a média — os últimos 6 meses, no modo Mês; os meses do período, nos outros.
```

- [ ] **Passo 2: wiki — Cartão**

Na seção do Cartão de `docs/wiki/6-telas.md`, acrescentar um bullet à lista que descreve a tela (antes de "Compra nova entra pelo botão **+**…"):

```markdown
- O nome do cartão e o seletor de mês ficam presos logo abaixo da barra do topo ao rolar. Na visão casa, com vários cartões, o bloco do cartão seguinte empurra o anterior.
```

- [ ] **Passo 3: validar a wiki**

Run: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS.

- [ ] **Passo 4: fragmentos**

`changelog.d/adicionado-analises-por-periodo.md`:

```
- Análises por período: além do mês, os últimos 12 meses, um ano inteiro ou um intervalo livre de até 24 meses.
  - Resumo com a média por mês, e Comparativo com o período anterior e o mesmo período do ano anterior.
  - Tocar numa categoria mostra uma barra por mês; tocar num mês abre os lançamentos daquele mês.
```

`changelog.d/alterado-seletor-mes-fixo.md`:

```
- O seletor de mês das Análises e do Cartão fica preso sob a barra do topo ao rolar a tela.
```

- [ ] **Passo 5: suíte completa e commit**

Run: `npm test` → verde.

```bash
git add docs/wiki/6-telas.md changelog.d/adicionado-analises-por-periodo.md changelog.d/alterado-seletor-mes-fixo.md
git commit -m "docs(wiki): análises por período e seletor fixo; fragmentos de changelog" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs"
```

---

## Depois das tarefas (sessão principal, não subagente)

- Varredura com Playwright no S25+ (`npx vite` do worktree, porta própria, dados sintéticos via `repo.ts`): os quatro modos; rolar e trocar o período; folha do período → mês → voltar; Cartão com dois cartões rolando; Wiki pulando para uma seção (o título para logo abaixo da barra). Capturas enviadas pelo chat.
- Skill `ciclo-de-entrega` para integrar.
