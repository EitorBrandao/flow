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
| `.lista` / `.item` / `.item-coluna` / `.item-elevado` / `.linha-topo` / `.linha-topo-2-1` | lista vertical de itens-card; `.item-coluna` quando o item precisa de uma segunda linha (ex.: ações abaixo); `.linha-topo` para a linha principal dentro de um item-coluna; `.linha-topo-2-1` (junto com `.linha-topo`) quando a linha principal precisa de proporção fixa 2:1 entre descrição e valor (evita word-wrap com valor/botões espremendo o texto); `.item-elevado` (junto com `.item`) troca o fundo para `--surface2`, para o item sobre uma superfície já `--surface` (ex.: blocos de Modo de uso em Ajustes); `.ativo` em `.item` marca o item selecionado com `--ac-dim`/`--ac`, mesmo padrão de `.botao.ativo` (ex.: categoria que filtra os lançamentos na aba Cartão) |
| `.cresce` | filho flex que ocupa o espaço restante (`flex: 1; min-width: 0`) |
| `.acoes` | linha de botões de ação dentro de um item (ex.: Confirmar/Descartar) |
| `.botao`, `.botao-primario`, `.botao-perigo` | botão padrão / ação principal (azul) / ação destrutiva (texto vermelho). `.botao:disabled` fica a 45% de opacidade, em toda tela |
| `.botao-sinal` | modificador de `.botao` para o botão de alternar sinal (`+`/`−`) ao lado de um `CampoValor` — padding menor e largura mínima de alvo de toque. Usado nas duas conferências da `TelaHoje`, em Ajustes → Boxes e em Ajustes → Bancos |
| `.botao-com-icone` | modificador de `.botao` pra ícone + texto lado a lado (`display: inline-flex; gap: 8px`) |
| `.alca-arrastar` | modificador de `.botao` para o puxador de arrastar e reordenar; `touch-action: none` para o toque não virar rolagem no celular |
| `.botao.ativo` | modificador de `.botao` pra indicar estado ativo/aplicado (ex.: filtro de data com valor) — `--ac-dim`/`--ac`, mesmo padrão de aba/item ativo |
| `.campo-data` / `.campo-data-input` | ver componente `CampoData.tsx` — botão com ícone de calendário sobre um `input[type=date]` nativo (oculto, mas funcional e acessível) |
| `.chip` | pílula `--surface` no topo (seletor de box, botão de ajustes) e filtros |
| `.chip-elevado` | modificador de `.chip` para quando o chip fica sobre uma superfície já `--surface` (ex.: dentro de uma sheet) — troca o fundo para `--surface2`, senão o chip some por falta de contraste. Usado no botão de câmera do passo `menu` em `AdicionarSheet.tsx` |
| `.valor-ganho`, `.valor-gasto`, `.valor-neutro` | efeito no saldo (verde entra, vermelho sai; neutro = zero, sem cor e sem fundo, mesma tipografia e recuo), via `classeEfeito`; valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de `.tabela` ou em `<strong>`; numa `<td>` de `.tabela`, a célula mantém o recuo das outras (valor alinhado ao título da coluna) |
| `.editavel` | modificador de `.valor-ganho`/`.valor-gasto`/`.valor-neutro` quando o valor é um `<button>` que abre a correção do lançamento (fila de Pendentes, `TelaHoje`); sublinhado pontilhado como pista, e altura mínima de alvo de toque |
| `.saldo-grande` (+ `.positivo`/`.negativo`) | saldo em destaque (card herói) |
| `.delta` (+ `.pos`/`.neg`) | badge de variação de saldo projetado, sem sinal — só a cor diz o sentido |
| `.badge` | pílula neutra pequena (contagem, status, rótulo "estorno" ao lado de um lançamento com valor negativo) |
| `.aviso` | faixa âmbar de aviso; um `.botao-ver-mais` dentro dela herda a cor e o tamanho do texto e fica sublinhado (ação do próprio aviso, ex.: "Corrigir o valor pago" na aba Cartão) |
| `.aviso-urgente` | variante vermelha da `.aviso`, usada junto dela (`aviso aviso-urgente`): `--neg-bg` e `--neg`. Classe solta, não modificador composto, para o verificador de catálogo enxergá-la |
| `.aviso-sucesso` | variante verde da `.aviso`, usada junto dela (`aviso aviso-sucesso`): `--pos-bg` e `--pos`. Confirmação de ação concluída ("Lançado ✓", "Transferência feita ✓"). Classe solta, como `.aviso-urgente` |
| `.rotulo` | rótulo maiúsculo pequeno acima de um valor/seção |
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.cabecalho-dia` (+ `.dia-hoje`) | cabeçalho de dia na lista do Fluxo; `.dia-hoje` destaca o dia atual (fundo `--hoje-bg`) |
| `.lista-fluxo` | modificador de `.lista` só na aba Fluxo — deixa o valor de cada transação (`.item .valor-ganho`/`.valor-gasto`/`.valor-neutro`) sem negrito, pra diferenciar do totalizador do dia (`.cabecalho-dia`, em `<strong>`, continua em negrito) |
| `.total-dia` (+ `.pos`/`.neg`) | saldo (via `classeSaldo`, valor via `formatarSaldo` — mostra o "−" abaixo de zero) — totalizador do dia no cabeçalho do Fluxo, e todo outro saldo (Hoje, Boxes, Bancos); cor própria (`--total-pos`/`--total-neg`), separada da pílula de transação (`--pos`/`--neg`) |
| `.grafico-rodape` (+ `.pos`/`.neg` no valor) | rodapé "mín · máx" sob o gráfico de saldo (`BalanceChart.tsx`, abas Hoje/Fluxo) — 12px, sem pílula, valor via `formatarSaldo`, `--pos`/`--neg` pelo sinal do próprio valor; os mesmos modificadores `.pos`/`.neg` valem também dentro de `.grafico-expandido-rodape` (modal expandido do Fluxo) |
| `.minmax-series` (+ `.minmax-serie`, `.minmax-celula`) | "mín · máx" por série, com cenário ligado (`MinMaxSeries.tsx`, usado no `BalanceChart` e no `FluxoChartModal`): grade de 5 colunas — série, "mín", valor, "máx", valor (valores alinhados à direita) —, uma linha para o real e outra para o cenário. `.minmax-serie.real`/`.cen` levam o traço da linha no gráfico (tracejado neutro e pontilhado `--ac`); o cenário também pinta o nome em `--ac`. Valores seguem `.pos`/`.neg` |
| `.grafico-rodape.duas-linhas` (+ `.grafico-rodape-datas`, `.grafico-rodape-minmax`) | variante do rodapé do `BalanceChart` quando o período cruza anos: as datas completas (DD/MM/AAAA) ficam nas pontas de uma linha e o "mín · máx" centralizado na linha seguinte — numa linha só, não cabe em 360px |
| `.botao-ver-mais` | link azul de texto: mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) ou levar a outra tela a partir de um card (ex.: "Ver gráfico completo na aba Fluxo →" na Hoje, "Ver fatura completa na aba Cartão →" na fatura) |
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` / `.linha` | `.campo` é wrapper label+input; `.linha` agrupa campos (ou outros elementos) lado a lado |
| `.form-linha` / `.form-botoes` | largura dos formulários de Ajustes: `.form-linha` põe campos lado a lado dividindo a largura por igual (e, em formulário de um campo só, os botões no fim da mesma linha); `.form-botoes` é a linha de botões de um formulário de várias linhas, à direita, na ordem Cancelar, Salvar |
| `.campo-busca` | input de busca avulso (fora de `.campo`) |
| `.sub` | subtítulo/texto secundário 13px em `--muted` |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `.pills` | pílulas em linha pra escolher entre poucas opções (Box, Cartão, Gasto/Ganho); `button.ativo` marca a opção atual. Como seletor, o grupo é `role="radiogroup"` e cada pílula `role="radio"` com `aria-checked` — prefira o `SeletorPills`. Como abas de seção (Hoje, Fluxo, Cartão), `role="tablist"` |
| `.tabela` (elemento `table`) | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.tabela-fixa` | junto de `.tabela`: colunas de largura fixa (Simular, no Fluxo) — o conteúdo não muda as colunas; a 1ª coluna recebe largura pelo `<col>`; as demais dividem o resto por igual. A largura mínima vem do componente, para ligar ou desligar cenários não mexer nas colunas |
| `.tabela-nome-tocavel` | `<button>` dentro de uma célula de `.tabela` que abre um detalhe (card "Categorias do cartão", Análises): mesmo tamanho e peso das células, só a cor de ação `--ac`; nunca `.botao-ver-mais` numa tabela |
| `.rolavel` | wrapper com `overflow-x: auto` para conteúdo largo (tabelas) |
| `.rolavel-12` | modificador de `.rolavel` para a tabela do Simular (12 meses de altura + cabeçalho) — `max-height: calc(13 * 37px)`, `overflow-y: auto`, cabeçalho sticky no topo com z-index 3, primeiro `th` com z-index 4 (sobre a coluna fixa) |
| `.recuo-1` / `.recuo-2` | recuo horizontal (ambos os lados) pra indicar nível de hierarquia numa lista aninhada — ex.: grupo/data em `LancamentosSheet` |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` / `.sheet-cabecalho` / `.sheet-conteudo` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |
| `.shell` / `.shell-corpo` / `.topo` / `.conteudo` | casco do app (ver componente `Shell`) |
| `.grafico-expandido` / `.grafico-expandido-*` | modal expandido do `FluxoChartModal` (exemplo do padrão de prefixo por componente). Inclui o cartão do dia selecionado (`-dia`, `-dia-linha`), os atalhos de período com o botão Hoje (`-atalhos`, `-hoje`; as pílulas são `.pills`) e a dica de gestos (`-dica`). Com cenário ligado: a linha azul "com cenário" sob a data (`-cenario-leitura`, `.vazio` reserva o espaço em dia passado) e a seção "Cenários neste dia" no fim do cartão (`-cenarios`, `-cenarios-titulo`), com altura mínima fixa para o gráfico não pular |
| `.grafico-previa-saldo` | "Saldo hoje" sobre a prévia do gráfico no card do Fluxo (`TelaFluxo.tsx`): rótulo `.sub` + valor `.saldo-grande` |
| `.resumo-barras` / `.resumo-barra-trilho` / `.resumo-barra-preenchimento` | barras de composição ganho/gasto do card resumo em `TelaAnalises.tsx` |
| `.composicao-*` | classes internas do `ComposicaoBarChart.tsx` (mesmo padrão de prefixo por componente) |
| `.evolucao-*` | classes internas do `EvolucaoMensalChart.tsx` (mesmo padrão de prefixo por componente) |
| `.barra-fixa` | barra que gruda logo abaixo do `.topo` (`top: var(--topo-altura)`, medido no Shell.tsx), z-index 9, largura total (margem −16px), fundo `--bg`, padding 6px 16px. Usada pelo seletor de período (Análises), pelo nome + seletor de mês de cada cartão (Cartão, um `div.tela` por cartão para o sticky valer só no bloco) e pela barra do índice da Wiki. Toda barra nova que precise ficar à vista ao rolar usa esta classe |
| `.wiki-barra` | aparência da barra do índice da wiki (`<button className="barra-fixa wiki-barra">`): flex, 44px mínimo, padding 8px 16px, `--fg` em peso 600; `☰ Capítulo · Seção atual`. A posição fixa vem de `.barra-fixa`. `h3[id]` e `.wiki-campos > div` ganham `scroll-margin-top` = `--topo-altura` + `--wiki-barra-altura` (medida no Wiki.tsx) + 8px |
| `.wiki-barra-texto` | texto da barra numa linha só, cortado com reticências |
| `.wiki-barra-secao` | nome da seção atual na barra, em `--muted` e peso normal |
| `.wiki-corpo` | artigo com conteúdo da wiki; `h3` (22px margem superior), `p` (10px margem inferior), `ul` (12px margem, 20px padding-left), `li` (5px margem), `code` (quebra de overflow); position: relative (âncora do .wiki-balao) |
| `.wiki-titulo` | título do capítulo (4px margem superior) |
| `.wiki-link` | link interno da wiki (outro capítulo ou seção) — `--ac`, sublinhado; o mesmo estilo vale para todo `a` em `.wiki-corpo`, links externos inclusive; dentro de `.aviso` todo link herda a cor da nota |
| `.wiki-termo` | termo do glossário no texto da wiki — botão sem aparência de botão, `--fg` com sublinhado pontilhado em `--muted`; `.aberto` em `--ac` enquanto o balão está aberto; dentro de `.wiki-campos dt` herda o cinza do rótulo |
| `.wiki-balao` | balão com a definição do termo, ancorado 10px abaixo da linha do termo, largura do corpo; `--surface2`, raio 18px, sombra; setinha (`::before`) posicionada por `--seta`; dentro dele `.wiki-balao-termo` em negrito (margem 0 0 4px) e `.wiki-balao-def` (margem 0, 15px) |
| `.wiki-campos` | lista de definições de campo (display list); `dt` em `--muted` 13px com 10px margem-top, `dd` com 2px margem-top |
| `.wiki-fundo` | backdrop semifixo do índice (z-index 50, preto semi-transparente `rgba(0,0,0,.55)`) |
| `.wiki-gaveta` | drawer do índice (z-index 51, `min(86vw, 330px)`, 16px padding, `--surface` com borda direita em `--line`, scroll contido) |
| `.wiki-item` | botão de item do índice; `.ativo` marca o capítulo atual com `--ac-dim` fundo e `--ac` cor. Modificador `.wiki-secao` (compõe com `.wiki-item`): seção do capítulo atual na gaveta, recuada 28px, 14px, `--muted`; sua `.ativo` só troca a cor para `--ac` (sem fundo) |
| `.wiki-resultado` | modificador de `.wiki-item`: resultado da busca da wiki, em coluna; `mark` destaca o termo com `--ac-dim`/`--ac` |
| `.wiki-resultado-onde` | `Capítulo · Seção` do resultado, 13px `--muted` |
| `.wiki-resultado-trecho` | trecho em volta do termo, 14px |
| `.erro-app` / `.erro-app-detalhe` | tela de erro (`ErroApp.tsx`): `.erro-app` ocupa a altura toda, centraliza um `.card` em coluna (gap 14px) com título, texto, botão `.botao-primario` em largura cheia e o `.erro-app-detalhe` (12px, `--muted`, quebra palavra longa) com a mensagem técnica |
| `.primeiro-uso` | cartão de onboarding (`PrimeiroUso.tsx`): flex container com gap 14px, botões em largura cheia, espaçamento entre elementos |
| `.pagamento-fatura-*` | bloco de contas do parcelamento de fatura (`PagamentoFaturaSheet.tsx`). `.pagamento-fatura-resumo` é o bloco: `--surface2`, raio 12px, `tabular-nums`; dentro dele cada `.linha-conta` (aninhada, sem existência própria) é rótulo à esquerda e valor à direita. Os modificadores dão a cor do juros no valor — `.pagamento-fatura-juros` âmbar (`--aviso-fg`) quando há juros, `.pagamento-fatura-semjuros` verde (`--pos`) quando não há, `.pagamento-fatura-erro` vermelho (`--neg`) quando as parcelas somam menos que o restante |
| `.sugestoes` / `.sugestao` | contêiner de pílulas de categoria sugerida (quebra linha, gap 8px) e cada pílula (`SeletorCategoria`-like); `.sugestao` é alvo de toque (44px altura), `.marcada` indica seleção com `--ac-dim` fundo e `--ac` cor |
| `.conferencia-bancos` / `.conferencia-bancos-*` | conferência de saldo por banco na `TelaHoje.tsx`, no lugar do campo único quando a box (ou a "casa" inteira) tem bancos cadastrados. `.conferencia-bancos` é a classe raiz (coluna, gap 8px); dentro dela, `.linha-banco` (aninhada, sem existência própria) é o nome do banco à esquerda (`span` em `--muted` 14px) e o `CampoValor` à direita; `.total` (aninhada) é a linha "Total informado" e a linha "Total calculado no Flow", com borda superior em `--line`, `tabular-nums` |
| `.conferencia-saldo` | conferência de saldo único na `TelaHoje.tsx`, quando não há bancos cadastrados. Mesmo layout da `.conferencia-bancos` (coluna, gap 8px); a `.total` aninhada é a linha "Total calculado no Flow", idêntica à da conferência por banco |
| `.backup-rodape` / `.backup-rodape-neutro` | rodapé de backup da Visão (`TelaHoje.tsx`). `.backup-rodape` é só a forma (botão de bloco, sem borda, alinhado à esquerda, altura mínima de 42px); `.backup-rodape-neutro` é o estado sem mudanças pendentes (sem fundo, `--muted`, 13px). Nos estados âmbar e vermelho, o botão leva `.aviso` / `.aviso .aviso-urgente` no lugar da `-neutro` |
| `.frequentes` | faixa de atalhos no topo da sheet Adicionar (`AdicionarSheet.tsx`) |
| `.frequentes-chip` | pílula de atalho (categoria + valor) dentro de `.frequentes` — `--surface2`, porque a sheet já é `--surface` |
| `.frequentes-detalhe` | o valor dentro do chip, em `--muted` e `tabular-nums` |
| `.frequentes-ponto` | ponto azul que marca atalho com destino de cartão |
| `.versao-detalhes` | lista de detalhes recuada sob um tópico do changelog, na tela Versão (`Versao.tsx`) — `--muted`, 13px |
| `.escanear-nota-video` | preview da câmera em `EscanearNotaSheet.tsx` |
| `.nota-bloco` | resumo da nota fiscal anexada a uma compra do cartão (`FormCompra.tsx`) — emitente, data, total da nota e contagem de itens sobre `--surface2`; também envolve o painel de anexar o XML |
| `.nota-itens` / `.nota-item` / `.nota-item-diferenca` | lista compacta "item → valor → % do total" dentro do `.nota-bloco`, com rolagem própria; cada `.nota-item` é uma linha de duas colunas (descrição e quantidade à esquerda, valor em negrito e percentual à direita); `.nota-item-diferenca` marca a linha final de desconto/frete |
| `.selecionar-arquivo` | wrapper de um seletor de arquivo estilizado como `.botao`: um botão decorativo (`aria-hidden`, `tabIndex={-1}`) chama `input.click()`, e o `input[type=file]` real fica por cima dele com opacity 0 (não `display:none`), como o alvo de toque de verdade — mesma técnica de `.campo-data`/`.campo-data-input` (`CampoData.tsx`). Não monte à mão: use o `EscolherArquivo` |
| `.importar-resumo` / `.importar-contagem` / `.importar-contagem-linha` / `.importar-valor` | resumo por estado no topo da conferência (`ListaConferencia.tsx`): `.importar-resumo` é a grade de duas colunas, `.importar-contagem` cada pílula, um `<button>` em duas linhas (`min-height: 44px`): `.importar-contagem-linha` (ponto colorido + número + rótulo) e, embaixo, `.importar-valor` (soma dos valores do estado, `formatarBRL`, `--muted`, `--ac` na pílula ativa). As pílulas de previsto e divergente só entram na grade quando há itens. A pílula filtra a lista abaixo pelo estado dela — `aria-pressed` marca a pílula ativa, `.ativo` dá a cor (`--ac-dim`/`--ac`, mesmo padrão de `.botao.ativo`), e uma pílula de contagem zero vem `disabled` (`opacity: .45`) |
| `.importar-ponto` | ponto colorido de 8px que marca o estado de um item da conferência; usado sozinho no resumo (`.importar-contagem`) e junto de `.importar-estado` em cada linha (`LinhaConferencia.tsx`). Seis modificadores compostos, um por `EstadoItem` (confere/previsto/divergente/novo/sobra/interno), dão a cor de fundo — `--pos`/`--ac`/`--aviso-fg`/`--estado-novo`/`--neg`/`--muted`, nessa ordem |
| `.importar-estado` | nome do estado de um item da conferência (`LinhaConferencia.tsx`), com os mesmos seis modificadores compostos do `.importar-ponto` acima dando a cor do texto |
| `.importar-rodape` | rodapé fixo do passo 3 da conferência (`Importar.tsx`) — `position: sticky`, grudado no fim da área visível (`bottom: 0`), com `padding-bottom` de 96px no mobile e 24px no desktop para o botão ficar acima da barra de navegação; o fundo é opaco (`--bg`) do degradê de 20px para baixo, então o texto que rola não aparece atrás nem abaixo da mensagem; reúne o botão Confirmar, a contagem de itens sem mudança e o aviso de erro |

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
- **`MinMaxSeries.tsx`** — rodapé "mín · máx" dos gráficos de saldo. Sem cenário ligado, texto corrido
  numa linha só (com `rotulo` opcional, ex.: "no período"). Com cenário, uma linha para o real e outra
  para o cenário, em colunas alinhadas (`.minmax-series`). Usado pelo `BalanceChart` e pelo `FluxoChartModal`.
