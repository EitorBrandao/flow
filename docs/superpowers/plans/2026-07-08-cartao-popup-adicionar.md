# Popup unificado "+ Adicionar" (Lançamento / Compra no cartão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o botão "+ compra" por cartão e o comportamento atual do FAB central
(que só abre a aba Lançar) por um único ponto de entrada: o FAB abre um popup (`Sheet`) que
deixa escolher entre "Lançamento" e "Compra no cartão"; a fatura passa a esconder os
lançamentos por padrão, agrupando-os em "À vista"/"Parceladas" quando expandida.

**Architecture:** Extrai o formulário `FormCompra` de dentro de `TelaCartao.tsx` para um
arquivo próprio (`src/ui/FormCompra.tsx`), reaproveitado tanto para editar (dentro de
`CartaoFatura`) quanto para criar (dentro do novo componente `AdicionarSheet`, montado uma
vez em `Shell.tsx` e acionado pelo FAB central). `AdicionarSheet` decide o próximo passo
(menu → sem-cartão / escolher-cartão / form) com base na lista de cartões ativos da caixa
selecionada. A listagem de itens da fatura em `CartaoFatura` ganha agrupamento e um toggle
de visibilidade.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, `framer-motion` (via `Sheet`
já existente, sem mudanças no próprio `Sheet.tsx`).

## Global Constraints

- Zero mudança em `src/domain/`, `src/db/`, `src/state/`, `src/importer/`, `src/backup/` —
  só arquivos em `src/ui/**`.
- Nenhuma mudança de campos, validação ou comportamento de salvamento do `FormCompra` — só o
  wrapper visual (Sheet em vez de `<div className="card">`).
- `TelaLancar.tsx` não muda — só o caminho de navegação até ela (via `setAba('lancar')`,
  já existente).
- Rodar `npm run test` e `npm run build` sem erros ao final.

---

### Task 1: Extrair `FormCompra` para arquivo próprio

`FormCompra` hoje é uma função privada em `src/ui/TelaCartao.tsx:20-116`. Vira um componente
exportado em `src/ui/FormCompra.tsx`, sem nenhuma mudança de lógica ou campos — só o local
onde vive e o wrapper visual (perde o `<div className="card"><h3>`, ganha `<h2>`, porque
quem for renderizá-lo agora sempre o coloca dentro de um `Sheet`, que já dá a superfície).

**Files:**
- Create: `src/ui/FormCompra.tsx`
- Modify: `src/ui/TelaCartao.tsx` (remove a função `FormCompra` local, importa do novo arquivo,
  remove o wrapper `<div className="card">` que hoje envolve seu uso dentro de `CartaoFatura`
  — essa parte específica de `CartaoFatura` é ajustada na Task 4)
- Test: `src/ui/FormCompra.test.tsx`

**Interfaces:**
- Produces: `export default function FormCompra({ cartao, compra, onFechar }: { cartao: Cartao; compra?: CompraCartao; onFechar: () => void })` — mesmas props de hoje. Renderiza um `<h2>{compra ? 'Editar compra' : 'Nova compra'}</h2>` seguido dos campos, **sem** `<div className="card">` ao redor (o pai é quem envolve em `<Sheet>`).

- [ ] **Step 1: Ler o `FormCompra` atual para copiar fielmente**

Abrir `src/ui/TelaCartao.tsx` linhas 1-116 e conferir a função `FormCompra` (linhas 20-116).
Vai ser copiada quase literalmente — só a raiz do JSX muda.

- [ ] **Step 2: Criar `src/ui/FormCompra.tsx`**

