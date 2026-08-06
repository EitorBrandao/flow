# Catálogo — classes e componentes existentes

Referência do que **já existe**. Reaproveite antes de criar qualquer coisa.
**Quem cria, cataloga:** classe compartilhada nova (nível 2) e componente novo (nível 4)
entram aqui **no mesmo commit** que os criam. Telas não entram: `Tela*.tsx` e
`src/ui/ajustes/*.tsx` se registram na navegação (`Shell.tsx`, `TelaAjustes.tsx`). O
verificador de catálogo não cobre nenhuma das duas, por motivos diferentes: `Tela*.tsx` tem
exclusão explícita no script, e `src/ui/ajustes/*.tsx` fica de fora porque a varredura lê
`src/ui` sem descer em subpastas.

## Classes (em `src/styles.css`)

| Classe | Para quê |
|---|---|
| `.tela` | wrapper de toda tela (`display: flex; flex-direction: column; gap: 14px`) |
| `.card` | bloco de destaque (ex.: card herói do saldo) — `--surface`, raio 20px, padding 20px |
| `.lista` / `.item` / `.item-coluna` / `.linha-topo` / `.linha-topo-2-1` | lista vertical de itens-card; `.item-coluna` quando o item precisa de uma segunda linha (ex.: ações abaixo); `.linha-topo` para a linha principal dentro de um item-coluna; `.linha-topo-2-1` (junto com `.linha-topo`) quando a linha principal precisa de proporção fixa 2:1 entre descrição e valor (evita word-wrap com valor/botões espremendo o texto) |
| `.cresce` | filho flex que ocupa o espaço restante (`flex: 1; min-width: 0`) |
| `.acoes` | linha de botões de ação dentro de um item (ex.: Confirmar/Descartar) |
| `.botao`, `.botao-primario`, `.botao-perigo` | botão padrão / ação principal (azul) / ação destrutiva (texto vermelho) |
| `.botao-com-icone` | modificador de `.botao` pra ícone + texto lado a lado (`display: inline-flex; gap: 8px`) |
| `.botao.ativo` | modificador de `.botao` pra indicar estado ativo/aplicado (ex.: filtro de data com valor) — `--ac-dim`/`--ac`, mesmo padrão de aba/item ativo |
| `.campo-data` / `.campo-data-input` | ver componente `CampoData.tsx` — botão com ícone de calendário sobre um `input[type=date]` nativo (oculto, mas funcional e acessível) |
| `.chip` | pílula `--surface` no topo (seletor de box, botão de ajustes) e filtros |
| `.valor-ganho`, `.valor-gasto` | valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de `.tabela` ou em `<strong>` |
| `.saldo-grande` (+ `.positivo`/`.negativo`) | saldo em destaque (card herói) |
| `.delta` (+ `.pos`/`.neg`) | badge de variação/projeção com seta ▲/▼ |
| `.badge` | pílula neutra pequena (contagem, status) |
| `.aviso` | faixa âmbar de aviso |
| `.rotulo` | rótulo maiúsculo pequeno acima de um valor/seção |
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.cabecalho-dia` (+ `.dia-hoje`) | cabeçalho de dia na lista do Fluxo; `.dia-hoje` destaca o dia atual (fundo `--hoje-bg`) |
| `.lista-fluxo` | modificador de `.lista` só na aba Fluxo — deixa o valor de cada transação (`.item .valor-ganho`/`.valor-gasto`) sem negrito, pra diferenciar do totalizador do dia (`.cabecalho-dia`, em `<strong>`, continua em negrito) |
| `.total-dia` (+ `.pos`/`.neg`) | totalizador do dia no cabeçalho do Fluxo — cor própria (`--total-pos`/`--total-neg`), separada da pílula de transação (`--pos`/`--neg`) |
| `.grafico-rodape` (+ `.pos`/`.neg` no valor) | rodapé "mín · máx" sob o gráfico de saldo (`BalanceChart.tsx`, abas Hoje/Fluxo) — 12px, sem pílula, `--pos`/`--neg` pelo sinal do próprio valor; os mesmos modificadores `.pos`/`.neg` valem também dentro de `.grafico-expandido-rodape` (modal expandido do Fluxo) |
| `.botao-ver-mais` | link azul de mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) |
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` / `.linha` | `.campo` é wrapper label+input; `.linha` agrupa campos (ou outros elementos) lado a lado |
| `.campo-busca` | input de busca avulso (fora de `.campo`) |
| `.sub` | subtítulo/texto secundário 13px em `--muted` |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `.pills` | pílulas em linha pra escolher entre poucas opções (Box, Cartão); `button.ativo` marca a opção atual |
| `.tabela` (elemento `table`) | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.rolavel` | wrapper com `overflow-x: auto` para conteúdo largo (tabelas) |
| `.recuo-1` / `.recuo-2` | recuo horizontal (ambos os lados) pra indicar nível de hierarquia numa lista aninhada — ex.: grupo/data em `LancamentosSheet` |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` / `.sheet-cabecalho` / `.sheet-conteudo` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |
| `.shell` / `.shell-corpo` / `.topo` / `.conteudo` | casco do app (ver componente `Shell`) |
| `.grafico-expandido` / `.grafico-expandido-*` | modal expandido do `FluxoChartModal` (exemplo do padrão de prefixo por componente) |
| `.resumo-barras` / `.resumo-barra-trilho` / `.resumo-barra-preenchimento` | barras de composição ganho/gasto do card resumo em `TelaAnalises.tsx` |
| `.composicao-*` | classes internas do `ComposicaoBarChart.tsx` (mesmo padrão de prefixo por componente) |
| `.evolucao-*` | classes internas do `EvolucaoMensalChart.tsx` (mesmo padrão de prefixo por componente) |
| `.wiki-abrir-indice` | botão de abertura do índice da wiki (align-self flex-start) |
| `.wiki-corpo` | artigo com conteúdo da wiki; `h3` (22px margem superior), `p` (10px margem inferior), `ul` (12px margem, 20px padding-left), `li` (5px margem), `code` (quebra de overflow) |
| `.wiki-titulo` | título do capítulo (4px margem superior) |
| `.wiki-campos` | lista de definições de campo (display list); `dt` em `--muted` 13px com 10px margem-top, `dd` com 2px margem-top |
| `.wiki-fundo` | backdrop semifixo do índice (z-index 50, preto semi-transparente `rgba(0,0,0,.55)`) |
| `.wiki-gaveta` | drawer do índice (z-index 51, `min(86vw, 330px)`, 16px padding, `--surface` com borda direita em `--line`, scroll contido) |
| `.wiki-item` | botão de item do índice; `.ativo` marca o capítulo atual com `--ac-dim` fundo e `--ac` cor |
| `.primeiro-uso` | cartão de onboarding (`PrimeiroUso.tsx`): flex container com gap 14px, botões em largura cheia, espaçamento entre elementos |
| `.pagamento-fatura-*` | bloco de contas do parcelamento de fatura (`PagamentoFaturaSheet.tsx`). `.pagamento-fatura-resumo` é o bloco: `--surface2`, raio 12px, `tabular-nums`; dentro dele cada `.linha-conta` (aninhada, sem existência própria) é rótulo à esquerda e valor à direita. Os modificadores dão a cor do juros no valor — `.pagamento-fatura-juros` âmbar (`--aviso-fg`) quando há juros, `.pagamento-fatura-semjuros` verde (`--pos`) quando não há, `.pagamento-fatura-erro` vermelho (`--neg`) quando as parcelas somam menos que o restante |
| `.sugestoes` / `.sugestao` | contêiner de pílulas de categoria sugerida (quebra linha, gap 8px) e cada pílula (`SeletorCategoria`-like); `.sugestao` é alvo de toque (44px altura), `.marcada` indica seleção com `--ac-dim` fundo e `--ac` cor |
| `.conferencia-bancos` / `.conferencia-bancos-*` | conferência de saldo por banco na `TelaHoje.tsx`, no lugar do campo único quando a box (ou a "casa" inteira) tem bancos cadastrados. `.conferencia-bancos` é a classe raiz (coluna, gap 8px); dentro dela, `.linha-banco` (aninhada, sem existência própria) é o nome do banco à esquerda (`span` em `--muted` 14px) e o `CampoValor` à direita; `.total` (aninhada) é a linha "Total informado" com borda superior em `--line`, `tabular-nums` |

