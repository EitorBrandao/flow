# Diferença da fatura — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** na folha "Pagamento da fatura", a sobra de um pagamento parcial vai, por padrão, para a fatura seguinte, com três pílulas (Mês seguinte · Parcelei · Não volta); pagamento a mais ganha aviso.

**Arquitetura:** uma função de domínio nova (`jaLancadoDaFatura`) passa a ser a única regra de "o que desta fatura já foi para as faturas seguintes", usada pelo aviso da aba Cartão e pela folha. O repo só muda a descrição da compra de 1 parcela. A folha (`PagamentoFaturaSheet.tsx`) ganha o `SeletorPills` e o campo "Valor na próxima fatura".

**Stack:** React 18, TypeScript, Dexie, Vitest + Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-24-diferenca-da-fatura-design.md`. Mockup aprovado pelo usuário em 2026-09-24.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\diferenca-fatura`, branch `diferenca-fatura`. **Não toque no checkout principal** (`C:\Users\eitor\Claude\ProjetoFinancas`). Antes da primeira edição, `git rev-parse --show-toplevel` tem que devolver o worktree.
- Texto de UI, testes, comentários e commits em português.
- Dinheiro em centavos inteiros; formatar só com `formatarBRL`. Em teste, compare com `formatarBRL(...)` ou regex — `formatarBRL` usa espaço não-quebrável.
- Nenhuma classe CSS nova; `src/styles.css` não muda. Nenhuma dependência nova.
- Não mude `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json` nem `.claude/`.
- Não use `{ timeout: n }` em `findBy*`/`waitFor`.
- Arquivos em UTF-8 sem BOM (use as ferramentas de edição, não `Set-Content`).
- Dados sintéticos apenas.
- Antes de dizer que terminou uma tarefa: `npm test` inteiro verde.

---

### Tarefa 1: `jaLancadoDaFatura` no domínio

**Arquivos:**
- Modificar: `src/domain/fatura.ts` (perto de `faturaForaDoFluxo`, ~linha 142)
- Teste: `src/domain/fatura.test.ts`

**Interfaces:**
- Produz: `export function jaLancadoDaFatura(cartao: Pick<Cartao, 'categoriaParcelamentoId'>, dataFechamento: ISODate, compras: CompraCartao[]): number` — soma, em centavos, o `valorTotal` das compras na categoria reservada de parcelamento do cartão com `data === dataFechamento`. Cartão sem `categoriaParcelamentoId` → `0`.

- [ ] **Passo 0: preparar o worktree**

```bash
cd /c/Users/eitor/Claude/ProjetoFinancas/.worktrees/diferenca-fatura
git rev-parse --show-toplevel   # deve terminar em .worktrees/diferenca-fatura
npm ci
```

- [ ] **Passo 1: escrever os testes (falham)**

Em `src/domain/fatura.test.ts`, adicione `jaLancadoDaFatura` ao import de `./fatura` e este bloco depois do `describe('faturaForaDoFluxo', ...)`. Use os helpers que já existem no arquivo (`compra(data, valor, parcelas?, categoriaId?)`, `cartaoK`):

```ts
describe('jaLancadoDaFatura', () => {
  const cartao = { ...cartaoK, categoriaParcelamentoId: 'catParc' };

  it('soma só as compras da categoria de parcelamento com a data do fechamento', () => {
    const compras = [
      compra('2026-07-28', 60000, 1, 'catParc'),  // restante desta fatura
      compra('2026-07-28', 30000, 3, 'catParc'),  // parcelamento desta fatura
      compra('2026-07-28', 5000),                 // compra comum no dia do fechamento
      compra('2026-06-28', 40000, 1, 'catParc'),  // restante da fatura anterior
    ];
    expect(jaLancadoDaFatura(cartao, '2026-07-28', compras)).toBe(90000);
  });

  it('cartão sem categoria de parcelamento: zero', () => {
    const compras = [compra('2026-07-28', 60000, 1, 'catParc')];
    expect(jaLancadoDaFatura(cartaoK, '2026-07-28', compras)).toBe(0);
  });

  it('nada lançado: zero', () => {
    expect(jaLancadoDaFatura(cartao, '2026-07-28', [])).toBe(0);
  });
});
```