- **`FluxoChartModal.tsx`** — versão em tela cheia do `BalanceChart`, com pan (um dedo), leitura por dia (segurar e arrastar), zoom, atalhos de período e cartão do dia, via
  `recharts` carregado sob demanda (`React.lazy`). Ver
  `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md`.
- **`FaturaResumo.tsx`** — resumo somente leitura de uma fatura de cartão.
- **`AvisoFaturaForaDoFluxo.tsx`** — o `.aviso` de fatura que não bate com o Fluxo
  (`faturaForaDoFluxo`, `domain/fatura.ts`): fatura vencida que ficou de fora, ou paga a menor
  com o link "Corrigir o valor pago". Usado na `TelaCartao` e no `FaturaResumo`, para as duas
  telas dizerem a mesma frase.
- **`SeletorCategoria.tsx`** — grid de 3 colunas (`.grade-categorias`) pra escolher uma
  categoria por toque, sem abrir o picker nativo do `<select>`. Usado em `TelaLancar.tsx`,
  `Recorrencias.tsx`, `FormCompra.tsx`, `LancEditor.tsx`, `FormItemCenario.tsx`.
- **`SeletorMes.tsx`** — navegação de mês: `‹` e `›` em `.botao` (rótulos "Mês anterior" e "Mês seguinte") com o mês por nome no meio (`nomeDoMes`, "outubro de 2026"). Props `mes` (`AAAA-MM`) e `onMudar`. Usado nas Análises e no Cartão — qualquer tela nova que navegue por mês usa este componente. No Cartão, fica dentro de `.barra-fixa` junto com o nome do cartão; nas Análises, entra pelo `SeletorPeriodo` no modo Mês.
- **`SeletorPeriodo.tsx`** — seletor de período das Análises: pílulas `Mês · 12 meses · Ano · Período` (`SeletorPills`), as linhas `de ‹ › ` e `até ‹ ›` com a nota "N meses · máximo de 24" (só no modo Período) e a linha `‹ período ›` dentro de `.barra-fixa` (no modo Mês, é o próprio `SeletorMes`). Props `estado` (`EstadoPeriodo`, de `domain/periodo.ts`), `mesHoje` e `onMudar`. Filho direto de `.tela`.
- **`SeletorPeriodoSimular.tsx`** — seletor de período do Simular: duas linhas com `de`/`até`, cada uma com setas `‹ ›`, select de mês, select de ano, e um contador "N meses · máximo de 60" (singular "1 mês"). Aviso opcional se o período ultrapassa o horizonte do app: "Depois de MMMM/AAAA, a tabela não inclui faturas de cartão." Dentro de `.card`. Props `periodo` (`PeriodoSimulacao`, de `domain/simulacao.ts`), `mesHoje` (mês de hoje, como piso para o período inicial), `horizonte` (data ISO para o cálculo do aviso) e `onMudar`.
- **`SeletorPills.tsx`** — pílulas em linha (`.pills`) pra escolher entre poucas opções sem
  abrir o picker nativo do `<select>`; cada pílula é `role="radio"` com `aria-checked`, e a
  prop opcional `rotulo` nomeia o grupo. Exporta `OPCOES_TIPO` (Gasto/Ganho), o controle
  único de tipo em `TelaLancar.tsx`, `Recorrencias.tsx` e `Categorias.tsx`. Usado também em
  `CategoriasCartao.tsx`, `Assinaturas.tsx` (Cartão) e `PagamentoFaturaSheet.tsx` (destino
  da sobra da fatura) — a box em si não tem mais seletor próprio nessas telas: as telas de
  Ajustes por box usam a box do chip do topo (`boxIdConcreta`, `state/store.ts`) e mostram
  `AvisoEscolhaBox` quando a casa está no topo,
  reforçando a sensação de "perfil" (ver `docs/superpowers/specs/`).
