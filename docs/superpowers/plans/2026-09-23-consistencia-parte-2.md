# Consistência entre telas, parte 2 — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar o progresso.

**Objetivo:** um formato só para o resumo por categoria da fatura, o cabeçalho de fatura, o card de destaque do Cartão e o seletor de mês.

**Arquitetura:** um componente novo, `SeletorMes`, e uma função nova, `nomeDoMes`, em `src/domain/dates.ts`. O resto é troca de marcação em `TelaCartao.tsx`, `TelaAnalises.tsx`, `FaturaResumo.tsx` e `FaturaCategoriaSheet.tsx`, só com classes que já existem.

**Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-23-consistencia-parte-2-design.md`.

## Restrições globais

- Todo texto de UI, teste, commit e doc em português.
- Nenhuma dependência nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`.
- Não editar `"version"` do `package.json` nem o topo do `CHANGELOG.md` — só fragmento em `changelog.d/`.
- Dados sintéticos em testes.
- Textos exatos: título de fatura `{cartão} · fatura de {nomeDoMes(mes)}` (ex.: `Nubank · fatura de outubro de 2026`); linha de datas `fecha DD/MM/AAAA · vence DD/MM/AAAA`; card `Fatura · {cartão}` em `.rotulo`; fatura vazia `Nenhum gasto nesta fatura.`; setas `‹` / `›` com `aria-label` `Mês anterior` / `Mês seguinte`.
- Total de fatura > 0 em vermelho (`.saldo-grande.negativo` no card, `strong.valor-gasto` nas sheets); total 0 na cor normal (sem essas classes).
- Resumo por categoria: `.item` com o nome em `.cresce` e o valor em `span.valor-gasto`; aparece sempre que houver ao menos uma categoria.
- Datas `DD/MM/AAAA` saem de `formatarDataBR` (`src/domain/dates.ts`), não de `split('-').reverse()`.
- `formatarBRL` usa espaço não separável; o Testing Library normaliza o DOM, não a string esperada. Monte o texto esperado com `formatarBRL(x).replace(/\s/g, ' ')`.
- Nas sheets, título e linha de datas vão **só** pela prop `cabecalho` do `Sheet`, e a lista pelo `children`: é o `Sheet` que dá a margem lateral de 20px (`.sheet-cabecalho`, `.sheet-conteudo`). Nada de conteúdo fora desses dois blocos nem margem própria — o usuário pediu, na aprovação do mockup, que nada fique colado no canto da tela.
- Não aperte timeouts nem passe `{ timeout }` a `findBy*`. Nunca afrouxe uma asserção para fazer um teste passar.

## Arquivos

- Modificar: `src/domain/dates.ts` (+ `dates.test.ts`) — `nomeDoMes`.
- Criar: `src/ui/SeletorMes.tsx` + `src/ui/SeletorMes.test.tsx`.
- Modificar: `src/ui/TelaAnalises.tsx` (+ teste) — usa `SeletorMes` e `nomeDoMes`.
- Modificar: `src/ui/TelaCartao.tsx` (+ teste) — seletor fora do card, rótulo, datas com ano, zero neutro, resumo em `.item`.
- Modificar: `src/ui/FaturaResumo.tsx`, `src/ui/FaturaCategoriaSheet.tsx` (+ testes) — cabeçalho padrão fixo.
- Modificar: `docs/estilo/catalogo.md`, `docs/wiki/6-telas.md`, `docs/dossie/` (regenerado).
- Criar: `changelog.d/alterado-consistencia-fatura.md`.

---

### Tarefa 0: mockup aprovado

Aprovada pelo usuário em 2026-09-23 (`mockup-consistencia-parte-2.html`, no scratchpad da sessão), com uma condição: nenhum item colado no canto da tela — ver a restrição global sobre as sheets.

---

### Tarefa 1: `nomeDoMes` e o componente `SeletorMes`, nas Análises

**Arquivos:**
- Modificar: `src/domain/dates.ts`, `src/domain/dates.test.ts`
- Criar: `src/ui/SeletorMes.tsx`, `src/ui/SeletorMes.test.tsx`
- Modificar: `src/ui/TelaAnalises.tsx`, `src/ui/TelaAnalises.test.tsx`
- Modificar: `docs/estilo/catalogo.md` (seção "Componentes compartilhados")