Confira a assinatura do helper `compra` no topo do arquivo antes; se a ordem dos parâmetros for outra, ajuste as chamadas, não o helper.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run src/domain/fatura.test.ts -t "jaLancadoDaFatura"` → FAIL (`jaLancadoDaFatura` não exportada).

- [ ] **Passo 3: implementar e reusar em `faturaForaDoFluxo`**

Em `src/domain/fatura.ts`, antes de `faturaForaDoFluxo`:

```ts
/**
 * Quanto desta fatura já foi empurrado para as faturas seguintes: restante (1 parcela) ou
 * parcelamento, gravados por `registrarPagamentoFatura` na categoria reservada do cartão com a
 * data do fechamento da fatura paga. Regra única — o aviso "não chegaram no Fluxo" e a folha
 * de pagamento leem daqui, para nunca discordarem.
 */
export function jaLancadoDaFatura(
  cartao: Pick<Cartao, 'categoriaParcelamentoId'>, dataFechamento: ISODate, compras: CompraCartao[],
): number {
  if (!cartao.categoriaParcelamentoId) return 0;
  return compras
    .filter((c) => c.categoriaCartaoId === cartao.categoriaParcelamentoId && c.data === dataFechamento)
    .reduce((s, c) => s + c.valorTotal, 0);
}
```

Dentro de `faturaForaDoFluxo`, troque o bloco

```ts
  const parcelado = compras
    .filter((c) => c.categoriaCartaoId === cartao.categoriaParcelamentoId && c.data === fatura.dataFechamento)
    .reduce((s, c) => s + c.valorTotal, 0);
```

por

```ts
  const parcelado = jaLancadoDaFatura(cartao, fatura.dataFechamento, compras);
```

Confirme que `Cartao` já está importado em `fatura.ts`; se não, adicione ao import de `./types`.

- [ ] **Passo 4: rodar e ver passar**

`npx vitest run src/domain/fatura.test.ts` → todos PASS (inclusive os de `faturaForaDoFluxo`).

- [ ] **Passo 5: suíte inteira e commit**

```bash
npm test
git add src/domain/fatura.ts src/domain/fatura.test.ts
git commit -m "refactor(fatura): jaLancadoDaFatura como regra única do que já foi para as faturas seguintes"
```

---

### Tarefa 2: descrição "Restante da fatura" para 1 parcela

**Arquivos:**
- Modificar: `src/db/repo.ts` (`registrarPagamentoFatura`, ~linha 546)
- Teste: `src/db/repo.test.ts` (`describe('registrarPagamentoFatura')`, ~linha 902)

**Interfaces:**
- Consome: nada novo.
- Produz: compra de 1 parcela com `descricao: 'Restante da fatura de MM/AAAA'`; 2+ parcelas continuam `'Parcelamento da fatura de MM/AAAA'`.

- [ ] **Passo 1: teste (falha)**

Dentro de `describe('registrarPagamentoFatura', ...)`, use o helper `comFatura` do próprio bloco:

```ts
  it('uma parcela só vira "Restante da fatura" e cai inteira na fatura seguinte', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      // fecha 28/07, vence 05/08
      const { cartao, fatura } = await comFatura(28, 5, 90000);

      await repo.registrarPagamentoFatura({
        lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
        valorPagoCent: 30000, dataPagamento: fatura.data,
        parcelamento: { parcelas: 1, valorParcelaCent: 64000 }, // 600,00 + 40,00 de juros
        horizonte: '2027-12-31',
      });

      const atualizado = (await db.cartoes.get(cartao.id))!;
      const restante = (await db.comprasCartao.toArray())
        .find((c) => c.categoriaCartaoId === atualizado.categoriaParcelamentoId)!;
      expect(restante).toMatchObject({
        data: '2026-07-28', valorTotal: 64000, parcelas: 1,
        descricao: 'Restante da fatura de 08/2026',
      });

      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-08', 30000, 'efetivo'],
        ['2026-09', 64000, 'previsto'],
      ]);
    } finally { vi.useRealTimers(); }
  });
```

- [ ] **Passo 2:** `npx vitest run src/db/repo.test.ts -t "Restante da fatura"` → FAIL (descrição "Parcelamento…").

- [ ] **Passo 3: implementar**

Em `registrarPagamentoFatura`, troque

```ts
        descricao: `Parcelamento da fatura de ${mes}/${ano}`,