## Componentes compartilhados (em `src/ui/`)

- **`CampoValor.tsx`** — input numérico controlado com comportamento estilo caixa eletrônico:
  digita da direita pra esquerda, Backspace remove último dígito, colar substitui o buffer
  inteiro. Exibe valor formatado em BRL (ex.: `R$ 12,34`). Usado para entrada de valores
  monetários em formulários. **Focar seleciona o conteúdo e não dispara `onChange`**: o
  primeiro dígito substitui o valor, do segundo em diante empurra. Encostar no campo e
  desistir nunca altera dado — regra de que dependem as telas que salvam vários campos de
  uma vez.
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
- **`SeletorCategoria.tsx`** — grid de 3 colunas (`.grade-categorias`) pra escolher uma
  categoria por toque, sem abrir o picker nativo do `<select>`. Usado em `TelaLancar.tsx`,
  `Recorrencias.tsx`, `FormCompra.tsx`, `LancEditor.tsx`, `TelaSimulador.tsx`.
- **`SeletorPills.tsx`** — pílulas em linha (`.pills`) pra escolher entre poucas opções sem
  abrir o picker nativo do `<select>`. Usado em `CategoriasCartao.tsx` e `Assinaturas.tsx`
  (Cartão) — a box em si não tem mais seletor próprio nessas telas: todas as telas de
  Ajustes seguem a box selecionada no chip do topo (`boxIdEfetivo`, `state/store.ts`),
  reforçando a sensação de "perfil" (ver `docs/superpowers/specs/`).
