# Orçamento de viagem — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos com checkbox (`- [ ]`).

**Objetivo:** viagem ganha orçamento opcional; a tela de adicionar (débito e cartão) e Ajustes → Viagens mostram "R$ X de R$ Y · falta/passou R$ Z", com prévia do valor digitado.

**Arquitetura:** `gastoDaViagem` + `situacaoOrcamento` em `src/domain/viagem.ts` são a regra única; um componente `LinhaOrcamentoViagem` é o único texto. As somas de viagem das Análises passam a ignorar ganho, como o orçamento.

**Stack:** React 18, TypeScript, Dexie, Vitest + Testing Library + fake-indexeddb, lucide-react (já instalado, tem `TriangleAlert`).

**Spec:** `docs/superpowers/specs/2026-09-24-orcamento-de-viagem-design.md`. Mockup aprovado em 2026-09-24.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\orcamento-viagem`, branch `orcamento-viagem`. **Não toque no checkout principal** (`C:\Users\eitor\Claude\ProjetoFinancas`). `git rev-parse --show-toplevel` tem que devolver o worktree.
- Texto de UI, testes, comentários e commits em português.
- Dinheiro em centavos inteiros; exibir só com `formatarBRL`. Em teste, compare com `formatarBRL(...)` ou regex (espaço não-quebrável).
- Nenhuma classe CSS nova; `src/styles.css` não muda. `style` inline só de layout. Nenhuma dependência nova.
- Não mude `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.claude/`.
- Sem nova `this.version(n)` no Dexie; sem bump de schema de backup.
- Não use `{ timeout: n }` em `findBy*`/`waitFor`.
- UTF-8 sem BOM. Dados sintéticos.
- Antes de dizer que terminou: `npm test` inteiro verde. Se o teste do dossiê acusar desatualização, rode `npm run dossie`, confira o `git diff docs/dossie/` e inclua no commit.

## Textos exatos (do mockup aprovado)

- Linha: `{gasto} de {orçamento} · falta {restante}` — `{restante}` em `<strong className="valor-ganho">`.
- Passou: `{gasto} de {orçamento} · passou {excesso}` — `{excesso}` em `<strong className="valor-gasto">`, com `<TriangleAlert size={16} aria-hidden="true" />` **dentro** do `<strong>`, antes do valor.
- Prefixo da prévia: `Com este gasto: `.
- Campo em Ajustes: `Orçamento (opcional)`.

---

### Tarefa 1: domínio — gasto da viagem, situação do orçamento, só gastos nas somas

**Arquivos:**
- Modificar: `src/domain/types.ts` (`interface Viagem`, ~linha 158)
- Modificar: `src/domain/viagem.ts`
- Modificar: `src/ui/TelaAnalises.tsx` (~linhas 45 e 81), `src/ui/ViagemSheet.tsx`
- Testes: `src/domain/viagem.test.ts`, `src/ui/ViagemSheet.test.tsx`, `src/ui/TelaAnalises.test.tsx` (só ajustar chamadas/props)

**Interfaces produzidas:**
- `Viagem.orcamentoCent?: number` — centavos; ausente ou 0 = sem orçamento.
- `gastoDaViagem(viagem: Viagem, lancamentos: Lancamento[], comprasCartao: CompraCartao[], categorias: Categoria[]): number`
- `interface SituacaoOrcamento { gastoCent: number; orcamentoCent: number; restanteCent: number }`
- `situacaoOrcamento(orcamentoCent: number, gastoCent: number): SituacaoOrcamento` — `restanteCent = orcamentoCent − gastoCent`.
- `itensDaViagem(viagem, lancamentos, comprasCartao, boxIds, cartoes, incluirPrevistos, categorias: Categoria[])` — novo último parâmetro.
- `totalViagemNoMes(viagem, mes, boxIds, lancamentos, comprasCartao, cartoes, incluirPrevistos, categorias: Categoria[], ajustesFechamento = [])` — `categorias` entra antes de `ajustesFechamento`.
- `ViagemSheet` ganha a prop obrigatória `categorias: Categoria[]`.

- [ ] **Passo 0:** `cd` no worktree, `git rev-parse --show-toplevel`, `npm ci`.

- [ ] **Passo 1: testes (falham)** — em `src/domain/viagem.test.ts`, reuse os helpers do arquivo (leia o topo antes). Crie as categorias sintéticas `catGasto` (`tipo: 'gasto'`) e `catGanho` (`tipo: 'ganho'`) no formato de `Categoria` de `types.ts`. Casos:

```ts
describe('gastoDaViagem', () => {
  // viagem V; lançamentos em duas boxes; compras de cartão
  it('soma gastos efetivos de todas as boxes e compras de cartão pelo valor cheio', () => {
    // efetivo gasto 10000 (box A) + efetivo gasto 5000 (box B) + compra 3x com valorTotal 30000
    // esperado: 45000
  });
  it('ignora previsto, ganho e outra viagem', () => {
    // previsto gasto 7000, efetivo ganho 2000, efetivo gasto 4000 de outra viagem → 0
  });
});