```

por

```ts
        // Uma parcela só não é parcelamento: é o que sobrou, jogado inteiro no mês seguinte.
        descricao: `${parcelamento.parcelas === 1 ? 'Restante' : 'Parcelamento'} da fatura de ${mes}/${ano}`,
```

- [ ] **Passo 4:** `npx vitest run src/db/repo.test.ts` → PASS.

- [ ] **Passo 5:** `npm test` verde, depois

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(fatura): restante de parcela única ganha descrição própria"
```

Se `npm test` acusar o dossiê desatualizado (`src/dossie/dossie.test.ts`), rode `npm run dossie`, confira no `git diff docs/dossie/` que só mudou o que esta tarefa mudou, e inclua `docs/dossie/` no commit.

---

### Tarefa 3: folha de pagamento com as três pílulas

**Arquivos:**
- Modificar: `src/ui/PagamentoFaturaSheet.tsx`
- Teste: `src/ui/PagamentoFaturaSheet.test.tsx`

**Interfaces:**
- Consome: `jaLancadoDaFatura` (Tarefa 1), `datasFaturaDoMes` e `ajustesDoCartao` de `src/domain/fatura.ts`, `SeletorPills` de `./SeletorPills`, `registrarPagamentoFatura` com `parcelas: 1` (Tarefa 2).
- Produz: mesma API pública do componente (props inalteradas). Os três chamadores — `TelaHoje.tsx`, `TelaCartao.tsx`, `FaturaResumo.tsx` — não mudam.

**Comportamento (da spec e do mockup aprovado):**

`restante = totalFaturaCent − valorPago`.

- `restante > 0`:
  - Se `jaLancado > 0`: linha `<p className="sub" style={{ margin: 0 }}>Já lançado na próxima fatura: <strong>{formatarBRL(jaLancado)}</strong>.</p>`.
  - `<p className="rotulo" style={{ margin: 0 }}>O que acontece com os {formatarBRL(restante)} que sobraram?</p>`
  - `SeletorPills` com `rotulo="Destino do que sobrou"` e opções `seguinte` "Mês seguinte", `parcelei` "Parcelei", `naovolta` "Não volta".
  - Pílula inicial: `naovolta` se `jaLancado > 0`, senão `seguinte`.
  - `seguinte`: campo `CampoValor` com label "Valor na próxima fatura". Acompanha o restante enquanto o usuário não digitar nele; depois de digitado, fica fixo.
  - `parcelei`: os campos "Parcelas" e "Valor de cada parcela" de hoje.
  - `naovolta`: sem campos.
- Resumo (`.pagamento-fatura-resumo`), sempre com "Restou da fatura":
  - `seguinte` com valor > 0: + "Na próxima fatura" + linha de juros (`valorProx − restante`).
  - `parcelei` com parcela > 0: + "N × parcela" + linha de juros (como hoje).
  - Linha de juros: `0` → "Juros"/"sem juros"; `> 0` → "Juros"/valor; `< 0` → "Faltam"/valor absoluto (classes de hoje).
- Aviso `.aviso` (acima do botão), `some = "Os {X} que sobraram <strong>somem da projeção</strong> — não voltam em nenhuma fatura."`:
  - `seguinte` com valor 0: `some`.
  - `parcelei` com parcela 0: `some` + " Se o banco parcelou, preencha acima."
  - `naovolta` e `jaLancado === 0`: `some` + " Use esta opção para desconto ou estorno."
  - `naovolta` e `jaLancado > 0`: **sem aviso**.
  - `restante < 0`: "Você pagou <strong>{formatarBRL(−restante)} a mais</strong> que a fatura. O banco costuma abater da próxima fatura; o Flow ainda não registra esse crédito."
- Salvar: só com `restante > 0`; `seguinte` e valor > 0 → `parcelamento: { parcelas: 1, valorParcelaCent: valorProx }`; `parcelei` e parcela > 0 → `{ parcelas: parcelasNum, valorParcelaCent: valorParcela }`; senão nenhum.

- [ ] **Passo 1: ajustar os testes existentes e escrever os novos (falham)**

Em `src/ui/PagamentoFaturaSheet.test.tsx`:

1. Adicione um helper depois de `montar`:

```ts
async function digitarPago(centavos: string) {
  await userEvent.click(screen.getByLabelText('Quanto você pagou'));
  await userEvent.keyboard(`{Backspace>9/}${centavos}`);
}
```

