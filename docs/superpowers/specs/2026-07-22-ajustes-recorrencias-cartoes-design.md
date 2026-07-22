# Ajustes: Recorrências, Cartões, Categorias do cartão e Assinaturas

Data: 2026-07-22

## Contexto

Lista de 6 ajustes reportados pelo usuário nas telas de Ajustes, investigados e expandidos
em conversa (mockup aprovado em
`https://claude.ai/code/artifact/5d6030eb-74d4-4f40-8f99-e8015d205bbf`):

1. Recorrências "vazam" entre boxes — a tela de Ajustes → Recorrências lista e deixa
   escolher categoria de **qualquer** box, sem filtro. `Recorrencia.boxId` e `Cartao.boxId`
   já são armazenados corretamente no domínio; o bug é só de UI (falta de escopo).
2. O formulário de "nova recorrência" fica depois da lista — subir pro topo.
3. Uma box só pode ter um cartão ativo por vez (bloqueio artificial na UI); o usuário quer
   permitir mais de um.
4. Assinatura de cartão obriga escolher uma `CategoriaCartao` manualmente; deveria usar
   sempre uma categoria fixa "Assinaturas", automática.
5. Em telas com `<select>` de categoria, o Android renderiza um picker nativo com botão
   "Done" — quer trocar por um seletor customizado (grid de botões), como o já existente em
   Lançar.
6. O placeholder "categoria…" que aparecia nesses selects some junto, pois o seletor novo não
   usa mais `<option>`.

Na conversa, o escopo cresceu com pedidos adicionais do usuário:

- Reordenar o menu de Ajustes pela hierarquia real das entidades.
- Regra geral (memorizada em `docs/estilo/nivel-5-nova-tela.md`): formulário de
  criar/adicionar sempre antes da lista, em qualquer tela.
- Todo seletor de categoria (não só Recorrências) troca `<select>` nativo por grid de
  botões.
- Assinaturas: como a categoria vira automática, o formulário passa a escolher o **cartão**
  em vez da categoria — necessário porque uma box pode ter mais de um cartão ativo agora.
- Categorias do cartão e Assinaturas continuam como telas próprias (não fundir em Cartões —
  testado no mockup e revertido por ficar "muito misturado"), mas cada uma troca seu
  `<select>` de cartão por um seletor de botões.
- Análises ganha uma linha agregada "Assinaturas" (todos os cartões) na tabela "Por
  categoria", que abre um resumo agrupado por cartão → assinatura — repõe a visão
  consolidada que a tela de Assinaturas, ao ficar escopada por cartão, deixaria de oferecer
  sozinha.

## Fora de escopo

- Não mexe em Compra avulsa (`FormCompra.tsx`) quanto à obrigatoriedade de categoria — só
  troca o `<select>` pelo grid de botões, mantendo a escolha manual.
- Não cria uma aba de navegação nova nem muda a estrutura do Shell.
- `TelaSimulador.tsx` (aba `simulador`, hoje oculta da navegação por decisão anterior)
  recebe a mesma troca de seletor por consistência de código, mas não é re-exposta na
  navegação — isso é decisão de produto separada.

## Componentes compartilhados novos

Duas classes de seletor se repetem em 3+ telas cada após esta mudança — extrair por regra
do nível 4 (`docs/estilo/nivel-4-novo-componente.md`).

### `SeletorCategoria.tsx`

Substitui o padrão `grade-categorias` hoje só inline em `TelaLancar.tsx`. Props mínimas:

```ts
interface SeletorCategoriaProps {
  categorias: { id: string; nome: string }[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}
```

Markup: `<div className="grade-categorias">` com um `<button className="botao {selecionada}">`
por categoria (classe `.grade-categorias`/`.selecionada` já cataloga, nenhuma CSS nova).
Usado em: `TelaLancar.tsx`, `Recorrencias.tsx`, `FormCompra.tsx`, `LancEditor.tsx`,
`TelaSimulador.tsx`.

### `SeletorPills.tsx`

Seletor de poucas opções em uma linha (Box, Cartão) — pattern novo, precisa de classe CSS
nova `.pills` catalogada junto (nível 2 + nível 4 no mesmo commit):

```ts
interface SeletorPillsProps {
  opcoes: { id: string; nome: string }[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
}
```

Usado em: `Recorrencias.tsx` (seletor de Box), `CategoriasCartao.tsx` e `Assinaturas.tsx`
(seletor de Cartão). Visualmente: pílulas num contêiner com fundo `--surface`, item ativo em
`--ac`/branco — mesmo tratamento do mockup aprovado (`.box-toggle` no protótipo; nome final
da classe real fica `.pills`/`.pills .ativo` seguindo a convenção de prefixo do nível 2).

## Mudanças por tela

### `src/ui/ajustes/Recorrencias.tsx`

- Novo estado `boxId` (default: primeira box com `saldoInicial != null`, mesmo padrão de
  `Cartoes.tsx`).
- `SeletorPills` de Box acima do formulário; ao trocar, reseta a categoria selecionada.
- Lista (`recs`) filtra por `r.boxId === boxId`.
- Formulário sobe para antes da lista.
- Novo estado `tipo: TipoCategoria` (default `'gasto'`) com o mesmo toggle Gasto/Ganho de
  `TelaLancar.tsx` (dois `.botao`, `role="radiogroup"`), acima do `SeletorCategoria` — troca
  de tipo reseta a categoria selecionada, igual `TelaLancar.tsx`.
