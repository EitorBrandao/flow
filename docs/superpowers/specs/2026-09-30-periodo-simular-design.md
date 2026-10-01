# Período do Simular e tabela com rolagem

Data: 2026-09-30. Mockup aprovado pelo usuário no chat (v2).

## Objetivo

1. Escolher o período da tabela do Simular, com no máximo 60 meses (5 anos).
2. Trocar o mês com facilidade: setas ‹ › e seletores de mês e de ano.
3. Mostrar 12 meses de altura na tabela e rolar na vertical. Isso também fecha o item 32 do `TODO.md` (compactar a tabela de impacto do cenário).

## Comportamento

### Seletor de período (`SeletorPeriodoSimular`)

- Fica no topo de Fluxo › Simular, num card, acima de "Cenários ligados".
- Duas linhas: "de" e "até". Cada linha tem `‹`, um seletor de mês, um seletor de ano e `›`.
- Abaixo das linhas, o contador: "N meses · máximo de 60".
- O padrão é do mês de hoje até o fim do horizonte do app (`config.horizonteProjecao`).
- O estado é local da tela. Não é gravado no banco. Ao sair da aba, volta ao padrão.
- O mês inicial nunca é anterior ao mês de hoje. Os anos oferecidos vão do ano de hoje até hoje + 5.
- Regras de ajuste, na mesma lógica de `ajustarDe` e `ajustarAte` (`src/domain/periodo.ts`):
  - Mover o início além do fim arrasta o fim.
  - Mover o fim antes do início arrasta o início, respeitando o mês de hoje como piso.
  - Passar de 60 meses move a outra ponta.
- `MAX_MESES_PERIODO` (24) é das Análises. O Simular usa uma constante própria, `MAX_MESES_SIMULACAO = 60`, em `src/domain/simulacao.ts`.

### Projeção além do horizonte

- As recorrências só existem no banco até `config.horizonteProjecao`.
- Para períodos mais longos, o Simular calcula as ocorrências que faltam **em memória**. Não grava nada. Nenhuma outra tela muda.
- Nova função pura `estenderRecorrencias(dados, ate)` em `src/domain/simulacao.ts`:
  - Para cada recorrência ativa (de cenário ou não), usa `ocorrencias(rec, ate)`.
  - Cria lançamentos `previsto` sintéticos só para datas **maiores** que `config.horizonteProjecao`. Os ids são sintéticos e estáveis (`ext-<recId>-<data>`).
  - Respeita `cenarioId`, `boxId`, `categoriaId`, `valor` e `bancoId` da recorrência.
- O Simular chama `projetarBoxes` com `horizonte = fim do período` e os lançamentos reais mais os sintéticos.
- Limite conhecido: faturas de cartão (`origem: 'cartao'`) não são estendidas. Elas seguem o horizonte do app. O texto da tela avisa disso quando o período passa do horizonte: "Depois de {mês do horizonte}, a tabela não inclui faturas de cartão."
- Se a série vier mais curta que o período (sem lançamentos), a tabela mostra só os meses que existem.

### Tabela com 12 meses de altura (`TabelaSimulacao`)

- O contêiner da tabela ganha a classe nova `.rolavel-12`: altura máxima de 12 linhas mais o cabeçalho, com `overflow-y: auto`.
- O cabeçalho (`th`) fica fixo no topo da área que rola. A coluna do mês continua fixa à esquerda. O canto (`th:first-child`) fica acima das duas camadas.
- Com 12 meses ou menos, não há barra de rolagem.
- Vale para as duas tabelas: a combinada e a de cada cenário (`CenarioCard`). As duas mostram o mesmo conceito e ficam iguais.
- O resumo "saldo fica negativo em…" e "segue positivo até…" usa o período escolhido, não só os 12 meses visíveis.
- A altura da linha é medida no navegador durante a implementação. O valor usado no mockup (37 px) é uma estimativa.

### Tabela minimizável

- As duas tabelas (a combinada e a de cada cenário) têm um botão no cabeçalho da seção, no mesmo desenho do cabeçalho do `CenarioCard`: título à esquerda e `▲`/`▼` à direita, com `aria-expanded`.
- Minimizada, a seção esconde só a tabela e a legenda. O título e o resumo ("saldo fica negativo em…", "segue positivo até…") continuam visíveis.
- Padrão: as duas começam abertas, como hoje.
- O estado é local e independente por tabela. Não é gravado. Fechar o card do cenário e abri-lo de novo mantém o estado da sua tabela enquanto a tela estiver aberta.
- Classes: usa as existentes. Nenhuma classe nova além de `.rolavel-12`.

### Cálculo por período

- `resumoMensal(serie, hoje)` passa a receber o mês inicial e o final: `resumoMensal(serie, de, ate)`. Quem chama hoje: `SimuladorFluxo.tsx`. Confirmar por grep antes de mudar a assinatura.
- A largura das colunas (`larguraColunaValor`) usa os meses do período escolhido.
- Pontos de chamada de `projetarBoxes` no Simular: um por cenário e um combinado, todos em `useMemo`. O `useMemo` ganha o período como dependência.

## Consistência entre telas

- O seletor segue o desenho do `SeletorPeriodo` das Análises (linhas "de" e "até", contador "N meses · máximo de N"). A diferença é a adição dos seletores de mês e ano.
- O seletor de mês e ano é novo. Não cria divergência com as Análises: o texto, o sinal e a cor são os mesmos. Mudar as Análises para usar os seletores fica fora deste escopo. Avisar o usuário na entrega.
- As tabelas do Simular (combinada e do cenário) seguem iguais entre si.

## Arquivos

- `src/domain/simulacao.ts`: `MAX_MESES_SIMULACAO`, `estenderRecorrencias`, `resumoMensal` com período.
- `src/ui/SeletorPeriodoSimular.tsx` (novo): as duas linhas, o contador e o aviso.
- `src/ui/SimuladorFluxo.tsx`: estado do período e `calc`.
- `src/ui/TabelaSimulacao.tsx` e `src/ui/CenarioCard.tsx`: classe `.rolavel-12`.
- `src/styles.css`: `.rolavel-12`. Catalogar em `docs/estilo/catalogo.md`, junto com `SeletorPeriodoSimular`.
- `docs/wiki/`: atualizar o capítulo do Simular.
- `changelog.d/`: fragmentos `adicionado-periodo-simular.md` e `alterado-tabela-simular-rolagem.md`.
- `docs/dossie/`: regenerar com `npm run dossie`, numa tarefa final.

## Testes

- `estenderRecorrencias`: recorrência mensal sem fim; parcelada que termina antes do horizonte (não cria nada); parcelada que cruza o horizonte; recorrência inativa; recorrência de cenário; dia 31 em mês curto; `ate` menor que o horizonte (não cria nada); sem duplicar datas que já existem.
- `resumoMensal` com período: início depois de hoje; fim antes do fim da série; período de um mês.
- Ajuste do período: início além do fim; fim antes do início; teto de 60 meses; piso no mês de hoje.
- UI: minimizar e reabrir cada tabela (combinada e de cenário), com o resumo sempre visível; setas, seletores, contador, aviso das faturas, rolagem presente só acima de 12 meses, as duas tabelas com a classe.
- Varredura com Playwright no Galaxy S25+ (411 × 744), dados sintéticos, só em `localhost`.

## Fora do escopo

- Subir o horizonte global do app.
- Estender faturas de cartão além do horizonte.
- Trocar o seletor das Análises.
- Guardar o período escolhido.
