# Modelo de domínio e invariantes

Referência do modelo conceitual das camadas onde um erro custa dado financeiro real do
usuário: `src/domain/`, `src/db/` e `src/backup/`. O Flow não tem servidor nem backup
automático — o que está errado aqui pode apagar ou corromper dinheiro que o usuário não
consegue recuperar.

**Cada afirmação abaixo aponta o arquivo e a função que a sustentam hoje.** Mudar o código
que uma afirmação descreve exige atualizar esta página no mesmo commit. Onde o código não
garante algo que pareceria natural, isto é dito explicitamente como **expectativa não
garantida** — não inventar invariante que o código não impõe.

## Entidades

Só o significado de produto; os campos estão em `src/domain/types.ts`.

- **Box** — uma conta/carteira com saldo próprio. `saldoInicial: null` marca uma box "sem
  saldo próprio": é o caso da box especial de nome `"casa"`, autocriada por
  `iniciar()` (`src/state/store.ts`) se não existir nenhuma box chamada `"casa"`. Ver
  seção própria abaixo — `'casa'` é ao mesmo tempo o nome dessa box e um sentinela de
  seleção com dois significados diferentes.
- **Categoria** — rótulo de ganho/gasto dentro de uma box, com `ordem` (posição definida
  pelo usuário em Ajustes) e `arquivada` (fica fora das listas de seleção, mas seu
  histórico continua contando nos agregados). A ordem de exibição não é `ordem` cru: é
  `compararCategorias` (`src/domain/categorias.ts`) — ganhos antes de gastos, arquivadas
  sempre por último, `ordem` desempatada por `nome`.
- **Lançamento** — um evento de caixa (ganho ou gasto) numa data, em centavos. Ver a matriz
  `status` × `origem` abaixo — é a parte mais densa do modelo.
- **Recorrência** — a *regra* que gera lançamentos `previsto` de origem `'recorrencia'` mês
  a mês (`materializar`, `src/domain/recurrence.ts`). Não é ela mesma um lançamento.
- **Cartão** — dono de um ciclo de fechamento/vencimento (`diaFechamento`,
  `diaVencimento`) e de uma **categoria de gasto oculta** (`categoriaFaturaId`) que recebe
  a fatura consolidada como lançamento `origem: 'cartao'`. Essa categoria nasce junto com o
  cartão (`salvarCartao`, `src/db/repo.ts`) e é escondida de qualquer seletor manual por
  `categoriasFaturaIds` (`src/domain/fatura.ts`).
- **CategoriaCartao** — rótulo de gasto *dentro* do cartão (ex.: "mercado", "streaming"),
  independente das `Categoria` da box. `categoriaAssinaturasId` no `Cartao` aponta para uma
  `CategoriaCartao` reservada, criada sob demanda (`categoriaAssinaturasDe`,
  `src/db/repo.ts`) e igualmente escondida de seleção manual
  (`categoriasAssinaturasIds`, `src/domain/categorias.ts`).
- **CompraCartao** — uma compra no cartão, com `parcelas` (1 = à vista). É a unidade que
  `fatura.ts` fatia em `ItemFatura` por mês de vencimento.
- **RecorrenciaCartao** ("assinatura") — regra que gera `CompraCartao` mês a mês, o
  equivalente de `Recorrencia` no mundo do cartão (`materializarAssinatura`,
  `src/db/repo.ts`, reaproveita `materializar` de `recurrence.ts`).
- **ConferenciaFatura** — valor que o usuário digitou a partir do extrato do banco para um
  `cartaoId`+`mes`, com a opção de a projeção usar esse valor no lugar da soma das compras
  (`valorSincronizado`, `src/domain/fatura.ts`). Ver nota sobre unicidade na seção de
  invariantes.
- **Cenário** — um grupo de lançamentos hipotéticos, ligável/desligável
  (`ligado`), que só entram no `saldoComCenarios` da projeção quando ligado. Nunca deveria
  virar `efetivo` — ver a ressalva na matriz abaixo.
