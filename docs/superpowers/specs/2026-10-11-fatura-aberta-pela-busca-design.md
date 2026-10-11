# Fatura aberta pela busca

Status: implementada. O usuário aprovou o mockup (opção A) no chat em 2026-10-11 e pediu para seguir até o fragmento de changelog; esta spec não passou por revisão separada.
Nota: vem da varredura de usabilidade das buscas, feita com Playwright no viewport do Galaxy S25+.

## Problema

- Em uma fatura longa, o link "Ver fatura completa na aba Cartão" ficava no fim da lista, fora da vista.
- O link só trocava de aba. A aba Cartão abria no primeiro cartão e no mês atual, não na fatura que a pessoa via.
- A fatura achada pela busca do Fluxo abria sem mostrar qual compra bateu.

## Mudanças

- **Link no cabeçalho fixo.** Na folha da fatura (Fluxo) e na folha por categoria (Análises), o link fica sob o total, no cabeçalho que não rola. Texto igual ao de antes.
- **Destino certo.** O link pede a aba Cartão com `cartaoPedido { cartaoId, mes, busca? }`, no store. A `TelaCartao` lê o pedido na chegada e o descarta. O pedido vale só para a primeira montagem daquele cartão: trocar de cartão no seletor o descarta.
- **Cartão inativo.** Ele também gera fatura no Fluxo. O pedido o inclui na lista, para a aba não abrir outro cartão.
- **Grupo "Encontrado na busca".** Na folha do Fluxo, as compras que batem com a busca sobem para esse grupo, com o destaque `.item.ativo`. As demais ficam sob "À vista" e "Parceladas". Se a busca bateu só no lançamento da fatura (o nome do cartão, por exemplo), não há grupo.
- **Aba Cartão chega filtrada.** Com compra achada, a aba abre em Lançamentos, com o campo de busca preenchido. No modo Simples, o pedido define só o cartão e o mês.
- **Regra única de busca.** `itemFaturaBate` (`src/domain/buscaFatura.ts`) serve ao Cartão, ao Fluxo e à folha. A busca do Fluxo passa a achar compras da fatura também pela data (`dd/mm/aaaa`), como a aba Cartão já fazia.

## Fora do escopo

- O botão Voltar do Android fechar a folha (hoje sai do app).
- Busca sem acento, valor sem ponto de milhar, janela de 14 dias, indicador de busca ativa e teclado cobrindo os resultados. Ficam para o branch de busca.
