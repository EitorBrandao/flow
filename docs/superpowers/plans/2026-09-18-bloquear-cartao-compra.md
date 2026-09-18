# Bloquear cartão para novas compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar de oferecer, no menu Adicionar → "Compra no cartão", um cartão que o usuário
marcou como "sem compra avulsa" — sem tocar em fatura, assinaturas ou na tela de Assinaturas.

**Architecture:** Novo campo opcional `permiteCompra?: boolean` em `Cartao`
(`src/domain/types.ts`). `undefined`/`true` = permite (comportamento atual); `false` =
bloqueado. O campo só é lido em um lugar: o filtro `cartoesAtivos` de
`src/ui/AdicionarSheet.tsx`. Um botão em `src/ui/ajustes/Cartoes.tsx` alterna o valor via
`repo.salvarCartao` (já aceita qualquer campo extra de `Cartao`, sem mudança em `repo.ts`).

**Tech Stack:** React 18 + TypeScript, Zustand, Dexie (sem nova versão de schema — campo não
indexado), Vitest + Testing Library.

## Global Constraints

- Não alterar `ativo`, `src/domain/fatura.ts` (`diffSincronizacao`), `sincronizarCartoes` /
  `materializarAssinatura` (`src/db/repo.ts`) nem `src/ui/ajustes/Assinaturas.tsx`.
- Sem migração de dados: `cartoes: 'id, boxId'` em `src/db/database.ts` não muda — campo novo
  não é indexado.
- Sem indicador visual novo (sem opacidade, sem badge) para o estado `permiteCompra`.
- Rótulos do botão: **"Bloquear compras"** (estado atual permite) / **"Permitir compras"**
  (estado atual bloqueia).
- Textos de UI e mensagens de commit em português (ver `CLAUDE.md`).

---

## Task 1: Filtrar cartão bloqueado em "Compra no cartão"

**Files:**
- Modify: `src/domain/types.ts:80` (adiciona o campo `permiteCompra` em `Cartao`)
- Modify: `src/ui/AdicionarSheet.tsx:31` (filtro de `cartoesAtivos`)
- Test: `src/ui/AdicionarSheet.test.tsx`

**Interfaces:**
- Consumes: `Cartao` (`src/domain/types.ts`), `repo.salvarCartao(n: NovoCartao | Cartao, horizonte: ISODate): Promise<Cartao>` (`src/db/repo.ts:351`) — já aceita um `Cartao` completo com campos extras, sem mudança.
- Produces: `Cartao.permiteCompra?: boolean`, usado só por `AdicionarSheet.tsx` nesta task. A Task 2 consome esse mesmo campo pelo mesmo nome.

- [ ] **Step 1: Escreva o teste que falha**

Abra `src/ui/AdicionarSheet.test.tsx` e adicione este teste depois do teste
`'2+ cartões ativos: "Compra no cartão" mostra lista de escolha antes do formulário'` (linha 79):

```tsx
it('cartão bloqueado para compra não aparece na escolha, mesmo ativo', async () => {
  const box = await montarBox();
  const nubank = await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await repo.salvarCartao({ ...nubank, permiteCompra: false }, '2027-12-31');
  await repo.salvarCartao({
    boxId: box.id, nome: 'Inter', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByText('Compra no cartão'));
  // só o Inter está disponível: pula direto pro formulário, sem passar pela escolha
  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Compra em qual cartão?' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rode o teste e confirme que falha**

Run: `npx vitest run src/ui/AdicionarSheet.test.tsx -t "cartão bloqueado para compra"`
Expected: FAIL — a tela mostra "Compra em qual cartão?" (Nubank e Inter ainda aparecem os dois),
porque `permiteCompra` ainda não existe no tipo nem é filtrado.

- [ ] **Step 3: Adicione o campo ao tipo `Cartao`**

Em `src/domain/types.ts`, dentro da interface `Cartao` (linha 80), logo depois de `ativo: boolean;`:

```ts
export interface Cartao extends Entidade {
  boxId: ID;
  nome: string;
  diaFechamento: number; // 1-31, clampado ao fim do mês
  diaVencimento: number; // 1-31, clampado
  categoriaFaturaId: ID; // categoria de gasto do Flow que recebe a fatura
  categoriaAssinaturasId?: ID; // CategoriaCartao oculta reservada p/ assinaturas; criada sob demanda
  categoriaParcelamentoId?: ID; // CategoriaCartao oculta reservada p/ parcelamento de fatura; sob demanda
  ativo: boolean;
  permiteCompra?: boolean; // undefined/true = permite; false = bloqueado p/ compra avulsa nova
  bancoId?: ID; // banco dono do cartão; organizacional nesta entrega
}
```

- [ ] **Step 4: Filtre em `AdicionarSheet.tsx`**

Em `src/ui/AdicionarSheet.tsx`, na função `cartoesAtivos` (linha 28-32), troque a linha 31:

```ts
  const cartoesAtivos = useMemo(() => {
    if (!dados) return [];
    const ids = boxIdsSelecionadas(dados, boxSel);
    return dados.cartoes.filter((c) => c.ativo && c.permiteCompra !== false && ids.includes(c.boxId));
  }, [dados, boxSel]);