```tsx
import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { addMesesData } from '../domain/dates';
import { parseValorDigitado } from '../domain/money';
import type { Cartao, CompraCartao } from '../domain/types';
import { useApp } from '../state/store';

export default function FormCompra({ cartao, compra, onFechar }: {
  cartao: Cartao; compra?: CompraCartao; onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra ? centavosParaTexto(compra.valorTotal) : '');
  const [data, setData] = useState(compra?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState(compra?.categoriaCartaoId ?? '');
  const [parcelas, setParcelas] = useState(compra ? String(compra.parcelas) : '1');
  const [parcelasPagas, setParcelasPagas] = useState('');
  const [descricao, setDescricao] = useState(compra?.descricao ?? '');
  const uid = useId();
  if (!dados) return null;
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartao.id && !c.arquivada);
  const horizonte = dados.config.horizonteProjecao;
  const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));

  function onParcelasChange(v: string) {
    setParcelas(v);
    const n = Math.min(48, Math.max(1, Math.round(Number(v) || 1)));
    const p = Math.round(Number(parcelasPagas) || 0);
    if (p > 0 && p >= n) setParcelasPagas('');
  }

  function onParcelasPagasChange(v: string) {
    setParcelasPagas(v);
    const n = Math.round(Number(v));
    if (v.trim() === '' || !Number.isFinite(n) || n <= 0) return;
    const pClamped = Math.min(n, parcelasNum - 1);
    setData(addMesesData(hoje, -pClamped));
  }

  async function salvar() {
    const cents = parseValorDigitado(valor);
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
    <>
      <h2 style={{ marginTop: 0 }}>{compra ? 'Editar compra' : 'Nova compra'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <input id={`${uid}-valor`} placeholder="0,00" inputMode="decimal" value={valor}
            onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <input id={`${uid}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-cat`}>Categoria</label>
          <select id={`${uid}-cat`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">categoria…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} max={48} value={parcelas}
            onChange={(e) => onParcelasChange(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelaspagas`}>Parcelas já pagas</label>
          <input id={`${uid}-parcelaspagas`} type="number" min={0} max={Math.max(0, parcelasNum - 1)}
            disabled={parcelasNum <= 1}
            value={parcelasNum <= 1 ? '' : parcelasPagas}
            onChange={(e) => onParcelasPagasChange(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
          <input id={`${uid}-desc`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={onFechar}>Cancelar</button>
        {compra && <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} onClick={excluir}>Excluir</button>}
      </div>
    </>
  );
}

function centavosParaTexto(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}
```

- [ ] **Step 3: Escrever o teste `src/ui/FormCompra.test.tsx` (adaptado dos testes que hoje vivem em `TelaCartao.test.tsx`)**

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import FormCompra from './FormCompra';

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

it('cria uma compra parcelada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao } = await montarCartao();
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

    const onFechar = vi.fn();
    render(<FormCompra cartao={cartao} onFechar={onFechar} />);
    expect(screen.getByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Valor'), '100,00');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), screen.getByRole('option', { name: 'mercado' }));
    await userEvent.clear(screen.getByLabelText('Parcelas'));
    await userEvent.type(screen.getByLabelText('Parcelas'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onFechar).toHaveBeenCalledOnce();
    const compras = await db.comprasCartao.toArray();
    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ valorTotal: 10000, parcelas: 3 });
  } finally { vi.useRealTimers(); }
});

it('campo Parcelas já pagas fica desabilitado com 1 parcela', async () => {
  const { box, cartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} onFechar={() => {}} />);
  expect(screen.getByLabelText('Parcelas já pagas')).toBeDisabled();
});

it('editar uma compra existente mostra "Editar compra" e o botão Excluir', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
    valorTotal: 8000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
});
```

- [ ] **Step 4: Rodar os novos testes**

Run: `npx vitest run src/ui/FormCompra.test.tsx`
Expected: 3 testes passando (o arquivo `TelaCartao.tsx` ainda não foi ajustado — isso é
esperado, ele será corrigido na Task 4; se `TelaCartao.tsx` quebrar a build por causa da
função duplicada, siga direto para a Task 4 antes de commitar).

- [ ] **Step 5: Commit**

```bash
git add src/ui/FormCompra.tsx src/ui/FormCompra.test.tsx
git commit -m "refactor(cartao): extrai FormCompra para arquivo próprio"
```

---

### Task 2: Remover `FormCompra` duplicado de `TelaCartao.tsx` e mover a edição para `Sheet`

