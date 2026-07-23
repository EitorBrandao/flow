# Gráficos e responsividade na aba Análises

## Contexto

A aba Análises (`TelaAnalises.tsx`) hoje é só texto/tabela: card resumo (Ganhos/Gastos/Sobra),
tabela "Por categoria", lista de "Viagens" e tabela "Comparativo" (mês atual / mês anterior /
ano passado / média 3m). O pedido: (1) adicionar visualização gráfica — composição por
categoria, evolução mensal, e ganhos×gastos×sobra — e (2) tornar a tela responsiva no celular,
com a tabela "Comparativo" (a única tabela que sobra depois da mudança 1) nunca perdendo o
nome da categoria ao rolar horizontalmente.

Restrição de partida: o sistema visual do Flow é dark-only e usa só três cores com significado
fixo (`docs/estilo/fundamentos.md`) — `--ac` azul exclusivo de ação, `--pos` verde e `--neg`
vermelho exclusivos de dinheiro (ganho/gasto). Não existe paleta categórica (N cores
distintas para N categorias). Por isso — e porque a doc de dataviz do projeto recomenda barra
em vez de pizza para "parte-do-todo" com mais de ~3 categorias ou nomes longos — os gráficos
abaixo usam só as cores já existentes, sem introduzir uma paleta nova.

## 1. Card resumo do topo — barrinhas ganho/gasto

`TelaAnalises.tsx`, card do topo (linha "Ganhos / Gastos / Sobra"): mantém os três valores em
texto como hoje e adiciona, logo abaixo, duas barras horizontais finas numa escala
compartilhada (o maior dos dois valores = 100%) — uma verde (ganho), uma vermelha (gasto).
Implementação em SVG/div simples, sem lib (mesmo espírito de `BalanceChart.tsx`, que já é SVG
cru) — não precisa de recharts para duas barras estáticas.

## 2. Composição por categoria — substitui a tabela "Por categoria"

Novo componente `src/ui/ComposicaoBarChart.tsx` (recharts, `BarChart` `layout="vertical"`,
carregado sob demanda via `React.lazy`/`Suspense`, como `FluxoChartModal` já faz com
`recharts`). Substitui inteiramente a tabela "Por categoria" (não fica lado a lado).

- Uma barra por linha, na **mesma ordem de hoje**: categorias por `compararCategorias`
  (ganhos antes de gastos, ordem do usuário), depois a linha agregada "Assinaturas" (se
  `resumoAssinaturas.totalCent > 0`), depois uma linha por viagem com movimento no mês
  (`viagensNoMes`).
- Cor da barra: verde (`--pos`) para linhas de ganho, vermelho (`--neg`) para linhas de gasto/
  assinaturas/viagem. Comprimento proporcional ao valor absoluto.
- **Escala compartilhada com o card resumo (seção 1):** o comprimento de cada barra é
  `valor / base`, com `base = max(totalGanhos, totalGastos)` do mês — a mesma base usada nas
  barrinhas do card resumo. Isso permite comparar visualmente "quanto essa categoria representa
  do total" entre os dois cards. Para linhas de gasto, `valor/totalGanhos` já é o mesmo cálculo
  de `pctDaRenda` (`aggregations.ts`) sempre que `totalGanhos ≥ totalGastos`; quando o mês tem
  mais gasto que ganho, `base` passa a ser `totalGastos` e a barra deixa de coincidir com
  `pctDaRenda` — usar `base` calculado à parte, não reaproveitar `pctDaRenda` para o
  comprimento da barra.
- Rótulo: nome da categoria/linha + valor formatado (`formatarBRL`); quando é gasto, também a
  `% da renda` (mesmo dado que a coluna 3 da tabela atual).
- Clique/tap na barra dispara o mesmo comportamento de hoje: linha de categoria com cartão
  associado → `FaturaCategoriaSheet`; categoria comum → `LancamentosSheet`; "Assinaturas" →
  `AssinaturasResumoSheet`; viagem → `ViagemSheet`. Reaproveita o estado
  (`categoriaAberta`/`assinaturasAberto`/`viagemAberta`) já existente em `TelaAnalises.tsx`.
- Estado vazio: mesma mensagem atual ("Sem movimentos no mês.") quando não há nenhuma linha.

## 3. Evolução mensal — novo card

Novo componente `src/ui/EvolucaoMensalChart.tsx` (recharts, `BarChart` de barras agrupadas,
lazy-loaded do mesmo jeito). Card novo na tela, abaixo do card resumo (posição exata a acertar
no mockup).

- Eixo X: últimos 6 meses terminando no mês selecionado (mesma janela `[-5..0]` que
  `TelaAnalises.tsx` já usa para a média móvel — `[-5,-4,-3,-2,-1,0].map(n => addMeses(mes,n))`).
- Por mês, duas barras lado a lado: ganho (verde) e gasto (vermelho) — totais do mês inteiro,
  não por categoria.
- Rótulo de "sobra" acima de cada par de barras: `ganho - gasto` do mês, cor verde se ≥ 0,
  vermelho se negativa (mesma convenção de `resumo.sobra >= 0 ? 'valor-ganho' : 'valor-gasto'`
  já usada no card resumo).
