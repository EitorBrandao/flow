# Categoria da fatura automática e oculta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastro de cartão para de pedir uma categoria manual para a fatura — o app cria e
mantém essa categoria sozinho, escondida de toda seleção manual, sempre com o nome do cartão;
na aba Fluxo, tocar um lançamento de fatura abre um resumo somente leitura com atalho para a
aba Cartão, em vez do editor genérico.

**Architecture:** `repo.salvarCartao` passa a criar (ou renomear, na edição) a `Categoria`
oculta como parte da própria operação de salvar o cartão — nenhuma mudança de schema, só quem
decide o valor de `categoriaFaturaId` (o repo, não mais o formulário). Uma função pura nova,
`categoriasFaturaIds`, centraliza "quais categorias são ocultas" e é reaproveitada pelos três
lugares de seleção manual (`TelaLancar`, `Categorias`, `LancEditor`). Como a categoria oculta
passa a se chamar igual ao cartão, telas que já leem `categoria.nome` (Fluxo, Hoje, Análises,
Simulador) mostram o nome certo sem mudança própria — só a aba Fluxo ganha lógica nova, porque
também precisa parar de abrir o editor genérico para esses lançamentos.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, Dexie (IndexedDB).

## Global Constraints

- Sem mudança de schema: `Cartao.categoriaFaturaId` continua existindo e obrigatório.
- Cartões já cadastrados não são migrados — a categoria que já usavam só passa a ficar oculta
  a partir de agora, e só é renomeada na próxima vez que o cartão for editado.
- Sem mudança em `TelaHoje.tsx`, `TelaAnalises.tsx`, `TelaSimulador.tsx` — já leem
  `categoria.nome`, funcionam certo de graça.
- Sem agrupamento "À vista"/"Parceladas" no resumo novo da aba Fluxo — é deliberadamente mais
  simples que a tela cheia da aba Cartão.
- Nenhuma mudança de layout/estilo em `TelaLancar` além do filtro de categorias (pílula
  Gasto/Ganho e reposição do botão "Lançar" foram descartadas nesta rodada).
- Rodar `npm run test` e `npm run build` sem erros ao final de cada task.

---

### Task 1: `categoriasFaturaIds` — função pura

Função central que decide "quais categorias são reservadas para receber fatura de algum
cartão" — usada nas Tasks 4, 5 e 6 para não duplicar a mesma lógica de exclusão em três telas.

**Files:**
- Modify: `src/domain/fatura.ts`
- Test: `src/domain/fatura.test.ts`

**Interfaces:**
- Produces: `export function categoriasFaturaIds(cartoes: Cartao[]): Set<ID>` — usada por
  `TelaLancar.tsx` (Task 4), `Categorias.tsx` (Task 5), `LancEditor.tsx` (Task 6).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar ao fim de `src/domain/fatura.test.ts` (depois do `describe('diffSincronizacao', ...)`,
que termina na linha 172):

```ts
describe('categoriasFaturaIds', () => {
  it('retorna o categoriaFaturaId de cada cartão, ativo ou não', () => {
    const ativo: Cartao = { ...cartaoK, id: 'k1', categoriaFaturaId: 'cat1' };
    const inativo: Cartao = { ...cartaoK, id: 'k2', categoriaFaturaId: 'cat2', ativo: false };
    expect(categoriasFaturaIds([ativo, inativo])).toEqual(new Set(['cat1', 'cat2']));
  });

  it('lista vazia de cartões retorna conjunto vazio', () => {
    expect(categoriasFaturaIds([])).toEqual(new Set());
  });
});
```

E atualizar a linha de import no topo do arquivo (linha 2) para incluir a nova função,
mantendo a ordem alfabética já usada:

```ts
import { calcularFaturas, categoriasFaturaIds, datasFaturaDoMes, diffSincronizacao, mesFaturaDaCompra, mesFechamentoDaCompra, valorParcela } from './fatura';
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: FAIL — `categoriasFaturaIds is not exported` (ou `is not a function`).

- [ ] **Step 3: Implementar em `src/domain/fatura.ts`**

Adicionar ao fim do arquivo (depois de `diffSincronizacao`, que termina na linha 146):

```ts

/** Ids das categorias reservadas para receber a fatura de algum cartão (ativo ou não) — não
 *  devem aparecer em nenhuma lista de seleção manual de categoria. */
