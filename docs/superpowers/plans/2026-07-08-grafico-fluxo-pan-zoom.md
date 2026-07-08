# Pan/zoom no gráfico expandido da aba Fluxo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir, ao clicar no card do gráfico de saldo na aba Fluxo, um modal em tela cheia
com o mesmo gráfico navegável por clique-e-arraste (seleciona um dia), clique-duplo-e-arraste
(pan) e pinça/scroll (zoom).

**Architecture:** Componente novo `FluxoChartModal.tsx`, carregado sob demanda
(`React.lazy`), usando `recharts` para desenhar um `<AreaChart>` alimentado por uma fatia
(`janela`) da série já calculada em `TelaFluxo`. Toda a matemática de janela (clamp, pan,
zoom ancorado) vive num módulo puro `chartGestures.ts`, testável sem DOM. Os gestos (wheel,
pointer down/move/up/cancel) só traduzem eventos em chamadas a essas funções puras.

**Tech Stack:** React 18 + TypeScript, `recharts` (nova dependência), Vitest +
Testing Library (jsdom).

## Global Constraints

- Specs de referência: `docs/superpowers/specs/2026-07-05-grafico-fluxo-expandido-design.md`
  (base) e `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md` (esta,
  substitui a seção de gestos daquela).
- Guia de estilo obrigatório: `docs/estilo-visual.md` — dark-only, classes em português,
  reaproveitar `.saldo-grande`/`.sub`/tokens de `:root` antes de inventar classe nova, ícones
  via `lucide-react` (`size={18}` padrão), CSS sempre em `src/styles.css` (nunca cor/raio/fonte
  inline).
- Valores monetários: sempre em centavos (inteiro) na camada de domínio;
  `formatarBRL` (`src/domain/money.ts`) só na borda de exibição. **Nunca hardcode strings
  `"R$ ..."` em teste** — `toLocaleString('pt-BR')` usa espaço não-separável (U+00A0) após
  "R$"; construa o valor esperado chamando `formatarBRL` no próprio teste.
- Datas: `ISODate` é sempre string `"AAAA-MM-DD"` (`src/domain/types.ts`). Usar
  `addDias`/`diasEntre` de `src/domain/dates.ts` para aritmética de datas em vez de `Date` cru,
  exceto para extrair nome do dia da semana (`toLocaleDateString('pt-BR', {weekday:'short'})`),
  que já é o padrão usado em `TelaFluxo.tsx`.
- `serie: DiaSaldo[]` (de `projetarBoxes`, `src/domain/projection.ts`) é sempre ordenada por
  data, um item por dia, sem buracos — índices são estáveis e contíguos.
- jsdom (ambiente de teste, `vite.config.ts`) **não implementa** `ResizeObserver` nem
  `Element.prototype.setPointerCapture` — qualquer código que os use precisa de guarda
  (`?.()`) ou de um polyfill em `src/test-setup.ts`.
- Zoom mínimo: 14 dias visíveis (`JANELA_DIAS_MIN` em `chartGestures.ts`). Zoom máximo: a
  série inteira. Nunca hardcode esse limite em mais de um lugar.

---

### Task 1: Adicionar a dependência `recharts`

**Files:**
- Modify: `package.json`, `package-lock.json` (gerados pelo `npm install`)

**Interfaces:**
- Produces: pacote `recharts` disponível para import em qualquer arquivo `.tsx` do projeto.

- [ ] **Step 1: Instalar o pacote**

Run: `npm install recharts`
Expected: `package.json` ganha `"recharts": "^2.x.x"` em `dependencies`;
`package-lock.json` é atualizado; comando termina sem erro.

- [ ] **Step 2: Confirmar que nada quebrou**

