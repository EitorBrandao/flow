# Ajustes finos da varredura de boxes — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam a sintaxe de caixa de seleção (`- [ ]`).

**Objetivo:** corrigir os itens de esforço baixo da varredura de 2026-09-30 (duas boxes e a casa), em tarefas independentes que rodam em paralelo.

**Arquitetura:** cada tarefa mexe em poucos arquivos e roda no próprio worktree e branch. Só uma função pura nova (`notaExibivel`). O resto é CSS, texto e renderização condicional. Nenhuma tarefa muda o schema, o repo ou o backup.

**Tecnologias:** React 18, TypeScript, Vite, Zustand, Vitest, Testing Library. Nenhuma dependência nova.

**Origem:** achados `VB-01` a `VB-16` da varredura com Playwright de 2026-09-30. Não há spec: são correções sem decisão de produto em aberto, **exceto** as da Fase 0, que precisam do mockup aprovado.

## Restrições globais

Valem para todas as tarefas. Valores copiados do `CLAUDE.md`.

- Todo texto de UI, comentário, doc e mensagem de commit em **português**. Nunca misture inglês solto.
- Antes de editar a UI, consulte `docs/estilo-visual.md` e o capítulo do nível da mudança.
- Classe nova entra em `docs/estilo/catalogo.md` **na tarefa final de integração** (Tarefa 10), não nas tarefas paralelas. Cada tarefa que cria classe deixa a linha pronta no relatório final dela.
- **Sem dependência npm nova.** Sem mudar `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`.
- Dados de teste **sintéticos**. Nenhum valor, saldo ou nome real em arquivo versionado.
- Arquivos em UTF-8 **sem BOM**. Use as ferramentas de edição, não `Set-Content`.
- Não edite `"version"` do `package.json` nem o topo do `CHANGELOG.md`. Cada mudança visível vira **um fragmento** em `changelog.d/alterado-<slug>.md`, com um bullet por linha, sem negrito e sem aninhamento.
- Não rode nem edite o dossiê (`docs/dossie/`) nas tarefas paralelas. Só a Tarefa 10 roda `npm run dossie`.
- Todo subagente: caminho absoluto do worktree no prompt, frase "não toque no checkout principal", e `npm test` completo verde antes de encerrar.

## Itens fora do plano (e por quê)

Quatro itens de esforço baixo da lista não entram. A leitura do código mostrou que não são defeito:

| ID | Motivo |
|---|---|
| VB-07 | O selo "padrão" só aparece com dois ou mais bancos, de propósito (`Bancos.tsx`, `temPadrao`). Um banco único não tem o que escolher. |
| VB-08 | Falha do roteiro de teste. `CampoValor` lê as teclas (`onKeyDown`), não o evento de mudança; o `fill()` do Playwright não dispara. Quem digita no aparelho não vê o problema. |
| VB-13 | O percentual é "do total da renda" (`pctDaRenda`). Só faz sentido para gasto. |
| VB-15 | O `<h2>` com o nome da subtela repete em dez telas de Ajustes. É o padrão do app; mudar uma tela só criaria divergência. Se o usuário quiser mudar, vira item novo, nas dez telas. |

## Decisões do mockup (2026-10-01)

O usuário respondeu ao mockup da Tarefa 0:

- **VB-01:** `--total-pos` passa a `#4ade80` ("verde claro"). A Tarefa 8 segue com esse valor.
- **VB-02:** aprovado, opacidade de 45%.
- **VB-05, VB-12, VB-14:** aprovados como no mockup.
- **VB-04 mudou de escopo.** O botão "↔" por banco **sai** da linha. No lugar entra **um** botão "Transferir entre bancos", abaixo da lista de bancos. Ao tocar nele, a pessoa escolhe a origem e o destino, o app mostra o saldo de cada um dos dois, e depois da transferência mostra o saldo de cada um de novo. Isso é desenho novo e **precisa de mockup próprio aprovado**: a Tarefa 5 fica reduzida a VB-05, e VB-04 vira a Tarefa 11, que só começa depois da aprovação.

## Mapa de arquivos e paralelismo

| Tarefa | Itens | Arquivos que ela toca | Fase |
|---|---|---|---|
| 0 | mockup de VB-01, VB-02, VB-04, VB-05, VB-12, VB-14 | nenhum do repo | 0 (parada do usuário) |
| 1 | VB-03 | `src/domain/notas.ts`, `src/ui/TelaFluxo.tsx` | 1 |
| 2 | VB-06, VB-16 | `src/ui/ajustes/Boxes.tsx` | 1 |
| 3 | VB-11 | `src/ui/ajustes/Cartoes.tsx` | 1 |
| 4 | VB-12 | `src/ui/TelaLancar.tsx`, `src/styles.css` (junto de `.aviso-urgente`) | 1, após Tarefa 0 |
| 5 | VB-05 (VB-04 saiu para a Tarefa 11) | `src/ui/TelaHoje.tsx`, `src/styles.css` (junto de `.conferencia-bancos`) | 1, após Tarefa 0 |
| 6 | VB-14 | `src/ui/TelaAnalises.tsx` | 1, após Tarefa 0 |
| 7 | VB-02 | `src/styles.css` (junto de `.botao-perigo`) | 1, após Tarefa 0 |
| 8 | VB-01 | `src/styles.css` (linha de `--total-pos`), docs de estilo | 1, após Tarefa 0 e **nível 6** |
| 9 | VB-09, VB-10 | `src/ui/SimuladorFluxo.tsx`, `src/ui/CenarioCard.tsx` | 2, **depois** do merge de `periodo-simular` |
| 10 | integração | catálogo, dossiê, wiki, fragmentos, varredura | 3 |