- **Viagem** — período `[dataInicio, dataFim]` que agrupa gastos (lançamentos de débito e
  compras de cartão) marcados com `viagemId`, para relatório consolidado
  (`itensDaViagem`, `totalViagemNoMes`, `src/domain/viagem.ts`). Viagens não se sobrepõem
  (`viagensSobrepoem`), inclusive nas bordas.
- **Config** — singleton (`id: 'config'`) com o horizonte da projeção
  (`horizonteProjecao`), a box padrão do seletor (`boxPadraoId`) e o estado do lembrete de
  backup (`mudancasDesdeBackup`, `ultimoBackupEm`).

### A box `'casa'`: dois significados do mesmo nome

`'casa'` aparece em dois papéis distintos, e confundi-los é a fonte de bug mais provável
nessa área:

1. **Uma `Box` real**, de nome literal `"casa"`, `saldoInicial: null`, autocriada em
   `iniciar()` (`src/state/store.ts`) se não existir nenhuma box com esse nome. É a box
   para lançamentos que não pertencem a nenhuma conta específica.
2. **O sentinela `BoxSelecionada = ID | 'casa'`** (`src/state/store.ts`), usado no estado
   de seleção da UI. Esse sentinela tem **comportamento diferente conforme quem o lê**:
   - `boxIdsSelecionadas(dados, 'casa')` devolve **todas as boxes** (visão consolidada) —
     usado por telas que somam várias boxes (Fluxo, Cartão, Análises, Hoje).
   - `boxIdEfetivo(dados, 'casa')` devolve o **id da única box chamada `"casa"`** — usado
     por telas que operam sobre exatamente uma box (Ajustes, Lançar, Simulador). Se essa
     box tiver sido renomeada ou removida, `boxIdEfetivo` devolve `null`.

## A matriz `status` × `origem`

Combinações que o código realmente produz, hoje:

| `origem` | `cenarioId`? | `status` ao nascer | quem cria | transição para `efetivo` |
|---|---|---|---|---|
| `manual` | não | `previsto` se `data` é futura, senão `efetivo` | `TelaLancar.tsx` → `repo.salvarLancamento` | livre via `LancEditor` ("Salvar"/"Confirmar", `repo.atualizarLancamento`) |
| `manual` | sim | sempre `previsto` | `TelaSimulador.tsx` (`FormHipotetico`, parcela única) → `repo.salvarLancamento` | ver ressalva abaixo |
| `recorrencia` | não | sempre `previsto` | `materializarRecorrencia` (`src/db/repo.ts`) | "Confirmar" em `LancEditor.tsx` (ajusta valor e status juntos); depois de `efetivo`, `materializar` (`src/domain/recurrence.ts`) nunca mais toca o registro |
| `recorrencia` | sim | sempre `previsto` | `TelaSimulador.tsx` (`FormHipotetico`, ≥2 parcelas) → `repo.salvarRecorrencia` com `cenarioId`, materializado do mesmo jeito | ver ressalva abaixo |
| `cartao` | não | sempre `previsto` | `sincronizarCartoes` (`src/db/repo.ts`) | fila de pendentes da `TelaHoje` (`pendentes`, `src/domain/projection.ts`) não filtra por `origem`, então uma fatura vencida cai na mesma fila manual/recorrência e é confirmada por `repo.confirmarPendente`; depois de `efetivo`, `diffSincronizacao` (`src/domain/fatura.ts`) nunca mais toca o registro |

`cartao` + `cenarioId` não existe: `CompraCartao` não tem campo `cenarioId`
(`src/domain/types.ts`) e nada em `sincronizarCartoes` o define.