- **`SeletorBanco.tsx`** — pílulas (`SeletorPills`) para escolher o banco de um lançamento ou de
  uma recorrência. Props `bancos`, `selecionadaId` (`null` = nenhum marcado, lançamento antigo sem
  banco) e `onSelecionar`. Devolve `null` com menos de dois bancos: o campo some. O banco padrão
  vem marcado por quem usa (`bancoPadrao`, `domain/bancos.ts`). Usado em `TelaLancar.tsx`,
  `LancEditor.tsx` e `ajustes/Recorrencias.tsx`.
- **`SeloBox.tsx`** — selo `.badge` com o nome da box de um lançamento. Aparece só na visão casa (`boxSel === 'casa'`), ao lado da categoria, em Hoje → Pendentes e Fluxo → Lista. Box inexistente mostra `?`.
- **`SeletorFiltroBanco.tsx`** — filtro por banco: pílulas (`SeletorPills`) "Todos", cada banco da
  box e "Sem banco". Props `bancos`, `valor` (`FiltroBanco`, de `domain/bancos.ts`) e `onMudar`.
  Devolve `null` com menos de dois bancos. Usado no `TelaFluxo.tsx` (só a lista; o saldo do dia
  segue o da box inteira) e no `TelaAnalises.tsx` (filtra os agregados por `dadosDoBanco`).
