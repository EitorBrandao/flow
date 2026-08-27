# Confirmar pendente com outro valor — design

**Data:** 2026-08-27
**Item do backlog:** 6 (parcial desde a v0.17.0)

## Problema

A fila de Pendentes da tela Hoje confirma um previsto com um toque. O valor que ela grava é o
valor previsto, sempre. Mas o valor previsto é uma estimativa: a recorrência diz R$ 120 e a
conta de luz veio R$ 137.

Hoje só há dois caminhos, e os dois são ruins:

- confirmar o valor errado e depois caçar o lançamento na aba Fluxo para corrigir;
- descartar o previsto e lançar tudo de novo na aba Lançar.

A fatura de cartão já escapou disso na v0.17.0: `ehFatura(l)` (`src/ui/TelaHoje.tsx:26`) troca
o botão "Descartar" por "Paguei outro valor", que abre a `PagamentoFaturaSheet`. O previsto
comum ficou de fora — e ele é o caso mais frequente do app.

## O que este design entrega

O valor de um previsto comum, na fila de Pendentes, passa a ser tocável. O toque abre a
correção dentro do próprio item: dois campos, valor e data, mais "✓ Confirmar" e "Cancelar".
Confirmar grava o lançamento como `efetivo` com o valor e a data corrigidos, num gesto só.

## O que fica de fora, por decisão

- **A recorrência não muda.** Corrigir uma ocorrência não altera a recorrência que a gerou,
  nem oferece alterá-la. Uma conta variável varia todo mês; propor mudar o padrão a cada
  confirmação vira ruído no gesto mais repetido do app. Quem quer mudar o padrão vai em
  Ajustes → Recorrências, que já faz isso.
- **A fatura de cartão não muda em nada.** Continua com "✓ Confirmar" e "Paguei outro valor",
  e o valor dela não fica tocável. A folha de parcelamento resolve um problema maior — pagar
  parte e parcelar o resto — e o rótulo do botão é o que ensina o gesto. Uniformizar os dois
  casos custaria mais do que rende.
- **Sem edição de categoria, box ou nota.** Isso é o `LancEditor`, que já existe e continua
  sendo o caminho para uma correção de verdade.

## Interação

Estado de repouso — igual ao de hoje, com o valor recebendo afordância de campo editável:

```
┌─────────────────────────────┐
│ luz        [R$ 120] │  ← tocável
│ 27/08 · Vivo                │
│ [✓ Confirmar] [Descartar]   │
└─────────────────────────────┘
```

Depois do toque no valor:

```
┌─────────────────────────────┐
│ luz                    │
│ 27/08 · Vivo                │
│ Valor  [R$ 137]          │
│ Data   [27/08/2026]         │
│ [✓ Confirmar] [Cancelar]    │
└─────────────────────────────┘
```

Regras da interação:

- **Um item por vez.** Abrir a correção de um item fecha a de outro.
- **Cancelar não grava nada** e devolve o item ao repouso, com o valor previsto intacto.
- **Confirmar** grava `status: 'efetivo'` com o valor e a data dos campos, e o item sai da
  fila — pela mesma animação de saída que o "✓ Confirmar" de hoje já tem (`AnimatePresence`).
- **Descartar** não aparece no modo de correção: quem abriu os campos quer confirmar.

## Descoberta do gesto

Um valor tocável não se anuncia sozinho. Esse é o custo conhecido da escolha, e ele se paga em
três lugares, nenhum deles um botão a mais:

1. **Afordância visual.** O valor no modo repouso ganha marca de campo editável — sublinhado
   pontilhado discreto, na cor do próprio valor. Não existe classe assim hoje
   (`grep` em `src/styles.css` não acha nada de `editavel`), então nasce uma classe nova:
   **edição de nível 2** (`docs/estilo/nivel-2-nova-classe.md`), com registro obrigatório em
   `docs/estilo/catalogo.md`.
2. **Rótulo acessível.** O elemento é um `<button>` de verdade, com
   `aria-label="Corrigir valor de {categoria}"` — leitor de tela e navegação por teclado
   alcançam o gesto sem depender da pista visual.
3. **Wiki.** O capítulo da wiki que descreve a fila de Pendentes ganha a frase que ensina o
   gesto. Mudança visível ao usuário ⇒ `docs/wiki/` no mesmo branch, e fragmento em
   `changelog.d/`.

## Camadas

### `src/db/repo.ts`

`confirmarPendente(id, valorReal?)` já existe e já grava o valor corrigido — a assinatura está
lá desde antes, e nenhuma tela usava o segundo parâmetro. Ela ganha a data:

```ts
confirmarPendente(id, valorReal?, dataReal?)
```

Ambos opcionais, ambos aplicados só quando vierem. `atualizarLancamento` faz o resto. Nada
mais muda na persistência: sem tabela nova, sem versão nova do schema Dexie, sem migração.

### `src/ui/TelaHoje.tsx`

- Estado local `corrigindo: string | null` — o id do item aberto, ou nenhum.
- Estado local dos dois campos, semeado com o valor e a data do previsto ao abrir.
- Reusa `CampoValor` e `CampoData`, os mesmos componentes que a folha da fatura usa. **Nenhum
  componente novo.**
- O valor tocável só é renderizado como botão quando `!ehFatura(l)`.

### Sinal do valor

`Lancamento.valor` é centavos, normalmente positivo; o sinal negativo existe e vale estorno
(`src/domain/types.ts:44`). `CampoValor` edita magnitude, sem sinal.

Por isso: **o campo edita a magnitude e a gravação reaplica o sinal do previsto original.** Um
previsto de −R$ 40 corrigido para 50 grava −R$ 50, nunca +R$ 50. Trocar o sinal continua sendo
trabalho do `LancEditor`, que tem o botão `+/−`.

## Testes

Em `src/ui/TelaHoje.test.tsx`:

1. Tocar no valor de um previsto comum abre os campos de valor e data.
2. Confirmar com valor diferente grava `efetivo` com o valor novo, e o item sai da fila.
3. Confirmar com data diferente grava a data nova.
4. Cancelar fecha os campos e não grava nada — o previsto continua `previsto`, com o valor
   antigo.
5. Abrir a correção de um segundo item fecha a do primeiro.
6. Um previsto de fatura não tem o valor tocável e continua com "Paguei outro valor".
7. Um previsto com valor negativo corrigido continua negativo.

## Riscos

- **Toque acidental no valor.** O item da fila fica com mais uma área tocável, num alvo que
  antes era só texto. Mitigação: "Cancelar" não grava nada, então o pior caso é um toque
  perdido. O alvo respeita o tamanho mínimo de toque de `docs/estilo/transversais.md`.
- **O gesto passar despercebido.** Tratado na seção de descoberta. Se depois do uso real ele
  continuar invisível, o caminho de saída é a primeira opção descartada: um terceiro botão
  "Outro valor", explícito, quebrando linha no slot `.acoes`.
