# Regra de sinal — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa.
> Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** todo valor em dinheiro mostrado no app perde o "+" e o "−"; a cor diz o efeito
no saldo; estorno fica verde com o rótulo "estorno".

**Arquitetura:** `formatarBRL` e `formatarSobraCompacta` passam a formatar o valor absoluto.
Duas funções novas em `money.ts` decidem o sentido: `efeitoNoSaldo` (valor com o sinal do
efeito) e `classeEfeito` (classe de cor). As telas trocam o sinal escrito à mão e a cor por
tipo de categoria por essas funções.

**Tecnologias:** React 18, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-regra-de-sinal-design.md`.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\regra-de-sinal`, branch
  `regra-de-sinal`. **Não toque no checkout principal.** Antes da primeira edição, rode
  `git rev-parse --show-toplevel` e confira que a saída é o worktree.
- Todo texto de UI, comentário, mensagem de commit e doc em **português**.
- Valores monetários são centavos inteiros. Nenhum dado financeiro real em arquivo
  versionado: só valores sintéticos.
- Nenhuma dependência nova. Não mexa em `scripts/`, `vite.config.ts`, `tsconfig.json`,
  `package.json` nem `.claude/`.
- Não use `{ timeout: n }` em `findBy*`.
- Antes de editar `src/ui/**` ou `src/styles.css`, leia `docs/estilo-visual.md` e o
  capítulo `docs/estilo/nivel-6-mudanca-de-linguagem.md`.
- Cada tarefa termina com `npm test` **inteiro** verde, não só o arquivo tocado.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017FzHH4B7r6fEmfS8JwUHVB
  ```
- O texto `chore(release)` é proibido em mensagens de commit.

## Mapa de arquivos

| Arquivo | Mudança |
|---|---|
| `src/domain/money.ts` | `formatarBRL` e `formatarSobraCompacta` sem sinal; novas `efeitoNoSaldo`, `classeEfeito`, `classeSaldo` |
| `src/domain/money.test.ts` | testes das funções acima |
| `src/ui/TelaHoje.tsx` | diferença da conferência, pílula dos 28 dias, totais da conferência, pendentes |
| `src/ui/TelaCartao.tsx` | diferença da conferência da fatura |
| `src/ui/TelaFluxo.tsx` | pílula "em relação a hoje", lista de lançamentos |
| `src/ui/LancamentosSheet.tsx` | cor pelo efeito, rótulo "estorno" |
| `src/ui/TelaAnalises.tsx` | tabela Comparativo pela cor do efeito |
| `src/ui/ajustes/Recorrencias.tsx` | cor pelo efeito |
| `src/ui/ajustes/Boxes.tsx`, `src/ui/ajustes/Bancos.tsx` | saldo com cor |
| testes das telas acima | texto sem sinal, classe de cor |
| `docs/estilo/fundamentos.md`, `docs/estilo/catalogo.md`, `docs/dominio.md`, `docs/wiki/8-glossario.md` | a regra |
| `docs/dossie/` | regenerado |
| `changelog.d/alterado-valores-sem-sinal.md` | fragmento |

---

### Tarefa 1: domínio — formatação sem sinal e funções de sentido

**Arquivos:**
- Modificar: `src/domain/money.ts`
- Modificar: `src/domain/money.test.ts`
- Modificar (testes que quebram): `src/ui/EvolucaoMensalChart.test.tsx`, `src/ui/TelaAnalises.test.tsx`

**Interfaces:**
- Produz:
  - `formatarBRL(centavos: number): string` — sempre sem sinal.
  - `formatarSobraCompacta(centavos: number): string` — sem sinal.
  - `efeitoNoSaldo(valor: number, tipo: TipoCategoria): number`
  - `classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | undefined`
  - `classeSaldo(saldo: number): 'total-dia pos' | 'total-dia neg'` — mesma regra do saldo do
    dia no Fluxo (`>= 0` é `pos`).

- [ ] **Passo 1: escreva os testes que falham**

Em `src/domain/money.test.ts`, troque a importação da linha 1 por:

```ts
import { formatarBRL, formatarPercentual, formatarSobraCompacta, empurrarDigito, apagarUltimoDigito, digitosParaCentavos, formatarSemSimbolo, parsearCentavosDecimal, efeitoNoSaldo, classeEfeito, classeSaldo } from './money';
```

Troque o bloco `describe('formatarBRL', …)` por:

```ts
describe('formatarBRL', () => {
  it('formata centavos como moeda pt-BR', () => {
    // toLocaleString pt-BR usa espaço não separável (U+00A0) após R$
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
    expect(formatarBRL(0)).toBe('R$ 0,00');
  });
  it('nunca mostra sinal: a cor, na tela, diz o sentido', () => {
    expect(formatarBRL(-4500)).toBe('R$ 45,00');
    expect(formatarBRL(-4500)).not.toMatch(/[−-]/);
  });
});
```

Troque as expectativas de `formatarSobraCompacta` (linhas ~73–82) por:

```ts
    expect(formatarSobraCompacta(187000)).toBe('1.870');
    expect(formatarSobraCompacta(-41000)).toBe('410');
    expect(formatarSobraCompacta(93050)).toBe('931'); // 930,50 arredonda pra 931
    expect(formatarSobraCompacta(0)).toBe('0');
