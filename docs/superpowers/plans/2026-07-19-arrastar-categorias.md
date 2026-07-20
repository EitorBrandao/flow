# Arrastar para reordenar categorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os botões ↑/↓ de `Categorias.tsx`/`CategoriasCartao.tsx` por um handle de
arrastar (framer-motion `Reorder`), mover o formulário de criar para o topo de cada tela, e
separar categorias arquivadas em sua própria seção (misturando tipos em `Categorias.tsx`).

**Architecture:** Uma seção de domínio pura em `src/domain/categorias.ts` ganha duas funções
novas (`diffOrdem`, `proximaOrdem`) usadas por ambas as telas, evitando duplicar a lógica de
recálculo de `ordem`. Os comparadores existentes (`compararCategorias`,
`compararCategoriasCartao`) passam a tratar "arquivada" como um grupo à parte, sempre por
último. As duas telas de Ajustes usam `Reorder.Group`/`Reorder.Item` do framer-motion, um
grupo por seção (Ganho/Gasto/Arquivados em Categorias; ativas/Arquivados em
CategoriasCartao), com um subcomponente de item que chama `useDragControls()` para restringir
o arraste ao handle.

**Tech Stack:** React 18 + TypeScript, framer-motion (`Reorder`, `useDragControls` — já é
dependência do projeto), lucide-react (`GripVertical`, `Pencil`), Vitest + Testing Library.

## Global Constraints

- Nenhuma biblioteca nova — usar `Reorder`/`useDragControls` do framer-motion já instalado.
- Sem reordenar via teclado — os botões ↑/↓ somem por completo, sem alternativa (decisão
  explícita do brainstorm).
- Sem campo novo no schema / sem migração Dexie — `ordem` continua um único `number` por
  categoria; a separação em seções é só de exibição + regra de qual grupo "possui" o valor
  de `ordem` em cada momento.
- Sem customizar a física do arraste — usar o spring padrão do `Reorder.Item` do
  framer-motion, sem `transition` custom.
- Não inventar classes CSS novas — reaproveitar `.botao`, `.lista`, `.item`, `.rotulo-grupo`,
  `.badge`, `.linha`, `.campo` (já cadastradas em `docs/estilo/catalogo.md`).
- Efeito colateral aceito e documentado: `aggregations.ts` (aba Análises) usa
  `compararCategorias` sem filtrar arquivadas — uma categoria arquivada com histórico passa a
  aparecer depois de todas as ativas, em vez de intercalada. Não precisa de código extra, é
  automático pela mudança do comparador.

---

## Task 1: Domínio — comparadores + recálculo de `ordem`

**Files:**
- Modify: `src/domain/categorias.ts`
- Test: `src/domain/categorias.test.ts`

**Interfaces:**
- Produces:
  - `compararCategorias(a: Categoria, b: Categoria): number` (assinatura inalterada, grupo
    interno mudou)
  - `compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number` (assinatura
    inalterada, grupo interno mudou)
  - `diffOrdem<T extends { id: ID; ordem: number }>(novaOrdem: readonly T[]): Array<{ id: ID; ordem: number }>`
  - `proximaOrdem(itensDoGrupo: readonly { ordem: number }[]): number`
- Consumido por: Task 3 (`Categorias.tsx`) e Task 4 (`CategoriasCartao.tsx`).

- [ ] **Step 1: Escrever os testes que falham**

Substitua o conteúdo de `src/domain/categorias.test.ts` por:

```ts
import type { Categoria, CategoriaCartao } from './types';
import { compararCategorias, compararCategoriasCartao, diffOrdem, proximaOrdem } from './categorias';

const ts = { criadoEm: '2026-07-10T12:00:00.000Z', alteradoEm: '2026-07-10T12:00:00.000Z' };

const salario: Categoria = { id: 'sal', boxId: 'b', nome: 'salário', tipo: 'ganho', ordem: 2, arquivada: false, ...ts };
const aluguel: Categoria = { id: 'alu', boxId: 'b', nome: 'aluguel', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const mercado: Categoria = { id: 'mer', boxId: 'b', nome: 'mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...ts };
const pix: Categoria = { id: 'pix', boxId: 'b', nome: 'pix', tipo: 'gasto', ordem: 0, arquivada: false, ...ts };
const salarioArquivado: Categoria = { id: 'sal-arq', boxId: 'b', nome: 'salário antigo', tipo: 'ganho', ordem: 0, arquivada: true, ...ts };
const aluguelArquivado: Categoria = { id: 'alu-arq', boxId: 'b', nome: 'aluguel antigo', tipo: 'gasto', ordem: 0, arquivada: true, ...ts };

it('ganhos vêm antes de gastos, mesmo com ordem maior', () => {
  expect([mercado, salario].sort(compararCategorias).map((c) => c.id)).toEqual(['sal', 'mer']);
});

it('dentro do mesmo tipo, ordena pela ordem definida', () => {
  expect([mercado, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'mer']);
});

it('empate de ordem desempata por nome', () => {
  expect([pix, aluguel].sort(compararCategorias).map((c) => c.id)).toEqual(['alu', 'pix']);
});

it('arquivadas vêm sempre por último, mesmo com ordem menor que as ativas', () => {
  expect([salarioArquivado, mercado].sort(compararCategorias).map((c) => c.id)).toEqual(['mer', 'sal-arq']);
});

it('arquivadas de tipos diferentes se misturam na mesma seção, por ordem e depois nome', () => {
  expect([salarioArquivado, aluguelArquivado].sort(compararCategorias).map((c) => c.id)).toEqual(['alu-arq', 'sal-arq']);
});

const catsCartao: CategoriaCartao[] = [
  { id: 'c1', cartaoId: 'k', nome: 'streaming', ordem: 1, arquivada: false, ...ts },
  { id: 'c2', cartaoId: 'k', nome: 'mercado', ordem: 0, arquivada: false, ...ts },
  { id: 'c3', cartaoId: 'k', nome: 'farmácia', ordem: 0, arquivada: false, ...ts },
];
const catCartaoArquivada: CategoriaCartao = { id: 'c4', cartaoId: 'k', nome: 'antiga', ordem: 0, arquivada: true, ...ts };

it('categorias de cartão: ordem, depois nome', () => {
  expect([...catsCartao].sort(compararCategoriasCartao).map((c) => c.id)).toEqual(['c3', 'c2', 'c1']);
});

it('categorias de cartão arquivadas vêm sempre por último', () => {
  expect([catCartaoArquivada, ...catsCartao].sort(compararCategoriasCartao).map((c) => c.id))
    .toEqual(['c3', 'c2', 'c1', 'c4']);
});

it('proximaOrdem: grupo vazio começa em 0', () => {
  expect(proximaOrdem([])).toBe(0);
});

it('proximaOrdem: continua depois do maior ordem existente no grupo', () => {
  expect(proximaOrdem([{ ordem: 3 }, { ordem: 1 }])).toBe(4);
});

it('diffOrdem: nenhuma mudança quando a ordem já bate com o índice', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([]);
});

it('diffOrdem: recalcula só os itens que mudaram de posição', () => {
  const itens = [{ id: 'a', ordem: 0 }, { id: 'c', ordem: 2 }, { id: 'b', ordem: 1 }];
  expect(diffOrdem(itens)).toEqual([{ id: 'c', ordem: 1 }, { id: 'b', ordem: 2 }]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: FAIL — `diffOrdem`/`proximaOrdem` não existem ainda (erro de import/undefined), e os
dois testes novos de "arquivada por último" falham contra a implementação atual.

- [ ] **Step 3: Implementar**

Substitua o conteúdo de `src/domain/categorias.ts` por:

```ts
import type { Categoria, CategoriaCartao, ID } from './types';

// Ordem canônica definida pelo usuário em Ajustes: ganhos antes de gastos, arquivadas
// sempre por último (grupo à parte, misturando os dois tipos); dentro do grupo, `ordem`
// decide e `nome` desempata — existem `ordem` duplicadas na prática (ex.: categoria de
// fatura nasce com ordem 0) e a ordem vinda do banco é arbitrária.
function grupoCategoria(c: Categoria): number {
  if (c.arquivada) return 2;
  return c.tipo === 'ganho' ? 0 : 1;
}