**Expectativa não garantida — cenário virando `efetivo`.** O comentário em
`Lancamento.cenarioId` (`src/domain/types.ts`) diz "nunca `efetivo`", e a rota oficial de
"promover" um cenário é `converterCenarioEmReal` (`src/db/repo.ts`), que remove
`cenarioId` do lançamento (e da recorrência, se houver) antes de ele poder virar `efetivo`
pelo fluxo normal. Mas `LancEditor.tsx` não verifica `cenarioId` antes de oferecer o botão
"Confirmar": qualquer lançamento `previsto` aberto por ele — inclusive um de cenário —
pode receber `status: 'efetivo'` via `aplicar(true)`. Isso é alcançável na prática porque
`TelaFluxo.tsx` só desvia para outra tela quando `l.origem === 'cartao'`; um item de
cenário abre `LancEditor` normalmente. **Nenhum teste cobre esse caminho.** Tratar como
regra desejada, não como algo que o código impede — ver relatório para o item de backlog.

`origem: 'import'` não existe mais: `OrigemLancamento` (`src/domain/types.ts`) só tem
`'manual' | 'recorrencia' | 'cartao'` desde que o importador de planilha saiu do app.

## O ciclo da fatura (`src/domain/fatura.ts`)

Uma compra cai na fatura pelo primeiro fechamento **estritamente posterior** à data da
compra — comprar no dia exato do fechamento empurra para a fatura seguinte
(`mesFechamentoDaCompra`). O mês do vencimento decorre do mês de fechamento: se o dia de
vencimento é maior que o dia de fechamento, vencimento e fechamento caem no mesmo mês
calendário; senão, o vencimento é no mês seguinte (`mesVencimentoDoFechamento`). Dia 31 em
mês curto é clampado ao último dia do mês por `dataComDia` (`src/domain/dates.ts`) —
testado explicitamente em `fatura.test.ts` ("clampa o fechamento ao fim do mês (dia 31 em
fevereiro)").

Parcelamento: `valorParcela` divide em centavos inteiros por `Math.floor`, e o resto da
divisão vai inteiro para a parcela 1 — nenhuma parcela nunca é maior que a primeira.

A cadeia até virar saldo:

```
RecorrenciaCartao (assinatura)
  → materializarAssinatura → CompraCartao (origem: assinatura, via recorrenciaCartaoId)
CompraCartao (manual ou de assinatura)
  → calcularFaturas → Fatura (agrupada por mês de VENCIMENTO)
Fatura + ConferenciaFatura (opcional)
  → diffSincronizacao → Lancamento { origem: 'cartao', categoriaId: cartao.categoriaFaturaId, faturaMes }
```

Tudo isso roda em `sincronizarCartoes` (`src/db/repo.ts`), chamada depois de qualquer
mutação de cartão/compra/assinatura/conferência e uma vez no `iniciar()` do app. A mesma
disciplina de `materializar` (recorrências) vale aqui, por comentário explícito em
`diffSincronizacao`: `efetivo` nunca é tocado; um lançamento de fatura novo só é criado se
o vencimento for **estritamente posterior** a hoje (não dá para distinguir "nunca criado"
de "descartado no passado"); um `previsto` existente é atualizado para seguir
valor/data do alvo calculado; e se o alvo some ou zera, o `previsto` é excluído.

## A projeção (`projetarBoxes`, `src/domain/projection.ts`)

Calcula três saldos por dia, do início ao `horizonte` recebido: `saldoEfetivo` (só
lançamentos `efetivo`), `saldoProjetado` (`efetivo` + `previsto`, ambos sem cenário) e
`saldoComCenarios` (`saldoProjetado` + lançamentos de cenários **ligados**). Um lançamento
com `cenarioId` só entra em `saldoComCenarios`, e só se o cenário estiver no conjunto
`cenariosLigados` — nunca soma em `saldoEfetivo`/`saldoProjetado` independentemente do seu
`status`.

O início da série é a menor `dataSaldoInicial` entre as boxes selecionadas (ou a menor data
de lançamento, se nenhuma box tiver saldo inicial próprio — caso da box `"casa"`). Um
lançamento com `data <= dataSaldoInicial` da sua box é ignorado: já está contido no saldo
inicial informado.