Conflitos conhecidos:

- As Tarefas 4, 5, 7 e 8 editam `src/styles.css`, mas em trechos diferentes. O git mescla sem conflito se cada uma **não** reformatar linhas vizinhas. Cada tarefa edita só a linha ou o bloco indicado.
- A Tarefa 9 depende do branch `periodo-simular` (worktree `.worktrees/periodo-simular`, spec de 2026-09-30). Ele reescreve `SimuladorFluxo.tsx` e `TabelaSimulacao.tsx` e fecha o item 32 do `TODO.md`. Não comece a Tarefa 9 antes desse merge.
- As Tarefas 2 e 3 não tocam o mesmo arquivo. Por isso `Boxes.tsx` junta VB-06 e VB-16 numa tarefa só.

Merge: o integrador junta os branches na `main` um a um, na ordem das tarefas, e roda `npm test` depois de cada junção.

---

## Tarefa 0: Mockup único das mudanças visuais (parada do usuário)

**Arquivos:** só rascunho, na pasta de rascunho da sessão. Nada no repo.

Esta é a única parada do ciclo. As Tarefas 4, 5, 6, 7 e 8 só começam depois da aprovação.

- [ ] **Passo 1: Montar o mockup com as classes e os tokens reais**

Um HTML só, com `<meta charset="utf-8">` na primeira linha, importando o CSS real de `src/styles.css`. Seis telas, uma por item, cada uma com **antes** e **depois**:

1. **VB-01 — cor do saldo.** Linha "hoje" do Fluxo (`.cabecalho-dia.dia-hoje` sobre `--hoje-bg`), total do dia, "Total calculado no Flow" e a tabela do Simular. Hoje `--total-pos` é `#008000`. Inclua **seletor de cor ao vivo** (`<input type="color">`) além de três presets, porque o usuário escolheu esse verde de propósito (spec 2026-07-18) e pode querer ajustar. Mostre a razão de contraste de cada preset contra `--surface` (`#1c2331`) e contra `--hoje-bg` (`#0d4a32`).
2. **VB-02 — botão desabilitado.** "Lançar" desabilitado ao lado do habilitado: `opacity: .45` e cursor padrão.
3. **VB-04 — botão de transferência em Conferir.** Duas opções: **A** (recomendada) texto "Transferir" no lugar de `↔`; **B** ícone `ArrowLeftRight` com legenda. Teste com nome de banco longo ("Banco Exemplo Longo") na largura de 411 px.
4. **VB-05 — campos de saldo em Conferir.** Campo no mesmo estilo dos outros campos do app (`--surface2`, raio 12, altura 44).
5. **VB-12 — confirmação "Lançado ✓".** Verde (`--pos-bg` e `--pos`) no lugar de âmbar.
6. **VB-14 — respiro em "Por categoria".** Espaço de 10 px entre a legenda das barras e a primeira linha.

- [ ] **Passo 2: Conferir cada link e cada navegação do mockup**

- [ ] **Passo 3: Enviar o mockup pelo chat com `SendUserFile`**

Não abra o navegador do PC. Espere a resposta do usuário. Registre no topo deste plano: a opção escolhida em VB-04 (A ou B), e o valor final de `--total-pos` (ou "mantém `#008000`").

---

## Tarefa 1: VB-03 — nota igual à categoria não repete no Fluxo

**Arquivos:**
- Criar: `src/domain/notas.ts`
- Criar: `src/domain/notas.test.ts`
- Modificar: `src/ui/TelaFluxo.tsx:265`
- Modificar: `src/ui/TelaFluxo.test.tsx`
- Criar: `changelog.d/alterado-nota-repetida-fluxo.md`

**Interfaces:**
- Produz: `notaExibivel(nota: string | undefined, nomeCategoria: string): string | undefined`. Devolve a nota aparada, ou `undefined` quando ela é vazia ou igual ao nome da categoria (sem diferença de caixa).

- [ ] **Passo 1: Escrever o teste da função, com os casos-limite**

`src/domain/notas.test.ts`:

```ts
import { notaExibivel } from './notas';

describe('notaExibivel', () => {
  it('devolve a nota quando ela difere da categoria', () => {
    expect(notaExibivel('Luz de setembro', 'Contas da casa')).toBe('Luz de setembro');
  });

  it('esconde a nota igual ao nome da categoria', () => {
    expect(notaExibivel('Salário', 'Salário')).toBeUndefined();
  });

  it('ignora diferença de caixa e espaços nas pontas', () => {
    expect(notaExibivel('  salário ', 'Salário')).toBeUndefined();
  });

  it('esconde nota vazia ou só de espaços', () => {
    expect(notaExibivel('', 'Salário')).toBeUndefined();
    expect(notaExibivel('   ', 'Salário')).toBeUndefined();
    expect(notaExibivel(undefined, 'Salário')).toBeUndefined();
  });

  it('mantém a nota que apenas contém o nome da categoria', () => {
    expect(notaExibivel('Salário extra', 'Salário')).toBe('Salário extra');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/notas.test.ts`
Expected: FAIL com "Failed to resolve import './notas'".

- [ ] **Passo 3: Implementar**

`src/domain/notas.ts`:

```ts
/**
 * A nota de um lançamento só vale a pena quando diz algo que a categoria já não diz.
 * Recorrência e lançamento rápido costumam gravar o próprio nome da categoria como nota:
 * mostrar as duas linhas ("Salário" e "Salário") é ruído.
 */
export function notaExibivel(nota: string | undefined, nomeCategoria: string): string | undefined {
  const limpa = nota?.trim();
  if (!limpa) return undefined;
  const igual = limpa.toLocaleLowerCase('pt-BR') === nomeCategoria.trim().toLocaleLowerCase('pt-BR');
  return igual ? undefined : limpa;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/domain/notas.test.ts`
Expected: PASS, 5 testes.

- [ ] **Passo 5: Achar todos os lugares que mostram categoria e nota juntas**

Run: `grep -rn "\.nota" src/ui --include=*.tsx | grep -v "\.test\."`

O mesmo conceito aparece do mesmo jeito em toda tela. Aplique `notaExibivel` em **cada** lista que mostra o nome da categoria e a nota do mesmo lançamento (no mínimo `TelaFluxo.tsx`; confira `LancamentosSheet.tsx`, `TelaHoje.tsx` na fila de pendentes e `TelaAnalises`). Onde a nota aparece sozinha (campo de edição, busca), **não** mude.

- [ ] **Passo 6: Aplicar em `TelaFluxo.tsx`**

Troque a linha 265:

```tsx
{notaExibivel(l.nota, nomeCat(l.categoriaId)) && <div className="sub">{notaExibivel(l.nota, nomeCat(l.categoriaId))}</div>}
```

por uma variável local acima do `return` da linha, para chamar a função uma vez só. Adicione `import { notaExibivel } from '../domain/notas';`. A busca (linha 101) continua usando `l.nota` crua: quem busca "salário" ainda acha o lançamento.

- [ ] **Passo 7: Teste de tela**

Em `src/ui/TelaFluxo.test.tsx`, que já tem `seedBoxComCategoria` (box `eitor`, categorias `mercado` e `salário`):

```tsx
it('não repete a categoria como nota na linha do lançamento', async () => {
  const { box, catSalario } = await seedBoxComCategoria();
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-10', valor: 500000, status: 'previsto', nota: 'salário' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: catSalario.id, data: '2026-07-11', valor: 20000, status: 'previsto', nota: 'adiantamento' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);

  expect(await screen.findByText('adiantamento')).toBeInTheDocument();
  // O nome da categoria aparece uma vez por lançamento (dois), nunca três: a nota "salário" some.
  expect(screen.getAllByText('salário')).toHaveLength(2);
});
```

Rode antes da correção do Passo 6 para ver `toHaveLength(2)` falhar com 3.

- [ ] **Passo 8: Fragmento de changelog**

`changelog.d/alterado-nota-repetida-fluxo.md`:

```
- Fluxo: a linha do lançamento não repete mais a categoria quando a nota tem o mesmo texto
```

- [ ] **Passo 9: Rodar a suíte completa**

Run: `npm test`
Expected: tudo verde.

- [ ] **Passo 10: Commit**

```bash
git add src/domain/notas.ts src/domain/notas.test.ts src/ui changelog.d/alterado-nota-repetida-fluxo.md
git commit -m "fix(fluxo): esconde a nota quando ela repete o nome da categoria"
```

---

## Tarefa 2: VB-06 e VB-16 — padrão da box visível e placeholder neutro

**Arquivos:**
- Modificar: `src/ui/ajustes/Boxes.tsx:141` (placeholder) e `:192-196` (selo "padrão")
- Modificar: `src/ui/ajustes/Boxes.test.tsx`
- Criar: `changelog.d/alterado-box-padrao-visivel.md`

**Interfaces:**
- Consome: `boxSelInicial(dados: Dados): BoxSelecionada`, de `src/state/store.ts`. Devolve a box que o app abre: a padrão válida, ou a primeira com saldo próprio.

Hoje, sem `config.boxPadraoId`, o app abre na primeira box com saldo, mas a lista de boxes mostra "Tornar padrão" em todas. A tela esconde qual é a efetiva.

