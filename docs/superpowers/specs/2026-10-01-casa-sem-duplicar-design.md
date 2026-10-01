# A casa não duplica nem mente — design

Entrega B do item 34 do `TODO.md` (VB-19 e VB-20), ampliada em 2026-10-01 por decisão do
usuário. Mockup de Análises aprovado em 2026-10-01; o de Recorrências foi trocado pela decisão
abaixo.

## Problema

- **VB-19:** com "casa" no topo, Análises lista uma categoria por box. "mercado" de uma box e
  "Mercado" de outra aparecem como duas linhas.
- **VB-20:** com "casa" no topo, Ajustes → Recorrências lista só as recorrências da box
  `"casa"` e diz "Nenhuma recorrência nesta box". A tela mente: as outras boxes têm recorrências.

## Decisões

- **Análises junta por nome e tipo, sem diferenciar maiúsculas nem acentos.** Só leitura: nenhum dado muda.
- **Telas de configuração por box não aparecem na casa.** Categorias, Categorias do cartão,
  Cartões, Assinaturas e Recorrências mostram só um aviso, porque a configuração é de cada box.
  Decisão do usuário: "as configurações são exclusivas das boxes".
- **Bancos fica fora.** A tela já lista os bancos de todas as boxes na casa; o que ela deve fazer
  é a entrega C (VB-23).
- **Simular e Importar ficam fora.** Os dois ainda usam a box `"casa"` como destino com a casa no
  topo. Decisão para a entrega C.

## Mudanças

### 1. Análises junta categorias (VB-19)

Função pura nova em `src/domain/categorias.ts`:

```ts
export function unificarCategoriasPorNome(
  categorias: Categoria[], lancamentos: Lancamento[], ocultas: ReadonlySet<ID>,
): { categorias: Categoria[]; lancamentos: Lancamento[] }
```

- Chave: `tipo` + nome com `trim`, minúsculas (`toLocaleLowerCase('pt-BR')`) e sem acento
  (`normalize('NFD')` sem as marcas de combinação). "Cafe", "Café" e "CAFÉ" formam um grupo só.
- O representante do grupo é a primeira categoria na ordem de `compararCategorias`; o nome
  exibido é o dele. Os lançamentos das outras categorias do grupo passam a apontar para o
  representante. Os campos `boxId` dos lançamentos não mudam.
- Categorias em `ocultas` (fatura, transferência, reservadas do cartão) não entram na junção:
  `faturaExplicaOMes` e `cartaoDaCategoria` dependem do id original.
- Categoria arquivada junta com a ativa de mesmo nome e tipo. O representante é a ativa se
  houver; senão, a primeira arquivada.
- A função não altera as entradas.

`TelaAnalises.tsx` aplica a função **só** com `boxSel === 'casa'`, no mesmo ponto onde monta
`dados` (hoje `dadosDoBanco(dadosTodos, …)`), para todas as agregações, sheets e gráficos lerem
os dados já juntados. Numa box só, nada muda.

`LancamentosSheet` e `CategoriaPeriodoSheet`, abertos a partir de uma linha juntada, mostram os
lançamentos das boxes juntos. Na casa, cada lançamento (ou grupo de um lançamento) leva o
`SeloBox` ao lado da data. Para isso, `LancamentosSheet` ganha a propriedade opcional
`boxes?: Box[]`; com ela, mostra o selo. Sem ela, o layout de hoje.

### 2. Telas por box mostram um aviso na casa (VB-20)

Componente novo `src/ui/ajustes/AvisoEscolhaBox.tsx`:

```tsx
<AvisoEscolhaBox assunto="As categorias" />
// <p className="sub">As categorias são de cada box. Escolha uma box no topo para ver ou editar.</p>
```

Cada tela mantém o seu `<h2>` e troca o corpo pelo aviso quando `boxSel === 'casa'`:

| Tela | `assunto` |
|---|---|
| `Recorrencias.tsx` | "As recorrências" |
| `Categorias.tsx` | "As categorias" |
| `CategoriasCartao.tsx` | "As categorias do cartão" |
| `Cartoes.tsx` | "Os cartões" |
| `Assinaturas.tsx` | "As assinaturas" |

- `boxIdEfetivo` sai dessas cinco telas: `boxId` passa a ser `boxSel` (já é um id de box real
  quando não é `'casa'`).
- A mensagem "A box "casa" não foi encontrada — crie uma em Ajustes → Boxes." some dessas telas,
  porque elas não dependem mais da box `"casa"`.
- Os efeitos que reagem à troca de `boxId` continuam, com `boxSel`.
- **Consequência aceita:** o que já existe na box `"casa"` (categorias, recorrências, cartões)
  deixa de ter tela de edição, porque a box `"casa"` não é selecionável no topo. Continua
  entrando nos totais e na projeção.

## Pontos de chamada

- `boxIdEfetivo`: sai de `Recorrencias`, `Categorias`, `CategoriasCartao`, `Cartoes` e
  `Assinaturas`. Permanece em `Bancos`, `Importar`, `SimuladorFluxo`, `SimuladorSimples`,
  `CenarioCard` e `AdicionarSheet` (fora de escopo).
- Quem lê categorias de Análises: `resumoPeriodo`, `compararMeses`, `compararPeriodos`,
  `serieMensal`, `serieMensalResumo`, `lancamentosDaCategoria`, `faturaExplicaOMes`: todos
  recebem `dados` já juntados. Nenhum caminho de exclusão, importação, backup ou pagamento muda.

## Consistência entre telas

O mesmo conceito, "de que box é isto", aparece com o `SeloBox` também nas folhas de Análises. As
cinco telas de configuração por box dizem a mesma frase na casa. A frase do aviso muda só pelo
assunto.

## Documentação e catálogo

- `docs/estilo/catalogo.md`: catalogar `AvisoEscolhaBox`.
- `docs/wiki/7-ajustes.md`: dizer que, na visão casa, essas cinco telas pedem uma box; remover a
  frase "na visão casa, a box casa" dos padrões da compra do cartão (linha ~50) se ela deixar de
  valer. `docs/wiki/6-telas.md`: Análises junta categorias de mesmo nome na casa.
- `docs/dominio.md`: acrescentar que a UI de configuração não opera sobre a box `"casa"`.
- `changelog.d/`: dois fragmentos `alterado-*.md`.
- `TODO.md` (local): VB-19 e VB-20 saem do item 34 para `TODO-CONCLUIDOS.md`.

## Testes

- `unificarCategoriasPorNome`: junta "mercado" e "Mercado" do mesmo tipo; não junta tipos
  diferentes; junta "Cafe", "Café" e "CAFÉ"; categoria oculta não entra; lançamentos apontam para o
  representante; `boxId` do lançamento não muda; entradas não mudam; arquivada junta com ativa e
  a ativa vira representante; nome com espaços nas pontas junta.
- Análises: na casa, uma linha só com o total das boxes; numa box só, categorias intactas; a
  folha da linha juntada mostra lançamentos das duas boxes com o selo; a fatura de cartão segue
  abrindo a folha da fatura.
- `LancamentosSheet`: com `boxes`, o selo aparece; sem, não.
- Cada uma das cinco telas: na casa mostra o `<h2>` e o aviso, sem formulário nem lista; numa box
  concreta, comportamento de hoje (os testes existentes continuam passando).
- Varredura com Playwright (Galaxy S25+), com duas boxes e a casa, dados sintéticos.

## Fora desta entrega

VB-23 e VB-24 (entrega C), incluindo o que Bancos, Simular e Importar fazem na casa.
