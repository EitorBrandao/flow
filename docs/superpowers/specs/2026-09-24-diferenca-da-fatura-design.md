# Diferença da fatura: para onde vai o que sobrou (item 20)

Data: 2026-09-24. Branch: `diferenca-fatura`.

## Problema

Pagar a fatura por um valor menor que o total deixa uma sobra. Hoje, a sobra só volta à
projeção se o usuário preencher o parcelamento. O campo "Parcelas" começa em `2` e o "Valor
de cada parcela" em zero. Quem só toca em "Confirmar pagamento" perde a sobra da projeção. O
aviso em destaque ajuda, mas o padrão continua sendo o que perde dinheiro.

Pagar a mais também não tem tratamento: a folha mostra "Restou da fatura" negativo e nada
mais.

## Escopo

Decidido com o usuário em 2026-09-24:

- **Só a folha de pagamento** (`PagamentoFaturaSheet`). A Conferência do Cartão não entra: ali
  "usar o valor do app" já corrige a projeção do mês, e a diferença é compra que falta ou
  estorno, não sobra que passa de mês. O Fluxo continua só leitura.
- **Três pílulas, com "Mês seguinte" já marcada** quando sobra valor.
- **Pagou a mais: só avisa.** O crédito na próxima fatura depende de valor negativo no cartão
  (item 11).

Fica fora: juros calculados pelo app (decidido em 2026-08-27: quem informa é o usuário),
estorno, mudança de schema.

## Pontos de entrada

As três telas abrem o mesmo componente. Por isso, a mudança chega igual a todas:

- `TelaHoje.tsx` — Pendentes → "Paguei outro valor".
- `TelaCartao.tsx` — aviso "não chegaram no Fluxo" → "Corrigir o valor pago".
- `FaturaResumo.tsx` — pagamento a partir do resumo da fatura.

## Comportamento

`restante = total da fatura − valor pago` (`resumoParcelamento`, sem mudança).

### Sobrou valor (`restante > 0`)

Depois de "Quanto você pagou" e "Quando pagou", aparece o rótulo
**"O que acontece com os R$ X que sobraram?"** e um `SeletorPills` com três opções:

| Pílula | Campos | Resumo | Gravação |
|---|---|---|---|
| **Mês seguinte** | "Valor na próxima fatura", pré-preenchido com o restante, editável | Restou da fatura · Na próxima fatura · Juros | compra de 1 parcela, `valorTotal` = valor digitado |
| **Parcelei** | Parcelas + Valor de cada parcela (os de hoje) | Restou da fatura · N × parcela · Juros | compra de N parcelas (como hoje) |
| **Não volta** | nenhum | Restou da fatura | nada além do pagamento |

- "Juros" segue a regra de hoje: `sem juros` quando zero, o valor quando positivo, "Faltam"
  quando negativo.
- Em **Não volta**, o aviso de hoje continua, sem a frase sobre preencher o parcelamento:
  "Os R$ X que sobraram **somem da projeção** — não voltam em nenhuma fatura. Use esta opção
  para desconto ou estorno."
- Em **Parcelei** com o valor da parcela zerado, o aviso de "somem da projeção" também aparece,
  como hoje.
- Em **Mês seguinte** com o valor zerado, vale o mesmo aviso: nada vai para a próxima fatura.

### Pílula marcada ao abrir

- Padrão: **Mês seguinte**.
- Exceção: a fatura já tem restante ou parcelamento gravado (compra na categoria reservada de
  parcelamento do cartão, com `data` igual ao fechamento dessa fatura). Nesse caso a folha
  marca **Não volta** e mostra, acima das pílulas: "Já lançado na próxima fatura:
  **R$ Y**." Isso evita um segundo restante ao corrigir uma fatura já paga. Nesse caso, "Não
  volta" **não** mostra o aviso "somem da projeção": o valor já está na próxima fatura, e o
  aviso mentiria.

A regra de "já lançado" é a mesma que `faturaForaDoFluxo` usa hoje
(`fatura.ts`, filtro `categoriaParcelamentoId` + `dataFechamento`). Extrair esse filtro para
uma função de domínio (`jaLancadoDaFatura`) e usá-la nos dois lugares, para as duas telas
nunca discordarem.

### Pagou a mais (`restante < 0`)

Sem pílulas. Aviso (classe `.aviso`):
"Você pagou **R$ X a mais** que a fatura. O banco costuma abater da próxima fatura; o Flow
ainda não registra esse crédito."

### Pagou exatamente (`restante = 0`)

Sem mudança.

## Gravação

Sem mudança de schema, de backup ou de `registrarPagamentoFatura`, exceto a descrição:

- **Mês seguinte** chama `registrarPagamentoFatura` com
  `parcelamento: { parcelas: 1, valorParcelaCent: valorDigitado }`.
- A descrição da compra passa a depender do número de parcelas:
  - 1 parcela: `Restante da fatura de MM/AAAA`.
  - 2 ou mais: `Parcelamento da fatura de MM/AAAA` (como hoje).

A compra tem a data do fechamento da fatura paga. Por isso, a parcela única cai na fatura
seguinte — o mesmo caminho do parcelamento, já testado.

## Consistência

- O aviso "não chegaram no Fluxo" (`faturaForaDoFluxo`) já desconta o que está na categoria
  de parcelamento. O restante entra nela, então o aviso continua correto sem mudança.
- Frases seguem as da folha atual ("Restou da fatura", "somem da projeção").

## Testes

- Cada pílula grava o que a tabela diz (compra com 1 parcela, N parcelas, nenhuma).
- "Mês seguinte" com valor editado acima do restante mostra juros e grava o valor editado.
- "Mês seguinte" com valor zerado não grava compra e mostra o aviso.
- Descrição: 1 parcela → "Restante…"; 2+ → "Parcelamento…".
- Pagou a mais: mostra o aviso, não mostra pílulas, não grava compra.
- Pagou exatamente: sem pílulas, sem aviso.
- Fatura com restante já gravado: abre em "Não volta", mostra "Já lançado", salvar não
  duplica.
- `jaLancadoDaFatura`: soma só a categoria de parcelamento do cartão e só a data de fechamento
  daquela fatura; cartão sem categoria de parcelamento → zero.

## Entrega

- Mockup aprovado antes do código (classes reais de `src/styles.css`).
- Fragmento `alterado-...` em `changelog.d/`.
- Wiki: `docs/wiki/5-cartao.md`, seção "Pagar a fatura: valor, data e parcelamento".
- Catálogo: sem classe nova prevista; `SeletorPills` passa a ser usado também em
  `PagamentoFaturaSheet.tsx` — atualizar a lista de uso em `docs/estilo/catalogo.md`.
