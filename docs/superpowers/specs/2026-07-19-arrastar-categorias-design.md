# Spec: arrastar para reordenar categorias

**Data:** 2026-07-19
**Status:** aprovada em brainstorm (mockup validado), aguardando plano de implementação

## Problema

Em `src/ui/ajustes/Categorias.tsx` e `src/ui/ajustes/CategoriasCartao.tsx`, reordenar uma
categoria hoje exige clicar em botões ↑/↓ um de cada vez (`mover()` em cada arquivo, que
troca `ordem` par a par com a irmã adjacente). O usuário pediu para substituir isso por
arrastar diretamente o item na lista.

Aproveitando a mudança de UI dessas duas telas, três ajustes adicionais foram combinados
no brainstorm (mockup em anexo, aprovado):

1. O formulário "Nova categoria"/"Nova categoria do cartão" sobe para o topo da tela
   (hoje fica depois da lista).
2. Categorias arquivadas saem de dentro das listas ativas e passam a ter sua própria
   seção "Arquivados", **misturando tipos** (em `Categorias.tsx`, uma categoria `ganho`
   arquivada e uma `gasto` arquivada convivem na mesma seção).
3. Isso cria 3 seções em `Categorias.tsx` (Ganho, Gasto, Arquivados) e 2 em
   `CategoriasCartao.tsx` (ativas — sem rótulo, como hoje — e Arquivados).

## Decisões (do brainstorm)

### Biblioteca de arraste

`Reorder.Group`/`Reorder.Item` do **framer-motion** (já é dependência do projeto e já é
usado para gesto de arrastar em `Sheet.tsx`). Não entra nenhuma lib nova. Trade-off aceito
explicitamente: sem reordenar via teclado — os botões ↑/↓ somem por completo, não ficam
como alternativa.

### Handle de arrastar

- Ícone `GripVertical` (`lucide-react`), primeiro elemento da linha (antes do nome),
  reaproveitando a classe `.botao` já usada pelos botões de ícone existentes (sem criar
  `.botao-icone` nem qualquer classe nova) — só troca o ícone e o `aria-label` por
  `"Arrastar para reordenar"`.
- Arraste só inicia pela alça: `Reorder.Item` com `dragListener={false}` +
  `useDragControls()`; a alça chama `dragControls.start(e)` no `onPointerDown`. Tocar no
  resto da linha ou nos botões Editar/Arquivar/Restaurar continua funcionando normalmente.
- Categoria em edição inline (nome sendo editado) não mostra a alça — igual hoje, o modo de
  edição já troca todo o conjunto de botões por Salvar/Cancelar.
- Física do arraste: **padrão do framer-motion, sem customizar** transition/spring. Isso
  vira uma receita nova no `docs/estilo/transversais.md` (tabela de movimento):
  `Reordenar lista (arrastar) → Reorder.Group/Reorder.Item, axis="y", física padrão do
  framer-motion, não customizar tempos`. É um tipo de animação não coberto pela tabela
  atual, então por regra do próprio guia (nível 6) essa mudança precisa ir documentada
  junto — é o que esta spec registra.

### Estrutura das telas (3 seções / 2 seções)

- `Categorias.tsx`: três grupos de arraste **independentes** — `ganho` (ativas),
  `gasto` (ativas), `arquivados` (ativas=false, os dois tipos juntos). Arrastar não cruza
  grupos (mesma restrição que o ↑/↓ já tinha entre tipos).
- `CategoriasCartao.tsx`: dois grupos — ativas (sem rótulo, como a lista única de hoje) e
  `arquivados`.
- Cada item na seção "Arquivados" de `Categorias.tsx` mostra um `.badge` com o `tipo`
  (`ganho`/`gasto`), já que a seção mistura os dois e essa informação deixa de ser óbvia
  pela posição.
- Formulário de criar categoria muda de posição (para o topo) mas não de markup/classes —
  continua o mesmo `<div className="linha">` de hoje, só movido para antes das listas.

### Ordenação (`src/domain/categorias.ts`)

