# Banco no lançamento

Data: 2026-09-30. Branch: `banco-no-lancamento`. Mockup aprovado em 2026-09-30.

Entrega 2 do item 12 do backlog ("Bancos na box"), reduzida: vínculo, banco padrão, saldo calculado e filtro. Projeção por banco e saldo inicial por banco ficam de fora.

## Objetivo

Hoje o lançamento comum pertence só à box. O saldo de cada banco é informado à mão. O usuário quer:

1. Vincular cada lançamento (ganho ou gasto) a um banco.
2. Ter um **banco padrão**, sempre pré-selecionado, que ele troca em cada lançamento.
3. Ver os lançamentos separados por banco.

## Decisões

| Tema | Decisão |
|---|---|
| Escopo | Vínculo + banco padrão + saldo calculado + filtro por banco. Sem projeção por banco. |
| Saldo do banco | Último saldo informado + lançamentos efetivos do banco com data **posterior** à data do saldo. |
| Fatura de cartão | Vai para o banco do cartão. Cartão sem banco usa o padrão. |
| Recorrência | Campo próprio. Os previstos herdam dele. |
| Histórico | Não é reclassificado. O que existe fica "sem banco". |
| Box com 0 ou 1 banco | O campo Banco e o filtro não aparecem. |
| Transferência | Continua criando as duas pernas com `bancoId`. Deixa de ajustar o saldo informado. |

## Modelo de dados

- `Lancamento.bancoId` (já existe, opcional) passa a valer para qualquer lançamento. O comentário em `types.ts` deixa de dizer "só em transferência".
- `Recorrencia.bancoId?: ID` é campo novo, opcional.
- `Banco.padrao?: boolean` é campo novo, opcional. Nenhum campo é índice: o filtro usa `.filter()`, como já é hoje. **Não há `this.version(n)` nova**, nem migração.

### Banco padrão

`bancoPadrao(bancos, boxId)` (em `src/domain/bancos.ts`) devolve o banco com `padrao === true` na box. Sem nenhum marcado, devolve o primeiro por `ordem` (`bancosDaBox`). Box sem bancos devolve `undefined`.

- O padrão é **derivado** quando ninguém o marcou. Quem já tem bancos ganha um padrão sem migração.
- `definirBancoPadrao(id)` (em `repo.ts`) marca o banco e desmarca os outros da mesma box, numa transação só.
- Excluir o banco padrão apaga a marca com ele. O próximo por `ordem` vira o padrão derivado.

### Regra de gravação

| Origem do lançamento | `bancoId` gravado |
|---|---|
| Manual (Lançar) | O banco escolhido. Pré-selecionado: o padrão. |
| Recorrência (previsto) | `Recorrencia.bancoId`. Sem valor na regra, o previsto fica sem banco. |
| Fatura de cartão (`origem: 'cartao'`) | `Cartao.bancoId`, ou o padrão da box. |
| Transferência | Como hoje: origem e destino. |
| Cenário | Segue a regra do tipo (manual ou recorrência). |

Só grava banco em lançamento `previsto` ou novo. Lançamento `efetivo` que já existe não muda sozinho. A sincronização de faturas (`sincronizarCartoes`) atualiza o `bancoId` dos previstos e dos novos, e nunca o das faturas já pagas.

## Saldo calculado do banco

`saldoCalculadoBanco(banco, lancamentos, categorias)` (em `src/domain/bancos.ts`), função pura:

- Sem `saldoDeclaradoCent`: devolve `null` ("saldo ainda não informado").
- Senão: `saldoDeclaradoCent` + soma de `efeitoNoSaldo(valor, tipo)` dos lançamentos com:
  - `bancoId === banco.id`;
  - `status === 'efetivo'`;
  - sem `cenarioId`;
  - `data > dataSaldoDeclarado` (a data do saldo é fim de dia: lançamento nesse dia já está no saldo informado).
- Lançamento sem banco não entra no saldo de nenhum banco.
- Compra no cartão só chega ao banco quando a fatura vira lançamento `efetivo`.