```

Acrescente ao fim do arquivo:

```ts
describe('efeitoNoSaldo', () => {
  it('ganho soma, gasto subtrai', () => {
    expect(efeitoNoSaldo(5000, 'ganho')).toBe(5000);
    expect(efeitoNoSaldo(5000, 'gasto')).toBe(-5000);
  });
  it('estorno inverte o sentido', () => {
    expect(efeitoNoSaldo(-5000, 'gasto')).toBe(5000);  // devolução de compra: entra dinheiro
    expect(efeitoNoSaldo(-5000, 'ganho')).toBe(-5000); // ganho estornado: sai dinheiro
  });
});

describe('classeEfeito', () => {
  it('positivo verde, negativo vermelho, zero sem cor', () => {
    expect(classeEfeito(1)).toBe('valor-ganho');
    expect(classeEfeito(-1)).toBe('valor-gasto');
    expect(classeEfeito(0)).toBeUndefined();
  });
});

describe('classeSaldo', () => {
  it('segue o saldo do dia no Fluxo: zero conta como positivo', () => {
    expect(classeSaldo(100)).toBe('total-dia pos');
    expect(classeSaldo(0)).toBe('total-dia pos');
    expect(classeSaldo(-100)).toBe('total-dia neg');
  });
});
```

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/domain/money.test.ts`
Esperado: FALHA — `efeitoNoSaldo is not a function` e `formatarBRL(-4500)` ainda com "−".

- [ ] **Passo 3: implemente**

Em `src/domain/money.ts`, troque `formatarBRL` e seu comentário por:

```ts
/** Valor sempre sem sinal: a cor, na tela, diz o sentido (`classeEfeito`, `classeSaldo`).
 *  Regra de linguagem em `docs/estilo/fundamentos.md`. */
export function formatarBRL(centavos: number): string {
  return (Math.abs(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
```

Troque `formatarSobraCompacta` e seu comentário por:

```ts
/** Sobra do mês em formato compacto (sem "R$", sem sinal, arredondado ao real) — rótulo curto
 *  para caber acima de barras de gráfico (ex.: "1.870"). A cor do rótulo diz o sentido. */
export function formatarSobraCompacta(centavos: number): string {
  return Math.round(Math.abs(centavos) / 100).toLocaleString('pt-BR');
}
```

Acrescente, logo depois de `formatarSobraCompacta`:

```ts
/** Valor de um lançamento com o sinal do seu efeito no saldo: ganho soma, gasto subtrai.
 *  Um estorno (valor negativo) sai com o sentido invertido. */
export function efeitoNoSaldo(valor: number, tipo: TipoCategoria): number {
  return tipo === 'ganho' ? valor : -valor;
}

/** Classe de cor de um efeito no saldo: verde entra, vermelho sai, zero sem cor. */
export function classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | undefined {
  if (efeito > 0) return 'valor-ganho';
  if (efeito < 0) return 'valor-gasto';
  return undefined;
}

/** Classe de cor de um saldo — a mesma do saldo do dia no Fluxo (`.total-dia`). */
export function classeSaldo(saldo: number): 'total-dia pos' | 'total-dia neg' {
  return saldo >= 0 ? 'total-dia pos' : 'total-dia neg';
}
```

