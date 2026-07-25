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
| 2026-07-18 | [cor-total-dia-fluxo-design.md](specs/2026-07-18-cor-total-dia-fluxo-design.md) | Tokens de cor próprios (`--total-pos`/`--total-neg`) pro totalizador do dia no Fluxo. | implementada | — |
| 2026-07-19 | [arrastar-categorias-design.md](specs/2026-07-19-arrastar-categorias-design.md) | Reordenar categorias por arraste (alça), no lugar dos botões ↑/↓. | implementada | [arrastar-categorias.md](plans/2026-07-19-arrastar-categorias.md) |
| 2026-07-22 | [ajustes-recorrencias-cartoes-design.md](specs/2026-07-22-ajustes-recorrencias-cartoes-design.md) | Escopa Recorrências por box, permite múltiplos cartões ativos por box, categoria "Assinaturas" automática, seletores de categoria/cartão viram grid de botões. | implementada | [ajustes-recorrencias-cartoes.md](plans/2026-07-22-ajustes-recorrencias-cartoes.md) |
| 2026-07-23 | [alcinha-branca-design.md](specs/2026-07-23-alcinha-branca-design.md) | Alcinha de arrastar dos sheets vira branco puro (token `--alca`). | implementada | — |
| 2026-07-23 | [cor-min-max-grafico-design.md](specs/2026-07-23-cor-min-max-grafico-design.md) | Mín/máx do rodapé dos gráficos ganha cor conforme o próprio sinal. | implementada | — |
| 2026-07-23 | [enforcement-orientacoes-design.md](specs/2026-07-23-enforcement-orientacoes-design.md) | Enforcement automático das orientações do repositório (guards de release/deploy/catálogo, hooks, CI). | implementada | — |
| 2026-07-23 | [graficos-aba-analises-design.md](specs/2026-07-23-graficos-aba-analises-design.md) | Gráficos (composição por categoria, evolução mensal) e responsividade na aba Análises. | implementada | [graficos-aba-analises.md](plans/2026-07-23-graficos-aba-analises.md) |
| 2026-07-24 | [perfil-box-global-design.md](specs/2026-07-24-perfil-box-global-design.md) | Chip de box do topo vira única fonte de seleção de box no app inteiro. | implementada | — |

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
