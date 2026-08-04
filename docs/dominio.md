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
  (`viagensSobrepoem`), inclusive nas bordas — mas isso é garantido só pelo formulário de
  Ajustes → Viagens (`ajustes/Viagens.tsx`); nem o repo (`salvarViagem`, `atualizarViagem`)
  nem o import de backup (`substituirTudo`) checam sobreposição. Ver nota na seção de
  invariantes.
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
     usado por telas que somam várias boxes (Fluxo, Cartão, Análises, Hoje) e pelo
     `AdicionarSheet`.
   - `boxIdEfetivo(dados, 'casa')` devolve o **id da única box chamada `"casa"`** — usado
     por telas que operam sobre exatamente uma box (Ajustes, Lançar, Simulador). Se essa
     box tiver sido renomeada ou removida, `boxIdEfetivo` devolve `null`.

## A matriz `status` × `origem`

Combinações que o código realmente produz, hoje:

| `origem` | `cenarioId`? | `status` ao nascer | quem cria | transição para `efetivo` |
|---|---|---|---|---|
| `manual` | não | `previsto` se marcou "Marcar como previsto" ou `data` é futura, senão `efetivo` | `TelaLancar.tsx` → `repo.salvarLancamento` | via `LancEditor` (`repo.atualizarLancamento`): só "Confirmar" (`aplicar(true)`) grava `efetivo` — "Salvar" (`aplicar(false)`) não mexe em `status` |
| `manual` | sim | sempre `previsto` | `TelaSimulador.tsx` (`FormHipotetico`, parcela única) → `repo.salvarLancamento` | ver ressalva abaixo |
| `recorrencia` | não | sempre `previsto` | `materializarRecorrencia` (`src/db/repo.ts`) | "Confirmar" em `LancEditor.tsx` (ajusta valor e status juntos); depois de `efetivo`, `materializar` (`src/domain/recurrence.ts`) nunca mais toca o registro |
| `recorrencia` | sim | sempre `previsto` | `TelaSimulador.tsx` (`FormHipotetico`, ≥2 parcelas) → `repo.salvarRecorrencia` com `cenarioId`, materializado do mesmo jeito | ver ressalva abaixo |
| `cartao` | não | sempre `previsto` | `sincronizarCartoes` (`src/db/repo.ts`) | fila de pendentes da `TelaHoje` (`pendentes`, `src/domain/projection.ts`) não filtra por `origem`, então uma fatura vencida cai na mesma fila manual/recorrência e é confirmada por `repo.confirmarPendente`; depois de `efetivo`, `diffSincronizacao` (`src/domain/fatura.ts`) nunca mais toca o registro |

O checkbox "Marcar como previsto" (`TelaLancar.tsx`) força `status: 'previsto'` mesmo com
`data` de hoje ou passada. É o único caminho, para lançamento manual, que alimenta a fila de
Pendentes da `TelaHoje`: `pendentes` (`src/domain/projection.ts`) só enxerga `previsto` com
`data <= hoje`, e sem o checkbox um lançamento manual com data passada nasceria `efetivo`
direto.

`cartao` + `cenarioId` não existe: `CompraCartao` não tem campo `cenarioId`
(`src/domain/types.ts`) e nada em `sincronizarCartoes` o define.

As duas linhas com `cenarioId` só são produzidas por `TelaSimulador.tsx`, que hoje não é
alcançável na navegação (`ABAS`, `Shell.tsx`); lançamentos de cenário existentes em uma base
real são dado legado ou vindos de um backup importado.

Existe um **quarto** escritor de lançamentos que a matriz acima não lista:
`substituirTudo` (`src/db/repo.ts`, import de backup em modo "substituir"). Como
`validarBackup` não valida o conteúdo dos registros (ver seção de Backup, abaixo), o import
pode gravar combinações `status`×`origem` que o app nunca produz sozinho — inclusive as que
este documento afirma não existir, como `cartao` + `cenarioId`.

**Expectativa não garantida — cenário virando `efetivo`.** O comentário em
`Lancamento.cenarioId` (`src/domain/types.ts`) diz "nunca `efetivo`", e a rota oficial de
"promover" um cenário é `converterCenarioEmReal` (`src/db/repo.ts`), que remove
`cenarioId` do lançamento (e da recorrência, se houver) antes de ele poder virar `efetivo`
pelo fluxo normal. Mas `LancEditor.tsx` não verifica `cenarioId` antes de oferecer o botão
"Confirmar": qualquer lançamento `previsto` aberto por ele — inclusive um de cenário —
pode receber `status: 'efetivo'` via `aplicar(true)`. Isso é alcançável só de forma
**latente** hoje, não na prática: exige dado de cenário pré-existente, já que
`TelaSimulador.tsx` (a única tela que cria lançamento de cenário) não é alcançável pela
navegação atual; `TelaFluxo.tsx` só desvia para outra tela quando `l.origem === 'cartao'`,
então um item de cenário que já exista na base abre `LancEditor` normalmente.
**Nenhum teste cobre esse caminho.** Tratar como regra desejada, não como algo que o código
impede.

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
valor/data do alvo calculado; e se o alvo some ou zera, o `previsto` é excluído. A mesma
borda descrita para recorrências (seção abaixo) vale aqui: apagar manualmente um lançamento
de fatura `previsto` cujo vencimento ainda não passou faz ele reaparecer na próxima
`sincronizarCartoes`, pela mesma lógica (`!vistos.has(faturaMes) && a.data > hoje` em
`diffSincronizacao`).