No topo de `money.ts`, acrescente:

```ts
import type { TipoCategoria } from './types';
```

- [ ] **Passo 4: rode e veja passar**

Run: `npx vitest run src/domain/money.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: ajuste os testes de tela que quebram com o novo texto**

Em `src/ui/EvolucaoMensalChart.test.tsx`, troque `'+900'` por `'900'`, `'+1.870'` por
`'1.870'` e `'−1.500'` por `'1.500'`. As classes (`pos`/`neg`) ficam como estão: é a cor que
diz o sentido agora.

Em `src/ui/TelaAnalises.test.tsx` (linha ~224), troque `'+4.000'` por `'4.000'` e confira a
classe:

```ts
  expect(await screen.findByText('4.000')).toHaveClass('evolucao-sobra', 'pos'); // sobra de julho: 500000-100000 centavos
```

- [ ] **Passo 6: suíte inteira**

Run: `npm test`
Esperado: as falhas restantes, se houver, são só de telas com sinal escrito à mão
(`TelaHoje`, `TelaCartao`, `TelaFluxo`) — elas são da Tarefa 2. **Anote quais são** e não
as corrija aqui. Qualquer outra falha é desta tarefa: corrija.

- [ ] **Passo 7: commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts src/ui/EvolucaoMensalChart.test.tsx src/ui/TelaAnalises.test.tsx
git commit -m "feat(money): valor sem sinal; efeitoNoSaldo, classeEfeito e classeSaldo"
```

---

### Tarefa 2: sinal escrito à mão sai (conferências e pílulas)

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (função `Diferenca`, pílula "nos próximos 28 dias")
- Modificar: `src/ui/TelaCartao.tsx` (diferença da conferência, linhas ~72–77)
- Modificar: `src/ui/TelaFluxo.tsx` (pílula "em relação a hoje", linha ~218)
- Testes: `src/ui/TelaHoje.test.tsx`, `src/ui/TelaCartao.test.tsx`, `src/ui/TelaFluxo.test.tsx`

**Interfaces:**
- Consome: `formatarBRL` sem sinal (Tarefa 1).

- [ ] **Passo 1: atualize os testes para o texto sem sinal (falham agora)**

`src/ui/TelaHoje.test.tsx`, teste "declara saldo real maior…" (linha ~60):

```ts
  // Diferença do ponto de vista do app: falta inserir = vermelho, sem sinal.
  expect(screen.getByText(/^R\$\s*50,00$/)).toHaveClass('valor-gasto');
  expect(screen.queryByText(/[−+]R\$/)).not.toBeInTheDocument();
```

Mesmo arquivo, teste "a diferença dos próximos 28 dias…" (linha ~840): renomeie para
`'a diferença dos próximos 28 dias usa só a cor, sem sinal nem seta'` e troque a busca:

```ts
  const pilula = screen.getByText(`${formatarBRL(80000).replace(/\s/g, ' ')} nos próximos 28 dias`);
  expect(pilula).toHaveClass('delta', 'pos');
  expect(pilula.textContent).not.toMatch(/^[−+]/);
```

`src/ui/TelaCartao.test.tsx` (linha ~94):

```ts
    // Do ponto de vista do Flow: itens abaixo do banco = falta = vermelho, sem sinal.
    expect(screen.getByText(/^R\$\s*20,00$/)).toHaveClass('valor-gasto');
    expect(screen.queryByText(/[−+]R\$/)).not.toBeInTheDocument();
```

`src/ui/TelaFluxo.test.tsx` (linhas ~516 e ~531): troque

```ts
    const pilula = await screen.findByText(`−${formatarBRL(5000).replace(/\s/g, ' ')} em relação a hoje`);
```

por

```ts
    const pilula = await screen.findByText(`${formatarBRL(5000).replace(/\s/g, ' ')} em relação a hoje`);
```