`config.horizonteProjecao` é o teto até onde a projeção (e a materialização de
recorrências/fatura) é calculada. `carregarTudo` (`src/db/repo.ts`) empurra esse valor para
`31/12` do ano seguinte automaticamente sempre que ele estiver defasado — "virada de ano
automática: o horizonte acompanha o calendário para sempre" (comentário no código). Não há
tela de Ajustes para editar `horizonteProjecao` diretamente; ele só muda por essa virada
automática ou por escrita direta de `salvarConfig`.

## Materialização de recorrências (`src/domain/recurrence.ts`, `materializarTodas`)

`materializar` compara as ocorrências esperadas da regra até o horizonte com os
lançamentos já vinculados a ela e devolve um diff: datas que faltam criar, ids de
`previsto` para excluir. Regras confirmadas pelo código:

- **`efetivo` nunca é excluído** (`materializar` só considera `previsto` para
  `excluirIds`) — é história.
- **Datas esperadas passadas (`<= hoje`) que ainda não existem não são recriadas.** Isso é
  um trade-off aceito e documentado no próprio código: uma recorrência com `dataInicio` no
  passado não materializa as ocorrências já vencidas antes de existir no banco.
- **Consequência não óbvia:** esse mesmo filtro (`d > hoje`) faz com que apagar
  manualmente (`excluirLancamento`) um `previsto` **futuro** de uma recorrência seja
  reversível sem querer — ele reaparece na próxima materialização (que roda a cada
  `iniciar()` do app, e a cada `salvarRecorrencia`), porque nada marca "foi descartado", só
  a ausência da data nos existentes é olhada. Só o descarte de uma data **passada** é
  permanente.
- **Todo `previsto` remanescente de uma recorrência é sobrescrito com o valor/categoria
  atuais da regra em toda materialização** (`.modify` em `materializarRecorrencia`,
  `src/db/repo.ts`) — por isso `LancEditor.tsx` não oferece "Salvar" para um `previsto` de
  recorrência (só "Confirmar", que aplica o valor editado *e* marca `efetivo` no mesmo
  passo): editar e deixar `previsto` seria apagado pela próxima sincronização.
- Recorrência inativa (`ativa: false`) não gera nada e exclui todos os `previsto`
  existentes vinculados a ela.

`materializarAssinatura` (`src/db/repo.ts`) reaproveita a mesma função `materializar` para
gerar `CompraCartao` a partir de `RecorrenciaCartao` — mesmas regras acima, trocando
"lançamento" por "compra".

## Backup e merge (`src/backup/backup.ts`)

**O que `validarBackup` garante:** `app === 'flow'`; `schema` é `1`, `2` ou `3`; para cada
schema, as tabelas correspondentes existem e são arrays (`TABELAS_V1` sempre;
`TABELAS_CARTAO` a partir do schema 2; `TABELAS_VIAGEM` a partir do schema 3); backups de
schema antigo recebem as tabelas novas como array vazio. `mesclar` sempre mantém a `config`
local (`atual.config`), nunca a do backup.

**O que `validarBackup` não garante** (validação rasa, por desenho — CLAUDE.md já registra
isso; aqui é a leitura precisa do código):

- Não valida o **conteúdo** dos registros dentro dos arrays — nenhum campo de `Box`,
  `Lancamento` etc. é checado. Um item malformado dentro de um array passa.
- Não valida forma nem futuro de `alteradoEm` — a comparação de desempate em `mesclar` é
  string (`x.alteradoEm > existente.alteradoEm`), então um `alteradoEm` futuro ou um
  formato de data diferente altera o resultado do desempate sem erro.
- `typeof d.config !== 'object'` não rejeita `config: null`, porque `typeof null` é
  `'object'` em JavaScript. Um backup com `dados.config: null` passa em `validarBackup`.
  Isso importa de verdade no modo "substituir" da UI (`Backup.tsx`): `finais = backup.dados`
  vai direto para `repo.substituirTudo`, que faz `db.config.put({ ...d.config,
  mudancasDesdeBackup: false })` — com `config: null`, o spread produz um objeto **sem
  `id: 'config'`**, o que é inconsistente com a chave primária da tabela `config` em
  `src/db/database.ts`. Não testado. Ver relatório.