- Campo Categoria vira `SeletorCategoria`, alimentado por
  `categorias.filter(c => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id))`.

### `src/ui/ajustes/Cartoes.tsx`

- Remove os dois blocos de bloqueio (`salvar` e `alternarAtivo`) que impedem 2º cartão ativo
  na mesma box — nenhuma outra mudança de lógica necessária (auditoria confirmou que
  `sincronizarCartoes`, `FaturaResumo`, `AdicionarSheet`, `TelaCartao` já operam por
  `cartaoId`, não por "o cartão da box").
- Formulário "Novo cartão" sobe para antes da lista (hoje já está definido depois).

### `src/ui/ajustes/CategoriasCartao.tsx`

- Troca o `<select>` de Cartão por `SeletorPills`.
- Formulário já está antes da lista — sem mudança de ordem.

### `src/ui/ajustes/Assinaturas.tsx`

- Remove o campo/`<select>` "Categoria do cartão".
- Novo `SeletorPills` de Cartão (lista `dados.cartoes.filter(c => c.ativo)`), substituindo o
  papel que a categoria tinha de indicar o cartão.
- Ao salvar, `categoriaCartaoId` deixa de vir do formulário: usa
  `repo.categoriaAssinaturasDe(cartaoId)` (nova função em `repo.ts`, ver abaixo).
- Lista filtra por `cartaoId === cartaoSel` (hoje mostra todas juntas).
- Formulário sobe para antes da lista.
- Um `<p className="sub">Categoria Assinaturas — automática, não precisa escolher.</p>`
  estático abaixo do formulário, sem classe nova.

### `src/db/repo.ts`

- Nova função `categoriaAssinaturasDe(cartaoId): Promise<ID>` (ou similar), espelhando o
  padrão já usado em `salvarCartao` para `categoriaFaturaId`: busca uma `CategoriaCartao`
  com `cartaoId` igual e nome `"Assinaturas"`; se não existir, cria (`ordem` = próxima,
  `arquivada: false`).
- Essa categoria "Assinaturas" deve ficar **oculta** nos pickers manuais — mesma ideia de
  `categoriasFaturaIds()` em `src/domain/fatura.ts`, mas para categorias de cartão. Adicionar
  helper equivalente (ex.: `categoriasAssinaturasIds(cartoes, categoriasCartao)`) usado em
  `CategoriasCartao.tsx` (lista) e `FormCompra.tsx` (picker de compra avulsa).

### `src/ui/TelaAjustes.tsx`

Reordenar `ITENS`:

```
Boxes → Categorias → Recorrências → Cartões → Categorias do cartão → Assinaturas
→ Backup e restauração → Wiki → Versão
```

(Boxes sobe para o topo porque é pré-requisito de Categorias; as demais mantêm a ordem
relativa que já tinham.)

### `src/ui/TelaAnalises.tsx`

- Nova linha sintética "Assinaturas" na tabela "Por categoria", com badge "todos os
  cartões". Valor = soma de `comprasCartao` com `recorrenciaCartaoId != null`, cujo
  `cartaoId` pertence a uma box selecionada (`boxIdsSelecionadas`), no mês corrente —
  reaproveitar a lógica de fatura mensal já existente em `fatura.ts`/`aggregations.ts` para
  determinar o mês de vencimento de cada compra.
- Clique abre um novo componente `AssinaturasResumoSheet.tsx` (usa `Sheet.tsx`, regra do
  nível 4), agrupando por nome do cartão (`.rotulo-grupo` + `.recuo-1`, mesmo padrão de
  agrupamento do `LancamentosSheet`) e listando as assinaturas com valor.
- Identificar "é uma compra de assinatura" via `recorrenciaCartaoId != null` (campo já
  existe em `CompraCartao`) — não depender do nome da categoria, mais robusto.

### `src/ui/FormCompra.tsx`, `src/ui/LancEditor.tsx`, `src/ui/TelaSimulador.tsx`,
### `src/ui/TelaLancar.tsx`

Trocam o picker de categoria (select ou grid inline) pelo componente `SeletorCategoria`
compartilhado. `TelaLancar.tsx` perde sua implementação inline de grid em favor do
componente (mesmo resultado visual, sem duplicar markup).

## Testes

Cada arquivo alterado mantém/atualiza seu `.test.tsx` no mesmo commit (convenção do
repositório). Componentes novos (`SeletorCategoria`, `SeletorPills`, `AssinaturasResumoSheet`)
ganham teste próprio. Cobrir especificamente:

- Recorrências: trocar de box reseta a lista e a categoria selecionada; categoria de outra
  box não aparece no grid.
- Cartões: dois cartões ativos na mesma box salvam sem erro.
- Assinaturas: salvar sem escolher categoria (só cartão) cria/reaproveita a
  `CategoriaCartao` "Assinaturas" corretamente; ela não aparece em `CategoriasCartao.tsx`
  nem no picker de `FormCompra.tsx`.
- Análises: linha "Assinaturas" soma corretamente através de múltiplos cartões/boxes e abre
  o sheet agrupado.