- [ ] **Passo 1: Escrever o teste que falha**

Em `src/ui/ajustes/Boxes.test.tsx`:

```tsx
it('marca como padrão a box que o app abre, mesmo sem padrão gravado', async () => {
  const agora = agoraISO();
  for (const nome of ['ana', 'bruno']) {
    await repo.salvarBox({
      id: novoId(), nome, saldoInicial: 100000, dataSaldoInicial: '2026-01-01',
      criadoEm: agora, alteradoEm: agora,
    });
  }
  await useApp.getState().iniciar();

  render(<Boxes />);

  // Exatamente uma box é a padrão; a outra oferece "Tornar padrão".
  expect(await screen.findAllByText('padrão')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Tornar padrão' })).toHaveLength(1);
});

it('com uma única box com saldo, não oferece "Tornar padrão"', async () => {
  const agora = agoraISO();
  await repo.salvarBox({
    id: novoId(), nome: 'ana', saldoInicial: 100000, dataSaldoInicial: '2026-01-01',
    criadoEm: agora, alteradoEm: agora,
  });
  await useApp.getState().iniciar();

  render(<Boxes />);

  await screen.findByText('ana');
  expect(screen.queryByRole('button', { name: 'Tornar padrão' })).not.toBeInTheDocument();
});

it('o campo de nome da box não sugere nome de banco', async () => {
  await useApp.getState().iniciar();
  render(<Boxes />);
  expect(screen.getByPlaceholderText('ex.: Pessoal')).toBeInTheDocument();
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/ajustes/Boxes.test.tsx`
Expected: FAIL nos três testes novos.

- [ ] **Passo 3: Implementar**

Em `Boxes.tsx`: troque o import para `import { boxSelInicial, useApp } from '../../state/store';` (mantenha o que já é importado de lá). Dentro do componente `Boxes`, depois do `if (!dados) return null;`:

```tsx
  // A box que o app abre: a padrão gravada, ou a primeira com saldo próprio. Só há o que
  // escolher quando existem duas ou mais — o mesmo critério do selo "padrão" em Bancos.
  const comSaldo = dados.boxes.filter((b) => b.saldoInicial != null);
  const padraoEfetivoId = comSaldo.length >= 2 ? boxSelInicial(dados) : null;
```

Troque o bloco das linhas 192 a 196 por:

```tsx
              {padraoEfetivoId === b.id ? (
                <span className="badge">padrão</span>
              ) : b.saldoInicial != null && comSaldo.length >= 2 ? (
                <button className="botao" onClick={() => definirPadrao(b.id)}>Tornar padrão</button>
              ) : null}
```

Troque o placeholder da linha 141 para `placeholder="ex.: Pessoal"`.

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/ui/ajustes/Boxes.test.tsx`
Expected: PASS. Se um teste antigo procurava "Tornar padrão" com uma box só, ajuste-o para duas boxes e explique no commit.

- [ ] **Passo 5: Fragmento**

`changelog.d/alterado-box-padrao-visivel.md`:

```
- Ajustes, Boxes: a box que o app abre ganha o selo "padrão", mesmo sem você ter escolhido uma
- Ajustes, Boxes: o exemplo do campo de nome deixou de sugerir nome de banco
```

- [ ] **Passo 6: Suíte completa e commit**

Run: `npm test` — Expected: verde.

```bash
git add src/ui/ajustes/Boxes.tsx src/ui/ajustes/Boxes.test.tsx changelog.d/alterado-box-padrao-visivel.md
git commit -m "fix(boxes): mostra a box padrão efetiva e troca o exemplo do nome"
```

---

## Tarefa 3: VB-11 — Cartões diz em qual box o cartão será criado

**Arquivos:**
- Modificar: `src/ui/ajustes/Cartoes.tsx` (componente principal, depois do `<FormCartao>` de criação, ~linha 145-150)
- Modificar: `src/ui/ajustes/Cartoes.test.tsx`
- Criar: `changelog.d/alterado-cartao-aviso-box.md`

Bancos já diz "Será criado na box X." (`Bancos.tsx:142`). Cartões não diz. Mesmo conceito, mesmo texto.

- [ ] **Passo 1: Escrever o teste que falha**

```tsx
it('avisa em qual box o cartão será criado', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ hoje: '2026-07-01', boxSel: box.id });

  render(<Cartoes />);

  expect(await screen.findByText(`Será criado na box ${box.nome}.`)).toBeInTheDocument();
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx -t "avisa em qual box"`
Expected: FAIL (texto não encontrado).

- [ ] **Passo 3: Implementar**

No componente principal de `Cartoes.tsx` (o que tem `<h2>Novo cartão</h2>`), logo depois do `<FormCartao ... />` e ainda dentro do bloco `{!editandoId && (...)}`:

```tsx
          <p className="sub">Será criado na box {dados.boxes.find((b) => b.id === boxId)?.nome}.</p>
