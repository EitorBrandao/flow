# Flow — Pan/zoom no gráfico de saldo expandido (aba Fluxo)

**Data:** 2026-07-08
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Contexto

Esta spec **estende e substitui partes** de `2026-07-05-grafico-fluxo-expandido-design.md`
(gráfico expandido em modal de tela cheia, aberto ao clicar no `BalanceChart` da aba Fluxo).
Nenhum código daquela spec foi implementado ainda — este documento é a versão final a
implementar, incorporando as mudanças abaixo.

O usuário trouxe 3 prints de um app de acompanhamento de peso cujo gráfico de linha
dinâmico permite pinça pra dar zoom e arrastar pra navegar no tempo, mostrando o mesmo
período (163 dias) em diferentes níveis de detalhe. Ele quer esse comportamento de
pan/zoom no gráfico expandido do Flow — item que a spec de 05/07 tinha explicitamente
marcado como fora de escopo.

**O que continua igual à spec de 05/07** (não repetido em detalhe aqui): `recharts` como
dependência nova, usada só no modal, `React.lazy`-loaded; `FluxoChartModal.tsx` como
componente novo e independente do `Sheet.tsx`; three séries (passado sólido, futuro
tracejado, cenário pontilhado) com gradiente reaproveitando `var(--pos)`; fecha só por
botão X ou tecla Escape, nunca ao tocar fora; sem eixo Y visível.

**O que esta spec substitui:** toda a seção "Seleção e readout" (o scrub baseado em
`onMouseMove`/`onTouchMove` sem pan) e a exclusão de "zoom/pan além do scrub" do "Fora de
escopo".

## Decisões

- **Sem suavização de curva.** Ao contrário da referência (peso corporal, onde a suavização
  disfarça ruído de medição), o saldo diário é um valor exato — segmentos retos ponto-a-ponto,
  igual ao `BalanceChart` atual.
- **Diferença deliberada da referência:** no app de peso, o card "Within N Days" ficava fixo
  (série inteira) enquanto só o gráfico navegava. O Flow não tem esse card separado — o
  rótulo de período e o rodapé mín/máx *são* a estatística visível, então esses dois
  acompanham a janela visível, mudando a cada pan/zoom (ver "Modelo de dados e estado").
- **Estado inicial:** janela de 30 dias antes + 30 depois de hoje, clampada aos limites reais
  da série (série mais curta que 60 dias abre inteira).
- **Zoom mínimo (mais próximo): 14 dias visíveis.** Zoom máximo (mais afastado): a série
  inteira — não há zoom-out além dos dados carregados.
- **Rótulo de período no topo do modal** (`dd/mm – dd/mm`), atualiza a cada pan/zoom.
- **Rodapé mín/máx passa a refletir a janela visível**, não a série inteira — diferente do
  mini-`BalanceChart` (que continua com semântica de série inteira, inalterado).

## Modelo de dados e estado (`FluxoChartModal.tsx`)

- Recebe a mesma `serie: DiaSaldo[]` inteira já calculada em `TelaFluxo` (não recomputa).
- Tipo `Janela = { inicioIdx: number; fimIdx: number }` — índices sobre `serie`. Estado
  `janela: Janela` no componente.
- `serieVisivel = serie.slice(inicioIdx, fimIdx + 1)` é o que alimenta o `<AreaChart>` do
  Recharts a cada render; o Recharts recalcula ticks do eixo X sozinho a cada fatia nova.
- Estado `selecionado: ISODate | null` — guarda a **data**, não o índice (estável se a janela
  mudar). Inicia na data de hoje.
- Deriva a cada mudança de `janela`: rótulo de período (primeira/última data de
  `serieVisivel`) e mín/máx exibidos no rodapé — `Math.min(...valores)` / `Math.max(...valores)`
  sobre `serieVisivel`, **sem** forçar inclusão do 0 (diferente do domínio do eixo Y, que força
  0 à parte só para manter a linha de referência visível no gráfico).
- O crosshair do `selecionado` (linha + ponto em destaque) só é desenhado quando a data cai
  dentro de `serieVisivel`; fora da janela visível, o readout continua mostrando o valor
  daquele dia (o dado não muda, só o marcador visual some do gráfico).

## Gestos

Resolve o conflito entre "arrastar seleciona um dia" (proposta original de 05/07) e
"arrastar navega no tempo" (pedido dos prints): **os dois convivem, diferenciados por
clique simples vs. clique duplo.**

