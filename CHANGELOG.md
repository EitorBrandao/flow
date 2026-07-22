# Changelog

Histórico de versões do Flow. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
com uma seção por versão contendo apenas o que foi **Adicionado**, **Alterado** ou **Removido**.

## [0.10.0] - 2026-07-22

### Adicionado

- Seletor de Box em Recorrências (Ajustes), escopando a lista e as categorias àquela box.
- Linha "Assinaturas" na aba Análises, somando assinaturas de todos os cartões — abre um
  resumo agrupado por cartão.

### Alterado

- Recorrências: formulário sobe pro topo da tela; categoria vira grid de botões (com
  alternância Gasto/Ganho), no lugar do `<select>` nativo.
- Cartões: uma box pode ter mais de um cartão ativo ao mesmo tempo; formulário de novo
  cartão sobe pro topo.
- Categorias do cartão: seletor de cartão vira botões, no lugar do `<select>` nativo.
- Assinaturas: escolhe o cartão em vez da categoria (a categoria "Assinaturas" fica
  automática); lista escopada ao cartão selecionado; formulário sobe pro topo.
- Menu de Ajustes reordenado por hierarquia (Boxes primeiro).
- Seletor de categoria em Lançar, Compra no cartão, editar lançamento e Simulador trocam o
  `<select>` nativo por grid de botões (evita o picker nativo do Android com botão "Done").

### Removido

- Campo de categoria manual no formulário de Assinaturas.
- Bloqueio que impedia mais de um cartão ativo por box.

## [0.9.1] - 2026-07-20

### Alterado

- Gráfico de saldo (cartão pequeno e modal expandido): a linha passa a ser sempre branca,
  em vez de verde fixa. No expandido, o marcador do dia selecionado e o valor em destaque
  agora ficam verdes ou vermelhos conforme o sinal do saldo daquele dia.

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
