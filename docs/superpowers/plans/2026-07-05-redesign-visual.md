# Redesign Visual Dark-First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin completo do Flow para dark-first minimalista (spec: `docs/superpowers/specs/2026-07-05-redesign-visual-design.md`), sem alterar nenhuma funcionalidade.

**Architecture:** A estratégia central é reescrever `src/styles.css` **mantendo os nomes de classe existentes** (`card`, `item`, `botao`, `campo`, `valor-ganho`…) — todas as telas usam esse vocabulário compartilhado, então o grosso do re-skin não toca TSX. Mudanças estruturais ficam confinadas a: `Shell.tsx` (topo/nav/FAB/transições), novo `Sheet.tsx` (bottom sheet hospedando o `LancEditor`), `BalanceChart.tsx` (gradiente) e `TelaHoje.tsx` (card herói).

**Tech Stack:** React 18 + Vite + CSS puro com variáveis. Novas deps: `framer-motion` (transições/sheet) e `lucide-react` (ícones utilitários).

## Global Constraints

- **Zero mudança de comportamento:** proibido tocar em `src/domain/`, `src/db/`, `src/state/`, `src/importer/`, `src/backup/`.
- **Testes existentes continuam passando.** Preservar todos os `aria-label`s e textos visíveis citados nos testes ("Lançar", "Confirmar X", "Descartar", "Ajustes", "Box", "Pendentes (N)", "Linha do saldo no tempo"). Exceções autorizadas (ajuste de seletor, não de comportamento): `src/App.test.tsx` troca a âncora `findByText('Flow')` (o título "Flow" sai do topo) — ver Task 3; `src/ui/TelaHoje.test.tsx:25` troca `getByText('R$ 1.000,00')` por um matcher tolerante à quebra em `<p>{reais}<b>,{centavos}</b></p>` — ver Task 6.
- **Formulários de Ajustes permanecem inline** (sempre visíveis, como hoje) — apenas re-estilizados via CSS. O Sheet é só para o LancEditor. (Decisão registrada no spec.)
- Tokens exatos do spec: bg `#0b0d11`, surface `#161b24`, surface2 `#212836`, fg `#e9edf3`, muted `#8b95a3`, line `#232936`, ação `#3b9df8`, ganho `#2ee6a8`, gasto `#ff6b7a`. Azul só em ações; verde/vermelho só em valores.
- Comandos de verificação por task: `npm run test` e, onde indicado, `npm run build`. Ao final: `npm run preview -- --host` para conferência no celular (hábito do projeto).
- Commits frequentes, um por task, mensagens em pt-BR estilo `feat(ui): …` (padrão do repo).

---

### Task 1: Dependências e test-setup

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/test-setup.ts`

**Interfaces:**
- Produces: `framer-motion` e `lucide-react` instalados; testes rodam com animações desligadas (`MotionGlobalConfig.skipAnimations`) e stub de `matchMedia` (jsdom não implementa; framer-motion consulta para reduced-motion).

- [ ] **Step 1: Instalar dependências**

Run: `npm install framer-motion lucide-react`
Expected: adiciona as duas deps em `package.json` sem erros.

- [ ] **Step 2: Preparar o test-setup**

Adicionar ao final de `src/test-setup.ts`:

```ts
import { MotionGlobalConfig } from 'framer-motion';

// framer-motion: animações instantâneas nos testes (sem esperas nem elementos presos em exit)
MotionGlobalConfig.skipAnimations = true;

// jsdom não implementa matchMedia; framer-motion consulta prefers-reduced-motion
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}
```

- [ ] **Step 3: Verificar que a suíte continua verde**

Run: `npm run test`
Expected: PASS (todos os testes atuais).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/test-setup.ts
git commit -m "build(ui): adiciona framer-motion e lucide-react; test-setup para animações"
```

---

### Task 2: Novo styles.css (tokens + linguagem de componentes) e manifest escuro

**Files:**
- Modify: `src/styles.css` (substituição completa)
- Modify: `index.html:6` (`theme-color`)
- Modify: `vite.config.ts:18-19` (`theme_color`, `background_color`)