```

`boxId` já existe nesse componente (`boxIdEfetivo(dados, boxSel)`) e nunca é nulo nesse ponto (há um retorno antecipado acima). Se o TypeScript reclamar, use o mesmo `nomeBoxCriacao` que `Bancos.tsx:59` calcula.

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/ui/ajustes/Cartoes.test.tsx`
Expected: PASS.

- [ ] **Passo 5: Fragmento**

```
- Ajustes, Cartões: o formulário avisa em qual box o cartão será criado, como já faz o de Bancos
```

em `changelog.d/alterado-cartao-aviso-box.md`.

- [ ] **Passo 6: Suíte completa e commit**

Run: `npm test` — Expected: verde.

```bash
git add src/ui/ajustes/Cartoes.tsx src/ui/ajustes/Cartoes.test.tsx changelog.d/alterado-cartao-aviso-box.md
git commit -m "feat(cartoes): avisa em qual box o cartão será criado"
```

---

## Tarefa 4: VB-12 — confirmação "Lançado ✓" em verde

**Pré-requisito:** Tarefa 0 aprovada.

**Arquivos:**
- Modificar: `src/ui/TelaLancar.tsx:168`
- Modificar: `src/styles.css` (logo abaixo de `.aviso-urgente`, linha 195)
- Modificar: `src/ui/TelaLancar.test.tsx`
- Criar: `changelog.d/alterado-lancado-verde.md`

- [ ] **Passo 1: Achar as outras confirmações de sucesso**

Run: `grep -rn "✓" src/ui --include=*.tsx | grep -v "\.test\."`

Se outra tela mostra um "salvo" ou "feito" em `.aviso` âmbar, aplique a mesma classe nova nela. Mesma ideia, mesma cor.

- [ ] **Passo 2: Escrever o teste que falha**

Em `TelaLancar.test.tsx`, no teste que já confirma "Lançado ✓" (procure por `Lançado ✓`), acrescente a verificação de classe; se não houver, escreva um novo com o setup do primeiro teste:

```tsx
expect(await screen.findByText('Lançado ✓')).toHaveClass('aviso', 'aviso-sucesso');
```

- [ ] **Passo 3: Rodar e ver falhar**

Run: `npx vitest run src/ui/TelaLancar.test.tsx`
Expected: FAIL (`aviso-sucesso` ausente).

- [ ] **Passo 4: Implementar**

`src/styles.css`, logo depois da linha `.aviso-urgente { ... }`:

```css
.aviso-sucesso { background: var(--pos-bg); color: var(--pos); }
```

`TelaLancar.tsx:168`:

```tsx
      {salvo && <p className="aviso aviso-sucesso">Lançado ✓</p>}
```

Classe solta, não modificador composto: é o mesmo critério do `.aviso-urgente`, para o verificador de catálogo enxergá-la.

- [ ] **Passo 5: Deixar a linha do catálogo pronta**

Não edite `catalogo.md`. Cole no relatório final da tarefa:

```
| `.aviso-sucesso` | variante verde da `.aviso`, usada junto dela (`aviso aviso-sucesso`): `--pos-bg` e `--pos`. Confirmação de ação concluída ("Lançado ✓"). Classe solta, como `.aviso-urgente` |
```

- [ ] **Passo 6: Fragmento**

```
- Lançar: a confirmação "Lançado ✓" agora é verde, não âmbar
```

em `changelog.d/alterado-lancado-verde.md`.

- [ ] **Passo 7: Suíte completa e commit**

Run: `npm test` — Expected: verde. (O teste do catálogo só falha se `verificar-catalogo` rodar em modo estrito; ele roda no release, na Tarefa 10.)

```bash
git add src/styles.css src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx changelog.d/alterado-lancado-verde.md
git commit -m "fix(lancar): confirmação de lançamento em verde"
```

---

## Tarefa 5: VB-04 e VB-05 — Conferir por banco: botão de transferência e campos