Run: `npm test`
Expected: mesma contagem de testes passando de antes (nenhum teste novo ainda, só a
dependência instalada).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: adiciona recharts para o grafico expandido da aba Fluxo"
```

---

### Task 2: `chartGestures.ts` — matemática pura de janela/pan/zoom

**Files:**
- Create: `src/ui/chartGestures.ts`
- Test: `src/ui/chartGestures.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Janela { inicioIdx: number; fimIdx: number }
  const JANELA_DIAS_MIN: number; // = 14
  function clampJanela(janela: Janela, tamanhoSerie: number, larguraMin?: number): Janela;
  function janelaInicial(hojeIdx: number, tamanhoSerie: number, meiaLargura?: number): Janela;
  function panJanela(janela: Janela, deltaIdx: number, tamanhoSerie: number): Janela;
  function zoomJanela(janela: Janela, fator: number, ancoraIdx: number, tamanhoSerie: number, larguraMin?: number): Janela;
  ```
  Consumido por `FluxoChartModal.tsx` (Tasks 3 e 4).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/ui/chartGestures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  JANELA_DIAS_MIN, clampJanela, janelaInicial, panJanela, zoomJanela,
} from './chartGestures';

describe('clampJanela', () => {
  it('mantém uma janela já válida inalterada', () => {
    expect(clampJanela({ inicioIdx: 10, fimIdx: 30 }, 100)).toEqual({ inicioIdx: 10, fimIdx: 30 });
  });

  it('encolhe a janela para caber numa série mais curta que o mínimo de zoom', () => {
    expect(clampJanela({ inicioIdx: 0, fimIdx: 20 }, 5)).toEqual({ inicioIdx: 0, fimIdx: 4 });
  });

  it('empurra a janela para dentro dos limites quando o início é negativo', () => {
    expect(clampJanela({ inicioIdx: -10, fimIdx: 10 }, 100)).toEqual({ inicioIdx: 0, fimIdx: 20 });
  });

  it('empurra a janela para dentro dos limites quando o fim passa do tamanho da série', () => {
    expect(clampJanela({ inicioIdx: 90, fimIdx: 120 }, 100)).toEqual({ inicioIdx: 69, fimIdx: 99 });
  });
});

describe('janelaInicial', () => {
  it('abre com 30 dias antes e 30 depois de hoje', () => {
    expect(janelaInicial(100, 300)).toEqual({ inicioIdx: 70, fimIdx: 130 });
  });

  it('abre com a série inteira quando ela é mais curta que a janela padrão', () => {
    expect(janelaInicial(20, 40)).toEqual({ inicioIdx: 0, fimIdx: 39 });
  });
});

describe('panJanela', () => {
  it('desloca a janela mantendo o mesmo tamanho', () => {
    expect(panJanela({ inicioIdx: 20, fimIdx: 40 }, 5, 100)).toEqual({ inicioIdx: 25, fimIdx: 45 });
  });

  it('não deixa a janela passar do início da série', () => {
    expect(panJanela({ inicioIdx: 5, fimIdx: 25 }, -20, 100)).toEqual({ inicioIdx: 0, fimIdx: 20 });
  });

  it('não deixa a janela passar do fim da série', () => {
    expect(panJanela({ inicioIdx: 70, fimIdx: 90 }, 20, 100)).toEqual({ inicioIdx: 79, fimIdx: 99 });
  });
});

describe('zoomJanela', () => {
  it('reduz a janela ao dar zoom in, mantendo a âncora dentro do intervalo', () => {
    const janela = zoomJanela({ inicioIdx: 0, fimIdx: 100 }, 0.5, 50, 200);
    expect(janela.fimIdx - janela.inicioIdx).toBe(50);
    expect(janela.inicioIdx).toBeLessThanOrEqual(50);
    expect(janela.fimIdx).toBeGreaterThanOrEqual(50);
  });

  it('não deixa o zoom in passar do mínimo de dias configurado', () => {
    const janela = zoomJanela({ inicioIdx: 40, fimIdx: 60 }, 0.01, 50, 200);
    expect(janela.fimIdx - janela.inicioIdx).toBe(JANELA_DIAS_MIN - 1);
  });

  it('não deixa o zoom out passar do tamanho da série inteira', () => {
    const janela = zoomJanela({ inicioIdx: 40, fimIdx: 60 }, 100, 50, 80);
    expect(janela).toEqual({ inicioIdx: 0, fimIdx: 79 });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/chartGestures.test.ts`
Expected: FAIL — `Cannot find module './chartGestures'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `chartGestures.ts`**

Criar `src/ui/chartGestures.ts`:

```ts
export interface Janela {
  inicioIdx: number;
  fimIdx: number;
}

/** Zoom mínimo: a janela nunca fica mais estreita que este número de dias. */
export const JANELA_DIAS_MIN = 14;

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Garante que a janela caiba em `[0, tamanhoSerie - 1]` e não fique mais estreita que
 *  `larguraMin` dias (nem mais larga que a série inteira). */
