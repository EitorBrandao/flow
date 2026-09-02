# Ajuste excepcional do dia de fechamento de uma fatura

## Problema

`Cartao.diaFechamento` (`src/domain/types.ts`) é um único valor, usado por todas as faturas do
cartão, passadas e futuras (`src/domain/fatura.ts`). Editá-lo em Ajustes → Cartões já é
possível hoje, mas é permanente: muda o fechamento de todo o histórico e de toda a projeção.

Isso não cobre o caso comum de um banco antecipar ou atrasar o fechamento de **um mês
específico** (por exemplo, por causa de feriado ou fim de semana), sem mudar o dia padrão do
cartão dali para frente. Hoje não há como registrar essa exceção — o usuário só pode escolher
entre aceitar a fatura calculada errada naquele mês, ou mudar o padrão do cartão e depois
mudar de volta.

## Escopo

Só o dia de **fechamento**. O dia de **vencimento** daquele mês não muda (decisão do usuário
em 2026-09-02) — mesmo quando o banco desloca os dois juntos na prática, o Flow só ajusta o
fechamento; o vencimento continua no padrão do cartão.

## Solução

### Entidade `AjusteFechamento` (`src/domain/types.ts`)

```ts
export interface AjusteFechamento extends Entidade {
  cartaoId: ID;
  mes: string;           // 'AAAA-MM' — mês CALENDÁRIO em que o fechamento aconteceu
  diaFechamento: number; // 1-31, clampado ao fim do mês
}
```

`mes` é o mês calendário do fechamento em si, não o mês de vencimento da fatura resultante.
Essa é a chave que o domínio já usa para decidir em qual fatura uma compra cai
(`mesFechamentoDaCompra` compara a data da compra com o dia de fechamento **dentro do mês da
própria compra**). Indexar pelo mês de vencimento, como `ConferenciaFatura` faz, criaria uma
dependência circular: mudar o fechamento pode mudar em qual fatura (logo, em qual mês de
vencimento) a compra cai. Na UI isso é transparente — o usuário abre a fatura de um mês e
ajusta "fechou dia X"; o app deriva sozinho o mês calendário de fechamento daquela fatura
(`mesDe(fatura.dataFechamento)`) e grava a exceção com essa chave.

Único por `cartaoId+mes`, mesma disciplina de `ConferenciaFatura`: o índice do Dexie não é
`unique`, então duas exceções do mesmo cartão+mês podem coexistir vindas de um merge de
backup. `dedupAjustesFechamento` (mesmo formato de `dedupConferencias` em `fatura.ts`) resolve
o empate por `alteradoEm`, depois por `id`, aplicado em todo caminho que grava o snapshot
inteiro.

`Dados` ganha `ajustesFechamento: AjusteFechamento[]`.

### Dexie: versão nova

```
ajustesFechamento: 'id, [cartaoId+mes]'
```

As demais tabelas repetem a versão anterior sem mudança. Exige, no mesmo commit, teste do
caminho de upgrade (regra do `CLAUDE.md`): popular dados na versão anterior, abrir na versão
nova, conferir que nada se perdeu e que `ajustesFechamento` nasce vazia.

### Backup: schema novo

`TABELAS_AJUSTE_FECHAMENTO = ['ajustesFechamento']`. `validarBackup` passa a exigir o array no
schema novo; backup de schema anterior entra com `ajustesFechamento: []` — o padrão já usado
para cada tabela nova anterior (cartão, viagens, bancos). `gerarBackup` emite o schema novo.

Testes adversariais exigidos: `ajustesFechamento` ausente num backup do schema novo,
`ajustesFechamento` não-array, e o merge por `alteradoEm` da nova tabela (mesmo padrão de
`bancos`).

### Domínio puro (`src/domain/fatura.ts`)

`mesFechamentoDaCompra`, `datasFaturaDoMes`, `mesFaturaDaCompra` e `calcularFaturas` ganham um
parâmetro opcional `ajustes?: ReadonlyMap<string, number>` (mês calendário de fechamento → dia
override), usado no lugar de `cartao.diaFechamento` quando existe entrada para o mês em
questão. Sem o parâmetro, o comportamento é idêntico ao de hoje (compatibilidade total com
quem ainda não repassa o mapa, embora todo chamador interno do app passe a repassar).