- **`LinhaOrcamentoViagem.tsx`** — linha do orçamento de viagem, "R$ X de R$ Y · falta R$ Z"
  (verde, `strong.valor-ganho`) ou "· passou R$ Z" (vermelho, `strong.valor-gasto`, com o
  `TriangleAlert` dentro do valor). Prop `comEsteGasto` põe o prefixo "Com este gasto: ". Usada
  em `TelaLancar.tsx`, `FormCompra.tsx` e `ajustes/Viagens.tsx` — qualquer tela nova que mostre
  o orçamento usa este componente.
- **`PagamentoFaturaSheet.tsx`** — conteúdo da folha que registra o pagamento de uma fatura
  por valor diferente do total e o destino do que sobrou (mês seguinte, parcelamento ou nada). Exporta o conteúdo puro (default,
  para o teste montar sem backdrop) e `PagamentoFaturaSheetModal`, que o embrulha no `Sheet`.
  Consumido pela fila de pendentes da `TelaHoje`, pela fatura da `TelaCartao` e pelo `FaturaResumo`; recebe o
  lançamento da fatura e o total dela, porque nem sempre um é o outro (fatura já paga em
  parte tem valor menor que o total calculado).
- **`AssinaturasResumoSheet.tsx`** — sheet de Análises com o total de assinaturas do mês,
  agrupado por cartão (prop opcional `periodo`: o intervalo, sob o título, quando Análises cobre vários meses), no mesmo padrão do `LancamentosSheet`: cabeçalho do grupo em
  `.recuo-1` com o subtotal, itens em `.recuo-2`.