export function clampJanela(
  janela: Janela, tamanhoSerie: number, larguraMin: number = JANELA_DIAS_MIN,
): Janela {
  const maxLen = Math.max(0, tamanhoSerie - 1);
  const minLen = Math.min(larguraMin - 1, maxLen);
  const len = clampInt(janela.fimIdx - janela.inicioIdx, minLen, maxLen);
  const inicioIdx = clampInt(janela.inicioIdx, 0, maxLen - len);
  return { inicioIdx, fimIdx: inicioIdx + len };
}

/** Janela padrão ao abrir o modal: `meiaLargura` dias antes e depois de hoje, clampada aos
 *  limites da série (série mais curta que a janela padrão abre inteira). */
export function janelaInicial(hojeIdx: number, tamanhoSerie: number, meiaLargura = 30): Janela {
  return clampJanela({ inicioIdx: hojeIdx - meiaLargura, fimIdx: hojeIdx + meiaLargura }, tamanhoSerie);
}

/** Desloca a janela em `deltaIdx` posições, mantendo a mesma largura, sem sair de
 *  `[0, tamanhoSerie - 1]`. */
export function panJanela(janela: Janela, deltaIdx: number, tamanhoSerie: number): Janela {
  const largura = janela.fimIdx - janela.inicioIdx + 1;
  return clampJanela(
    { inicioIdx: janela.inicioIdx + deltaIdx, fimIdx: janela.fimIdx + deltaIdx },
    tamanhoSerie,
    largura,
  );
}

/** Redimensiona a janela por `fator` (< 1 aproxima/zoom in, > 1 afasta/zoom out), mantendo
 *  `ancoraIdx` estável (o mesmo ponto sob o cursor/dedo antes e depois do zoom). */
