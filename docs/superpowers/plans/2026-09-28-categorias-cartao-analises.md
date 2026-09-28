# Categorias do cartão em Análises — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** corrigir o texto que "dança" no app inteiro e criar o card "Categorias do cartão" em Análises, com a folha de histórico de 6 meses.

**Arquitetura:** parte 1 muda `classeEfeito` para devolver uma classe neutra no zero e acerta a coluna fixa das tabelas. Parte 2 cria uma função pura de domínio (`totaisCategoriaCartaoPorMes`) usada por dois componentes novos (`CategoriasCartaoCard`, `CategoriaCartaoHistoricoSheet`), montados pela `TelaAnalises`.

**Tecnologia:** React 18, TypeScript, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-28-categorias-cartao-analises-design.md`.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\categorias-cartao-analises`, branch `categorias-cartao-analises`. Não toque no checkout principal (`C:\Users\eitor\Claude\ProjetoFinancas`). Antes da primeira edição, `git rev-parse --show-toplevel` deve devolver o worktree.
- Todo texto de UI, comentário, doc e mensagem de commit em português.
- Nenhuma dependência nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.claude/`.
- Valores em centavos inteiros. Formato de dinheiro: `formatarBRL` ("R$ 1.240,00"), sem sinal; a cor diz o sentido.
- Dados de teste sintéticos.
- Arquivos em UTF-8 sem BOM.
- Não apertar timeouts de teste; não usar `{ timeout: n }` em `findBy*`.
- Cada tarefa termina com `npm test` inteiro verde antes do commit.
- Mensagem de commit termina com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NUgyWrAK4bULG5mix3ecPs
  ```

---

### Tarefa 1: Valor zerado com a mesma tipografia (`.valor-neutro`)

**Arquivos:**
- Modificar: `src/domain/money.ts:49-54`
- Modificar: `src/domain/money.test.ts:145-150`
- Modificar: `src/styles.css:136-157`
- Modificar: `src/ui/TelaHoje.tsx:448`
- Modificar: `src/ui/TabelaSimulacao.tsx:38`
- Modificar: `src/ui/TelaAnalises.tsx:157`
- Modificar: `src/ui/FaturaCategoriaSheet.tsx:41`
- Modificar: `src/ui/FaturaResumo.tsx:75`
- Modificar: `src/ui/TelaAnalises.test.tsx:248` e `:294-296`
- Modificar: `docs/estilo/fundamentos.md:58-59`, `docs/estilo/catalogo.md:28-29,38`

**Interfaces:**
- Produz: `classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | 'valor-neutro'` — nunca mais `undefined`. Classe CSS `.valor-neutro`.

- [ ] **Passo 1: teste que falha** — em `src/domain/money.test.ts`, no `describe('classeEfeito')`, troque `expect(classeEfeito(0)).toBeUndefined();` por:

```ts
    expect(classeEfeito(0)).toBe('valor-neutro');
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/domain/money.test.ts`
Esperado: FAIL em `classeEfeito` (recebido `undefined`).

- [ ] **Passo 3: implementar** — em `src/domain/money.ts`, substitua a função:

```ts
/** Classe de cor de um efeito no saldo: verde entra, vermelho sai. Zero fica sem cor, mas com
 *  a mesma tipografia (`.valor-neutro`): na mesma coluna ou lista, o zero não pode "dançar". */
export function classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | 'valor-neutro' {
  if (efeito > 0) return 'valor-ganho';
  if (efeito < 0) return 'valor-gasto';
  return 'valor-neutro';
}
```

- [ ] **Passo 4: CSS** — em `src/styles.css`, troque o bloco das linhas 136-157 por:

```css
.valor-ganho, .valor-gasto, .valor-neutro {
  font-variant-numeric: tabular-nums; font-weight: 700; font-size: 14.5px;
  padding: 6px 12px; border-radius: 12px; white-space: nowrap;
}
.valor-ganho { color: var(--pos); background: var(--pos-bg); }
.valor-gasto { color: var(--neg); background: var(--neg-bg); }
/* zero: sem cor e sem pílula, mas com a tipografia e o recuo das pílulas vizinhas — o
   texto do zero fica alinhado ao texto dos outros valores da coluna ou da lista */
.valor-neutro { background: none; }
/* valor de um previsto que dá pra corrigir num toque (fila de Pendentes, TelaHoje): o
   sublinhado pontilhado é a única pista de que o valor é tocável, e o min-height sobe a
   pílula ao alvo mínimo de toque (38px, fundamentos.md). */
.valor-ganho.editavel, .valor-gasto.editavel, .valor-neutro.editavel {
  border: none; font-family: inherit; cursor: pointer;
  min-height: 38px; display: inline-flex; align-items: center;
  text-decoration: underline dotted; text-underline-offset: 3px;
}
/* lista do Fluxo: totalizador do dia (cabeçalho, fora de .item) fica em negrito por já ser
   <strong>; o valor de cada transação (dentro de .item) fica sem negrito pra diferenciar. */
.lista-fluxo .item .valor-ganho, .lista-fluxo .item .valor-gasto, .lista-fluxo .item .valor-neutro { font-weight: 400; }
/* em tabelas e em texto corrido (ex.: rótulo do dia no Fluxo), só a cor — sem pílula */
.tabela .valor-ganho, .tabela .valor-gasto, .tabela .valor-neutro,
strong.valor-ganho, strong.valor-gasto, strong.valor-neutro {
  background: none; padding: 0; border-radius: 0;
}
```

- [ ] **Passo 5: pontos que escolhem a classe na mão**

`src/ui/TelaHoje.tsx:448` — tire o `?? ''`:

```tsx
                      className={`${classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId)))} editavel`}
```

`src/ui/TabelaSimulacao.tsx:38` — o "—" ganha a classe neutra:

```tsx
                  {l.dif === 0 ? <strong className="valor-neutro">—</strong> : <strong className={classeEfeito(l.dif)}>{formatarSemSimbolo(l.dif)}</strong>}
```

`src/ui/TelaAnalises.tsx:157` — média 3m sem dados:

```tsx
                    <td className={media == null ? 'valor-neutro' : classeEfeito(efeitoNoSaldo(media, c.tipo))}>{media == null ? '—' : formatarBRL(media)}</td>
```

`src/ui/FaturaCategoriaSheet.tsx:41` e `src/ui/FaturaResumo.tsx:75` — troque o ternário inteiro por (e acrescente `classeEfeito` ao import de `../domain/money` nos dois arquivos):

```tsx
            <strong className={classeEfeito(-total)}>{formatarBRL(total)}</strong>
```

- [ ] **Passo 6: testes de UI do zero** — em `src/ui/TelaAnalises.test.tsx`:
  - linha 248, acrescente abaixo: `expect(within(linha).getByText('R$ 0,00')).toHaveClass('valor-neutro');`
  - no teste "sobra zero", acrescente depois da linha 296: `expect(sobra).toHaveClass('valor-neutro');` e renomeie o teste para `'sobra zero (ganho igual ao gasto) fica sem cor, com a tipografia dos outros valores'`.

- [ ] **Passo 7: docs**
  - `docs/estilo/fundamentos.md:58-59`: troque "Movimento zero fica\n  sem cor." por "Movimento zero fica\n  sem cor, com a mesma tipografia (`.valor-neutro`): na mesma coluna ou lista, nenhum valor muda de tamanho ou de peso."
  - `docs/estilo/catalogo.md:28`: a linha passa a ser `| \`.valor-ganho\`, \`.valor-gasto\`, \`.valor-neutro\` | efeito no saldo (verde entra, vermelho sai; neutro = zero, sem cor e sem fundo, mesma tipografia e recuo), via \`classeEfeito\`; valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de \`.tabela\` ou em \`<strong>\` |`
  - `docs/estilo/catalogo.md:29` e `:38`: onde está "`.valor-ganho`/`.valor-gasto`", escreva "`.valor-ganho`/`.valor-gasto`/`.valor-neutro`".

- [ ] **Passo 8: suíte, verificador e build**

Run: `npm test` → tudo PASS.
Run: `node scripts/verificar-catalogo.mjs` → sem aviso sobre `.valor-neutro`.
Run: `npm run build` → sem erro de tipo.
Se `npm test` acusar o dossiê desatualizado, rode `npm run dossie` e inclua `docs/dossie/` no commit.

- [ ] **Passo 9: commit**

```bash
git add -A src docs
git commit -m "fix(ui): valor zerado com a mesma tipografia dos outros (.valor-neutro)"
```

---

### Tarefa 2: Coluna fixa sem fiapo

**Arquivos:**
- Modificar: `src/styles.css` (regra `table.tabela th:first-child, table.tabela td:first-child` com `position: sticky`, ~linha 262)

- [ ] **Passo 1: implementar** — na regra da coluna fixa, troque o `box-shadow` e o comentário acima dela:

```css
/* coluna fixa: largura própria fixa (não automática) — mantém o cálculo de largura das
   outras colunas previsível. Sombra sutil na borda direita sinaliza que ela "flutua na
   frente" do conteúdo que rola por baixo. A faixa de 2px na cor do card, à esquerda, cobre
   a fresta de 1px por onde o valor que rola vazava como um fiapo colorido em telas de
   densidade fracionária (2,63 no Galaxy S25+). */
table.tabela th:first-child, table.tabela td:first-child {
  position: sticky; left: 0; z-index: 2; background: var(--surface);
  white-space: normal; width: 112px; max-width: 112px;
  box-shadow: -2px 0 0 var(--surface), 4px 0 6px -4px rgba(0, 0, 0, .45);
}
```

- [ ] **Passo 2:** `npm test` → PASS. `npm run build` → OK.

- [ ] **Passo 3: commit**

```bash
git add src/styles.css
git commit -m "fix(ui): coluna fixa das tabelas cobre a fresta que mostrava fiapo do valor"
```

---

### Tarefa 3: `totaisCategoriaCartaoPorMes` (domínio)

**Arquivos:**
- Modificar: `src/domain/fatura.ts` (nova função, logo depois de `resumoPorCategoria`, ~linha 116)
- Teste: `src/domain/fatura.test.ts` (novo `describe` no fim; importar a função)

**Interfaces:**
- Produz: `totaisCategoriaCartaoPorMes(cartao: CicloCartao, compras: CompraCartao[], meses: readonly string[], ajustes?: ReadonlyMap<string, number>): Map<ID, number[]>` — para cada categoria do cartão com algum item nos meses pedidos, um array de centavos na ordem de `meses`. `compras` = só as do cartão. Mês sem item = 0.

- [ ] **Passo 1: testes que falham** — acrescente `totaisCategoriaCartaoPorMes` ao import de `./fatura` e, no fim de `src/domain/fatura.test.ts`:

```ts
describe('totaisCategoriaCartaoPorMes', () => {
  // nubank: fecha 28, vence 5 do mês seguinte
  it('compra parcelada conta uma parcela em cada fatura', () => {
    const compras = [compra('2026-07-10', 30000, 3, 'mercado')];
    const r = totaisCategoriaCartaoPorMes(nubank, compras, ['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.get('mercado')).toEqual([10000, 10000, 10000, 0]);
  });
  it('resto do centavo vai para a primeira parcela, como em valorParcela', () => {
    const compras = [compra('2026-07-10', 10000, 3, 'mercado')];
    const r = totaisCategoriaCartaoPorMes(nubank, compras, ['2026-08', '2026-09', '2026-10']);
    expect(r.get('mercado')).toEqual([3334, 3333, 3333]);
  });
  it('compra no dia do fechamento cai na fatura seguinte; com ajuste de fechamento, na certa', () => {
    const compras = [compra('2026-07-28', 5000, 1, 'farmacia')];
    const meses = ['2026-08', '2026-09'];
    expect(totaisCategoriaCartaoPorMes(nubank, compras, meses).get('farmacia')).toEqual([0, 5000]);
    const ajustes = new Map([['2026-07', 30]]); // em julho, fechou no dia 30
    expect(totaisCategoriaCartaoPorMes(nubank, compras, meses, ajustes).get('farmacia')).toEqual([5000, 0]);
  });
  it('estorno reduz o total do mês', () => {
    const compras = [compra('2026-07-10', 20000, 1, 'mercado'), compra('2026-07-12', -5000, 1, 'mercado')];
    expect(totaisCategoriaCartaoPorMes(nubank, compras, ['2026-08']).get('mercado')).toEqual([15000]);
  });
  it('categoria sem item nos meses pedidos não aparece', () => {
    const compras = [compra('2026-07-10', 20000, 1, 'mercado')];
    expect(totaisCategoriaCartaoPorMes(nubank, compras, ['2026-01', '2026-02']).size).toBe(0);
  });
  it('meses fora de ordem: valores seguem a ordem pedida', () => {
    const compras = [compra('2026-07-10', 30000, 3, 'mercado'), compra('2026-09-10', 7000, 1, 'mercado')];
    // parcelas em 08, 09, 10; a compra de 10/09 vence em 10
    expect(totaisCategoriaCartaoPorMes(nubank, compras, ['2026-10', '2026-08']).get('mercado')).toEqual([17000, 10000]);
  });
  it('lista de meses vazia devolve mapa vazio', () => {
    expect(totaisCategoriaCartaoPorMes(nubank, [compra('2026-07-10', 100)], []).size).toBe(0);
  });
  it('o mês bate com resumoPorCategoria da mesma fatura', () => {
    const compras = [
      compra('2026-07-10', 30000, 3, 'mercado'),
      compra('2026-08-02', 4590, 1, 'farmacia'),
      compra('2026-08-15', -1200, 1, 'mercado'),
      compra('2026-08-20', 9999, 2, 'viagem'),
    ];
    const fatura = calcularFaturas(nubank, compras, '2026-12-31').find((f) => f.mes === '2026-09')!;
    const r = totaisCategoriaCartaoPorMes(nubank, compras, ['2026-09']);
    const doResumo = resumoPorCategoria(fatura);
    expect(doResumo.length).toBeGreaterThan(0);
    for (const [cat, cent] of doResumo) expect(r.get(cat)).toEqual([cent]);
    expect(r.size).toBe(doResumo.length);
  });
});
```

Conferência à mão: `nubank` fecha 28. Compra 10/07 → fecha 07 → vence 08; 3 parcelas → 08, 09, 10. Compra 28/07 = dia do fechamento → fecha 08 → vence 09. Com ajuste 30 em julho, 28/07 < 30/07 → fecha 07 → vence 08. Compra 10/09 → fecha 09 → vence 10: outubro = 10000 + 7000 = 17000. No último teste, fatura 09 (fecha 28/08): parcela 2 de mercado (10000), farmácia 02/08 (4590), mercado −1200 de 15/08, viagem 1ª parcela de 9999/2 = 5000 → mercado 8800, farmácia 4590, viagem 5000.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run src/domain/fatura.test.ts`
Esperado: FAIL — `totaisCategoriaCartaoPorMes` não é exportada.

- [ ] **Passo 3: implementar** — em `src/domain/fatura.ts`, logo depois de `resumoPorCategoria`:

```ts
/**
 * Total de cada categoria do cartão em cada mês de fatura pedido ('AAAA-MM' do vencimento, a
 * chave de `Fatura.mes`). É a conta de `calcularFaturas` — cada parcela conta na fatura em que
 * cai —, então o valor de um mês bate com `resumoPorCategoria` da mesma fatura. `compras` são
 * só as deste cartão. Um mês sem item da categoria vale 0; categoria sem item em nenhum dos
 * meses fica fora do mapa.
 */
export function totaisCategoriaCartaoPorMes(
  cartao: CicloCartao, compras: CompraCartao[], meses: readonly string[], ajustes?: ReadonlyMap<string, number>,
): Map<ID, number[]> {
  const totais = new Map<ID, number[]>();
  if (meses.length === 0) return totais;
  const ultimo = meses.reduce((a, b) => (b > a ? b : a));
  const ate = datasFaturaDoMes(cartao, ultimo, ajustes).dataVencimento;
  const faturas = new Map(calcularFaturas(cartao, compras, ate, ajustes).map((f) => [f.mes, f] as const));
  meses.forEach((mes, i) => {
    const fatura = faturas.get(mes);
    if (!fatura) return;
    for (const [categoriaId, cent] of resumoPorCategoria(fatura)) {
      let serie = totais.get(categoriaId);
      if (!serie) {
        serie = meses.map(() => 0);
        totais.set(categoriaId, serie);
      }
      serie[i] += cent;
    }
  });
  return totais;
}
```

- [ ] **Passo 4:** `npx vitest run src/domain/fatura.test.ts` → PASS. Depois `npm test` → PASS.

- [ ] **Passo 5: commit**

```bash
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "feat(fatura): total por categoria do cartão em vários meses de fatura"
```

---

### Tarefa 4: folha `CategoriaCartaoHistoricoSheet`

**Arquivos:**
- Criar: `src/ui/CategoriaCartaoHistoricoSheet.tsx`
- Criar: `src/ui/CategoriaCartaoHistoricoSheet.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (seção "Componentes compartilhados", depois do bullet de `FaturaCategoriaSheet.tsx`)