2. Testes que usam os campos de parcela passam a tocar em "Parcelei" logo depois de digitar o valor pago: `'a linha de contas mostra "sem juros"…'`, `'…mostra os juros…'`, `'parcelas que somam menos…'`, `'salvar com parcelamento cria as parcelas…'`, `'preencher a parcela troca o aviso…'`. Inserir:

```ts
    await userEvent.click(screen.getByRole('radio', { name: 'Parcelei' }));
```

3. `'os campos de parcelamento aparecem sozinhos assim que sobra valor'` vira:

```ts
it('sobrando valor, as pílulas aparecem com "Mês seguinte" marcado e o restante preenchido', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    // pagando o total não sobra nada, então não há pergunta
    expect(screen.queryByRole('radiogroup', { name: 'Destino do que sobrou' })).not.toBeInTheDocument();

    await digitarPago('30000');

    expect(screen.getByRole('radio', { name: 'Mês seguinte' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(60000));
    expect(screen.queryByLabelText('Valor de cada parcela')).not.toBeInTheDocument();
    expect(screen.getByText('Na próxima fatura').nextElementSibling).toHaveTextContent(/600,00/);
    expect(screen.getByText('sem juros')).toBeInTheDocument();
    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
```

4. `'sobra sem destino é avisada em vez de sumir calada'` vira (o padrão não perde mais nada; o aviso aparece ao escolher "Não volta"):

```ts
it('"Não volta" avisa que a sobra some da projeção', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Não volta' }));

    expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();
    expect(screen.getByText(/desconto ou estorno/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor na próxima fatura')).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
```

5. `'pagando a fatura inteira não há sobra nem aviso'`: troque `queryByLabelText('Valor de cada parcela')` por `queryByRole('radiogroup', { name: 'Destino do que sobrou' })` e acrescente `expect(screen.queryByText(/a mais/)).not.toBeInTheDocument();`.

6. `'salvar sem preencher a parcela não inventa parcelamento nenhum'` vira "Não volta":

```ts
it('"Não volta" grava só o pagamento, sem compra nem categoria reservada', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('radio', { name: 'Não volta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
    });
    expect(await db.comprasCartao.count()).toBe(1); // só a compra original
    expect((await db.categoriasCartao.toArray()).some((c) => c.nome === 'Parcelamento')).toBe(false);
  } finally { vi.useRealTimers(); }
});
```

7. `'salvar sem parcelamento grava só o valor pago como efetivo'` (85000): acrescente o clique em "Não volta" antes de confirmar.

8. A `INVARIANTE` passa a exigir, para toda sobra e **toda pílula**, que o valor vá para alguma fatura ou que a tela avise:

```ts
it('INVARIANTE: nenhuma sobra pode sumir sem aviso, em nenhuma pílula', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);

    for (const centavos of ['0', '1', '30000', '89999', '90000']) {
      await digitarPago(centavos);
      const restante = 90000 - Number(centavos);

      if (restante <= 0) {
        expect(screen.queryByText(/somem da projeção/), 'aviso sem sobra').not.toBeInTheDocument();
        continue;
      }
      for (const pilula of ['Mês seguinte', 'Parcelei', 'Não volta']) {
        await userEvent.click(screen.getByRole('radio', { name: pilula }));
        const vaiParaFatura = screen.queryByText('Na próxima fatura') != null
          || screen.queryByText(/^\d+ × /) != null;
        const avisado = screen.queryByText(/somem da projeção/) != null;
        expect(vaiParaFatura || avisado, `sobra de ${restante} em "${pilula}" some calada`).toBe(true);
      }
      // zerar o valor da próxima fatura também tem que avisar
      await userEvent.click(screen.getByRole('radio', { name: 'Mês seguinte' }));
      await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
      await userEvent.keyboard('{Backspace>9/}');
      expect(screen.getByText(/somem da projeção/)).toBeInTheDocument();
    }
  } finally { vi.useRealTimers(); }
});
```

9. Testes novos:

```ts
it('"Mês seguinte" grava o restante como parcela única na fatura seguinte', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await vi.waitFor(async () => {
      const faturas = (await db.lancamentos.toArray())
        .filter((l) => l.origem === 'cartao')
        .sort((a, b) => a.data.localeCompare(b.data));
      expect(faturas.map((l) => [l.faturaMes, l.valor, l.status])).toEqual([
        ['2026-08', 30000, 'efetivo'],
        ['2026-09', 60000, 'previsto'],
      ]);
    });
    const restante = (await db.comprasCartao.toArray()).find((c) => c.parcelas === 1 && c.descricao);
    expect(restante?.descricao).toBe('Restante da fatura de 08/2026');
  } finally { vi.useRealTimers(); }
});

it('"Mês seguinte" com juros: grava o valor digitado e mostra a diferença como juros', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
    await userEvent.keyboard('64000'); // 600,00 + 40,00 do banco

    expect(screen.getByText('Juros').nextElementSibling).toHaveTextContent(/40,00/);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      const setembro = (await db.lancamentos.toArray()).find((l) => l.faturaMes === '2026-09');
      expect(setembro?.valor).toBe(64000);
    });
  } finally { vi.useRealTimers(); }
});

it('o valor da próxima fatura acompanha o pago até ser digitado', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('30000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(60000));
    await digitarPago('50000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(40000));

    await userEvent.click(screen.getByLabelText('Valor na próxima fatura'));
    await userEvent.keyboard('45000');
    await digitarPago('40000');
    expect(screen.getByLabelText('Valor na próxima fatura')).toHaveValue(formatarBRL(45000));
  } finally { vi.useRealTimers(); }
});

it('pagou a mais: avisa o excesso, sem pílulas e sem gravar crédito', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { fatura } = await comFatura();
    montar(fatura);
    await digitarPago('100000'); // 1.000,00 numa fatura de 900,00

    expect(screen.getByText(/a mais/)).toHaveTextContent(/100,00/);
    expect(screen.getByText(/ainda não registra esse crédito/)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Destino do que sobrou' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 100000 });
    });
    expect(await db.comprasCartao.count()).toBe(1);
  } finally { vi.useRealTimers(); }
});

it('fatura com restante já lançado: abre em "Não volta", mostra o lançado e não duplica', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const { cartao, fatura } = await comFatura();
    await repo.registrarPagamentoFatura({
      lancamentoId: fatura.id, cartaoId: cartao.id, faturaMes: '2026-08',
      valorPagoCent: 30000, dataPagamento: '2026-07-01',
      parcelamento: { parcelas: 1, valorParcelaCent: 60000 }, horizonte: '2027-12-31',
    });
    await useApp.getState().recarregar();
    const paga = useApp.getState().dados!.lancamentos.find((l) => l.id === fatura.id)!;
    montar(paga); // abre com o valor já pago, 300,00: sobram 600,00

    expect(screen.getByText(/Já lançado na próxima fatura/)).toHaveTextContent(/600,00/);
    expect(screen.getByRole('radio', { name: 'Não volta' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/somem da projeção/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await vi.waitFor(async () => {
      expect(await db.lancamentos.get(fatura.id)).toMatchObject({ status: 'efetivo', valor: 30000 });
    });
    expect(await db.comprasCartao.count()).toBe(2); // a original + o restante, sem duplicar
  } finally { vi.useRealTimers(); }
});
```

- [ ] **Passo 2:** `npx vitest run src/ui/PagamentoFaturaSheet.test.tsx` → os novos e os ajustados falham.

- [ ] **Passo 3: implementar**

Em `src/ui/PagamentoFaturaSheet.tsx`:

Imports: acrescentar `ajustesDoCartao, datasFaturaDoMes, jaLancadoDaFatura` ao import de `../domain/fatura`, `type Dados` ao de `../domain/types`, e `import SeletorPills from './SeletorPills';`.

Fora do componente:

```ts
type Destino = 'seguinte' | 'parcelei' | 'naovolta';

const OPCOES_DESTINO: { id: Destino; nome: string }[] = [
  { id: 'seguinte', nome: 'Mês seguinte' },
  { id: 'parcelei', nome: 'Parcelei' },
  { id: 'naovolta', nome: 'Não volta' },
];

/** Quanto desta fatura já foi para as seguintes — mesma regra do aviso da aba Cartão. */
function jaLancadoDoLancamento(dados: Dados | null, lancamento: Lancamento): number {
  const cartao = dados?.cartoes.find((c) => c.id === lancamento.cartaoId);
  if (!dados || !cartao || !lancamento.faturaMes) return 0;
  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const { dataFechamento } = datasFaturaDoMes(cartao, lancamento.faturaMes, ajustes);
  return jaLancadoDaFatura(cartao, dataFechamento, dados.comprasCartao);
}
```