**Interfaces:**
- Produz: `nomeDoMes(mes: string): string` (`'2026-10'` → `'outubro de 2026'`); `SeletorMes({ mes, onMudar }: { mes: string; onMudar: (mes: string) => void })`.

- [ ] **Passo 1: testes que falham.** Em `src/domain/dates.test.ts` (acrescente `nomeDoMes` ao import existente de `./dates`):

```ts
describe('nomeDoMes', () => {
  it('escreve o mês por extenso com o ano', () => {
    expect(nomeDoMes('2026-10')).toBe('outubro de 2026');
    expect(nomeDoMes('2027-01')).toBe('janeiro de 2027');
  });
});
```

Criar `src/ui/SeletorMes.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeletorMes from './SeletorMes';

it('mostra o mês por nome e as setas levam ao mês anterior e ao seguinte', async () => {
  const onMudar = vi.fn();
  render(<SeletorMes mes="2026-01" onMudar={onMudar} />);

  expect(screen.getByText('janeiro de 2026')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
  expect(onMudar).toHaveBeenLastCalledWith('2025-12');
  await userEvent.click(screen.getByRole('button', { name: 'Mês seguinte' }));
  expect(onMudar).toHaveBeenLastCalledWith('2026-02');
});
```

Em `src/ui/TelaAnalises.test.tsx`, troque todas as ocorrências de `{ name: 'Próximo mês' }` por `{ name: 'Mês seguinte' }`.

- [ ] **Passo 2: ver falhar** — `npx vitest run src/domain/dates.test.ts src/ui/SeletorMes.test.tsx src/ui/TelaAnalises.test.tsx`. Esperado: `nomeDoMes` não existe, `./SeletorMes` não resolve, e as Análises não acham "Mês seguinte".

- [ ] **Passo 3: implementar.** Em `src/domain/dates.ts`, perto de `formatarDataBR`:

```ts
/** "AAAA-MM" → "outubro de 2026", para títulos e seletores de mês. */
export function nomeDoMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
```

Criar `src/ui/SeletorMes.tsx`:

```tsx
import { addMeses, nomeDoMes } from '../domain/dates';

/** Navegação de mês das Análises e do Cartão: ‹ mês por nome ›. */
export default function SeletorMes({ mes, onMudar }: { mes: string; onMudar: (mes: string) => void }) {
  return (
    <div className="linha" style={{ justifyContent: 'space-between' }}>
      <button className="botao" aria-label="Mês anterior" onClick={() => onMudar(addMeses(mes, -1))}>‹</button>
      <strong>{nomeDoMes(mes)}</strong>
      <button className="botao" aria-label="Mês seguinte" onClick={() => onMudar(addMeses(mes, 1))}>›</button>
    </div>
  );
}
```

Em `src/ui/TelaAnalises.tsx`: apague a função local `nomeMes`; troque o bloco `<div className="linha" …>` com os botões ◀ ▶ por `<SeletorMes mes={mes} onMudar={setMes} />`; importe `SeletorMes`; se `nomeMes` era usado em outro ponto do arquivo, troque por `nomeDoMes` (importado de `../domain/dates`); tire `addMeses` do import se ficar sem uso.

Em `docs/estilo/catalogo.md`, em "Componentes compartilhados", um bullet no formato dos outros:

```markdown
- **`SeletorMes.tsx`** — navegação de mês: `‹` e `›` em `.botao` (rótulos "Mês anterior" e "Mês seguinte") com o mês por nome no meio (`nomeDoMes`, "outubro de 2026"). Props `mes` (`AAAA-MM`) e `onMudar`. Usado nas Análises e no Cartão — qualquer tela nova que navegue por mês usa este componente.
```

- [ ] **Passo 4: ver passar** — mesmo comando; depois `npm test` e `npm run build`. O dossiê pode acusar diferença nas Análises: não regenere aqui (Tarefa 4); registre qual.

- [ ] **Passo 5: commit** — `feat(ui): SeletorMes nas Análises, com o mês por nome`.

---

### Tarefa 2: aba Cartão — seletor fora do card, rótulo, datas com ano, zero neutro, resumo em `.item`

**Arquivos:** `src/ui/TelaCartao.tsx`, `src/ui/TelaCartao.test.tsx`

**Interfaces:** consome `SeletorMes` e `formatarDataBR`.