**Pré-requisito:** Tarefa 0 aprovada. Use a opção de VB-04 que o usuário escolheu. O código abaixo é a opção A.

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx:222-231`
- Modificar: `src/styles.css` (logo abaixo de `.conferencia-bancos .linha-banco > span`, linha 568)
- Modificar: `src/ui/TelaHoje.test.tsx`
- Criar: `changelog.d/alterado-conferir-bancos.md`

- [ ] **Passo 1: Escrever o teste que falha**

Em `TelaHoje.test.tsx`, dentro do `describe` que define `comBoxESaldo` e `abrirAba` (conferência por banco), ao lado do teste "com bancos, mostra uma linha por banco":

```tsx
  it('o botão de transferir entre bancos tem texto visível', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await abrirAba('Conferir');

    const botao = screen.getByRole('button', { name: 'Transferir de Banco Um' });
    expect(botao).toHaveTextContent('Transferir');
    expect(botao).not.toHaveTextContent('↔');
  });
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx -t "texto visível"`
Expected: FAIL (o botão mostra `↔`).

- [ ] **Passo 3: Implementar o botão (VB-04)**

Em `TelaHoje.tsx`, troque o conteúdo do botão (linha 229) de `↔` para `Transferir`. Mantenha `aria-label={`Transferir de ${b.nome}`}`, `className="botao botao-sinal"` e o `onClick`.

- [ ] **Passo 4: Implementar o estilo do campo (VB-05)**

`CampoValor` só ganha estilo dentro de `.campo` (`styles.css:222`). Na linha de banco da conferência ele aparece sem estilo. Em `src/styles.css`, logo abaixo da linha `.conferencia-bancos .linha-banco > span { ... }`:

```css
.conferencia-bancos .linha-banco input {
  padding: 11px 12px; border: none; border-radius: 12px;
  background: var(--surface2); min-height: 44px;
}
```

Mesmos valores de `.campo input`. Não altere nada além desse bloco.

- [ ] **Passo 5: Rodar e ver passar**

Run: `npx vitest run src/ui/TelaHoje.test.tsx`
Expected: PASS. Testes antigos que procuravam o botão por `↔` precisam procurar por `name: /Transferir de/`.

- [ ] **Passo 6: Fragmento**

```
- Hoje, Conferir: o botão de transferir entre bancos agora diz "Transferir"
- Hoje, Conferir: os campos de saldo por banco têm o mesmo estilo dos outros campos
```

em `changelog.d/alterado-conferir-bancos.md`.

- [ ] **Passo 7: Suíte completa e commit**

Run: `npm test` — Expected: verde.

```bash
git add src/styles.css src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx changelog.d/alterado-conferir-bancos.md
git commit -m "fix(hoje): botão de transferir com texto e campos de saldo no estilo do app"
```

---

## Tarefa 6: VB-14 — respiro entre a legenda e a primeira linha de "Por categoria"

**Pré-requisito:** Tarefa 0 aprovada.

**Arquivos:**
- Modificar: `src/ui/TelaAnalises.tsx:186`
- Criar: `changelog.d/alterado-analises-respiro.md`

Layout puro: sem teste de unidade. A verificação é visual, na varredura da Tarefa 10.

- [ ] **Passo 1: Implementar**

Troque a linha 186:

```tsx
        <p className="sub" style={{ margin: '-4px 0 0' }}>
```

por:

```tsx
        <p className="sub" style={{ margin: '-4px 0 10px' }}>
```

`style` inline só de layout é permitido pelo guia (nível 1). Se outro card de Análises repete a combinação título + legenda + lista, aplique a mesma margem nele. Busque por `margin: '-4px 0 0'` em `src/ui/TelaAnalises.tsx`.

- [ ] **Passo 2: Fragmento**

```
- Análises: mais espaço entre a legenda das barras e a primeira categoria
```

em `changelog.d/alterado-analises-respiro.md`.

- [ ] **Passo 3: Suíte completa e commit**

Run: `npm test` — Expected: verde.

```bash
git add src/ui/TelaAnalises.tsx changelog.d/alterado-analises-respiro.md
git commit -m "fix(analises): respiro entre a legenda e a primeira categoria"
```

---

## Tarefa 7: VB-02 — botão desabilitado com aparência de desabilitado

**Pré-requisito:** Tarefa 0 aprovada.

**Arquivos:**
- Modificar: `src/styles.css` (logo abaixo de `.botao-perigo`, linha 104)
- Criar: `changelog.d/alterado-botao-desabilitado.md`

O texto de ajuda ("Escolha uma categoria.") **já existe** em `TelaLancar.tsx:88-93` e é deliberadamente mudo antes do primeiro dígito. Não mexa nele. Falta só o visual.

- [ ] **Passo 1: Listar todos os botões que ficam desabilitados**

Run: `grep -rn "disabled=" src/ui --include=*.tsx | grep -v "\.test\."`

A regra nova vale para todo `.botao`. Confira que nenhum desses botões depende de parecer ativo quando desabilitado.

- [ ] **Passo 2: Implementar**

`src/styles.css`, logo abaixo da linha `.botao-perigo { ... }`:

```css
.botao:disabled { opacity: .45; cursor: default; }
```

É o mesmo valor que `.importar-contagem:disabled` já usa (linha 655). Deixe aquela linha como está.

- [ ] **Passo 3: Fragmento**

```
- Botões desabilitados agora parecem desabilitados, em todas as telas
```

em `changelog.d/alterado-botao-desabilitado.md`.

- [ ] **Passo 4: Suíte completa e commit**

Run: `npm test` — Expected: verde.

```bash
git add src/styles.css changelog.d/alterado-botao-desabilitado.md
git commit -m "fix(estilo): botão desabilitado perde força visual"
```

---

## Tarefa 8: VB-01 — contraste do saldo verde (nível 6, decisão do usuário)

**Pré-requisito:** Tarefa 0 aprovada **e** o usuário ter escolhido um valor novo para `--total-pos`. Se ele mantiver `#008000`, **pule esta tarefa** e registre a decisão no `TODO.md`.