- **`EscolherArquivo.tsx`** — o botão "Escolher arquivo" do app sobre um `input[type=file]`
  invisível (`.selecionar-arquivo`), no lugar do controle nativo, cujo texto vem do navegador.
  Props `id`, `accept`, `onEscolher(arquivo)`; `primario` só quando escolher o arquivo é a
  ação principal da tela; `rotulo` quando não há `<label htmlFor>`. Usado em `Importar.tsx`,
  `Backup.tsx`, `FormCompra.tsx` e `EscanearNotaSheet.tsx`.
- **`ComposicaoBarChart.tsx`** — barras horizontais de composição por categoria na aba
  Análises (substitui a antiga tabela "Por categoria"); escala compartilhada com as
  barrinhas do card resumo (`base = max(totalGanhos, totalGastos)`), mesmo contrato de
  acessibilidade (`role="button"` por linha) que a tabela anterior usava.
- **`TabelaSimulacao.tsx`** — tabela mês a mês do Simular (Mês · Com · Diferença · Sem), em
  `.tabela.tabela-fixa`; largura mínima vinda dos extremos possíveis, para ligar ou desligar
  cenários não mexer nas colunas.
- **`EvolucaoMensalChart.tsx`** — evolução de ganho/gasto/sobra dos últimos 6 meses na aba
  Análises: barras agrupadas + linha de tendência tracejada, via `recharts` carregado sob
  demanda (`React.lazy`), mesmo padrão do `FluxoChartModal`. Recebe a série de meses do período;
  acima de 6 meses, a fileira de sobra vira a linha "sobra do período"; acima de 12, o eixo mostra
  um mês a cada 3 (`jan/25`).