e, no teste seguinte, o mesmo com `+` → sem prefixo. As classes (`neg`, `pos`) ficam.

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx src/ui/TelaCartao.test.tsx src/ui/TelaFluxo.test.tsx`
Esperado: FALHA nesses quatro pontos — o texto ainda tem "−"/"+".

- [ ] **Passo 3: implemente**

`src/ui/TelaHoje.tsx`, função `Diferenca`: troque o `return` por

```tsx
  return doApp < 0 ? (
    <>Diferença: <strong className="valor-gasto">{formatarBRL(doApp)}</strong> — falta inserir no app</>
  ) : (
    <>Diferença: <strong className="valor-ganho">{formatarBRL(doApp)}</strong> — sobra no app (confira duplicado ou algo não confirmado no banco)</>
  );
```

e atualize o comentário da função: "o valor exibido é do ponto de vista do app (app − banco),
sem sinal: vermelho quando falta lançar, verde quando sobra."

Mesmo arquivo, pílula dos 28 dias:

```tsx
                  <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
                    {formatarBRL(delta)} nos próximos 28 dias
                  </span>
```

`src/ui/TelaCartao.tsx`, as duas linhas da diferença:

```tsx
              ? <>Diferença: <strong className="valor-gasto">{formatarBRL(diff)}</strong> — falta inserir no cartão</>
              : <>Diferença: <strong className="valor-ganho">{formatarBRL(diff)}</strong> — sobra no cartão (confira duplicado ou algo que ainda não entrou na fatura do banco)</>}
```

`src/ui/TelaFluxo.tsx`, pílula:

```tsx
                        <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
                          {formatarBRL(delta)} em relação a hoje
                        </span>
```

- [ ] **Passo 4: rode e veja passar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx src/ui/TelaCartao.test.tsx src/ui/TelaFluxo.test.tsx`
Esperado: PASSA.

- [ ] **Passo 5: confira que as duas conferências continuam iguais**

Run: `grep -n "Diferença:" src/ui/TelaHoje.tsx src/ui/TelaCartao.tsx`
Esperado: as quatro linhas têm a mesma estrutura — "Diferença: <strong valor-gasto|valor-ganho>{valor}</strong> — falta inserir no …/sobra no …", sem "−" nem "+".

- [ ] **Passo 6: suíte inteira**

Run: `npm test`
Esperado: PASSA.

- [ ] **Passo 7: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaCartao.tsx src/ui/TelaFluxo.tsx src/ui/TelaHoje.test.tsx src/ui/TelaCartao.test.tsx src/ui/TelaFluxo.test.tsx
git commit -m "feat(ui): diferenças e pílulas sem sinal — a cor diz o sentido"
```

---

### Tarefa 3: saldos neutros ganham cor

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (`TotalFlow`, "Total informado")
- Modificar: `src/ui/ajustes/Boxes.tsx` (linha ~155)
- Modificar: `src/ui/ajustes/Bancos.tsx` (linha ~202)
- Testes: `src/ui/TelaHoje.test.tsx`, `src/ui/ajustes/Boxes.test.tsx`, `src/ui/ajustes/Bancos.test.tsx`

**Interfaces:**
- Consome: `classeSaldo(saldo)` (Tarefa 1).

- [ ] **Passo 1: testes que falham**

Acrescente a `src/ui/ajustes/Boxes.test.tsx`:

```tsx
it('saldo inicial negativo aparece em vermelho e sem sinal', async () => {
  const agora = agoraISO();
  await repo.salvarBox({ id: novoId(), nome: 'eitor', saldoInicial: -25000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora });
  await useApp.getState().iniciar();

  render(<Boxes />);
  const valor = screen.getByText(/^R\$\s*250,00$/);
  expect(valor).toHaveClass('total-dia', 'neg');
  expect(screen.queryByText(/−R\$/)).not.toBeInTheDocument();
});

it('saldo inicial positivo aparece em verde', async () => {
  const agora = agoraISO();
  await repo.salvarBox({ id: novoId(), nome: 'eitor', saldoInicial: 25000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora });
  await useApp.getState().iniciar();

  render(<Boxes />);
  expect(screen.getByText(/^R\$\s*250,00$/)).toHaveClass('total-dia', 'pos');
});
```

Abra `src/ui/ajustes/Bancos.test.tsx`, ache um teste que já cria um banco com
`saldoDeclaradoCent` (busque por `saldoDeclaradoCent`) e acrescente um teste irmão, com o
mesmo preparo, gravando `saldoDeclaradoCent: -25000`, com a expectativa:

```tsx
  expect(screen.getByText(/^R\$\s*250,00$/)).toHaveClass('total-dia', 'neg');
  expect(screen.queryByText(/−R\$/)).not.toBeInTheDocument();
