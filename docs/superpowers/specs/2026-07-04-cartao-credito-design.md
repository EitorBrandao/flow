# Flow — Aba Cartão de Crédito

**Data:** 2026-07-04
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Contexto e objetivo

Hoje o cartão de crédito entra no Flow como um lançamento único por fatura, digitado à mão
na categoria "cartão" de cada box. O objetivo é itemizar os gastos do cartão numa aba
própria: cada compra é registrada individualmente, e a soma da fatura vira **um único
lançamento no Flow** no dia do vencimento — preservando o modelo do fluxo de caixa.

### Requisitos confirmados

- **Um cartão por box** (eitor e Ju), cada um com dia de fechamento e dia de vencimento.
- **Agrupamento automático por ciclo de fechamento**: a data da compra determina em qual
  fatura ela cai.
- **Parcelamento é essencial**: compra em N parcelas, cada parcela na fatura do mês certo.
- **Categorias próprias do cartão** (mercado, restaurante, assinatura…), separadas das
  categorias do Flow.
- **Assinaturas** (gastos recorrentes no cartão) geram item na fatura de cada mês
  automaticamente.
- **Fatura → Flow**: lançamento `previsto` mantido automaticamente no dia do vencimento com
  a soma da fatura, atualizado ao vivo; no vencimento cai na fila de pendentes e é
  confirmado como qualquer pendente (valor ajustável na confirmação).
- **Conferência com o app do banco**: campo manual na tela da fatura para digitar o valor
  que o app do banco mostra; a tela exibe a diferença ("quanto falta bater") entre esse
  valor e a soma dos itens. O valor manual **não substitui a soma** no Flow, a menos que o
  usuário marque uma caixa de seleção na tela da fatura.
- **Aba "Cartão" nova na barra inferior** (a barra passa a ter 6 itens).

## Decisão de arquitetura: fatura derivada

A fatura **não é uma entidade armazenada**. Armazenamos só cartões, compras, categorias do
cartão e assinaturas; as faturas de cada mês são calculadas por função pura a partir das
compras e do ciclo do cartão (mesmo padrão do motor de projeção e da materialização de
recorrências: dados mínimos + cálculo puro + sincronização disciplinada).

Alternativas descartadas:

- *Fatura como entidade armazenada* (status aberta/fechada/paga, itens congelados): muito
  mais estado para manter consistente — a classe de bug que mais custou no v1.
- *Cartão como "box especial"* reusando `Lancamento`/`Categoria`: espalharia casos
  especiais pelo motor de projeção e agregações; parcelamento não cabe em `Lancamento`.

## Modelo de dados

Quatro entidades novas, todas com `id` + timestamps (`Entidade`):

### Cartao
- `boxId` — box dona do cartão (um cartão ativo por box)
- `nome` (ex.: "Nubank")
- `diaFechamento` (1–31, clampado ao fim do mês)
- `diaVencimento` (1–31, clampado)
- `categoriaFaturaId` — categoria de **gasto do Flow** que recebe o lançamento da fatura
  (padrão: a categoria "cartão" já existente da box)
- `ativo` (bool)

### CategoriaCartao
- `cartaoId`, `nome`, `ordem`, `arquivada` — espelha `Categoria` (que pertence a uma box).

### CompraCartao
- `cartaoId`, `categoriaCartaoId`
- `data` (ISODate, data da compra)
- `valorTotal` (centavos, > 0)
- `parcelas` (inteiro ≥ 1; 1 = à vista)
- `descricao?`
- `recorrenciaCartaoId?` — vínculo com a assinatura que a gerou

### RecorrenciaCartao (assinaturas)
- `cartaoId`, `categoriaCartaoId`, `valor`, `dataInicio`, `diaDoMes`,
  `parcelas` (número ou null = sem fim), `descricao?`, `ativa`
- Materializa `CompraCartao` futuras até o horizonte de projeção, reaproveitando a lógica
  de `ocorrencias`/`materializar` de `src/domain/recurrence.ts` — incluindo a regra de não
  ressuscitar compra excluída pelo usuário.

### ConferenciaFatura
Valor de conferência digitado a partir do app do banco, por fatura (mesmo espírito do
`saldoDeclaradoCent` das boxes). No máximo um registro por `cartaoId` + `mes`.
- `cartaoId`, `mes` (`'AAAA-MM'` do vencimento — a chave da fatura)
- `valorAppCent` (centavos; o valor mostrado no app do banco)
- `usarValorApp` (bool, padrão falso) — quando marcado, o lançamento da fatura no Flow usa
  este valor no lugar da soma dos itens

