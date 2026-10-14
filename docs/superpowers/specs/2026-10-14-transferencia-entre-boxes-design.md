# Transferência entre boxes

Status: aprovada em 2026-10-14 — implementada

## Problema

A transferência entre bancos só move dinheiro dentro de uma box. A spec de 2026-09-16 deixou
a transferência entre boxes fora de escopo. Quem divide a casa em boxes (uma por pessoa) e
passa dinheiro de uma box para outra precisa lançar um gasto numa e um ganho na outra. Os
dois lançamentos entram em Análises como gasto e renda reais, e nada os liga.

## Decisões (mockup aprovado em 2026-10-14)

- **Entrada:** Hoje → Conferir, botão "Transferir entre boxes", depois da conferência. Aparece
  em qualquer visão (box ou casa) e em qualquer modo, desde que existam duas ou mais boxes com
  saldo próprio.
- **Box `casa`:** fica fora das opções (não tem saldo próprio), como no Lançar.
- **Banco:** cada ponta escolhe o banco quando a box tem bancos. Box sem bancos não mostra o
  seletor, e a perna não leva `bancoId`.
- **Análises:** a transferência não conta como ganho nem gasto (`origem: 'transferencia'`, já
  filtrada em `aggregations.ts`).
- **Saldo da casa:** não muda. A soma das duas pernas é zero.

## Solução

Reaproveita o modelo da transferência entre bancos: sem tipo novo, sem campo novo, sem
`version(n)` no Dexie, sem mudança no backup.

- `repo.transferirEntreBoxes(origem, destino, valorCent, data)` (`src/db/repo.ts`): `origem` e
  `destino` são `{ boxId, bancoId? }`. Numa transação, grava duas pernas `efetivo`, com
  `origem: 'transferencia'` e `transferenciaId` compartilhado. A saída (gasto) fica na box de
  origem, na categoria oculta de saída dela. A entrada (ganho) fica na box de destino, na
  categoria oculta de entrada dela. Cada box só cria a categoria da sua ponta. A nota é
  `"box · banco → box · banco"` (só o nome da box, sem banco) e vale nas duas pernas.
- Recusa: mesma box, valor ≤ 0, box inexistente ou sem saldo próprio, banco ausente numa box
  com bancos, banco informado numa box sem bancos, banco que não é da box.
- `TransferirEntreBoxes.tsx` (novo): botão e formulário embutido na aba Conferir. Mostra o
  saldo calculado de cada banco, um aviso de que o saldo da casa não muda, e o saldo antes e
  depois no fim.
- `TransferenciaSheet.tsx`: quando as pernas estão em boxes diferentes, mostra "Saiu de" e
  "Entrou em". O aviso de exclusão diz "um em cada box".
- `excluirTransferencia` não muda: apaga as duas pernas pelo `transferenciaId`.

## Desvios do mockup

- Não há pílulas "Entre bancos / Entre boxes" dentro do formulário. Os dois botões separados da
  tela 1 já escolhem o tipo, e as pílulas repetiriam essa escolha.
- O botão "Transferir entre boxes" fica depois da conferência, uma vez, em todas as variantes
  (um banco só, vários bancos, sem bancos, casa), em vez de só ao lado de "Transferir entre
  bancos".

## Risco conhecido

Excluir uma box apaga os lançamentos dela, mas não a perna da outra box. A perna órfã continua
contando no saldo da outra box e abre o `TransferenciaSheet` normalmente, que então só mostra
o valor. Apagar a perna órfã apaga só ela. Não há exclusão de box na UI de hoje que a trate
à parte, e apagar a perna da outra box em silêncio seria pior.

## Verificação

`npm test` e `npm run build`. Testes: `repo.test.ts` (`transferirEntreBoxes`),
`TransferirEntreBoxes.test.tsx` e `TransferenciaSheet.test.tsx`.
