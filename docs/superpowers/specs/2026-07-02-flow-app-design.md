# Flow — App de controle financeiro pessoal

**Data:** 2026-07-02
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Contexto e problema

Eitor controla suas finanças desde 2024 numa planilha Excel ("flow of the box"), uma por ano.
A planilha é um **fluxo de caixa diário com saldo projetado**: colunas = dias do ano, linhas =
categorias de ganhos/gastos, e `Saldo(d) = Saldo(d−1) + Ganhos(d) − Gastos(d)`. O saldo de
01/01 vem do arquivo do ano anterior (link externo). Empréstimos cadastrados na aba
`Simulacoes_Eitor` (data início, dia de pagamento, nº de parcelas, valor mensal) são projetados
automaticamente nos dias futuros. Abas `Resumos`/`Pivot` agregam por mês: total por categoria,
sobra e gasto como % da renda.

Estrutura do arquivo de 2026 (fonte de verdade para o import):

- `box (eitor)` — fluxo diário do Eitor. Ganhos: salário/férias, pix, ajuste cents, rendimento
  nubank. Gastos: cartão, Brasil Prev, psicóloga, pix, guardado, aluguel, condomínio, energia,
  água, Empréstimo Eitor, Empréstimo Ju. Saldo inicial 2026: R$ 1.340,35.
- `box (Ju)` — mesma estrutura para a Ju. Gastos: internet mãe, faculdade, academia, aluguel,
  condomínio, pix, internet.
- `box (casa)` — consolidação: ganhos/gastos de eitor + Ju + categorias compartilhadas
  (Energia, Água, Ajustes).
- `Simulacoes_Eitor` — empréstimos com cronograma de parcelas.
- `Salarios` — rateio do aluguel entre Eitor/Mega/Eli por percentuais.
- `Acertos Ju` — acerto de contas mensal com a Ju.
- `Resumos`/`Pivot` + abas ocultas `transposed(...)` — agregações mensais.

### Dores que o app elimina

1. **Lançar gastos no celular** — registrar na hora é inviável no Excel mobile; acumula e perde
   a "precisão do agora".
2. **Virada de ano manual** — recriar arquivo, refazer fórmulas, encadear saldo todo janeiro.
3. **Simulações limitadas** — recorrências/parcelamentos e cenários "e se?" engessados.
4. **Agregações limitadas** — cortes novos (tendências, comparativos) exigem montar pivot na mão.

### Requisitos confirmados

- **Usuário único** (Eitor) na v1; modelo de dados preparado para multi-pessoa futura.
- **Celular Android** é a plataforma principal; PC secundário (mesma interface no navegador).
- **Dados locais no aparelho** + backup manual por arquivo. Sem servidor, sem conta.
- **Nasce com o 2026 importado** da planilha, saldo batendo ao centavo.
- **Entrada:** manual rápida + recorrências automáticas. (Import de extrato bancário: futuro.)
- **Análises v1:** saldo projetado no tempo, resumo mensal por categoria, comparativos e
  tendências, simulador de cenários.
- **Cartão:** lançamento único por fatura, entrada manual. (Itemização: futuro.)
- **Simplicidade de preenchimento** acima de tudo; foco nas análises.

## Arquitetura

- **SPA React + TypeScript**, build com **Vite**, empacotada como **PWA** (service worker,
  manifest): instalável pela URL no Android, offline por completo, abre em navegador de PC.
- **Dados 100% locais** no IndexedDB via **Dexie**. Na abertura o app carrega tudo em memória;
  projeções e agregações são calculadas em memória a cada mudança (volume: poucos milhares de
  lançamentos/ano → milissegundos).
- Solicitar **armazenamento persistente** (`navigator.storage.persist()`) na primeira execução.
- **Backup:** export de um toque para arquivo `.json` (Web Share API no Android → OneDrive ou
  qualquer destino); restauração por arquivo, com opção substituir ou mesclar. Aviso discreto
  quando houver mudanças sem backup há mais de 7 dias.
- **Hospedagem:** site estático gratuito (GitHub Pages ou similar). Nenhum dado sai do aparelho.
- **Import `.xlsx` dentro do app** via SheetJS — tela de Ajustes, reaproveitável.
- **Layout responsivo:** barra inferior no celular; barra lateral e visualizações maiores no PC.