- **`AdicionarSheet.tsx`** — sheet do botão flutuante "+": menu com passos (lançamento manual,
  compra no cartão) que troca de tela via `passo`; escolhe o cartão automaticamente quando só
  há um ativo, senão mostra `.pills` pra escolher; renderiza `FormCompra` no passo final.
- **`FormCompra.tsx`** — formulário de compra no cartão (valor, data, categoria, parcelas,
  parcelas já pagas, descrição, viagem, nota fiscal anexada). Usado por `AdicionarSheet`
  (nova) e `TelaCartao` (edição).
- **`LancEditor.tsx`** — sheet de edição de um lançamento existente (valor, data, categoria,
  banco, nota, sinal ganho/gasto); usa `Sheet`, `CampoData`, `CampoValor`, `SeletorCategoria`; o campo Banco (`SeletorBanco`) não aparece para fatura, transferência, previsto de recorrência nem cenário.
- **`LancamentosSheet.tsx`** — sheet somente leitura com os lançamentos de uma categoria no
  mês, agrupados por nota (`lancamentosDaCategoria`); usado no drill-down de Análises. Prop
  opcional `onVoltar`: "‹ voltar ao período" (`.botao-ver-mais`) no topo. Prop opcional
  `verFatura` (categoria de fatura cujo valor do mês não é a fatura — pagamento diferente,
  manual ou antigo): link "Ver a fatura de <mês> (<total>) →" (`.botao-ver-mais`) no fim.
