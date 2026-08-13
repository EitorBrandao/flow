---
name: revisar-dossie
description: Use ao ler o dossiê de comportamento do Flow (docs/dossie/) — para julgar o que um branch mudou no comportamento do app antes do merge, ou para fazer uma varredura larga procurando o implausível.
---

# Revisar o dossiê de comportamento

`docs/dossie/` descreve o app inteiro em ação: um roteiro sintético de 12 meses, rodado pelo
motor de verdade, com o texto de cada tela capturado em seis cortes de tempo. É gerado por
`npm run dossie` — nunca edite os quatro arquivos à mão. Um conflito de merge neles se resolve
regenerando, não no editor.

Esta skill tem dois recortes. Use um ou outro, conforme o pedido.

## Recorte por branch

Entrada: `git diff main...HEAD -- docs/dossie/`, mais a intenção declarada do branch.

Uma pergunta só: **cada mudança de comportamento era pretendida?** O achado que importa é
mudança fora do escopo declarado — um número, uma tela ou um invariante que mudou sem que o
branch tivesse motivo para mexer ali.

Saída: uma lista curta. Cada item aponta o arquivo e o trecho do diff.

Diff vazio é resultado legítimo, e vale dizer em voz alta: "o branch não mudou comportamento
nenhum" é informação, não silêncio.

## Varredura larga

Entrada: os quatro arquivos inteiros, sem baseline.

Procura o implausível: fatura com item repetido, categoria arquivada aparecendo num seletor,
salto de saldo sem lançamento que explique, tela com estado vazio onde há dado.

## O que não fazer

- **Não repita o que os invariantes já checaram.** `01-invariantes.md` lista o resultado de
  cada invariante do domínio, por corte. Um invariante **garantido** violado já reprovou
  `npm test` — isso é determinístico, e chegar ao dossiê significa que já passou. Um invariante
  de **expectativa** violado é achado real: o app nunca prometeu evitá-lo, e é exatamente o
  tipo de coisa que precisa do olhar humano.
- **Não opine sobre estilo de código.** O dossiê é sobre comportamento, não sobre como o
  código chegou lá.

## Limites de cobertura

O dossiê não mostra tudo. Leia o silêncio com esses limites em mente:

- Só seis abas entram: `hoje`, `fluxo`, `cartao`, `analises`, `lancar`, `ajustes`. Sheets e
  subtelas de Ajustes ficam de fora.
- Cada tela é capturada com a box que o app selecionaria ao abrir — uma box concreta. A visão
  consolidada (`casa`, todas as boxes somadas) não é exercitada.
- O roteiro tem seis cortes no tempo. Nenhum cai na janela em que o cenário do roteiro está
  ligado. Por isso o dossiê nunca mostra o efeito de um cenário ligado na projeção.
