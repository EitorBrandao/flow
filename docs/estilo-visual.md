# Guia de estilo visual — Flow

Referência do estado **atual** da UI (não confundir com specs de mudança em
`docs/superpowers/specs/`, que registram decisões pontuais no momento em que foram tomadas).
**Consultar antes de criar ou editar qualquer tela**, para manter a mesma linguagem visual.
Se o código e este guia divergirem, o código manda — atualize o guia junto com a mudança.

Todo o CSS vive em um único arquivo: `src/styles.css`. Não há CSS modules, styled-components
nem Tailwind — classes utilitárias em **português**, compartilhadas entre todas as telas.

## Princípios

- **Dark-only.** Não existe tema claro nem `prefers-color-scheme`. `color-scheme: dark` fixo.
- **Azul (`--ac`) é a única cor de ação:** botão primário, aba/item ativo, FAB, links "ver
  tudo", focus ring. Nunca usar azul para outra coisa, nem outra cor para ação.
- **Verde (`--pos`) e vermelho (`--neg`) são exclusivos de dinheiro:** ganho/gasto, saldo,
  gráfico. Nunca em botões, navegação ou estados de UI genéricos.
- **Sem bordas em cards/itens.** Separação por contraste de superfície (`--surface` sobre
  `--bg`), não por `border`. `--line` só aparece em separadores raros (linhas de tabela,
  borda do nav/topo).
- **Valores monetários em pílula tingida** dentro de listas/cards (fundo translúcido + texto
  na cor plena); **sem pílula** dentro de tabelas ou texto corrido — só a cor.
- **Números sempre `tabular-nums`.**
- **Ícones são utilitários, não decorativos** (via `lucide-react`: `Settings`, `ChevronDown`,
  `Check`, `X`, `Plus`...). Não ilustrar itens de lista com ícone por categoria — título forte
  + subtítulo apagado basta.
- **Fonte:** stack do sistema (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`),
  16px base. Sem fonte customizada/importada.

## Tokens (`:root` em `src/styles.css`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0b0d11` | fundo do app |
| `--fg` | `#e9edf3` | texto principal |
| `--muted` | `#8b95a3` | texto secundário, rótulos, subtítulos |
| `--surface` | `#161b24` | cards, itens de lista, sheet, chip |
| `--surface2` | `#212836` | inputs, botão secundário, elevação sobre `--surface` |
| `--line` | `#232936` | separadores raros (borda do nav, linha de tabela) |
| `--ac` / `--ac-dim` | `#3b9df8` / `rgba(...,.14)` | ação (única cor de ação do app) |
| `--pos` / `--pos-bg` | `#2ee6a8` / `rgba(...,.14)` | ganho / saldo positivo |
| `--neg` / `--neg-bg` | `#ff6b7a` / `rgba(...,.13)` | gasto / saldo negativo |
| `--aviso-bg` / `--aviso-fg` | `#423306` / `#fcd34d` | aviso âmbar (ex.: backup atrasado) |

**Raios:** cards 20px · itens de lista 18px · botões/inputs 12px · chips/pílulas/badges 999px
· FAB 18px (14px no desktop) · sheet 24px (topo, ou nos 4 cantos em desktop).

**Tipografia:** títulos de seção (`.tela h2`) 16px/700 · rótulo maiúsculo (`.rotulo`) 12px/600
com `letter-spacing: .05em` · subtítulo (`.sub`) 13px em `--muted` · saldo grande
(`.saldo-grande`) 38px/800 com `letter-spacing: -.03em` · valores monetários 14.5px/700.

## Catálogo de classes

Reaproveite estas antes de criar uma classe nova.

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
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` | wrapper label+input; `.linha` para agrupar campos lado a lado |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `table.tabela` | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |

## Componentes compartilhados

- **`Sheet.tsx`** — bottom sheet padrão (framer-motion: slide-up com mola, drag-to-dismiss,
  backdrop com fade). Use para editores modais (ex.: `LancEditor`). Formulários de Ajustes
  ficam **inline**, não em sheet (decisão registrada em
  `docs/superpowers/specs/2026-07-05-redesign-visual-design.md` — mudar isso é escopo novo).
- **`Shell.tsx`** — casco fixo: nav + topo (chip de box + chip de ajustes) + `.conteudo`
  central (`max-width: 720px` mobile / `900px` desktop) + transição de aba via `motion.div`
  (fade + leve deslize, ~150–200ms).
- **`BalanceChart.tsx`** — linha verde com gradiente, marcador "hoje", cenários em azul
  tracejado.
- **`FluxoChartModal.tsx`** — versão em tela cheia do `BalanceChart`, aberta ao clicar no
  card do gráfico na aba Fluxo. Navegação por clique-e-arraste (seleciona um dia),
  clique-duplo-e-arraste (pan) e pinça/scroll (zoom), via `recharts` carregado sob demanda
  (`React.lazy`). Ver
  `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md`.

## Convenções de código

- Arquivo de tela: `Tela<Nome>.tsx` em `src/ui/` (subtelas de Ajustes em `src/ui/ajustes/`).
- Nomes de classe, rótulos, `aria-label` e texto visível: **português**, consistente com o
  resto do app.
- Estilo vai em `src/styles.css` como classe reaproveitável; `style={{ ... }}` inline só para
  ajuste pontual de layout de uma instância (`marginTop`, `width` de um campo específico,
  `opacity` condicional) — nunca para cor, raio ou fonte, que devem vir de classe/token.
- Transições novas usam `framer-motion`, seguindo os tempos já estabelecidos (fade+slide
  ~150–200ms para troca de conteúdo, mola damping 32/stiffness 340 para sheet).
- Ícone novo: importar de `lucide-react`, `size={18}` por padrão, uso utilitário (ação/estado),
  não decorativo.

## Checklist para uma tela nova

1. Estruturar com `.tela` > (`.card` e/ou `.secao` + `.lista`/`.item`), reaproveitando classes
   do catálogo acima antes de inventar uma nova.
2. Dinheiro: `formatarBRL` + `.valor-ganho`/`.valor-gasto` (ou cor pura em tabela), sempre
   `tabular-nums` (já vem das classes existentes).
3. Ações: azul (`.botao-primario`) só para a ação principal; o resto `.botao` neutro ou
   `.botao-perigo` para destrutiva.
4. Testar em mobile (largura estreita, tab bar embaixo) e desktop (≥900px, sidebar) — grid/
   flex responsivo já vem dos wrappers padrão, evite `max-width`/breakpoints próprios.
5. Se precisar de uma classe genuinamente nova, adicionar em `src/styles.css` seguindo o
   padrão de tokens existentes (nunca cor/raio hardcoded fora de `:root`).