export function zoomJanela(
  janela: Janela, fator: number, ancoraIdx: number, tamanhoSerie: number,
  larguraMin: number = JANELA_DIAS_MIN,
): Janela {
  const oldLen = janela.fimIdx - janela.inicioIdx;
  const maxLen = Math.max(0, tamanhoSerie - 1);
  const newLen = clampInt(oldLen * fator, larguraMin - 1, maxLen);
  const f = oldLen > 0 ? (ancoraIdx - janela.inicioIdx) / oldLen : 0.5;
  const inicioIdx = ancoraIdx - f * newLen;
  return clampJanela({ inicioIdx, fimIdx: inicioIdx + newLen }, tamanhoSerie, larguraMin);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/chartGestures.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/chartGestures.ts src/ui/chartGestures.test.ts
git commit -m "feat(ui): matematica pura de janela/pan/zoom para o grafico expandido"
```

---

### Task 3: `FluxoChartModal.tsx` — estrutura estática, estado e o gráfico Recharts

**Files:**
- Create: `src/ui/FluxoChartModal.tsx`
- Test: `src/ui/FluxoChartModal.test.tsx`
- Modify: `src/styles.css` (novas classes `.grafico-expandido*`)
- Modify: `src/test-setup.ts` (polyfill de `ResizeObserver`, necessário pro Recharts)

**Interfaces:**
- Consumes: `DiaSaldo` (`src/domain/projection.ts`), `ISODate` (`src/domain/types.ts`),
  `formatarBRL` (`src/domain/money.ts`), `Janela`/`janelaInicial`/`clampJanela` (Task 2).
- Produces:
  ```ts
  interface Props {
    serie: DiaSaldo[];
    hoje: ISODate;
    mostrarCenarios: boolean;
    onFechar: () => void;
  }
  export default function FluxoChartModal(props: Props): JSX.Element;
  ```
  Consumido por `TelaFluxo.tsx` (Task 5). Testes usam `data-testid`:
  `grafico-expandido-periodo`, `grafico-expandido-leitura-data`, `grafico-expandido-area`
  (este último só passa a existir de fato nesta task, mas os gestos que o usam são da Task 4).

- [ ] **Step 1: Polyfill de `ResizeObserver` no setup de testes**

jsdom não implementa `ResizeObserver`, que o `ResponsiveContainer` do Recharts usa
internamente. Editar `src/test-setup.ts`, adicionando ao final:

```ts
// jsdom não implementa ResizeObserver; Recharts (ResponsiveContainer) usa internamente
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
```

- [ ] **Step 2: Escrever os testes (falhando)**

Criar `src/ui/FluxoChartModal.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import FluxoChartModal from './FluxoChartModal';

const BASE = '2026-01-01';
const N = 120;
const HOJE_IDX = 60;

function ddmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function serieDeTeste(): DiaSaldo[] {
  const dias: DiaSaldo[] = [];
  for (let i = 0; i < N; i++) {
    const data = addDias(BASE, i);
    const saldo = 100000 + i * 1000; // centavos
    dias.push({ data, saldoEfetivo: saldo, saldoProjetado: saldo, saldoComCenarios: saldo - 500000 });
  }
  return dias;
}

const serie = serieDeTeste();
const hoje = serie[HOJE_IDX].data;

describe('FluxoChartModal', () => {
  it('abre com o rótulo de período cobrindo 30 dias antes e depois de hoje', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const esperado = `${ddmm(serie[HOJE_IDX - 30].data)} – ${ddmm(serie[HOJE_IDX + 30].data)}`;
    expect(screen.getByTestId('grafico-expandido-periodo')).toHaveTextContent(esperado);
  });

  it('a leitura inicial mostra o saldo e a data de hoje', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    expect(screen.getByText(formatarBRL(serie[HOJE_IDX].saldoEfetivo))).toBeInTheDocument();
    expect(screen.getByTestId('grafico-expandido-leitura-data')).toHaveTextContent('· hoje');
  });

  it('o rodapé mostra mín/máx da janela visível, não da série inteira', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const min = serie[HOJE_IDX - 30].saldoProjetado;
    const max = serie[HOJE_IDX + 30].saldoProjetado;
    expect(screen.getByText(`mín ${formatarBRL(min)} · máx ${formatarBRL(max)}`)).toBeInTheDocument();
  });

  it('clicar no X chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('a tecla Escape chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('clicar dentro do modal fora do botão X não chama onFechar', () => {
    const onFechar = vi.fn();
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={onFechar} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('sem cenário ligado, a legenda não aparece', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    expect(screen.queryByText('Cenário')).not.toBeInTheDocument();
  });

  it('com cenário ligado, a legenda aparece', () => {
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios onFechar={() => {}} />);
    expect(screen.getByText('Cenário')).toBeInTheDocument();
    expect(screen.getByText('Real')).toBeInTheDocument();
    expect(screen.getByText('Projetado')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/FluxoChartModal.test.tsx`
Expected: FAIL — `Cannot find module './FluxoChartModal'`.

- [ ] **Step 4: Adicionar as classes CSS**

Editar `src/styles.css`, adicionando ao final:

```css
/* ---- Gráfico expandido (FluxoChartModal) ---- */
.grafico-expandido {
  position: fixed; inset: 0; z-index: 50; background: var(--bg);
  display: flex; flex-direction: column; gap: 14px;
  padding: calc(14px + env(safe-area-inset-top)) 16px calc(14px + env(safe-area-inset-bottom));
}
.grafico-expandido-cabecalho { display: flex; align-items: center; justify-content: center; position: relative; min-height: 32px; }
.grafico-expandido-periodo { font-size: 13px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
.grafico-expandido-fechar {
  position: absolute; right: 0; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; border-radius: 999px; border: none;
  background: var(--surface2); color: var(--fg);
  display: flex; align-items: center; justify-content: center;
}
.grafico-expandido-leitura { display: flex; flex-direction: column; gap: 2px; }
.grafico-expandido-area {
  flex: 1; min-height: 0; position: relative; touch-action: none; cursor: grab; user-select: none;
}
.grafico-expandido-area:active { cursor: grabbing; }
.grafico-expandido-legenda { display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 12px; color: var(--muted); }
.grafico-expandido-legenda span { display: inline-flex; align-items: center; gap: 6px; }
.grafico-expandido-legenda i { width: 16px; height: 0; display: inline-block; border-top-style: solid; }
.grafico-expandido-legenda .real i { border-color: var(--pos); border-top-width: 2px; }
.grafico-expandido-legenda .proj i { border-color: var(--pos); border-top-style: dashed; border-top-width: 2px; }
.grafico-expandido-legenda .cen i { border-color: var(--ac); border-top-style: dotted; border-top-width: 3px; }
.grafico-expandido-rodape { text-align: center; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.grafico-expandido-abrir { border: none; width: 100%; text-align: left; position: relative; }
.grafico-expandido-icone { position: absolute; top: 16px; right: 16px; color: var(--muted); }
```

- [ ] **Step 5: Implementar `FluxoChartModal.tsx` (sem gestos ainda)**

Criar `src/ui/FluxoChartModal.tsx`:

```tsx
import { useEffect, useId, useState } from 'react';
import {
  Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import { janelaInicial, type Janela } from './chartGestures';

interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  mostrarCenarios: boolean;
  onFechar: () => void;
}

function ddmm(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function semana(d: ISODate): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
}

export default function FluxoChartModal({ serie, hoje, mostrarCenarios, onFechar }: Props) {
  const uid = useId();
  const hojeIdxBruto = serie.findIndex((s) => s.data >= hoje);
  const hojeIdx = hojeIdxBruto === -1 ? serie.length - 1 : hojeIdxBruto;
  const hojeData = serie[hojeIdx].data;

  const [janela, setJanela] = useState<Janela>(() => janelaInicial(hojeIdx, serie.length));
  const [selecionado, setSelecionado] = useState<ISODate>(hojeData);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const serieVisivel = serie.slice(janela.inicioIdx, janela.fimIdx + 1);
  const valores: number[] = [];
  serieVisivel.forEach((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    valores.push(s.saldoProjetado);
    if (mostrarCenarios) valores.push(s.saldoComCenarios);
    if (idxGlobal <= hojeIdx) valores.push(s.saldoEfetivo);
  });
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);

  const pontos = serieVisivel.map((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    return {
      data: s.data,
      passado: idxGlobal <= hojeIdx ? s.saldoEfetivo : null,
      futuro: idxGlobal >= hojeIdx ? s.saldoProjetado : null,
      cenario: mostrarCenarios && idxGlobal >= hojeIdx ? s.saldoComCenarios : null,
    };
  });

  const hojeVisivel = hojeIdx >= janela.inicioIdx && hojeIdx <= janela.fimIdx;
  const selecionadoIdx = serie.findIndex((s) => s.data === selecionado);
  const selecionadoVisivel = selecionadoIdx >= janela.inicioIdx && selecionadoIdx <= janela.fimIdx;
  const diaSelecionado = serie[selecionadoIdx] ?? serie[hojeIdx];
  const valorSelecionado = selecionadoIdx <= hojeIdx
    ? diaSelecionado.saldoEfetivo
    : (mostrarCenarios ? diaSelecionado.saldoComCenarios : diaSelecionado.saldoProjetado);

  return (
    <div className="grafico-expandido" role="dialog" aria-modal="true" aria-label="Gráfico de saldo expandido">
      <div className="grafico-expandido-cabecalho">
        <span className="grafico-expandido-periodo" data-testid="grafico-expandido-periodo">
          {ddmm(serieVisivel[0].data)} – {ddmm(serieVisivel[serieVisivel.length - 1].data)}
        </span>
        <button type="button" className="grafico-expandido-fechar" aria-label="Fechar" onClick={onFechar}>
          <X size={16} />
        </button>
      </div>

      <div className="grafico-expandido-leitura">
        <span className={`saldo-grande${valorSelecionado < 0 ? ' negativo' : ''}`}>
          {formatarBRL(valorSelecionado)}
        </span>
        <span className="sub" data-testid="grafico-expandido-leitura-data">
          {semana(selecionado)}, {ddmm(selecionado)}{selecionado === hojeData ? ' · hoje' : ''}
        </span>
      </div>

      <div className="grafico-expandido-area" data-testid="grafico-expandido-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[min, max]} />
            <XAxis
              dataKey="data" tickFormatter={(d: ISODate) => ddmm(d)}
              tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
            {hojeVisivel && <ReferenceLine x={hojeData} stroke="var(--muted)" strokeDasharray="2 2" />}
            <Area
              type="linear" dataKey="passado" stroke="var(--pos)" strokeWidth={2.5}
              fill={`url(#${uid}-g)`} isAnimationActive={false} connectNulls={false}
            />
            <Area
              type="linear" dataKey="futuro" stroke="var(--pos)" strokeWidth={2.5} strokeDasharray="5 4"
              fill={`url(#${uid}-g)`} isAnimationActive={false} connectNulls={false}
            />
            {mostrarCenarios && (
              <Area
                type="linear" dataKey="cenario" stroke="var(--ac)" strokeWidth={2} strokeDasharray="1 3"
                fill="none" isAnimationActive={false} connectNulls={false}
              />
            )}
            {selecionadoVisivel && (
              <ReferenceDot
                x={selecionado} y={valorSelecionado} r={4}
                fill="var(--bg)" stroke="var(--pos)" strokeWidth={1.4} isFront
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {mostrarCenarios && (
        <div className="grafico-expandido-legenda">
          <span className="real"><i /> Real</span>
          <span className="proj"><i /> Projetado</span>
          <span className="cen"><i /> Cenário</span>
        </div>
      )}

      <div className="grafico-expandido-rodape">mín {formatarBRL(min)} · máx {formatarBRL(max)}</div>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/FluxoChartModal.test.tsx`
Expected: PASS — 8 testes.

- [ ] **Step 7: Commit**

```bash
git add src/ui/FluxoChartModal.tsx src/ui/FluxoChartModal.test.tsx src/styles.css src/test-setup.ts
git commit -m "feat(ui): estrutura estatica do grafico expandido (FluxoChartModal)"
```

---

### Task 4: Gestos — scrub, pan e zoom no `FluxoChartModal`

**Files:**
- Modify: `src/ui/FluxoChartModal.tsx`
- Modify: `src/ui/FluxoChartModal.test.tsx`

**Interfaces:**
- Consumes: `panJanela`, `zoomJanela` (Task 2).
- Produces: nenhuma mudança de assinatura pública — `Props` continua igual; só o
  comportamento interno do componente ganha interatividade.

- [ ] **Step 1: Escrever os testes de gesto (falhando)**

Adicionar ao final de `src/ui/FluxoChartModal.test.tsx` (mesmo arquivo, novo `describe`):

```tsx
describe('FluxoChartModal — gestos', () => {
  function mockRect(largura = 400) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: largura, height: 340, left: 0, top: 0, right: largura, bottom: 340, x: 0, y: 0,
      toJSON() { return {}; },
    } as DOMRect);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicar e arrastar (scrub) seleciona o dia mais próximo do ponteiro, ao vivo', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    fireEvent.pointerDown(area, { pointerId: 1, clientX: 0, timeStamp: 1000 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 400, timeStamp: 1050 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 400, timeStamp: 1060 });

    expect(screen.getByTestId('grafico-expandido-leitura-data'))
      .toHaveTextContent(ddmm(serie[HOJE_IDX + 30].data));
  });

  it('clique-duplo e arraste faz pan, sem mudar o dia selecionado', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    // 1º clique: rápido, no meio do gráfico (posição de "hoje", não muda a seleção)
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 200, timeStamp: 1000 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 200, timeStamp: 1010 });
    // 2º clique logo em seguida, perto do mesmo ponto: entra em modo pan
    fireEvent.pointerDown(area, { pointerId: 1, clientX: 202, timeStamp: 1100 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 302, timeStamp: 1150 });
    fireEvent.pointerUp(area, { pointerId: 1, clientX: 302, timeStamp: 1160 });

    const esperado = `${ddmm(serie[HOJE_IDX - 45].data)} – ${ddmm(serie[HOJE_IDX + 15].data)}`;
    expect(screen.getByTestId('grafico-expandido-periodo')).toHaveTextContent(esperado);
    expect(screen.getByTestId('grafico-expandido-leitura-data')).toHaveTextContent('· hoje');
  });

  it('wheel para baixo (deltaY > 0) alarga a janela (zoom out)', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');
    const periodoAntes = screen.getByTestId('grafico-expandido-periodo').textContent;

    fireEvent.wheel(area, { clientX: 200, deltaY: 100 });

    expect(screen.getByTestId('grafico-expandido-periodo').textContent).not.toBe(periodoAntes);
  });

  it('zoom in repetido não passa de 14 dias visíveis', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');

    for (let i = 0; i < 30; i++) fireEvent.wheel(area, { clientX: 200, deltaY: -100 });

    const [de, ate] = screen.getByTestId('grafico-expandido-periodo').textContent!.split(' – ');
    const idxDe = serie.findIndex((s) => ddmm(s.data) === de);
    const idxAte = serie.findIndex((s) => ddmm(s.data) === ate);
    expect(idxAte - idxDe).toBe(13); // 14 dias = 13 de diferença de índice
  });

  it('pinça (dois ponteiros se afastando) dá o mesmo tipo de zoom que o wheel', () => {
    mockRect(400);
    render(<FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={false} onFechar={() => {}} />);
    const area = screen.getByTestId('grafico-expandido-area');
    const periodoAntes = screen.getByTestId('grafico-expandido-periodo').textContent;

    fireEvent.pointerDown(area, { pointerId: 1, clientX: 180 });
    fireEvent.pointerDown(area, { pointerId: 2, clientX: 220 });
    fireEvent.pointerMove(area, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(area, { pointerId: 2, clientX: 300 });

    expect(screen.getByTestId('grafico-expandido-periodo').textContent).not.toBe(periodoAntes);
  });
});
```

No topo do arquivo, adicionar `afterEach` à importação existente do vitest:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/FluxoChartModal.test.tsx`
Expected: FAIL nos 5 novos testes de gesto — o modal ainda não reage a `wheel`/`pointer*`
(a janela e a seleção não mudam).

- [ ] **Step 3: Adicionar os handlers de gesto ao componente**

Editar `src/ui/FluxoChartModal.tsx`:

1. Trocar o import do React no topo por:

```tsx
import {
  useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent,
} from 'react';
```

2. Trocar o import de `chartGestures` por:

```tsx
import { janelaInicial, panJanela, zoomJanela, type Janela } from './chartGestures';
```

3. Logo abaixo da linha `const [selecionado, setSelecionado] = useState<ISODate>(hojeData);`,
   adicionar:

```tsx
  const areaRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, number>());
  const modoRef = useRef<'scrub' | 'pan' | null>(null);
  const panRefRef = useRef<{ x: number; janela: Janela } | null>(null);
  const pinchRef = useRef<{ dist: number; janela: Janela; ancoraIdx: number } | null>(null);
  const ultimoCliqueRef = useRef<{ tempo: number; x: number } | null>(null);

  const DBLCLIQUE_MS = 350;
  const DBLCLIQUE_PX = 24;

  function idxNaPosicao(clientX: number): number {
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx));
  }

  function selecionarPeloX(clientX: number) {
    const idx = Math.min(serie.length - 1, Math.max(0, idxNaPosicao(clientX)));
    setSelecionado(serie[idx].data);
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ancoraIdx = janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx);
    const fator = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setJanela((j) => zoomJanela(j, fator, ancoraIdx, serie.length));
  }

  function onPointerDown(e: ReactPointerEvent) {
    areaRef.current?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, e.clientX);
    if (pointersRef.current.size === 1) {
      const ultimo = ultimoCliqueRef.current;
      const isDuplo = ultimo != null
        && e.timeStamp - ultimo.tempo < DBLCLIQUE_MS
        && Math.abs(e.clientX - ultimo.x) < DBLCLIQUE_PX;
      if (isDuplo) {
        modoRef.current = 'pan';
        panRefRef.current = { x: e.clientX, janela };
      } else {
        modoRef.current = 'scrub';
        selecionarPeloX(e.clientX);
      }
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      modoRef.current = null;
      panRefRef.current = null;
      const xs = [...pointersRef.current.values()];
      const dist = Math.max(Math.abs(xs[0] - xs[1]), 1);
      const rect = areaRef.current!.getBoundingClientRect();
      const midX = (xs[0] + xs[1]) / 2;
      const f = Math.min(1, Math.max(0, (midX - rect.left) / rect.width));
      pinchRef.current = { dist, janela, ancoraIdx: janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx) };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, e.clientX);
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const xs = [...pointersRef.current.values()];
      const dist = Math.max(Math.abs(xs[0] - xs[1]), 1);
      const { janela: janelaRef, ancoraIdx, dist: distInicial } = pinchRef.current;
      setJanela(zoomJanela(janelaRef, distInicial / dist, ancoraIdx, serie.length));
    } else if (pointersRef.current.size === 1 && modoRef.current === 'pan' && panRefRef.current) {
      const rect = areaRef.current!.getBoundingClientRect();
      const dx = e.clientX - panRefRef.current.x;
      const winLen = panRefRef.current.janela.fimIdx - panRefRef.current.janela.inicioIdx;
      const deltaIdx = (-dx / rect.width) * winLen;
      setJanela(panJanela(panRefRef.current.janela, deltaIdx, serie.length));
    } else if (pointersRef.current.size === 1 && modoRef.current === 'scrub') {
      selecionarPeloX(e.clientX);
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (modoRef.current) ultimoCliqueRef.current = { tempo: e.timeStamp, x: e.clientX };
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) { modoRef.current = null; panRefRef.current = null; }
  }

  function onPointerCancel(e: ReactPointerEvent) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null; modoRef.current = null; panRefRef.current = null;
  }
```

4. Trocar a `<div className="grafico-expandido-area" data-testid="grafico-expandido-area">`
   por:

```tsx
      <div
        className="grafico-expandido-area" data-testid="grafico-expandido-area" ref={areaRef}
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      >
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/FluxoChartModal.test.tsx`
Expected: PASS — 13 testes (8 da Task 3 + 5 novos).

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes passam, nenhuma regressão em outros arquivos.

- [ ] **Step 6: Commit**

```bash
git add src/ui/FluxoChartModal.tsx src/ui/FluxoChartModal.test.tsx
git commit -m "feat(ui): gestos de scrub, pan e zoom no grafico expandido"
```

---

### Task 5: Ligar o modal à aba Fluxo

**Files:**
- Modify: `src/ui/TelaFluxo.tsx`
- Modify: `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consumes: `FluxoChartModal` (Task 3/4, default export), `.grafico-expandido-abrir` /
  `.grafico-expandido-icone` (CSS de Task 3).

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `src/ui/TelaFluxo.test.tsx`:

```tsx
it('clicar no card do gráfico abre o modal expandido', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await userEvent.click(screen.getByRole('button', { name: 'Expandir gráfico de saldo' }));

  expect(await screen.findByRole('dialog', { name: 'Gráfico de saldo expandido' })).toBeInTheDocument();
});