- **`FaturaCategoriaSheet.tsx`** — sheet somente leitura com o resumo por categoria de uma
  fatura de cartão (drill-down a partir de `FaturaResumo`/`TelaCartao`). Prop opcional
  `onVoltar`: "‹ voltar ao período" (`.botao-ver-mais`) no topo.
- **`CategoriaCartaoHistoricoSheet.tsx`** — sheet somente leitura com uma categoria do cartão
  nos 6 meses de fatura até o mês escolhido, em barras `.composicao-*` (100% = maior mês) e a
  média, ou nos meses do período (`periodo`), com "média por mês"; aberto pelo card "Categorias do
  cartão" de Análises (`totaisCategoriaCartaoPorMes`).
- **`CategoriaPeriodoSheet.tsx`** — sheet de uma categoria num período de vários meses (Análises): total no cabeçalho, uma barra por mês (`.composicao-*`, 100% = maior mês) e a média por mês; tocar num mês (`role="button"`, Enter/espaço) chama `onAbrirMes`, e a Análises abre o `LancamentosSheet` ou o `FaturaCategoriaSheet` daquele mês com "‹ voltar ao período".
- **`CategoriasCartaoCard.tsx`** — card "Categorias do cartão" de Análises: tabela no formato
  do Comparativo (mês · mês anterior · ano passado · média 3m) por categoria do cartão, um
  bloco por cartão (subtítulo `.rotulo-grupo` na coluna fixa, só com 2+ cartões); o nome
  (`.tabela-nome-tocavel`) abre o `CategoriaCartaoHistoricoSheet`. Com `periodo` (2+ meses): período ·
  anterior · ano anterior (some com 12 meses) · média/mês, e a nota de intervalos no subtítulo.
- **`ViagemSheet.tsx`** — sheet somente leitura com os lançamentos/compras de uma viagem,
  agrupados (`itensDaViagem`); mesmo padrão visual do `LancamentosSheet`.
- **`ErroApp.tsx`** — limite de erro (error boundary) que envolve o `App` em `main.tsx`. Troca
  a tela preta de um erro de renderização por uma tela com o botão "Recarregar". Quando o erro
  é um trecho do app que não carrega (versão antiga, depois de um deploy), recarrega sozinho
  uma vez por minuto e mostra "Atualizando o Flow…" nesse meio-tempo.
- **`PrimeiroUso.tsx`** — cartão de onboarding renderizado em `TelaHoje` quando o app está sem
  box com saldo próprio ou sem categorias. Guia o usuário pelos primeiros passos: criar box,
  importar backup ou escolher categorias. Desaparece automaticamente quando os dados
  correspondem (sem flag persistido de conclusão).
- **`EscanearNotaSheet.tsx`** — captura de compra por nota fiscal: câmera decodifica o
  QR-code via `jsQR` (ou chave digitada à mão, sempre disponível); mostra a chave extraída;
  aceita o XML da nota por upload ou colado, faz o parse (`domain/notaFiscal.ts`) e devolve o
  resultado por `onConcluir`. Usado por `AdicionarSheet`.
- **`TransferenciaSheet.tsx`** — sheet somente leitura com o detalhe de uma transferência
  entre bancos (a nota do lançamento, "banco origem → banco destino", mais valor e data), com
  o botão que exclui as duas pernas ligadas por `transferenciaId`. Mesmo padrão do
  `FaturaResumo.tsx`. Usado pela `TelaFluxo` ao clicar num lançamento `origem: 'transferencia'`.