Remove a função `FormCompra` local (agora vive em `FormCompra.tsx`), remove o botão
"+ compra" e o estado `formAberto` de `CartaoFatura` (a criação deixa de ser responsabilidade
desta tela — vai para o novo `AdicionarSheet` na Task 3), e faz a edição de uma compra
existente abrir dentro de um `Sheet`.

**Files:**
- Modify: `src/ui/TelaCartao.tsx`
- Test: `src/ui/TelaCartao.test.tsx`

**Interfaces:**
- Consumes: `FormCompra` de `./FormCompra` (Task 1); `Sheet` de `./Sheet` (já existente,
  props `aberto: boolean`, `onFechar: () => void`, `rotulo?: string`, `children`).

- [ ] **Step 1: Editar `src/ui/TelaCartao.tsx` — remover a função local `FormCompra`, importar o novo componente**

Remover a função `FormCompra` inteira (linhas 20-116 do arquivo original). A linha
`import { useId, useState } from 'react';` no topo do arquivo **não muda** — `useId` continua
usado por `BlocoConferencia`. A função auxiliar `centavosParaTexto` (linhas 11-13 do arquivo
original) também **não muda nem é removida** — continua ali porque `BlocoConferencia` ainda a
usa; `FormCompra.tsx` já ganhou sua própria cópia no Step 2 da Task 1.

`addMesesData` (de `../domain/dates`) só era usado dentro do `FormCompra` removido — trocar:

```tsx
import { addMeses, addMesesData } from '../domain/dates';
```

por (só `addMeses` continua em uso, no navegador de mês da fatura):

```tsx
import { addMeses } from '../domain/dates';
```

(`tsconfig.json` tem `noUnusedLocals: true` — deixar `addMesesData` importado sem uso quebra
o build.)

Adicionar o import do componente extraído, junto aos outros imports de `./`:

```tsx
import FormCompra from './FormCompra';
```

- [ ] **Step 2: Editar `CartaoFatura` — remover criação inline, mover edição para `Sheet`**

Trocar:

```tsx
function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<CompraCartao | null>(null);
```

por:

```tsx
function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [editando, setEditando] = useState<CompraCartao | null>(null);
```

E trocar o final do componente (onde hoje está o bloco `{(formAberto || editando) ? ... }`):

```tsx
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
```

por:

```tsx
      <Sheet aberto={editando != null} onFechar={() => setEditando(null)} rotulo="Editar compra">
        {editando && <FormCompra cartao={cartao} compra={editando} onFechar={() => setEditando(null)} />}
      </Sheet>
    </div>
  );
}
```

Adicionar o import de `Sheet` no topo do arquivo:

```tsx
import Sheet from './Sheet';
```

- [ ] **Step 3: Ajustar `src/ui/TelaCartao.test.tsx` — os testes que criavam compra via "+ compra" nesta tela migram para `FormCompra.test.tsx` (já cobertos na Task 1); os que ficam aqui testam só o que `TelaCartao` ainda faz (empty state, navegação de mês, conferência, e — a partir de agora — edição via Sheet)**

Remover os testes `'adiciona compra parcelada e navega entre faturas'`, `'parcelas já pagas
ajusta a data e a numeração da parcela na fatura aberta'`, `'campo Parcelas já pagas fica
desabilitado com 1 parcela'` e `'limpar Parcelas já pagas não reverte a Data já recalculada'`
de `src/ui/TelaCartao.test.tsx` (o `it('adiciona compra parcelada...')` e os 3 seguintes,
linhas 38-122 do arquivo atual) — essa cobertura já existe em `FormCompra.test.tsx` (Task 1)
e/ou é reescrita no Step seguinte para o fluxo de edição.

Adicionar um teste de edição via Sheet, inserido depois do teste `'box sem cartão oferece
cadastro'`:

```tsx
it('editar uma compra existente abre o formulário num Sheet', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 5000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.click(await screen.findByText('mercado'));
    expect(await screen.findByRole('dialog', { name: 'Editar compra' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(async () => {
      expect(await db.comprasCartao.get(compra.id)).toBeUndefined();
    });
  } finally { vi.useRealTimers(); }
});
```

(o item da fatura mostra `i.descricao ?? nomeCat(i.categoriaCartaoId)` como título — sem
`descricao` na compra criada acima, o texto clicável é o nome da categoria, `'mercado'`.)

- [ ] **Step 4: Rodar os testes de `TelaCartao`**

Run: `npx vitest run src/ui/TelaCartao.test.tsx`
Expected: PASS (o teste `'conferência mostra a diferença...'` continua igual; o novo teste de
edição passa).

- [ ] **Step 5: Rodar a suíte inteira pra garantir que nada mais quebrou**

Run: `npm run test`
Expected: todos os testes passam, incluindo `FormCompra.test.tsx` (Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx
git commit -m "refactor(cartao): edição de compra abre em Sheet; remove criação inline"
```

---

### Task 3: Criar `AdicionarSheet` (popup do FAB: Lançamento / Compra no cartão)

Componente novo que concentra o menu de escolha e as ramificações por quantidade de cartões
ativos. Ainda não é acionado por nada (isso é a Task 4) — esta task só cria e testa o
componente isoladamente.

**Files:**
- Create: `src/ui/AdicionarSheet.tsx`
- Test: `src/ui/AdicionarSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`./Sheet`), `FormCompra` (`./FormCompra`, Task 1), `useApp` +
  `boxIdsSelecionadas` (`../state/store`), tipo `Cartao` (`../domain/types`).
- Produces: `export default function AdicionarSheet({ aberto, onFechar }: { aberto: boolean; onFechar: () => void })`. Usado pelo `Shell` na Task 4.

- [ ] **Step 1: Criar `src/ui/AdicionarSheet.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Cartao } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import FormCompra from './FormCompra';
import Sheet from './Sheet';

type Passo = 'menu' | 'sem-cartao' | 'escolher-cartao' | 'form';

const ROTULOS: Record<Passo, string> = {
  menu: 'Adicionar',
  'sem-cartao': 'Nenhum cartão cadastrado',
  'escolher-cartao': 'Compra em qual cartão?',
  form: 'Nova compra',
};

export default function AdicionarSheet({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { dados, boxSel, setAba } = useApp();
  const [passo, setPasso] = useState<Passo>('menu');
  const [cartaoEscolhido, setCartaoEscolhido] = useState<Cartao | null>(null);

  useEffect(() => {
    if (!aberto) { setPasso('menu'); setCartaoEscolhido(null); }
  }, [aberto]);

  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoesAtivos = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));

  function irParaLancamento() {
    onFechar();
    setAba('lancar');
  }

  function irParaCompra() {
    if (cartoesAtivos.length === 0) { setPasso('sem-cartao'); return; }
    if (cartoesAtivos.length === 1) { setCartaoEscolhido(cartoesAtivos[0]); setPasso('form'); return; }
    setPasso('escolher-cartao');
  }

  function irParaAjustes() {
    onFechar();
    setAba('ajustes');
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={ROTULOS[passo]}>
      {passo === 'menu' && (
        <>
          <h2 style={{ marginTop: 0 }}>Adicionar</h2>
          <div className="lista">
            <button className="item" onClick={irParaLancamento}>
              <div className="cresce">
                <div>Lançamento</div>
                <div className="sub">Gasto ou ganho avulso</div>
              </div>
            </button>
            <button className="item" onClick={irParaCompra}>
              <div className="cresce">
                <div>Compra no cartão</div>
                <div className="sub">Com parcelas, entra direto na fatura</div>
              </div>
            </button>
          </div>
        </>
      )}
      {passo === 'sem-cartao' && (
        <>
          <h2 style={{ marginTop: 0 }}>Nenhum cartão cadastrado</h2>
          <p className="sub">Cadastre um cartão em Ajustes antes de lançar uma compra parcelada.</p>
          <button className="botao botao-primario" onClick={irParaAjustes}>Cadastrar cartão</button>
        </>
      )}
      {passo === 'escolher-cartao' && (
        <>
          <h2 style={{ marginTop: 0 }}>Compra em qual cartão?</h2>
          <div className="lista">
            {cartoesAtivos.map((c) => (
              <button className="item" key={c.id} onClick={() => { setCartaoEscolhido(c); setPasso('form'); }}>
                <div className="cresce">{c.nome}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {passo === 'form' && cartaoEscolhido && (
        <FormCompra cartao={cartaoEscolhido} onFechar={onFechar} />
      )}
    </Sheet>
  );
}
```