### Transferência e o saldo informado

`transferirEntreBancos` para de escrever `saldoDeclaradoCent` e `dataSaldoDeclarado` nos dois bancos. As pernas já contam pelo cálculo acima.

**Transferências antigas** já ajustaram o saldo informado e gravaram `dataSaldoDeclarado` igual à data da transferência. Como o cálculo só conta datas **posteriores**, as pernas antigas não contam duas vezes.

`excluirTransferencia` deixa de ter a ressalva "não desfaz o saldo": apagar as pernas já muda o saldo calculado. Só em transferência antiga o saldo informado continua sujeito ao ajuste manual.

## Telas

Todas usam classes e componentes que já existem (nível 1). Nenhuma classe nova, nenhum token novo.

### Campo Banco

Componente novo `SeletorBanco` (em `src/ui/`), fino: `SeletorPills` com rótulo "Banco", `bancos` e `selecionadaId`. Aparece com **2 ou mais** bancos na box. Se houver um só, o lançamento recebe esse banco sem mostrar o campo.

- **Lançar** (`TelaLancar.tsx`): entre a categoria e a data. Começa no padrão. Depois de lançar, volta ao padrão. O padrão vem de `bancoPadrao` na box do lançamento.
- **Editar lançamento** (`LancEditor.tsx`): mesma posição. Lançamento sem banco abre sem pílula marcada; salvar sem escolher mantém sem banco.
- **Recorrências** (`ajustes/Recorrencias.tsx`): mesmo campo. Regra sem banco abre com o padrão marcado.
- **Compra no cartão:** não muda. O banco vem do cartão.

Parcela de recorrência de cenário e transferência não ganham campo (somente leitura, como hoje).

### Ajustes → Bancos

- Selo `.badge` "padrão" ao lado do nome.
- Botão "Tornar padrão" em `.acoes`, nos bancos que não são o padrão.
- Saldo mostrado: o **calculado** (`saldoCalculadoBanco`), com a data do saldo informado na frase de apoio. Banco sem saldo informado mantém "saldo ainda não informado".
- Nota abaixo da lista explica a regra do saldo.
- O texto "Sem bancos, a conferência da tela Hoje..." não muda.

### Filtro por banco

`dadosDoBanco(dados, filtro)` (em `src/domain/bancos.ts`) devolve uma cópia de `Dados` com os lançamentos e as compras de cartão do filtro. `filtro` é `'todos' | 'sem-banco' | ID`. Compra de cartão conta no banco do cartão (ou no padrão).

- **Fluxo** (`TelaFluxo.tsx`): pílulas "Todos · cada banco · Sem banco" acima da lista. Cada lançamento mostra o banco numa linha `.sub`. Com filtro ativo, os saldos do dia e o gráfico **continuam sendo os da box inteira** (a projeção não é por banco), e a tela diz isso numa linha `.sub`.
- **Análises** (`TelaAnalises.tsx`): as mesmas pílulas, filtrando os agregados por `dadosDoBanco`.
- O filtro só aparece com 2 ou mais bancos. O estado do filtro vive no componente, não no store, e volta a "Todos" ao trocar de box.
- Um lançamento de transferência aparece nos dois filtros (uma perna em cada).

**Consistência entre telas.** O banco aparece do mesmo jeito onde há lançamento: linha `.sub` com o nome, ou "Sem banco". A lista de lançamentos da sheet `LancamentosSheet` e a `TransferenciaSheet` recebem a mesma linha. A conferência da Hoje não muda: continua comparando o total informado com o total do Flow.

## Backup

- `validarBackup` aceita os campos novos como opcionais e não os exige. Backup antigo, sem os campos, continua válido.
- `mesclar` já resolve por `alteradoEm`: `padrao` e `bancoId` seguem essa regra sem mudança de código. Um teste confirma.
- Um `bancoId` que aponta para banco inexistente (banco excluído, backup mesclado) é tratado como "sem banco" na exibição e no saldo. Nada é apagado.
- **Exclusão de banco** (`excluirBanco`) passa a tratar os lançamentos e recorrências que apontam para ele: o `bancoId` é removido, como já é feito com os cartões. Sem isso, o lançamento ficaria com referência morta.

