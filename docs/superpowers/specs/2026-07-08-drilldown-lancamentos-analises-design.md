# Flow — Drill-down de lançamentos por categoria (aba Análises)

**Data:** 2026-07-08
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Contexto e objetivo

Na aba Análises, a tabela "Por categoria" (`src/ui/TelaAnalises.tsx`) mostra só o total
mensal de cada categoria. Isso é especialmente opaco para "pix", categoria comum (existe
como ganho e como gasto) que agrega transferências para destinos totalmente diferentes —
pode ser a maior linha de gasto do mês sem dizer nada sobre para quem foi.

O usuário quer, ao tocar numa linha da tabela, ver o detalhamento dos lançamentos daquela
categoria no mês — e quer essa hierarquia especificamente: **categoria → descrição/nota →
datas em que aquela descrição aparece**, não uma lista plana por data.

### Requisitos confirmados

- Vale para **qualquer categoria** da tabela "Por categoria", não só pix — mesmo componente,
  custo extra baixo (a query já é genérica por `categoriaId`).
- Lançamentos são **agrupados por descrição/nota**, não listados soltos por data.
- Agrupamento usa nota **normalizada** (trim + lowercase) — variações bobas de digitação ou
  import (`"Mercado"` vs `"mercado "`) caem no mesmo grupo. Sem normalização mais agressiva
  (remover prefixos de banco, etc.) — fica para uma iteração futura se precisar.
- Lançamentos sem nota (`undefined` ou string vazia após trim) caem num grupo `"sem nota"`.
- Cada grupo mostra **subtotal** (soma dos valores) e a lista de **datas com valor
  individual** de cada ocorrência.
- **Ordenação dos grupos**: por subtotal, maior primeiro (mesma lógica de "o que mais pesa no
  bolso aparece primeiro" da tabela "Por categoria").
- **Ordenação das datas dentro do grupo**: mais recente primeiro.
- Abre num **Sheet** (reuso do componente `src/ui/Sheet.tsx`, o mesmo do `AdicionarSheet`) —
  consistente com o padrão visual do app, sem componente de modal novo.
- Respeita o filtro de boxes selecionadas e o toggle "incluir previstos" já ativos na tela
  Análises (mesmo filtro de `resumoMensal`/`filtrar` em `aggregations.ts`).

## Domínio (`src/domain/aggregations.ts`)

Nova função:

```ts
export interface ItemLancamento {
  data: ISODate;
  valor: number;
}

export interface GrupoLancamentos {
  notaChave: string;      // normalizada (trim + lowercase) — chave de agrupamento e de key React
  notaExibicao: string;   // texto original da nota na primeira ocorrência do grupo; "sem nota" se vazia
  subtotal: number;
  itens: ItemLancamento[]; // ordenados por data desc
}

export function lancamentosDaCategoria(
  mes: string,
  categoriaId: ID,
  boxIds: readonly ID[],
  lancamentos: Lancamento[],
  incluirPrevistos: boolean,
): GrupoLancamentos[]
```

Implementação:
- Reaproveita o filtro privado `filtrar()` já existente em `aggregations.ts` (box selecionada,
  sem `cenarioId`, mês, status conforme `incluirPrevistos`), acrescentando o filtro por
  `categoriaId`.
- Chave de agrupamento: `(l.nota ?? '').trim().toLowerCase()`; chave vazia vira o grupo
  `"sem nota"` (`notaChave: ''`, `notaExibicao: 'sem nota'`).
- `notaExibicao` guarda a nota original (não normalizada) da primeira ocorrência inserida no
  grupo — mantém capitalização "humana" na UI mesmo com chave normalizada.
- Grupos ordenados por `subtotal` decrescente; dentro de cada grupo, `itens` ordenados por
  `data` decrescente.

## UI

### `src/ui/TelaAnalises.tsx` (alterações)

- Cada `<tr>` da tabela "Por categoria" vira clicável: `onClick` guarda a `categoriaId` num
  novo estado `const [categoriaAberta, setCategoriaAberta] = useState<ID | null>(null)`,
  `cursor: pointer` e `role="button"` na linha para acessibilidade.
- `{categoriaAberta && <LancamentosSheet categoriaId={categoriaAberta} nome={...} mes={mes}
  boxIds={ids} incluirPrevistos={incluirPrevistos} onFechar={() => setCategoriaAberta(null)} />}`.
- Trocar mês ou o toggle "incluir previstos" enquanto o sheet está aberto simplesmente
  refiltra (os grupos são recalculados a partir das mesmas props reativas) — sem necessidade
  de fechar o sheet manualmente.

### `src/ui/LancamentosSheet.tsx` (novo)

Usa `Sheet` (`src/ui/Sheet.tsx`) como wrapper. Conteúdo:

```
<nome da categoria> — <total do mês>
  <notaExibicao 1> — <subtotal>
    <dd/mm>              <valor>
    <dd/mm>              <valor>
  <notaExibicao 2> — <subtotal>
    <dd/mm>              <valor>
  ...
```

- Título do sheet: nome da categoria + total do mês (soma de todos os grupos — igual ao valor
  já exibido na linha da tabela).
- Cada grupo é uma sub-seção com `notaExibicao` (ou "sem nota") + subtotal formatado em
  `formatarBRL`, seguida da lista de datas (formato `dd/mm`) com o valor individual de cada
  lançamento.
- Sem interação adicional nos itens (não abre edição do lançamento nesta versão — só leitura).

## Testes

- **`aggregations.test.ts`** — `lancamentosDaCategoria`:
  - Agrupa lançamentos com a mesma nota (normalizada) num único grupo, somando o subtotal.
  - Nota com variação de espaço/capitalização (`"Mercado"` vs `" mercado"`) cai no mesmo
    grupo; `notaExibicao` preserva o texto da primeira ocorrência.
  - Lançamento sem nota (ou nota só com espaços) cai no grupo `"sem nota"`.
  - Grupos vêm ordenados por subtotal decrescente; itens de cada grupo por data decrescente.
  - Respeita o mesmo filtro de `resumoMensal` (box, mês, status, exclui lançamento de
    cenário).
- **`TelaAnalises.test.tsx`** ou novo `LancamentosSheet.test.tsx`:
  - Clicar numa linha da tabela abre o sheet com os grupos certos para aquela categoria.
  - Trocar o mês com o sheet aberto atualiza os grupos exibidos.

## Fora de escopo (desta versão)

- Normalização mais agressiva de nota (remover prefixos de banco, números de identificação de
  transação, etc.) — só trim + lowercase por ora.
- Editar ou excluir um lançamento a partir do sheet — é só visualização.
- Filtro/busca dentro do sheet quando há muitos grupos.
