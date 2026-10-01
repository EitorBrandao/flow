# A casa mostra de onde vem — plano de implementação

> **Para agentes:** SUB-HABILIDADE OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** com "casa" no topo, mostrar de que box vem cada lançamento, o saldo de cada box, uma fatura de cartão por vez, e pedir a box no Lançar.

**Arquitetura:** só leitura mais um campo de formulário. Sem campo novo, sem mudança em `src/db/` nem `src/backup/`. Um componente novo (`SeloBox`), uma função de domínio nova (`saldosPorBox`), e edições nas telas Hoje, Fluxo, Cartão e Lançar.

**Stack:** React 18, TypeScript, Zustand, Vitest + Testing Library, fake-indexeddb.

Spec: `docs/superpowers/specs/2026-10-01-casa-mostra-de-onde-vem-design.md`. Mockup aprovado em 2026-10-01.

## Restrições globais

- **Worktree:** `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\casa-leitura` (branch `casa-leitura`). Não toque no checkout principal. Antes da primeira edição, rode `git rev-parse --show-toplevel`: o resultado deve terminar em `.worktrees/casa-leitura`.
- Todo texto, comentário, teste e mensagem de commit em **português**. Sem palavra solta em inglês.
- Mensagens de commit terminam com estas duas linhas:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM
  ```
- Dados de teste **sintéticos** (nomes `ana`, `bruno`; valores redondos). Nenhum dado real.
- Valores em centavos inteiros; datas `AAAA-MM-DD`.
- A box de nome `"casa"` é a box real autocriada por `iniciar()`; `boxSel === 'casa'` é o sentinela de consolidação (ver `docs/dominio.md`). Não confunda os dois.
- O selo da box e o saldo por box aparecem **só** com `boxSel === 'casa'`. Numa box só, nenhuma tela muda.
- Não edite `package.json`, `scripts/`, `vite.config.ts`, `tsconfig.json`, `.claude/` nem o topo do `CHANGELOG.md`. Não instale dependência.
- Rode a suíte completa (`npm test`) antes de dizer que terminou cada tarefa. Rodar só o arquivo não basta.
- Arquivos em UTF-8 sem BOM. Use as ferramentas de edição de arquivo, não `Set-Content`.
- Antes de editar UI, leia `docs/estilo/nivel-1-editar-tela.md` e `docs/estilo/catalogo.md`.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/ui/SeloBox.tsx` | criar | selo `.badge` com o nome da box |
| `src/ui/SeloBox.test.tsx` | criar | teste do selo |
| `src/domain/saldoPorBox.ts` | criar | `saldosPorBox`: saldo efetivo de hoje por box |
| `src/domain/saldoPorBox.test.ts` | criar | teste da função |
| `src/ui/TelaHoje.tsx` | editar | selo nos pendentes; linhas de saldo por box |
| `src/ui/TelaFluxo.tsx` | editar | selo na lista; busca pelo nome da box |
| `src/ui/TelaCartao.tsx` | editar | seletor de cartão |
| `src/ui/TelaLancar.tsx` | editar | campo Box na casa |
| `src/ui/TelaHoje.test.tsx`, `TelaFluxo.test.tsx`, `TelaCartao.test.tsx`, `TelaLancar.test.tsx` | editar | testes novos |
| `docs/estilo/catalogo.md` | editar | catalogar `SeloBox` |
| `docs/wiki/*.md`, `docs/dominio.md` | editar | documentação |
| `changelog.d/*.md` | criar | três fragmentos |
| `docs/dossie/` | regenerar | `npm run dossie` |

Pontos de chamada conferidos por grep: `boxIdEfetivo` só muda em `TelaLancar.tsx:59`. `AdicionarSheet.tsx:38` (frequentes) não muda. Nenhum caminho de exclusão, importação, backup ou pagamento muda. `LancamentosSheet` e Análises ficam fora (entrega B).

---

### Tarefa 0: Preparar o worktree

**Arquivos:** nenhum.

- [ ] **Passo 1: Conferir o worktree**

Rode: `git rev-parse --show-toplevel` (dentro de `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\casa-leitura`).
Esperado: caminho terminando em `.worktrees/casa-leitura`.

- [ ] **Passo 2: Instalar as dependências já declaradas**

Rode: `npm ci`
Esperado: termina sem erro. Não altera `package.json` nem `package-lock.json` (`git status --porcelain` vazio).

- [ ] **Passo 3: Rodar a suíte de base**

Rode: `npm test`
Esperado: tudo verde. Se algo falhar já aqui, pare e relate: é falha anterior à mudança.

---

### Tarefa 1: Componente `SeloBox`

**Arquivos:**
- Criar: `src/ui/SeloBox.tsx`
- Criar: `src/ui/SeloBox.test.tsx`
- Editar: `docs/estilo/catalogo.md`

**Interfaces:**
- Produz: `export default function SeloBox({ boxId, boxes }: { boxId: ID; boxes: Box[] })`. Devolve `<span className="badge" style={{ marginLeft: 6 }}>nome</span>`; se a box não existir na lista, o texto é `?`.

- [ ] **Passo 1: Escrever o teste que falha**