- **`FormItemCenario.tsx`** — formulário de item de cenário, novo e edição: valor, descrição,
  Gasto/Ganho, categoria (`SeletorCategoria`, sem as categorias de fatura e de transferência,
  e sem as arquivadas), repetição Uma vez/Parcelado/Todo mês, data (ou "a partir de", nas
  recorrentes) e parcelas.
  Prop `repeticaoFixa` esconde o seletor de repetição na edição — pra trocar, exclui-se o item
  e cria-se outro. No parcelado, o campo Valor é o total: a dica abaixo mostra o valor de cada
  parcela (total ÷ N, arredondado). No "todo mês", a dica lembra de lançar só a diferença de
  algo que já existe. Exporta `categoriasDoItem` e `gravarItemNovo` (item novo: "uma vez" vira
  lançamento previsto do cenário; parcelado/mensal viram recorrência).
- **`ItemCenarioSheet.tsx`** — sheet de editar ou excluir um item de cenário existente; monta
  os valores iniciais a partir do `ItemCenario` (`domain/simulacao.ts`) e usa `FormItemCenario`
  com `repeticaoFixa`. "Excluir item" pede confirmação (`window.confirm`) antes de remover o
  lançamento ou a recorrência.
- **`CenarioCard.tsx`** — card de um cenário no Simular (`SimuladorFluxo.tsx`): o checkbox liga
  e desliga o cenário na projeção; o resto do cabeçalho (nome, resumo e a seta) abre e fecha o
  card. Aberto, mostra a lista de itens (cada um abre o `ItemCenarioSheet` para editar/excluir),
  o impacto isolado desse cenário (`TabelaSimulacao`), o `FormItemCenario` para um item novo e
  as ações Tornar real / Excluir cenário (ambas com `window.confirm`).
- **`SimuladorFluxo.tsx`** — conteúdo da pílula "Simular" do Fluxo (`TelaFluxo.tsx`): formulário
  de novo cenário no topo, resumo mensal dos cenários ligados (`TabelaSimulacao`, aviso se o
  saldo fica negativo) e a lista de `CenarioCard`, um aberto por vez. A largura das colunas de
  valor (`larguraColunaValor`) é calculada sobre os extremos possíveis de todos os cenários, para
  ligar/desligar um não mudar a tabela.
- **`SimuladorSimples.tsx`** — conteúdo da pílula "Simular" do Fluxo no modo Simples
  (`useModo('fluxo')`): um formulário só ("E se eu gastar…": valor, "Quando", Uma vez, Parcelado
  ou Todo mês) e o botão "Simular". O resultado mostra o menor saldo sem e com o gasto
  (`menorSaldo`, `classeSaldo`) e, se o saldo fica negativo, um `aviso aviso-urgente`. Cria um
  cenário de rascunho "Simulação rápida" (`rascunho: true`) que some ao desmontar; "Guardar" o renomeia para "Simulação de
  DD/MM", desligado. Só usa classes existentes (`.campo`, `.botao-primario`, `.aviso`).
- **`CartaoSimples.tsx`** — fatura do mês no modo Simples (`useModo('cartao')`), no lugar de
  `CartaoFatura.tsx`: campo "Valor da fatura" (mesma `ConferenciaFatura` com `usarValorApp` da
  aba Conferência), vencimento em `.sub`, "Salvar fatura", "Remover valor" (`botao-perigo`) e
  "Paguei tudo" / "Paguei outro valor". Mês vencido sem lançamento mostra o mesmo `AvisoFaturaForaDoFluxo` do Avançado e não paga.
  Só usa classes existentes.

`Importar.tsx` (subtela "Importar e conferir" de Ajustes) e seus dois auxiliares só dela,
`ListaConferencia.tsx` e `LinhaConferencia.tsx`, não entram nesta lista: os três vivem em
`src/ui/ajustes/`, mesmo caso já registrado no topo desta seção (varredura do verificador não
desce a subpastas). `Importar.tsx` orquestra os três passos (arquivo, destino, conferir);
`ListaConferencia.tsx` monta o resumo de contagens (`.importar-resumo`), filtrável tocando numa
pílula, e a lista em ordem de data (só de exibição — quem confirma continua olhando tudo, em
`Importar.tsx`); `LinhaConferencia.tsx` renderiza uma linha (etiqueta
`.importar-ponto`/`.importar-estado`, detalhe, valor, botões de ação).

- **`ajustes/AvisoEscolhaBox.tsx`** — aviso (`.sub`) das telas de Ajustes que pertencem a uma box
  (Categorias, Categorias do cartão, Cartões, Assinaturas, Recorrências) quando "casa" está no topo:
  "<assunto> são de cada box. Escolha uma box no topo para ver ou editar." Vive em `src/ui/ajustes/`,
  fora da varredura do verificador, como `Importar.tsx` acima.