**Interfaces:**
- Produces: mesmas classes de hoje re-estilizadas + novas classes que as tasks seguintes consomem: `.chip`, `.rotulo`, `.secao`, `.delta` (`.pos`/`.neg`), `.acoes`, `.item-coluna`, `.linha-topo`, `.sheet-backdrop`, `.sheet`, `.sheet-alca`, `.saldo-grande b`, `.saldo-grande.negativo`.

- [ ] **Step 1: Substituir o conteúdo inteiro de `src/styles.css` por:**

```css
:root {
  --bg: #0b0d11; --fg: #e9edf3; --muted: #8b95a3;
  --surface: #161b24; --surface2: #212836; --line: #232936;
  --ac: #3b9df8; --ac-dim: rgba(59, 157, 248, .14);
  --pos: #2ee6a8; --pos-bg: rgba(46, 230, 168, .14);
  --neg: #ff6b7a; --neg-bg: rgba(255, 107, 122, .13);
  --aviso-bg: #423306; --aviso-fg: #fcd34d;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
}
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }

.shell { display: flex; flex-direction: column; min-height: 100dvh; }
.topo {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 16px 8px; position: sticky; top: 0; z-index: 10;
  background: rgba(11, 13, 17, .85); backdrop-filter: blur(12px);
}
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--surface); border: none; color: var(--fg);
  padding: 8px 14px; border-radius: 999px; font-size: 14px; font-weight: 600;
  min-height: 38px;
}

.conteudo { flex: 1; padding: 12px 16px 96px; max-width: 720px; width: 100%; margin: 0 auto; }
.tela { display: flex; flex-direction: column; gap: 14px; }
.tela h2 { margin: 0; font-size: 16px; font-weight: 700; padding: 0 2px; }
.sub { color: var(--muted); font-size: 13px; }
.rotulo {
  color: var(--muted); font-size: 12px; font-weight: 600;
  letter-spacing: .05em; text-transform: uppercase;
}
.secao { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px; }
.secao .acao { color: var(--ac); font-size: 13px; font-weight: 600; }

.navegacao {
  position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center;
  background: rgba(15, 18, 24, .92); backdrop-filter: blur(12px);
  border-top: 1px solid var(--line); z-index: 20;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
}
.navegacao button {
  flex: 1; padding: 10px 0; background: none; border: none;
  color: var(--muted); font-size: 12px; font-weight: 600; border-radius: 12px;
}
.navegacao button.ativo { color: var(--ac); background: var(--ac-dim); }
.navegacao button.central {
  flex: 0 0 52px; height: 52px; margin: -14px 10px 0; border-radius: 18px;
  background: var(--ac); color: #fff; font-size: 26px; font-weight: 400;
  box-shadow: 0 8px 24px var(--ac-dim), 0 4px 12px rgba(0, 0, 0, .4);
}

.card { background: var(--surface); border-radius: 20px; padding: 20px; }
.lista { display: flex; flex-direction: column; gap: 10px; }
.item {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--surface); border: none; border-radius: 18px;
  width: 100%; text-align: left;
}
.item .cresce { flex: 1; min-width: 0; }
.item-coluna { flex-direction: column; align-items: stretch; gap: 12px; }
.linha-topo { display: flex; align-items: center; gap: 12px; }
.linha-topo .cresce { flex: 1; min-width: 0; }
.acoes { display: flex; gap: 8px; }
.acoes .botao { flex: 1; }

.botao {
  padding: 10px 14px; border: none; border-radius: 12px;
  background: var(--surface2); color: var(--fg); font-weight: 600; font-size: 14px;
  min-height: 42px;
}
.botao-primario { background: var(--ac); color: #fff; }
.botao-perigo { background: var(--surface2); color: var(--neg); }

.grade-categorias { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.grade-categorias .botao { min-height: 56px; }
.grade-categorias .selecionada {
  background: var(--ac-dim); color: var(--ac); outline: 1.5px solid var(--ac);
}

.valor-ganho, .valor-gasto {
  font-variant-numeric: tabular-nums; font-weight: 700; font-size: 14.5px;
  padding: 6px 12px; border-radius: 12px; white-space: nowrap;
}
.valor-ganho { color: var(--pos); background: var(--pos-bg); }
.valor-gasto { color: var(--neg); background: var(--neg-bg); }
/* em tabelas e em texto corrido (ex.: rótulo do dia no Fluxo), só a cor — sem pílula */
.tabela .valor-ganho, .tabela .valor-gasto,
strong.valor-ganho, strong.valor-gasto {
  background: none; padding: 0; border-radius: 0;
}

.badge {
  font-size: 11px; padding: 3px 9px; border-radius: 999px;
  background: var(--surface2); color: var(--muted);
}
.aviso {
  background: var(--aviso-bg); color: var(--aviso-fg);
  padding: 12px 14px; border-radius: 12px; font-size: 14px;
}
.saldo-grande {
  font-size: 38px; font-weight: 800; letter-spacing: -.03em;
  font-variant-numeric: tabular-nums;
}
.saldo-grande b { color: var(--pos); font-weight: 800; }
.saldo-grande.negativo, .saldo-grande.negativo b { color: var(--neg); }
.delta {
  font-size: 13px; font-weight: 600; padding: 3px 10px;
  border-radius: 999px; display: inline-block;
}
.delta.pos { color: var(--pos); background: var(--pos-bg); }
.delta.neg { color: var(--neg); background: var(--neg-bg); }

.campo { display: flex; flex-direction: column; gap: 5px; }
.campo label { color: var(--muted); font-size: 13px; }
.campo input, .campo select {
  padding: 11px 12px; border: none; border-radius: 12px;
  background: var(--surface2); min-height: 44px;
}
.linha { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

table.tabela { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
table.tabela th {
  color: var(--muted); font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .04em;
}
table.tabela th, table.tabela td { text-align: right; padding: 8px; border-bottom: 1px solid var(--line); }
table.tabela th:first-child, table.tabela td:first-child { text-align: left; }
table.tabela tr:last-child td { border-bottom: none; }
.rolavel { overflow-x: auto; }

.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, .55); z-index: 50;
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  background: var(--surface); width: 100%; max-width: 560px;
  border-radius: 24px 24px 0 0;
  padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
  max-height: 88dvh; overflow-y: auto;
}
.sheet-alca {
  width: 40px; height: 4px; border-radius: 2px;
  background: var(--surface2); margin: 2px auto 14px;
}

@media (min-width: 900px) {
  .shell { flex-direction: row; }
  .navegacao {
    position: sticky; top: 0; bottom: auto; flex-direction: column; align-items: stretch;
    width: 190px; height: 100dvh; border-top: none; border-right: 1px solid var(--line);
    padding: 12px; gap: 4px;
  }
  .navegacao button { flex: 0 0 auto; text-align: left; padding: 12px 16px; font-size: 15px; }
  .navegacao button.central {
    border-radius: 14px; margin: 8px 0; height: auto; padding: 12px;
    font-size: 18px; text-align: center; box-shadow: none;
  }
  .conteudo { padding-bottom: 24px; max-width: 900px; }
  .shell-corpo { flex: 1; display: flex; flex-direction: column; }
  .sheet-backdrop { align-items: center; }
  .sheet { border-radius: 24px; }
}
```

