# Transferência entre bancos

## Problema

O usuário recebe o salário no Bradesco e move parte dele para o Nubank (gasto do dia a dia)
e parte para o Santander (reserva). Hoje, para refletir isso no Flow, ele edita o saldo de
cada banco à mão em Ajustes → Bancos (`src/ui/ajustes/Bancos.tsx`) ou na conferência da Hoje
(`ConferenciaBancos`, `src/ui/TelaHoje.tsx`) — dois números digitados por conta, sem relação
entre si. Nada registra que os dois ajustes vieram do mesmo movimento, e nada aparece no
Fluxo de caixa: a redistribuição de dinheiro entre contas do próprio usuário some do
histórico.

`Banco` (`src/domain/types.ts`) guarda só um saldo declarado pelo usuário — não calculado a
partir de lançamento. `bancoId` ainda não existe em `Lancamento`; isso é a entrega 2, ainda
aberta, do item 12 do backlog (`TODO.md`). Esta funcionalidade não depende da entrega 2
inteira: usa só um `bancoId` opcional, carimbado apenas nos lançamentos que ela mesma cria.

## Escopo

Transferência **só entre bancos da mesma box** (decisão do usuário, 2026-09-16). Mover
dinheiro entre boxes — pessoas diferentes — fica fora: outra funcionalidade, se um dia fizer
falta.

## Solução

### Duas categorias ocultas por box (`Box`, `src/domain/types.ts`)

```ts
export interface Box extends Entidade {
  // ...campos existentes
  categoriaTransferenciaSaidaId?: ID;
  categoriaTransferenciaEntradaId?: ID;
}
```

Opcionais, sem índice — mesmo padrão de `Cartao.bancoId`. Nascem sob demanda, na primeira
transferência da box (mesmo idioma de `Cartao.categoriaAssinaturasId`/
`categoriaParcelamentoId`).

**Por que duas categorias, e não uma:** no Fluxo, a cor e o sinal de um lançamento vêm do
`tipo` da sua categoria, não do sinal de `Lancamento.valor` (`tipoCat`, `TelaFluxo.tsx`;
mesma leitura em `projetarBoxes`, `src/domain/projection.ts:53-54`). Uma perna de saída e uma
de entrada com a mesma categoria apareceriam com a mesma cor. Duas categorias — uma `gasto`,
uma `ganho`, ambas de nome "Transferência" — corrigem isso sem mexer no motor de projeção.

Dentro da mesma box, a soma das duas pernas é sempre zero: a transferência não muda o saldo
projetado da box, só redistribui de onde ele vem.

### `Lancamento` ganha dois campos (`src/domain/types.ts`)

```ts
export interface Lancamento extends Entidade {
  // ...campos existentes
  bancoId?: ID;          // qual banco esta perna afeta
  transferenciaId?: ID;  // liga as duas pernas do mesmo movimento
}
```

Opcionais, sem índice. `bancoId` aqui é estritamente menor que a entrega 2: só os lançamentos
que esta funcionalidade cria carregam o campo. Nada mais no app passa a exigi-lo, e a fila de
Pendentes, a projeção e o resto do Fluxo continuam ignorando-o.

### Novo `OrigemLancamento`: `'transferencia'`

```ts
export type OrigemLancamento = 'manual' | 'recorrencia' | 'cartao' | 'transferencia';
```

Sinaliza os dois lançamentos de uma transferência de forma inequívoca, sem depender de casar
`categoriaId` — usado para excluir de Análises (abaixo) e para o Fluxo abrir o sheet certo ao
clicar.

### Domínio puro (`src/domain/transferencia.ts`, novo)

```ts
export function categoriasTransferenciaIds(boxes: Box[]): Set<ID>
```

Mesma forma de `categoriasFaturaIds` (`src/domain/fatura.ts`). Usada para esconder as duas
categorias de todo seletor manual de categoria: `TelaLancar.tsx`, `LancEditor.tsx`,
`TelaSimulador.tsx`, `src/state/store.ts` (`categoriasVisiveis`), `ajustes/Categorias.tsx` e
`ajustes/Recorrencias.tsx` — os mesmos seis lugares que já filtram
`categoriasFaturaIds`.

### `repo.transferirEntreBancos` (`src/db/repo.ts`, novo)

```ts
export async function transferirEntreBancos(
  bancoOrigemId: ID, bancoDestinoId: ID, valorCent: number, data: ISODate, nota?: string,
): Promise<void>
```

Dentro de uma transação (`db.bancos`, `db.categorias`, `db.boxes`, `db.lancamentos`,
`db.config`):

1. Carrega os dois bancos; recusa se `bancoOrigemId === bancoDestinoId`, se `boxId`
   divergir, ou se `valorCent <= 0` — mesma disciplina de guarda silenciosa evitada que o
   resto do app já segue (ex.: `criar()` em `Bancos.tsx`).
2. Garante as duas categorias ocultas da box, criando-as se `categoriaTransferenciaSaidaId`/
   `EntradaId` ainda forem `undefined`.
3. Grava dois lançamentos com `novoId()` para `transferenciaId` compartilhado, `status:
   'efetivo'`, `origem: 'transferencia'`, `data`, `valor: valorCent`, nota
   `"<banco origem> → <banco destino>"` nos dois:
   - saída: `boxId`, `categoriaId: categoriaTransferenciaSaidaId`, `bancoId: bancoOrigemId`.
   - entrada: `boxId`, `categoriaId: categoriaTransferenciaEntradaId`, `bancoId:
     bancoDestinoId`.
4. Atualiza `saldoDeclaradoCent` dos dois bancos (`(atual ?? 0) ∓ valorCent`) e
   `dataSaldoDeclarado: data` nos dois — o mesmo efeito de editar os dois bancos à mão em
   Ajustes → Bancos, feito numa tacada.