- [ ] **Step 2: Escrever `src/ui/AdicionarSheet.test.tsx`**

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import AdicionarSheet from './AdicionarSheet';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function montarBox() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  return box;
}

it('escolher "Lançamento" fecha o sheet e troca para a aba Lançar', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, aba: 'cartao' });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Lançamento'));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('lancar');
});

it('sem cartão cadastrado: "Compra no cartão" mostra aviso e leva para Ajustes', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  const onFechar = vi.fn();
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nenhum cartão cadastrado' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar cartão' }));
  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('ajustes');
});

it('1 cartão ativo: "Compra no cartão" pula direto para o formulário', async () => {
  const box = await montarBox();
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});

it('2+ cartões ativos: "Compra no cartão" mostra lista de escolha antes do formulário', async () => {
  const box = await montarBox();
  const catFlow = await repo.salvarCategoria({ boxId: box.id, nome: 'cartão', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28, categoriaFaturaId: catFlow.id,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Compra em qual cartão?' })).toBeInTheDocument();
  await userEvent.click(screen.getByText('Inter'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/ui/AdicionarSheet.test.tsx`
Expected: 4 testes passando.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AdicionarSheet.tsx src/ui/AdicionarSheet.test.tsx
git commit -m "feat(ui): AdicionarSheet — popup de Lançamento/Compra no cartão"
```

---

### Task 4: Ligar o FAB central ao `AdicionarSheet`

**Files:**
- Modify: `src/ui/Shell.tsx`
- Test: `src/ui/Shell.test.tsx` (novo)

**Interfaces:**
- Consumes: `AdicionarSheet` (`./AdicionarSheet`, Task 3).

- [ ] **Step 1: Editar `src/ui/Shell.tsx`**

Adicionar o import e o estado, e trocar o botão central. O arquivo inteiro fica:

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { useApp, type Aba } from '../state/store';
import AdicionarSheet from './AdicionarSheet';
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
  const [menuAberto, setMenuAberto] = useState(false);
  if (!dados) return null;
  const boxesComSaldo = dados.boxes.filter((b) => b.saldoInicial != null);
  return (
    <div className="shell">
      <nav className="navegacao">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`${aba === a.id ? 'ativo' : ''} ${a.central ? 'central' : ''}`}
            onClick={() => (a.central ? setMenuAberto(true) : setAba(a.id))}
            aria-label={a.central ? 'Adicionar' : a.rotulo}
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
      <AdicionarSheet aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
    </div>
  );
}
```

Nota: o botão central deixa de navegar (`setAba('lancar')`) e passa a abrir o menu
(`setMenuAberto(true)`); o `aria-label` muda de `'Lançar'` para `'Adicionar'` porque agora
abre um popup com mais de uma opção, não só o lançamento.

- [ ] **Step 2: Escrever `src/ui/Shell.test.tsx`**

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import Shell from './Shell';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('o + central abre o popup de Adicionar em vez de trocar direto para Lançar', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<Shell />);

  await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('dialog', { name: 'Adicionar' })).toBeInTheDocument();
  expect(useApp.getState().aba).not.toBe('lancar');

  await userEvent.click(screen.getByText('Lançamento'));
  expect(useApp.getState().aba).toBe('lancar');
});
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/ui/Shell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm run test`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Shell.tsx src/ui/Shell.test.tsx
git commit -m "feat(ui): FAB central abre o popup Adicionar em vez de ir direto pra Lançar"
```

---

### Task 5: Fatura colapsada por padrão, agrupada em "À vista"/"Parceladas"

Ajusta só `CartaoFatura` (dentro de `TelaCartao.tsx`): a lista de itens fica escondida atrás
de um botão "Ver lançamentos"; ao expandir, os itens aparecem em até duas seções — "À vista"
primeiro (itens com `totalParcelas === 1`), "Parceladas" depois (`totalParcelas > 1`) — cada
uma ordenada por `data` decrescente (mais recente primeiro). Se só existir um dos dois tipos,
mostra a lista simples sem rótulo de grupo.

**Files:**
- Modify: `src/ui/TelaCartao.tsx`
- Modify: `src/styles.css`
- Test: `src/ui/TelaCartao.test.tsx`

**Interfaces:**
- Consumes: `ItemFatura` de `../domain/fatura` (campos `data: ISODate`, `totalParcelas: number`, já existentes — sem mudança no domínio).

- [ ] **Step 1: Adicionar as classes CSS em `src/styles.css`**

Adicionar perto de `.rotulo` (já existente):

```css
.rotulo-grupo {
  color: var(--muted); font-size: 12px; font-weight: 600;
  letter-spacing: .05em; text-transform: uppercase; margin: 0;
}
.botao-ver-mais {
  background: none; border: none; color: var(--ac); font-weight: 600;
  font-size: 13px; padding: 4px 0; min-height: 0;
  display: inline-flex; align-items: center; gap: 4px;
}
```

- [ ] **Step 2: Editar `CartaoFatura` em `src/ui/TelaCartao.tsx`**

Adicionar estado `mostrarLista` e uma função de agrupamento antes do `return`:

```tsx
function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [editando, setEditando] = useState<CompraCartao | null>(null);
  const [mostrarLista, setMostrarLista] = useState(false);
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

  const aVista = fatura.itens.filter((i) => i.totalParcelas === 1).sort((a, b) => b.data.localeCompare(a.data));
  const parceladas = fatura.itens.filter((i) => i.totalParcelas > 1).sort((a, b) => b.data.localeCompare(a.data));
  const mostrarGrupos = aVista.length > 0 && parceladas.length > 0;
```

Depois da Task 2, o fim de `CartaoFatura` renderiza a lista plana de itens seguida do `Sheet`
de edição. Trocar esse trecho inteiro — do início de
`<div className="lista" style={{ marginTop: 8 }}>` até o fim do `<Sheet>` — por:

```tsx
      <button className="botao-ver-mais" style={{ marginTop: 8 }} onClick={() => setMostrarLista((v) => !v)}>
        {mostrarLista ? 'Ocultar lançamentos' : 'Ver lançamentos'}
      </button>
      {mostrarLista && (
        <div className="lista" style={{ marginTop: 8 }}>
          {mostrarGrupos && <p className="rotulo-grupo">À vista</p>}
          {aVista.map((i) => (
            <ItemFaturaBotao key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCat}
              onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)} />
          ))}
          {mostrarGrupos && <p className="rotulo-grupo" style={{ marginTop: 6 }}>Parceladas</p>}
          {parceladas.map((i) => (
            <ItemFaturaBotao key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCat}
              onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)} />
          ))}
          {fatura.itens.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
        </div>
      )}
      <Sheet aberto={editando != null} onFechar={() => setEditando(null)} rotulo="Editar compra">
        {editando && <FormCompra cartao={cartao} compra={editando} onFechar={() => setEditando(null)} />}
      </Sheet>
    </div>
  );
}