**Interfaces:**
- Consome: `totaisCategoriaCartaoPorMes` (Tarefa 3), `classeEfeito` (Tarefa 1).
- Produz: `export default function CategoriaCartaoHistoricoSheet(props: { aberto: boolean; cartao: Cartao | null; categoria: CategoriaCartao | null; mes: string; comprasCartao: CompraCartao[]; ajustesFechamento: AjusteFechamento[]; onFechar: () => void })`.

- [ ] **Passo 1: teste que falha** — `src/ui/CategoriaCartaoHistoricoSheet.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import CategoriaCartaoHistoricoSheet from './CategoriaCartaoHistoricoSheet';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const cartao: Cartao = {
  id: 'k1', boxId: 'b1', nome: 'Cartão Azul', diaFechamento: 28, diaVencimento: 5,
  categoriaFaturaId: 'catFlow', ativo: true, ...ts,
};
const mercado: CategoriaCartao = { id: 'mercado', cartaoId: 'k1', nome: 'Mercado', ordem: 0, arquivada: false, ...ts };

function compra(id: string, data: string, valorTotal: number, cartaoId = 'k1'): CompraCartao {
  return { id, cartaoId, categoriaCartaoId: 'mercado', data, valorTotal, parcelas: 1, ...ts };
}

function abrir(compras: CompraCartao[]) {
  render(
    <CategoriaCartaoHistoricoSheet
      aberto cartao={cartao} categoria={mercado} mes="2026-09"
      comprasCartao={compras} ajustesFechamento={[]} onFechar={() => {}}
    />,
  );
  return screen.getByRole('dialog', { name: 'Mercado · Cartão Azul' });
}

describe('CategoriaCartaoHistoricoSheet', () => {
  it('mostra os 6 meses até o mês escolhido, do mais antigo ao mais novo, e a média', () => {
    // faturas: 06/2026 ← compra de 10/05; 08/2026 ← 10/07; 09/2026 ← 10/08
    const dialog = abrir([
      compra('a', '2026-05-10', 30000),
      compra('b', '2026-07-10', 60000),
      compra('c', '2026-08-10', 90000),
    ]);
    const rotulos = within(dialog).getAllByText(/^[a-z]{3}\/2026$/).map((e) => e.textContent);
    expect(rotulos).toEqual(['abr/2026', 'mai/2026', 'jun/2026', 'jul/2026', 'ago/2026', 'set/2026']);
    expect(within(dialog).getAllByText('R$ 300,00')[0]).toHaveClass('valor-gasto'); // jun; a média também dá 300,00
    expect(within(dialog).getByText('R$ 900,00')).toHaveClass('valor-gasto');
    // 30000 + 60000 + 90000 = 180000 / 6 = 30000
    const media = within(dialog).getByText('média 6m').querySelector('strong');
    expect(media?.textContent).toBe('R$ 300,00');
    expect(within(dialog).getByText('últimos 6 meses, pelo mês da fatura')).toBeInTheDocument();
  });

  it('mês zerado fica neutro e com barra vazia; o maior mês enche a barra', () => {
    const dialog = abrir([compra('b', '2026-07-10', 60000), compra('c', '2026-08-10', 90000)]);
    const zeros = within(dialog).getAllByText('R$ 0,00');
    expect(zeros).toHaveLength(4);
    for (const z of zeros) expect(z).toHaveClass('valor-neutro');
    const barras = dialog.querySelectorAll<HTMLElement>('.composicao-preenchimento');
    expect([...barras].map((b) => b.style.width)).toEqual(['0%', '0%', '0%', '0%', '66.67%', '100%']);
  });

  it('estorno líquido no mês: valor verde e barra de ganho', () => {
    const dialog = abrir([compra('e', '2026-08-10', -12000)]);
    expect(within(dialog).getAllByText(/^R\$\s120,00$/)[0]).toHaveClass('valor-ganho');
    const barras = dialog.querySelectorAll('.composicao-preenchimento');
    expect(barras[5]).toHaveClass('ganho');
  });

  it('ignora compra de outro cartão', () => {
    const dialog = abrir([compra('x', '2026-08-10', 50000, 'outro')]);
    expect(within(dialog).queryByText('R$ 500,00')).not.toBeInTheDocument();
  });

  it('sem cartão ou categoria não renderiza nada', () => {
    const { container } = render(
      <CategoriaCartaoHistoricoSheet
        aberto cartao={null} categoria={null} mes="2026-09"
        comprasCartao={[]} ajustesFechamento={[]} onFechar={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

Conferência à mão: fecha 28, vence 5 do mês seguinte. 10/05 → vence 06; 10/07 → vence 08; 10/08 → vence 09. Meses abr..set = [0, 0, 30000, 0, 60000, 90000]. No segundo teste: [0,0,0,0,60000,90000]; 60000/90000 = 66,67%. No terceiro: média = −12000/6 = −2000 → 2000 centavos, verde; o mês set = 12000 centavos.

- [ ] **Passo 2:** `npx vitest run src/ui/CategoriaCartaoHistoricoSheet.test.tsx` → FAIL (arquivo não existe).

- [ ] **Passo 3: implementar** — `src/ui/CategoriaCartaoHistoricoSheet.tsx`:

```tsx
import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  cartao: Cartao | null;
  categoria: CategoriaCartao | null;
  mes: string;
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onFechar: () => void;
}

/** Folha somente leitura: uma categoria do cartão nos 6 meses de fatura que terminam em `mes`,
 *  em barras (100% = maior mês), com a média dos 6. Mesma conta da tabela de Análises. */