## Modelo de dados

Todas as entidades têm `id` (UUID) e timestamps de criação/alteração.

### Box
Fluxo de caixa com saldo próprio.
- `nome` (ex.: "eitor", "ju")
- `saldoInicial` (centavos) e `dataSaldoInicial` (ex.: 1.340,35 em 2026-01-01)
- A `casa` é uma box especial **sem saldo próprio** (`saldoInicial` nulo): guarda apenas os
  lançamentos compartilhados (energia, água, ajustes). A **visão consolidada da casa** é
  calculada pelo motor (eitor + ju + box casa) — nunca armazenada.
- Preparação multi-pessoa: campo opcional `dono` (não usado na v1).

### Categoria
- `boxId`, `nome`, `tipo` (`ganho` | `gasto`), `ordem`, `arquivada` (bool)
- "pix" existe duas vezes (uma como ganho, outra como gasto) — o tipo resolve a ambiguidade.
- Arquivar esconde dos formulários e preserva o histórico.

### Lançamento
O registro central.
- `boxId`, `categoriaId`, `data` (dia), `valor` (centavos, **sempre positivo** — o tipo da
  categoria define a direção), `nota?`
- `status`: `efetivo` | `previsto`
- `origem`: `manual` | `recorrencia` | `import`
- `recorrenciaId?` — vínculo com a regra que o gerou
- `cenarioId?` — se pertence a um cenário (hipotético; nunca `efetivo`)

### Recorrência
Regra que gera lançamentos `previstos` no futuro.
- `boxId`, `categoriaId`, `valor`, `dataInicio`, `diaDoMes`, `parcelas?` (número ou sem fim),
  `nota?`, `ativa` (bool)
- Materialização: o app gera/atualiza os lançamentos `previstos` futuros da regra até o
  horizonte de projeção. Editar a regra regenera os previstos ainda não confirmados; os já
  confirmados (efetivos) nunca são tocados.

### Cenário
- `nome`, `ligado` (bool)
- Contém lançamentos hipotéticos (com `cenarioId`), pontuais ou gerados por uma recorrência
  hipotética. Nunca entram no saldo efetivo; entram na projeção apenas quando `ligado`.
- Ação "converter em real": move os lançamentos/recorrência do cenário para os dados reais.

### Configurações
- Registro único: box padrão para lançamento, data do último backup, flag de mudanças desde o
  último backup, horizonte de projeção (padrão: 31/12 do ano seguinte).

## Motor de projeção

Função pura: `(boxes, categorias, lançamentos, recorrências, cenários ligados, horizonte) →
séries de saldo diário + agregações`. Sem estado próprio; recalcula a cada mudança.

- **Série diária por box:** do `dataSaldoInicial` ao horizonte, acumulando por dia:
  efetivos + previstos + (cenários ligados, como camada separada). Saída: para cada dia,
  `saldoEfetivo` (só efetivos), `saldoProjetado` (efetivos + previstos) e `saldoComCenarios`.
- **Fronteira do hoje / pendentes:** lançamento `previsto` com `data < hoje` não vira efetivo
  sozinho — entra na fila de **pendentes**. Confirmar = ajustar valor (opcional) e marcar
  `efetivo`. Descartar = excluir. O saldo efetivo nunca contém suposição.
- **Consolidação casa:** série calculada = eitor + ju + lançamentos da box `casa`. Sem dados
  duplicados.
- **Sem virada de ano:** o fluxo é contínuo; o horizonte se estende conforme configurado.
- **Agregações derivadas** (sempre da mesma lista em memória):
  - Resumo mensal por categoria: total de ganhos/gastos por categoria, sobra do mês, gasto
    como % da renda do mês.
  - Comparativos: mês vs mês anterior, mesmo mês do ano anterior, média móvel 3 meses por
    categoria.

## Telas

Navegação: barra inferior com 4 abas + botão central de lançar (mobile); barra lateral (PC).
Seletor global de box (`eitor` / `ju` / `casa`) no topo.

1. **Hoje** (inicial): saldo atual da box, mini-gráfico do saldo projetado (próximas ~4
   semanas), fila de pendentes com confirmação em um toque, atalho para Ajustes.