`src/ui/SeloBox.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import type { Box } from '../domain/types';
import SeloBox from './SeloBox';

const agora = '2026-07-01T12:00:00.000Z';
const ana: Box = { id: 'b-ana', nome: 'ana', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };

it('mostra o nome da box como selo', () => {
  render(<SeloBox boxId="b-ana" boxes={[ana]} />);
  const selo = screen.getByText('ana');
  expect(selo).toHaveClass('badge');
});

it('mostra "?" quando a box não existe', () => {
  render(<SeloBox boxId="inexistente" boxes={[ana]} />);
  expect(screen.getByText('?')).toHaveClass('badge');
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/ui/SeloBox.test.tsx`
Esperado: FALHA, módulo `./SeloBox` não existe.

- [ ] **Passo 3: Implementar**

`src/ui/SeloBox.tsx`:

```tsx
import type { Box, ID } from '../domain/types';

/** Selo com o nome da box de um lançamento. Só as telas que consolidam várias boxes (a visão
 *  casa) o mostram: numa box só, o nome já está no topo. Mesmo formato do selo "estorno". */
export default function SeloBox({ boxId, boxes }: { boxId: ID; boxes: Box[] }) {
  const nome = boxes.find((b) => b.id === boxId)?.nome ?? '?';
  return <span className="badge" style={{ marginLeft: 6 }}>{nome}</span>;
}
```

- [ ] **Passo 4: Catalogar**

Em `docs/estilo/catalogo.md`, ache a seção dos componentes (perto de `SeletorBanco.tsx`, linha ~147) e acrescente, no mesmo formato dos vizinhos:

```
- **`SeloBox.tsx`** — selo `.badge` com o nome da box de um lançamento. Aparece só na visão casa (`boxSel === 'casa'`), ao lado da categoria, em Hoje → Pendentes e Fluxo → Lista. Box inexistente mostra `?`.
```

- [ ] **Passo 5: Rodar teste e verificador do catálogo**

Rode: `npx vitest run src/ui/SeloBox.test.tsx` → PASSA.
Rode: `node scripts/verificar-catalogo.mjs` → sem aviso sobre `SeloBox`.

- [ ] **Passo 6: Suíte completa e commit**

Rode: `npm test` → verde.

```bash
git add src/ui/SeloBox.tsx src/ui/SeloBox.test.tsx docs/estilo/catalogo.md
git commit -m "feat(ui): componente SeloBox para a visão casa

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 2: Selo da box em Hoje → Pendentes e Fluxo → Lista

**Arquivos:**
- Editar: `src/ui/TelaHoje.tsx` (fila de pendentes, ~linha 529)
- Editar: `src/ui/TelaFluxo.tsx` (`bate`, ~linha 101; item da lista, ~linha 265)
- Testar: `src/ui/TelaHoje.test.tsx`, `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consome: `SeloBox` (Tarefa 1); `boxSel` do `useApp()`; `dados.boxes`.

- [ ] **Passo 1: Escrever os testes que falham**

Ao fim de `src/ui/TelaHoje.test.tsx`, em um `describe` novo:

```tsx
describe('selo da box nos pendentes', () => {
  async function montar(boxSel: 'casa' | 'ana') {
    const agora = agoraISO();
    const ana = { id: novoId(), nome: 'ana', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    const bruno = { id: novoId(), nome: 'bruno', saldoInicial: 50000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    const catA = await repo.salvarCategoria({ boxId: ana.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const catB = await repo.salvarCategoria({ boxId: bruno.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: ana.id, categoriaId: catA.id, data: '2026-07-01', valor: 15000, status: 'previsto' });
    await repo.salvarLancamento({ boxId: bruno.id, categoriaId: catB.id, data: '2026-07-01', valor: 90000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: boxSel === 'casa' ? 'casa' : ana.id, hoje: '2026-07-02' });
    render(<TelaHoje />);
    await abrirAba(/Pendentes/);
  }

  it('na casa, cada pendente mostra a box de origem', async () => {
    await montar('casa');
    const mercado = screen.getByText(/mercado/).closest('.item') as HTMLElement;
    const aluguel = screen.getByText(/aluguel/).closest('.item') as HTMLElement;
    expect(within(mercado).getByText('ana')).toHaveClass('badge');
    expect(within(aluguel).getByText('bruno')).toHaveClass('badge');
  });

  it('numa box só, nenhum pendente mostra selo de box', async () => {
    await montar('ana');
    const mercado = screen.getByText(/mercado/).closest('.item') as HTMLElement;
    expect(within(mercado).queryByText('ana')).not.toBeInTheDocument();
  });
});
```

Ao fim de `src/ui/TelaFluxo.test.tsx` (use o mesmo estilo de montagem do arquivo; abaixo, o esqueleto completo):