describe('situacaoOrcamento', () => {
  it('dentro, no limite e passou', () => {
    expect(situacaoOrcamento(300000, 120000)).toEqual({ orcamentoCent: 300000, gastoCent: 120000, restanteCent: 180000 });
    expect(situacaoOrcamento(300000, 300000).restanteCent).toBe(0);
    expect(situacaoOrcamento(300000, 320000).restanteCent).toBe(-20000);
  });
});
```

Escreva o corpo dos dois primeiros `it` com os valores dos comentários (recalcule à mão: 10000 + 5000 + 30000 = 45000).

Acrescente, nos `describe` já existentes de `itensDaViagem` e `totalViagemNoMes`, um teste cada: "lançamento de ganho marcado na viagem não entra no total" (um gasto efetivo 10000 + um ganho efetivo 3000 na mesma viagem e box → total 10000).

Atualize todas as chamadas existentes das duas funções nos testes para o novo parâmetro `categorias` (use `[catGasto]` ou o array de categorias que o teste já tiver; 17 chamadas no total — `grep -rn "itensDaViagem(\|totalViagemNoMes(" src`).

- [ ] **Passo 2:** `npx vitest run src/domain/viagem.test.ts` → FAIL.

- [ ] **Passo 3: implementar** em `src/domain/viagem.ts`:

```ts
/** Categorias de ganho: lançamento nelas nunca é gasto de viagem (ex.: reembolso marcado). */
function idsCategoriasGanho(categorias: Categoria[]): Set<ID> {
  return new Set(categorias.filter((c) => c.tipo === 'ganho').map((c) => c.id));
}

/**
 * Gasto de uma viagem para o orçamento: lançamentos efetivos de gasto, de todas as boxes, e
 * compras de cartão pelo valor cheio. Previsto fica de fora até ser confirmado. Regra única —
 * a tela de adicionar e Ajustes → Viagens leem daqui.
 */
export function gastoDaViagem(
  viagem: Viagem, lancamentos: Lancamento[], comprasCartao: CompraCartao[], categorias: Categoria[],
): number {
  const ganhos = idsCategoriasGanho(categorias);
  let total = 0;
  for (const l of lancamentos) {
    if (l.viagemId !== viagem.id || l.status !== 'efetivo' || ganhos.has(l.categoriaId)) continue;
    total += l.valor;
  }
  for (const c of comprasCartao) {
    if (c.viagemId === viagem.id) total += c.valorTotal;
  }
  return total;
}

export interface SituacaoOrcamento { gastoCent: number; orcamentoCent: number; restanteCent: number }

/** `restanteCent` negativo = passou do orçamento. */
export function situacaoOrcamento(orcamentoCent: number, gastoCent: number): SituacaoOrcamento {
  return { gastoCent, orcamentoCent, restanteCent: orcamentoCent - gastoCent };
}
```

Em `itensDaViagem` e `totalViagemNoMes`: novo parâmetro `categorias: Categoria[]` (posições acima); calcule `const ganhos = idsCategoriasGanho(categorias);` e, no laço de lançamentos, `if (ganhos.has(l.categoriaId)) continue;`. Atualize o JSDoc de `itensDaViagem` ("só gastos"). Importe `Categoria` de `./types`.

Em `types.ts`: `orcamentoCent?: number; // centavos; ausente ou 0 = sem orçamento`.

Chamadas: `TelaAnalises.tsx` passa `dados.categorias` às duas funções e à `<ViagemSheet categorias={dados.categorias} … />`; `ViagemSheet.tsx` recebe a prop e repassa a `itensDaViagem`. Ajuste `ViagemSheet.test.tsx` (prop nova).