Observações para o implementador:
- As classes removidas de propósito (não existem mais): `.icone`, `.topo .titulo`, `.topo select`, `.item { border-bottom }`. O Shell novo (Task 3) para de usá-las.
- `.item` agora serve tanto para `<div>` quanto para `<button>` (TelaFluxo/TelaAjustes usam `<button className="item">`) — por isso o reset `border: none; width: 100%; text-align: left`.

- [ ] **Step 2: Manifest e theme-color escuros**

Em `index.html` linha 6: `<meta name="theme-color" content="#0b0d11" />`.
Em `vite.config.ts` linhas 18–19: `theme_color: '#0b0d11',` e `background_color: '#0b0d11',`.

- [ ] **Step 3: Verificar**

Run: `npm run test` → PASS (testes não asseguram CSS).
Run: `npm run build` → sem erros.
Run: `npm run preview -- --host` e olhar rapidamente: app inteiro já deve estar escuro, com pílulas de valor e cards sem borda; topo/nav ainda com layout antigo (Task 3 resolve).

- [ ] **Step 4: Commit**

```bash
git add src/styles.css index.html vite.config.ts
git commit -m "feat(ui): tema dark-first — novos tokens e linguagem de componentes"
```

---

### Task 3: Shell — topo com chips, tab bar com FAB, transição de aba