```

Se nenhum teste de `Bancos.test.tsx` gravar `saldoDeclaradoCent`, grave pelo repositório:
crie o banco com `repo.salvarBanco` (veja a assinatura em `src/db/repo.ts`, linha ~322) e
atualize com `repo.atualizarBanco(id, { saldoDeclaradoCent: -25000, dataSaldoDeclarado: '2026-07-01' })`.

Em `src/ui/TelaHoje.test.tsx`, acrescente:

```tsx
it('total calculado no Flow negativo aparece em vermelho e sem sinal', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: -30000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await abrirAba('Conferir');
  const linha = screen.getByText('Total calculado no Flow').closest('.total') as HTMLElement;
  const valor = linha.querySelector('.total-dia');
  expect(valor).toHaveClass('neg');
  expect(valor?.textContent?.replace(/\s/g, ' ')).toBe('R$ 300,00');
});
```

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/ui/ajustes/Boxes.test.tsx src/ui/ajustes/Bancos.test.tsx src/ui/TelaHoje.test.tsx`
Esperado: FALHA — os valores não têm `total-dia`.

- [ ] **Passo 3: implemente**

`src/ui/TelaHoje.tsx`, `TotalFlow`:

```tsx
      <span className={classeSaldo(saldoApp)}>{formatarBRL(saldoApp)}</span>
```

"Total informado":

```tsx
        <span className={totalCent != null ? classeSaldo(totalCent) : undefined}>{totalCent != null ? formatarBRL(totalCent) : '—'}</span>
```

Acrescente `classeSaldo` à importação de `../domain/money`.

`src/ui/ajustes/Boxes.tsx`, troque o bloco da `.sub` por:

```tsx
                <div className="sub">
                  {b.saldoInicial != null ? (
                    <>
                      <span className={classeSaldo(b.saldoInicial)}>{formatarBRL(b.saldoInicial)}</span>
                      {b.dataSaldoInicial ? ` em ${formatarDataBR(b.dataSaldoInicial)}` : ''}
                    </>
                  ) : 'sem saldo próprio (compartilhada)'}
                </div>
```

`src/ui/ajustes/Bancos.tsx`, troque o ternário do saldo por:

```tsx
                      {b.saldoDeclaradoCent != null ? (
                        <>
                          <span className={classeSaldo(b.saldoDeclaradoCent)}>{formatarBRL(b.saldoDeclaradoCent)}</span>
                          {` informado em ${formatarDataBR(b.dataSaldoDeclarado!)}`}
                        </>
                      ) : 'saldo ainda não informado'}
```

Acrescente `classeSaldo` às importações de `../../domain/money` nos dois arquivos.

- [ ] **Passo 4: rode e veja passar**

