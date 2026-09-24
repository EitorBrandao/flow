# Código e versão

O Flow é aberto: dá para ler o código que mexe no seu dinheiro.

- **Repositório:** [github.com/EitorBrandao/flow](https://github.com/EitorBrandao/flow) — código, documentação de domínio, guia de estilo e o histórico de mudanças.
- **App publicado:** [eitorbrandao.github.io/flow](https://eitorbrandao.github.io/flow/) — é este endereço que se instala como app no celular (menu do navegador → "Adicionar à tela inicial").
- **O que mudou em cada versão:** ⚙️ Ajustes → Versão, dentro do próprio app — ele lê o changelog do build que você está usando.

> Achou um erro, ou o app fez algo que esta documentação não explica? As **issues** do repositório são o lugar — e vale mandar junto o que você fez até o problema aparecer.

## Modelo de dados

Os dados ficam no IndexedDB do navegador, via a biblioteca Dexie. Toda entidade tem um `id` e guarda quando foi criada e alterada.

**Box**

: `saldoInicial` | centavos; `null` = box sem saldo próprio (caso da box casa)
: `dataSaldoInicial` | dia a partir do qual o saldo é contado
: `saldoDeclaradoCent` / `dataSaldoDeclarado` | último saldo informado na tela Hoje, para conferência

**Categoria**

: `tipo` | `ganho` ou `gasto`
: `ordem` | posição nas listas e na grade de Lançar
: `arquivada` | tira a categoria da tela Lançar e dos formulários, sem apagar o histórico

**Configurações**

: `boxPadraoId` | box que abre selecionada ao iniciar; só válida se apontar para uma box com saldo próprio
: `horizonteProjecao` | até que dia o motor projeta o saldo (padrão: 31/12 do ano seguinte)
: `ultimoBackupEm` / `mudancasDesdeBackup` | controlam o rodapé de backup da Visão, na tela Hoje

## Lançamentos: status e origem

: `valor` | centavos, normalmente positivo — o tipo da categoria decide se soma ou subtrai do saldo (negativo é aceito para estornos)
: `status` | `efetivo` ou `previsto`
: `origem` | `manual` · `recorrencia` · `cartao`
: `recorrenciaId` | presente quando o lançamento foi gerado por uma regra de recorrência
: `cenarioId` | presente quando é hipotético — nunca fica `efetivo`
: `cartaoId` / `faturaMes` | presentes quando é o lançamento-resumo de uma fatura de cartão

## Recorrências e materialização

: `diaDoMes` | 1–31, adaptado ao fim de meses curtos (dia 31 em fevereiro cai no último dia do mês)
: `parcelas` | número de ocorrências ou `null` = sem fim
: `ativa` | desativar não apaga a regra, só para de gerar novos previstos

**Materialização** é o nome interno do recálculo: a cada boot e após qualquer mudança, o app compara as ocorrências esperadas de cada recorrência ativa com os lançamentos já vinculados a ela.

- Ocorrências futuras que faltam → viram `previsto`.
- Previstos que não correspondem mais a nenhuma ocorrência esperada (regra editada) → são apagados.
- Lançamentos `efetivo` nunca são tocados, mesmo que a regra mude depois.
- Uma ocorrência esperada no passado que o usuário já descartou não ressuscita: só se cria previsto para datas futuras.

## Motor de projeção

`projetarBoxes(boxIds, dados)` é uma função pura que devolve, para cada dia entre o início das boxes selecionadas e o horizonte de projeção, três números:

: `saldoEfetivo` | soma apenas de lançamentos confirmados
: `saldoProjetado` | efetivo + previstos
: `saldoComCenarios` | projetado + lançamentos dos cenários ligados

## Cartão e fatura no código

: `Cartao` | um por box; `diaFechamento`, `diaVencimento` e a `categoriaFaturaId` (categoria de gasto da box que recebe o lançamento da fatura)
: `CategoriaCartao` | categorias próprias do cartão, separadas das categorias da box
: `CompraCartao` | `valorTotal`, `parcelas` (1 = à vista), `data` da compra, `descricao?`
: `RecorrenciaCartao` | uma assinatura — mesma lógica de materialização das recorrências do Flow, gerando `CompraCartao` futuras
: `ConferenciaFatura` | valor digitado a partir do app do banco, por cartão + mês, com a opção de usar esse valor no lugar da soma dos itens

A fatura nunca é uma entidade salva: é sempre recalculada a partir das compras e do ciclo de fechamento. A fatura que fecha em `F/M` contém compras de `F/(M−1)` até `(F−1)/M`, inclusive; a parcela 1 cai na fatura da data da compra, e a parcela k cai k−1 meses depois.

**Sincronização com o Flow:** para cada fatura com valor > 0, o app mantém um lançamento `previsto` na box do cartão, na categoria da fatura, com data = vencimento. O valor sincronizado é a soma dos itens, a menos que a conferência daquele mês tenha "usar valor do app" marcado.

- Lançamento já `efetivo` nunca é tocado nem recriado.
- Previsto descartado não ressuscita — um novo só é criado se o vencimento for depois de hoje.
- Um previsto já existente é atualizado ao vivo mesmo com vencimento no passado (é aí que ele vira pendente).
- Fatura que zera (ou cartão desativado) remove o previsto; lançamentos efetivos ficam intactos.

**Restante e parcelamento da fatura:** a sobra de um pagamento vira uma `CompraCartao` na categoria reservada "Parcelamento" do cartão (`categoriaParcelamentoId`, criada no primeiro uso). A data da compra é o fechamento da fatura paga, por isso ela cai na fatura seguinte.

- "Mês seguinte" grava uma parcela só, com a descrição "Restante da fatura de MM/AAAA".
- "Parcelei" grava as parcelas informadas, com a descrição "Parcelamento da fatura de MM/AAAA".
- O aviso de fatura fora do Fluxo e a folha de pagamento somam essas compras pela mesma regra (`jaLancadoDaFatura`), para nunca discordarem.
