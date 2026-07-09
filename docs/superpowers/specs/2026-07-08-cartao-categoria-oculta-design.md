# Categoria da fatura vira automática e oculta

**Data:** 2026-07-08
**Status:** aprovado em brainstorming (implementação adiada — "vou implementar em outro momento")

## Objetivo

Hoje, ao cadastrar um cartão (Ajustes → Cartões), o usuário precisa escolher manualmente uma
categoria de gasto existente ("categoria da fatura") pra receber o lançamento mensal
sincronizado automaticamente com o total da fatura. Isso tem dois problemas:

1. O usuário precisa criar essa categoria à mão antes (ex.: uma categoria chamada "cartão") e
   ela some no meio das categorias normais em Lançar/Ajustes → Categorias, mesmo não sendo pra
   lançamento manual — lançar um gasto manual nela cria duplicidade com o valor que já entra
   sozinho pelo sync da fatura.
2. Na aba Fluxo, o lançamento da fatura aparece com o nome dessa categoria escolhida (ex.:
   "cartão"), não com o nome do cartão — e pode ser editado por lá como um lançamento comum,
   o que também conflita com o sync automático (a próxima sincronização sobrescreve valor/data
   editados manualmente).

Este spec elimina a escolha manual de categoria: o app cria e mantém essa categoria sozinho,
escondida de qualquer lugar de seleção manual, sempre com o mesmo nome do cartão. Como
consequência, o nome do cartão passa a aparecer nativamente em Fluxo (e de brinde em
Hoje/Análises/Simulador, que leem o mesmo campo `nome` da categoria). Na aba Fluxo, o
lançamento da fatura deixa de abrir o editor genérico e passa a abrir um resumo somente
leitura com um atalho para a aba Cartão.

**Sem mudança de schema** — `Cartao.categoriaFaturaId` continua existindo e sendo obrigatório;
só muda quem escolhe o valor (o app, não o usuário) e onde essa categoria pode aparecer.

## Decisões (validadas com o usuário)

1. **Cadastro de cartão não pede mais categoria.** O campo "Categoria da fatura" some do
   formulário em Ajustes → Cartões. Ao criar um cartão, o app cria uma `Categoria` nova
   (`tipo: 'gasto'`, `boxId` do cartão, `nome` = nome do cartão) e usa o `id` dela como
   `categoriaFaturaId`.
2. **Nome da categoria fica sincronizado com o nome do cartão.** Ao editar o nome de um
   cartão existente, a categoria vinculada (`categoriaFaturaId`) é renomeada junto, na mesma
   operação de salvar o cartão.
3. **Cartões já cadastrados não são migrados.** A categoria que já usavam (ex.: uma chamada
   "cartão", criada manualmente pelo usuário antes deste spec) simplesmente passa a ser tratada
   como oculta a partir de agora — sem script de migração, sem trocar `categoriaFaturaId`. Só
   passa a ser renomeada automaticamente na próxima vez que o cartão for editado (decisão 2).
4. **A categoria oculta some de todo lugar de seleção manual:**
   - Grade de categorias em `TelaLancar`.
   - Lista de `Ajustes → Categorias`.
   - `<select>` de categoria no editor de lançamento (`LancEditor`, aba Fluxo).
   "Oculta" é derivado, não é um campo novo: qualquer categoria cujo `id` seja
   `categoriaFaturaId` de algum cartão (ativo ou não) é excluída dessas três listas.
5. **Aba Fluxo: lançamento de fatura não abre mais o editor genérico.** Um lançamento com
   `origem === 'cartao'` (sempre um lançamento de fatura, nunca editável manualmente porque o
   próximo sync sobrescreve) abre, ao ser tocado, um novo resumo somente leitura (bottom sheet)
   em vez do `LancEditor`:
   - Cabeçalho: nome do cartão + mês da fatura + total.
   - Lista simples dos itens daquela fatura (descrição ou categoria do cartão, data, parcela
     se houver, valor) — sem os agrupamentos "À vista"/"Parceladas" que a aba Cartão já tem
     (aqui é só um resumo, não a tela cheia da fatura).
   - Botão **"Editar"**: fecha o resumo e navega para a aba Cartão (`setAba('cartao')`), onde
     o usuário já consegue tocar o item de verdade e editar via `FormCompra`.
   - Botão **"Fechar"**.
6. **Exibição do nome do cartão em Fluxo não precisa de lógica nova.** Como a categoria da
   fatura passa a se chamar igual ao cartão (decisões 1–2), o `nomeCat(l.categoriaId)` que
   `TelaFluxo` já usa hoje passa a mostrar o nome certo sem nenhuma mudança — o mesmo vale pra
   busca por texto (`bate`) e para as outras telas que leem nome de categoria
   (`TelaHoje`, `TelaAnalises`, `TelaSimulador`).

## Componentes afetados

### `src/domain/fatura.ts`

Nova função pura `categoriasFaturaIds(cartoes: Cartao[]): Set<ID>` — retorna o conjunto de
`categoriaFaturaId` de todos os cartões (independente de `ativo`). Usada pelos três lugares de
seleção manual (decisão 4) pra não duplicar a mesma lógica de exclusão.

### `src/db/repo.ts`