Hoje `compararCategorias` agrupa por `tipo` (ganho antes de gasto) e `compararCategoriasCartao`
não agrupa nada — ambos ignoram `arquivada`. Isso muda para: **arquivada sempre por último,
como um grupo à parte**.

```
compararCategorias:      grupo = arquivada ? 2 : (tipo === 'ganho' ? 0 : 1)
compararCategoriasCartao: grupo = arquivada ? 1 : 0
```

Dentro do mesmo grupo, critério de desempate continua `ordem` crescente → `nome`
(`localeCompare`), sem mudança.

**Efeito colateral aceito fora da tela de Categorias:** `aggregations.ts` usa
`compararCategorias` para ordenar o resumo mensal da aba Análises (spec
`2026-07-10-ordenacao-categorias-design.md`), e **não filtra arquivadas** — uma categoria
arquivada com lançamentos históricos ainda aparece lá. Com a mudança, ela passa a aparecer
**depois** de todas as categorias ativas (hoje aparece intercalada por `tipo`+`ordem`). Os
outros seis pontos que usam esses comparadores (dropdowns de Simulador, Recorrências,
FormCompra, Assinaturas, grade do Lançar, editor de lançamento) já filtram `arquivada` antes
de exibir, então não são afetados.

### `ordem` ao arquivar/restaurar

`ordem` continua sendo um único campo inteiro por categoria (sem campo novo, sem migração
Dexie). Como cada seção agora é seu próprio grupo de arraste com renumeração densa (ver
abaixo), o valor de `ordem` só precisa fazer sentido dentro do grupo atual do item — então:

- **Arquivar** (`alternarArquivada` ativa→arquivada): a categoria vai para o fim da seção
  Arquivados — `ordem = max(-1, ...arquivadas.map(c => c.ordem)) + 1` (mesmo padrão já usado
  em `criar()` hoje).
- **Restaurar** (arquivada→ativa): volta para o fim da sua própria seção de `tipo` (em
  `CategoriasCartao`, a única seção ativa) — mesma fórmula, com os irmãos = ativas do mesmo
  `tipo`.

### Persistência do arraste

`onReorder` do framer-motion devolve o array completo na nova ordem para aquele grupo. Em
vez de reaproveitar a troca par-a-par de `mover()`, recalcula `ordem` como o índice 0-based
de cada item nesse array e persiste (em paralelo) todos os que mudaram via
`repo.atualizarCategoria`/`repo.atualizarCategoriaCartao`, seguido de um único `recarregar()`.
Mais simples e robusto que o swap atual, e mantém `ordem` denso (0..n-1) dentro de cada
grupo.

Categorias arquivadas continuam arrastáveis (dentro da seção Arquivados) — nunca foram
excluídas do `mover()` original, então o comportamento não regride.

## Testes

- `src/domain/categorias.test.ts`: comparadores atualizados — arquivada sempre por último
  (grupo à parte), ganho antes de gasto entre as ativas, `ordem` dentro do grupo, desempate
  por nome.
- `src/ui/ajustes/Categorias.test.tsx` / `CategoriasCartao.test.tsx`: os testes que hoje
  clicam em ↑/↓ mudam para testar a lógica de persistência do reorder diretamente (chamando
  o handler equivalente ao `onReorder` com um array de ids reordenado) — simular um gesto de
  arrastar real em jsdom não é confiável, então a cobertura fica na lógica de recálculo de
  `ordem`, não no gesto em si. Cobrir também: arquivar move para o fim de Arquivados;
  restaurar move para o fim da seção de `tipo` correta.
- Suíte existente (`npm test`) roda inteira; ajustar qualquer teste que dependa da ordem
  antiga de categorias arquivadas.

## Fora de escopo

- Reordenar via teclado (aceito não ter, ver "Biblioteca de arraste").
- Schema do banco / migração Dexie (nenhum campo novo).
- Mudar o comportamento da aba Análises além do efeito colateral já descrito e aceito.
- Outras telas que listam categorias (Simulador, Recorrências, FormCompra, Assinaturas,
  Lançar, LancEditor) — não usam arraste nem seção de arquivados, continuam como estão.