- Não impõe unicidade de `id` dentro de um mesmo array, nem consistência referencial
  (`boxId`, `categoriaId`, `cartaoId` etc. apontando para algo que existe).

`mesclar`: por tabela, uma `Map` por `id`; um registro do backup substitui o local só se
`alteradoEm` for estritamente maior (`>`) — em empate, vence o que já estava
(`existente`, ou seja o `atual` da chamada). `config` nunca vem do backup em modo mesclar
(vem sempre de `atual`); só o modo "substituir" da UI grava a `config` do backup, direto,
sem passar por `mesclar`.

## Invariantes

Confirmadas no código:

- **Valores monetários são centavos inteiros.** Não há checagem de tipo nem de runtime que
  rejeite fração — é convenção mantida por construção: toda entrada de valor na UI passa
  por `empurrarDigito`/`digitosParaCentavos` (`src/domain/money.ts`), que só produzem
  inteiros, e toda aritmética de domínio (`valorParcela`, `projetarBoxes` etc.) usa só
  `+`/`-`/`Math.floor` sobre esses inteiros. Um valor fracionário entrando por outra via
  (import de backup malformado, por exemplo) não é rejeitado em lugar nenhum.
- **Datas são `"AAAA-MM-DD"`.** Também é convenção, não um tipo validado em runtime
  (`ISODate` é só um alias de `string`, `src/domain/types.ts`). Mantida por construção:
  `dates.ts` é o único lugar que gera essas strings a partir de aritmética de data, e
  `<input type="date">` (`CampoData.tsx`) já emite nesse formato nativamente.
- **`money.ts` é o único lugar que formata centavos como reais** (`formatarBRL`) — não há
  outro `toLocaleString('pt-BR', { style: 'currency', ... })` nem literal `'R$'` fora dele
  no código de produção (buscado em `src/ui/**`).
- **`dates.ts` não é o único lugar que formata datas para exibição.** Só `formatarDataBR`
  (formato `DD/MM/AAAA`) vive lá. Vários componentes chamam `toLocaleDateString('pt-BR',
  ...)` diretamente para nomes de mês/dia da semana: `src/ui/TelaFluxo.tsx`,
  `src/ui/TelaAnalises.tsx`, `src/ui/FluxoChartModal.tsx`,
  `src/ui/EvolucaoMensalChart.tsx`. Nenhum deles faz aritmética de data — só formatação de
  rótulo — mas a afirmação "único lugar de formatação de data" do brief desta tarefa **não
  se sustenta** como estava; o que se sustenta é que `dates.ts` é o único lugar que faz
  aritmética/parse de `ISODate`.
- **Cenário nunca é `efetivo`** — expectativa documentada em `types.ts`, não garantida pelo
  código: ver ressalva na matriz `status` × `origem` acima (`LancEditor.tsx` permite).
- **`efetivo` é imutável por materialização/sincronização automática** — garantido: nem
  `materializar` (`src/domain/recurrence.ts`) nem `diffSincronizacao`
  (`src/domain/fatura.ts`) tocam um lançamento com `status: 'efetivo'`. A única forma de um
  `efetivo` mudar é edição manual explícita (`LancEditor` → `repo.atualizarLancamento`) ou
  exclusão manual (`repo.excluirLancamento`).
- **No máximo uma `ConferenciaFatura` por `cartaoId`+`mes`** — expectativa, não garantida
  pelo schema: o índice composto `[cartaoId+mes]` em `src/db/database.ts` **não** é
  declarado único (sem prefixo `&` no schema Dexie); a unicidade só é mantida pelo único
  caminho de escrita manual, `salvarConferenciaFatura` (`src/db/repo.ts`, busca-então-
  grava). Um backup com dois registros de `cartaoId`+`mes` iguais e ids diferentes passa
  por `validarBackup` e `mesclar` sem ser deduplicado — `valorSincronizado` usaria
  arbitrariamente o último da lista (`Map` construída por `mes`, em `diffSincronizacao`).
