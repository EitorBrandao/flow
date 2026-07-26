# Conceitos e modelo de dados

As entidades que tudo mais no app é construído em cima. Todas têm `id` e timestamps de criação/alteração.

## Box

Um fluxo de caixa com saldo próprio — nos exemplos desta documentação, `{{boxA}}` e `{{boxB}}`.

: `saldoInicial` | centavos; `null` = box sem saldo próprio
: `dataSaldoInicial` | dia a partir do qual o saldo é contado
: `saldoDeclaradoCent` / `dataSaldoDeclarado` | último saldo real do banco, informado manualmente na tela Hoje para conferência

A box **casa** é especial: `saldoInicial` é sempre `null`, ela não tem saldo próprio — só guarda lançamentos compartilhados. A visão consolidada da casa é **calculada pelo motor** — {{boxA}} + {{boxB}} + lançamentos da box casa —, nunca armazenada. Veja o capítulo Motor por baixo dos panos, seção Consolidação da casa.

## Categoria

Pertence a uma box. Tem `tipo` (`ganho` ou `gasto`), `ordem` (controla a posição nas listas e na grade de Lançar) e `arquivada`.

- "pix" existe duas vezes por box — uma como ganho, outra como gasto — o `tipo` resolve a ambiguidade.
- Arquivar some da tela Lançar e dos formulários, mas preserva o histórico de lançamentos já feitos com ela.

## Lançamento

O registro central do fluxo de caixa.

: `valor` | centavos, normalmente > 0 — o `tipo` da categoria decide se soma ou subtrai do saldo (negativo é aceito para estornos)
: `status` | `efetivo` ou `previsto`
: `origem` | `manual` · `recorrencia` · `cartao`
: `recorrenciaId` | presente quando o lançamento foi gerado por uma regra de recorrência
: `cenarioId` | presente quando é hipotético — nunca fica `efetivo`
: `cartaoId` / `faturaMes` | presentes quando é o lançamento-resumo de uma fatura de cartão

`efetivo` entra no saldo real; `previsto` só entra na projeção. Um previsto cuja data já passou vira um **pendente** — veja o capítulo Motor por baixo dos panos, seção Fronteira do hoje.

## Recorrência

Regra que gera lançamentos `previsto` automaticamente no futuro — salário, aluguel, empréstimos, assinaturas do Flow (fora do cartão).

: `diaDoMes` | 1–31, adaptado ao fim de meses curtos (ex.: dia 31 em fevereiro cai no último dia do mês)
: `parcelas` | número de ocorrências ou `null` = sem fim
: `ativa` | pausar não apaga a regra, só para de gerar novos previstos

**Materialização (a regra que evita bagunça)**

A cada boot e após qualquer mudança, o app recalcula as ocorrências esperadas de cada recorrência ativa e compara com os lançamentos já vinculados a ela:

- Ocorrências futuras que faltam → são criadas como `previsto`.
- Previstos que não correspondem mais a nenhuma ocorrência esperada (regra editada) → são apagados.
- Lançamentos com status `efetivo` **nunca são tocados**, mesmo que a regra mude depois.
- Uma ocorrência esperada no passado que o usuário já descartou **não ressuscita** — só se cria previsto para datas futuras (trade-off aceito para não reviver o que foi excluído de propósito).

## Cenário

Um "e se?" — lançamentos hipotéticos (pontuais ou parcelados) agrupados sob um nome, com um interruptor `ligado`.

- Só entra na projeção de saldo quando `ligado` — aparece como linha tracejada extra no gráfico do Fluxo e do Hoje.
- Lançamentos de cenário nunca ficam `efetivo`; não contam nas Análises nem nos totais mensais.
- **Tornar real** converte os lançamentos (ou a recorrência) do cenário em dados reais da box de origem.

## Configurações

Registro único de preferências do app.

: `boxPadraoId` | box que abre selecionada ao iniciar o app; só é válida se apontar para uma box com saldo próprio
: `horizonteProjecao` | até que dia o motor projeta o saldo (padrão: 31/12 do ano seguinte)
: `ultimoBackupEm` / `mudancasDesdeBackup` | controlam o aviso de backup atrasado na tela Hoje