export function compararCategorias(a: Categoria, b: Categoria): number {
  const grupoA = grupoCategoria(a);
  const grupoB = grupoCategoria(b);
  if (grupoA !== grupoB) return grupoA - grupoB;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

export function compararCategoriasCartao(a: CategoriaCartao, b: CategoriaCartao): number {
  if (a.arquivada !== b.arquivada) return a.arquivada ? 1 : -1;
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.nome.localeCompare(b.nome);
}

interface ComOrdem { id: ID; ordem: number }

// Depois de um arraste, o índice 0-based de cada item na nova ordem vira o novo `ordem` a
// persistir; só devolve os que realmente mudaram, pra não escrever no banco à toa.
export function diffOrdem<T extends ComOrdem>(novaOrdem: readonly T[]): Array<{ id: ID; ordem: number }> {
  return novaOrdem
    .map((item, ordem) => ({ id: item.id, ordem }))
    .filter((item, i) => item.ordem !== novaOrdem[i].ordem);
}

// Próxima posição livre no fim de um grupo — usado tanto ao criar uma categoria quanto ao
// mover uma categoria pra outro grupo (arquivar/restaurar).
export function proximaOrdem(itensDoGrupo: readonly { ordem: number }[]): number {
  return Math.max(-1, ...itensDoGrupo.map((c) => c.ordem)) + 1;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/domain/categorias.test.ts`
Expected: PASS (13 testes)

- [ ] **Step 5: Commit**

```bash
git add src/domain/categorias.ts src/domain/categorias.test.ts
git commit -m "feat(categorias): arquivadas viram grupo à parte + helpers de reordenar"
```

---

## Task 2: Guia de estilo — receita de arraste em `transversais.md`

Mudança de nível 6 (tipo de animação novo, não coberto pela tabela existente) — a spec
`docs/superpowers/specs/2026-07-19-arrastar-categorias-design.md` já documenta a decisão;
esta task só espelha a receita no guia, como o próprio guia exige.

**Files:**
- Modify: `docs/estilo/transversais.md`

- [ ] **Step 1: Adicionar a linha na tabela de movimento**

Em `docs/estilo/transversais.md`, na tabela sob "## Movimento (framer-motion)", adicione uma
linha depois da linha "Sheet (entrada)":

```markdown
| Reordenar lista (arrastar) | `Reorder.Group`/`Reorder.Item` do framer-motion, `axis="y"`, física padrão (spring interno do framer-motion) — não customizar `transition` |
```

- [ ] **Step 2: Conferir a tabela renderizada**

Abra o arquivo e confira visualmente que a tabela Markdown continua com as colunas alinhadas
(cada linha começa e termina com `|`, mesma contagem de `|` que as linhas vizinhas).

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/transversais.md
git commit -m "docs(estilo): registra receita de arrastar-para-reordenar em transversais.md"
```

---

## Task 3: Tela Categorias — 3 seções, criar no topo, arrastar

**Files:**
- Modify: `src/ui/ajustes/Categorias.tsx`
- Modify: `src/ui/ajustes/Categorias.test.tsx`

**Interfaces:**
- Consome: `compararCategorias`, `diffOrdem`, `proximaOrdem` de `../../domain/categorias`
  (Task 1).
- Não expõe nada consumido por outras tasks — tela folha.

- [ ] **Step 1: Escrever os testes novos (mantendo os 2 existentes)**

Abra `src/ui/ajustes/Categorias.test.tsx` e acrescente estes dois testes ao final do arquivo
(mantenha os dois testes já existentes — "renomeia uma categoria..." e "categoria da fatura
de um cartão..." — sem alteração):

```ts
it('arquivar move a categoria para a seção Arquivados, com badge de tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivados')).toBeInTheDocument();
  expect(screen.getByText('gasto')).toBeInTheDocument();
});

it('restaurar devolve a categoria para a seção do seu tipo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.atualizarCategoria(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });

  render(<Categorias />);
  expect(screen.getByText('Arquivados')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();
  const atualizado = await db.categorias.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});
```

- [ ] **Step 2: Rodar e confirmar que os dois testes novos falham**

Run: `npx vitest run src/ui/ajustes/Categorias.test.tsx`
Expected: FAIL nos 2 testes novos (não existe seção "Arquivados" na tela atual); os 2 testes
antigos continuam passando.

- [ ] **Step 3: Reescrever `Categorias.tsx`**

Substitua o conteúdo de `src/ui/ajustes/Categorias.tsx` por:

```tsx
import { useId, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { diffOrdem, proximaOrdem } from '../../domain/categorias';
import { categoriasFaturaIds } from '../../domain/fatura';
import type { Categoria, TipoCategoria } from '../../domain/types';
import { useApp } from '../../state/store';

interface ItemProps {
  cat: Categoria;
  editando: boolean;
  nomeEdit: string;
  uidEditar: string;
  mostrarBadgeTipo: boolean;
  onEditarNome: (v: string) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: () => void;
  onAlternarArquivada: () => void;
}

function ItemCategoria({
  cat, editando, nomeEdit, uidEditar, mostrarBadgeTipo,
  onEditarNome, onIniciarEdicao, onCancelarEdicao, onSalvarEdicao, onAlternarArquivada,
}: ItemProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat} as="div" className="item" style={{ opacity: cat.arquivada ? 0.5 : 1 }}
      dragListener={false} dragControls={controls}
    >
      {editando ? (
        <>
          <div className="campo cresce">
            <label htmlFor={uidEditar}>Editar nome</label>
            <input id={uidEditar} value={nomeEdit} onChange={(e) => onEditarNome(e.target.value)} />
          </div>
          <button className="botao botao-primario" onClick={onSalvarEdicao}>Salvar</button>
          <button className="botao" onClick={onCancelarEdicao}>Cancelar</button>
        </>
      ) : (
        <>
          <button className="botao" aria-label="Arrastar para reordenar" onPointerDown={(e) => controls.start(e)}>
            <GripVertical size={16} />
          </button>
          <span className="cresce">
            {cat.nome} {mostrarBadgeTipo && <span className="badge">{cat.tipo}</span>}
          </span>
          <button className="botao" aria-label="Editar" onClick={onIniciarEdicao}><Pencil size={16} /></button>
          <button className="botao" onClick={onAlternarArquivada}>
            {cat.arquivada ? 'Restaurar' : 'Arquivar'}
          </button>
        </>
      )}
    </Reorder.Item>
  );
}

export default function Categorias() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState<string>(dados?.boxes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const uid = useId();
  if (!dados) return null;
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const cats = dados.categorias.filter((c) => c.boxId === boxId && !ocultas.has(c.id));
  const ganhos = cats.filter((c) => c.tipo === 'ganho' && !c.arquivada);
  const gastos = cats.filter((c) => c.tipo === 'gasto' && !c.arquivada);
  const arquivadas = cats.filter((c) => c.arquivada);

  async function criar() {
    if (!nome.trim() || !boxId) return;
    const irmas = cats.filter((c) => c.tipo === tipo && !c.arquivada);
    await repo.salvarCategoria({ boxId, nome: nome.trim(), tipo, ordem: proximaOrdem(irmas) });
    await recarregar();
    setNome('');
  }

  async function reordenar(novaOrdem: Categoria[]) {
    await Promise.all(diffOrdem(novaOrdem).map((a) => repo.atualizarCategoria(a.id, { ordem: a.ordem })));
    await recarregar();
  }

  async function alternarArquivada(cat: Categoria) {
    const destino = cat.arquivada ? cats.filter((c) => c.tipo === cat.tipo && !c.arquivada) : arquivadas;
    await repo.atualizarCategoria(cat.id, { arquivada: !cat.arquivada, ordem: proximaOrdem(destino) });
    await recarregar();
  }

  function iniciarEdicao(id: string, nomeAtual: string) {
    setEditandoId(id);
    setNomeEdit(nomeAtual);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEdit('');
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return;
    await repo.atualizarCategoria(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  function props(c: Categoria, mostrarBadgeTipo: boolean): ItemProps {
    return {
      cat: c,
      editando: editandoId === c.id,
      nomeEdit,
      uidEditar: `${uid}-editar`,
      mostrarBadgeTipo,
      onEditarNome: setNomeEdit,
      onIniciarEdicao: () => iniciarEdicao(c.id, c.nome),
      onCancelarEdicao: cancelarEdicao,
      onSalvarEdicao: salvarEdicao,
      onAlternarArquivada: () => alternarArquivada(c),
    };
  }

  return (
    <div className="tela">
      <h2>Categorias</h2>
      <div className="campo">
        <label htmlFor={`${uid}-box`}>Box</label>
        <select id={`${uid}-box`} value={boxId} onChange={(e) => setBoxId(e.target.value)}>
          {dados.boxes.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
      </div>

      <div className="linha">
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor={`${uid}-nova`}>Nova categoria</label>
          <input id={`${uid}-nova`} placeholder="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-tipo`}>Tipo</label>
          <select id={`${uid}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)}>
            <option value="gasto">gasto</option>
            <option value="ganho">ganho</option>
          </select>
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={criar}>Criar</button>
      </div>

      <p className="rotulo-grupo">Ganho</p>
      <Reorder.Group as="div" className="lista" axis="y" values={ganhos} onReorder={reordenar}>
        {ganhos.map((c) => <ItemCategoria key={c.id} {...props(c, false)} />)}
      </Reorder.Group>

      <p className="rotulo-grupo">Gasto</p>
      <Reorder.Group as="div" className="lista" axis="y" values={gastos} onReorder={reordenar}>
        {gastos.map((c) => <ItemCategoria key={c.id} {...props(c, false)} />)}
      </Reorder.Group>

      {arquivadas.length > 0 && (
        <>
          <p className="rotulo-grupo">Arquivados</p>
          <Reorder.Group as="div" className="lista" axis="y" values={arquivadas} onReorder={reordenar}>
            {arquivadas.map((c) => <ItemCategoria key={c.id} {...props(c, true)} />)}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/ajustes/Categorias.test.tsx`
Expected: PASS (4 testes: os 2 antigos + os 2 novos)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/Categorias.tsx src/ui/ajustes/Categorias.test.tsx
git commit -m "feat(categorias): arrastar pra reordenar, criar no topo, secao Arquivados"
```

---

## Task 4: Tela Categorias do cartão — mesmo padrão, sem `tipo`

**Files:**
- Modify: `src/ui/ajustes/CategoriasCartao.tsx`
- Create: `src/ui/ajustes/CategoriasCartao.test.tsx`

**Interfaces:**
- Consome: `diffOrdem`, `proximaOrdem` de `../../domain/categorias` (Task 1).

- [ ] **Step 1: Escrever o arquivo de teste (não existe ainda)**

Crie `src/ui/ajustes/CategoriasCartao.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import CategoriasCartao from './CategoriasCartao';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function prepararCartao() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cartao = await repo.salvarCartao({ boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
  return cartao;
}

it('renomeia uma categoria de cartão existente via edição inline', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
  const input = screen.getByLabelText('Editar nome');
  await userEvent.clear(input);
  await userEvent.type(input, 'supermercado');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText('supermercado')).toBeInTheDocument();
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.nome).toBe('supermercado');
});

it('arquivar move a categoria de cartão para a seção Arquivados', async () => {
  const cartao = await prepararCartao();
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));

  expect(await screen.findByText('Arquivados')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
});