**Files:**
- Modify: `src/ui/Shell.tsx` (substituição completa)
- Modify: `src/App.test.tsx:7`

**Interfaces:**
- Consumes: classes `.chip`, `.navegacao button.ativo/.central` da Task 2.
- Produces: mesmo contrato externo (nenhum — Shell é a raiz). `aria-label`s preservados: `"Box"` (select), `"Ajustes"` (engrenagem), `"Lançar"` (FAB).

- [ ] **Step 1: Ajustar o smoke test**

O título "Flow" sai do topo, então em `src/App.test.tsx` linha 7, trocar:

```tsx
expect(await screen.findByText('Flow')).toBeInTheDocument();
```

por:

```tsx
expect(await screen.findByRole('button', { name: 'Hoje' })).toBeInTheDocument();
```

- [ ] **Step 2: Rodar o teste para vê-lo ainda passar (a aba Hoje já existe hoje)**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS (a mudança de âncora é compatível com o Shell atual e o novo).

- [ ] **Step 3: Substituir o conteúdo de `src/ui/Shell.tsx` por:**

```tsx
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useApp, type Aba } from '../state/store';
import TelaAjustes from './TelaAjustes';
import TelaAnalises from './TelaAnalises';
import TelaCartao from './TelaCartao';
import TelaFluxo from './TelaFluxo';
import TelaHoje from './TelaHoje';
import TelaLancar from './TelaLancar';
import TelaSimulador from './TelaSimulador';

const ABAS: { id: Aba; rotulo: string; central?: boolean }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'fluxo', rotulo: 'Fluxo' },
  { id: 'lancar', rotulo: '+', central: true },
  { id: 'cartao', rotulo: 'Cartão' },
  { id: 'analises', rotulo: 'Análises' },
  { id: 'simulador', rotulo: 'Simular' },
];

export default function Shell() {
  const { aba, setAba, boxSel, setBoxSel, dados } = useApp();
  if (!dados) return null;
  const boxesComSaldo = dados.boxes.filter((b) => b.saldoInicial != null);
  return (
    <div className="shell">
      <nav className="navegacao">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`${aba === a.id ? 'ativo' : ''} ${a.central ? 'central' : ''}`}
            onClick={() => setAba(a.id)}
            aria-label={a.central ? 'Lançar' : a.rotulo}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>
      <div className="shell-corpo">
        <header className="topo">
          <select className="chip" value={boxSel} onChange={(e) => setBoxSel(e.target.value)} aria-label="Box">
            {boxesComSaldo.map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
            <option value="casa">casa</option>
          </select>
          <button className="chip" onClick={() => setAba('ajustes')} aria-label="Ajustes">
            <Settings size={18} />
          </button>
        </header>
        <main className="conteudo">
          <motion.div
            key={aba}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {aba === 'hoje' && <TelaHoje />}
            {aba === 'fluxo' && <TelaFluxo />}
            {aba === 'lancar' && <TelaLancar />}
            {aba === 'cartao' && <TelaCartao />}
            {aba === 'analises' && <TelaAnalises />}
            {aba === 'simulador' && <TelaSimulador />}
            {aba === 'ajustes' && <TelaAjustes />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
```

(É o Shell atual com três mudanças: título "Flow" removido, select e engrenagem virando chips com ícone lucide, e o `motion.div` com `key={aba}` fazendo fade+deslize a cada troca de aba. Sem `AnimatePresence` — só animação de entrada, o que mantém os testes síncronos.)

- [ ] **Step 4: Verificar**

