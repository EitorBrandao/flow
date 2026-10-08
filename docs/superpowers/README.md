# Specs e planos

Duas pastas, dois papéis diferentes:

- **`specs/`** — o quê e por quê. Documento de decisão de produto, escrito e aprovado em
  conversa com o usuário (normalmente um brainstorming com `superpowers:brainstorming`),
  antes de qualquer código. Cobre requisito, decisões validadas e o que fica fora de escopo.
- **`plans/`** — como implementar. Passo a passo técnico para uma sessão de execução
  (`superpowers:executing-plans` / `superpowers:subagent-driven-development`), com tarefas
  checáveis. Nem toda spec vira plano formal (mudança pequena o bastante para implementar
  direto) e nem todo plano nasce de uma spec (mudança técnica/interna sem decisão de produto
  em aberto).

## A linha `Status:`

Toda spec começa (logo abaixo do título) com uma linha no formato:

```
Status: aprovada em AAAA-MM-DD — <situação>
```

Sem negrito — é o que permite um `grep "^Status: aprovada em"` mecânico (usado, por exemplo,
pelo checklist do nível 6 do guia de estilo, que confere que a spec citada existe e está
aprovada antes de aceitar uma mudança de linguagem visual). `<situação>` é exatamente uma
destas:

- `implementada` — a feature está no código hoje.
- `implementada parcialmente: <o que falta>` — parte entrou.
- `não implementada` — aprovada mas nunca virou código.
- `substituída` — outra spec mudou a decisão; a `Nota:` diz qual.
- `situação não confirmada` — não foi possível determinar com evidência (git log, CHANGELOG,
  código) se e quanto foi implementado. É preferível a chutar.

A data usa o prefixo `AAAA-MM-DD` do nome do arquivo (data de aprovação no brainstorming),
a menos que o corpo da spec declare explicitamente uma data diferente. Informação da redação
antiga que não caiba na gramática (ex.: como o mockup foi validado, uma nota histórica) vai
numa linha `Nota:` logo abaixo, em vez de ser descartada. Quem cria uma spec nova já nasce
com a linha nesse formato — normalmente `situação não confirmada` ou `não implementada` até a
implementação acontecer.

## Specs