it('restaurar devolve a categoria de cartão pra lista ativa', async () => {
  const cartao = await prepararCartao();
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  await repo.atualizarCategoriaCartao(cat.id, { arquivada: true, ordem: 0 });
  await useApp.getState().iniciar();

  render(<CategoriasCartao />);
  expect(screen.getByText('Arquivados')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));

  expect(screen.queryByText('Arquivados')).not.toBeInTheDocument();
  const atualizado = await db.categoriasCartao.get(cat.id);
  expect(atualizado?.arquivada).toBe(false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/ajustes/CategoriasCartao.test.tsx`
Expected: FAIL — a tela atual não tem alça de arrastar nem seção "Arquivados"; o botão
"Editar" hoje é o emoji `✏️` sem `aria-label` do lucide (`getByRole('button', { name: 'Editar' })`
ainda funciona pelo `aria-label` já existente, mas os testes de Arquivados falham).

- [ ] **Step 3: Reescrever `CategoriasCartao.tsx`**

Substitua o conteúdo de `src/ui/ajustes/CategoriasCartao.tsx` por:

```tsx
import { useId, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { diffOrdem, proximaOrdem } from '../../domain/categorias';
import type { CategoriaCartao } from '../../domain/types';
import { useApp } from '../../state/store';

interface ItemProps {
  cat: CategoriaCartao;
  editando: boolean;
  nomeEdit: string;
  uidEditar: string;
  onEditarNome: (v: string) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: () => void;
  onAlternarArquivada: () => void;
}

function ItemCategoriaCartao({
  cat, editando, nomeEdit, uidEditar,
  onEditarNome, onIniciarEdicao, onCancelarEdicao, onSalvarEdicao, onAlternarArquivada,
}: ItemProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat} as="div" className="item" style={{ opacity: cat.arquivada ? 0.5 : 1 }}
      dragListener={false} dragControls={controls}
    >
      {editando ? (
        <>
          <div className="campo cresce">
            <label htmlFor={uidEditar}>Editar nome</label>
            <input id={uidEditar} value={nomeEdit} onChange={(e) => onEditarNome(e.target.value)} />
          </div>
          <button className="botao botao-primario" onClick={onSalvarEdicao}>Salvar</button>
          <button className="botao" onClick={onCancelarEdicao}>Cancelar</button>
        </>
      ) : (
        <>
          <button className="botao" aria-label="Arrastar para reordenar" onPointerDown={(e) => controls.start(e)}>
            <GripVertical size={16} />
          </button>
          <span className="cresce">{cat.nome}</span>
          <button className="botao" aria-label="Editar" onClick={onIniciarEdicao}><Pencil size={16} /></button>
          <button className="botao" onClick={onAlternarArquivada}>
            {cat.arquivada ? 'Restaurar' : 'Arquivar'}
          </button>
        </>
      )}
    </Reorder.Item>
  );
}

export default function CategoriasCartao() {
  const { dados, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const uid = useId();
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Categorias do cartão</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartaoId);
  const ativas = cats.filter((c) => !c.arquivada);
  const arquivadas = cats.filter((c) => c.arquivada);

  async function criar() {
    if (!nome.trim() || !cartaoId) return;
    await repo.salvarCategoriaCartao({ cartaoId, nome: nome.trim(), ordem: proximaOrdem(ativas) });
    await recarregar();
    setNome('');
  }

  async function reordenar(novaOrdem: CategoriaCartao[]) {
    await Promise.all(diffOrdem(novaOrdem).map((a) => repo.atualizarCategoriaCartao(a.id, { ordem: a.ordem })));
    await recarregar();
  }

  async function alternarArquivada(cat: CategoriaCartao) {
    const destino = cat.arquivada ? ativas : arquivadas;
    await repo.atualizarCategoriaCartao(cat.id, { arquivada: !cat.arquivada, ordem: proximaOrdem(destino) });
    await recarregar();
  }

  function iniciarEdicao(id: string, nomeAtual: string) {
    setEditandoId(id);
    setNomeEdit(nomeAtual);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEdit('');
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return;
    await repo.atualizarCategoriaCartao(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  function props(c: CategoriaCartao): ItemProps {
    return {
      cat: c,
      editando: editandoId === c.id,
      nomeEdit,
      uidEditar: `${uid}-editar`,
      onEditarNome: setNomeEdit,
      onIniciarEdicao: () => iniciarEdicao(c.id, c.nome),
      onCancelarEdicao: cancelarEdicao,
      onSalvarEdicao: salvarEdicao,
      onAlternarArquivada: () => alternarArquivada(c),
    };
  }

  return (
    <div className="tela">
      <h2>Categorias do cartão</h2>
      <div className="campo">
        <label htmlFor={`${uid}-cartao`}>Cartão</label>
        <select id={`${uid}-cartao`} value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
          {dados.cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="linha">
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor={`${uid}-nova`}>Nova categoria do cartão</label>
          <input id={`${uid}-nova`} placeholder="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={criar}>Criar</button>
      </div>

      <Reorder.Group as="div" className="lista" axis="y" values={ativas} onReorder={reordenar}>
        {ativas.map((c) => <ItemCategoriaCartao key={c.id} {...props(c)} />)}
      </Reorder.Group>

      {arquivadas.length > 0 && (
        <>
          <p className="rotulo-grupo">Arquivados</p>
          <Reorder.Group as="div" className="lista" axis="y" values={arquivadas} onReorder={reordenar}>
            {arquivadas.map((c) => <ItemCategoriaCartao key={c.id} {...props(c)} />)}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/ajustes/CategoriasCartao.test.tsx`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/CategoriasCartao.tsx src/ui/ajustes/CategoriasCartao.test.tsx
git commit -m "feat(categorias-cartao): arrastar pra reordenar, criar no topo, secao Arquivados"
```

---

## Task 5: Suíte completa, changelog e versão

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS em todos os arquivos, incluindo `src/domain/aggregations.test.ts` e
`src/db/repo.test.ts` (nenhum dos dois tem fixture de categoria arquivada misturada com
ativa, então não são afetados pela mudança do comparador — ver "Global Constraints").
Se algum teste fora do escopo desta plan falhar por depender da ordem antiga de categorias
arquivadas, ajuste o teste para a nova ordem canônica (arquivada sempre por último) antes de
prosseguir.

- [ ] **Step 2: Checar tipos e build**

Run: `npm run build`
Expected: build conclui sem erros de TypeScript (`tsc -b` limpo, saída em `dist/`).

- [ ] **Step 3: Atualizar `CHANGELOG.md`**

No topo de `CHANGELOG.md`, logo após o cabeçalho, adicione:

```markdown
## [0.9.0] - 2026-07-19

### Adicionado

- Seção "Arquivados" em Categorias e Categorias do cartão (Ajustes), separando categorias
  arquivadas das listas ativas.

### Alterado

- Categorias e Categorias do cartão (Ajustes): reordenar passa a ser por arraste (alça),
  no lugar dos botões ↑/↓; formulário de criar categoria subiu para o topo da tela.
```

- [ ] **Step 4: Bump de versão em `package.json`**

Altere `"version": "0.8.0"` para `"version": "0.9.0"` em `package.json`.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): v0.9.0 - arrastar para reordenar categorias"
```

---

## Self-Review

**Cobertura da spec:**
- Biblioteca framer-motion, sem lib nova → Task 3/4 (import de `Reorder`/`useDragControls`).
- Handle `GripVertical`, `aria-label`, `dragListener=false` → Task 3/4.
- Sem alça durante edição inline → Task 3/4 (`ItemCategoria`/`ItemCategoriaCartao` só
  renderizam a alça no branch `!editando`).
- Física padrão, sem customizar → Task 3/4 (nenhuma prop `transition` no `Reorder.Item`);
  registrado no guia → Task 2.
- 3 seções em Categorias / 2 em CategoriasCartao, grupos de arraste independentes → Task 3/4.
- Badge de tipo só na seção Arquivados de Categorias → Task 3 (`mostrarBadgeTipo`).
- Formulário no topo → Task 3/4 (markup reordenado, mesmas classes).
- `compararCategorias`/`compararCategoriasCartao`: arquivada sempre por último → Task 1.
- `ordem` ao arquivar/restaurar vai para o fim do grupo de destino → Task 1 (`proximaOrdem`)
  + Task 3/4 (`alternarArquivada`).
- Persistência do arraste via recálculo denso de índice → Task 1 (`diffOrdem`) + Task 3/4
  (`reordenar`).
- Testes: comparadores, reorder helpers, arquivar/restaurar por seção → Tasks 1, 3, 4.
- CHANGELOG + versão → Task 5.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo step tem código completo.

**Consistência de tipos:** `diffOrdem`/`proximaOrdem` (Task 1) usados com a mesma assinatura
em `Categorias.tsx` e `CategoriasCartao.tsx` (Tasks 3/4); `ItemProps`/`props()` internos a
cada arquivo, sem vazamento de nomes entre os dois.
