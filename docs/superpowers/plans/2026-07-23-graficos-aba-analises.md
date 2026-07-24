# Gráficos e responsividade na aba Análises — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar visualização gráfica à aba Análises (barrinhas ganho/gasto no card resumo, composição por categoria em barras, evolução mensal de 6 meses com linha de tendência) e corrigir a tabela "Comparativo" para nunca perder o nome da categoria ao rolar horizontalmente no celular.

**Architecture:** Duas funções puras novas em `src/domain/` (uma agregação por mês, um formatador compacto), dois componentes de apresentação novos em `src/ui/` (`ComposicaoBarChart.tsx` — divs/CSS puro, sem lib, para preservar o contrato de acessibilidade `role="button"` que os testes existentes já dependem; `EvolucaoMensalChart.tsx` — `recharts` `ComposedChart`, carregado sob demanda como o `FluxoChartModal` já faz), e edições cirúrgicas em `TelaAnalises.tsx`/`styles.css` para encaixar tudo. A tabela "Comparativo" ganha coluna fixa com largura própria (não automática) para não repetir o bug de compressão de coluna descoberto durante o mockup.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library, `recharts` (já é dependência do projeto — não é dependência nova).

## Global Constraints

- Todo valor monetário é centavos inteiros; formatação só via `src/domain/money.ts`.
- Sem paleta categórica nova: só `--pos` (verde, ganho), `--neg` (vermelho, gasto) e cores já existentes.
- Classes CSS novas em português, kebab-case; classe de componente vai num bloco comentado próprio ao fim de `src/styles.css` (`/* ---- Nome (Arquivo.tsx) ---- */`).
- Cor/raio só via token/escala existente (exceção já usada no projeto: `rgba(0,0,0,.4X)` cru em `box-shadow`/overlay, ver `.navegacao button.central` e `.sheet-backdrop`).
- Componente novo → arquivo `src/ui/<Nome>.tsx` + teste `src/ui/<Nome>.test.tsx` no mesmo commit, e entrada em "Componentes compartilhados" de `docs/estilo/catalogo.md` no mesmo commit.
- Mudança visível ao usuário → fragmento em `changelog.d/` (nunca editar `CHANGELOG.md`/`package.json` direto nesta branch).
- Mockup HTML já foi aprovado pelo usuário nesta sessão (4 rodadas) — este plano implementa exatamente o que foi aprovado; a spec completa está em `docs/superpowers/specs/2026-07-23-graficos-aba-analises-design.md`.

---

## Task 1: Domínio — `serieMensalResumo`

**Files:**
- Modify: `src/domain/aggregations.ts`
- Test: `src/domain/aggregations.test.ts`

**Interfaces:**
- Produces: `export interface ResumoMesSimples { mes: string; ganhos: number; gastos: number; sobra: number }` e `export function serieMensalResumo(meses: string[], boxIds: readonly ID[], categorias: Categoria[], lancamentos: Lancamento[], incluirPrevistos: boolean): ResumoMesSimples[]` — usados por `EvolucaoMensalChart.tsx` (Task 4) e `TelaAnalises.tsx` (Task 7).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/domain/aggregations.test.ts` (reaproveita os fixtures `cats`/`lancs` já existentes no topo do arquivo):

```ts
it('serieMensalResumo soma ganho/gasto/sobra por mês', () => {
  const serie = serieMensalResumo(['2026-06', '2026-07'], ['be'], cats, lancs, false);
  expect(serie).toEqual([
    { mes: '2026-06', ganhos: 0, gastos: 90000, sobra: -90000 },
    { mes: '2026-07', ganhos: 550000, gastos: 190000, sobra: 360000 },
  ]);
});

it('serieMensalResumo com incluirPrevistos soma o previsto mas nunca o cenário', () => {
  const serie = serieMensalResumo(['2026-07'], ['be'], cats, lancs, true);
  expect(serie[0]).toEqual({ mes: '2026-07', ganhos: 550000, gastos: 240000, sobra: 310000 });
});
```

Adicionar `serieMensalResumo` ao import do topo do arquivo (linha 2):

```ts
import { compararMeses, lancamentosDaCategoria, mediaMovel3, resumoMensal, serieMensal, serieMensalResumo } from './aggregations';
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/aggregations.test.ts -t "serieMensalResumo"`
Expected: FAIL — `serieMensalResumo is not a function` (ou erro de import).

- [ ] **Step 3: Implementar `serieMensalResumo`**

Em `src/domain/aggregations.ts`, adicionar logo depois da função `mediaMovel3` (que termina com `);` antes do bloco `export interface ItemLancamento`):

```ts
export interface ResumoMesSimples {
  mes: string;
  ganhos: number;
  gastos: number;
  sobra: number;
}