Mudar o valor de um token é nível 6 (`docs/estilo/nivel-6-mudar-linguagem.md`): exige spec nova e aprovada. O verde atual foi escolhido de propósito (spec `2026-07-18-cor-total-dia-fluxo-design.md`).

**Arquivos:**
- Modificar: `src/styles.css:7`
- Modificar: `docs/estilo/fundamentos.md:42`
- Criar: `docs/superpowers/specs/2026-09-30-contraste-saldo-verde-design.md`
- Modificar: `docs/superpowers/README.md` (linha da spec antiga: troque o status para `substituída` e acrescente a nova)
- Criar: `changelog.d/alterado-contraste-saldo-verde.md`

- [ ] **Passo 1: Medir o contraste do valor aprovado**

Troque `VERDE` pelo valor aprovado e rode:

```bash
node -e "
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const r=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return ((x+.05)/(y+.05)).toFixed(2)};
const VERDE='#2ee6a8';
console.log('sobre --surface', r(VERDE,'#1c2331'));
console.log('sobre --bg     ', r(VERDE,'#0b0d11'));
console.log('sobre --hoje-bg', r(VERDE,'#0d4a32'));
"
```

Expected: as três razões **≥ 4,5**. Para o valor atual (`#008000`) elas ficam abaixo de 3 sobre `--surface` e `--bg`. A razão sobre `--hoje-bg` é a mais difícil: a linha "hoje" tem fundo verde.

- [ ] **Passo 2: Escrever a spec curta**

`docs/superpowers/specs/2026-09-30-contraste-saldo-verde-design.md`, com a linha `Status: aprovada em AAAA-MM-DD — não implementada` logo abaixo do título (sem negrito). Cubra: o problema (contraste medido), o valor novo e as três razões, e que `--total-neg` não muda.

- [ ] **Passo 3: Implementar**

`src/styles.css:7`: troque só o valor de `--total-pos`. Não mexa em `--total-neg`.
`docs/estilo/fundamentos.md:42`: atualize o valor e o nome da cor ("verde-escuro" deixa de valer se o novo for claro).

- [ ] **Passo 4: Conferir os usos**

Run: `grep -rn "total-pos" src docs`
Todo uso continua válido. A explicação em `docs/estilo/catalogo.md:39` não cita o valor, só o token.

- [ ] **Passo 5: Fragmento, suíte e commit**

```
- Saldo positivo em verde mais claro, com contraste melhor sobre o fundo escuro
```

em `changelog.d/alterado-contraste-saldo-verde.md`. Run: `npm test` — Expected: verde.

```bash
git add src/styles.css docs changelog.d/alterado-contraste-saldo-verde.md
git commit -m "fix(estilo): saldo positivo com contraste legível (nível 6)"
```

---

## Tarefa 9: VB-09 e VB-10 — Simular sem tabela vazia

**Pré-requisito:** o branch `periodo-simular` já está na `main`. Ele reescreve `SimuladorFluxo.tsx` e `TabelaSimulacao.tsx`. Crie o worktree **depois** desse merge, a partir da `main` atualizada, e releia os dois arquivos antes de editar: os números de linha abaixo são de antes do merge.

**Arquivos:**
- Modificar: `src/ui/SimuladorFluxo.tsx` (onde `<TabelaSimulacao linhas={combinado} .../>` aparece, ~linha 82)
- Modificar: `src/ui/CenarioCard.tsx` (a seção "Impacto só deste cenário", ~linhas 133-138)
- Modificar: `src/ui/SimuladorFluxo.test.tsx`
- Criar: `changelog.d/alterado-simular-sem-tabela-vazia.md`

- [ ] **Passo 1: Escrever os testes que falham**

Em `SimuladorFluxo.test.tsx`, que já tem `preparar()` (box com saldo, hoje 15/09/2026):

```tsx
it('sem cenário ligado, não mostra a tabela de comparação', async () => {
  await preparar();

  render(<SimuladorFluxo />);

  expect(await screen.findByText(/Nenhum cenário ligado/)).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: /diferença/i })).not.toBeInTheDocument();
});

it('cenário sem itens não mostra a tabela de impacto', async () => {
  await preparar();
  const agora = agoraISO();
  await repo.salvarCenario({ id: novoId(), nome: 'Vazio', ligado: true, criadoEm: agora, alteradoEm: agora });
  await useApp.getState().recarregar();

  render(<SimuladorFluxo />);
  await userEvent.click(await screen.findByRole('button', { name: /Vazio/ }));

  expect(screen.getByText('Nenhum item ainda.')).toBeInTheDocument();
  expect(screen.queryByText('Impacto só deste cenário')).not.toBeInTheDocument();
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/SimuladorFluxo.test.tsx`
Expected: FAIL nos dois.

- [ ] **Passo 3: Implementar**