### Pagamento parcial e parcelamento da fatura

Uma fatura não precisa ser paga inteira, nem no dia do vencimento.
`registrarPagamentoFatura` (`src/db/repo.ts`) grava o lançamento da fatura como `efetivo`
**pelo valor realmente pago e na data em que o dinheiro saiu** e, se o usuário parcelou o
restante no banco, cria o parcelamento.

A fatura nasce projetada no vencimento, mas quem paga adiantado tira o dinheiro da conta
antes — então `dataPagamento` reescreve a `data` do lançamento. **`faturaMes` não muda**: a
identidade da fatura continua sendo o mês do vencimento, e é ela que amarra o lançamento ao
ciclo do cartão. Por consequência, a data do pagamento **não desloca as parcelas** de um
parcelamento: elas seguem o fechamento do cartão, não o dia em que a fatura anterior foi
quitada.

O parcelamento **não é entidade nova**: vira uma `CompraCartao` comum, com `parcelas: N` e
`valorTotal = N × valor da parcela`, numa `CategoriaCartao` reservada chamada "Parcelamento"
— criada sob demanda por `categoriaParcelamentoDe`, no mesmo padrão de
`categoriaAssinaturasDe`, e escondida da seleção manual por `categoriasCartaoReservadasIds`
(`src/domain/categorias.ts`). Daí em diante ele percorre a mesma cadeia acima e aparece nas
faturas seguintes como qualquer compra parcelada.

A data dessa compra é a **data de fechamento da fatura paga**. Isso não é arbitrário: pela
regra de `mesFechamentoDaCompra`, compra no dia exato do fechamento cai na fatura seguinte —
que é onde a parcela 1 deve estar. Vale nas duas configurações de ciclo, sem aritmética de
data nova.

O app **não calcula juros**. Quem digita o número de parcelas e o valor de cada uma é o
usuário, lendo o que o banco mostrou; se houver juros, eles já estão embutidos na parcela.
`resumoParcelamento` (`src/domain/fatura.ts`) só explicita a diferença entre o total
parcelado e o que ficou de fora do pagamento — inclusive quando ela é **negativa**, caso em
que a UI mostra "Faltam" em vez de corrigir o número por baixo do pano.

**Ressalva — o único caminho que reescreve um `efetivo`.** Este é o único lugar do app onde
um lançamento já `efetivo` é alterado, e acontece só por ação explícita do usuário (parcelar
uma fatura confirmada dias antes, pela aba Cartão). Nenhuma sincronização automática faz
isso: a garantia de `diffSincronizacao` ("`efetivo` nunca é tocado") continua valendo
integralmente.

Duas bordas que decorrem do modelo e são intencionais: parcelas cujo vencimento já passou
não viram lançamento (`diffSincronizacao` só cria com `a.data > hoje`), então registrar um
parcelamento meses depois não ressuscita faturas antigas; e excluir a `CompraCartao` do
parcelamento remove as parcelas futuras mas **não** devolve o valor original à fatura que já
foi paga — essa reversão é manual.

## A projeção (`projetarBoxes`, `src/domain/projection.ts`)

Calcula três saldos por dia, do início ao `horizonte` recebido: `saldoEfetivo` (só
lançamentos `efetivo`), `saldoProjetado` (`efetivo` + `previsto`, ambos sem cenário) e
`saldoComCenarios` (`saldoProjetado` + lançamentos de cenários **ligados**). Um lançamento
com `cenarioId` só entra em `saldoComCenarios`, e só se o cenário estiver no conjunto
`cenariosLigados` — nunca soma em `saldoEfetivo`/`saldoProjetado` independentemente do seu
`status`.

O saldo-base da série é a soma dos `saldoInicial` (centavos) de todas as boxes
selecionadas — uma box sem saldo próprio (`saldoInicial: null`, caso da `"casa"`) contribui
`0`. O início da série é a menor `dataSaldoInicial` entre as boxes selecionadas (ou a menor
data de lançamento, se nenhuma box tiver saldo inicial próprio). Um lançamento com
`data <= dataSaldoInicial` da **sua própria** box é ignorado: já está contido no saldo
inicial informado. Além disso, todo lançamento com `data` anterior a esse início global é
descartado, mesmo pertencendo a uma box sem `dataSaldoInicial` próprio (`projection.ts`) —
o corte pela data mínima vale para a série toda, não só por box.

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
gerar `CompraCartao` a partir de `RecorrenciaCartao`, mas **não** segue as mesmas regras à
risca: `CompraCartao` não tem campo de status próprio, então para montar o diff o status de
cada compra existente é derivado comparando `data` com `hoje`
(`c.data <= hoje ? 'efetivo' : 'previsto'`) em vez de lido de um registro — não há
"histórico" preservado por edição manual como há para `Lancamento.status`. E
`excluirAssinatura` só apaga as compras **futuras** vinculadas à regra (`c.data > hoje`);
compras passadas ficam como histórico mesmo depois de a assinatura ser excluída.