- [ ] **Passo 1: testes que falham**, em `src/ui/TelaCartao.test.tsx`, no `describe` que já monta um cartão com compras (use o helper que o arquivo já tem — `montarCartao` — e siga um teste vizinho para montar o estado e o `hoje`). Casos:
  1. O card mostra o rótulo `Fatura · {nome do cartão}` com a classe `rotulo`, e a linha `fecha DD/MM/AAAA · vence DD/MM/AAAA` com o ano (monte o texto esperado com `formatarDataBR` das datas da fatura mostrada).
  2. O seletor mostra o mês por nome (`nomeDoMes` do mês da fatura) e o botão "Mês seguinte" continua trocando a fatura (há um teste existente com `'Mês seguinte'` — mantenha-o passando).
  3. Fatura com uma categoria só: a lista do resumo aparece, com a linha da categoria como botão `.item` e o valor em `.valor-gasto`; tocar nela filtra e troca para a aba Lançamentos (siga o teste existente que clica numa categoria do resumo, se houver; se não houver, confira que a aba Lançamentos fica selecionada).
  4. Fatura sem gasto (troque para um mês sem compras): o total zerado (`formatarBRL(0)`) aparece **sem** a classe `negativo`, e aparece "Nenhum gasto nesta fatura.".
  5. Fatura com gasto: o total tem as classes `saldo-grande` e `negativo`.

- [ ] **Passo 2: ver falhar** — `npx vitest run src/ui/TelaCartao.test.tsx`.

- [ ] **Passo 3: implementar**, em `src/ui/TelaCartao.tsx`:
  - Apague `fmtDia`; use `formatarDataBR` (importe de `../domain/dates`).
  - Troque o bloco do topo do card (a `div.linha` com `‹`, o `div` central e `›`) por: `SeletorMes` **fora** do `.card`, logo antes dele; e, dentro do card, centralizado:

```tsx
<div style={{ textAlign: 'center' }}>
  <p className="rotulo" style={{ margin: 0 }}>Fatura · {cartao.nome}</p>
  <p className={`saldo-grande${fatura.totalCent > 0 ? ' negativo' : ''}`} style={{ margin: '4px 0' }}>
    {formatarBRL(fatura.totalCent)}
  </p>
  <p className="sub" style={{ margin: 0 }}>
    fecha {formatarDataBR(fatura.dataFechamento)} · vence {formatarDataBR(fatura.dataVencimento)}
  </p>
</div>
```

  O componente hoje devolve um único `<div className="card">`; passe a devolver um fragmento `<>` com `<SeletorMes mes={mes} onMudar={setMes} />` e o card. Confira que a tela pai põe os dois dentro de `.tela` (com o `gap` dela).
  - Resumo: troque `resumo.length > 1 &&` por `resumo.length > 0 &&`, e cada linha por:

```tsx
<button
  key={catId}
  className={`item${filtroCategoriaId === catId ? ' ativo' : ''}`}
  style={{ cursor: 'pointer' }}
  aria-pressed={filtroCategoriaId === catId}
  onClick={() => {
    setFiltroCategoriaId((v) => (v === catId ? null : catId));
    setAbaCartao('lancamentos');
  }}
>
  <div className="cresce">{nomeCat(catId)}</div>
  <span className="valor-gasto">{formatarBRL(cent)}</span>
</button>
```

  Se `.item.ativo` não tiver estilo em `src/styles.css`, não crie: o filtro ativo já aparece na aba Lançamentos. Registre no relatório.
  - Se o cabeçalho mudou a posição de algo usado pelos testes de conferência, ajuste só o seletor do teste, nunca a asserção.

- [ ] **Passo 4: ver passar** — `npx vitest run src/ui/TelaCartao.test.tsx`; depois `npm test` e `npm run build` (dossiê pode acusar diferença — Tarefa 4).

- [ ] **Passo 5: commit** — `feat(cartao): card da fatura no padrão da Hoje e resumo por categoria em item`.

---

### Tarefa 3: as duas sheets de fatura no mesmo cabeçalho

**Arquivos:** `src/ui/FaturaResumo.tsx`, `src/ui/FaturaCategoriaSheet.tsx`, e os dois `.test.tsx`

**Interfaces:** consome `nomeDoMes`, `formatarDataBR`.

O cabeçalho das duas é o mesmo, dentro da prop `cabecalho` do `Sheet` (fixo; a lista rola por baixo):

