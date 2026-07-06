# Flow — Gráfico de saldo expandido (aba Fluxo)

**Data:** 2026-07-05
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Contexto e objetivo

Hoje a aba Fluxo mostra o gráfico de saldo (`BalanceChart.tsx`) como um SVG feito à mão,
pequeno, sem interação — só uma linha com preenchimento em gradiente e min/máx no rodapé.
O usuário quer clicar nesse gráfico e ver uma versão expandida, em tela cheia, que permita
visualizar o fluxo de caixa ao longo do tempo com mais detalhe, incluindo o valor exato de
cada dia.

### Requisitos confirmados

- O gráfico em questão é o `BalanceChart` existente (linha/área do saldo), não um gráfico de
  barras literal — o usuário usou "barras" informalmente.
- Clicar no card do gráfico na aba Fluxo abre um **modal em tela cheia**.
- O modal abre com **hoje já selecionado**, mostrando data + saldo em destaque.
- **Arrastar o dedo/mouse** (scrub) sobre o gráfico atualiza a seleção para o ponto mais
  próximo — não é necessário acertar o ponto exato.
- Datas no eixo X são calculadas automaticamente (não é para hardcodar espaçamento de ticks).
- Fecha **só pelo botão X** — sem fechar ao tocar fora, para não conflitar com o gesto de
  arrastar sobre o próprio gráfico.

## Decisão de arquitetura: adotar Recharts

O `BalanceChart` atual é SVG hand-rolled, mantendo o app sem dependências de chart (importante
para um PWA offline enxuto). Só que o pedido do usuário — eixo com ticks automáticos e scrub
com tooltip — é exatamente o que uma lib de chart resolve de graça.

**Decisão:** adicionar `recharts` como dependência, usada **só no modal expandido**. O
`BalanceChart.tsx` original continua como está (SVG manual), usado nas telas Hoje e Fluxo como
mini-gráfico. Isso limita o custo de bundle (~100kb) a um componente carregado sob demanda.

Alternativas descartadas:

- *lightweight-charts (TradingView)*: bundle menor e crosshair de arrastar nativo, mas
  renderiza em canvas — mais difícil casar com os tokens de cor CSS do app (`var(--pos)`
  etc.) e API menos comum em React.
- *Continuar 100% SVG manual*: zero dependência nova, mas exige escrever lógica de scrub e
  posicionamento de ticks à mão — exatamente o que o usuário pediu para evitar.

Para reduzir o custo do bundle, `FluxoChartModal` é **lazy-loaded** via `React.lazy` —
`recharts` só entra no bundle carregado quando o usuário efetivamente abre o modal.

## Componentes

### `src/ui/FluxoChartModal.tsx` (novo)

Modal em tela cheia, componente novo e independente do `Sheet.tsx` existente. Não reusa
`Sheet` porque `Sheet` é um bottom-sheet com arraste vertical para fechar (`drag="y"`) e
fecha ao tocar no backdrop — ambos os gestos conflitariam com o arraste horizontal do scrub
dentro do gráfico.

Props:
```ts
interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  mostrarCenarios: boolean;
  onFechar: () => void;
}
```

Estrutura:
- Overlay `position: fixed; inset: 0`, fundo sólido (`var(--bg)` ou superfície do card),
  acima de tudo (mesma camada de z-index que `.sheet-backdrop`).
- Cabeçalho: botão fechar (ícone `X` do lucide-react) alinhado à direita. Sem título extra
  — o próprio gráfico e o readout do dia selecionado comunicam o conteúdo.
- Fecha com o botão X e com a tecla **Escape** (equivalente de teclado, não é "tocar fora").
- Corpo: readout do dia selecionado + gráfico Recharts + legenda (quando houver 2-3 séries)
  + linha de mín/máx no rodapé (mesmo texto que já existe no `BalanceChart`).

### `TelaFluxo.tsx` (alterações)

- O `<div className="card">` que envolve `<BalanceChart>` vira clicável: `onClick` abre o
  modal, `cursor: pointer`, e ganha um ícone pequeno de expandir (`Maximize2` do
  lucide-react, já usado em outros pontos do app) no canto superior direito do card.