5. `marcarMudanca()`.

`excluirTransferencia(transferenciaId: ID)` apaga os dois lançamentos que compartilham o id
— não toca em `saldoDeclaradoCent`. Reverter o número exigiria saber se o banco já foi
conferido de novo depois, e adivinhar isso é pior que não tentar. O aviso de que apagar não
desfaz o saldo mora na UI (abaixo), não no repositório.

### UI: botão ↔ na Hoje → Conferir (opção 3 do mockup aprovado)

`ConferenciaBancos` (`TelaHoje.tsx`) ganha um botão "↔" em cada linha de banco, visível só
quando a box (ou o grupo, na visão `casa`) tem **dois ou mais bancos** — com um banco só não
há para onde transferir. Clicar abre um formulário curto embutido, no espírito do mockup
aprovado:

- **Para**: os demais bancos do mesmo grupo (mesma box).
- **Valor**: `CampoValor`.
- **Data**: `CampoData`, padrão `hoje`.
- Botão "Confirmar transferência" chama `repo.transferirEntreBancos` e depois `recarregar()`
  — os saldos exibidos na própria conferência já vêm atualizados, sem passo extra.

Essa ação é independente do botão "Salvar conferência dos bancos": transferir aplica na hora,
sem esperar o usuário salvar a conferência manual. As duas ações mexem no mesmo dado
(`saldoDeclaradoCent`) por caminhos diferentes, e cada uma o atualiza no seu próprio clique.

### UI: aparecer no Fluxo, ficar fora de Análises

Sem mudança no agrupamento por dia do Fluxo (`TelaFluxo.tsx`): os dois lançamentos aparecem
como qualquer outro, rotulados "Transferência" (nome da categoria), com a nota "Bradesco →
Nubank" embaixo, coloridos certo (saída em vermelho, entrada em verde) pelo `tipo` de cada
categoria oculta.

Em `aggregations.ts`, a função `filtrar()` ganha `&& l.origem !== 'transferencia'`, ao lado do
`!l.cenarioId` que já existe. Transferência não é renda nem despesa real — contá-la infla
`totalGanhos` e `totalGastos` ao mesmo tempo, mesmo o saldo líquido batendo.

### UI: sheet de detalhe (`TransferenciaSheet.tsx`, novo)

Clicar num lançamento de transferência no Fluxo abre este sheet em vez do editor genérico de
lançamento (mesmo padrão de `PagamentoFaturaSheetModal` para fatura de cartão,
`TelaFluxo.tsx:190`). Mostra banco de origem, banco de destino, valor e data; não é editável
— editar só uma perna quebraria o par. Um botão "Excluir transferência" chama
`repo.excluirTransferencia`, com aviso explícito: "isto não desfaz o ajuste de saldo nos
bancos — corrija em Ajustes → Bancos se precisar."

## Estilo

Toca UI existente (nível 1: nova seção em `ConferenciaBancos`) e cria um sheet novo (nível 4,
componente novo — catalogar em `docs/estilo/catalogo.md`). Ler `docs/estilo-visual.md` e os
capítulos correspondentes antes do código. Mockup das opções de local já aprovado nesta
sessão (Hoje → Conferir, com o formulário embutido por linha); o sheet de detalhe ainda
precisa de mockup próprio antes de codar, por ser componente novo.

## Verificação

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Testes que este desenho exige por regra, não por gosto:

- `repo.transferirEntreBancos`: cria as duas categorias ocultas na primeira vez e reaproveita
  nas seguintes; grava os dois lançamentos com `transferenciaId` compartilhado e `bancoId`
  correto em cada um; atualiza os dois `saldoDeclaradoCent` corretamente, inclusive quando um
  dos dois começa `null`; recusa origem igual a destino e boxes diferentes.
- `repo.excluirTransferencia`: apaga as duas pernas e só as duas; não toca em
  `saldoDeclaradoCent`.
- `categoriasTransferenciaIds`: mesmo formato de teste de `categoriasFaturaIds`.
- `aggregations.ts`: um mês com lançamento `origem: 'transferencia'` não aparece em
  `totalGanhos` nem em `totalGastos`, mas apareceria em `projetarBoxes` (o Fluxo mostra, a
  Análise não conta).
- `TelaFluxo`: lançamento de transferência abre `TransferenciaSheet`, não o editor genérico.
- Backup: os campos novos (`Box.categoriaTransferenciaSaidaId/EntradaId`,
  `Lancamento.bancoId/transferenciaId`) sobrevivem a exportar e reimportar — sem exigir novo
  número de schema de backup, por serem aditivos e opcionais (mesmo raciocínio de
  `Cartao.bancoId` na entrega 1 de bancos).

No celular, depois do deploy: cadastrar dois bancos numa box (se ainda não houver), transferir
um valor entre eles pela Hoje → Conferir, conferir que os dois saldos mudaram, que a
transferência aparece no Fluxo do dia certo, colorida certo, e que **não** aparece nos totais
de Análises do mês. Depois, abrir o lançamento no Fluxo, conferir o sheet de detalhe, e testar
excluir.

## Fora de escopo

- Transferência entre bancos de boxes diferentes.
- Editar uma transferência já feita — só excluir e refazer.
- Reverter `saldoDeclaradoCent` automaticamente ao excluir uma transferência.
- Qualquer coisa da entrega 2 do item 12 (`bancoId` genérico em todo lançamento manual,
  alerta de "sem banco", banco padrão, saldo inicial e projeção por banco). Esta
  funcionalidade usa `bancoId` só nos lançamentos que ela mesma gera.