## Backup e merge (`src/backup/backup.ts`)

**O que `validarBackup` garante:** `app === 'flow'`; `schema` é `1`, `2` ou `3`; para cada
schema, as tabelas correspondentes existem e são arrays (`TABELAS_V1` sempre;
`TABELAS_CARTAO` a partir do schema 2; `TABELAS_VIAGEM` a partir do schema 3); backups de
schema antigo recebem as tabelas novas como array vazio; `dados.config` é um objeto de
verdade — `null`, array e primitivo são rejeitados com mensagem própria — e sai de
`validarBackup` sempre com `id: 'config'`, a chave primária do registro único. `mesclar`
sempre mantém a `config` local (`atual.config`), nunca a do backup.

**O que `validarBackup` não garante** (validação rasa, por desenho — CLAUDE.md já registra
isso; aqui é a leitura precisa do código):

- Não valida o **conteúdo** dos registros dentro dos arrays — nenhum campo de `Box`,
  `Lancamento` etc. é checado. Um item malformado dentro de um array passa.
- Não valida forma nem futuro de `alteradoEm` — a comparação de desempate em `mesclar` é
  string (`x.alteradoEm > existente.alteradoEm`), então um `alteradoEm` futuro ou um
  formato de data diferente altera o resultado do desempate sem erro.
- Não valida os **campos** de `config` além de ela ser um objeto: um `config: {}` passa. A
  forma é checada, o conteúdo não — e `carregarTudo` não conserta, porque só repõe a config
  quando ela **não existe** (`!config`); com `horizonteProjecao` ausente, a comparação
  `undefined < horizonteMinimo` é `false` e a virada de ano automática não dispara. Só
  acontece com backup editado à mão: todo backup gerado pelo app carrega a config inteira.
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
- **`dates.ts` é o único lugar que faz aritmética de calendário sobre `ISODate`** — somar
  dias/meses, clampar o dia ao fim do mês (`dataComDia`), enumerar intervalos
  (`diasEntre`). Ele **não** é o único lugar que faz parse nem formatação: `fatura.ts` e
  `recurrence.ts` quebram a string com `split('-')` para chamar `dataComDia`, e ~10
  componentes de UI reformatam `AAAA-MM-DD` → `DD/MM/AAAA` inline em vez de chamar
  `formatarDataBR` (`TelaHoje.tsx`, `TelaCartao.tsx`, `FaturaResumo.tsx`,
  `LancamentosSheet.tsx`, `ajustes/Versao.tsx`, entre outros), além dos quatro que chamam
  `toLocaleDateString('pt-BR', ...)` para nomes de mês/dia da semana (`TelaFluxo.tsx`,
  `TelaAnalises.tsx`, `FluxoChartModal.tsx`, `EvolucaoMensalChart.tsx`).
- **Cenário nunca é `efetivo`** — expectativa documentada em `types.ts`, não garantida pelo
  código: ver ressalva na matriz `status` × `origem` acima (`LancEditor.tsx` permite).
- **`efetivo` é imutável por materialização/sincronização automática** — garantido: nem
  `materializar` (`src/domain/recurrence.ts`) nem `diffSincronizacao`
  (`src/domain/fatura.ts`) tocam um lançamento com `status: 'efetivo'`. A única forma de um
  `efetivo` mudar é edição manual explícita (`LancEditor` → `repo.atualizarLancamento`) ou
  exclusão manual (`repo.excluirLancamento`).
- **No máximo uma `ConferenciaFatura` por `cartaoId`+`mes`** — mantida por código nos dois
  caminhos de escrita, não pelo schema: o índice composto `[cartaoId+mes]` em
  `src/db/database.ts` **não** é declarado único (sem prefixo `&` no schema Dexie). A
  escrita manual passa por `salvarConferenciaFatura` (`src/db/repo.ts`, busca-então-grava),
  e o import de backup passa por `dedupConferencias` (`src/domain/fatura.ts`) nos **dois**
  modos: dentro de `mesclar` no modo "mesclar", e dentro de `substituirTudo` no modo
  "substituir", que não passa por `mesclar`. A regra é a mesma nos dois: vence o
  `alteradoEm` mais recente, empate desempata pelo `id` maior — resultado independente da
  ordem de entrada.
- **Viagens não se sobrepõem** — expectativa, não garantida pelo schema nem pelo repo: só
  `ajustes/Viagens.tsx` chama `viagensSobrepoem` antes de salvar. `repo.salvarViagem`,
  `repo.atualizarViagem` e `substituirTudo` (import de backup) não checam nada; havendo
  sobreposição, `viagemAtivaEm` devolve a primeira viagem do array cujo intervalo contém a
  data, e `TelaLancar.tsx` usa esse valor para marcar `viagemId` automaticamente no
  lançamento.
