# Changelog

Histórico de versões do Flow. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
com uma seção por versão contendo apenas o que foi **Adicionado**, **Alterado** ou **Removido**.

## [0.10.0] - 2026-07-22

### Adicionado

- **Viagem**: agrupamento de gastos (compras de cartão e lançamentos de débito) feitos
  num período de viagem.
  - Ajustes → Viagens: cadastro de viagens (nome + data inicial + data final), sem
    permitir sobreposição de período entre viagens.
  - Lançar e Nova compra (cartão): checkbox "Viagem: {nome}" aparece só quando a data do
    lançamento/compra cai dentro do período de uma viagem cadastrada, já vem marcado.
  - Análises: linha "viagem - dd/mm/aaaa ~ dd/mm/aaaa" no resumo "Por categoria" (soma
    informativa, não substitui os totais das categorias) e novo card "Viagens" com o
    total histórico de cada uma; clicar em qualquer um abre o detalhamento por
    descrição/nota, com subtotal de cada grupo e total geral.
  - Compras parceladas marcadas numa viagem continuam aparecendo no mês certo da fatura
    enquanto houver parcela pendente, mesmo depois do fim da viagem.
  - Excluir uma viagem em Ajustes desvincula os lançamentos e compras marcados (eles
    continuam existindo normalmente) em vez de apagá-los.

## [0.9.0] - 2026-07-19

### Adicionado

- Seção "Arquivados" em Categorias e Categorias do cartão (Ajustes), separando categorias
  arquivadas das listas ativas.

### Alterado

- Categorias e Categorias do cartão (Ajustes): reordenar passa a ser por arraste (alça),
  no lugar dos botões ↑/↓; formulário de criar categoria subiu para o topo da tela.

## [0.8.3] - 2026-07-19

### Corrigido

- Changelog na tela de Ajustes: itens que quebram linha no `CHANGELOG.md` (linhas de
  continuação indentadas) apareciam cortados na primeira linha; o parser agora junta a
  continuação ao item.

## [0.8.2] - 2026-07-19

### Alterado

- Análises: clicar na categoria de fatura de um cartão (ex.: "Nubank") não abre mais o
  sheet genérico agrupado por nota (que só repetia o total, já que a fatura é um único
  lançamento por mês) — agora mostra o detalhamento por categoria de compra do cartão,
  com um link para ver a fatura completa na aba Cartão.

## [0.8.1] - 2026-07-19

### Alterado

- Sheet de lançamentos por categoria (Análises): grupos com um único lançamento não
  mostram mais a linha de data (redundante com o subtotal); linha do grupo e da data
  recuam visualmente para indicar o nível de hierarquia.

## [0.8.0] - 2026-07-19

### Adicionado

- Componente `CampoData`: botão com ícone de calendário no lugar do input de data nativo,
  usado em todos os formulários com data do app.
- Cor própria (verde/vermelho) para o totalizador do dia na aba Fluxo, separada da cor da
  transação individual.

### Alterado

- Maior contraste entre o fundo e os cards/itens de lista em toda a UI.
- Recorrências e Assinaturas: descrição, data e recorrência em linhas separadas, evitando
  quebra de texto ruim; botões de ação numa linha própria.
- Valores monetários (Recorrências, Assinaturas, fatura do cartão, tabela "Comparativo" em
  Análises) passam a ser coloridos por ganho/gasto onde antes ficavam sem cor.
- Aba Fluxo: valor de cada transação sem negrito, destacando o totalizador do dia.

## [0.7.0] - 2026-07-17

### Adicionado

- Este changelog e exibição da versão atual na tela de Ajustes.

## [0.6.0] - 2026-07-17

### Removido

- Importação de lançamentos e saldo inicial a partir de planilha Excel (descontinuada).

### Alterado

- Aba Simulador fica oculta da navegação (cenários seguem existindo no domínio).

## [0.5.0] - 2026-07-10

### Adicionado

- Linha do dia de hoje sempre visível e destacada na lista padrão do Fluxo.

### Alterado

- Ordenação de categorias passa a vir da fonte de dados, consistente em todas as telas.
- Exportar backup deixa de falhar em silêncio.

## [0.4.0] - 2026-07-08

### Adicionado

- Gráfico de saldo expandido com pan/zoom, scrub e busca por período na aba Fluxo.
- Popup unificado "Adicionar" para lançamento ou compra no cartão, aberto pelo FAB.
- Categoria de fatura do cartão criada e renomeada automaticamente, oculta em toda a UI.
- Drill-down de lançamentos por categoria na aba Análises.

## [0.3.0] - 2026-07-05

### Alterado

- Redesign visual dark-first: novos tokens e tema, tab bar com FAB, bottom sheet com
  arraste, gráfico de saldo com gradiente, card herói do saldo e ícones no menu de ajustes.

## [0.2.0] - 2026-07-04

### Adicionado

- Aba Cartão de crédito: fatura derivada do ciclo de fechamento/vencimento, compras
  parceladas, assinaturas recorrentes no cartão e conferência com o valor do banco.

## [0.1.0] - 2026-07-03

### Adicionado

- Primeira versão do Flow: fluxo de caixa diário com saldo projetado por box.
- Categorias, lançamentos manuais e recorrências.
- Telas Hoje, Fluxo, Análises, Simulador e Ajustes.
- Importação de saldo inicial e lançamentos a partir de planilha Excel.
- Backup e restauração em JSON.
- PWA instalável, com funcionamento offline.
