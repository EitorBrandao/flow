# Catálogo — classes e componentes existentes

Referência do que **já existe**. Reaproveite antes de criar qualquer coisa.
**Quem cria, cataloga:** classe compartilhada nova (nível 2), componente novo (nível 4) ou
tela nova (nível 5) entram aqui **no mesmo commit** que os cria.

## Classes (em `src/styles.css`)

| Classe | Para quê |
|---|---|
| `.tela` | wrapper de toda tela (`display: flex; flex-direction: column; gap: 14px`) |
| `.card` | bloco de destaque (ex.: card herói do saldo) — `--surface`, raio 20px, padding 20px |
| `.lista` / `.item` | lista vertical de itens-card; `.item-coluna` quando o item precisa de uma segunda linha (ex.: ações abaixo); `.linha-topo` para a linha principal dentro de um item-coluna |
| `.cresce` | filho flex que ocupa o espaço restante (`flex: 1; min-width: 0`) |
| `.acoes` | linha de botões de ação dentro de um item (ex.: Confirmar/Descartar) |
| `.botao`, `.botao-primario`, `.botao-perigo` | botão padrão / ação principal (azul) / ação destrutiva (texto vermelho) |
| `.chip` | pílula `--surface` no topo (seletor de box, botão de ajustes) e filtros |
| `.valor-ganho`, `.valor-gasto` | valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de `.tabela` ou em `<strong>` |
| `.saldo-grande` (+ `.negativo`) | saldo em destaque (card herói) |
| `.delta` (+ `.pos`/`.neg`) | badge de variação/projeção com seta ▲/▼ |
| `.badge` | pílula neutra pequena (contagem, status) |
| `.aviso` | faixa âmbar de aviso |
| `.rotulo` | rótulo maiúsculo pequeno acima de um valor/seção |
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.botao-ver-mais` | link azul de mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) |
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` | wrapper label+input; `.linha` para agrupar campos lado a lado |
| `.campo-busca` | input de busca avulso (fora de `.campo`) |
| `.sub` | subtítulo/texto secundário 13px em `--muted` |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `table.tabela` | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.rolavel` | wrapper com `overflow-x: auto` para conteúdo largo (tabelas) |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |
| `.shell` / `.topo` / `.conteudo` | casco do app (ver componente `Shell`) |
| `.grafico-expandido-*` | classes internas do `FluxoChartModal` (exemplo do padrão de prefixo por componente) |

## Componentes compartilhados (em `src/ui/`)

- **`Sheet.tsx`** — bottom sheet padrão (framer-motion: slide-up com mola, drag-to-dismiss,
  backdrop com fade). Use para editores modais (ex.: `LancEditor`). Formulários de Ajustes
  ficam **inline**, não em sheet (decisão registrada em
  `docs/superpowers/specs/2026-07-05-redesign-visual-design.md` — mudar isso é nível 6).
- **`Shell.tsx`** — casco fixo: nav + topo (chip de box + chip de ajustes) + `.conteudo`
  central + transição de aba via `motion.div` (fade + leve deslize).
- **`BalanceChart.tsx`** — linha verde com gradiente, marcador "hoje", cenários em azul
  tracejado.
- **`FluxoChartModal.tsx`** — versão em tela cheia do `BalanceChart`, com pan/zoom, via
  `recharts` carregado sob demanda (`React.lazy`). Ver
  `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md`.
- **`FaturaResumo.tsx`** — resumo somente leitura de uma fatura de cartão.