- `NovoCartao` perde o campo `categoriaFaturaId` (não é mais informado por quem chama).
- `salvarCartao(n, horizonte)`:
  - Criação (sem `id` em `n`): cria a categoria oculta (`nome: n.nome, tipo: 'gasto', boxId:
    n.boxId`) na mesma transação, e usa o `id` dela como `categoriaFaturaId` do cartão.
  - Atualização (`id` em `n`, ou seja `Cartao` completo): se `n.nome` for diferente do nome
    atual do cartão, renomeia a categoria (`categoriaFaturaId`) para o novo nome, na mesma
    transação.
- Tabela `db.categorias` entra no escopo da transação de `salvarCartao` (hoje só toca
  `db.cartoes` e `db.config`).

### `src/ui/ajustes/Cartoes.tsx`

- Remove o `<select>` "Categoria da fatura", o estado `categoriaFaturaId`, e a lógica de
  `categoriaPadrao`/`catSel`/`catsGasto` que hoje sugere a categoria chamada "cartão".
  `salvar()` para de incluir `categoriaFaturaId` em `campos` — o repo cuida disso sozinho.

### `src/ui/TelaLancar.tsx` e `src/ui/ajustes/Categorias.tsx`

- Filtram a lista de categorias exibida excluindo `categoriasFaturaIds(dados.cartoes)`.

### `src/ui/LancEditor.tsx`

- O `<select>` de categoria (linha 62-66) também exclui `categoriasFaturaIds(dados.cartoes)` —
  edição de um lançamento comum não deve permitir reatribuí-lo à categoria oculta de um cartão.

### Novo: `src/ui/FaturaResumo.tsx`

Componente novo — bottom sheet somente leitura, montado a partir de `TelaFluxo`.

- Props: `{ lanc: Lancamento; onFechar: () => void }`.
- Usa `useApp()` pra obter `dados`, `setAba`. Deriva `cartao = dados.cartoes.find(c => c.id ===
  lanc.cartaoId)`, `compras` desse cartão, e `calcularFaturas(cartao, compras,
  dados.config.horizonteProjecao).find(f => f.mes === lanc.faturaMes)` pra obter os itens e o
  total (mesmo padrão já usado em `TelaCartao`/`CartaoFatura`).
- Itens renderizados como `<div className="item">` (não clicáveis — diferente do
  `ItemFaturaBotao` de `TelaCartao`, que abre edição inline).
- Botão "Editar" chama `setAba('cartao')` e `onFechar()`.

### `src/ui/TelaFluxo.tsx`

- Novo estado `faturaSel: Lancamento | null` (mantém `editando` como está, só para
  lançamentos que não são de cartão).
- `onClick` do item de lançamento: `l.origem === 'cartao' ? setFaturaSel(l) : setEditando(l)`.
- Renderiza `{faturaSel && <FaturaResumo lanc={faturaSel} onFechar={() => setFaturaSel(null)} />}`
  ao lado do `{editando && <LancEditor .../>}` já existente.
- Nenhuma mudança em `nomeCat`/`tipoCat`/`bate` (decisão 6).

## Testes

- `repo.test.ts`: cobre criação de cartão sem `categoriaFaturaId` explícito (categoria
  auto-criada com nome do cartão), e edição de nome do cartão renomeando a categoria vinculada.
- `Cartoes.test.tsx`: remove asserts sobre o `<select>` de categoria da fatura; adiciona
  verificação de que o formulário não pede mais categoria.
- `TelaLancar.test.tsx`, `Categorias.test.tsx`, `LancEditor.test.tsx`: adicionam caso cobrindo
  que a categoria oculta (vinculada a um cartão) não aparece na lista/grade/select.
- Novo `FaturaResumo.test.tsx`: abre o resumo a partir de um lançamento `origem: 'cartao'`,
  confere itens/total exibidos, e que "Editar" navega pra aba Cartão.
- `TelaFluxo.test.tsx`: adiciona caso cobrindo que tocar um lançamento de fatura abre o resumo
  em vez do `LancEditor`.

## Critérios de sucesso

1. `npm run test` verde.
2. `npm run build` sem erros.
3. Fluxo conferido no celular via `npm run preview -- --host`: cadastrar cartão novo sem
   escolher categoria; nome do cartão aparecendo certo em Fluxo; tocar um lançamento de fatura
   abre o resumo (não o editor) e "Editar" leva pra aba Cartão; categoria oculta não aparece em
   Lançar/Ajustes → Categorias/editor de lançamento.

## Fora de escopo

- Migração de dados de cartões já cadastrados (decisão 3) — a categoria antiga só passa a ficar
  oculta e a sincronizar nome na próxima edição do cartão.
- Mudanças em `TelaHoje`, `TelaAnalises`, `TelaSimulador` além do efeito colateral gratuito de
  decisão 6 (já leem `categoria.nome`, não precisam de código novo).
- Agrupamento "À vista"/"Parceladas" dentro do `FaturaResumo` novo — fica como está em
  `TelaCartao`, o resumo do Fluxo é deliberadamente mais simples.
- Qualquer mudança de layout/estilo em `TelaLancar` (pílula alternável Gasto/Ganho, reposição
  do botão "Lançar") — descartado nesta rodada ("só altera o item 1").