- Novo estado `const [graficoExpandido, setGraficoExpandido] = useState(false)`.
- `{graficoExpandido && <FluxoChartModal serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} onFechar={() => setGraficoExpandido(false)} />}`
  — reaproveita a mesma `serie` já calculada no componente, sem recomputar.
- Se `serie.length < 2` (mesma guarda do `BalanceChart`), o card não fica clicável — nada
  para expandir.

## Comportamento do gráfico expandido (Recharts)

Reaproveita exatamente o vocabulário visual do `BalanceChart` atual, só que maior e
interativo:

- **Duas ou três séries** sobre o mesmo eixo X (datas): passado (`saldoEfetivo`, sólido),
  futuro (`saldoProjetado`, tracejado) e, quando `mostrarCenarios`, cenário
  (`saldoComCenarios`, pontilhado). Implementado com dois/três `<Area>` do Recharts sobre um
  dataset único, cada série com o campo nulo fora do seu intervalo (mesmo padrão de
  `passado`/`futuro`/`cenarios` que o `BalanceChart` já usa), overlapando no ponto de "hoje"
  para a linha ficar contínua.
- Preenchimento em gradiente reaproveitando `var(--pos)` via `<linearGradient>`, mesmo visual
  do card pequeno.
- `<ReferenceLine y={0}>` (linha do zero, hairline recessiva) e `<ReferenceLine x={hoje}>`
  (guia tracejada), mesmo papel que as linhas de referência do `BalanceChart` atual.
- **Eixo X**: `<XAxis dataKey="data">` com ticks automáticos do Recharts, formatados
  `dd/mm`. Sem eixo Y visível (mantém o estilo minimalista atual — min/máx seguem como texto
  no rodapé, não como eixo).
- **Seleção e readout**: em vez do `<Tooltip>` padrão do Recharts (que só aparece durante o
  hover), o estado de seleção é local (`useState`, inicializado no índice de "hoje") e
  atualizado via `onMouseMove`/`onTouchMove` do `<AreaChart>`, usando `activeLabel` do
  callback para achar o ponto mais próximo. Isso permite:
  - Mostrar o readout (data + saldo) **desde a abertura do modal**, sem precisar de toque.
  - Um `<ReferenceLine x={selecionado}>` extra fazendo de crosshair do ponto ativo.
  - O valor do saldo em destaque visual (Strong/alto contraste) e a data em texto secundário
    — "o valor lidera, o rótulo segue", igual ao padrão de tooltip do resto do app.
- **Legenda**: quando há 2-3 séries visíveis, uma legenda pequena e recessiva no rodapé do
  modal ("— Real  ╌ Projetado  ⋯ Cenário", com traços curtos ao invés de caixas, coerente
  com o padrão de traço já usado para diferenciar as séries). Com 1 série só (sem cenário
  ligado), sem legenda — o título já implícito no contexto da tela basta.
- Mín/máx no rodapé: mesmo texto (`mín {formatarBRL(min)} · máx {formatarBRL(max)}`) que já
  existe no `BalanceChart` atual.

## Testes

- **`TelaFluxo.test.tsx`**: clicar no card do gráfico abre o modal (`FluxoChartModal`
  renderizado); card não é clicável quando a série tem menos de 2 pontos.
- **Novo `FluxoChartModal.test.tsx`**:
  - Seleção inicial mostra a data de hoje e o saldo correspondente.
  - Disparar `mouseMove`/`touchMove` sobre o gráfico em outro ponto atualiza o readout para
    aquele dia.
  - Botão X chama `onFechar`.
  - Tecla Escape chama `onFechar`.
  - Clicar no fundo do overlay (fora do conteúdo) **não** chama `onFechar` (comportamento
    deliberado, diferente do `Sheet`).
  - Com `mostrarCenarios=true`, a legenda aparece; com `false`, não aparece.

## Fora de escopo (desta versão)

- Zoom/pan além do scrub (ex.: pinch-to-zoom no intervalo de datas).
- Exportar o gráfico expandido como imagem.
- Migrar o mini-gráfico das telas Hoje/Fluxo para Recharts — continuam usando o
  `BalanceChart.tsx` SVG manual existente.