export function serieMensalResumo(
  meses: string[],
  boxIds: readonly ID[],
  categorias: Categoria[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): ResumoMesSimples[] {
  return meses.map((mes) => {
    const totais = totaisPorCategoria(filtrar(mes, boxIds, lancamentos, incluirPrevistos));
    let ganhos = 0;
    let gastos = 0;
    for (const c of categorias) {
      const t = totais.get(c.id) ?? 0;
      if (c.tipo === 'ganho') ganhos += t; else gastos += t;
    }
    return { mes, ganhos, gastos, sobra: ganhos - gastos };
  });
}
```

`ID` já está importado no topo do arquivo (`import type { Categoria, ID, ISODate, Lancamento, TipoCategoria } from './types';`) — nenhum import novo necessário.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/aggregations.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/aggregations.ts src/domain/aggregations.test.ts
git commit -m "feat(aggregations): adiciona serieMensalResumo para evolucao mensal"
```

---

## Task 2: Domínio — `formatarSobraCompacta`

**Files:**
- Modify: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

**Interfaces:**
- Produces: `export function formatarSobraCompacta(centavos: number): string` — usado por `EvolucaoMensalChart.tsx` (Task 4).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/domain/money.test.ts`:

```ts
describe('formatarSobraCompacta', () => {
  it('formata positivo com sinal + e sem casas decimais', () => {
    expect(formatarSobraCompacta(187000)).toBe('+1.870');
  });
  it('formata negativo com sinal − (menos Unicode) e valor absoluto', () => {
    expect(formatarSobraCompacta(-41000)).toBe('−410');
  });
  it('arredonda centavos ao real mais próximo', () => {
    expect(formatarSobraCompacta(93050)).toBe('+931'); // 930,50 arredonda pra 931
  });
  it('zero é positivo (sinal +)', () => {
    expect(formatarSobraCompacta(0)).toBe('+0');
  });
});
```

Atualizar o import do topo do arquivo (linha 1):

```ts
import { formatarBRL, formatarSobraCompacta, empurrarDigito, apagarUltimoDigito, digitosParaCentavos } from './money';
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/money.test.ts -t "formatarSobraCompacta"`
Expected: FAIL — `formatarSobraCompacta is not a function`.

- [ ] **Step 3: Implementar `formatarSobraCompacta`**

Em `src/domain/money.ts`, adicionar ao fim do arquivo:

```ts
/** Sobra do mês em formato compacto (sem "R$", arredondado ao real) — rótulo curto para
 *  caber acima de barras de gráfico (ex.: "+1.870", "−410"). */
export function formatarSobraCompacta(centavos: number): string {
  const sinal = centavos < 0 ? '−' : '+';
  const reais = Math.round(Math.abs(centavos) / 100);
  return `${sinal}${reais.toLocaleString('pt-BR')}`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/money.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(money): adiciona formatarSobraCompacta para rotulo de grafico"
```

---

## Task 3: Componente — `ComposicaoBarChart.tsx`

**Files:**
- Create: `src/ui/ComposicaoBarChart.tsx`
- Test: `src/ui/ComposicaoBarChart.test.tsx`
- Modify: `src/styles.css` (novo bloco ao fim do arquivo)

**Interfaces:**
- Consumes: `formatarBRL` de `../domain/money`; `TipoCategoria` de `../domain/types`.
- Produces: `export interface LinhaComposicao { chave: string; nome: string; badge?: string; tipo: TipoCategoria; total: number; pctDaRenda: number | null }` e o componente `ComposicaoBarChart({ linhas: LinhaComposicao[]; base: number; onClicarLinha: (chave: string) => void })` — consumidos por `TelaAnalises.tsx` (Task 6).

Este componente **não usa `recharts`**: é uma lista de barras em divs simples, mesmo espírito de `BalanceChart.tsx`. Motivo: os testes existentes de `TelaAnalises.test.tsx` já dependem de cada linha ser localizável via `screen.getByRole('button', { name: /.../ })` com o texto (nome + valor) dentro do próprio elemento — reproduzir esse contrato de acessibilidade dentro das barras internas do `recharts` exigiria customizar profundamente o `shape` de cada barra; um `<div role="button">` por linha faz isso nativamente e sem dependência extra.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/ComposicaoBarChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ComposicaoBarChart, { type LinhaComposicao } from './ComposicaoBarChart';

const linhas: LinhaComposicao[] = [
  { chave: 'sal', nome: 'Salário', tipo: 'ganho', total: 620000, pctDaRenda: null },
  { chave: 'alu', nome: 'Aluguel', tipo: 'gasto', total: 220000, pctDaRenda: 0.324 },
  { chave: 'assinaturas', nome: 'Assinaturas', badge: 'todos os cartões', tipo: 'gasto', total: 23000, pctDaRenda: null },
];

it('renderiza nome, valor e % da renda quando presente', () => {
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={() => {}} />);
  expect(screen.getByText('Salário')).toBeInTheDocument();
  expect(screen.getByText('R$ 6.200,00')).toBeInTheDocument();
  expect(screen.getByText('32.4%')).toBeInTheDocument();
  expect(screen.getByText('todos os cartões')).toBeInTheDocument();
});

it('largura da barra reflete valor/base (escala compartilhada), arredondada a 2 casas', () => {
  const { container } = render(<ComposicaoBarChart linhas={linhas} base={620000} onClicarLinha={() => {}} />);
  const barras = container.querySelectorAll('.composicao-preenchimento');
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // 620000/620000
  expect((barras[1] as HTMLElement).style.width).toBe('35.48%'); // 220000/620000*100 = 35.483870...% -> 35.48%
});

it('clique numa linha chama onClicarLinha com a chave certa', async () => {
  const onClicarLinha = vi.fn();
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={onClicarLinha} />);
  await userEvent.click(screen.getByRole('button', { name: /Aluguel/ }));
  expect(onClicarLinha).toHaveBeenCalledWith('alu');
});

it('tecla Enter aciona a mesma ação do clique', async () => {
  const onClicarLinha = vi.fn();
  render(<ComposicaoBarChart linhas={linhas} base={680000} onClicarLinha={onClicarLinha} />);
  screen.getByRole('button', { name: /Salário/ }).focus();
  await userEvent.keyboard('{Enter}');
  expect(onClicarLinha).toHaveBeenCalledWith('sal');
});

it('mensagem de vazio quando não há linhas', () => {
  render(<ComposicaoBarChart linhas={[]} base={1} onClicarLinha={() => {}} />);
  expect(screen.getByText('Sem movimentos no mês.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/ComposicaoBarChart.test.tsx`
Expected: FAIL — não é possível resolver o módulo `./ComposicaoBarChart`.

- [ ] **Step 3: Implementar o componente**

Criar `src/ui/ComposicaoBarChart.tsx`:

```tsx
import { formatarBRL } from '../domain/money';
import type { TipoCategoria } from '../domain/types';

export interface LinhaComposicao {
  chave: string;
  nome: string;
  badge?: string;
  tipo: TipoCategoria;
  total: number;
  pctDaRenda: number | null;
}

interface Props {
  linhas: LinhaComposicao[];
  base: number;
  onClicarLinha: (chave: string) => void;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default function ComposicaoBarChart({ linhas, base, onClicarLinha }: Props) {
  return (
    <div className="composicao-lista">
      {linhas.map((l) => {
        const percentual = (Math.abs(l.total) / base) * 100;
        const largura = Math.min(100, Math.round(percentual * 100) / 100);
        return (
          <div
            key={l.chave}
            className="composicao-linha"
            role="button"
            tabIndex={0}
            onClick={() => onClicarLinha(l.chave)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClicarLinha(l.chave); }
            }}
          >
            <div className="composicao-rotulo">
              <span className="composicao-nome">
                {l.nome}
                {l.badge && <> <span className="badge">{l.badge}</span></>}
              </span>
              <span className="composicao-valores">
                {l.pctDaRenda != null && <span className="composicao-pct">{pct(l.pctDaRenda)}</span>}
                <strong className={l.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {formatarBRL(l.total)}
                </strong>
              </span>
            </div>
            <div className="composicao-trilho">
              <div
                className={`composicao-preenchimento ${l.tipo === 'ganho' ? 'ganho' : 'gasto'}`}
                style={{ width: `${largura}%` }}
              />
            </div>
          </div>
        );
      })}
      {linhas.length === 0 && <p className="sub">Sem movimentos no mês.</p>}
    </div>
  );
}
```

Adicionar ao fim de `src/styles.css`:

```css

/* ---- Composição por categoria (ComposicaoBarChart.tsx) ---- */
.composicao-lista { display: flex; flex-direction: column; gap: 10px; }
.composicao-linha { display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
.composicao-rotulo { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; }
.composicao-nome { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composicao-valores { display: flex; gap: 8px; align-items: baseline; flex-shrink: 0; }
.composicao-pct { color: var(--muted); font-size: 12px; }
.composicao-trilho { height: 14px; border-radius: 7px; background: var(--surface2); overflow: hidden; }
.composicao-preenchimento { height: 100%; border-radius: 7px; }
.composicao-preenchimento.ganho { background: var(--pos); }
.composicao-preenchimento.gasto { background: var(--neg); }
```

(`strong.valor-ganho`/`strong.valor-gasto` já perdem a pílula automaticamente — regra existente em `src/styles.css` linhas 130-133 — nenhuma mudança necessária ali.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/ComposicaoBarChart.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ComposicaoBarChart.tsx src/ui/ComposicaoBarChart.test.tsx src/styles.css
git commit -m "feat(ui): adiciona ComposicaoBarChart"
```

---

## Task 4: Componente — `EvolucaoMensalChart.tsx`

**Files:**
- Create: `src/ui/EvolucaoMensalChart.tsx`
- Test: `src/ui/EvolucaoMensalChart.test.tsx`
- Modify: `src/styles.css` (novo bloco ao fim do arquivo)

**Interfaces:**
- Consumes: `ResumoMesSimples` de `../domain/aggregations` (Task 1); `formatarSobraCompacta` de `../domain/money` (Task 2).
- Produces: componente `EvolucaoMensalChart({ serie: ResumoMesSimples[]; mesAtual: string })` — consumido por `TelaAnalises.tsx` (Task 7), sempre atrás de `React.lazy`/`Suspense` (é o único ponto que importa `recharts` neste conjunto de mudanças).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/EvolucaoMensalChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { ResumoMesSimples } from '../domain/aggregations';
import EvolucaoMensalChart from './EvolucaoMensalChart';

const serie: ResumoMesSimples[] = [
  { mes: '2026-06', ganhos: 700000, gastos: 610000, sobra: 90000 },
  { mes: '2026-07', ganhos: 680000, gastos: 493000, sobra: 187000 },
];

it('mostra a sobra de cada mês no formato compacto, com cor por sinal', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('+900')).toHaveClass('evolucao-sobra', 'pos');
  expect(screen.getByText('+1.870')).toHaveClass('evolucao-sobra', 'pos');
});

it('sobra negativa usa a classe neg', () => {
  const serieNegativa: ResumoMesSimples[] = [{ mes: '2026-07', ganhos: 100000, gastos: 250000, sobra: -150000 }];
  render(<EvolucaoMensalChart serie={serieNegativa} mesAtual="2026-07" />);
  expect(screen.getByText('−1.500')).toHaveClass('evolucao-sobra', 'neg');
});

it('mostra a legenda de ganhos, gastos e tendência', () => {
  render(<EvolucaoMensalChart serie={serie} mesAtual="2026-07" />);
  expect(screen.getByText('ganhos')).toBeInTheDocument();
  expect(screen.getByText('gastos')).toBeInTheDocument();
  expect(screen.getByText(/tend[êe]ncia/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/EvolucaoMensalChart.test.tsx`
Expected: FAIL — não é possível resolver o módulo `./EvolucaoMensalChart`.

- [ ] **Step 3: Implementar o componente**

Criar `src/ui/EvolucaoMensalChart.tsx`:

```tsx
import {
  Bar, ComposedChart, Line, ResponsiveContainer, XAxis,
} from 'recharts';
import type { ResumoMesSimples } from '../domain/aggregations';
import { formatarSobraCompacta } from '../domain/money';

interface Props {
  serie: ResumoMesSimples[];
  mesAtual: string;
}

interface TickProps {
  x: number;
  y: number;
  payload: { value: string };
}

function rotuloMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
}

export default function EvolucaoMensalChart({ serie, mesAtual }: Props) {
  return (
    <div>
      <div className="evolucao-rotulos-sobra">
        {serie.map((s) => (
          <span key={s.mes} className={`evolucao-sobra ${s.sobra >= 0 ? 'pos' : 'neg'}`}>
            {formatarSobraCompacta(s.sobra)}
          </span>
        ))}
      </div>
      <div className="evolucao-area">
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="mes"
              tick={({ x, y, payload }: TickProps) => {
                const ativo = payload.value === mesAtual;
                return (
                  <text
                    x={x} y={y + 12} textAnchor="middle" fontSize={11}
                    fontWeight={ativo ? 700 : 400} fill={ativo ? 'var(--fg)' : 'var(--muted)'}
                  >
                    {rotuloMes(payload.value)}
                  </text>
                );
              }}
              axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <Bar dataKey="ganhos" fill="var(--pos)" radius={[3, 3, 0, 0]} barSize={9} isAnimationActive={false} />
            <Bar dataKey="gastos" fill="var(--neg)" radius={[3, 3, 0, 0]} barSize={9} isAnimationActive={false} />
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

Adicionar ao fim de `src/styles.css`:

```css

/* ---- Evolução mensal (EvolucaoMensalChart.tsx) ---- */
.evolucao-rotulos-sobra { display: flex; padding: 0 4px; }
.evolucao-sobra { flex: 1; text-align: center; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.evolucao-sobra.pos { color: var(--pos); }
.evolucao-sobra.neg { color: var(--neg); }
.evolucao-area { height: 140px; }
.evolucao-legenda { display: flex; gap: 16px; justify-content: center; margin-top: 10px; font-size: 12px; color: var(--muted); }
.evolucao-legenda span { display: inline-flex; align-items: center; gap: 6px; }
.evolucao-legenda-cor { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.evolucao-legenda-cor.ganho { background: var(--pos); }
.evolucao-legenda-cor.gasto { background: var(--neg); }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/EvolucaoMensalChart.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/ui/EvolucaoMensalChart.tsx src/ui/EvolucaoMensalChart.test.tsx src/styles.css
git commit -m "feat(ui): adiciona EvolucaoMensalChart com linha de tendencia"
```

---

## Task 5: `TelaAnalises.tsx` — barrinhas ganho/gasto no card resumo

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`
- Modify: `src/styles.css`
- Test: `src/ui/TelaAnalises.test.tsx`

**Interfaces:**
- Produces: variável `base` (`const base = Math.max(resumo.totalGanhos, resumo.totalGastos, 1);`) no corpo de `TelaAnalises` — reutilizada pela Task 6.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/ui/TelaAnalises.test.tsx` (a função `render` de `@testing-library/react` já está importada no topo; usar a forma `const { container } = render(...)`):

```tsx
it('mostra barrinhas de ganho/gasto no card resumo, na mesma escala (maior = 100%)', async () => {
  const { box } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  const catAluguel = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 200000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catAluguel.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  const { container } = render(<TelaAnalises />);
  const barras = container.querySelectorAll('.resumo-barra-preenchimento');
  expect(barras).toHaveLength(2);
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // ganho é o maior -> base
  expect((barras[1] as HTMLElement).style.width).toBe('50%'); // gasto é metade do ganho
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx -t "barrinhas de ganho"`
Expected: FAIL — `container.querySelectorAll('.resumo-barra-preenchimento')` retorna lista vazia (`toHaveLength(2)` falha).

- [ ] **Step 3: Implementar**

Em `src/ui/TelaAnalises.tsx`, logo depois da linha `const resumo = resumoMensal(mes, ids, dados.categorias, dados.lancamentos, incluirPrevistos);`, adicionar:

```tsx
  const base = Math.max(resumo.totalGanhos, resumo.totalGastos, 1);
```

Substituir o card resumo (bloco `<div className="card"> <div className="linha" style={{ justifyContent: 'space-between' }}> ... </div> </div>` — o primeiro card do `return`, com Ganhos/Gastos/Sobra) por:

```tsx
      <div className="card">
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span>Ganhos <strong className="valor-ganho">{formatarBRL(resumo.totalGanhos)}</strong></span>
          <span>Gastos <strong className="valor-gasto">{formatarBRL(resumo.totalGastos)}</strong></span>
          <span>Sobra <strong className={resumo.sobra >= 0 ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(resumo.sobra)}</strong></span>
        </div>
        <div className="resumo-barras">
          <div className="resumo-barra-trilho">
            <div className="resumo-barra-preenchimento ganho" style={{ width: `${Math.round((resumo.totalGanhos / base) * 10000) / 100}%` }} />
          </div>
          <div className="resumo-barra-trilho">
            <div className="resumo-barra-preenchimento gasto" style={{ width: `${Math.round((resumo.totalGastos / base) * 10000) / 100}%` }} />
          </div>
        </div>
      </div>
```

(`Math.round(x * 10000) / 100` arredonda a porcentagem a 2 casas decimais — mesma técnica usada em `ComposicaoBarChart.tsx`, Task 3 — para não gerar `style.width` com dízima longa tipo `35.483870967741936%`.)

Em `src/styles.css`, logo depois do bloco (linhas 129-133 do arquivo atual):

```css
/* em tabelas e em texto corrido (ex.: rótulo do dia no Fluxo), só a cor — sem pílula */
.tabela .valor-ganho, .tabela .valor-gasto,
strong.valor-ganho, strong.valor-gasto {
  background: none; padding: 0; border-radius: 0;
}
```

adicionar:

```css

.resumo-barras { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.resumo-barra-trilho { height: 8px; border-radius: 999px; background: var(--surface2); overflow: hidden; }
.resumo-barra-preenchimento { height: 100%; border-radius: 999px; }
.resumo-barra-preenchimento.ganho { background: var(--pos); }
.resumo-barra-preenchimento.gasto { background: var(--neg); }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS (todos os testes do arquivo, incluindo o novo — os demais ainda não devem ter quebrado nada, pois nada mais mudou de estrutura ainda).

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/styles.css src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): barrinhas ganho/gasto no card resumo"
```

---

## Task 6: `TelaAnalises.tsx` — troca a tabela "Por categoria" por `ComposicaoBarChart`

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`

**Interfaces:**
- Consumes: `base` da Task 5; `ComposicaoBarChart`/`LinhaComposicao` da Task 3.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/ui/TelaAnalises.test.tsx`:

```tsx
it('barra da composição usa a mesma escala do card resumo (maior entre ganhos e gastos)', async () => {
  const { box } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  const catAluguel = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 400000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catAluguel.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  const { container } = render(<TelaAnalises />);
  const barras = container.querySelectorAll('.composicao-preenchimento');
  expect((barras[0] as HTMLElement).style.width).toBe('100%'); // salario: 400000/400000 (base = maior dos dois)
  expect((barras[1] as HTMLElement).style.width).toBe('25%'); // aluguel: 100000/400000
});
```

Este teste é **adicional** — os 6 testes já existentes no arquivo (`clicar numa linha da tabela abre o sheet...`, `trocar o mês com o sheet aberto...`, `clicar na categoria do cartão...`, `linha Assinaturas soma...`, `linha da viagem aparece...`, `linha da viagem não aparece...`) continuam válidos sem alteração: todos usam `screen.getByRole('button', { name: /.../ })` e `within(linha).getByText(...)`, que não dependem da linha ser um `<tr>` — um `<div role="button">` satisfaz a mesma query.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx -t "mesma escala"`
Expected: FAIL — `container.querySelectorAll('.composicao-preenchimento')` retorna lista vazia.

- [ ] **Step 3: Implementar**

Em `src/ui/TelaAnalises.tsx`, atualizar os imports do topo:

```tsx
import { Suspense, lazy, useState } from 'react';
import { compararMeses, mediaMovel3, resumoMensal, serieMensal } from '../domain/aggregations';
import { addMeses, formatarDataBR, mesDe } from '../domain/dates';
import { resumoAssinaturasDoMes } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { ID, Viagem } from '../domain/types';
import { itensDaViagem, totalViagemNoMes } from '../domain/viagem';
import { boxIdsSelecionadas, useApp } from '../state/store';
import AssinaturasResumoSheet from './AssinaturasResumoSheet';
import ComposicaoBarChart, { type LinhaComposicao } from './ComposicaoBarChart';
import FaturaCategoriaSheet from './FaturaCategoriaSheet';
import LancamentosSheet from './LancamentosSheet';
import ViagemSheet from './ViagemSheet';
```

(`Suspense`/`lazy` só serão usados na Task 7, mas já entram aqui porque tocam a mesma linha de import — evita um segundo diff nela.)

Remover a função `pct` (linhas 18-20 do arquivo original — `function pct(x: number | null): string { return x == null ? '—' : ...; }`). Ela só era usada dentro da tabela "Por categoria" que está sendo removida; a mesma lógica já existe, adaptada, dentro de `ComposicaoBarChart.tsx` (Task 3).

Logo depois da linha `const viagensNoMes = dados.viagens.map(...).filter((x) => x.total !== 0);` (e antes de `const viagensComTotal = ...`), adicionar:

```tsx
  const linhasComposicao: LinhaComposicao[] = [
    ...resumo.linhas.map((l) => ({
      chave: l.categoriaId, nome: l.nome, tipo: l.tipo, total: l.total, pctDaRenda: l.pctDaRenda,
    })),
    ...(resumoAssinaturas.totalCent > 0
      ? [{
        chave: 'assinaturas', nome: 'Assinaturas', badge: 'todos os cartões',
        tipo: 'gasto' as const, total: resumoAssinaturas.totalCent, pctDaRenda: null,
      }]
      : []),
    ...viagensNoMes.map(({ viagem, total }) => ({
      chave: `viagem:${viagem.id}`,
      nome: `viagem - ${formatarDataBR(viagem.dataInicio)} ~ ${formatarDataBR(viagem.dataFim)}`,
      tipo: 'gasto' as const, total, pctDaRenda: null,
    })),
  ];

  function abrirComposicao(chave: string) {
    if (chave === 'assinaturas') { setAssinaturasAberto(true); return; }
    if (chave.startsWith('viagem:')) {
      const viagem = dados.viagens.find((v) => v.id === chave.slice('viagem:'.length));
      if (viagem) setViagemAberta(viagem);
      return;
    }
    setCategoriaAberta(chave);
  }
```

Substituir o card "Por categoria" inteiro (o `<div className="card rolavel"> <h2>Por categoria</h2> <table className="tabela">...</table> </div>`) por:

```tsx
      <div className="card">
        <h2>Por categoria</h2>
        <p className="sub" style={{ margin: '-4px 0 0' }}>
          barras na mesma escala do card acima (100% = maior entre ganhos e gastos do mês)
        </p>
        <ComposicaoBarChart linhas={linhasComposicao} base={base} onClicarLinha={abrirComposicao} />
      </div>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS — **todos** os testes do arquivo, incluindo os 6 pré-existentes que não foram tocados. Se algum pré-existente falhar, não reescreva o teste: a causa provável é a estrutura de `linhasComposicao`/`abrirComposicao` não reproduzir exatamente o texto/comportamento anterior — revise contra a tabela original antes de mudar qualquer asserção.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): composicao por categoria em barras substitui a tabela"
```

---

## Task 7: `TelaAnalises.tsx` — novo card "Evolução mensal"

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`

**Interfaces:**
- Consumes: `serieMensalResumo` (Task 1), `EvolucaoMensalChart` (Task 4), `meses` (já existente no componente, calculado para a média móvel).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/ui/TelaAnalises.test.tsx`:

```tsx
it('mostra o card Evolução mensal com a sobra do mês selecionado', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  const catSalario = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-05', valor: 500000, status: 'efetivo' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-10', valor: 100000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  expect(await screen.findByText('Evolução mensal')).toBeInTheDocument();
  expect(await screen.findByText('+4.000')).toBeInTheDocument(); // sobra de julho: 500000-100000 centavos = R$4.000,00
});
```

(`screen.findByText` porque `EvolucaoMensalChart` é carregado via `React.lazy`/`Suspense` — a asserção precisa esperar o chunk resolver.)

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx -t "Evolução mensal"`
Expected: FAIL — `findByText('Evolução mensal')` nunca encontra o texto (timeout).

- [ ] **Step 3: Implementar**

Em `src/ui/TelaAnalises.tsx`, logo depois da linha de import `import ViagemSheet from './ViagemSheet';`, adicionar:

```tsx

const EvolucaoMensalChart = lazy(() => import('./EvolucaoMensalChart'));
```

Logo depois da linha `const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));`, adicionar:

```tsx
  const serieEvolucao = serieMensalResumo(meses, ids, dados.categorias, dados.lancamentos, incluirPrevistos);
```

Atualizar o import de `../domain/aggregations` (feito na Task 6) para incluir `serieMensalResumo`:

```tsx
import {
  compararMeses, mediaMovel3, resumoMensal, serieMensal, serieMensalResumo,
} from '../domain/aggregations';
```

Inserir o novo card logo depois do card "Por categoria" (da Task 6) e antes do card "Viagens":

```tsx
      <div className="card">
        <h2>Evolução mensal</h2>
        <Suspense fallback={null}>
          <EvolucaoMensalChart serie={serieEvolucao} mesAtual={mes} />
        </Suspense>
      </div>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS — todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(analises): card Evolucao mensal com grafico carregado sob demanda"
```

---

## Task 8: Tabela "Comparativo" — coluna fixa sem vazamento, título fora do scroll

**Files:**
- Modify: `src/ui/TelaAnalises.tsx`
- Modify: `src/styles.css`
- Test: `src/ui/TelaAnalises.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `src/ui/TelaAnalises.test.tsx`:

```tsx
it('título Comparativo fica fora do container que rola horizontalmente', async () => {
  const { box, catPix } = await seedBoxComCategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catPix.id, data: '2026-07-05', valor: 30000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  const titulo = screen.getByText('Comparativo');
  expect(titulo.closest('.rolavel')).toBeNull();
  expect(screen.getByRole('table').closest('.rolavel')).not.toBeNull();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx -t "fora do container"`
Expected: FAIL — `titulo.closest('.rolavel')` não é `null` (hoje o `<h2>` está dentro do mesmo `.card.rolavel` que a tabela).

- [ ] **Step 3: Implementar**

Em `src/ui/TelaAnalises.tsx`, substituir o card "Comparativo" (o último card antes dos sheets no `return`, `<div className="card rolavel"> <h2>Comparativo</h2> <table className="tabela">...</table> </div>`) por:

```tsx
      <div className="card">
        <h2>Comparativo</h2>
        <div className="rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Categoria</th><th>{mes}</th><th>mês anterior</th><th>ano passado</th><th>média 3m</th></tr>
            </thead>
            <tbody>
              {comparativo.map((c) => {
                const media = media3m(c.categoriaId);
                return (
                  <tr key={c.categoriaId}>
                    <td>{c.nome}</td>
                    <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.atual)}</td>
                    <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.mesAnterior)}</td>
                    <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{formatarBRL(c.anoAnterior)}</td>
                    <td className={c.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>{media == null ? '—' : formatarBRL(media)}</td>
                  </tr>
                );
              })}
              {comparativo.length === 0 && <tr><td colSpan={5}>Sem dados para comparar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
```

Em `src/styles.css`, substituir o bloco (linhas 180-188 do arquivo atual):

```css
table.tabela { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
table.tabela th {
  color: var(--muted); font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .04em;
}
table.tabela th, table.tabela td { text-align: right; padding: 8px; border-bottom: 1px solid var(--line); }
table.tabela th:first-child, table.tabela td:first-child { text-align: left; }
table.tabela tr:last-child td { border-bottom: none; }
.rolavel { overflow-x: auto; }
```

por:

```css
/* width:max-content + min-width:100% (não width:100% fixo) — com width:100%, assim que a
   1ª coluna passou a aceitar quebra de linha (coluna fixa, ver abaixo), o motor de auto-layout
   comprime as colunas de valor (nowrap, alinhadas à direita) abaixo do conteúdo delas; texto
   alinhado à direita que não cabe vaza para a ESQUERDA, ou seja, por trás da coluna fixa.
   border-collapse:separate (não collapse) evita outro bug conhecido: position:sticky numa
   <td> com border-collapse:collapse não cobre direito o conteúdo que rola por baixo. */
table.tabela {
  width: max-content; min-width: 100%;
  border-collapse: separate; border-spacing: 0;
  font-variant-numeric: tabular-nums;
}
table.tabela th {
  color: var(--muted); font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .04em;
}
table.tabela th, table.tabela td {
  text-align: right; padding: 8px 13px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
table.tabela th:first-child, table.tabela td:first-child { text-align: left; }
table.tabela tr:last-child td { border-bottom: none; }
/* coluna fixa: largura própria fixa (não automática) — mantém o cálculo de largura das
   outras colunas previsível. Sombra sutil na borda direita sinaliza que ela "flutua na
   frente" do conteúdo que rola por baixo. */
table.tabela th:first-child, table.tabela td:first-child {
  position: sticky; left: 0; z-index: 2; background: var(--surface);
  white-space: normal; width: 112px; max-width: 112px;
  box-shadow: 4px 0 6px -4px rgba(0, 0, 0, .45);
}
/* min-width:0 evita que a tabela force o card (flex item) a crescer além do container;
   overflow-anchor:none evita que o navegador ajuste sozinho a rolagem quando a altura de
   uma célula muda (nome de categoria quebrando em linhas) depois do layout inicial. */
.rolavel { overflow-x: auto; min-width: 0; overflow-anchor: none; }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaAnalises.test.tsx`
Expected: PASS — todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/TelaAnalises.tsx src/styles.css src/ui/TelaAnalises.test.tsx
git commit -m "fix(analises): coluna fixa do Comparativo sem vazar conteudo, titulo fora do scroll"
```

---

## Task 9: Catalogar os componentes novos

**Files:**
- Modify: `docs/estilo/catalogo.md`

- [ ] **Step 1: Adicionar entradas em "Componentes compartilhados"**

Em `docs/estilo/catalogo.md`, ao fim da seção "## Componentes compartilhados (em `src/ui/`)", depois da linha `AssinaturasResumoSheet.tsx`, adicionar:

```md
- **`ComposicaoBarChart.tsx`** — barras horizontais de composição por categoria na aba
  Análises (substitui a antiga tabela "Por categoria"); escala compartilhada com as
  barrinhas do card resumo (`base = max(totalGanhos, totalGastos)`), mesmo contrato de
  acessibilidade (`role="button"` por linha) que a tabela anterior usava.
- **`EvolucaoMensalChart.tsx`** — evolução de ganho/gasto/sobra dos últimos 6 meses na aba
  Análises: barras agrupadas + linha de tendência tracejada, via `recharts` carregado sob
  demanda (`React.lazy`), mesmo padrão do `FluxoChartModal`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/estilo/catalogo.md
git commit -m "docs(catalogo): cataloga ComposicaoBarChart e EvolucaoMensalChart"
```

---

## Task 10: Suíte completa, build e fragmento de changelog

**Files:**
- Create: `changelog.d/adicionado-graficos-analises.md`

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes passam (nenhuma regressão em outras telas — nenhuma delas depende de `.tabela`/`.rolavel`, únicas classes alteradas fora dos componentes novos).

- [ ] **Step 2: Rodar o build**

Run: `npm run build`
Expected: `tsc -b && vite build` conclui sem erro de tipo (checar em especial `EvolucaoMensalChart.tsx` — props do `tick` do recharts e o import `type` de `ResumoMesSimples`/`LinhaComposicao`).

- [ ] **Step 3: Criar o fragmento de changelog**

Criar `changelog.d/adicionado-graficos-analises.md`:

```md
- Gráficos na aba Análises: composição por categoria em barras, evolução dos últimos 6 meses (ganho, gasto e sobra) com linha de tendência, e barrinhas de ganho/gasto no card resumo.
- Primeira coluna da tabela Comparativo fica fixa ao rolar horizontalmente no celular, sem cortar nomes de categoria longos.
```

- [ ] **Step 4: Commit**

```bash
git add changelog.d/adicionado-graficos-analises.md
git commit -m "docs(changelog): fragmento dos graficos da aba Analises"
```

- [ ] **Step 5: Reportar ao orquestrador**

Este é o fim do plano de implementação. **Não mesclar em `main`, não rodar `npm run release`, não fazer `npm run deploy`** — por regra do `CLAUDE.md`, a integração fica bloqueada até o usuário confirmar literalmente a revisão do fragmento de changelog (Step 3). Pare aqui e reporte ao orquestrador/usuário com o conteúdo do fragmento para aprovação.

---

## Plan Self-Review

**Cobertura da spec:** seção 1 (Task 5), seção 2 (Tasks 3 e 6), seção 3 (Tasks 1, 2, 4 e 7), seção 4 (Task 8), catálogo (Task 9), mockup aprovado + changelog (Task 10). Nenhuma seção da spec ficou sem task correspondente.

**Desvio da spec original registrado aqui:** a spec (seção 2) sugeria `recharts` para `ComposicaoBarChart`; a Task 3 usa divs simples em vez disso, para preservar o contrato de acessibilidade (`role="button"` + texto interno) que `TelaAnalises.test.tsx` já usa em 6 testes existentes — reproduzir isso dentro do `recharts` exigiria customizar o `shape` de cada barra individualmente, sem ganho real (o gráfico não precisa de eixo/tooltip/zoom do recharts, só de barras clicáveis). `EvolucaoMensalChart` (Task 4) usa `recharts` normalmente, como a spec pede, pois não tem esse requisito de acessibilidade por-linha.