2. **Lançar** (botão central): teclado numérico aberto, categorias como botões grandes
   ordenadas por uso recente, data = hoje, box = padrão. Fluxo mínimo: valor → categoria →
   salvar (3 toques). Opcionais: nota, outra data, outra box, marcar como previsto.
3. **Fluxo**: gráfico da linha do saldo (passado sólido, futuro tracejado, marcador "hoje";
   linha extra quando há cenário ligado) + lista infinita de dias com seus lançamentos.
   Tocar num lançamento → editar/excluir; num previsto → confirmar/ajustar.
4. **Análises**: resumo mensal (tabela categorias × meses com totais, sobra, % da renda) e
   comparativos/tendências. Filtros: box, período.
5. **Simulador**: lista de cenários com toggle; criar/editar cenário (lançamentos pontuais ou
   parcelados); botão "converter em real".
6. **Ajustes**: categorias (CRUD, ordenar, arquivar), recorrências (CRUD), boxes, backup
   (export/import/aviso), import da planilha, sobre.

## Import da planilha 2026

Fluxo em 3 passos na tela de Ajustes:

1. **Selecionar arquivo** `.xlsx` (formato "flow of the box 2026").
2. **Leitura e prévia:** o parser lê `box (eitor)`, `box (Ju)`, `box (casa)` e
   `Simulacoes_Eitor` e monta: 2 boxes + box casa, categorias (com tipo), lançamentos
   (célula dia × categoria com valor ≠ 0), empréstimos como recorrências.
   - Células até **hoje** → lançamentos `efetivos`.
   - Células **futuras** (inclusive as geradas por fórmula de empréstimo) → `previstos`
     vinculados à recorrência quando identificáveis, senão previstos avulsos.
   - Saldo inicial da box = valor de 01/01 da planilha.
3. **Conferência:** tabela dia a dia comparando saldo calculado pelo app × saldo da planilha
   (linha 7). Divergência em qualquer dia bloqueia com detalhe (dia, valores). Só "Aceitar"
   grava — transacionalmente.

Regras: valores em centavos (sem erro de ponto flutuante); import é idempotente (reimportar
substitui dados de origem `import` após confirmação explícita).

## Backup e restauração

- **Export:** um toque gera `.json` versionado (schema + dados completos) e abre o share sheet
  do Android (ou download no PC).
- **Import:** selecionar arquivo → escolher **substituir tudo** ou **mesclar** (mescla por id;
  em conflito, vence o mais recente).
- **Aviso:** banner discreto na tela Hoje quando há mudanças e o último backup tem > 7 dias.

## Tratamento de erros

- Import xlsx: validação estrutural com mensagens em português apontando aba/linha/coluna.
- Formulários: valor > 0, categoria obrigatória e não arquivada, data válida.
- Persistência: escritas transacionais (Dexie transactions) — ou grava tudo, ou nada.
- Restauração de backup: valida versão do schema; incompatibilidade → mensagem clara, nada é
  alterado.

## Testes

- **Motor de projeção:** unitários cobrindo saldo diário, fronteira do hoje/pendentes,
  recorrências (parcelas finitas, sem fim, edição regenerando previstos), cenários,
  consolidação casa, agregações mensais e comparativos.
- **Importador:** teste com cópia do arquivo real (`flow of the box - 2026.xlsx`) conferindo
  saldos ao centavo contra valores extraídos da planilha; testes de erro (arquivo malformado).
- **Backup:** export → import round-trip preserva tudo.
- **UI:** testes de componente para o fluxo de lançamento rápido e confirmação de pendentes.

## Faseamento

**v1 (este projeto):** tudo acima — boxes, categorias, lançamentos, recorrências, pendentes,
motor de projeção, consolidação casa, 4 análises, cenários, import da planilha 2026, backup,
PWA instalável e responsiva.

**Fora do escopo da v1 (futuro):** import de extrato bancário (OFX/CSV) com conciliação,
itemização do cartão de crédito (compras individuais → fatura), multi-pessoa/grupos (contas,
permissões), sincronização automática entre dispositivos, import dos anos 2024/2025.