```tsx
cabecalho={(
  <>
    <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura de {nomeDoMes(mes)}</h2>
    <p className="sub" style={{ margin: 0 }}>
      {total > 0 ? <strong className="valor-gasto">{formatarBRL(total)}</strong> : <strong>{formatarBRL(total)}</strong>}
      {' · '}fecha {formatarDataBR(dataFechamento)} · vence {formatarDataBR(dataVencimento)}
    </p>
  </>
)}
```

- Na `FaturaResumo`: `mes` = `lanc.faturaMes`; `total` = `lanc.valor` (o valor que a fatura leva ao Fluxo — continua sendo a fonte, como hoje); datas da `fatura` achada. Se a fatura não for achada, use `datasFaturaDoMes(cartao, mes, ajustes)` (de `../domain/fatura`) para as datas. Texto vazio: `Nenhum gasto nesta fatura.`
- Na `FaturaCategoriaSheet`: `total` = `fatura.totalCent`; datas de `fatura`. Apague o bloco atual (h2 + total à direita + "fatura de … · vence …") de dentro do corpo.

- [ ] **Passo 1: testes que falham.**
  - `FaturaResumo.test.tsx`: troque a asserção `Total:` seguida do valor por: título `Nubank · fatura de {nomeDoMes(faturaMes do teste)}` presente; um `strong.valor-gasto` com `formatarBRL(5000).replace(/\s/g, ' ')`; e a linha com `fecha … · vence …` (com ano). Novo caso: fatura sem itens mostra "Nenhum gasto nesta fatura.".
  - `FaturaCategoriaSheet.test.tsx`: no teste do total, confira o título `Nubank · fatura de …` e o total em `strong.valor-gasto`. Novo caso: fatura sem compras mostra o total `R$ 0,00` **sem** `valor-gasto`.

- [ ] **Passo 2: ver falhar** — `npx vitest run src/ui/FaturaResumo.test.tsx src/ui/FaturaCategoriaSheet.test.tsx`.

- [ ] **Passo 3: implementar** conforme o bloco acima.

- [ ] **Passo 4: ver passar**; depois `npm test`, `npm run build`, `node scripts/verificar-catalogo.mjs --strict`.

- [ ] **Passo 5: commit** — `feat(fatura): mesmo cabeçalho nas sheets de fatura do Fluxo e das Análises`.

---

### Tarefa 4: dossiê, wiki e fragmento

- [ ] **Passo 1:** `npm run dossie`. Registre o `git diff --stat docs/dossie/` e liste toda linha que mudou. Esperado: ◀ ▶ → ‹ ›, mês das Análises igual, card do Cartão com "Fatura · …" e datas com ano, títulos de fatura "… · fatura de …", resumo com uma categoria. Qualquer outra mudança: liste inteira.
- [ ] **Passo 2:** wiki, `docs/wiki/6-telas.md`, seções **Cartão** e **Análises** (localize pelo título `## Cartão` e `## Análises`): diga que o mês se troca pelas setas ‹ ›, com o mês por nome; que o card mostra o total, com fechamento e vencimento; que o resumo por categoria aparece mesmo com uma categoria; e que tocar numa fatura no Fluxo ou nas Análises abre o mesmo cabeçalho (cartão, mês, total, fechamento e vencimento). Não use sintaxe fora de `docs/wiki/README.md`. Valide com `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- [ ] **Passo 3:** fragmento `changelog.d/alterado-consistencia-fatura.md`:

```markdown
- A fatura do cartão aparece do mesmo jeito em todas as telas.
  - O cabeçalho mostra o cartão, o mês por nome, o total e as datas de fechamento e vencimento com o ano.
  - O resumo por categoria aparece mesmo quando a fatura tem uma categoria só.
  - Fatura sem gasto mostra o total na cor normal, não em vermelho.
- Análises e Cartão trocam de mês com as mesmas setas, e o mês aparece por nome.
```

- [ ] **Passo 4:** `npm test` (tudo verde, inclusive `src/dossie/dossie.test.ts`), `npm run build`, `node scripts/verificar-dados-reais.mjs`, `node scripts/verificar-catalogo.mjs --strict`.
- [ ] **Passo 5: commit** — `docs: wiki, dossiê e fragmento da consistência da fatura`. Parar aqui: o fragmento espera a confirmação do usuário.