No componente, antes de `if (!dados) return null;` (hooks antes do retorno antecipado):

```ts
  const jaLancado = jaLancadoDoLancamento(dados, lancamento);
  // Já existe restante ou parcelamento desta fatura ⇒ reabrir para corrigir não pode lançar
  // de novo por padrão. Sem nada lançado, o padrão é o que não perde dinheiro.
  const [destino, setDestino] = useState<Destino>(jaLancado > 0 ? 'naovolta' : 'seguinte');
  // O valor da próxima fatura acompanha o restante até o usuário digitar nele (juros do banco).
  const [valorProxDigitado, setValorProxDigitado] = useState<number | null>(null);
```

Depois de calcular `conta`, substitua o bloco `sobrou`/`parcelando` por:

```ts
  const sobrou = conta.restanteCent > 0;
  const valorProx = valorProxDigitado ?? Math.max(0, conta.restanteCent);
  const plano = !sobrou ? null
    : destino === 'seguinte' && valorProx > 0 ? { parcelas: 1, valorParcelaCent: valorProx }
    : destino === 'parcelei' && valorParcela > 0 ? { parcelas: parcelasNum, valorParcelaCent: valorParcela }
    : null;
  const jurosCent = plano ? plano.parcelas * plano.valorParcelaCent - conta.restanteCent : 0;
  const some = `Os ${formatarBRL(conta.restanteCent)} que sobraram`;
  const avisoSobra = !sobrou || plano ? null
    : destino === 'parcelei' ? ' Se o banco parcelou, preencha acima.'
    : destino === 'naovolta' ? (jaLancado > 0 ? null : ' Use esta opção para desconto ou estorno.')
    : '';
```

(`avisoSobra === null` ⇒ sem aviso; string ⇒ aviso "somem" seguido dela.)

Em `salvar()`, troque `...(parcelando ? { parcelamento: { parcelas: parcelasNum, valorParcelaCent: valorParcela } } : {})` por `...(plano ? { parcelamento: plano } : {})`.

Remova `resumoParcelamento(...)` com `parcelas`/`valorParcelaCent` se o `jurosCent` do `conta` deixar de ser usado — mantenha `conta.restanteCent`. `resumoParcelamento` continua sendo a fonte do restante.

JSX, na ordem (substitui do `{sobrou && (` até o aviso atual, mantendo o cabeçalho, os campos de pago/data e o aviso de pagamento adiantado como estão):

```tsx
      {sobrou && (
        <>
          {jaLancado > 0 && (
            <p className="sub" style={{ margin: 0 }}>
              Já lançado na próxima fatura: <strong>{formatarBRL(jaLancado)}</strong>.
            </p>
          )}
          <p className="rotulo" style={{ margin: 0 }}>
            O que acontece com os {formatarBRL(conta.restanteCent)} que sobraram?
          </p>
          <SeletorPills
            opcoes={OPCOES_DESTINO} selecionadaId={destino} rotulo="Destino do que sobrou"
            onSelecionar={(id) => setDestino(id as Destino)}
          />
          {destino === 'seguinte' && (
            <div className="campo">
              <label htmlFor={`${uid}-prox`}>Valor na próxima fatura</label>
              <CampoValor id={`${uid}-prox`} valorCentavos={valorProx} onChange={setValorProxDigitado} />
            </div>
          )}
          {destino === 'parcelei' && (
            <div className="linha">
              {/* os dois campos de hoje, sem mudança: Parcelas e Valor de cada parcela */}
            </div>
          )}
        </>
      )}

      <div className="pagamento-fatura-resumo">
        <div className="linha-conta">
          <span>Restou da fatura</span><strong>{formatarBRL(conta.restanteCent)}</strong>
        </div>
        {plano && (
          <>
            <div className="linha-conta">
              <span>
                {plano.parcelas === 1 ? 'Na próxima fatura' : `${plano.parcelas} × ${formatarBRL(plano.valorParcelaCent)}`}
              </span>
              <strong>{formatarBRL(plano.parcelas * plano.valorParcelaCent)}</strong>
            </div>
            <div className="linha-conta">
              {/* o bloco de juros de hoje, trocando conta.jurosCent por jurosCent */}
            </div>
          </>
        )}
      </div>

      {avisoSobra !== null && (
        <p className="aviso" style={{ margin: 0 }}>
          {some} <strong>somem da projeção</strong> — não voltam em nenhuma fatura.{avisoSobra}
        </p>
      )}
      {conta.restanteCent < 0 && (
        <p className="aviso" style={{ margin: 0 }}>
          Você pagou <strong>{formatarBRL(-conta.restanteCent)} a mais</strong> que a fatura. O banco
          costuma abater da próxima fatura; o Flow ainda não registra esse crédito.
        </p>
      )}
```