- **Linha de tendência:** duas linhas tracejadas sobrepostas às barras — uma verde (ganhos),
  uma vermelha (gastos) — conectando o total real de cada um dos 6 meses (não é média móvel
  nem regressão, é o valor do mês ligado ao do mês seguinte, mesma leitura de "para onde a
  curva está indo" que `BalanceChart.tsx` já usa). Traço tracejado, mesmo padrão de
  `stroke-dasharray` usado em `BalanceChart.tsx`/`FluxoChartModal.tsx` para as linhas "futuro/
  projetado". Implementar com `ComposedChart` do recharts (`Bar` + `Line` no mesmo gráfico) para
  o alinhamento entre barra e linha ser exato — o mockup HTML usou um SVG posicionado à mão só
  para ilustrar, não é a técnica final.
- Requer função nova em `src/domain/aggregations.ts` — totais de ganho/gasto/sobra por mês
  para uma lista de meses, reaproveitando `filtrar`/`totaisPorCategoria` (já existentes nesse
  arquivo). Nome sugerido: `serieMensalResumo`. Teste no mesmo commit
  (`src/domain/aggregations.test.ts`).
- Respeita `incluirPrevistos` e a seleção de box (`ids`), igual ao resto da tela.

## 4. Tabela "Comparativo" — primeira coluna sempre visível

Depois da mudança 2, "Comparativo" é a única tabela que sobra na aba (e a única no app —
`grep` confirmou que `className="tabela"` só aparece em `TelaAnalises.tsx`). Ajuste direto na
classe `.tabela` em `src/styles.css` (não precisa de modificador à parte, já que não há outro
uso hoje). Especificação final ajustada durante 3 rodadas de mockup (ver histórico do mockup
para o diagnóstico completo de cada bug):

- **`<h2>Comparativo</h2>` fica FORA do container que rola.** Estrutura atual em
  `TelaAnalises.tsx` é `<div className="card rolavel"><h2>...</h2><table>...` — o título, por
  estar dentro do mesmo elemento com `overflow-x:auto`, rolava junto com a tabela. Trocar para
  `<div className="card"><h2>...</h2><div className="rolavel"><table>...</table></div></div>` —
  só a tabela rola, o título fica parado.
- `table.tabela`: `border-collapse: separate; border-spacing: 0;` (era `collapse`) —
  `position: sticky` numa `<td>` com `border-collapse: collapse` é um bug conhecido de
  Chrome/Safari mobile onde o fundo da célula fixa não cobre direito o conteúdo que rola por
  baixo.
- `table.tabela`: `width: max-content; min-width: 100%;` (era `width: 100%`) — **causa raiz do
  vazamento de texto.** Com `width: 100%` fixo, assim que a primeira coluna passou a aceitar
  quebra de linha (item abaixo), o motor de auto-layout comprimia as colunas de valor (alinhadas
  à direita, `nowrap`) abaixo da largura que o conteúdo precisava; texto alinhado à direita que
  não cabe vaza para a **esquerda**, ou seja, por trás da coluna fixa. `width: max-content`
  deixa a tabela assumir só a largura que o conteúdo pede, sem compressão.
- `th:first-child`, `td:first-child`: `position: sticky; left: 0; background: var(--surface);
  z-index: 2; width: 112px; max-width: 112px;` — largura fixa (não automática) na coluna fixa,
  para o cálculo de largura das outras colunas ficar previsível e não repetir o bug acima. Sem
  fundo visível por trás (mesmo fundo do card).
- `box-shadow: 4px 0 6px -4px rgba(0,0,0,.45);` na coluna fixa — sombra sutil na borda direita
  para sinalizar visualmente que ela "flutua na frente" do conteúdo que rola por baixo (troca a
  ideia original de `border-right: 1px solid var(--line)`, que ficava redundante com a sombra).
- `overflow-anchor: none;` no container que rola — defensivo: evita que o navegador ajuste
  sozinho a posição de rolagem quando a altura de uma célula muda (ex.: nome de categoria que
  quebra em várias linhas) depois do layout inicial.
- **Nome da categoria nunca é cortado:** a coluna fixa recebe `white-space: normal` (as demais
  colunas continuam `nowrap`) — nome longo quebra em 2+ linhas em vez de truncar com
  reticências.
- `th`, `td`: `padding: 8px 13px;` (era `padding: 8px` uniforme) — mais espaço horizontal entre
  colunas, ajuste pedido na revisão do mockup.
- As demais colunas (mês atual, mês anterior, ano passado, média 3m) continuam roláveis
  horizontalmente dentro do `.rolavel`, como já é hoje.

## Fora de escopo

- Paleta categórica nova (avaliada e descartada — ver Contexto).
- Zoom/pan ou expandir em tela cheia nos gráficos novos (ficam inline nos cards, decisão do
  usuário nesta sessão).
- Mudar a lista "Viagens" (fica como está, não é uma tabela).
- Qualquer tabela fora de `TelaAnalises.tsx` (não existe outra hoje).

## Notas de implementação

- `recharts` já é dependência do projeto (usado em `FluxoChartModal.tsx`); não é dependência
  nova, então não precisa da confirmação de "dependência npm nova" do `CLAUDE.md`.
- Dois componentes novos → cada um com teste no mesmo commit e entrada em "Componentes
  compartilhados" de `docs/estilo/catalogo.md` (regra do nível 4).
- **Mockup HTML aprovado pelo usuário** (regra do ciclo de entrega do `CLAUDE.md`) cobrindo as
  4 seções acima juntas na tela — 4 rodadas de revisão (escala da composição, linha de
  tendência, e 3 correções sucessivas do bug da coluna fixa até a causa raiz real, todas
  incorporadas nas seções 2–4 acima). Aprovação final do usuário nesta sessão.