Run: `npm run test`
Expected: PASS completo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Shell.tsx src/App.test.tsx
git commit -m "feat(ui): topo com chips, tab bar com FAB e transição de aba"
```

---

### Task 4: Componente Sheet + LancEditor como bottom sheet

**Files:**
- Create: `src/ui/Sheet.tsx`
- Create: `src/ui/Sheet.test.tsx`
- Modify: `src/ui/LancEditor.tsx` (apenas o JSX do wrapper)

**Interfaces:**
- Consumes: classes `.sheet-backdrop`, `.sheet`, `.sheet-alca` (Task 2).
- Produces: `Sheet({ aberto: boolean; onFechar: () => void; rotulo?: string; children: ReactNode })` — renderiza `children` num painel `role="dialog"` `aria-modal="true"` que sobe de baixo; fecha por clique no backdrop ou arraste para baixo. Montagem condicional segue no pai (como hoje com o LancEditor), então a animação de saída não se aplica — aceito no spec v1.

- [ ] **Step 1: Escrever o teste que falha — `src/ui/Sheet.test.tsx`:**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Sheet from './Sheet';

describe('Sheet', () => {
  it('renderiza children num dialog quando aberto', () => {
    render(<Sheet aberto onFechar={() => {}} rotulo="Teste"><p>conteúdo</p></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Teste' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('não renderiza nada quando fechado', () => {
    render(<Sheet aberto={false} onFechar={() => {}}><p>conteúdo</p></Sheet>);
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('fecha ao clicar no backdrop, mas não ao clicar no conteúdo', async () => {
    const onFechar = vi.fn();
    render(<Sheet aberto onFechar={onFechar}><p>conteúdo</p></Sheet>);
    await userEvent.click(screen.getByText('conteúdo'));
    expect(onFechar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onFechar).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- src/ui/Sheet.test.tsx`
Expected: FAIL — `Cannot find module './Sheet'` (ou equivalente).

- [ ] **Step 3: Implementar `src/ui/Sheet.tsx`:**

```tsx
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotulo?: string;
  children: ReactNode;
}

export default function Sheet({ aberto, onFechar, rotulo, children }: Props) {
  if (!aberto) return null;
  return (
    <motion.div
      className="sheet-backdrop" data-testid="sheet-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
      onClick={onFechar}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label={rotulo}
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onFechar();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-alca" aria-hidden="true" />
        {children}
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- src/ui/Sheet.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Migrar o LancEditor para o Sheet**

Em `src/ui/LancEditor.tsx`, adicionar o import:

```tsx
import Sheet from './Sheet';
```

E substituir o wrapper do `return` (o `<div style={{ position: 'fixed', … }}>` e o `<div className="card" …>` internos, linhas 46–50 e o fechamento 91–92) por:

```tsx
return (
  <Sheet aberto onFechar={onFechar} rotulo={lanc.status === 'previsto' ? 'Previsto' : 'Lançamento'}>
    {/* todo o conteúdo interno atual permanece idêntico, do <h2> até a .linha de botões */}
  </Sheet>
);
```

O conteúdo interno (h2, campos, aviso, botões "✓ Confirmar" / "Salvar" / "Excluir" / "Fechar") **não muda em nada** — os testes de `LancEditor.test.tsx` dependem dele.

- [ ] **Step 6: Verificar**

Run: `npm run test`
Expected: PASS completo (incl. `LancEditor.test.tsx` e `TelaCartao.test.tsx`, que abrem o editor).

- [ ] **Step 7: Commit**

```bash
git add src/ui/Sheet.tsx src/ui/Sheet.test.tsx src/ui/LancEditor.tsx
git commit -m "feat(ui): bottom sheet com arraste; LancEditor migra para Sheet"
```

---

### Task 5: BalanceChart — linha verde com gradiente

**Files:**
- Modify: `src/ui/BalanceChart.tsx`

**Interfaces:**
- Consumes: tokens `--pos`, `--ac`, `--line`, `--muted` (Task 2).
- Produces: mesma API (`serie`, `hoje`, `altura`, `mostrarCenarios`); mantém `aria-label="Linha do saldo no tempo"` (usado nos testes).

- [ ] **Step 1: Aplicar as mudanças no SVG**

No topo do arquivo, adicionar `import { useId } from 'react';` e, dentro do componente (antes do `return`), calcular a área preenchida:

```tsx
const uid = useId();
const ultimoPassado = passado.at(-1)?.i ?? -1;
const linhaCheia = [...passado, ...futuro.filter((f) => f.i > ultimoPassado)];
```

Dentro do `<svg>`, como primeiros filhos:

```tsx
<defs>
  <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="var(--pos)" stopOpacity=".22" />
    <stop offset="1" stopColor="var(--pos)" stopOpacity="0" />
  </linearGradient>
