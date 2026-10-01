# A casa mostra de onde vem — design

Entrega A do item 34 do `TODO.md` (VB-18, VB-21, VB-25, VB-28, VB-30). Mockup aprovado em
2026-10-01.

## Problema

Com "casa" no topo, o app consolida todas as boxes. Quatro telas escondem a origem:

- **VB-18:** lançamentos e pendentes aparecem sem a box de origem.
- **VB-21:** o saldo da casa é um número só, sem a quebra por box.
- **VB-28:** a aba Cartão empilha uma fatura inteira por cartão.
- **VB-25 e VB-30:** o Lançar grava na box de nome `"casa"`, que não tem saldo próprio, e não
  pergunta quem pagou. O formulário só troca de box pelo seletor do topo.

## Decisões

- **Sem campo novo.** Nada muda em `src/db/` nem em `src/backup/`. Tudo é leitura, mais um
  campo de formulário.
- **A box é o "quem pagou".** Na casa, o Lançar pede uma box real (ana, bruno…) e grava nela.
  A box `"casa"` deixa de receber lançamento novo pelo Lançar. Os lançamentos que já existem
  nela ficam como estão.
- **Uma regra de exibição para todas as telas:** o nome da box aparece só quando a seleção do
  topo tem mais de uma box (`'casa'`). Numa box só, nenhuma tela muda.

## Mudanças

### 1. Selo da box (VB-18)

Componente novo `src/ui/SeloBox.tsx`: um `<span className="badge">` com o nome da box, com
`marginLeft: 6` (mesmo espaçamento do selo "estorno"). Entra ao lado da categoria em:

- Hoje → Pendentes (`TelaHoje.tsx`, fila);
- Fluxo → Lista (`TelaFluxo.tsx`, item de lançamento).

A busca do Fluxo passa a casar também pelo nome da box, na visão casa (mesmo critério de
"o que se vê, se busca"). O selo vem de `boxId` do lançamento. Só aparece com `boxSel ===
'casa'`.

### 2. Saldo por box (VB-21)

O card "Saldo hoje · casa" (`TelaHoje.tsx`, aba Visão) ganha, sob o total, uma linha por box:
nome em `.sub`, saldo em `strong.total-dia` com `classeSaldo`. Mesma cor e mesmo sinal do
total.

- O saldo de cada box vem de `projetarBoxes([boxId], …)`, no último dia `<= hoje`, com as
  mesmas entradas do total (cenários ligados incluídos).
- **Entram** as boxes da seleção com saldo próprio (`saldoInicial !== null`), mais a box
  `"casa"` só se tiver algum lançamento. A soma das linhas é igual ao total do card. Um teste
  garante isso.
- Numa box só, o card não muda.

### 3. Cartão, um por vez (VB-28)

`TelaCartao.tsx` mostra um seletor de cartão acima da fatura quando a seleção tem **2 ou mais
cartões ativos**. Mostra só a fatura do cartão escolhido.

- Rótulo da opção: `Nome do cartão · box` na visão casa; só o nome numa box só.
- O primeiro cartão vem escolhido. A escolha vive no estado da tela e cai para o primeiro se o
  cartão escolhido sair da seleção (troca de box no topo).
- O `<select>` usa `.campo` + `label` "Cartão", como os outros seletores.
- O `h2` com o nome do cartão, dentro da `barra-fixa`, continua: o seletor só decide qual
  `CartaoFatura` renderizar.

### 4. Lançar pede a box na casa (VB-25, VB-30)

`TelaLancar.tsx`: com `boxSel === 'casa'`, aparece o campo **Box** (`<select>`, primeiro do
formulário) com as boxes com saldo próprio — todas menos a `"casa"` e as sem saldo próprio — e a opção vazia "Escolha a box…".

- Sem box escolhida, o resto do formulário fica fora de cena e `oQueFalta` diz "Escolha a
  box." O botão Lançar fica desabilitado.
- A box escolhida substitui `boxIdEfetivo` como `boxId` do formulário. Categorias, bancos e
  banco padrão seguem a box escolhida. Trocar a box zera categoria e banco escolhidos.
- A linha "Lançando na box X" aparece com a box escolhida.
- Depois de lançar, a box escolhida **continua escolhida** (a pessoa costuma lançar vários
  gastos seguidos da mesma box). Trocar o seletor do topo para uma box real esconde o campo e
  usa a box do topo.
- O atalho dos frequentes (`rascunhoLancar`) já traz categoria; na casa, ele abre o formulário
  sem box escolhida, e a pessoa escolhe a box. A categoria some se não pertencer à box
  escolhida.
- Se não existir nenhuma box real, o campo mostra "Nenhuma box — crie em Ajustes → Boxes."

## Pontos de chamada

Grep feito para o que a mudança toca:

- `boxIdEfetivo`: `TelaLancar.tsx:59` é o único ponto que muda. `AdicionarSheet.tsx:38`
  (frequentes) não muda — a casa segue com a lista da box `"casa"`, e um chip frequente só
  preenche categoria e valor.
- Telas que mostram lançamento com a box agrupada: `TelaHoje` (fila), `TelaFluxo` (lista). A
  `LancamentosSheet` e as Análises ficam fora — a divergência delas é o VB-19, da entrega B.
- Nenhum caminho de exclusão, importação, backup ou pagamento muda.

## Consistência entre telas

O mesmo conceito — "de que box é este lançamento" — passa a aparecer do mesmo jeito (selo
`.badge` com o nome) nas duas telas que listam lançamentos. A Conferência de saldo já agrupa
por box com `.rotulo-grupo`; o saldo por box da Visão usa as mesmas cores e o mesmo sinal.

## Documentação e catálogo

- `docs/estilo/catalogo.md`: catalogar `SeloBox`.
- `docs/wiki/`: atualizar os capítulos de Hoje, Cartão e Lançar. Validar com
  `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- `changelog.d/`: três fragmentos `alterado-*.md` (casa mostra a box; Cartão com seletor;
  Lançar pede a box).
- `docs/dominio.md`: acrescentar que o Lançar não grava mais na box `"casa"` pela UI.
- `TODO.md` (local): VB-18, 21, 25, 28 e 30 saem do item 34 e vão para `TODO-CONCLUIDOS.md`.

## Testes

- `SeloBox`: renderiza o nome; box inexistente mostra "?".
- Fila de Hoje e lista do Fluxo: selo na casa, nenhum selo numa box só.
- Busca do Fluxo casa pelo nome da box só na casa.
- Saldo por box: soma das linhas = total; box `"casa"` sem lançamento não aparece; numa box só,
  sem linhas.
- Cartão: seletor com 2+ cartões; um cartão só, sem seletor; escolha cai para o primeiro quando
  o cartão sai da seleção.
- Lançar na casa: campo Box obrigatório, grava na box escolhida, nunca na `"casa"`; trocar a box
  zera categoria e banco; box continua escolhida depois de lançar; sem box real, aviso.
- Casos-limite: casa sem nenhuma box real; duas boxes com categorias de mesmo nome; lançamento
  antigo na box `"casa"` aparece com o selo "casa".
- Varredura com Playwright (Galaxy S25+), com duas boxes e a casa, dados sintéticos.

## Fora desta entrega

VB-19 e VB-20 (entrega B); VB-23 e VB-24 (entrega C). A Lista do Fluxo continua indo até o
fim do horizonte (VB-22).