- **`PagamentoFaturaSheet.tsx`** — conteúdo da folha que registra o pagamento de uma fatura
  por valor diferente do total e o parcelamento do restante. Exporta o conteúdo puro (default,
  para o teste montar sem backdrop) e `PagamentoFaturaSheetModal`, que o embrulha no `Sheet`.
  Consumido pela fila de pendentes da `TelaHoje` e pela fatura da `TelaCartao`; recebe o
  lançamento da fatura e o total dela, porque nem sempre um é o outro (fatura já paga em
  parte tem valor menor que o total calculado).
- **`AssinaturasResumoSheet.tsx`** — sheet de Análises com o total de assinaturas do mês,
  agrupado por cartão (`.rotulo-grupo` + `.recuo-1`, mesmo padrão do `LancamentosSheet`).
- **`ComposicaoBarChart.tsx`** — barras horizontais de composição por categoria na aba
  Análises (substitui a antiga tabela "Por categoria"); escala compartilhada com as
  barrinhas do card resumo (`base = max(totalGanhos, totalGastos)`), mesmo contrato de
  acessibilidade (`role="button"` por linha) que a tabela anterior usava.
- **`EvolucaoMensalChart.tsx`** — evolução de ganho/gasto/sobra dos últimos 6 meses na aba
  Análises: barras agrupadas + linha de tendência tracejada, via `recharts` carregado sob
  demanda (`React.lazy`), mesmo padrão do `FluxoChartModal`.
- **`AdicionarSheet.tsx`** — sheet do botão flutuante "+": menu com passos (lançamento manual,
  compra no cartão) que troca de tela via `passo`; escolhe o cartão automaticamente quando só
  há um ativo, senão mostra `.pills` pra escolher; renderiza `FormCompra` no passo final.
- **`FormCompra.tsx`** — formulário de compra no cartão (valor, data, categoria, parcelas,
  parcelas já pagas, descrição, viagem). Usado por `AdicionarSheet` (nova) e `TelaCartao`
  (edição).
- **`LancEditor.tsx`** — sheet de edição de um lançamento existente (valor, data, categoria,
  nota, sinal ganho/gasto); usa `Sheet`, `CampoData`, `CampoValor`, `SeletorCategoria`.
- **`LancamentosSheet.tsx`** — sheet somente leitura com os lançamentos de uma categoria no
  mês, agrupados por nota (`lancamentosDaCategoria`); usado no drill-down de Análises.
- **`FaturaCategoriaSheet.tsx`** — sheet somente leitura com o resumo por categoria de uma
  fatura de cartão (drill-down a partir de `FaturaResumo`/`TelaCartao`).
- **`ViagemSheet.tsx`** — sheet somente leitura com os lançamentos/compras de uma viagem,
  agrupados (`itensDaViagem`); mesmo padrão visual do `LancamentosSheet`.
- **`PrimeiroUso.tsx`** — cartão de onboarding renderizado em `TelaHoje` quando o app está sem
  box com saldo próprio ou sem categorias. Guia o usuário pelos primeiros passos: criar box,
  importar backup ou escolher categorias. Desaparece automaticamente quando os dados
  correspondem (sem flag persistido de conclusão).