Os dois comentários `{/* ... */}` acima marcam onde **mover sem alterar** o JSX que já existe no arquivo (campos de parcelas; bloco de juros com `sem juros`/`Juros`/`Faltam`). Não deixe esses comentários no código final.

Atenção: "Parcelei" com 1 parcela preenchida também mostraria "Na próxima fatura" — aceitável, é o mesmo efeito. Atualize o comentário de topo do componente para citar as três pílulas.

- [ ] **Passo 4:** `npx vitest run src/ui/PagamentoFaturaSheet.test.tsx` → todos PASS.

- [ ] **Passo 5:** `npm test` inteiro verde e `npm run build` sem erro de tipo. Commit:

```bash
git add src/ui/PagamentoFaturaSheet.tsx src/ui/PagamentoFaturaSheet.test.tsx
git commit -m "feat(fatura): sobra do pagamento vai para o mês seguinte por padrão (item 20)"
```

---

### Tarefa 4: wiki e catálogo

**Arquivos:**
- Modificar: `docs/wiki/5-cartao.md` (seção "Pagar a fatura: valor, data e parcelamento", ~linhas 47–62)
- Modificar: `docs/estilo/catalogo.md` (entrada de `SeletorPills.tsx`)

- [ ] **Passo 1: wiki**

Leia `docs/wiki/README.md` (subconjunto fechado de markdown). Na seção de pagamento, troque o bullet "**Parcelou o restante no banco:** …" e o parágrafo "Sobrou valor e você não informou…" por:

```markdown
- **O que acontece com o que sobrou:** quando você paga menos que o total, a folha pergunta o destino da diferença, com três opções.
  - **Mês seguinte** (já vem marcada): o que sobrou vai inteiro para a próxima fatura. O valor vem preenchido; se o banco cobrou juros, digite por cima o valor que ele mostra.
  - **Parcelei:** informe em quantas vezes e quanto é cada parcela, como o app do banco mostra.
  - **Não volta:** para desconto ou estorno. A tela avisa **em destaque** que esse valor some da projeção.
```

Se o parser não aceitar sub-bullets, use três bullets de primeiro nível. Acrescente, depois do parágrafo "O parcelamento vira uma compra parcelada…":

```markdown
O "Mês seguinte" usa o mesmo caminho: vira uma compra de uma parcela só, chamada "Restante da fatura de MM/AAAA", na mesma categoria "Parcelamento".

Corrigindo uma fatura cujo restante já foi lançado, a folha mostra quanto já está na próxima fatura e abre em **Não volta**, para não lançar duas vezes.

Pagou **mais** que a fatura? A folha avisa o excesso. O banco costuma abater da fatura seguinte, mas o Flow ainda não registra esse crédito.
```

Validar: `npx vitest run src/ui/ajustes/capitulos.test.ts` → PASS.

- [ ] **Passo 2: catálogo**

Em `docs/estilo/catalogo.md`, na entrada de `SeletorPills.tsx`, acrescente `PagamentoFaturaSheet.tsx` (destino da sobra da fatura) à lista de usos. Rode `node scripts/verificar-catalogo.mjs` → sem aviso novo.

- [ ] **Passo 3:** `npm test` verde. Commit:

```bash
git add docs/wiki/5-cartao.md docs/estilo/catalogo.md
git commit -m "docs(wiki): destino da sobra no pagamento da fatura (item 20)"
```

---

## Fora deste plano (fica com a sessão principal, no ciclo de entrega)

- Fragmento `changelog.d/alterado-sobra-da-fatura.md` com confirmação literal do usuário.
- Merge, `npm run release`, push e deploy.
- Mover o item 20 do `TODO.md` para `TODO-CONCLUIDOS.md`.