- [ ] **Passo 4:** `npx vitest run src/domain/viagem.test.ts src/ui/ViagemSheet.test.tsx src/ui/TelaAnalises.test.tsx` → PASS.
- [ ] **Passo 5:** `npm test` e `npm run build` verdes. Commit: `feat(viagem): gasto da viagem para o orçamento; ganho não conta como gasto (item 19)`.

---

### Tarefa 2: componente `LinhaOrcamentoViagem`

**Arquivos:**
- Criar: `src/ui/LinhaOrcamentoViagem.tsx`, `src/ui/LinhaOrcamentoViagem.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (seção de componentes, perto de `SeletorPills.tsx`)

**Interfaces:**
- Consome: `situacaoOrcamento` (Tarefa 1).
- Produz: `export default function LinhaOrcamentoViagem({ orcamentoCent, gastoCent, comEsteGasto }: { orcamentoCent: number; gastoCent: number; comEsteGasto?: boolean })`.

- [ ] **Passo 1: testes (falham)**

```tsx
import { render, screen } from '@testing-library/react';
import { formatarBRL } from '../domain/money';
import LinhaOrcamentoViagem from './LinhaOrcamentoViagem';

it('dentro do orçamento: mostra o que falta em verde', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={120000} />);
  expect(container.textContent).toBe(`${formatarBRL(120000)} de ${formatarBRL(300000)} · falta ${formatarBRL(180000)}`);
  expect(screen.getByText(formatarBRL(180000))).toHaveClass('valor-ganho');
});

it('no limite: falta R$ 0,00, ainda verde', () => {
  render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={300000} />);
  expect(screen.getByText(formatarBRL(0))).toHaveClass('valor-ganho');
});

it('passou: mostra o excesso em vermelho, com o ícone dentro do valor', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={320000} />);
  expect(container.textContent).toBe(`${formatarBRL(320000)} de ${formatarBRL(300000)} · passou ${formatarBRL(20000)}`);
  const forte = container.querySelector('strong.valor-gasto')!;
  expect(forte).toHaveTextContent(formatarBRL(20000));
  expect(forte.querySelector('svg')).not.toBeNull();
});

it('com este gasto: ganha o prefixo', () => {
  const { container } = render(<LinhaOrcamentoViagem orcamentoCent={300000} gastoCent={145000} comEsteGasto />);
  expect(container.textContent).toMatch(/^Com este gasto: /);
});
```

- [ ] **Passo 2:** `npx vitest run src/ui/LinhaOrcamentoViagem.test.tsx` → FAIL.

- [ ] **Passo 3: implementar**

```tsx
import { TriangleAlert } from 'lucide-react';
import { formatarBRL } from '../domain/money';
import { situacaoOrcamento } from '../domain/viagem';

/** "R$ X de R$ Y · falta/passou R$ Z" — o único texto do orçamento de viagem, usado na tela de
 *  adicionar (débito e cartão) e em Ajustes → Viagens. Cores das conferências: verde para o que
 *  sobra, vermelho para o que passou. O ícone fica dentro do valor para herdar o vermelho. */
export default function LinhaOrcamentoViagem({ orcamentoCent, gastoCent, comEsteGasto = false }: {
  orcamentoCent: number;
  gastoCent: number;
  /** a linha já soma o valor que está sendo digitado */
  comEsteGasto?: boolean;
}) {
  const { restanteCent } = situacaoOrcamento(orcamentoCent, gastoCent);
  return (
    <p className="sub" style={{ margin: 0 }}>
      {comEsteGasto && 'Com este gasto: '}
      {formatarBRL(gastoCent)} de {formatarBRL(orcamentoCent)} ·{' '}
      {restanteCent >= 0 ? (
        <>falta <strong className="valor-ganho">{formatarBRL(restanteCent)}</strong></>
      ) : (
        <>passou <strong className="valor-gasto">
          <TriangleAlert size={16} aria-hidden="true" style={{ verticalAlign: -3, marginRight: 4 }} />
          {formatarBRL(-restanteCent)}
        </strong></>
      )}
    </p>
  );
}
```

Se `getByText(formatarBRL(20000))` no teste "passou" casar com o `<strong>` inteiro por causa do `svg`, o teste acima já usa `querySelector` — mantenha.

- [ ] **Passo 4: catálogo** — em `docs/estilo/catalogo.md`, entrada nova na lista de componentes:

```markdown
- **`LinhaOrcamentoViagem.tsx`** — linha do orçamento de viagem, "R$ X de R$ Y · falta R$ Z"
  (verde, `strong.valor-ganho`) ou "· passou R$ Z" (vermelho, `strong.valor-gasto`, com o
  `TriangleAlert` dentro do valor). Prop `comEsteGasto` põe o prefixo "Com este gasto: ". Usada
  em `TelaLancar.tsx`, `FormCompra.tsx` e `ajustes/Viagens.tsx` — qualquer tela nova que mostre
  o orçamento usa este componente.
