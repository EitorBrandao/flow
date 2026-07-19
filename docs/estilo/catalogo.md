# Catálogo — classes e componentes existentes

Referência do que **já existe**. Reaproveite antes de criar qualquer coisa.
**Quem cria, cataloga:** classe compartilhada nova (nível 2), componente novo (nível 4) ou
tela nova (nível 5) entram aqui **no mesmo commit** que os cria.

## Classes (em `src/styles.css`)

| Classe | Para quê |
|---|---|
| `.tela` | wrapper de toda tela (`display: flex; flex-direction: column; gap: 14px`) |
| `.card` | bloco de destaque (ex.: card herói do saldo) — `--surface`, raio 20px, padding 20px |
| `.lista` / `.item` | lista vertical de itens-card; `.item-coluna` quando o item precisa de uma segunda linha (ex.: ações abaixo); `.linha-topo` para a linha principal dentro de um item-coluna; `.linha-topo-2-1` (junto com `.linha-topo`) quando a linha principal precisa de proporção fixa 2:1 entre descrição e valor (evita word-wrap com valor/botões espremendo o texto) |
| `.cresce` | filho flex que ocupa o espaço restante (`flex: 1; min-width: 0`) |
| `.acoes` | linha de botões de ação dentro de um item (ex.: Confirmar/Descartar) |
| `.botao`, `.botao-primario`, `.botao-perigo` | botão padrão / ação principal (azul) / ação destrutiva (texto vermelho) |
| `.botao-com-icone` | modificador de `.botao` pra ícone + texto lado a lado (`display: inline-flex; gap: 8px`) |
| `.botao.ativo` | modificador de `.botao` pra indicar estado ativo/aplicado (ex.: filtro de data com valor) — `--ac-dim`/`--ac`, mesmo padrão de aba/item ativo |
| `.campo-data` / `.campo-data-input` | ver componente `CampoData.tsx` — botão com ícone de calendário sobre um `input[type=date]` nativo (oculto, mas funcional e acessível) |
| `.chip` | pílula `--surface` no topo (seletor de box, botão de ajustes) e filtros |
| `.valor-ganho`, `.valor-gasto` | valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de `.tabela` ou em `<strong>` |
| `.saldo-grande` (+ `.negativo`) | saldo em destaque (card herói) |
| `.delta` (+ `.pos`/`.neg`) | badge de variação/projeção com seta ▲/▼ |
| `.badge` | pílula neutra pequena (contagem, status) |
| `.aviso` | faixa âmbar de aviso |
| `.rotulo` | rótulo maiúsculo pequeno acima de um valor/seção |
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.cabecalho-dia` (+ `.dia-hoje`) | cabeçalho de dia na lista do Fluxo; `.dia-hoje` destaca o dia atual (fundo `--hoje-bg`) |
| `.lista-fluxo` | modificador de `.lista` só na aba Fluxo — deixa o valor de cada transação (`.item .valor-ganho`/`.valor-gasto`) sem negrito, pra diferenciar do totalizador do dia (`.cabecalho-dia`, em `<strong>`, continua em negrito) |
| `.total-dia` (+ `.pos`/`.neg`) | totalizador do dia no cabeçalho do Fluxo — cor própria (`--total-pos`/`--total-neg`), separada da pílula de transação (`--pos`/`--neg`) |
| `.botao-ver-mais` | link azul de mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) |
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` | wrapper label+input; `.linha` para agrupar campos lado a lado |
| `.campo-busca` | input de busca avulso (fora de `.campo`) |
| `.sub` | subtítulo/texto secundário 13px em `--muted` |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `table.tabela` | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.rolavel` | wrapper com `overflow-x: auto` para conteúdo largo (tabelas) |
| `.recuo-1` / `.recuo-2` | recuo horizontal (ambos os lados) pra indicar nível de hierarquia numa lista aninhada — ex.: grupo/data em `LancamentosSheet` |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |
| `.shell` / `.shell-corpo` / `.topo` / `.conteudo` | casco do app (ver componente `Shell`) |
| `.grafico-expandido-*` | classes internas do `FluxoChartModal` (exemplo do padrão de prefixo por componente) |

## Componentes compartilhados (em `src/ui/`)

- **`CampoValor.tsx`** — input numérico controlado com comportamento estilo caixa eletrônico:
  digita da direita pra esquerda, Backspace remove último dígito, colar substitui o buffer
  inteiro. Exibe valor formatado em BRL (ex.: `R$ 12,34`). Usado para entrada de valores
  monetários em formulários.
- **`CampoData.tsx`** — substitui `<input type="date">` cru em toda a base: um botão visível
  (ícone `Calendar` do `lucide-react` + data formatada `DD/MM/AAAA` via `formatarDataBR`,
  ou `placeholder` quando vazio) sobrepõe um `input[type=date]` nativo real, porém
  visualmente oculto (`opacity: 0`, mesmo tamanho do botão). O clique no botão chama
  `input.showPicker()` — o input nativo continua acessível por teclado/leitor de tela via o
  `id`/`aria-label`, então `<label htmlFor={id}>` externo continua funcionando normalmente
  (o componente não renderiza label próprio). Prop `ativo` aplica `.botao.ativo` (usado nos
  filtros de data do Fluxo, quando o filtro está aplicado).
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