`SimuladorFluxo.tsx`: renderize `<TabelaSimulacao .../>` só quando `ligados.size > 0`. A frase "Nenhum cenário ligado: a tabela mostra só o saldo real." vira "Nenhum cenário ligado. Ligue um cenário para comparar com o saldo real."

`CenarioCard.tsx`: envolva a `<section aria-label="Impacto só deste cenário">` em `{itens.length > 0 && (...)}`.

Mantenha o resumo "saldo segue positivo…" onde estiver.

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/ui/SimuladorFluxo.test.tsx`
Expected: PASS.

- [ ] **Passo 5: Fragmento, suíte e commit**

```
- Simular: sem cenário ligado ou sem itens, a tabela de comparação não aparece mais vazia
```

em `changelog.d/alterado-simular-sem-tabela-vazia.md`. Run: `npm test` — Expected: verde.

```bash
git add src/ui changelog.d/alterado-simular-sem-tabela-vazia.md
git commit -m "fix(simular): esconde a tabela de comparação quando não há o que comparar"
```

---

## Tarefa 10: Integração, catálogo, dossiê, wiki e varredura

**Quando:** depois de todas as tarefas aprovadas terem terminado. Roda no worktree de integração, a partir da `main`.

- [ ] **Passo 1: Juntar os branches, um a um, na ordem das tarefas**

Depois de cada merge: `npm test`. Conflito em `src/styles.css` significa que alguém reformatou linha vizinha: resolva mantendo as duas edições.

- [ ] **Passo 2: Catálogo**

Cole em `docs/estilo/catalogo.md` a linha de `.aviso-sucesso` da Tarefa 4. Rode: `node scripts/verificar-catalogo.mjs` — Expected: sem avisos.

- [ ] **Passo 3: Dossiê**

Run: `npm run dossie`, depois `npm test`. Leia o diff de `docs/dossie/` com a skill `revisar-dossie`: o esperado é **nenhuma** mudança de comportamento de domínio.

- [ ] **Passo 4: Wiki**

A mudança altera o que o usuário vê? Sim em Boxes (selo "padrão"), Conferir ("Transferir") e Lançar (cor). Procure em `docs/wiki/` os capítulos que descrevem essas telas e ajuste só o que ficou errado. Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 5: Varredura com Playwright**

Na pasta de rascunho, com o app em `npx vite` numa porta própria, só em `localhost`, viewport 411 × 744 (Galaxy S25+), dados sintéticos pelo `repo.ts`. Cenário: duas boxes e a casa, como na varredura de origem. Confira, com captura de tela, um item por vez:

| ID | O que olhar |
|---|---|
| VB-01 | saldo verde legível no Fluxo (inclusive a linha "hoje"), em Conferir e no Simular |
| VB-02 | "Lançar" desabilitado visivelmente apagado; habilitado depois de valor e categoria |
| VB-03 | "Salário previsto" sem a segunda linha "Salário" |
| VB-04 | botão "Transferir" cabe na linha, também com nome de banco longo |
| VB-05 | campos de saldo por banco no mesmo estilo dos demais |
| VB-06 | exatamente uma box com "padrão" em Ajustes › Boxes |
| VB-09 | Simular sem cenário: sem tabela vazia |
| VB-10 | cenário sem itens: sem tabela de impacto |
| VB-11 | Ajustes › Cartões: "Será criado na box X." |
| VB-12 | "Lançado ✓" verde |
| VB-14 | espaço entre a legenda e a primeira categoria |
| VB-16 | campo de nome da box com "ex.: Pessoal" |

Envie as capturas ao usuário pelo chat. Encerre o `vite` pelo PID da porta antes de remover o worktree.

- [ ] **Passo 6: Release e deploy**

Siga a skill `ciclo-de-entrega`: merge na `main`, `npm run release -- patch`, push, `npm run deploy`. Antes de encerrar: `git -C <checkout principal> status --porcelain` deve vir vazio.

- [ ] **Passo 7: Atualizar o `TODO.md`**

Os itens VB-01 a VB-06, VB-09 a VB-12, VB-14 e VB-16 saem do backlog. VB-07, VB-08, VB-13 e VB-15 ficam registrados como "não é defeito", com o motivo da tabela acima.

---

## Tarefa 11: VB-04 — transferir entre bancos num botão abaixo da lista (novo desenho)

**Pré-requisito:** mockup novo aprovado pelo usuário. Esta tarefa não tem passos até lá.

**Pedido do usuário (2026-10-01):** deixar a parte de transferir num botão abaixo; quando a pessoa escolher os bancos, trazer o saldo de cada um; depois da transferência, mostrar o saldo de cada um.

**Pontos de partida no código:** `src/ui/TelaHoje.tsx` (`FormTransferencia`, `setTransferindoDe`, `onTransferir`), `repo.transferirEntreBancos(bancoOrigemId, bancoDestinoId, valorCent, data)` e `saldoCalculadoBanco` (`src/domain/bancos.ts`). Ao mexer em `FormTransferencia`, procure todas as telas que mostram o mesmo conceito (Fluxo mostra transferências, `transferenciaSel`).