```

Rode `node scripts/verificar-catalogo.mjs` → sem aviso.

- [ ] **Passo 5:** `npm test` verde. Commit: `feat(viagem): linha do orçamento de viagem (item 19)`.

---

### Tarefa 3: orçamento em Ajustes → Viagens

**Arquivos:**
- Modificar: `src/db/repo.ts` (`NovaViagem` ~linha 280, `atualizarViagem` ~linha 292)
- Modificar: `src/ui/ajustes/Viagens.tsx`
- Testes: `src/db/repo.test.ts` (se houver bloco de viagem; senão, crie `describe('orçamento da viagem')`), `src/ui/ajustes/Viagens.test.tsx`

**Interfaces:**
- Consome: `gastoDaViagem` (Tarefa 1), `LinhaOrcamentoViagem` (Tarefa 2).
- Produz: `NovaViagem { nome; dataInicio; dataFim; orcamentoCent?: number }`; `atualizarViagem(id, patch: Partial<Pick<Viagem, 'nome' | 'dataInicio' | 'dataFim' | 'orcamentoCent'>>)`.

Regras:
- `orcamentoCent` 0 é gravado como **ausente** (`undefined`) — criar sem orçamento não grava o campo; editar para 0 apaga o campo.
- O formulário (criar e editar) ganha, numa `form-linha` própria depois das datas, `<div className="campo"><label htmlFor={`${uid}-orcamento`}>Orçamento (opcional)</label><CampoValor id={`${uid}-orcamento`} … /></div>`. `CamposViagem` ganha `orcamentoCent: number` (0 = sem).
- Na lista, cada viagem com `orcamentoCent > 0` mostra, depois da linha das datas, `<LinhaOrcamentoViagem orcamentoCent={v.orcamentoCent} gastoCent={gastoDaViagem(v, dados.lancamentos, dados.comprasCartao, dados.categorias)} />`. O `<p>` da linha fica dentro do `.cresce`, como a `.sub` das datas.

- [ ] **Passo 1: testes (falham)**
  - repo: `salvarViagem` com `orcamentoCent: 300000` grava; `atualizarViagem(id, { orcamentoCent: 0 })` deixa `orcamentoCent` ausente (`toBeUndefined()`); `atualizarViagem(id, { orcamentoCent: 250000 })` grava.
  - Viagens: criar com orçamento digitado (`userEvent.click` no campo "Orçamento (opcional)" e `keyboard('300000')`) grava `orcamentoCent: 300000`; viagem com orçamento e um lançamento efetivo de gasto de 120000 marcado nela mostra a linha com `formatarBRL(180000)`; viagem sem orçamento não mostra "de R$"; editar e zerar o orçamento some com a linha.
- [ ] **Passo 2:** rodar os dois arquivos → FAIL.
- [ ] **Passo 3: implementar.** Em `repo.ts`, normalize antes de gravar: em `salvarViagem`, `const { orcamentoCent, ...resto } = n; const v: Viagem = { id, criadoEm, alteradoEm, ...resto, ...(orcamentoCent ? { orcamentoCent } : {}) };`. Em `atualizarViagem`, se `'orcamentoCent' in patch` e o valor for falsy, grave `orcamentoCent: undefined` (o Dexie remove a chave). Em `Viagens.tsx`, `criar`/`atualizar` repassam o campo.
- [ ] **Passo 4:** arquivos → PASS.
- [ ] **Passo 5:** `npm test` e `npm run build` verdes. Commit: `feat(viagem): orçamento em Ajustes → Viagens (item 19)`.

---

### Tarefa 4: linha do orçamento na tela de adicionar

**Arquivos:**
- Modificar: `src/ui/TelaLancar.tsx`, `src/ui/FormCompra.tsx`
- Testes: `src/ui/TelaLancar.test.tsx`, `src/ui/FormCompra.test.tsx`

**Interfaces:**
- Consome: `gastoDaViagem` (Tarefa 1), `LinhaOrcamentoViagem` (Tarefa 2), `Viagem.orcamentoCent`.

**Regras:**
- A linha aparece só se `viagemAtiva?.orcamentoCent` > 0 **e** a caixa "Viagem: …" está marcada.
- `gastoAtual = gastoDaViagem(viagemAtiva, dados.lancamentos, dados.comprasCartao, dados.categorias)`.
- **TelaLancar:** o valor digitado conta se `cents > 0 && tipo === 'gasto' && !previsto && data <= hoje`. Então `<LinhaOrcamentoViagem orcamentoCent={…} gastoCent={gastoAtual + cents} comEsteGasto />`; senão `gastoCent={gastoAtual}` sem prefixo. Posição: logo depois do `<label htmlFor="viagem">`, antes do botão Lançar.
- **FormCompra:** o valor digitado conta se `valor > 0`. Editando uma compra (`compra`) que já é desta viagem (`compra.viagemId === viagemAtiva.id`), desconte `compra.valorTotal` do `gastoAtual` antes de somar `valor` — senão a compra conta duas vezes. Posição: logo depois do `<label htmlFor={`${uid}-viagem`}>`, dentro da mesma `.linha`, com `style={{ flexBasis: '100%' }}` num wrapper `<div>` para ocupar a linha inteira antes dos botões (estilo só de layout).

- [ ] **Passo 1: testes (falham).** Monte os dados com o repo (viagem com `orcamentoCent: 300000` cobrindo `hoje`; um lançamento efetivo de gasto de 120000 marcado nela), no padrão de setup já usado em cada arquivo de teste (leia o topo). Casos — TelaLancar:
  1. Sem valor: texto `${formatarBRL(120000)} de ${formatarBRL(300000)} · falta ${formatarBRL(180000)}`, sem "Com este gasto".
  2. Digitar 25000: `Com este gasto: ${formatarBRL(145000)} de …· falta ${formatarBRL(155000)}`.
  3. Digitar 200000: "passou" com `formatarBRL(20000)` em `strong.valor-gasto`.
  4. Com 25000 digitado: marcar previsto → volta a `formatarBRL(120000) de`; trocar para Ganho → idem.
  5. Desmarcar "Viagem: …" → a linha some (`queryByText(/ de R\$/)` nulo).
  6. Viagem sem orçamento → a linha não aparece.
  FormCompra:
  7. Nova compra com valor 50000 → `Com este gasto: ${formatarBRL(170000)}`.
  8. Editar uma compra de 30000 já marcada na viagem (gasto atual = 120000 + 30000 = 150000), trocando o valor para 40000 → `Com este gasto: ${formatarBRL(160000)}` (não 190000).
- [ ] **Passo 2:** arquivos → FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** arquivos → PASS.
- [ ] **Passo 5:** `npm test` e `npm run build` verdes. Commit: `feat(viagem): orçamento na tela de adicionar, com prévia do gasto (item 19)`.

---

### Tarefa 5: wiki

**Arquivos:** `docs/wiki/3-conceitos.md` (seção `## Viagem`), `docs/wiki/7-ajustes.md` (seção Viagens), talvez `docs/wiki/8-glossario.md`.

- [ ] Leia `docs/wiki/README.md` (subconjunto fechado de markdown).
- [ ] `3-conceitos.md`, na lista da seção Viagem, bullet novo depois de "Marcação":

```markdown
- **Orçamento:** opcional, informado em Ajustes → Viagens. Na tela de adicionar, logo abaixo de "Viagem: nome", o app mostra quanto já foi gasto, de quanto, e quanto falta — em verde — ou quanto passou — em vermelho, com um alerta. Enquanto você digita um gasto, a linha já soma o valor ("Com este gasto:").
- O orçamento conta só o que já aconteceu: lançamentos efetivos e compras no cartão, pelo valor cheio. Previsto entra quando for confirmado. Ganho marcado na viagem, como um reembolso, não conta como gasto — nem no orçamento, nem nos totais das Análises.
```

- [ ] `7-ajustes.md`, seção Viagens: "Cadastro das viagens: nome, data inicial, data final e, se quiser, um orçamento." e uma frase: "Viagem com orçamento mostra, na lista, quanto já foi gasto e quanto falta."
- [ ] `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS. `npm test` verde. Commit: `docs(wiki): orçamento de viagem (item 19)`.