function ItemFaturaBotao({ item, nomeCat, onClick }: {
  item: Fatura['itens'][number]; nomeCat: (id: string) => string; onClick: () => void;
}) {
  return (
    <button className="item" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={onClick}>
      <div className="cresce">
        <div>{item.descricao ?? nomeCat(item.categoriaCartaoId)}</div>
        <div className="sub">
          {item.data.split('-').reverse().join('/')} · {nomeCat(item.categoriaCartaoId)}
          {item.totalParcelas > 1 ? ` · ${item.parcela}/${item.totalParcelas}` : ''}
        </div>
      </div>
      <span className="valor-gasto">{formatarBRL(item.valorCent)}</span>
    </button>
  );
}
```

(o resumo por categoria acima da lista, `resumo.map(...)`, não muda — continua sempre
visível, só a lista detalhada de lançamentos fica atrás do toggle.)

- [ ] **Step 3: Ajustar `src/ui/TelaCartao.test.tsx` — o teste de edição da Task 2 precisa abrir a lista antes de clicar no item**

O teste `'editar uma compra existente abre o formulário num Sheet'` (adicionado na Task 2)
precisa clicar em "Ver lançamentos" antes de encontrar o item `'mercado'`:

```tsx
it('editar uma compra existente abre o formulário num Sheet', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    const compra = await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-01',
      valorTotal: 5000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver lançamentos' }));
    await userEvent.click(await screen.findByText('mercado'));
    expect(await screen.findByRole('dialog', { name: 'Editar compra' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar compra' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(async () => {
      expect(await db.comprasCartao.get(compra.id)).toBeUndefined();
    });
  } finally { vi.useRealTimers(); }
});
```

Adicionar um teste novo para o agrupamento e a ordenação:

```tsx
it('agrupa lançamentos em À vista/Parceladas, mais recentes primeiro', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box, cartao, catCartao } = await montarCartao();
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-04',
      valorTotal: 41230, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-15',
      valorTotal: 4490, parcelas: 1, descricao: 'Streaming',
    }, '2027-12-31');
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 28900, parcelas: 3, descricao: 'Notebook',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
    render(<TelaCartao />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver lançamentos' }));
    const grupos = screen.getAllByText(/À vista|Parceladas/).map((el) => el.textContent);
    expect(grupos).toEqual(['À vista', 'Parceladas']);

    const itens = screen.getAllByText(/Mercado|Streaming|Notebook/).map((el) => el.textContent);
    // dentro de "À vista": Streaming (15/07) antes de Mercado (04/07); "Notebook" é a parcelada.
    expect(itens.indexOf('Streaming')).toBeLessThan(itens.indexOf('Mercado'));
    expect(itens.indexOf('Notebook')).toBeGreaterThan(itens.indexOf('Mercado'));
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/ui/TelaCartao.test.tsx`
Expected: PASS, incluindo os 2 testes novos/ajustados.

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test`
Expected: tudo passa.

Run: `npm run build`
Expected: sem erros de tipo ou de build.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx src/styles.css
git commit -m "feat(cartao): lançamentos colapsados por padrão, agrupados em À vista/Parceladas"
```

---

### Task 6: Atualizar `docs/estilo-visual.md`

O guia de estilo (`docs/estilo-visual.md`) documenta o catálogo de classes — adiciona as duas
classes novas desta task (`.rotulo-grupo`, `.botao-ver-mais`) à tabela existente.

**Files:**
- Modify: `docs/estilo-visual.md`

- [ ] **Step 1: Adicionar as duas classes na tabela "Catálogo de classes"**

Na tabela de `docs/estilo-visual.md`, logo após a linha de `.rotulo`, adicionar:

```markdown
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.botao-ver-mais` | link azul de mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/estilo-visual.md
git commit -m "docs: registra .rotulo-grupo e .botao-ver-mais no guia de estilo"
```

---

## Verificação final

- [ ] `npm run test` — toda a suíte passa.
- [ ] `npm run build` — sem erros.
- [ ] Conferir no celular via `npm run preview -- --host` (hábito do projeto): FAB abre o
  popup em qualquer aba; os 3 cenários de quantidade de cartões (0/1/2+) funcionam; editar
  uma compra abre em Sheet; a fatura fica colapsada por padrão e, ao expandir, mostra os
  grupos "À vista"/"Parceladas" com os mais recentes primeiro.