Run: `npx vitest run src/ui/ajustes/Boxes.test.tsx src/ui/ajustes/Bancos.test.tsx src/ui/TelaHoje.test.tsx`
Esperado: PASSA. Se um teste antigo buscava o texto inteiro da `.sub` (ex.: "R$ 1.000,00 em
01/07/2026") com `getByText`, ele quebra porque o valor virou um `<span>` próprio: troque a
busca por um matcher de função sobre o `textContent` da `.sub`, sem mudar o que ele confere.

- [ ] **Passo 5: suíte inteira**

Run: `npm test`
Esperado: PASSA.

- [ ] **Passo 6: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/ajustes/Boxes.tsx src/ui/ajustes/Bancos.tsx src/ui/TelaHoje.test.tsx src/ui/ajustes/Boxes.test.tsx src/ui/ajustes/Bancos.test.tsx
git commit -m "feat(ui): saldos da conferência, das boxes e dos bancos com cor, sem sinal"
```

---

### Tarefa 4: cor pelo efeito no saldo e rótulo "estorno"

**Arquivos:**
- Modificar: `src/ui/TelaFluxo.tsx` (lista, linhas ~233–250)
- Modificar: `src/ui/TelaHoje.tsx` (pendentes, linhas ~434–451)
- Modificar: `src/ui/LancamentosSheet.tsx`
- Modificar: `src/ui/TelaAnalises.tsx` (Comparativo, linhas ~148–158)
- Modificar: `src/ui/ajustes/Recorrencias.tsx` (linha ~227)
- Testes: `src/ui/TelaFluxo.test.tsx`, `src/ui/TelaHoje.test.tsx`, `src/ui/LancamentosSheet.test.tsx` (crie se não existir), `src/ui/TelaAnalises.test.tsx`

**Interfaces:**
- Consome: `efeitoNoSaldo(valor, tipo)`, `classeEfeito(efeito)` (Tarefa 1).

- [ ] **Passo 1: testes que falham**

`src/ui/TelaFluxo.test.tsx`, acrescente logo depois do teste "o valor de cada lançamento sai
sem sinal…":

```tsx
it('estorno de gasto aparece verde, sem sinal, com o rótulo "estorno"', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: -5000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  const brl = (c: number) => formatarBRL(c).replace(/\s/g, ' ');
  const valor = await screen.findByText(brl(5000));
  expect(valor).toHaveClass('valor-ganho');
  const item = valor.closest('.item') as HTMLElement;
  expect(item).toHaveTextContent('estorno');
});

it('gasto comum não tem o rótulo "estorno"', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const hoje = '2026-07-05';
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catMercado.id, data: hoje, valor: 5000, status: 'efetivo' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });

  render(<TelaFluxo />);
  await screen.findByText(formatarBRL(5000).replace(/\s/g, ' '));
  expect(screen.queryByText('estorno')).not.toBeInTheDocument();
});
```

`src/ui/TelaHoje.test.tsx`, acrescente (usa o mesmo preparo de `cenarioPendenteComum`,
que já existe no arquivo e aceita o valor):

```tsx
it('pendente de estorno aparece verde, com o rótulo "estorno"', async () => {
  await cenarioPendenteComum(-4000);

  render(<TelaHoje />);
  await abrirAba(/Pendentes/);
  const botao = screen.getByRole('button', { name: 'Corrigir valor de luz' });
  expect(botao).toHaveClass('valor-ganho');
  expect(botao.textContent?.replace(/\s/g, ' ')).toBe('R$ 40,00');
  expect((botao.closest('.item') as HTMLElement)).toHaveTextContent('estorno');
});
```

`src/ui/LancamentosSheet.test.tsx` — se o arquivo não existir, crie com:

```tsx
import { render, screen } from '@testing-library/react';
import type { Lancamento } from '../domain/types';
import LancamentosSheet from './LancamentosSheet';

const base = { boxId: 'b1', categoriaId: 'c1', status: 'efetivo' as const, origem: 'manual' as const, criadoEm: 'x', alteradoEm: 'x' };