export function categoriasFaturaIds(cartoes: Cartao[]): Set<ID> {
  return new Set(cartoes.map((c) => c.categoriaFaturaId));
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/domain/fatura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(fatura): categoriasFaturaIds identifica categorias ocultas de cartao"
```

---

### Task 2: `repo.salvarCartao` cria/renomeia a categoria oculta sozinho

O formulário para de escolher `categoriaFaturaId` — o repo cria a categoria na criação do
cartão (mesmo nome do cartão) e a renomeia a cada atualização do cartão, sempre na mesma
transação. Esta task também corrige todos os outros arquivos de teste que hoje passam
`categoriaFaturaId` explicitamente para `repo.salvarCartao` na criação (deixa de existir no
tipo `NovoCartao`), para a suíte inteira continuar verde.

**Files:**
- Modify: `src/db/repo.ts`
- Modify: `src/db/repo.test.ts`
- Modify: `src/ui/AdicionarSheet.test.tsx`
- Modify: `src/ui/FormCompra.test.tsx`
- Modify: `src/ui/TelaCartao.test.tsx`
- Modify: `src/ui/ajustes/Cartoes.test.tsx` (só o teste `'impede segundo cartão ativo...'` —
  o outro teste desse arquivo é reescrito na Task 3)

**Interfaces:**
- Consumes: nada novo.
- Produces: `NovoCartao` sem o campo `categoriaFaturaId` (`{ boxId, nome, diaFechamento,
  diaVencimento }`); `salvarCartao(n: NovoCartao | Cartao, horizonte)` continua com a mesma
  assinatura, mas na criação (`n` sem `id`) ignora qualquer `categoriaFaturaId` (não existe
  mais no tipo) e gera a categoria sozinho; na atualização (`n: Cartao`, com `id`), sincroniza
  o nome da categoria vinculada com `n.nome` a cada chamada (idempotente).

- [ ] **Step 1: Escrever os testes (falhando) em `src/db/repo.test.ts`**

Substituir o `montarCartao()` do `describe('cartão de crédito', ...)` (linhas 301-311 hoje,
que cria `catFlow` e passa `categoriaFaturaId: catFlow.id`) por:

```ts
  async function montarCartao() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    return { box, cartao, catCartao };
  }
```

(Nenhum outro teste do `describe` destrutura `catFlow` — só o próprio `montarCartao` usava.)

Adicionar dois testes novos logo depois do `montarCartao()`, antes de `it('compra parcelada
gera um previsto por fatura', ...)`:

```ts
  it('cria a categoria da fatura automaticamente, oculta, com o nome do cartão', async () => {
    const { box, cartao } = await montarCartao();
    const categoria = await db.categorias.get(cartao.categoriaFaturaId);
    expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto', arquivada: false });
  });

  it('editar o nome do cartão renomeia a categoria da fatura junto', async () => {
    const { cartao } = await montarCartao();
    await repo.salvarCartao({ ...cartao, nome: 'Nubank Ultravioleta' }, '2027-12-31');
    const categoria = await db.categorias.get(cartao.categoriaFaturaId);
    expect(categoria?.nome).toBe('Nubank Ultravioleta');
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/db/repo.test.ts`
Expected: FAIL — TypeScript aponta que `categoriaFaturaId` é obrigatório em `NovoCartao` mas
não foi passado (o `montarCartao()` novo não compila ainda contra o `repo.ts` atual).

- [ ] **Step 3: Implementar em `src/db/repo.ts`**

Substituir a interface `NovoCartao` e a função `salvarCartao` (linhas 309-324 hoje):

```ts
export interface NovoCartao {
  boxId: ID; nome: string; diaFechamento: number; diaVencimento: number;
}

export async function salvarCartao(n: NovoCartao | Cartao, horizonte: ISODate): Promise<Cartao> {
  const agora = agoraISO();
  const cartao: Cartao = 'id' in n
    ? { ...n, alteradoEm: agora }
    : { id: novoId(), ativo: true, criadoEm: agora, alteradoEm: agora, categoriaFaturaId: novoId(), ...n };
  await db.transaction('rw', [db.cartoes, db.categorias, db.config], async () => {
    if ('id' in n) {
      await db.categorias.update(cartao.categoriaFaturaId, { nome: cartao.nome, alteradoEm: agora });
    } else {
      await db.categorias.add({
        id: cartao.categoriaFaturaId, boxId: cartao.boxId, nome: cartao.nome, tipo: 'gasto',
        ordem: 0, arquivada: false, criadoEm: agora, alteradoEm: agora,
      });
    }
    await db.cartoes.put(cartao);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
  return cartao;
}
```

(`categoriaFaturaId: novoId()` no spread de criação nunca é sobrescrito por `...n`, porque
`NovoCartao` não tem mais esse campo — só existe para dar um id à categoria antes de criá-la,
dentro da mesma transação.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/db/repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Corrigir os outros arquivos de teste que criavam cartão com `categoriaFaturaId` explícito**

Em `src/ui/AdicionarSheet.test.tsx`, nos dois testes que hoje criam `catFlow` (linhas 49-61 e
63-80), remover a linha `const catFlow = await repo.salvarCategoria(...)` e o campo
`categoriaFaturaId: catFlow.id,` das chamadas a `repo.salvarCartao`:

```ts
it('1 cartão ativo: "Compra no cartão" pula direto para o formulário', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
});

it('2+ cartões ativos: "Compra no cartão" mostra lista de escolha antes do formulário', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28,
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

Em `src/ui/FormCompra.test.tsx`, o `montarCartao()` (linhas 15-25) vira:

```ts
async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}
```

Em `src/ui/TelaCartao.test.tsx`, o `montarCartao()` (linhas 15-25) vira, igual ao anterior:

```ts
async function montarCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  return { box, cartao, catCartao };
}
```

Em `src/ui/ajustes/Cartoes.test.tsx`, só o teste `'impede segundo cartão ativo na mesma
box'` (linhas 43-57) muda — troca a destructuring de `montarBox()` (não precisa mais de
`cat`) e remove `categoriaFaturaId` da chamada direta a `repo.salvarCartao`:

```ts
it('impede segundo cartão ativo na mesma box', async () => {
  const { box } = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
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

(O outro teste desse arquivo, `'cadastra um cartão com a categoria "cartão" pré-selecionada'`,
e o `montarBox()` que ainda cria `cat` são reescritos na Task 3, que remove o próprio campo do
formulário — deixar como está por enquanto não quebra nada, `cat` só fica sem uso nesse teste
específico até lá.)

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm run test`
Expected: todos os testes passam.

- [ ] **Step 7: Rodar o build (typecheck)**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts src/ui/AdicionarSheet.test.tsx src/ui/FormCompra.test.tsx src/ui/TelaCartao.test.tsx src/ui/ajustes/Cartoes.test.tsx
git commit -m "feat(cartao): categoria da fatura e criada e renomeada automaticamente pelo repo"
```

---

### Task 3: Ajustes → Cartões — remove a seleção manual de categoria

O formulário para de pedir "Categoria da fatura". `salvar()` não monta mais esse campo — o
repo (Task 2) cuida de tudo.

**Files:**
- Modify: `src/ui/ajustes/Cartoes.tsx`
- Modify: `src/ui/ajustes/Cartoes.test.tsx`

**Interfaces:**
- Consumes: `repo.salvarCartao` (Task 2, já não recebe `categoriaFaturaId` na criação).

- [ ] **Step 1: Escrever o teste (falhando)**

Substituir todo o `src/ui/ajustes/Cartoes.test.tsx` por:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
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
  return box;
}

it('cadastra um cartão sem pedir categoria e cria a categoria da fatura sozinho', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  expect(screen.queryByLabelText('Categoria da fatura')).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Nome do cartão'), 'Nubank');
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  // aguarda o recarregar() da criação assentar (evita corrida com o beforeEach do próximo teste)
  await waitFor(() => expect(screen.getByText(/Nubank/)).toBeInTheDocument());

  const cartoes = await db.cartoes.toArray();
  expect(cartoes).toHaveLength(1);
  expect(cartoes[0]).toMatchObject({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5, ativo: true });
  const categoria = await db.categorias.get(cartoes[0].categoriaFaturaId);
  expect(categoria).toMatchObject({ boxId: box.id, nome: 'Nubank', tipo: 'gasto' });
});

it('impede segundo cartão ativo na mesma box', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
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

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: FAIL — o primeiro teste espera `categoriaFaturaId` auto-gerado, mas o componente
ainda manda o valor escolhido no `<select>` (ou string vazia, já que não tem mais categoria
"cartão" pré-criada no novo `montarBox()`).

- [ ] **Step 3: Implementar em `src/ui/ajustes/Cartoes.tsx`**

Substituir o arquivo inteiro por:

```tsx
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function Cartoes() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState(dados?.boxes.find((b) => b.saldoInicial != null)?.id ?? '');
  const [nome, setNome] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('28');
  const [diaVencimento, setDiaVencimento] = useState('5');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const nomeBox = (id: string) => dados.boxes.find((b) => b.id === id)?.nome ?? '?';

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  function editar(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    setEditandoId(id); setBoxId(c.boxId); setNome(c.nome);
    setDiaFechamento(String(c.diaFechamento)); setDiaVencimento(String(c.diaVencimento));
    setAviso('');
  }

  async function salvar() {
    if (!nome.trim() || !boxId) return;
    if (dados!.cartoes.some((c) => c.boxId === boxId && c.ativo && c.id !== editandoId)) {
      setAviso('Esta box já tem um cartão ativo — desative-o antes de cadastrar outro.');
      return;
    }
    const campos = {
      boxId, nome: nome.trim(), diaFechamento: clampDia(diaFechamento),
      diaVencimento: clampDia(diaVencimento),
    };
    if (editandoId) {
      const original = dados!.cartoes.find((c) => c.id === editandoId)!;
      await repo.salvarCartao({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarCartao(campos, horizonte);
    }
    setEditandoId(null); setNome(''); setAviso('');
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
        <div className="campo">
          <label htmlFor={`${uid}-box`}>Box do cartão</label>
          <select id={`${uid}-box`} value={boxId}
            onChange={(e) => setBoxId(e.target.value)}>
            {dados.boxes.filter((b) => b.saldoInicial != null).map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo cresce">
          <label htmlFor={`${uid}-nome`}>Nome do cartão</label>
          <input id={`${uid}-nome`} placeholder="ex.: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Dia de fechamento</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-vence`}>Dia de vencimento</label>
          <input id={`${uid}-vence`} type="number" min={1} max={31} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>
          {editandoId ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ajustes/Cartoes.tsx src/ui/ajustes/Cartoes.test.tsx
git commit -m "feat(cartao): formulario de cadastro para de pedir categoria da fatura"
```

---

### Task 4: Tela Lançar esconde a categoria da fatura

**Files:**
- Modify: `src/ui/TelaLancar.tsx`
- Modify: `src/ui/TelaLancar.test.tsx`

**Interfaces:**
- Consumes: `categoriasFaturaIds` (Task 1, `../domain/fatura`).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `src/ui/TelaLancar.test.tsx` (depois do último `it`, antes do fim do arquivo):

```ts
it('categoria da fatura de um cartão não aparece na grade de seleção', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);

  expect(screen.getByRole('button', { name: 'mercado' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nubank' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaLancar.test.tsx`
Expected: FAIL — o botão "Nubank" (nome da categoria oculta) aparece na grade.

- [ ] **Step 3: Implementar em `src/ui/TelaLancar.tsx`**

Trocar a linha de import do domínio (linha 3 hoje, `import { parseValorDigitado } from
'../domain/money';`) para incluir a nova importação, mantendo ordem alfabética das linhas de
import:

```ts
import { categoriasFaturaIds } from '../domain/fatura';
import { parseValorDigitado } from '../domain/money';
```

Trocar o cálculo de `categorias` (linhas 26-31 hoje):

```ts
  const ocultas = useMemo(() => categoriasFaturaIds(dados?.cartoes ?? []), [dados]);
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id))
      .sort((a, b) => a.ordem - b.ordem),
    [dados, boxId, tipo, ocultas],
  );
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaLancar.test.tsx`
Expected: PASS (incluindo os testes já existentes, que usam uma categoria manual chamada
"cartão" não vinculada a nenhum `Cartao` — continuam aparecendo normalmente).

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx
git commit -m "feat(lancar): esconde categoria da fatura de cartao na grade de selecao"
```

---

### Task 5: Ajustes → Categorias esconde a categoria da fatura

**Files:**
- Modify: `src/ui/ajustes/Categorias.tsx`
- Modify: `src/ui/ajustes/Categorias.test.tsx`

**Interfaces:**
- Consumes: `categoriasFaturaIds` (Task 1, `../../domain/fatura`).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `src/ui/ajustes/Categorias.test.tsx`:

```ts
it('categoria da fatura de um cartão não aparece na lista de categorias', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);

  expect(screen.getByText('mercado')).toBeInTheDocument();
  expect(screen.queryByText('Nubank')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/ajustes/Categorias.test.tsx`
Expected: FAIL — "Nubank" aparece na lista de categorias.

- [ ] **Step 3: Implementar em `src/ui/ajustes/Categorias.tsx`**

Trocar a linha de import (linha 3 hoje, `import * as repo from '../../db/repo';`) para incluir
a nova importação logo depois, mantendo ordem alfabética:

```ts
import * as repo from '../../db/repo';
import { categoriasFaturaIds } from '../../domain/fatura';
```

Trocar o cálculo de `cats` (linhas 16-18 hoje):

```ts
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const cats = dados.categorias
    .filter((c) => c.boxId === boxId && !ocultas.has(c.id))
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/ajustes/Categorias.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ajustes/Categorias.tsx src/ui/ajustes/Categorias.test.tsx
git commit -m "feat(categorias): esconde categoria da fatura de cartao da lista de ajustes"
```

---

### Task 6: Editor de lançamento esconde a categoria da fatura

**Files:**
- Modify: `src/ui/LancEditor.tsx`
- Modify: `src/ui/LancEditor.test.tsx`

**Interfaces:**
- Consumes: `categoriasFaturaIds` (Task 1, `../domain/fatura`).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `src/ui/LancEditor.test.tsx`:

```ts
it('categoria da fatura de um cartão não aparece no select de categoria do editor', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-05', valor: 5000, status: 'efetivo',
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<LancEditor lanc={lanc} onFechar={() => {}} />);

  expect(screen.getByRole('option', { name: /mercado/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Nubank/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: FAIL — a opção "Nubank (gasto)" aparece no `<select>`.

- [ ] **Step 3: Implementar em `src/ui/LancEditor.tsx`**

Trocar a linha de import (linha 2 hoje, `import * as repo from '../db/repo';`) para incluir a
nova importação logo depois, mantendo ordem alfabética:

```ts
import * as repo from '../db/repo';
import { categoriasFaturaIds } from '../domain/fatura';
```

Trocar o cálculo de `categorias` (linhas 18-20 hoje):

```ts
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const categorias = dados.categorias
    .filter((c) => c.boxId === lanc.boxId && !c.arquivada && !ocultas.has(c.id))
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/LancEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx
git commit -m "feat(lanc-editor): esconde categoria da fatura de cartao do select de categoria"
```

---

### Task 7: Novo componente `FaturaResumo`

Bottom sheet somente leitura: mostra os itens e o total de uma fatura, com um botão "Editar"
que navega para a aba Cartão. Ainda não é usado por ninguém (isso é a Task 8) — esta task só
cria e testa o componente isoladamente.

**Files:**
- Create: `src/ui/FaturaResumo.tsx`
- Test: `src/ui/FaturaResumo.test.tsx`

**Interfaces:**
- Consumes: `calcularFaturas` (`../domain/fatura`), `formatarBRL` (`../domain/money`),
  `useApp` (`../state/store`), `Sheet` (`./Sheet`).
- Produces: `export default function FaturaResumo({ lanc, onFechar }: { lanc: Lancamento;
  onFechar: () => void })`. Usado por `TelaFluxo` na Task 8.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/ui/FaturaResumo.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { agoraISO, novoId, type Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import FaturaResumo from './FaturaResumo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('mostra os itens e o total da fatura, e "Editar" navega para a aba Cartão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 5000, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-01', aba: 'fluxo' });

    const lanc = (await db.lancamentos.toArray()).find((l) => l.origem === 'cartao') as Lancamento;
    const onFechar = vi.fn();
    render(<FaturaResumo lanc={lanc} onFechar={onFechar} />);

    expect(await screen.findByRole('dialog', { name: 'Fatura Nubank' })).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useApp.getState().aba).toBe('cartao');
    expect(onFechar).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/FaturaResumo.test.tsx`
Expected: FAIL — `Cannot find module './FaturaResumo'`.

- [ ] **Step 3: Criar `src/ui/FaturaResumo.tsx`**

```tsx
import { calcularFaturas } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import Sheet from './Sheet';

export default function FaturaResumo({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { dados, setAba } = useApp();
  if (!dados) return null;
  const cartao = dados.cartoes.find((c) => c.id === lanc.cartaoId);
  if (!cartao) return null;
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const fatura = calcularFaturas(cartao, compras, dados.config.horizonteProjecao)
    .find((f) => f.mes === lanc.faturaMes);
  const itens = fatura?.itens ?? [];
  const nomeCatCartao = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const mesBonito = (lanc.faturaMes ?? '').split('-').reverse().join('/');

  function editar() {
    setAba('cartao');
    onFechar();
  }

  return (
    <Sheet aberto onFechar={onFechar} rotulo={`Fatura ${cartao.nome}`}>
      <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura {mesBonito}</h2>
      <p className="sub" style={{ margin: 0 }}>Total: {formatarBRL(lanc.valor)}</p>
      <div className="lista" style={{ marginTop: 8 }}>
        {itens.map((i) => (
          <div className="item" key={`${i.compraId}:${i.parcela}`}>
            <div className="cresce">
              <div>{i.descricao ?? nomeCatCartao(i.categoriaCartaoId)}</div>
              <div className="sub">
                {i.data.split('-').reverse().join('/')} · {nomeCatCartao(i.categoriaCartaoId)}
                {i.totalParcelas > 1 ? ` · ${i.parcela}/${i.totalParcelas}` : ''}
              </div>
            </div>
            <span className="valor-gasto">{formatarBRL(i.valorCent)}</span>
          </div>
        ))}
        {itens.length === 0 && <p className="sub">Nenhum lançamento nesta fatura.</p>}
      </div>
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="botao botao-primario" onClick={editar}>Editar</button>
        <button className="botao" onClick={onFechar}>Fechar</button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/FaturaResumo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/ui/FaturaResumo.tsx src/ui/FaturaResumo.test.tsx
git commit -m "feat(fluxo): novo componente FaturaResumo, resumo somente leitura de uma fatura"
```

---

### Task 8: Aba Fluxo abre `FaturaResumo` em vez do editor para lançamentos de fatura

**Files:**
- Modify: `src/ui/TelaFluxo.tsx`
- Modify: `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consumes: `FaturaResumo` (Task 7, `./FaturaResumo`).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `src/ui/TelaFluxo.test.tsx`:

```ts
it('lançamento de fatura de cartão abre o resumo em vez do editor, e "Editar" navega para a aba Cartão', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-10',
      valorTotal: 5000, parcelas: 1, descricao: 'Mercado',
    }, '2027-12-31');
    const hoje = '2026-07-01';
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje });

    render(<TelaFluxo />);
    // o item mostra "Nubank" + badge "previsto" no mesmo nó — nome exato não bate, usa regex
    await userEvent.click(await screen.findByRole('button', { name: /Nubank/ }));

    expect(await screen.findByRole('dialog', { name: 'Fatura Nubank' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Previsto' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useApp.getState().aba).toBe('cartao');
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: FAIL — clicar no item abre o `LancEditor` (rótulo "Previsto"), não existe diálogo
"Fatura Nubank".

- [ ] **Step 3: Implementar em `src/ui/TelaFluxo.tsx`**

Adicionar o import do novo componente, logo depois do `import BalanceChart from
'./BalanceChart';` (linha 8 hoje):

```ts
import BalanceChart from './BalanceChart';
import FaturaResumo from './FaturaResumo';
import LancEditor from './LancEditor';
```

Adicionar o novo estado, logo depois de `const [editando, setEditando] = useState<Lancamento |
null>(null);` (linha 21 hoje):

```ts
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [faturaSel, setFaturaSel] = useState<Lancamento | null>(null);
```

Trocar o `onClick` do botão de item (linha 125 hoje):

```tsx
              <button key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => (l.origem === 'cartao' ? setFaturaSel(l) : setEditando(l))}>
```

Adicionar a renderização do novo Sheet, ao lado de `{editando && <LancEditor .../>}` (linha
150 hoje):

```tsx
      {editando && <LancEditor lanc={editando} onFechar={() => setEditando(null)} />}
      {faturaSel && <FaturaResumo lanc={faturaSel} onFechar={() => setFaturaSel(null)} />}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx`
Expected: PASS (incluindo os testes já existentes de busca/período, que não usam cartão).

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npm run test && npm run build`
Expected: sem erros.

- [ ] **Step 6: Verificação manual no navegador**

Run: `npm run preview -- --host` (ou `npm run dev`)

- Cadastrar um cartão em Ajustes → Cartões sem escolher categoria nenhuma.
- Lançar uma compra no cartão (popup "+" → Compra no cartão).
- Conferir que o nome do cartão aparece na aba Fluxo no lugar da fatura.
- Tocar o lançamento da fatura em Fluxo: abre o resumo (não o editor); "Editar" leva para a
  aba Cartão.
- Conferir que a categoria oculta não aparece em Lançar, Ajustes → Categorias, nem no editor
  de um lançamento comum.

- [ ] **Step 7: Commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(fluxo): lancamento de fatura abre FaturaResumo em vez do editor generico"
```

---

## Critérios de sucesso (fim do plano)

1. `npm run test` verde (suíte inteira).
2. `npm run build` sem erros.
3. Fluxo ponta-a-ponta conferido manualmente (Task 8, Step 6).