`Dados` ganha os arrays `cartoes`, `categoriasCartao`, `comprasCartao`,
`recorrenciasCartao` e `conferenciasFatura`.

### Mudanças em `Lancamento`
- `origem` ganha o valor `'cartao'`.
- Campos novos opcionais: `cartaoId?: ID` e `faturaMes?: string` (`'AAAA-MM'` do mês de
  vencimento) — identificação estável do vínculo lançamento↔fatura, que sobrevive a
  mudança do dia de vencimento.

## Regras do ciclo da fatura

1. **Compra no dia do fechamento entra na fatura seguinte** (comportamento Nubank).
   A fatura que fecha em `F/M` contém compras de `F/(M−1)` até `(F−1)/M`, inclusive.
2. **Vencimento:** se `diaVencimento > diaFechamento`, a fatura vence no mesmo mês do
   fechamento; senão, no mês seguinte.
3. **Parcelas ao centavo:** o valor total é dividido em N parcelas inteiras em centavos;
   o resto da divisão vai na primeira parcela (ex.: R$ 100,00 em 3x → 33,34 + 33,33 +
   33,33). Parcela 1 cai na fatura da data da compra; parcela k cai k−1 meses depois.
4. **Fronteira rígida:** compras do cartão **nunca** entram no motor de projeção — só o
   lançamento da fatura entra no Flow. Sem contagem dupla por construção.

## Motor de fatura (`src/domain/fatura.ts`)

Função pura `calcularFaturas(cartao, compras, ate)` → lista de faturas:

```
{ mes: 'AAAA-MM',            // mês do vencimento (chave da fatura)
  dataFechamento: ISODate,
  dataVencimento: ISODate,
  itens: [{ compraId, parcela, totalParcelas, valorCent,
            data, categoriaCartaoId, descricao? }],
  totalCent: number }
```

Sem estado próprio; recalcula a cada mudança. Editar uma compra reflete em todas as
faturas na hora. Faturas passadas são recalculáveis, não congeladas: mudar o dia de
fechamento reagrupa o detalhamento histórico, mas os lançamentos já confirmados no Flow
não mudam — o histórico financeiro fica intacto, só a "explicação" itemizada se
reorganiza.

## Sincronização com o Flow

`sincronizarFaturas` mantém no Flow um lançamento `previsto` por fatura com valor > 0:
`boxId` = box do cartão, `categoriaId` = `categoriaFaturaId`, `data` = vencimento,
`valor`, `status: 'previsto'`, `origem: 'cartao'`, `cartaoId`, `faturaMes`.

**Valor sincronizado:** a soma dos itens da fatura — exceto se a `ConferenciaFatura` do
mês tiver `usarValorApp` marcado, caso em que vale `valorAppCent`. Desmarcar a caixa
volta a sincronizar a soma.

Regras de proteção (mesma disciplina de `materializar`):

- Lançamento `efetivo` (fatura confirmada) nunca é tocado nem recriado.
- Previsto descartado pelo usuário não ressuscita. Pela mesma razão, previsto **novo** só
  é criado com vencimento `> hoje` (não dá para distinguir "nunca criado" de "descartado"
  para datas passadas — mesmo trade-off aceito em `materializar`). Previsto já existente
  continua sendo atualizado mesmo com vencimento `<= hoje` (na fila de pendentes).
- Previsto existente tem valor e data atualizados ao vivo conforme compras mudam.
- Fatura cujo valor sincronizado fica zero (ou cartão desativado/excluído) tem o previsto
  removido; efetivos ficam intactos. (Com `usarValorApp` marcado, uma fatura sem itens mas
  com `valorAppCent > 0` **tem** previsto.)

Roda nos mesmos pontos onde `materializarTodas` roda hoje (boot e após mudanças em
compras, cartões ou assinaturas).

**Confirmação:** no vencimento, o previsto da fatura entra na fila de pendentes do Hoje e
é confirmado pelo fluxo existente (com ajuste de valor opcional se a fatura real
divergiu). Nenhum fluxo novo de confirmação.

## Interface

### Navegação
Barra inferior com 6 itens: Hoje, Fluxo, **+**, Cartão, Análises, Simular.
Tipo `Aba` ganha `'cartao'`.

