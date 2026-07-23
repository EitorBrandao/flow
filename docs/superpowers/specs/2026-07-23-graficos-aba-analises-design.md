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
- Requer função nova em `src/domain/aggregations.ts` — totais de ganho/gasto/sobra por mês
  para uma lista de meses, reaproveitando `filtrar`/`totaisPorCategoria` (já existentes nesse
  arquivo). Nome sugerido: `serieMensalResumo`. Teste no mesmo commit
  (`src/domain/aggregations.test.ts`).
- Respeita `incluirPrevistos` e a seleção de box (`ids`), igual ao resto da tela.

## 4. Tabela "Comparativo" — primeira coluna sempre visível

Depois da mudança 2, "Comparativo" é a única tabela que sobra na aba (e a única no app —
`grep` confirmou que `className="tabela"` só aparece em `TelaAnalises.tsx`). Ajuste direto na
classe `.tabela` em `src/styles.css` (não precisa de modificador à parte, já que não há outro
uso hoje):

- `th:first-child`, `td:first-child`: `position: sticky; left: 0; background: var(--surface);
  z-index: 1;` — mesmo fundo do card, sem costura visível ao rolar.
- Borda direita fina em `border-right: 1px solid var(--line)` na coluna fixa, sinalizando que
  há mais colunas roláveis (uso já estabelecido de `--line` como separador raro de tabela).
- **Nome da categoria nunca é cortado:** a coluna fixa recebe `white-space: normal` (a tabela
  hoje não define `white-space`, mas o nome deve continuar podendo quebrar em 2+ linhas em vez
  de truncar com reticências — sem `text-overflow`/`nowrap` nessa coluna). A largura da coluna
  se ajusta ao conteúdo (comportamento padrão de `<td>` numa `<table>` sem `table-layout:
  fixed`).
- As demais colunas (mês atual, mês anterior, ano passado, média 3m) continuam roláveis
  horizontalmente dentro do `.rolavel` do card, como já é hoje.

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
- Antes de implementar: mockup HTML aprovado pelo usuário (regra do ciclo de entrega do
  `CLAUDE.md`, já que é edição de UI) cobrindo as 4 seções acima juntas na tela.