```

- [ ] **Step 5: Rode o teste e confirme que passa**

Run: `npx vitest run src/ui/AdicionarSheet.test.tsx`
Expected: PASS (todos os testes do arquivo, incluindo o novo).

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/ui/AdicionarSheet.tsx src/ui/AdicionarSheet.test.tsx
git commit -m "feat: cartão pode ser bloqueado para novas compras avulsas"
```

---

## Task 2: Botão de bloquear/permitir em Ajustes → Cartões

**Files:**
- Modify: `src/ui/ajustes/Cartoes.tsx` (nova função `alternarPermiteCompra` + botão)
- Test: `src/ui/ajustes/Cartoes.test.tsx`

**Interfaces:**
- Consumes: `Cartao.permiteCompra?: boolean` (Task 1), `repo.salvarCartao` (sem mudança).
- Produces: nada consumido por outra task.

- [ ] **Step 1: Escreva o teste que falha**

Abra `src/ui/ajustes/Cartoes.test.tsx` e adicione este teste depois do teste
`'permite dois cartões ativos na mesma box'` (linha 59):

```tsx
it('bloquear compras não desativa o cartão, só o esconde do fluxo de nova compra', async () => {
  const box = await montarBox();
  await repo.salvarCartao({
    boxId: box.id, nome: 'Nubank', diaFechamento: 28, diaVencimento: 5,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01' });
  render(<Cartoes />);

  await userEvent.click(screen.getByRole('button', { name: 'Bloquear compras' }));

  await waitFor(async () => {
    const [cartao] = await db.cartoes.toArray();
    expect(cartao.permiteCompra).toBe(false);
    expect(cartao.ativo).toBe(true);
  });
  expect(await screen.findByRole('button', { name: 'Permitir compras' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Permitir compras' }));

  await waitFor(async () => {
    const [cartao] = await db.cartoes.toArray();
    expect(cartao.permiteCompra).toBe(true);
  });
});
```

- [ ] **Step 2: Rode o teste e confirme que falha**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx -t "bloquear compras não desativa"`
Expected: FAIL — não existe botão com o nome "Bloquear compras".

- [ ] **Step 3: Implemente o botão**

Em `src/ui/ajustes/Cartoes.tsx`, depois da função `alternarAtivo` (linha 59-63), adicione:

```tsx
  async function alternarPermiteCompra(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    const novoPermite = c.permiteCompra === false; // estava bloqueado ⇒ passa a permitir
    await repo.salvarCartao({ ...c, permiteCompra: novoPermite }, horizonte);
    await recarregar();
  }
```

E, no JSX da lista (linha 106-115), depois do botão "Ativar"/"Desativar":

```tsx
          <div className="item" key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
            <div className="cresce">
              {c.nome}
              <div className="sub">fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}</div>
            </div>
            <button className="botao" onClick={() => editar(c.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtivo(c.id)}>
              {c.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button className="botao" onClick={() => alternarPermiteCompra(c.id)}>
              {c.permiteCompra === false ? 'Permitir compras' : 'Bloquear compras'}
            </button>
          </div>
```

- [ ] **Step 4: Rode o teste e confirme que passa**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: PASS (todos os testes do arquivo, incluindo o novo).

- [ ] **Step 5: Rode a suíte inteira**

Run: `npm test`
Expected: PASS — nenhuma regressão em `fatura.test.ts`, `aggregations.test.ts`,
`Assinaturas.tsx` ou no dossiê (`src/dossie/dossie.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/ui/ajustes/Cartoes.tsx src/ui/ajustes/Cartoes.test.tsx
git commit -m "feat: botão para bloquear/permitir compras num cartão"
```

---

## Depois do plano

Este é um recurso visível ao usuário (novo botão em Ajustes → Cartões, novo comportamento no
Adicionar). Ao terminar as duas tasks, siga a skill `ciclo-de-entrega`: mockup **não** é
necessário aqui — não há tela nova, nem classe/token novo, só um botão a mais no padrão já
existente (nível "editar tela" do guia de estilo) — mas wiki (`docs/wiki/`), fragmento de
changelog em `changelog.d/` e o resto do ciclo (merge, release, deploy) continuam obrigatórios.