`datasFaturaDoMes` calcula o mês calendário de fechamento a partir do mês de vencimento (a
mesma comparação `diaVencimento > diaFechamento` que já existe, usando os valores **padrão**
do cartão) e só então consulta `ajustes` com essa chave.

Chamadores que passam a montar e repassar o mapa (todos já chamam alguma dessas funções hoje):
`src/db/repo.ts`, `src/ui/TelaCartao.tsx`, `src/ui/FaturaResumo.tsx`,
`src/ui/FaturaCategoriaSheet.tsx`, `src/ui/TelaFluxo.tsx`, `src/domain/viagem.ts`,
`src/dossie/retrato.ts`. Uma função utilitária em `fatura.ts` —
`ajustesDoCartao(ajustes: AjusteFechamento[], cartaoId: ID): Map<string, number>` — filtra e
converte para o formato que as demais funções esperam, para não repetir esse filtro em cada
chamador.

**Caso de borda aceito e testado:** quando o override de fechamento ultrapassa o dia de
vencimento padrão do mês (ex.: fechamento normalmente cai antes do vencimento no mesmo ciclo,
mas o override empurra o fechamento para um dia posterior ao vencimento), a janela do ciclo
fica invertida naquele mês — o vencimento não se move para compensar, por decisão explícita de
escopo. O Flow não bloqueia essa combinação; ela só produz uma fatura com fechamento após o
vencimento, visível no cabeçalho da tela.

### Repositório (`src/db/repo.ts`)

`salvarAjusteFechamento(cartaoId, mes, diaFechamento, horizonte)` e
`removerAjusteFechamento(cartaoId, mes, horizonte)`, no padrão exato de
`salvarConferenciaFatura`/`removerConferenciaFatura`: transação (`ajustesFechamento` +
`config`) mais `marcarMudanca`, e ambos terminam chamando `sincronizarCartoes(horizonte)` —
mudar o fechamento pode reclassificar quais compras caem em qual fatura, e isso precisa se
refletir nos lançamentos `previsto` do cartão. `efetivo` nunca é tocado (invariante já existente
de `diffSincronizacao`).

### UI

Sem tela nova, sem aba nova. Dentro da aba "Conferência" da fatura (`CartaoFatura` em
`src/ui/TelaCartao.tsx`), um segundo bloco abaixo de `BlocoConferencia`: campo numérico "Fechou
dia ___ neste mês" com Salvar, e Remover quando já existe um ajuste — mesmo idioma visual do
bloco de conferência de valor. O cabeçalho da fatura ("fecha X · vence Y") passa a refletir o
ajuste quando existir, porque já lê de `fatura.dataFechamento`, que passa a considerar o mapa
de ajustes.

## Estilo

Nenhuma classe ou componente novo esperado — reaproveita o padrão visual de
`BlocoConferencia`. Se algo novo surgir durante a implementação, catalogar em
`docs/estilo/catalogo.md` no mesmo commit (regra do `CLAUDE.md`).

## Verificação

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Testes que esta entrega exige por regra, não por gosto:

- **Upgrade do Dexie**: popular na versão anterior, abrir na versão nova.
- **Backup adversarial**: `ajustesFechamento` ausente/não-array no schema novo; schema anterior
  entrando com `ajustesFechamento: []`; merge por `alteradoEm`.
- **Dedup**: duas exceções do mesmo cartão+mês (ids diferentes) resolvem para uma só, pelo
  `alteradoEm` mais recente e depois pelo `id`.
- **Reclassificação de compra**: compra perto do limite migra de fatura quando o ajuste move o
  dia de fechamento para antes ou depois da data da compra.
- **Fechamento após vencimento**: ajuste que inverte a ordem do ciclo não quebra o cálculo,
  produz o resultado literal (fechamento depois do vencimento).
- **Remover o ajuste** restaura o comportamento padrão do cartão para aquele mês.
- **`efetivo` não é tocado**: sincronização depois do ajuste nunca altera lançamento já pago.

No celular, depois do deploy: registrar um ajuste de fechamento num mês com compras perto da
virada, conferir que a fatura recalcula os itens corretamente, remover o ajuste e conferir que
volta ao padrão do cartão.

## Fora de escopo

- Ajustar o dia de vencimento junto (decisão do usuário: só o fechamento muda).
- Ajuste permanente do padrão do cartão — já existe hoje em Ajustes → Cartões.
- Qualquer alerta ou lembrete sobre fechamentos historicamente irregulares — YAGNI até haver
  demanda.