```tsx
describe('selo da box na lista', () => {
  async function montar(boxSel: 'casa' | 'ana') {
    const agora = agoraISO();
    const ana = { id: novoId(), nome: 'ana', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    const bruno = { id: novoId(), nome: 'bruno', saldoInicial: 50000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    const catA = await repo.salvarCategoria({ boxId: ana.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const catB = await repo.salvarCategoria({ boxId: bruno.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: ana.id, categoriaId: catA.id, data: '2026-07-02', valor: 15000, status: 'efetivo' });
    await repo.salvarLancamento({ boxId: bruno.id, categoriaId: catB.id, data: '2026-07-02', valor: 90000, status: 'efetivo' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: boxSel === 'casa' ? 'casa' : ana.id, hoje: '2026-07-02' });
    render(<TelaFluxo />);
  }

  it('na casa, cada lançamento mostra a box de origem', async () => {
    await montar('casa');
    const mercado = (await screen.findByText(/mercado/)).closest('.item') as HTMLElement;
    const aluguel = screen.getByText(/aluguel/).closest('.item') as HTMLElement;
    expect(within(mercado).getByText('ana')).toHaveClass('badge');
    expect(within(aluguel).getByText('bruno')).toHaveClass('badge');
  });

  it('numa box só, não mostra selo de box', async () => {
    await montar('ana');
    const mercado = (await screen.findByText(/mercado/)).closest('.item') as HTMLElement;
    expect(within(mercado).queryByText('ana')).not.toBeInTheDocument();
  });

  it('na casa, a busca também casa pelo nome da box', async () => {
    await montar('casa');
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar e filtrar' }));
    await userEvent.type(screen.getByPlaceholderText(/Buscar por/), 'bruno');
    expect(screen.queryByText(/mercado/)).not.toBeInTheDocument();
    expect(screen.getByText(/aluguel/)).toBeInTheDocument();
  });

  it('numa box só, a busca pelo nome da box não acha nada', async () => {
    await montar('ana');
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar e filtrar' }));
    await userEvent.type(screen.getByPlaceholderText(/Buscar por/), 'ana');
    expect(screen.queryByText(/mercado/)).not.toBeInTheDocument();
  });
});
```