### Tela Cartão (`src/ui/TelaCartao.tsx`)
- Segue o seletor de box do topo: box → cartão daquela box; visão "casa" → os dois
  cartões empilhados (resumo de cada fatura).
- Mostra a **fatura atual** por padrão, com navegação ‹ mês anterior | mês seguinte ›.
  Futuras já incluem parcelas e assinaturas conhecidas; passadas mostram o detalhamento
  recalculado.
- Cabeçalho: total, "fecha em D/M", "vence em D/M", resumo por categoria do cartão
  (a análise da fatura mora aqui nesta versão; integração com a aba Análises fica para
  depois).
- **Bloco de conferência**: campo "valor no app do banco" (por fatura) e, quando
  preenchido, a diferença em destaque: `valorApp − soma dos itens` ("falta bater
  R$ X,XX"; zerado = ✓ batido). Checkbox "usar este valor no Flow" — desmarcada por
  padrão; marcada, o previsto da fatura passa a usar o valor do app.
- Lista de itens: descrição, categoria, valor, marcação "3/12" quando parcelado. Tocar
  abre edição (padrão `LancEditor`); excluir compra remove todas as parcelas (a compra é
  uma só; as parcelas são derivadas).
- Botão **+ compra** na própria tela: valor, data (padrão hoje), categoria do cartão,
  parcelas (padrão 1), descrição. O + central da barra continua sendo só do Flow.
- Box sem cartão cadastrado: a tela oferece "Cadastrar cartão" levando aos Ajustes.

### Ajustes — seção nova "Cartões"
- Cadastrar/editar cartão por box: nome, dia de fechamento, dia de vencimento, categoria
  do Flow da fatura, ativo.
- Gerenciar categorias do cartão (mesmo padrão de `Categorias.tsx`: criar, renomear,
  arquivar, ordenar).
- Gerenciar assinaturas (mesmo padrão de `Recorrencias.tsx`).

## Banco, backup e import

- **Dexie:** cinco tabelas novas (`cartoes`, `categoriasCartao`, `comprasCartao`,
  `recorrenciasCartao`, `conferenciasFatura`) com bump de versão do schema; migração
  automática, dados existentes intactos.
- **Backup:** export/restore `.json` inclui as tabelas novas; versão do formato sobe.
  Backup antigo restaura normalmente (campos ausentes = listas vazias); backup de versão
  nova em app antigo é rejeitado com mensagem clara (comportamento já existente).
- **Import da planilha:** sem mudanças — a planilha continua trazendo o cartão como valor
  único mensal. A itemização vale do primeiro uso da aba em diante.

## Validações e erros

- Valor da compra: `parseValorDigitado` existente (positivo, obrigatório).
- Valor do app do banco: `parseValorDigitado` (positivo); apagar o campo remove a
  conferência do mês (e desmarca a caixa junto).
- Parcelas: inteiro de 1 a 48.
- Um cartão **ativo** por box: os Ajustes impedem cadastrar um segundo cartão ativo na
  mesma box (cadastrar um novo exige desativar o anterior).
- Categoria do cartão com compras não pode ser excluída — arquivar (regra igual às
  categorias do Flow).
- Desativar/excluir cartão: remove previstos futuros da fatura no Flow, mantém efetivos e
  compras guardadas.

## Testes

- **`fatura.test.ts`** (unidade, função pura): compra no dia do fechamento → fatura
  seguinte; vencimento no mesmo mês vs. mês seguinte; clamp de fim de mês (fechamento dia
  31 em fevereiro); parcelas com resto de centavo (10000/3 = 3334+3333+3333); compra parcelada
  atravessando a virada de ano; assinatura materializada; soma ao centavo.
- **Sincronização:** previsto atualiza ao vivo; efetivo nunca é tocado; descartado não
  ressuscita; fatura zerada remove o previsto; desativar cartão limpa previstos; com
  `usarValorApp` marcado o previsto usa `valorAppCent` (e volta à soma ao desmarcar).
- **UI:** adicionar compra parcelada e ver as faturas corretas; confirmar fatura pendente
  pelo Hoje; tela sem cartão cadastrado; cadastro de cartão nos Ajustes; conferência —
  digitar valor do app mostra "falta bater" correto e a caixa troca o valor do previsto.

## Fora de escopo (desta versão)

- Integração do detalhamento do cartão na aba Análises (o resumo por categoria fica na
  própria fatura).
- Import itemizado de fatura (OFX/CSV do banco).
- Mais de um cartão por box.