it('total de gasto com estorno maior que os gastos aparece verde e sem sinal', () => {
  const lancs: Lancamento[] = [
    { ...base, id: 'l1', data: '2026-07-03', valor: 2000 },
    { ...base, id: 'l2', data: '2026-07-04', valor: -5000 },
  ];
  render(
    <LancamentosSheet
      aberto categoriaId="c1" nome="mercado" tipo="gasto" mes="2026-07" boxIds={['b1']}
      lancamentos={lancs} incluirPrevistos={false} onFechar={() => {}}
    />,
  );
  // total = 2000 − 5000 = −3000 centavos: efeito no saldo de gasto = +3000 → verde
  const total = screen.getAllByText(/^R\$\s*30,00$/)[0];
  expect(total).toHaveClass('valor-ganho');
});
```

Se `LancamentosSheet.test.tsx` já existir, acrescente só o teste acima, reusando as
importações do arquivo. Se o `Sheet` precisar de algo do store para renderizar, siga o
preparo dos testes existentes de sheets (busque `render(<` em `src/ui/*Sheet.test.tsx`).

- [ ] **Passo 2: rode e veja falhar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx src/ui/TelaHoje.test.tsx src/ui/LancamentosSheet.test.tsx`
Esperado: FALHA — a cor ainda vem do tipo da categoria, e não há rótulo.

- [ ] **Passo 3: implemente**

`src/ui/TelaFluxo.tsx`, dentro de `lancsDia.map`:

```tsx
                      <div className="cresce">
                        {nomeCat(l.categoriaId)}
                        {l.status === 'previsto' && <span className="badge" style={{ marginLeft: 6 }}>{l.cenarioId ? 'cenário' : 'previsto'}</span>}
                        {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                        {l.nota && <div className="sub">{l.nota}</div>}
                      </div>
                      <span className={classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId)))}>
                        {formatarBRL(l.valor)}
                      </span>
```

`tipoCat` em `TelaFluxo.tsx` já devolve `'gasto'` por padrão. Acrescente `classeEfeito` e
`efeitoNoSaldo` à importação de `../domain/money`.

`src/ui/TelaHoje.tsx`, pendentes: logo depois de `<div>{nomeCat(l.categoriaId)}</div>`,
troque por

```tsx
                    <div>
                      {nomeCat(l.categoriaId)}
                      {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
```

e troque as duas classes de valor:

```tsx
                    <span className={classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId)))}>
```

```tsx
                      className={`${classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId))) ?? ''} editavel`}
```

Acrescente as importações.

`src/ui/LancamentosSheet.tsx`: apague `const classeValor = …` e use

```tsx
  const classe = (v: number) => classeEfeito(efeitoNoSaldo(v, tipo));
```

nos três lugares: `className={classe(total)}`, `className={classe(g.subtotal)}`,
`className={classe(it.valor)}`. Na linha de cada item, acrescente o rótulo:

```tsx
                    <div className="cresce">
                      {dataFormatada(it.data)}
                      {it.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
```

Acrescente as importações.

`src/ui/TelaAnalises.tsx`, Comparativo: troque as quatro `<td>` de valor por

```tsx
                    <td className={classeEfeito(efeitoNoSaldo(c.atual, c.tipo))}>{formatarBRL(c.atual)}</td>
                    <td className={classeEfeito(efeitoNoSaldo(c.mesAnterior, c.tipo))}>{formatarBRL(c.mesAnterior)}</td>
                    <td className={classeEfeito(efeitoNoSaldo(c.anoAnterior, c.tipo))}>{formatarBRL(c.anoAnterior)}</td>
                    <td className={media == null ? undefined : classeEfeito(efeitoNoSaldo(media, c.tipo))}>{media == null ? '—' : formatarBRL(media)}</td>
```

Note: com esta regra, um mês de categoria zerado fica sem cor (antes ficava vermelho ou
verde pela categoria). Isso segue a spec ("zero fica sem cor").

`src/ui/ajustes/Recorrencias.tsx` (linha ~227):

```tsx
                <span className={classeEfeito(efeitoNoSaldo(r.valor, tipoCat(r.categoriaId) ?? 'gasto'))}>
```

Acrescente as importações.

- [ ] **Passo 4: rode e veja passar**

Run: `npx vitest run src/ui/TelaFluxo.test.tsx src/ui/TelaHoje.test.tsx src/ui/LancamentosSheet.test.tsx src/ui/TelaAnalises.test.tsx src/ui/ajustes/Recorrencias.test.tsx`
Esperado: PASSA. Se um teste do Comparativo esperava `valor-gasto`/`valor-ganho` numa célula
com zero, a expectativa nova é "sem classe de cor": ajuste a expectativa, não o código.

- [ ] **Passo 5: suíte inteira**

Run: `npm test`
Esperado: PASSA.

- [ ] **Passo 6: commit**

```bash
git add src/ui/TelaFluxo.tsx src/ui/TelaHoje.tsx src/ui/LancamentosSheet.tsx src/ui/TelaAnalises.tsx src/ui/ajustes/Recorrencias.tsx src/ui/*.test.tsx src/ui/ajustes/*.test.tsx
git commit -m "feat(ui): cor pelo efeito no saldo e rótulo de estorno"
```

---

### Tarefa 5: guia de estilo, domínio, wiki, dossiê e fragmento

**Arquivos:**
- Modificar: `docs/estilo/fundamentos.md`, `docs/estilo/catalogo.md`, `docs/dominio.md`, `docs/wiki/8-glossario.md`
- Regenerar: `docs/dossie/`
- Criar: `changelog.d/alterado-valores-sem-sinal.md`

- [ ] **Passo 1: `docs/estilo/fundamentos.md`**

Leia o capítulo `docs/estilo/nivel-6-mudanca-de-linguagem.md` e siga o que ele pede. Na
seção de cores (onde está a linha `--neg` / `--neg-bg`), acrescente, no estilo do arquivo
(frases curtas, voz ativa):

```md
### Sinal de valor

Valor em dinheiro mostrado nunca tem "+" nem "−". A cor diz o efeito no saldo: verde entra
ou sobra, vermelho sai ou falta. Zero fica sem cor.

- Lançamento: `classeEfeito(efeitoNoSaldo(valor, tipo))`. Estorno (valor negativo) inverte
  o sentido e ganha o rótulo `.badge` "estorno".
- Saldo: `classeSaldo(saldo)` (`.total-dia.pos/.neg`), igual ao saldo do dia no Fluxo.
- Campo de digitar valor é exceção: o botão ± é o próprio controle do sinal.
```

- [ ] **Passo 2: `docs/estilo/catalogo.md`**

Na entrada de `.valor-ganho`/`.valor-gasto`, troque o significado para "efeito no saldo
(verde entra, vermelho sai), via `classeEfeito`", e na de `.badge` acrescente o uso
"estorno".

- [ ] **Passo 3: `docs/dominio.md`**

Onde o documento fala do `valor` do lançamento (busque "estorno" ou "negativo"), acrescente
uma frase: "`efeitoNoSaldo(valor, tipo)` (`src/domain/money.ts`) dá o sinal do efeito no
saldo; a UI usa esse sinal só para a cor, nunca para o texto."

- [ ] **Passo 4: `docs/wiki/8-glossario.md`**

Acrescente a entrada, no formato das outras (confira o subconjunto de markdown em
`docs/wiki/README.md`):

```md
: estorno | Lançamento com valor negativo numa categoria, como a devolução de uma compra. Aparece em verde, com o rótulo "estorno", porque devolve dinheiro ao saldo.
```

Procure nos capítulos da wiki qualquer frase que diga que um valor **mostrado** aparece com
"−" ou "+" (`grep -n "−\|sinal" docs/wiki/*.md`). Ajuste para "a cor diz o sentido". A frase
de `7-ajustes.md` sobre **digitar** o "−" do saldo inicial não muda.

Run: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA.

- [ ] **Passo 5: dossiê**

Run: `npm run dossie`
Depois: `git diff --stat docs/dossie/`. Leia o diff: ele deve mostrar só valores que
perderam o sinal e cores que mudaram. Qualquer outra diferença é um erro a investigar.

- [ ] **Passo 6: fragmento de changelog**

Leia `changelog.d/README.md`. Crie `changelog.d/alterado-valores-sem-sinal.md`:

```md
- Valores em dinheiro aparecem sem "+" nem "−" em todo o app: a cor diz o sentido.
  - Verde entra ou sobra, vermelho sai ou falta.
  - Estorno aparece em verde, com o rótulo "estorno".
```

- [ ] **Passo 7: verificações e suíte**

Run: `node scripts/verificar-catalogo.mjs && node scripts/verificar-dados-reais.mjs && npm test`
Esperado: os dois verificadores sem aviso, e a suíte verde.

- [ ] **Passo 8: commit**

```bash
git add docs/ changelog.d/alterado-valores-sem-sinal.md
git commit -m "docs: regra de sinal no guia, no domínio, na wiki e no dossiê"
```

---

## Depois do plano (fora dos subagentes)

Varredura com Playwright no Galaxy S25+ (411 × 744, DPR 2,63), a partir do worktree com
`npx vite --port <porta própria>`, dados sintéticos gravados por `src/db/repo.ts`: Hoje
(saldo negativo, conferência com diferença, pendente de estorno), Fluxo (saldo negativo,
estorno, pílula com filtro de data), Análises (Comparativo, rótulos de sobra), Ajustes →
Boxes e Bancos. Capturas enviadas ao usuário. Depois, o ciclo de entrega.