Confira os imports no topo de cada arquivo de teste (`within`, `userEvent`, `repo`, `agoraISO`, `novoId`, `useApp`); acrescente o que faltar. O valor 15000 só aparece no `.item`; a busca por texto de valor não interfere.

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx src/ui/TelaFluxo.test.tsx -t "selo da box"`
Esperado: os testes "na casa…" FALHAM (selo ausente); os "numa box só" já passam.

- [ ] **Passo 3: Implementar em `TelaHoje.tsx`**

No import: `import SeloBox from './SeloBox';`. Na fila de pendentes, troque

```tsx
                      {nomeCat(l.categoriaId)}
                      {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
```

por

```tsx
                      {nomeCat(l.categoriaId)}
                      {boxSel === 'casa' && <SeloBox boxId={l.boxId} boxes={dados.boxes} />}
                      {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
```

- [ ] **Passo 4: Implementar em `TelaFluxo.tsx`**

No import: `import SeloBox from './SeloBox';`. Junto de `nomeCat`, acrescente:

```tsx
  const naCasa = boxSel === 'casa';
  const nomeBox = (id: string) => dados.boxes.find((b) => b.id === id)?.nome ?? '?';
```

Em `bate`, antes do `return l.origem === 'cartao' && …`:

```tsx
    if (naCasa && nomeBox(l.boxId).toLowerCase().includes(q)) return true;
```

No item da lista, logo depois de `{nomeCat(l.categoriaId)}`:

```tsx
                          {naCasa && <SeloBox boxId={l.boxId} boxes={dados.boxes} />}
```

- [ ] **Passo 5: Rodar os testes novos e a suíte completa**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx src/ui/TelaFluxo.test.tsx` → PASSA.
Rode: `npm test` → verde. Se um teste antigo de casa quebrar por causa do selo (texto duplicado), ajuste a consulta dele, sem mudar o que ele verifica.

- [ ] **Passo 6: Commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaFluxo.tsx src/ui/TelaHoje.test.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(casa): selo da box nos pendentes e na lista do Fluxo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 3: Saldo por box no card da casa

**Arquivos:**
- Criar: `src/domain/saldoPorBox.ts`
- Criar: `src/domain/saldoPorBox.test.ts`
- Editar: `src/ui/TelaHoje.tsx` (card "Saldo hoje", ~linha 450)
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Produz: `saldosPorBox(ids: readonly ID[], e: EntradaProjecao, hoje: ISODate): SaldoDaBox[]` e `interface SaldoDaBox { boxId: ID; nome: string; saldoEfetivo: number }`.
- Consome: `projetarBoxes` e `EntradaProjecao` de `src/domain/projection.ts`.

- [ ] **Passo 1: Escrever o teste de domínio que falha**

`src/domain/saldoPorBox.test.ts`:

```ts
import { projetarBoxes } from './projection';
import { saldosPorBox } from './saldoPorBox';
import type { Box, Categoria, Lancamento } from './types';

const agora = '2026-07-01T12:00:00.000Z';
const box = (id: string, nome: string, saldoInicial: number | null, dataSaldoInicial: string | null): Box =>
  ({ id, nome, saldoInicial, dataSaldoInicial, criadoEm: agora, alteradoEm: agora });
const cat = (id: string, boxId: string, tipo: 'ganho' | 'gasto'): Categoria =>
  ({ id, boxId, nome: id, tipo, ordem: 0, criadoEm: agora, alteradoEm: agora }) as Categoria;
const lanc = (id: string, boxId: string, categoriaId: string, data: string, valor: number): Lancamento =>
  ({ id, boxId, categoriaId, data, valor, status: 'efetivo', origem: 'manual', criadoEm: agora, alteradoEm: agora }) as Lancamento;

const entrada = (boxes: Box[], lancamentos: Lancamento[]) => ({
  boxes,
  categorias: [cat('c-ana', 'ana', 'gasto'), cat('c-bruno', 'bruno', 'gasto'), cat('c-casa', 'casa', 'gasto')],
  lancamentos,
  cenariosLigados: new Set<string>(),
  horizonte: '2026-12-31',
});

it('devolve o saldo efetivo de hoje de cada box com saldo próprio', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const e = entrada(boxes, [lanc('l1', 'ana', 'c-ana', '2026-07-01', 15000)]);
  const r = saldosPorBox(['ana', 'bruno'], e, '2026-07-02');
  expect(r).toEqual([
    { boxId: 'ana', nome: 'ana', saldoEfetivo: 85000 },
    { boxId: 'bruno', nome: 'bruno', saldoEfetivo: 50000 },
  ]);
});

it('a soma das linhas é igual ao total consolidado', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const e = entrada(boxes, [
    lanc('l1', 'ana', 'c-ana', '2026-07-01', 15000),
    lanc('l2', 'bruno', 'c-bruno', '2026-06-10', 90000),
  ]);
  const ids = ['ana', 'bruno'];
  const soma = saldosPorBox(ids, e, '2026-07-02').reduce((s, r) => s + r.saldoEfetivo, 0);
  const total = projetarBoxes(ids, e).filter((s) => s.data <= '2026-07-02').at(-1)!.saldoEfetivo;
  expect(soma).toBe(total);
});

it('omite a box sem saldo próprio e sem lançamento', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('casa', 'casa', null, null)];
  const r = saldosPorBox(['ana', 'casa'], entrada(boxes, []), '2026-07-02');
  expect(r.map((x) => x.nome)).toEqual(['ana']);
});

it('inclui a box sem saldo próprio quando ela tem lançamento', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('casa', 'casa', null, null)];
  const e = entrada(boxes, [lanc('l1', 'casa', 'c-casa', '2026-07-01', 20000)]);
  const r = saldosPorBox(['ana', 'casa'], e, '2026-07-02');
  expect(r.find((x) => x.nome === 'casa')?.saldoEfetivo).toBe(-20000);
});

it('só considera as boxes da seleção', () => {
  const boxes = [box('ana', 'ana', 100000, '2026-01-01'), box('bruno', 'bruno', 50000, '2026-01-01')];
  const r = saldosPorBox(['ana'], entrada(boxes, []), '2026-07-02');
  expect(r.map((x) => x.nome)).toEqual(['ana']);
});
```

Se `Box` ou `Categoria` tiverem campos obrigatórios a mais em `src/domain/types.ts`, acrescente-os nos construtores de teste.

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/domain/saldoPorBox.test.ts`
Esperado: FALHA, módulo não existe.

- [ ] **Passo 3: Implementar**

`src/domain/saldoPorBox.ts`:

```ts
import { projetarBoxes, type EntradaProjecao } from './projection';
import type { ID, ISODate } from './types';

export interface SaldoDaBox { boxId: ID; nome: string; saldoEfetivo: number }

/** Saldo efetivo de hoje de cada box da seleção, para a visão casa. Entram as boxes com saldo
 *  próprio e a box sem saldo próprio só se tiver algum lançamento. Cada box usa a mesma
 *  projeção do total (`projetarBoxes`), com uma box só. Quando todas as boxes começam na mesma
 *  data, a soma das linhas é igual ao total consolidado. */
export function saldosPorBox(ids: readonly ID[], e: EntradaProjecao, hoje: ISODate): SaldoDaBox[] {
  const sel = new Set(ids);
  return e.boxes
    .filter((b) => sel.has(b.id))
    .filter((b) => b.saldoInicial !== null || e.lancamentos.some((l) => l.boxId === b.id))
    .map((b) => {
      const dia = projetarBoxes([b.id], e).filter((s) => s.data <= hoje).at(-1);
      return { boxId: b.id, nome: b.nome, saldoEfetivo: dia?.saldoEfetivo ?? 0 };
    });
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npx vitest run src/domain/saldoPorBox.test.ts` → PASSA. Se o teste "a soma das linhas…" falhar, **não ajuste a conta para passar**: relate o cenário.

- [ ] **Passo 5: Escrever o teste de UI que falha**

Em `src/ui/TelaHoje.test.tsx`:

```tsx
describe('saldo por box na casa', () => {
  async function montar(boxSel: 'casa' | 'ana') {
    const agora = agoraISO();
    const ana = { id: novoId(), nome: 'ana', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    const bruno = { id: novoId(), nome: 'bruno', saldoInicial: 50000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: boxSel === 'casa' ? 'casa' : ana.id, hoje: '2026-07-02' });
    render(<TelaHoje />);
  }

  it('na casa, o card mostra uma linha por box e o total', async () => {
    await montar('casa');
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.getByText('bruno')).toBeInTheDocument();
    expect(screen.getByText(formatarSaldo(100000))).toBeInTheDocument();
    expect(screen.getByText(formatarSaldo(50000))).toBeInTheDocument();
  });

  it('numa box só, o card não mostra linhas por box', async () => {
    await montar('ana');
    expect(screen.queryByText('bruno')).not.toBeInTheDocument();
  });
});
```

Atenção: o card já tem `Saldo hoje · casa` e o `<option>` do seletor de box não existe em `TelaHoje`; `getByText('ana')` não deve achar nada além da linha nova. Se achar duplicata, restrinja com `within(...)` ao card.

- [ ] **Passo 6: Rodar e ver falhar**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx -t "saldo por box na casa"`
Esperado: "na casa…" FALHA.

- [ ] **Passo 7: Implementar na `TelaHoje.tsx`**

Import: `import { saldosPorBox } from '../domain/saldoPorBox';`. Junto do `useMemo` de `serie` (antes do `if (!dados) return null;`):

```tsx
  const saldosBoxes = useMemo(
    () => dados && boxSel === 'casa' ? saldosPorBox(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
      cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
    }, hoje) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, boxSel, hoje],
  );
```

No card "Saldo hoje", logo depois do bloco do `saldo-grande` (o IIFE que mostra `reais,centavos`) e antes do IIFE do `delta`, insira:

```tsx
              {saldosBoxes.length >= 2 && (
                <div className="lista" style={{ gap: 6, margin: '8px 0' }}>
                  {saldosBoxes.map((s) => (
                    <div className="linha-topo" key={s.boxId}>
                      <span className="sub cresce">{s.nome}</span>
                      <strong className={'total-dia ' + classeSaldo(s.saldoEfetivo)}>{formatarSaldo(s.saldoEfetivo)}</strong>
                    </div>
                  ))}
                </div>
              )}
```

(Com uma linha só, ela repetiria o total: por isso `>= 2`.)

- [ ] **Passo 8: Rodar e commitar**

Rode: `npx vitest run src/ui/TelaHoje.test.tsx src/domain/saldoPorBox.test.ts` → PASSA. Rode `npm test` → verde.

```bash
git add src/domain/saldoPorBox.ts src/domain/saldoPorBox.test.ts src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(casa): saldo de cada box no card Saldo hoje

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 4: Cartão, um por vez

**Arquivos:**
- Editar: `src/ui/TelaCartao.tsx` (função `TelaCartao`, ~linha 337)
- Testar: `src/ui/TelaCartao.test.tsx`

- [ ] **Passo 1: Escrever os testes que falham**

Em `src/ui/TelaCartao.test.tsx`:

```tsx
describe('seletor de cartão', () => {
  async function montarDoisCartoes(boxSel: 'casa' | 'ana') {
    const agora = agoraISO();
    const ana = { id: novoId(), nome: 'ana', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    const bruno = { id: novoId(), nome: 'bruno', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    await repo.salvarCartao({ boxId: ana.id, nome: 'Cartão A', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
    await repo.salvarCartao({ boxId: bruno.id, nome: 'Cartão B', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: boxSel === 'casa' ? 'casa' : ana.id, hoje: '2026-07-01' });
    return { ana, bruno };
  }

  it('na casa, com 2 cartões, mostra o seletor e só a fatura do escolhido', async () => {
    await montarDoisCartoes('casa');
    render(<TelaCartao />);
    const seletor = screen.getByLabelText('Cartão') as HTMLSelectElement;
    expect(within(seletor).getByRole('option', { name: 'Cartão A · ana' })).toBeInTheDocument();
    expect(within(seletor).getByRole('option', { name: 'Cartão B · bruno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cartão A' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cartão B' })).not.toBeInTheDocument();

    await userEvent.selectOptions(seletor, seletor.querySelectorAll('option')[1].value);
    expect(screen.getByRole('heading', { name: 'Cartão B' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cartão A' })).not.toBeInTheDocument();
  });

  it('com um cartão só, não mostra o seletor', async () => {
    const { ana } = await montarDoisCartoes('ana');
    render(<TelaCartao />);
    expect(screen.queryByLabelText('Cartão')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cartão A' })).toBeInTheDocument();
    expect(ana.nome).toBe('ana');
  });

  it('numa box com 2 cartões, o seletor aparece sem o nome da box', async () => {
    const { ana } = await montarDoisCartoes('ana');
    await repo.salvarCartao({ boxId: ana.id, nome: 'Cartão C', diaFechamento: 28, diaVencimento: 5 }, '2027-12-31');
    await useApp.getState().recarregar();
    render(<TelaCartao />);
    const seletor = screen.getByLabelText('Cartão');
    expect(within(seletor).getByRole('option', { name: 'Cartão A' })).toBeInTheDocument();
    expect(within(seletor).getByRole('option', { name: 'Cartão C' })).toBeInTheDocument();
  });

  it('volta ao primeiro cartão quando o escolhido sai da seleção', async () => {
    const { ana } = await montarDoisCartoes('casa');
    render(<TelaCartao />);
    const seletor = screen.getByLabelText('Cartão') as HTMLSelectElement;
    await userEvent.selectOptions(seletor, seletor.querySelectorAll('option')[1].value);
    expect(screen.getByRole('heading', { name: 'Cartão B' })).toBeInTheDocument();
    act(() => useApp.setState({ boxSel: ana.id }));
    expect(screen.getByRole('heading', { name: 'Cartão A' })).toBeInTheDocument();
  });
});
```

Acrescente `act` ao import de `@testing-library/react` se faltar. O `h2` do cartão vem de `CartaoFatura` (`<h2>{cartao.nome}</h2>`), com papel `heading`.

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/ui/TelaCartao.test.tsx -t "seletor de cartão"`
Esperado: FALHA (sem rótulo "Cartão").

- [ ] **Passo 3: Implementar**

Em `TelaCartao.tsx`, `useState` já está importado. Troque o corpo de `TelaCartao` por:

```tsx
export default function TelaCartao() {
  const { dados, boxSel, abrirAjustes } = useApp();
  const [cartaoSelId, setCartaoSelId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoes = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));
  if (cartoes.length === 0) {
    return (
      <div className="tela">
        <p className="sub">Nenhum cartão cadastrado para esta seleção.</p>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-start' }}
          onClick={() => abrirAjustes('cartoes')}>Cadastrar cartão</button>
      </div>
    );
  }
  // Um cartão por vez: na visão casa, a pilha de faturas escondia de quem era cada uma. Se o
  // cartão escolhido saiu da seleção (troca de box no topo), vale o primeiro.
  const cartao = cartoes.find((c) => c.id === cartaoSelId) ?? cartoes[0];
  const nomeBox = (boxId: string) => dados.boxes.find((b) => b.id === boxId)?.nome ?? '?';
  return (
    <div className="tela">
      {cartoes.length >= 2 && (
        <div className="campo">
          <label htmlFor={`${uid}-cartao`}>Cartão</label>
          <select id={`${uid}-cartao`} value={cartao.id} onChange={(e) => setCartaoSelId(e.target.value)}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>{boxSel === 'casa' ? `${c.nome} · ${nomeBox(c.boxId)}` : c.nome}</option>
            ))}
          </select>
        </div>
      )}
      <CartaoFatura key={cartao.id} cartao={cartao} />
    </div>
  );
}
```

O `key={cartao.id}` zera o mês e a aba interna ao trocar de cartão: comportamento esperado.

Também atualize o comentário de `CartaoFatura` (linhas ~195-200 do arquivo, "Um bloco por cartão… na visão casa o bloco do cartão seguinte empurra o anterior"): troque por uma frase curta dizendo que `TelaCartao` mostra um cartão por vez, e que o nome dele abre o bloco acima do seletor de mês.

- [ ] **Passo 4: Rodar e commitar**

Rode: `npx vitest run src/ui/TelaCartao.test.tsx` → PASSA. Rode `npm test` → verde. Se um teste antigo esperava os dois cartões empilhados, atualize-o para o novo comportamento (um por vez) e diga isso no relatório.

```bash
git add src/ui/TelaCartao.tsx src/ui/TelaCartao.test.tsx
git commit -m "feat(cartao): um cartão por vez, com seletor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 5: Lançar pede a box na casa

**Arquivos:**
- Editar: `src/ui/TelaLancar.tsx`
- Testar: `src/ui/TelaLancar.test.tsx`

- [ ] **Passo 1: Escrever os testes que falham e trocar o teste antigo**

Em `src/ui/TelaLancar.test.tsx`, **substitua** o teste `roteia para a box "casa" pelo nome, não pela primeira box` (ele afirmava a gravação na box "casa", que a spec muda) por:

```tsx
describe('Lançar com "casa" no topo', () => {
  async function montar() {
    const agora = agoraISO();
    const box = (nome: string, saldo: number | null) =>
      ({ id: novoId(), nome, saldoInicial: saldo, dataSaldoInicial: saldo === null ? null : '2026-01-01', criadoEm: agora, alteradoEm: agora });
    const ana = box('ana', 0);
    const bruno = box('bruno', 0);
    const casa = box('casa', null);
    await repo.salvarBox(ana);
    await repo.salvarBox(bruno);
    await repo.salvarBox(casa);
    await repo.salvarCategoria({ boxId: ana.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    await repo.salvarCategoria({ boxId: bruno.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    return { ana, bruno, casa };
  }

  it('pede a box antes de mostrar o resto do formulário', async () => {
    await montar();
    render(<TelaLancar />);
    const seletor = screen.getByLabelText('Box');
    expect(within(seletor).getByRole('option', { name: 'ana' })).toBeInTheDocument();
    expect(within(seletor).getByRole('option', { name: 'bruno' })).toBeInTheDocument();
    expect(within(seletor).queryByRole('option', { name: 'casa' })).not.toBeInTheDocument();
    expect(screen.getByText('Escolha a box.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançar' })).not.toBeInTheDocument();
  });

  it('grava na box escolhida, nunca na box "casa"', async () => {
    const { bruno } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), bruno.id);
    await userEvent.type(screen.getByLabelText('Valor'), '50,00');
    await userEvent.click(screen.getByRole('button', { name: 'aluguel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    const lancs = await db.lancamentos.toArray();
    expect(lancs).toHaveLength(1);
    expect(lancs[0]).toMatchObject({ boxId: bruno.id, valor: 5000 });
  });

  it('as categorias seguem a box escolhida e trocar a box zera a categoria', async () => {
    const { ana, bruno } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    expect(screen.queryByRole('button', { name: 'aluguel' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Box'), bruno.id);
    expect(screen.queryByRole('button', { name: 'mercado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'aluguel' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Valor'), '10,00');
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled();
  });

  it('a box continua escolhida depois de lançar', async () => {
    const { ana } = await montar();
    render(<TelaLancar />);
    await userEvent.selectOptions(screen.getByLabelText('Box'), ana.id);
    await userEvent.type(screen.getByLabelText('Valor'), '12,00');
    await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
    expect((screen.getByLabelText('Box') as HTMLSelectElement).value).toBe(ana.id);
  });

  it('sem nenhuma box real, avisa para criar uma', async () => {
    await limparDb();
    await useApp.getState().iniciar(); // só a box "casa", autocriada
    useApp.setState({ boxSel: 'casa', hoje: '2026-07-02' });
    render(<TelaLancar />);
    expect(screen.getByText(/Nenhuma box — crie em Ajustes → Boxes\./)).toBeInTheDocument();
    expect(screen.queryByLabelText('Box')).not.toBeInTheDocument();
  });

  it('numa box concreta, o campo Box não aparece', async () => {
    const { ana } = await montar();
    useApp.setState({ boxSel: ana.id });
    render(<TelaLancar />);
    expect(screen.queryByLabelText('Box')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();
  });
});
```

Acrescente `within` ao import de `@testing-library/react`. Os outros testes do arquivo usam uma box concreta e **não mudam**.

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npx vitest run src/ui/TelaLancar.test.tsx`
Esperado: os testes de "casa" FALHAM; os demais passam.

- [ ] **Passo 3: Implementar**

Em `TelaLancar.tsx`:

1. Troque o import `import { boxIdEfetivo, useApp } from '../state/store';` por `import { useApp } from '../state/store';`.

2. Junto dos outros `useState`, acrescente:

```tsx
  // Só vale com "casa" no topo: a box que pagou o gasto. Fica escolhida depois de lançar,
  // porque a pessoa costuma lançar vários gastos seguidos da mesma box.
  const [boxEscolhidaId, setBoxEscolhidaId] = useState<string | null>(null);
```

3. Troque `const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;` e o `useEffect` logo abaixo por:

```tsx
  const naCasa = boxSel === 'casa';
  // A box "casa" é a que não tem saldo próprio e guarda o histórico compartilhado: não recebe
  // lançamento novo por aqui. Quem lança na casa escolhe a box de quem pagou.
  const boxesReais = dados ? dados.boxes.filter((b) => b.nome !== 'casa') : [];
  const boxId: string | null = !dados ? null
    : naCasa ? (boxesReais.some((b) => b.id === boxEscolhidaId) ? boxEscolhidaId : null)
      : boxSel;

  // Trocar de box zera o banco; a categoria só fica se for da box nova.
  useEffect(() => {
    setBancoEscolhido(null);
    setCategoriaId((atual) => (
      atual != null && dados?.categorias.find((c) => c.id === atual)?.boxId === boxId ? atual : null
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);
```

4. No `return`, **substitua** a linha `{boxAtual && <p className="sub" …>Lançando na box …</p>}` por:

```tsx
      {naCasa && (
        boxesReais.length === 0 ? (
          <p className="sub">Nenhuma box — crie em Ajustes → Boxes.</p>
        ) : (
          <div className="campo">
            <label htmlFor="box">Box</label>
            <select id="box" value={boxEscolhidaId ?? ''} onChange={(e) => setBoxEscolhidaId(e.target.value || null)}>
              <option value="">Escolha a box…</option>
              {boxesReais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        )
      )}
      {naCasa && boxesReais.length > 0 && boxId == null && <p className="sub">Escolha a box.</p>}
      {boxAtual && <p className="sub" style={{ margin: 0 }}>Lançando na box <strong>{boxAtual.nome}</strong></p>}
```

5. Envolva **todo o resto** do formulário (do `<div className="campo">` do Valor até o `{salvo && …}` final) em `{boxId != null && ( <> … </> )}`. Na casa sem box escolhida, só o seletor e o aviso aparecem. Numa box concreta, `boxId` nunca é nulo e nada muda.

O `autoFocus` do Valor continua valendo: o campo monta quando a box é escolhida.

- [ ] **Passo 4: Rodar e commitar**

Rode: `npx vitest run src/ui/TelaLancar.test.tsx src/ui/AdicionarSheet.test.tsx` → PASSA. Rode `npm test` → verde.

```bash
git add src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx
git commit -m "feat(lancar): na casa, o formulário pede a box de quem pagou

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 6: Documentação, changelog e dossiê

**Arquivos:**
- Editar: `docs/wiki/6-telas.md`, `docs/wiki/3-conceitos.md`, `docs/wiki/4-motor.md`, `docs/wiki/8-glossario.md`, `docs/dominio.md`
- Criar: `changelog.d/alterado-casa-mostra-a-box.md`, `changelog.d/alterado-cartao-um-por-vez.md`, `changelog.d/alterado-lancar-pede-a-box.md`
- Regenerar: `docs/dossie/`

- [ ] **Passo 1: Atualizar a wiki**

Leia `docs/wiki/README.md` (subconjunto fechado de markdown) antes de editar.

- `docs/wiki/6-telas.md`:
  - Na seção do Cartão (~linha 80-84): troque "(ou os dois cartões empilhados, na visão casa)" por uma frase dizendo que, com 2 ou mais cartões na seleção, um seletor "Cartão" escolhe qual fatura aparece (na visão casa, a opção traz o nome da box); apague o item sobre "o título que separa um cartão do outro" e o sobre "o bloco do cartão seguinte empurra o anterior".
  - Na seção de Hoje: diga que, na visão casa, o card "Saldo hoje" traz uma linha por box, e que os Pendentes mostram a box de cada um. Na seção do Fluxo: a lista mostra a box de cada lançamento na visão casa, e a busca acha pelo nome da box.
  - Na seção de Lançar: diga que, com "casa" no topo, o formulário pede a box (quem pagou) antes de tudo, grava nela, e a box escolhida continua escolhida depois de lançar.
- `docs/wiki/3-conceitos.md` e `docs/wiki/4-motor.md`: onde dizem que a casa soma "os lançamentos próprios da box casa (energia, água, ajustes)", acrescente que lançamentos novos vão para a box de quem pagou; os que já estão na box casa continuam contando.
- `docs/wiki/8-glossario.md` (`box casa`): ajuste a definição na mesma linha.
- Use os marcadores `{{boxA}}`/`{{boxB}}` nos exemplos; nada de nome fixo.

Rode: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASSA.

- [ ] **Passo 2: Atualizar `docs/dominio.md`**

Na entrada **Box** (linha ~17) e na seção "A box `'casa'`" (~linha 119), acrescente: a UI (`TelaLancar`) não grava lançamento novo na box de nome `"casa"`; com `boxSel === 'casa'`, o formulário exige uma box real. A box `"casa"` só guarda lançamentos que já existiam, e eles continuam entrando na consolidação. Essa regra é da interface, **não** do repo: `repo.salvarLancamento` continua aceitando `boxId` da box `"casa"` (**expectativa não garantida** no domínio).

- [ ] **Passo 3: Criar os fragmentos de changelog**

Leia `changelog.d/README.md`. Cada arquivo tem bullets sem negrito, 2 níveis no máximo.

`changelog.d/alterado-casa-mostra-a-box.md`:
```
- Na visão casa, cada lançamento mostra a box de origem.
  - Vale para os Pendentes da Hoje e para a lista do Fluxo; a busca do Fluxo acha pelo nome da box.
- O card Saldo hoje da casa mostra o saldo de cada box.
```

`changelog.d/alterado-cartao-um-por-vez.md`:
```
- A aba Cartão mostra uma fatura por vez, com um seletor de cartão.
  - Na visão casa, cada opção traz o nome da box.
```

`changelog.d/alterado-lancar-pede-a-box.md`:
```
- Com casa no topo, o Lançar pede a box de quem pagou e grava nela.
  - A box casa não recebe mais lançamento novo por essa tela; o que já estava nela continua contando.
```

- [ ] **Passo 4: Regenerar o dossiê**

Rode: `npm run dossie`
Rode: `git diff --stat docs/dossie/` e leia o diff: as mudanças devem ser só as telas afetadas (Hoje, Fluxo, Cartão, Lançar na casa). Algo fora disso: pare e relate.

- [ ] **Passo 5: Verificações finais**

Rode, e todos devem passar:
- `npm test`
- `npm run build`
- `node scripts/verificar-catalogo.mjs --strict`
- `node scripts/verificar-dados-reais.mjs --strict`

- [ ] **Passo 6: Commit**

```bash
git add docs changelog.d
git commit -m "docs(casa): wiki, domínio, changelog e dossiê da entrega A

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

## Depois das tarefas (feito pelo coordenador, não por subagente)

1. Varredura com Playwright (Galaxy S25+: 411×744, DPR 2,63, `isMobile`, `hasTouch`, `pt-BR`), com duas boxes e a casa, dados sintéticos, em `npx vite` local, fora do `package.json`: Hoje (Visão e Pendentes), Fluxo → Lista e busca, Cartão com 2 cartões, Lançar na casa. Capturas ao usuário pelo chat.
2. Mostrar os fragmentos de changelog ao usuário.
3. Skill `ciclo-de-entrega`: merge na `main`, `npm run release`, push, `npm run deploy`.
4. Mover VB-18, 21, 25, 28 e 30 do item 34 do `TODO.md` para `TODO-CONCLUIDOS.md`.
5. `git -C <checkout principal> status --porcelain` vazio; encerrar o servidor do Vite antes de remover o worktree.