| Data | Spec | Tema | Situação | Plano |
|---|---|---|---|---|
| 2026-07-02 | [flow-app-design.md](specs/2026-07-02-flow-app-design.md) | Primeira versão do app: fluxo de caixa diário com saldo projetado por box. | implementada | [flow-app.md](plans/2026-07-02-flow-app.md) |
| 2026-07-04 | [cartao-credito-design.md](specs/2026-07-04-cartao-credito-design.md) | Aba Cartão de Crédito: fatura derivada do ciclo de fechamento/vencimento. | implementada | [cartao-credito.md](plans/2026-07-04-cartao-credito.md) |
| 2026-07-05 | [grafico-fluxo-expandido-design.md](specs/2026-07-05-grafico-fluxo-expandido-design.md) | Modal em tela cheia do gráfico de saldo, com scrub e seleção de dia. | implementada | — |
| 2026-07-05 | [redesign-visual-design.md](specs/2026-07-05-redesign-visual-design.md) | Redesign dark-first: tokens, tab bar com FAB, bottom sheet, gráfico com gradiente. | implementada | [redesign-visual.md](plans/2026-07-05-redesign-visual.md) |
| 2026-07-08 | [cartao-categoria-oculta-design.md](specs/2026-07-08-cartao-categoria-oculta-design.md) | Categoria da fatura do cartão passa a ser automática e oculta da UI manual. | implementada | [cartao-categoria-oculta.md](plans/2026-07-08-cartao-categoria-oculta.md) |
| 2026-07-08 | [cartao-popup-adicionar-design.md](specs/2026-07-08-cartao-popup-adicionar-design.md) | Ponto de entrada único "+": popup para escolher Lançamento ou Compra no cartão. | implementada | [cartao-popup-adicionar.md](plans/2026-07-08-cartao-popup-adicionar.md) |
| 2026-07-08 | [drilldown-lancamentos-analises-design.md](specs/2026-07-08-drilldown-lancamentos-analises-design.md) | Clicar numa categoria em Análises abre o detalhamento dos lançamentos. | implementada | [drilldown-lancamentos-analises.md](plans/2026-07-08-drilldown-lancamentos-analises.md) |
| 2026-07-08 | [grafico-fluxo-pan-zoom-design.md](specs/2026-07-08-grafico-fluxo-pan-zoom-design.md) | Pan/zoom e busca por período no gráfico de saldo expandido. | implementada | [grafico-fluxo-pan-zoom.md](plans/2026-07-08-grafico-fluxo-pan-zoom.md) |
| 2026-07-10 | [fluxo-linha-hoje-fixa-design.md](specs/2026-07-10-fluxo-linha-hoje-fixa-design.md) | Linha do dia de hoje sempre visível e destacada na aba Fluxo. | implementada | [fluxo-linha-hoje-fixa.md](plans/2026-07-10-fluxo-linha-hoje-fixa.md) |
| 2026-07-10 | [guia-estilo-por-niveis-design.md](specs/2026-07-10-guia-estilo-por-niveis-design.md) | Reestrutura o guia de estilo num índice roteador + capítulos por nível de edição. | implementada | [guia-estilo-por-niveis.md](plans/2026-07-10-guia-estilo-por-niveis.md) |
| 2026-07-10 | [ordenacao-categorias-design.md](specs/2026-07-10-ordenacao-categorias-design.md) | Ordenação de categorias passa a vir da fonte de dados, consistente em todas as telas. | implementada | [ordenacao-categorias.md](plans/2026-07-10-ordenacao-categorias.md) |
| 2026-07-17 | [contraste-cards-design.md](specs/2026-07-17-contraste-cards-design.md) | Mais contraste entre `--surface`/`--surface2` e o fundo do app. | implementada | — |
| 2026-07-18 | [cor-total-dia-fluxo-design.md](specs/2026-07-18-cor-total-dia-fluxo-design.md) | Tokens de cor próprios (`--total-pos`/`--total-neg`) pro totalizador do dia no Fluxo. | substituída | — |
| 2026-07-19 | [arrastar-categorias-design.md](specs/2026-07-19-arrastar-categorias-design.md) | Reordenar categorias por arraste (alça), no lugar dos botões ↑/↓. | implementada | [arrastar-categorias.md](plans/2026-07-19-arrastar-categorias.md) |
| 2026-07-22 | [ajustes-recorrencias-cartoes-design.md](specs/2026-07-22-ajustes-recorrencias-cartoes-design.md) | Escopa Recorrências por box, permite múltiplos cartões ativos por box, categoria "Assinaturas" automática, seletores de categoria/cartão viram grid de botões. | implementada | [ajustes-recorrencias-cartoes.md](plans/2026-07-22-ajustes-recorrencias-cartoes.md) |
| 2026-07-23 | [alcinha-branca-design.md](specs/2026-07-23-alcinha-branca-design.md) | Alcinha de arrastar dos sheets vira branco puro (token `--alca`). | implementada | — |
| 2026-07-23 | [cor-min-max-grafico-design.md](specs/2026-07-23-cor-min-max-grafico-design.md) | Mín/máx do rodapé dos gráficos ganha cor conforme o próprio sinal. | implementada | — |
| 2026-07-23 | [enforcement-orientacoes-design.md](specs/2026-07-23-enforcement-orientacoes-design.md) | Enforcement automático das orientações do repositório (guards de release/deploy/catálogo, hooks, CI). | implementada | — |
| 2026-07-23 | [graficos-aba-analises-design.md](specs/2026-07-23-graficos-aba-analises-design.md) | Gráficos (composição por categoria, evolução mensal) e responsividade na aba Análises. | implementada | [graficos-aba-analises.md](plans/2026-07-23-graficos-aba-analises.md) |
| 2026-07-24 | [perfil-box-global-design.md](specs/2026-07-24-perfil-box-global-design.md) | Chip de box do topo vira única fonte de seleção de box no app inteiro. | implementada | — |
| 2026-08-03 | [confirmacao-exclusao-lancamentos-design.md](specs/2026-08-03-confirmacao-exclusao-lancamentos-design.md) | Excluir ou descartar um lançamento passa a pedir confirmação. | implementada | [confirmacao-exclusao-lancamentos.md](plans/2026-08-03-confirmacao-exclusao-lancamentos.md) |
| 2026-08-05 | [bancos-na-box-design.md](specs/2026-08-05-bancos-na-box-design.md) | Bancos dentro da box, entrega 1: o banco existe e tem saldo informado. | implementada | [bancos-na-box.md](plans/2026-08-05-bancos-na-box.md) |
| 2026-08-10 | [dossie-comportamento-design.md](specs/2026-08-10-dossie-comportamento-design.md) | Dossiê de comportamento: o app inteiro em ação, gerado de um roteiro sintético. | implementada | [dossie-comportamento.md](plans/2026-08-10-dossie-comportamento.md) |
| 2026-08-20 | [changelog-niveis-design.md](specs/2026-08-20-changelog-niveis-design.md) | Changelog com dois níveis: tópico e detalhe indentado. | implementada | [changelog-niveis.md](plans/2026-08-20-changelog-niveis.md) |
| 2026-08-20 | [lancamentos-frequentes-design.md](specs/2026-08-20-lancamentos-frequentes-design.md) | Atalhos dos lançamentos mais frequentes na sheet Adicionar. | implementada | [lancamentos-frequentes.md](plans/2026-08-20-lancamentos-frequentes.md) |
| 2026-08-27 | [confirmar-pendente-outro-valor-design.md](specs/2026-08-27-confirmar-pendente-outro-valor-design.md) | Confirmar um pendente com outro valor, direto na fila. | implementada | [confirmar-pendente-outro-valor.md](plans/2026-08-27-confirmar-pendente-outro-valor.md) |
| 2026-08-29 | [compra-por-nota-fiscal-design.md](specs/2026-08-29-compra-por-nota-fiscal-design.md) | Compra no cartão a partir da nota fiscal (QR-code e XML da NFC-e). | implementada | [compra-por-nota-fiscal.md](plans/2026-08-29-compra-por-nota-fiscal.md) |
| 2026-08-30 | [itens-da-nota-fiscal-design.md](specs/2026-08-30-itens-da-nota-fiscal-design.md) | Itens da nota fiscal guardados na compra do cartão. | implementada | [itens-da-nota-fiscal.md](plans/2026-09-02-itens-da-nota-fiscal.md) |
| 2026-09-02 | [ajuste-fechamento-fatura-design.md](specs/2026-09-02-ajuste-fechamento-fatura-design.md) | Ajuste excepcional do dia de fechamento de uma fatura. | implementada | [ajuste-fechamento-fatura.md](plans/2026-09-02-ajuste-fechamento-fatura.md) |
| 2026-09-16 | [transferencia-entre-bancos-design.md](specs/2026-09-16-transferencia-entre-bancos-design.md) | Transferência de saldo entre bancos da mesma box, em Hoje → Conferir. | implementada | [transferencia-entre-bancos.md](plans/2026-09-16-transferencia-entre-bancos.md) |
| 2026-09-17 | [conferencia-por-extrato-design.md](specs/2026-09-17-conferencia-por-extrato-design.md) | Conferência por extrato (entrega 1): compara extrato e fatura com o que o app tem. | implementada | [conferencia-por-extrato.md](plans/2026-09-17-conferencia-por-extrato.md) |
| 2026-09-18 | [bloquear-cartao-compra-design.md](specs/2026-09-18-bloquear-cartao-compra-design.md) | Bloquear um cartão para novas compras, sem tocar na fatura nem nas assinaturas. | implementada | [bloquear-cartao-compra.md](plans/2026-09-18-bloquear-cartao-compra.md) |
| 2026-09-23 | [consistencia-parte-2-design.md](specs/2026-09-23-consistencia-parte-2-design.md) | Consistência entre telas, parte 2: fatura, card de destaque e seletor de mês. | implementada | [consistencia-parte-2.md](plans/2026-09-23-consistencia-parte-2.md) |
| 2026-09-23 | [consistencia-parte-3-design.md](specs/2026-09-23-consistencia-parte-3-design.md) | Consistência entre telas, parte 3: formulários de Ajustes e textos. | implementada | [consistencia-parte-3-entrega-a.md](plans/2026-09-23-consistencia-parte-3-entrega-a.md) |
| 2026-09-23 | [saldo-dia-futuro-e-rodape-backup-design.md](specs/2026-09-23-saldo-dia-futuro-e-rodape-backup-design.md) | Dia filtrado no Fluxo sempre aparece, com saldo e diferença em relação a hoje (item 8, entrega 1); rodapé de backup permanente na Visão da Hoje, em três estados (item 5). | implementada | [saldo-dia-futuro.md](plans/2026-09-23-saldo-dia-futuro.md), [rodape-backup.md](plans/2026-09-23-rodape-backup.md) |
| 2026-09-23 | [wiki-hiperlinks-design.md](specs/2026-09-23-wiki-hiperlinks-design.md) | Links entre capítulos da wiki e termos do glossário com definição. | implementada | [wiki-hiperlinks.md](plans/2026-09-23-wiki-hiperlinks.md) |
| 2026-09-24 | [diferenca-da-fatura-design.md](specs/2026-09-24-diferenca-da-fatura-design.md) | Pagar a fatura por valor menor pergunta para onde vai a sobra. | implementada | [diferenca-da-fatura.md](plans/2026-09-24-diferenca-da-fatura.md) |
| 2026-09-24 | [hoje-grafico-expandido-design.md](specs/2026-09-24-hoje-grafico-expandido-design.md) | Hoje leva ao gráfico do Fluxo. | implementada | [hoje-grafico-do-fluxo.md](plans/2026-09-24-hoje-grafico-do-fluxo.md) |
| 2026-09-24 | [orcamento-de-viagem-design.md](specs/2026-09-24-orcamento-de-viagem-design.md) | Orçamento de viagem, com prévia do gasto no formulário. | implementada | [orcamento-de-viagem.md](plans/2026-09-24-orcamento-de-viagem.md) |
| 2026-09-24 | [wiki-navegacao-design.md](specs/2026-09-24-wiki-navegacao-design.md) | Navegação e texto da wiki: barra fixa, seções no índice e busca com trecho. | implementada | [wiki-navegacao.md](plans/2026-09-24-wiki-navegacao.md) |
| 2026-09-26 | [regra-de-sinal-design.md](specs/2026-09-26-regra-de-sinal-design.md) | Valor sem sinal, a cor diz o sentido; saldo negativo mantém o "−". | implementada | [regra-de-sinal.md](plans/2026-09-26-regra-de-sinal.md) |
| 2026-09-26 | [simulador-no-fluxo-design.md](specs/2026-09-26-simulador-no-fluxo-design.md) | Simular volta como terceira opção do Fluxo. | implementada | [simulador-no-fluxo.md](plans/2026-09-27-simulador-no-fluxo.md) |
| 2026-09-28 | [analises-por-periodo-design.md](specs/2026-09-28-analises-por-periodo-design.md) | Análises por período (12 meses, ano, intervalo livre) e barra fixa sob o topo. | implementada | [analises-por-periodo.md](plans/2026-09-28-analises-por-periodo.md) |
| 2026-09-28 | [categorias-cartao-analises-design.md](specs/2026-09-28-categorias-cartao-analises-design.md) | Card de categorias do cartão na aba Análises. | implementada | [categorias-cartao-analises.md](plans/2026-09-28-categorias-cartao-analises.md) |
| 2026-09-30 | [banco-no-lancamento-design.md](specs/2026-09-30-banco-no-lancamento-design.md) | Banco em cada lançamento, banco padrão, saldo calculado e filtro por banco. | implementada | [banco-no-lancamento.md](plans/2026-09-30-banco-no-lancamento.md) |
| 2026-09-30 | [contraste-saldo-verde-design.md](specs/2026-09-30-contraste-saldo-verde-design.md) | Aumentar o contraste de `--total-pos` no totalizador do dia, mudando o verde de `#008000` para `#4ade80`. | implementada | — |
| 2026-09-30 | [fatura-nubank-csv-design.md](specs/2026-09-30-fatura-nubank-csv-design.md) | Importar e conferir lê a fatura do cartão Nubank em CSV. | implementada | [fatura-nubank-csv.md](plans/2026-09-30-fatura-nubank-csv.md) |
| 2026-09-30 | [periodo-simular-design.md](specs/2026-09-30-periodo-simular-design.md) | Seletor de período de até 60 meses no Simular e tabela com 12 meses de altura. | implementada | [periodo-simular.md](plans/2026-09-30-periodo-simular.md) |
| 2026-10-01 | [casa-confere-e-simula-design.md](specs/2026-10-01-casa-confere-e-simula-design.md) | A casa confere por box e cada visão tem os seus cenários. | implementada | [casa-confere-e-simula.md](plans/2026-10-01-casa-confere-e-simula.md) |
| 2026-10-01 | [casa-mostra-de-onde-vem-design.md](specs/2026-10-01-casa-mostra-de-onde-vem-design.md) | A casa mostra a box de origem de cada lançamento e de cada cartão. | implementada | [casa-mostra-de-onde-vem.md](plans/2026-10-01-casa-mostra-de-onde-vem.md) |
| 2026-10-01 | [casa-sem-duplicar-design.md](specs/2026-10-01-casa-sem-duplicar-design.md) | A casa junta categorias de mesmo nome e pede uma box nas telas por box. | implementada | [casa-sem-duplicar.md](plans/2026-10-01-casa-sem-duplicar.md) |
| 2026-10-01 | [modo-simples-avancado-design.md](specs/2026-10-01-modo-simples-avancado-design.md) | Modo Simples e Avançado por tela, com Simples como padrão no app novo. | implementada | [modo-simples-avancado.md](plans/2026-10-01-modo-simples-avancado.md) |
| 2026-10-08 | [lancamento-repetido-design.md](specs/2026-10-08-lancamento-repetido-design.md) | Aviso ao lançar um valor igual a outro do mesmo dia, na mesma box e na mesma categoria. | implementada | — |
| 2026-10-08 | [compra-repetida-design.md](specs/2026-10-08-compra-repetida-design.md) | Aviso ao salvar uma compra no cartão igual a outra (cartão, data, valor, parcelas e categoria). | implementada | — |

