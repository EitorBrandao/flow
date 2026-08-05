# Bancos dentro da box — entrega 1: o banco existe e tem saldo

## Problema

`Box` guarda **um** saldo declarado (`saldoDeclaradoCent` + `dataSaldoDeclarado`,
`src/domain/types.ts`), e a visão `casa` guarda o dela em `Config`. Uma box = uma conta.

Mas as boxes do usuário são **pessoas**, não bancos: "eitor" (246 lançamentos, cartões
Bradesco e Santander), "ju" (71 lançamentos, cartões Nubank, Mercado Pago e Santander) e
"casa" (compartilhada, sem saldo próprio). Dentro de uma mesma pessoa há várias contas
bancárias, e hoje não há onde registrá-las: a conferência da tela Hoje ("Saldo real no
banco", `ConferenciaSaldo` em `TelaHoje.tsx`) aceita um número só, então conferir contra o
app de cada banco exige somar de cabeça antes de digitar.

Criar uma box por banco não resolve — colidiria com a dimensão pessoa, que é o que as boxes
já significam.

## Escopo desta entrega

O item completo (levantado como nº 12 do backlog) inclui lançamento apontando para banco,
banco padrão, saldo inicial por banco e projeção por banco. **Isto tudo fica para a entrega
2.** Decisão do usuário em 2026-08-05, pelo motivo registrado abaixo.

Esta entrega é **puramente aditiva e reversível**: cria a tabela vazia, não migra nenhum
dado existente e não toca em lançamento. Se o modelo não servir na prática, sai sem
consequência. A entrega 2 carimba banco em dado que já existe e é bem mais difícil de
desfazer — daí a ordem.

**Consequência aceita:** nesta entrega o saldo de cada banco é **informado pelo usuário, não
calculado**. Ele não se atualiza ao lançar. O ganho é ver a divisão e conferir cada banco
contra o app dele; o total é que continua sendo verificado automaticamente contra a projeção.

## Solução

### Entidade `Banco` (`src/domain/types.ts`)

```ts
export interface Banco extends Entidade {
  boxId: ID;
  nome: string;
  ordem: number;
  saldoDeclaradoCent: number | null;
  dataSaldoDeclarado: ISODate | null;
}
```

O par `saldoDeclarado*` é deliberadamente o mesmo que `Box` já tem — é a mesma coisa
(conferência contra o extrato), num nível abaixo. **Sem `saldoInicial`:** ele só faz sentido
quando lançamento apontar para banco, na entrega 2. **Sem `arquivado`:** banco que não se usa
mais se exclui; não há histórico preso a ele nesta entrega (YAGNI).

`Dados` ganha `bancos: Banco[]`.

### `Cartao` ganha `bancoId?: ID`

Opcional, sem índice. Nesta entrega é **organização**: a tela de Bancos mostra "cartões deste
banco", e o campo é escolhido no formulário do cartão (`src/ui/ajustes/Cartoes.tsx`), onde o
cartão já é editado — cada tela edita a sua própria entidade. Na entrega 2 é ele que diz de
qual saldo a fatura sai.

### Dexie: versão 4

```
bancos: 'id, boxId'
```

As demais tabelas repetem a v3 sem mudança. **Exige, no mesmo commit, teste do caminho de
upgrade** (regra do `CLAUDE.md`): popular dados no schema 3, abrir no schema 4, conferir que
nada se perdeu e que `bancos` nasce vazia.

### Backup: schema 4

`TABELAS_BANCO = ['bancos']`. `validarBackup` passa a exigir o array quando `schema === 4`, e
backup de schema < 4 entra com `bancos: []` — exatamente o padrão já usado para as tabelas de
cartão (schema 1 → 2) e viagens (schema 2 → 3). `gerarBackup` passa a emitir `schema: 4`.

A validação **só endurece**: nenhuma checagem existente é afrouxada. Exige testes
adversariais (regra do `CLAUDE.md`): `bancos` ausente num backup schema 4, `bancos` não-array,
e o merge por `alteradoEm` da nova tabela.

### Domínio puro (`src/domain/bancos.ts`, novo)

```ts
export function bancosDaBox(bancos: Banco[], boxIds: readonly ID[]): Banco[]
export function totalDeclaradoCent(bancos: Banco[]): number | null
```

`bancosDaBox` filtra e ordena por `ordem` e depois `nome` (mesma disciplina de
`compararCategoriasCartao`). `totalDeclaradoCent` soma os declarados **ignorando os `null`** e
devolve `null` quando nenhum banco foi informado — a distinção entre "informou zero" e "não
informou" é o que evita a tela mentir que a diferença é o saldo inteiro.

### UI

**`src/ui/ajustes/Bancos.tsx` (novo)** — subtela de Ajustes, registrada em `TelaAjustes.tsx`.
Formulário de criação **no topo**, antes da lista (regra registrada em
`docs/estilo/nivel-5-nova-tela.md`). Cada item mostra nome, saldo informado com a data, e os
cartões vinculados; editar e excluir seguem o padrão das outras subtelas, com `window.confirm`
antes de apagar — que desde a v0.19.0 é o idioma de toda exclusão do app.

**`ConferenciaSaldo` (`src/ui/TelaHoje.tsx`)** — quando a box tem bancos, vira uma linha por
banco com o campo de valor, e no rodapé o total informado mais a diferença para o saldo que o
Flow projeta. É a mesma conta de hoje, com o lado informado quebrado em partes.

**Quando a box não tem banco nenhum, a tela é exatamente a de hoje**, usando o
`saldoDeclaradoCent` da própria box. É isto que garante zero regressão e zero migração: quem
nunca cadastrar um banco não percebe diferença.

**O valor antigo da box quando passam a existir bancos:** `Box.saldoDeclaradoCent` (e o
`Config.saldoDeclaradoCent` da visão `casa`) **para de ser exibido e de ser usado na conta**,
mas **não é apagado** — fica no banco de dados intacto. Somar os dois níveis contaria o mesmo
dinheiro duas vezes, e apagar destruiria dado do usuário para resolver um problema de
exibição. Excluir todos os bancos de uma box a devolve ao comportamento antigo, com o valor
que estava lá. Isso torna a entrega reversível de fato, não só no papel.

**Quando a box tem bancos mas nenhum foi informado** (`totalDeclaradoCent` devolve `null`), o
rodapé não mostra diferença nenhuma — só o convite a informar. Mostrar "diferença = saldo
inteiro" seria a tela afirmando um descasamento que não existe.

**Visão `casa`** — os bancos de todas as boxes, agrupados por box (`.rotulo-grupo` +
`.recuo-1`, mesmo padrão do `LancamentosSheet`), coerente com o que o sentinela já faz.

### Repositório (`src/db/repo.ts`)

`salvarBanco`, `atualizarBanco`, `excluirBanco` no padrão das demais entidades (transação +
`marcarMudanca`). `carregarTudo` passa a ler `bancos`. Excluir um banco **limpa o `bancoId`
dos cartões que apontavam para ele**, no mesmo padrão de `excluirViagem`, que já faz isso com
lançamentos e compras — cartão órfão apontando para banco inexistente é exatamente o tipo de
inconsistência silenciosa que o `docs/dominio.md` cataloga.

Nenhuma mutação de banco chama `sincronizarCartoes`: banco não entra em fatura nesta entrega.

## Estilo

Tela nova (nível 5) mais, possivelmente, classe nova para a lista de conferência por banco
(nível 2). Consultar `docs/estilo-visual.md` e os capítulos correspondentes antes do código;
classe ou componente novo se cataloga em `docs/estilo/catalogo.md` **no mesmo commit** — o
guard do release bloqueia se faltar. Mudança de UI exige **mockup aprovado** antes de escrever
a tela.

## Verificação

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Testes que esta entrega exige por regra, não por gosto:

- **Upgrade do Dexie**: popular no schema 3, abrir no schema 4.
- **Backup adversarial**: `bancos` ausente/não-array em schema 4; schema 3 entrando com
  `bancos: []`; merge por `alteradoEm`.
- **Zero regressão na Hoje**: box sem banco mostra e grava a conferência como antes.
- **Reversibilidade**: box com bancos ignora o `saldoDeclaradoCent` antigo; excluir todos os
  bancos volta a exibi-lo com o valor original preservado.
- **Exclusão de banco** limpa o `bancoId` dos cartões.

No celular, depois do deploy: cadastrar dois bancos numa box, informar o saldo de cada um,
conferir que o total e a diferença batem com o que a tela mostrava antes de dividir, e que
exportar e reimportar o backup preserva os bancos.

## Fora de escopo (entrega 2)

- `bancoId` no lançamento e o campo na tela Lançar.
- **Alerta permanente de "sem banco"** — decidido em 2026-08-05, já com o formato: uma linha
  discreta na tela Hoje ("N lançamentos sem banco") que abre a lista filtrada, para
  classificar em sequência. **A fila de Pendentes não muda**: ela continua sendo o que falta
  confirmar, e não se mistura com o que falta classificar — são ações diferentes sobre
  registros em estados diferentes.

  O alerta **não pode vir antes** do campo no lançamento: sem ele, "sem banco" é 100% dos
  registros (317 lançamentos e 206 compras), e um alerta que aponta tudo não aponta nada. Só
  depois do campo existir é que "sem banco" passa a significar anomalia — e aí vale mantê-lo
  para sempre, como rede de segurança.
- Banco padrão marcável em Ajustes. **Não entra agora de propósito:** sem lançamento
  carregando banco, seria um controle que não faz nada.
- Saldo inicial por banco e projeção/gráfico por banco — os gráficos seguem consolidados.
- Reclassificar o histórico. Os 317 lançamentos e 206 compras existentes ficam sem banco, por
  decisão do usuário; nada é carimbado retroativamente.