export default function CategoriaCartaoHistoricoSheet({
  aberto, cartao, categoria, mes, comprasCartao, ajustesFechamento, onFechar,
}: Props) {
  if (!cartao || !categoria) return null;
  const meses = [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));
  const serie = totaisCategoriaCartaoPorMes(
    cartao,
    comprasCartao.filter((c) => c.cartaoId === cartao.id),
    meses,
    ajustesDoCartao(ajustesFechamento, cartao.id),
  ).get(categoria.id) ?? meses.map(() => 0);
  const maior = Math.max(...serie.map(Math.abs));
  const media = Math.round(serie.reduce((a, b) => a + b, 0) / serie.length);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));
  const titulo = `${categoria.nome} · ${cartao.nome}`;

  return (
    <Sheet
      aberto={aberto} onFechar={onFechar} rotulo={titulo}
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{titulo}</h2>
          <p className="sub" style={{ margin: 0 }}>últimos 6 meses, pelo mês da fatura</p>
        </>
      )}
    >
      <div className="composicao-lista">
        {meses.map((m, i) => {
          const v = serie[i];
          const largura = maior === 0 ? 0 : Math.round((Math.abs(v) / maior) * 10000) / 100;
          return (
            <div className="composicao-linha" key={m} style={{ cursor: 'default' }}>
              <div className="composicao-rotulo">
                <span className="composicao-nome">{mesAbreviado(m)}</span>
                <span className="composicao-valores">
                  <strong className={cor(v)}>{formatarBRL(v)}</strong>
                </span>
              </div>
              <div className="composicao-trilho">
                <div className={`composicao-preenchimento ${v < 0 ? 'ganho' : 'gasto'}`} style={{ width: `${largura}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        média 6m <strong className={cor(media)}>{formatarBRL(media)}</strong>
      </p>
    </Sheet>
  );
}
```

- [ ] **Passo 4: catálogo** — em `docs/estilo/catalogo.md`, depois do bullet de `FaturaCategoriaSheet.tsx`:

```md
- **`CategoriaCartaoHistoricoSheet.tsx`** — sheet somente leitura com uma categoria do cartão
  nos 6 meses de fatura até o mês escolhido, em barras `.composicao-*` (100% = maior mês) e a
  média; aberto pelo card "Categorias do cartão" de Análises (`totaisCategoriaCartaoPorMes`).
```

- [ ] **Passo 5:** `npx vitest run src/ui/CategoriaCartaoHistoricoSheet.test.tsx` → PASS; `npm test` → PASS; `node scripts/verificar-catalogo.mjs` → sem aviso novo.

- [ ] **Passo 6: commit**

```bash
git add src/ui/CategoriaCartaoHistoricoSheet.tsx src/ui/CategoriaCartaoHistoricoSheet.test.tsx docs/estilo/catalogo.md
git commit -m "feat(analises): folha com os últimos 6 meses de uma categoria do cartão"
```

---

### Tarefa 5: card `CategoriasCartaoCard`

**Arquivos:**
- Criar: `src/ui/CategoriasCartaoCard.tsx`
- Criar: `src/ui/CategoriasCartaoCard.test.tsx`
- Modificar: `src/styles.css` (nova regra logo depois do bloco `.tabela-fixa`, ~linha 272)
- Modificar: `docs/estilo/catalogo.md` (tabela de classes, depois da linha de `.tabela-fixa`; seção de componentes, depois do bullet da Tarefa 4)

**Interfaces:**
- Consome: `totaisCategoriaCartaoPorMes` (Tarefa 3), `classeEfeito` (Tarefa 1), `mediaMovel3` (`src/domain/aggregations.ts`), `compararCategoriasCartao` (`src/domain/categorias.ts`).
- Produz: `export interface LinhaCategoriaCartao { cartaoId: ID; categoriaCartaoId: ID }` e `export default function CategoriasCartaoCard(props: { mes: string; boxIds: readonly ID[]; cartoes: Cartao[]; categoriasCartao: CategoriaCartao[]; comprasCartao: CompraCartao[]; ajustesFechamento: AjusteFechamento[]; onAbrir: (linha: LinhaCategoriaCartao) => void })`.

- [ ] **Passo 1: teste que falha** — `src/ui/CategoriasCartaoCard.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatarBRL } from '../domain/money';
import type { Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import CategoriasCartaoCard from './CategoriasCartaoCard';

const ts = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
function cartao(id: string, nome: string, boxId = 'b1', ativo = true): Cartao {
  return { id, boxId, nome, diaFechamento: 28, diaVencimento: 5, categoriaFaturaId: `f-${id}`, ativo, ...ts };
}
function categoria(id: string, cartaoId: string, nome: string, ordem: number, arquivada = false): CategoriaCartao {
  return { id, cartaoId, nome, ordem, arquivada, ...ts };
}
function compra(id: string, cartaoId: string, categoriaCartaoId: string, data: string, valorTotal: number): CompraCartao {
  return { id, cartaoId, categoriaCartaoId, data, valorTotal, parcelas: 1, ...ts };
}

const azul = cartao('k1', 'Cartão Azul');
const verde = cartao('k2', 'Cartão Verde');
const cats = [
  categoria('mercado', 'k1', 'Mercado', 0),
  categoria('farmacia', 'k1', 'Farmácia', 1),
  categoria('antiga', 'k1', 'Antiga', 2, true),
  categoria('transporte', 'k2', 'Transporte', 0),
  categoria('outra', 'k3', 'Outra', 0),
];

function renderizar(p: { cartoes?: Cartao[]; compras: CompraCartao[]; boxIds?: string[]; onAbrir?: () => void }) {
  render(
    <CategoriasCartaoCard
      mes="2026-09" boxIds={p.boxIds ?? ['b1']} cartoes={p.cartoes ?? [azul]} categoriasCartao={cats}
      comprasCartao={p.compras} ajustesFechamento={[]} onAbrir={p.onAbrir ?? (() => {})}
    />,
  );
  return screen.getByText('Categorias do cartão').closest('.card') as HTMLElement;
}

describe('CategoriasCartaoCard', () => {
  // fecha 28, vence 5 do mês seguinte: compra de 10/08 → fatura 09; 10/07 → 08; 10/06 → 07; 10/08/2025 → 09/2025
  it('mostra mês, mês anterior, ano passado e média 3m por categoria', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 124000),
        compra('b', 'k1', 'mercado', '2026-07-10', 98000),
        compra('c', 'k1', 'mercado', '2026-06-10', 105000),
        compra('d', 'k1', 'mercado', '2025-08-10', 87000),
      ],
    });
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const celulas = within(linha).getAllByRole('cell').map((c) => c.textContent);
    // média 3m = (105000 + 98000 + 124000) / 3 = 109000
    expect(celulas.slice(1)).toEqual([124000, 98000, 87000, 109000].map(formatarBRL));
    expect(within(card).getByText('set/2026')).toBeInTheDocument();
  });

  it('com um cartão só, não mostra o nome do cartão; com dois, um bloco por cartão', () => {
    const compras = [
      compra('a', 'k1', 'mercado', '2026-08-10', 10000),
      compra('b', 'k2', 'transporte', '2026-08-10', 20000),
    ];
    const card1 = renderizar({ compras });
    expect(card1.querySelector('.rotulo-grupo')).toBeNull();
    card1.remove();
    const card2 = renderizar({ cartoes: [azul, verde], compras });
    const rotulos = [...card2.querySelectorAll('.rotulo-grupo')].map((e) => e.textContent);
    expect(rotulos).toEqual(['Cartão Azul', 'Cartão Verde']);
  });

  it('cartão de outra box fica fora; cartão inativo com histórico entra', () => {
    const outraBox = cartao('k3', 'Cartão Laranja', 'b2');
    const inativo = cartao('k2', 'Cartão Verde', 'b1', false);
    const card = renderizar({
      cartoes: [azul, inativo, outraBox],
      compras: [
        compra('a', 'k1', 'mercado', '2026-08-10', 10000),
        compra('b', 'k2', 'transporte', '2026-08-10', 20000),
        compra('c', 'k3', 'outra', '2026-08-10', 30000),
      ],
    });
    expect(within(card).getByText('Cartão Verde')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Transporte' })).toBeInTheDocument();
    expect(within(card).queryByText('Cartão Laranja')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Outra' })).not.toBeInTheDocument();
  });

  it('categoria arquivada com valor aparece; linha some quando os três meses são zero', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'antiga', '2026-08-10', 5000),
        compra('b', 'k1', 'farmacia', '2026-06-10', 3000), // só em jul/2026 = mês − 2
      ],
    });
    expect(within(card).getByRole('button', { name: 'Antiga' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Farmácia' })).not.toBeInTheDocument();
  });

  it('zero fica neutro; estorno líquido fica verde', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'mercado', '2026-07-10', 15000), // ago: gasto
        compra('b', 'k1', 'farmacia', '2026-08-10', -12000), // set: estorno
      ],
    });
    const mercado = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    const [, atual, anterior] = within(mercado).getAllByRole('cell');
    expect(atual).toHaveClass('valor-neutro');
    expect(anterior).toHaveClass('valor-gasto');
    const farmacia = within(card).getByRole('button', { name: 'Farmácia' }).closest('tr') as HTMLElement;
    expect(within(farmacia).getAllByRole('cell')[1]).toHaveClass('valor-ganho');
  });

  it('ordem das linhas segue a ordem das categorias do cartão', () => {
    const card = renderizar({
      compras: [
        compra('a', 'k1', 'farmacia', '2026-08-10', 90000),
        compra('b', 'k1', 'mercado', '2026-08-10', 1000),
      ],
    });
    const nomes = within(card).getAllByRole('button').map((b) => b.textContent);
    expect(nomes).toEqual(['Mercado', 'Farmácia']);
  });

  it('tocar no nome chama onAbrir com o cartão e a categoria', async () => {
    const onAbrir = vi.fn();
    const card = renderizar({ compras: [compra('a', 'k1', 'mercado', '2026-08-10', 10000)], onAbrir });
    await userEvent.click(within(card).getByRole('button', { name: 'Mercado' }));
    expect(onAbrir).toHaveBeenCalledWith({ cartaoId: 'k1', categoriaCartaoId: 'mercado' });
  });

  it('sem gasto em nenhum cartão mostra a mensagem de vazio, sem tabela', () => {
    const card = renderizar({ compras: [] });
    expect(within(card).getByText('Sem gastos no cartão para comparar.')).toBeInTheDocument();
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });
});
```

O primeiro teste compara com `formatarBRL` porque `textContent` não normaliza o espaço não separável que a função põe depois de "R$".

Conferência à mão do primeiro teste: set/2026 = compra de 10/08 (124000); ago = 10/07 (98000); jul = 10/06 (105000); set/2025 = 10/08/2025 (87000). Média de jul, ago, set = 327000/3 = 109000.

- [ ] **Passo 2:** `npx vitest run src/ui/CategoriasCartaoCard.test.tsx` → FAIL (arquivo não existe).

- [ ] **Passo 3: CSS** — em `src/styles.css`, logo depois da regra `.tabela-fixa.tabela th:first-child, ...`:

```css
/* nome tocável dentro de uma célula de .tabela (card "Categorias do cartão", Análises): parece
   texto da tabela — mesmo tamanho e peso das células vizinhas —, só a cor de ação diz que abre
   algo. Não usar .botao-ver-mais aqui: 13px ao lado de nomes 16px faz o texto "dançar". */
.tabela-nome-tocavel {
  background: none; border: none; padding: 0; min-height: 0;
  color: var(--ac); font-size: inherit; font-weight: inherit; text-align: left;
}
```

- [ ] **Passo 4: implementar** — `src/ui/CategoriasCartaoCard.tsx`:

```tsx
import { Fragment } from 'react';
import { mediaMovel3 } from '../domain/aggregations';
import { compararCategoriasCartao } from '../domain/categorias';
import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ID } from '../domain/types';

export interface LinhaCategoriaCartao {
  cartaoId: ID;
  categoriaCartaoId: ID;
}

interface Props {
  mes: string;
  boxIds: readonly ID[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onAbrir: (linha: LinhaCategoriaCartao) => void;
}

/**
 * Card "Categorias do cartão" de Análises: para cada cartão das boxes selecionadas (ativo ou
 * não — desativado ainda tem histórico), cada categoria do cartão no mês da fatura × mês
 * anterior × mesmo mês do ano passado × média 3m. Mesmas colunas e mesma regra de linha do
 * Comparativo: a linha aparece se algum dos três meses tem valor.
 */
export default function CategoriasCartaoCard({
  mes, boxIds, cartoes, categoriasCartao, comprasCartao, ajustesFechamento, onAbrir,
}: Props) {
  // posições: 0 = ano passado, 1 = mês − 2, 2 = mês anterior, 3 = mês escolhido
  const meses = [addMeses(mes, -12), addMeses(mes, -2), addMeses(mes, -1), mes];
  const blocos = cartoes
    .filter((cartao) => boxIds.includes(cartao.boxId))
    .map((cartao) => {
      const totais = totaisCategoriaCartaoPorMes(
        cartao,
        comprasCartao.filter((c) => c.cartaoId === cartao.id),
        meses,
        ajustesDoCartao(ajustesFechamento, cartao.id),
      );
      const linhas = categoriasCartao
        .filter((cat) => cat.cartaoId === cartao.id && totais.has(cat.id))
        .sort(compararCategoriasCartao)
        .map((cat) => {
          const [anoPassado, doisAntes, anterior, atual] = totais.get(cat.id)!;
          const media = mediaMovel3([doisAntes, anterior, atual]).at(-1) ?? 0;
          return { categoria: cat, atual, anterior, anoPassado, media };
        })
        .filter((l) => l.atual !== 0 || l.anterior !== 0 || l.anoPassado !== 0);
      return { cartao, linhas };
    })
    .filter((b) => b.linhas.length > 0);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));

  return (
    <div className="card">
      <h2>Categorias do cartão</h2>
      <p className="sub" style={{ margin: '2px 2px 0' }}>pelo mês da fatura</p>
      {blocos.length === 0 ? (
        <p className="sub">Sem gastos no cartão para comparar.</p>
      ) : (
        <div className="rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Categoria</th><th>{mesAbreviado(mes)}</th><th>mês anterior</th><th>ano passado</th><th>média 3m</th></tr>
            </thead>
            <tbody>
              {blocos.map(({ cartao, linhas }) => (
                <Fragment key={cartao.id}>
                  {blocos.length > 1 && (
                    <tr>
                      {/* o nome vai na 1ª célula (a coluna fixa), nunca num colSpan: uma célula
                          mais larga que a coluna fixa rola junto com os valores */}
                      <td style={{ whiteSpace: 'nowrap' }}><span className="rotulo-grupo">{cartao.nome}</span></td>
                      <td colSpan={4} />
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
                      <td className={cor(l.atual)}>{formatarBRL(l.atual)}</td>
                      <td className={cor(l.anterior)}>{formatarBRL(l.anterior)}</td>
                      <td className={cor(l.anoPassado)}>{formatarBRL(l.anoPassado)}</td>
                      <td className={cor(l.media)}>{formatarBRL(l.media)}</td>
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

- [ ] **Passo 5: catálogo** — em `docs/estilo/catalogo.md`:
  - tabela de classes, depois da linha de `.tabela-fixa`: `| \`.tabela-nome-tocavel\` | \`<button>\` dentro de uma célula de \`.tabela\` que abre um detalhe (card "Categorias do cartão", Análises): mesmo tamanho e peso das células, só a cor de ação \`--ac\`; nunca \`.botao-ver-mais\` numa tabela |`
  - seção de componentes, depois do bullet de `CategoriaCartaoHistoricoSheet.tsx`:

```md
- **`CategoriasCartaoCard.tsx`** — card "Categorias do cartão" de Análises: tabela no formato
  do Comparativo (mês · mês anterior · ano passado · média 3m) por categoria do cartão, um
  bloco por cartão (subtítulo `.rotulo-grupo` na coluna fixa, só com 2+ cartões); o nome
  (`.tabela-nome-tocavel`) abre o `CategoriaCartaoHistoricoSheet`.
```

- [ ] **Passo 6:** `npx vitest run src/ui/CategoriasCartaoCard.test.tsx` → PASS; `npm test` → PASS; `node scripts/verificar-catalogo.mjs` → sem aviso novo; `npm run build` → OK.

- [ ] **Passo 7: commit**

```bash
git add src/ui/CategoriasCartaoCard.tsx src/ui/CategoriasCartaoCard.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(analises): card Categorias do cartão no formato do Comparativo"
```

---

### Tarefa 6: montar em `TelaAnalises`, wiki e changelog

**Arquivos:**
- Modificar: `src/ui/TelaAnalises.tsx` (imports; estado; card depois do Comparativo, ~linha 165; folha junto das outras, ~linha 198)
- Modificar: `src/ui/TelaAnalises.test.tsx` (novo teste no fim)
- Modificar: `docs/wiki/6-telas.md` (seção "## Análises", depois do bullet **Comparativo**)
- Criar: `changelog.d/adicionado-categorias-cartao-analises.md`
- Criar: `changelog.d/alterado-valores-zerados-alinhados.md`

**Interfaces:**
- Consome: `CategoriasCartaoCard` e `LinhaCategoriaCartao` (Tarefa 5), `CategoriaCartaoHistoricoSheet` (Tarefa 4).

- [ ] **Passo 1: teste que falha** — no fim de `src/ui/TelaAnalises.test.tsx`:

```tsx
it('card Categorias do cartão: mostra a categoria no mês da fatura e abre o histórico de 6 meses', async () => {
  // mesmo motivo do teste da fatura acima: `sincronizarCartoes` usa a data real do sistema
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { box } = await seedBoxComCategoria();
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Cartão Azul', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catMercado = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catMercado.id, data: '2026-06-10', valorTotal: 30000, parcelas: 1,
    }, '2027-12-31'); // fatura de jul/2026
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catMercado.id, data: '2026-07-10', valorTotal: 62000, parcelas: 1,
    }, '2027-12-31'); // fatura de ago/2026
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-08-01' });

    render(<TelaAnalises />);
    const card = screen.getByText('Categorias do cartão').closest('.card') as HTMLElement;
    expect(card.querySelector('.rotulo-grupo')).toBeNull(); // um cartão só: sem subtítulo
    const linha = within(card).getByRole('button', { name: 'Mercado' }).closest('tr') as HTMLElement;
    expect(within(linha).getAllByRole('cell')[1]).toHaveTextContent('620,00');
    expect(within(linha).getAllByRole('cell')[2]).toHaveTextContent('300,00');

    await userEvent.click(within(card).getByRole('button', { name: 'Mercado' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mercado · Cartão Azul' });
    // mar..ago = [0, 0, 0, 0, 30000, 62000]; média = 92000 / 6 = 15333,33 → 15333
    expect(within(dialog).getByText('média 6m').querySelector('strong')).toHaveTextContent('153,33');
  } finally { vi.useRealTimers(); }
});
```

Conferência à mão: fecha 28, vence 5. 10/06 → fecha 06 → vence 07; 10/07 → vence 08. `hoje` 01/08 → mês escolhido ago/2026: atual 62000, anterior 30000.

- [ ] **Passo 2:** `npx vitest run src/ui/TelaAnalises.test.tsx -t "Categorias do cartão"` → FAIL (card não existe).

- [ ] **Passo 3: implementar em `src/ui/TelaAnalises.tsx`**

Imports (junto dos outros de `./`):

```tsx
import CategoriaCartaoHistoricoSheet from './CategoriaCartaoHistoricoSheet';
import CategoriasCartaoCard, { type LinhaCategoriaCartao } from './CategoriasCartaoCard';
```

Estado, depois de `const [viagemAberta, ...]`:

```tsx
  const [categoriaCartaoAberta, setCategoriaCartaoAberta] = useState<LinhaCategoriaCartao | null>(null);
```

Depois do `if (!dados) return null;` e das consts existentes (antes do `return`):

```tsx
  const cartaoDoHistorico = dados.cartoes.find((c) => c.id === categoriaCartaoAberta?.cartaoId) ?? null;
  const categoriaDoHistorico = dados.categoriasCartao.find((c) => c.id === categoriaCartaoAberta?.categoriaCartaoId) ?? null;
```

JSX: logo depois do `</div>` que fecha o card Comparativo:

```tsx
      <CategoriasCartaoCard
        mes={mes}
        boxIds={ids}
        cartoes={dados.cartoes}
        categoriasCartao={dados.categoriasCartao}
        comprasCartao={dados.comprasCartao}
        ajustesFechamento={dados.ajustesFechamento}
        onAbrir={setCategoriaCartaoAberta}
      />
```

JSX: depois do `<ViagemSheet ... />`:

```tsx
      <CategoriaCartaoHistoricoSheet
        aberto={categoriaCartaoAberta !== null}
        cartao={cartaoDoHistorico}
        categoria={categoriaDoHistorico}
        mes={mes}
        comprasCartao={dados.comprasCartao}
        ajustesFechamento={dados.ajustesFechamento}
        onFechar={() => setCategoriaCartaoAberta(null)}
      />
```

- [ ] **Passo 4:** `npx vitest run src/ui/TelaAnalises.test.tsx` → PASS.

- [ ] **Passo 5: wiki** — em `docs/wiki/6-telas.md`, seção "## Análises", logo depois do bullet que começa com `- **Comparativo:**`:

```md
- **Categorias do cartão:** as categorias do cartão (Mercado, Restaurante etc.) no formato do Comparativo — mês atual × mês anterior × mesmo mês do ano passado × média de 3 meses. O mês é o da fatura: cada parcela conta na fatura em que cai, então a coluna do mês bate com o Resumo da mesma fatura na aba Cartão. Com mais de um cartão, cada um vem num bloco com o nome dele. A caixa "incluir previstos" não muda este card. Tocar no nome de uma categoria abre os últimos 6 meses dela em barras, com a média.
```

Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS.

- [ ] **Passo 6: fragmentos de changelog**

`changelog.d/adicionado-categorias-cartao-analises.md`:

```md
- Card Categorias do cartão em Análises: cada categoria do cartão no mês da fatura, no mês anterior, no mesmo mês do ano passado e na média de 3 meses.
  - Com mais de um cartão, cada um vem num bloco com o nome dele.
  - Tocar no nome da categoria mostra os últimos 6 meses dela em barras, com a média.
```

`changelog.d/alterado-valores-zerados-alinhados.md`:

```md
- Valores zerados agora têm o mesmo tamanho e o mesmo peso dos outros valores da coluna ou da lista, em todas as telas.
  - Nas tabelas com a primeira coluna fixa, o valor que rola por baixo dela não aparece mais como um fiapo colorido na borda.
```

- [ ] **Passo 7: verificações finais**

Run: `npm test` → PASS.
Run: `npm run build` → OK.
Run: `node scripts/verificar-catalogo.mjs --strict` → exit 0.
Run: `node scripts/verificar-dados-reais.mjs` → sem achado nos arquivos novos.

- [ ] **Passo 8: commit**

```bash
git add src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx docs/wiki/6-telas.md changelog.d/
git commit -m "feat(analises): card Categorias do cartão na tela, wiki e changelog"
```