## Planos

| Data | Plano | Tema | Situação | Spec |
|---|---|---|---|---|
| 2026-07-02 | [flow-app.md](plans/2026-07-02-flow-app.md) | Implementação da primeira versão do Flow. | implementada | [flow-app-design.md](specs/2026-07-02-flow-app-design.md) |
| 2026-07-04 | [cartao-credito.md](plans/2026-07-04-cartao-credito.md) | Implementação da aba Cartão de Crédito. | implementada | [cartao-credito-design.md](specs/2026-07-04-cartao-credito-design.md) |
| 2026-07-05 | [redesign-visual.md](plans/2026-07-05-redesign-visual.md) | Implementação do redesign dark-first. | implementada | [redesign-visual-design.md](specs/2026-07-05-redesign-visual-design.md) |
| 2026-07-08 | [cartao-categoria-oculta.md](plans/2026-07-08-cartao-categoria-oculta.md) | Implementação da categoria de fatura automática e oculta. | implementada | [cartao-categoria-oculta-design.md](specs/2026-07-08-cartao-categoria-oculta-design.md) |
| 2026-07-08 | [cartao-popup-adicionar.md](plans/2026-07-08-cartao-popup-adicionar.md) | Implementação do popup unificado "Adicionar". | implementada | [cartao-popup-adicionar-design.md](specs/2026-07-08-cartao-popup-adicionar-design.md) |
| 2026-07-08 | [drilldown-lancamentos-analises.md](plans/2026-07-08-drilldown-lancamentos-analises.md) | Implementação do drill-down de lançamentos em Análises. | implementada | [drilldown-lancamentos-analises-design.md](specs/2026-07-08-drilldown-lancamentos-analises-design.md) |
| 2026-07-08 | [grafico-fluxo-pan-zoom.md](plans/2026-07-08-grafico-fluxo-pan-zoom.md) | Implementação do pan/zoom no gráfico de saldo expandido. | implementada | [grafico-fluxo-pan-zoom-design.md](specs/2026-07-08-grafico-fluxo-pan-zoom-design.md) |
| 2026-07-10 | [fluxo-linha-hoje-fixa.md](plans/2026-07-10-fluxo-linha-hoje-fixa.md) | Implementação da linha de hoje fixa no Fluxo. | implementada | [fluxo-linha-hoje-fixa-design.md](specs/2026-07-10-fluxo-linha-hoje-fixa-design.md) |
| 2026-07-10 | [guia-estilo-por-niveis.md](plans/2026-07-10-guia-estilo-por-niveis.md) | Implementação da reestruturação do guia de estilo por níveis. | implementada | [guia-estilo-por-niveis-design.md](specs/2026-07-10-guia-estilo-por-niveis-design.md) |
| 2026-07-10 | [ordenacao-categorias.md](plans/2026-07-10-ordenacao-categorias.md) | Implementação da ordenação de categorias na fonte. | implementada | [ordenacao-categorias-design.md](specs/2026-07-10-ordenacao-categorias-design.md) |
| 2026-07-17 | [campo-valor-caixa-eletronico.md](plans/2026-07-17-campo-valor-caixa-eletronico.md) | Componente `CampoValor` compartilhado (input de valor "estilo caixa eletrônico"), substituindo parsing duplicado em 9 telas. | implementada | — |
| 2026-07-19 | [arrastar-categorias.md](plans/2026-07-19-arrastar-categorias.md) | Implementação do arraste para reordenar categorias. | implementada | [arrastar-categorias-design.md](specs/2026-07-19-arrastar-categorias-design.md) |
| 2026-07-22 | [ajustes-recorrencias-cartoes.md](plans/2026-07-22-ajustes-recorrencias-cartoes.md) | Implementação dos 6 ajustes de Recorrências/Cartões/Categorias do cartão/Assinaturas. | implementada | [ajustes-recorrencias-cartoes-design.md](specs/2026-07-22-ajustes-recorrencias-cartoes-design.md) |
| 2026-07-23 | [graficos-aba-analises.md](plans/2026-07-23-graficos-aba-analises.md) | Implementação dos gráficos e responsividade da aba Análises. | implementada | [graficos-aba-analises-design.md](specs/2026-07-23-graficos-aba-analises-design.md) |
| 2026-07-25 | [sincronizar-documentacao.md](plans/2026-07-25-sincronizar-documentacao.md) | Corrige documentação desatualizada, documenta as guardas automáticas do repositório e cria o `README.md` da raiz. | implementada | — |
| 2026-07-25 | [wiki-no-app.md](plans/2026-07-25-wiki-no-app.md) | Implementação da wiki dentro do app (v0.14.0). | implementada | — |
| 2026-07-26 | [primeiro-uso-guiado.md](plans/2026-07-26-primeiro-uso-guiado.md) | Implementação do primeiro preenchimento guiado (v0.15.0). | implementada | — |
| 2026-08-03 | [confirmacao-exclusao-lancamentos.md](plans/2026-08-03-confirmacao-exclusao-lancamentos.md) | Implementação da confirmação ao excluir e descartar. | implementada | [confirmacao-exclusao-lancamentos-design.md](specs/2026-08-03-confirmacao-exclusao-lancamentos-design.md) |
| 2026-08-05 | [bancos-na-box.md](plans/2026-08-05-bancos-na-box.md) | Implementação da entrega 1 dos bancos. | implementada | [bancos-na-box-design.md](specs/2026-08-05-bancos-na-box-design.md) |
| 2026-08-10 | [dossie-comportamento.md](plans/2026-08-10-dossie-comportamento.md) | Implementação do dossiê e do guarda que o mantém atualizado. | implementada | [dossie-comportamento-design.md](specs/2026-08-10-dossie-comportamento-design.md) |
| 2026-08-20 | [changelog-niveis.md](plans/2026-08-20-changelog-niveis.md) | Implementação do changelog em dois níveis. | implementada | [changelog-niveis-design.md](specs/2026-08-20-changelog-niveis-design.md) |
| 2026-08-20 | [lancamentos-frequentes.md](plans/2026-08-20-lancamentos-frequentes.md) | Implementação dos atalhos de lançamentos frequentes. | implementada | [lancamentos-frequentes-design.md](specs/2026-08-20-lancamentos-frequentes-design.md) |
| 2026-08-27 | [confirmar-pendente-outro-valor.md](plans/2026-08-27-confirmar-pendente-outro-valor.md) | Implementação da confirmação de pendente com outro valor. | implementada | [confirmar-pendente-outro-valor-design.md](specs/2026-08-27-confirmar-pendente-outro-valor-design.md) |
| 2026-08-29 | [compra-por-nota-fiscal.md](plans/2026-08-29-compra-por-nota-fiscal.md) | Implementação da compra por nota fiscal. | implementada | [compra-por-nota-fiscal-design.md](specs/2026-08-29-compra-por-nota-fiscal-design.md) |
| 2026-09-02 | [ajuste-fechamento-fatura.md](plans/2026-09-02-ajuste-fechamento-fatura.md) | Implementação do ajuste de fechamento. | implementada | [ajuste-fechamento-fatura-design.md](specs/2026-09-02-ajuste-fechamento-fatura-design.md) |
| 2026-09-02 | [itens-da-nota-fiscal.md](plans/2026-09-02-itens-da-nota-fiscal.md) | Implementação dos itens da nota fiscal. | implementada | [itens-da-nota-fiscal-design.md](specs/2026-08-30-itens-da-nota-fiscal-design.md) |
| 2026-09-16 | [transferencia-entre-bancos.md](plans/2026-09-16-transferencia-entre-bancos.md) | Implementação da transferência entre bancos. | implementada | [transferencia-entre-bancos-design.md](specs/2026-09-16-transferencia-entre-bancos-design.md) |
| 2026-09-17 | [conferencia-por-extrato.md](plans/2026-09-17-conferencia-por-extrato.md) | Implementação da entrega 1 da conferência por extrato. | implementada | [conferencia-por-extrato-design.md](specs/2026-09-17-conferencia-por-extrato-design.md) |
| 2026-09-18 | [bloquear-cartao-compra.md](plans/2026-09-18-bloquear-cartao-compra.md) | Implementação do bloqueio de cartão. | implementada | [bloquear-cartao-compra-design.md](specs/2026-09-18-bloquear-cartao-compra-design.md) |
| 2026-09-23 | [consistencia-parte-2.md](plans/2026-09-23-consistencia-parte-2.md) | Implementação da parte 2 da consistência. | implementada | [consistencia-parte-2-design.md](specs/2026-09-23-consistencia-parte-2-design.md) |
| 2026-09-23 | [consistencia-parte-3-entrega-a.md](plans/2026-09-23-consistencia-parte-3-entrega-a.md) | Implementação da entrega A da parte 3 da consistência. | implementada | [consistencia-parte-3-design.md](specs/2026-09-23-consistencia-parte-3-design.md) |
| 2026-09-23 | [rodape-backup.md](plans/2026-09-23-rodape-backup.md) | Rodapé de backup sempre visível na Visão, em três estados; Ajustes → Backup com a mesma idade. | implementada | [saldo-dia-futuro-e-rodape-backup-design.md](specs/2026-09-23-saldo-dia-futuro-e-rodape-backup-design.md) |
| 2026-09-23 | [saldo-dia-futuro.md](plans/2026-09-23-saldo-dia-futuro.md) | Dia filtrado no Fluxo sempre aparece, com diferença em relação a hoje; pílula da Hoje com sinal. | implementada | [saldo-dia-futuro-e-rodape-backup-design.md](specs/2026-09-23-saldo-dia-futuro-e-rodape-backup-design.md) |
| 2026-09-23 | [wiki-hiperlinks.md](plans/2026-09-23-wiki-hiperlinks.md) | Implementação dos hiperlinks da wiki. | implementada | [wiki-hiperlinks-design.md](specs/2026-09-23-wiki-hiperlinks-design.md) |
| 2026-09-24 | [diferenca-da-fatura.md](plans/2026-09-24-diferenca-da-fatura.md) | Implementação do destino da sobra da fatura. | implementada | [diferenca-da-fatura-design.md](specs/2026-09-24-diferenca-da-fatura-design.md) |
| 2026-09-24 | [hoje-grafico-do-fluxo.md](plans/2026-09-24-hoje-grafico-do-fluxo.md) | Implementação do link da Hoje para o gráfico do Fluxo. | implementada | [hoje-grafico-expandido-design.md](specs/2026-09-24-hoje-grafico-expandido-design.md) |
| 2026-09-24 | [orcamento-de-viagem.md](plans/2026-09-24-orcamento-de-viagem.md) | Implementação do orçamento de viagem. | implementada | [orcamento-de-viagem-design.md](specs/2026-09-24-orcamento-de-viagem-design.md) |
| 2026-09-24 | [wiki-navegacao.md](plans/2026-09-24-wiki-navegacao.md) | Implementação da navegação e do texto da wiki. | implementada | [wiki-navegacao-design.md](specs/2026-09-24-wiki-navegacao-design.md) |
| 2026-09-26 | [regra-de-sinal.md](plans/2026-09-26-regra-de-sinal.md) | Implementação da regra de sinal. | implementada | [regra-de-sinal-design.md](specs/2026-09-26-regra-de-sinal-design.md) |
| 2026-09-27 | [simulador-no-fluxo.md](plans/2026-09-27-simulador-no-fluxo.md) | Implementação do Simular no Fluxo. | implementada | [simulador-no-fluxo-design.md](specs/2026-09-26-simulador-no-fluxo-design.md) |
| 2026-09-28 | [analises-por-periodo.md](plans/2026-09-28-analises-por-periodo.md) | Implementação das Análises por período. | implementada | [analises-por-periodo-design.md](specs/2026-09-28-analises-por-periodo-design.md) |
| 2026-09-28 | [categorias-cartao-analises.md](plans/2026-09-28-categorias-cartao-analises.md) | Implementação do card de categorias do cartão. | implementada | [categorias-cartao-analises-design.md](specs/2026-09-28-categorias-cartao-analises-design.md) |
| 2026-09-30 | [ajustes-finos-varredura.md](plans/2026-09-30-ajustes-finos-varredura.md) | Ajustes finos da varredura de boxes (v0.56.0). | implementada | — |
| 2026-09-30 | [banco-no-lancamento.md](plans/2026-09-30-banco-no-lancamento.md) | Implementação do banco no lançamento. | implementada | [banco-no-lancamento-design.md](specs/2026-09-30-banco-no-lancamento-design.md) |
| 2026-09-30 | [fatura-nubank-csv.md](plans/2026-09-30-fatura-nubank-csv.md) | Implementação do leitor da fatura Nubank em CSV. | implementada | [fatura-nubank-csv-design.md](specs/2026-09-30-fatura-nubank-csv-design.md) |
| 2026-09-30 | [periodo-simular.md](plans/2026-09-30-periodo-simular.md) | Implementação do período do Simular. | implementada | [periodo-simular-design.md](specs/2026-09-30-periodo-simular-design.md) |
| 2026-10-01 | [casa-confere-e-simula.md](plans/2026-10-01-casa-confere-e-simula.md) | Implementação da entrega C da casa. | implementada | [casa-confere-e-simula-design.md](specs/2026-10-01-casa-confere-e-simula-design.md) |
| 2026-10-01 | [casa-mostra-de-onde-vem.md](plans/2026-10-01-casa-mostra-de-onde-vem.md) | Implementação da entrega A da casa. | implementada | [casa-mostra-de-onde-vem-design.md](specs/2026-10-01-casa-mostra-de-onde-vem-design.md) |
| 2026-10-01 | [casa-sem-duplicar.md](plans/2026-10-01-casa-sem-duplicar.md) | Implementação da entrega B da casa. | implementada | [casa-sem-duplicar-design.md](specs/2026-10-01-casa-sem-duplicar-design.md) |
| 2026-10-01 | [modo-simples-avancado.md](plans/2026-10-01-modo-simples-avancado.md) | Implementação dos modos Simples e Avançado. | implementada | [modo-simples-avancado-design.md](specs/2026-10-01-modo-simples-avancado-design.md) |