it('sem ao menos 2 dias na série projetada, o gráfico não fica clicável', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: null, dataSaldoInicial: null, criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);

  expect(screen.queryByRole('button', { name: 'Expandir gráfico de saldo' })).not.toBeInTheDocument();
});
```

(`agoraISO`, `novoId`, `repo.salvarBox` já estão importados no arquivo — mesmos usados por
`seedBoxComCategoria`.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: FAIL — não existe botão com nome "Expandir gráfico de saldo" (o card ainda é um
`<div>` sem `onClick`).

- [ ] **Step 3: Editar `TelaFluxo.tsx`**

No topo do arquivo, trocar:

```tsx
import { useMemo, useState } from 'react';
import { addDias } from '../domain/dates';
```

por:

```tsx
import { Suspense, lazy, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { addDias } from '../domain/dates';
```

Logo abaixo do import de `LancEditor`, adicionar:

```tsx
const FluxoChartModal = lazy(() => import('./FluxoChartModal'));
```

Dentro do componente, junto aos outros `useState`, adicionar:

```tsx
  const [graficoExpandido, setGraficoExpandido] = useState(false);
```

Substituir o bloco:

```tsx
      <div className="card">
        <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
      </div>
```

por:

```tsx
      {serie.length >= 2 ? (
        <button
          type="button" className="card grafico-expandido-abrir" aria-label="Expandir gráfico de saldo"
          onClick={() => setGraficoExpandido(true)}
        >
          <Maximize2 size={18} className="grafico-expandido-icone" aria-hidden="true" />
          <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
        </button>
      ) : (
        <div className="card">
          <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
        </div>
      )}
```

E, logo antes de `{editando && <LancEditor .../>}` no fim do JSX, adicionar:

```tsx
      {graficoExpandido && (
        <Suspense fallback={null}>
          <FluxoChartModal
            serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0}
            onFechar={() => setGraficoExpandido(false)}
          />
        </Suspense>
      )}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: PASS — todos os testes do arquivo, incluindo os 2 novos.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(ui): abre o grafico expandido ao clicar no card de saldo da aba Fluxo"
```

---

### Task 6: Documentar no guia de estilo

**Files:**
- Modify: `docs/estilo-visual.md`

- [ ] **Step 1: Adicionar o componente à lista de "Componentes compartilhados"**

Em `docs/estilo-visual.md`, na seção "## Componentes compartilhados", logo após o bullet de
`BalanceChart.tsx`, adicionar:

```markdown
- **`FluxoChartModal.tsx`** — versão em tela cheia do `BalanceChart`, aberta ao clicar no
  card do gráfico na aba Fluxo. Navegação por clique-e-arraste (seleciona um dia),
  clique-duplo-e-arraste (pan) e pinça/scroll (zoom), via `recharts` carregado sob demanda
  (`React.lazy`). Ver
  `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/estilo-visual.md
git commit -m "docs: registra o FluxoChartModal no guia de estilo visual"
```