</defs>
{linhaCheia.length > 1 && (
  <polygon
    points={`${pontos(linhaCheia)} ${x(linhaCheia.at(-1)!.i).toFixed(2)},40 ${x(linhaCheia[0].i).toFixed(2)},40`}
    fill={`url(#${uid}-g)`}
  />
)}
```

E trocar as cores dos traços existentes:
- linha do zero: `stroke="var(--border)"` → `stroke="var(--line)"`
- marcador do hoje: mantém `var(--muted)` tracejado
- polyline `passado`: `stroke="var(--accent)"` → `stroke="var(--pos)"`, `strokeWidth="2.5"`
- polyline `futuro`: `stroke="var(--accent)"` → `stroke="var(--pos)"`, `strokeWidth="2.5"` (mantém `strokeDasharray="5 4"`)
- polyline `cenarios`: `stroke="var(--muted)"` → `stroke="var(--ac)"` (mantém `strokeDasharray="1 3"`)

(Sem ponto/círculo no "hoje": o viewBox tem escala não uniforme e distorceria o círculo.)

- [ ] **Step 2: Verificar**

Run: `npm run test -- src/ui/BalanceChart.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/ui/BalanceChart.tsx
git commit -m "feat(ui): gráfico de saldo verde com preenchimento em gradiente"
```

---

### Task 6: TelaHoje — card herói com delta e ações em linha

**Files:**
- Modify: `src/ui/TelaHoje.tsx` (apenas o JSX do `return` principal)
- Modify: `src/ui/TelaHoje.test.tsx:25` (ajuste de seletor — ver Step 1b)

**Interfaces:**
- Consumes: `.rotulo`, `.delta.pos/.neg`, `.saldo-grande b`, `.saldo-grande.negativo`, `.item-coluna`, `.linha-topo`, `.acoes` (Task 2).
- Produces: nada consumido por outras tasks. Textos/aria preservados: `Pendentes ({fila.length})`, `Confirmar {nome}`, `Descartar`.

- [ ] **Step 1: Card herói**

No `return` de `TelaHoje`, dentro do `<div className="card">`, substituir os dois primeiros `<p>` (linhas 112–113) por:

```tsx
<p className="rotulo" style={{ margin: 0 }}>
  Saldo hoje · {boxSel === 'casa' ? 'casa' : dados.boxes.find((b) => b.id === boxSel)?.nome}
</p>
{(() => {
  const saldoHoje = deHoje?.saldoEfetivo ?? 0;
  const [reais, centavos] = formatarBRL(saldoHoje).split(',');
  return (
    <p className={`saldo-grande${saldoHoje < 0 ? ' negativo' : ''}`} style={{ margin: '4px 0' }}>
      {reais}<b>,{centavos}</b>
    </p>
  );
})()}
{(() => {
  const fim = janela.at(-1);
  const delta = fim && deHoje ? fim.saldoProjetado - deHoje.saldoEfetivo : null;
  if (delta == null || delta === 0) return null;
  return (
    <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
      {delta > 0 ? '▲' : '▼'} {formatarBRL(Math.abs(delta))} nos próximos 28 dias
    </span>
  );
})()}
```

(O `<p className="sub">projetado: …</p>` existente logo abaixo permanece.)

- [ ] **Step 1b: Ajustar o teste do saldo dividido**

O saldo agora é renderizado como `{reais}<b>,{centavos}</b>` — dois nós de texto separados pelo elemento `<b>`. `getByText` da Testing Library só casa contra o texto direto de cada nó (ignora filhos), então a asserção atual (`src/ui/TelaHoje.test.tsx:25`) deixa de encontrar o elemento:

```tsx
expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument(); // saldo efetivo
```

Trocar por:

```tsx
expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'R$ 1.000,00')).toBeInTheDocument(); // saldo efetivo
```

Sem essa troca, `npm run test -- src/ui/TelaHoje.test.tsx` falha no Step 3 abaixo.

- [ ] **Step 2: Pendentes com ações em linha própria e animação de saída**

Adicionar o import no topo de `TelaHoje.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
```

Envolver o conteúdo de `<div className="lista">` dos pendentes em `<AnimatePresence initial={false}>` (a mensagem "Nada a confirmar…" fica fora do AnimatePresence, depois dele) e substituir o bloco do item pendente (linhas 124–135) por:

```tsx
<motion.div
  className="item item-coluna" key={l.id} layout
  exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
  style={{ overflow: 'hidden' }}
  transition={{ duration: 0.18 }}