## Pontos de chamada (para o plano)

O plano refaz esta lista por grep. Ponto de partida:

- **Escrita de lançamento:** `salvarLancamento`, `atualizarLancamento`, `materializarRecorrencia`, `sincronizarCartoes`, `transferirEntreBancos`, `converterCenarioEmReal`, e a gravação de itens de cenário em `FormItemCenario` (`gravarItemNovo`).
- **Exclusão:** `excluirBanco`, `excluirTransferencia`, `excluirLancamento`.
- **Leitura de saldo por banco:** `Bancos.tsx`, `TelaHoje.tsx` (conferência).
- **Backup:** `validarBackup`, `mesclar`, importação e restauração.
- **Dossiê:** `src/dossie/roteiro.ts` e `invariantes.ts` (novos invariantes: um só padrão por box; `excluirBanco` não deixa `bancoId` morto).

## Testes

- `bancoPadrao`: marcado, derivado, box sem banco, box com um banco.
- `saldoCalculadoBanco`: sem saldo informado; data igual à do saldo (fora); data posterior (dentro); previsto (fora); cenário (fora); ganho e gasto; estorno negativo; perna de transferência antiga no mesmo dia (fora).
- `dadosDoBanco`: cada valor do filtro; compra de cartão no banco do cartão; cartão sem banco.
- `definirBancoPadrao`: troca a marca e não deixa dois padrões.
- `excluirBanco`: limpa `bancoId` de lançamentos e recorrências.
- `sincronizarCartoes`: fatura prevista recebe o banco do cartão; fatura paga não muda; trocar o banco do cartão move só as previstas.
- Recorrência: previstos herdam o banco; mudar o banco da regra move os previstos.
- Transferência: não altera `saldoDeclaradoCent`; o saldo calculado dos dois bancos muda.
- Backup: arquivo sem os campos novos valida; `mesclar` mantém o mais recente.
- Interface: `SeletorBanco` some com 0 ou 1 banco; Lançar começa no padrão e volta a ele; filtro do Fluxo esconde os outros bancos.

## Docs e entrega

- `docs/dominio.md`: `Lancamento.bancoId` de uso geral, banco padrão, saldo calculado e a nova regra da transferência. Sai a frase "entrega 2, ainda aberta".
- `docs/wiki/`: capítulos de Bancos e de Lançar.
- `docs/estilo/catalogo.md`: entrada de `SeletorBanco.tsx`.
- Fragmento em `changelog.d/`, dados sintéticos.
- Varredura com Playwright, em 411 × 744, com dados sintéticos gravados por `repo.ts`.
- `TODO.md` (local): o item 12 passa a "parcial"; sobram saldo inicial por banco, projeção por banco e o alerta "N sem banco".

## Fora desta entrega

- Saldo inicial por banco e projeção por banco (linhas sobrepostas no gráfico).
- Alerta "N lançamentos sem banco" na Hoje.
- Reclassificar o histórico.
- Escolher o banco do lançamento importado (item 11).
- Conferência da Hoje mostrar o saldo calculado ao lado do informado.

## Riscos

- **Dado existente.** Nada é reescrito: o campo é opcional e o histórico fica sem banco. O risco está em `excluirBanco` e em `sincronizarCartoes`, cobertos por teste.
- **Saldo divergente.** Lançamentos sem banco não entram em nenhum saldo por banco. Quem não vincula o histórico vê o saldo calculado subir só com o movimento novo. É o comportamento pedido.
- **Filtro e saldo do dia.** Com filtro ativo, o saldo do dia continua sendo o da box. A linha `.sub` avisa. Se ficar confuso no uso, a saída é esconder o saldo do dia com o filtro ligado.