- **Clique/toque + arraste = scrub.** A cada movimento com 1 ponteiro ativo, recalcula o
  índice de `serieVisivel` mais próximo da posição X e atualiza `selecionado` + o readout,
  ao vivo. Um clique sem arrastar é só o caso degenerado (seleciona o ponto tocado).
- **Clique duplo + arraste = pan.** Um novo `pointerdown` que ocorre a menos de 350ms e 24px
  do `pointerup` anterior inicia o modo pan; a partir daí, mover desloca `janela` (mesmo
  tamanho de intervalo) sem alterar `selecionado`. Fora dessa janela de tempo/distância, o
  novo clique é só mais um scrub independente — não há estado de erro, é o caminho comum.
- **Pinça (2 ponteiros simultâneos):** zoom ancorado no ponto médio entre os dois toques.
- **Scroll do mouse:** zoom ancorado na posição do cursor — equivalente desktop da pinça
  (não há gesto de 2 dedos em mouse).
- Zoom (pinça ou wheel) sempre clampado entre 14 dias e o tamanho da série inteira; pan
  sempre clampado para não deslocar `janela` para fora de `[0, serie.length - 1]`.

### Extração para testabilidade

A matemática de janela (clamp, zoom ancorado, pan nos limites) fica em um módulo puro
`src/ui/chartGestures.ts` — sem DOM, sem eventos — para ser testada diretamente, sem precisar
simular `PointerEvent`/`getBoundingClientRect` no jsdom. Os handlers de evento em
`FluxoChartModal.tsx` só traduzem gesto → chamada dessas funções:

```ts
function clampJanela(janela: Janela, tamanhoSerie: number, larguraMin: number): Janela;
function panJanela(janela: Janela, deltaIdx: number, tamanhoSerie: number): Janela;
function zoomJanela(janela: Janela, fator: number, ancoraIdx: number, tamanhoSerie: number, larguraMin: number): Janela;
```

## Bordas

- Série com menos de 2 pontos: o card na aba Fluxo continua não-clicável (guarda já existente
  em `BalanceChart`/`TelaFluxo`, reaproveitada — nada para expandir).
- Série mais curta que a janela inicial (60 dias): abre com a série inteira já no primeiro
  render (mesmo clamp que qualquer outro zoom-out máximo).
- Teclado/leitor de tela: mesmo não-escopo já registrado em 05/07 (só X e Escape como
  equivalentes de teclado); pan/zoom via gesto não ganha equivalente de teclado nesta versão.

## Testes

**`src/ui/chartGestures.test.ts` (novo):**
- `zoomJanela` clampa no mínimo de 14 dias e no máximo do tamanho da série.
- `zoomJanela` mantém o índice-âncora estável (não "pula") ao aumentar/diminuir o zoom.
- `panJanela` clampa nas duas pontas de `[0, tamanhoSerie - 1]` sem encolher a janela.

**`src/ui/FluxoChartModal.test.tsx` (novo, substitui a lista da spec de 05/07):**
- Abre com janela de ~30/30 dias em torno de hoje (ou a série inteira, se mais curta).
- Clique+arraste (scrub) atualiza o readout para o dia mais próximo do ponteiro.
- Clique-duplo+arraste desloca o rótulo de período e o rodapé mín/máx, sem mudar o dia
  selecionado.
- Evento `wheel` estreita/alarga o intervalo do rótulo de período; não ultrapassa 14 dias no
  mínimo nem a série inteira no máximo.
- Dois ponteiros simulando pinça produzem o mesmo efeito de zoom que o wheel.
- Botão X e tecla Escape chamam `onFechar`; clique no fundo do overlay não chama.
- Com `mostrarCenarios=true`, a legenda e a 3ª série aparecem; com `false`, não.
- Rótulo de período e rodapé mín/máx mudam ao pan/zoom (refletem a janela visível — diferente
  do mini-`BalanceChart`, que descreve a série inteira).

**`src/ui/TelaFluxo.test.tsx` (mantido de 05/07):**
- Clicar no card do gráfico abre o modal.
- Card não é clicável quando a série tem menos de 2 pontos.

## Fora de escopo (desta versão)

- Suavização de curva (spline) — decidido contra, ver "Decisões".
- Zoom/pan por teclado ou leitor de tela.
- Exportar o gráfico expandido como imagem.
- Migrar o mini-gráfico das telas Hoje/Fluxo para Recharts — continuam usando o
  `BalanceChart.tsx` SVG manual existente, com semântica de série inteira (não janelada).
- Reset de zoom (ex.: duplo-toque-e-soltar sem arrastar para voltar ao estado inicial) — não
  pedido; se fizer falta na prática, é um fast-follow simples.