>
  <div className="linha-topo">
    <div className="cresce">
      <div>{nomeCat(l.categoriaId)}</div>
      <div className="sub">{l.data.split('-').reverse().join('/')}{l.nota ? ` · ${l.nota}` : ''}</div>
    </div>
    <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
      {formatarBRL(l.valor)}
    </span>
  </div>
  <div className="acoes">
    <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
    <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
  </div>
</motion.div>
```

(O `h2` "Pendentes ({fila.length})" e o aviso de backup não mudam. Nos testes, `MotionGlobalConfig.skipAnimations` — Task 1 — faz o desmonte ser imediato, então as asserções de desaparecimento continuam valendo.)

- [ ] **Step 3: Verificar**

Run: `npm run test -- src/ui/TelaHoje.test.tsx`
Expected: PASS.
Run: `npm run test` → PASS completo.

- [ ] **Step 4: Commit**

```bash
git add src/ui/TelaHoje.tsx
git commit -m "feat(ui): card herói do saldo com delta de projeção; pendentes com ações em linha"
```

---

### Task 7: Retoques — ícones lucide nos ajustes e chevron do menu

**Files:**
- Modify: `src/ui/TelaAjustes.tsx:37`
- Modify: `src/ui/ajustes/Categorias.tsx:88-90`

**Interfaces:**
- Consumes: `lucide-react` (Task 1). Todos os `aria-label`s preservados (`"Subir"`, `"Descer"`, `"Editar"` — usados em `Categorias.test.tsx`).

- [ ] **Step 1: Chevron no menu de Ajustes**

Em `src/ui/TelaAjustes.tsx`: `import { ChevronRight } from 'lucide-react';` e na linha 37 trocar `<span>›</span>` por `<ChevronRight size={18} color="var(--muted)" aria-hidden="true" />`.

- [ ] **Step 2: Ícones nos botões de Categorias**

Em `src/ui/ajustes/Categorias.tsx`: `import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';` e nas linhas 88–90 trocar os conteúdos `↑`, `↓`, `✏️` por `<ArrowUp size={16} />`, `<ArrowDown size={16} />`, `<Pencil size={16} />` (mantendo os `aria-label`s "Subir", "Descer", "Editar").

- [ ] **Step 3: Verificar**

Run: `npm run test`
Expected: PASS completo.

- [ ] **Step 4: Commit**

```bash
git add src/ui/TelaAjustes.tsx src/ui/ajustes/Categorias.tsx
git commit -m "feat(ui): ícones lucide no menu de ajustes e em categorias"
```

---

### Task 8: Verificação final de fluxos e conferência no celular

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte e build completos**

Run: `npm run test` → PASS completo.
Run: `npm run build` → sem erros.

- [ ] **Step 2: Conferência manual no navegador/celular**

Run: `npm run preview -- --host` (deixar rodando para o usuário testar no celular — hábito do projeto).

Checklist de fluxos (nenhum pode ter regredido):
- [ ] Hoje: saldo herói + delta + gráfico com gradiente; confirmar e descartar pendente.
- [ ] Lançar via FAB: valor → categoria (selecionada fica azul) → Lançar.
- [ ] Fluxo: lista por dia, tocar num lançamento abre o **bottom sheet**; arrastar para baixo fecha; salvar/excluir funcionam.
- [ ] Cartão: fatura, compras parceladas, conferência.
- [ ] Análises e Simulador: tabelas legíveis (cabeçalho maiúsculo, sem pílula dentro de tabela).
- [ ] Ajustes: todas as 9 seções abrem; criar categoria/box; backup exporta; importar funciona.
- [ ] Girar para desktop (janela larga): sidebar à esquerda ok.

- [ ] **Step 3: Anotar desvios**

Qualquer fluxo quebrado → parar e corrigir antes de dar a task como concluída (usar superpowers:systematic-debugging se houver bug).
