# Bloquear cartão para novas compras

## Problema

Um cartão pode existir só para receber assinaturas (via `RecorrenciaCartao`), sem o usuário
nunca lançar uma compra avulsa nele. Hoje, toda vez que há 2 ou mais cartões `ativo`, o menu
Adicionar → "Compra no cartão" pergunta em qual cartão a compra entra — mesmo quando só um
deles é de uso real. Isso custa um clique a mais em toda compra.

O campo `Cartao.ativo` já existe, mas desliga tudo: `diffSincronizacao` (`src/domain/
fatura.ts:219`) para de gerar a fatura como lançamento `previsto`, o que quebraria a projeção
das assinaturas que o cartão deveria continuar cobrando.

## Solução

Novo campo, independente de `ativo`:

```ts
// src/domain/types.ts, dentro de Cartao
permiteCompra?: boolean; // undefined/true = permite; false = bloqueado p/ novas compras
```

`undefined` conta como `true` — cartões existentes não precisam de migração nem de backfill.

### Onde o campo entra

Só em `src/ui/AdicionarSheet.tsx`, na lista `cartoesAtivos` (linha 31):

```ts
return dados.cartoes.filter((c) => c.ativo && c.permiteCompra !== false && ids.includes(c.boxId));
```

Essa lista já alimenta:
- o pulo direto pro formulário quando resta 1 cartão (`rotearParaCompra`);
- a tela "Compra em qual cartão?" quando restam 2+;
- os chips de "Frequentes" que apontam para compra de cartão (via `cartaoIds` passado a
  `frequentes()`), porque eles herdam a mesma lista.

### Onde o campo NÃO entra

- `src/domain/fatura.ts` (`diffSincronizacao`) — a fatura do cartão continua sincronizada e
  virando lançamento `previsto`, normalmente.
- `sincronizarCartoes` / `materializarAssinatura` (`src/db/repo.ts`) — assinaturas do cartão
  continuam materializando compras.
- `src/ui/TelaCartao.tsx` — a fatura do cartão continua aparecendo lá.
- `src/ui/ajustes/Assinaturas.tsx` — o cartão continua disponível pra cadastrar uma assinatura
  nova (decisão explícita: bloquear compra avulsa não deve esconder o cartão de uma ação
  deliberada e rara).

### UI

Em Ajustes → Cartões (`src/ui/ajustes/Cartoes.tsx`), cada linha da lista ganha um segundo
botão, ao lado de "Ativar"/"Desativar":

- rótulo alterna entre **"Bloquear"** (quando `permiteCompra !== false`) e **"Permitir"**
  (quando `permiteCompra === false`) — uma palavra só, como "Ativar"/"Desativar", para não
  estourar a linha em tela estreita;
- ao clicar, chama `repo.salvarCartao({ ...c, permiteCompra: !permiteCompraAtual }, horizonte)`
  e `recarregar()`, no mesmo padrão de `alternarAtivo`.

Sem indicador visual novo (sem opacidade, sem badge): a dimensão de opacidade já é do `ativo`.
Misturar as duas confundiria "cartão desligado" com "cartão sem compra avulsa".

## Testes

- `src/ui/AdicionarSheet.test.tsx`: um cartão com `permiteCompra: false` não aparece na lista
  de escolha, nem é usado no pulo automático quando é o único cartão `ativo` da box.
- `src/ui/ajustes/Cartoes.test.tsx`: o botão alterna `permiteCompra` e persiste via
  `repo.salvarCartao`; cartão sem o campo (`undefined`) se comporta como `permiteCompra: true`.

## Fora de escopo

- Qualquer mudança em `ativo`, `diffSincronizacao`, `materializarAssinatura` ou na tela de
  Assinaturas.
- Migração de dados: o campo é opcional e Dexie não precisa de nova versão para um campo não
  indexado (`cartoes: 'id, boxId'` em `src/db/database.ts`).
- Indicador visual do novo estado na lista de cartões.
