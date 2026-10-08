# A casa confere por box e cada visão tem os seus cenários — design

Status: aprovada em 2026-10-01 — implementada
Nota: Saiu na v0.61.0 (entrega C do item 34).

Entrega C do item 34 do `TODO.md` (VB-23 e VB-24, mais o que Simular e Importar fazem na casa).
Mockup de Conferir, Importar e Bancos aprovado em 2026-10-01. O bloco do Simular do mockup foi
trocado pela decisão abaixo.

## Problema

- **VB-23:** com "casa" no topo, Ajustes → Bancos lista os bancos de todas as boxes e cria banco
  na box `"casa"`.
- **VB-24:** com "casa" no topo, Hoje → Conferir compara o total de **todas** as boxes com os
  bancos que existem. Uma box sem bancos fica de fora da conferência, mas entra no total do Flow.
  Sem nenhum banco, a aba pede um "Saldo real no banco" único, sem dono.
- **Simular:** cenário não tem dono. Aparece em toda visão, e o item novo vai para a box do topo
  (na casa, para a box `"casa"`). Um cenário criado em ana aparece no Simular de bruno com
  tabela zerada, e soma no gráfico da casa.
- **Importar:** o extrato da conta, com "casa" no topo, grava na box `"casa"`.

## Decisões

- **Bancos na casa:** só o aviso, como Categorias, Cartões e as outras. Decisão do usuário.
- **Conferir na casa:** uma conferência por box. Decisão do usuário.
- **Cada cenário nasce na visão em que foi criado (a casa ou uma box) e só existe nela.** Ninguém
  escolhe box para simular: o cenário usa o fluxo de caixa da visão. A casa mostra e soma só os
  cenários da casa; cada box, só os dela. Decisão do usuário.
- **Cenários que já existem passam a ser da casa.** Decisão do usuário. Somem das boxes.
- **Importar o extrato da conta na casa pede a box**, sem marcar nenhuma. Fatura de cartão não
  muda: o cartão já define a box.

## Mudanças

### 1. Bancos mostra aviso na casa (VB-23)

`src/ui/ajustes/Bancos.tsx`: com `boxSel === 'casa'`, mostra o `<h2>Bancos</h2>` e
`<AvisoEscolhaBox assunto="Os bancos" />` (componente já existente), sem lista nem formulário.
`boxIdEfetivo` e `boxIdsSelecionadas` saem da tela: `boxId` passa a ser `boxIdConcreta(boxSel)`.
A mensagem `A box "casa" não foi encontrada…` some.

### 2. Conferir por box na casa (VB-24)

`src/ui/TelaHoje.tsx`, aba Conferir, com `boxSel === 'casa'`. Entram as boxes da seleção com saldo
próprio (`saldoInicial !== null`). A box `"casa"` não entra: não tem banco nem saldo real.

- Uma seção por box, com o nome da box em `.rotulo-grupo`.
  - Box **com bancos:** uma linha por banco (como hoje), com o saldo real do banco.
  - Box **sem bancos:** uma linha "Saldo da box", com o saldo real da própria box
    (`Box.saldoDeclaradoCent` e `dataSaldoDeclarado`, que já existem).
- Rodapé: "Total informado" (soma de tudo o que foi informado), "Total calculado no Flow" e a
  diferença, com as mesmas frases, cores e sinal de hoje (`Diferenca`).
  - "Total calculado no Flow" = soma do saldo efetivo de hoje das boxes que entraram
    (`saldosPorBox`, entrega A), não o total do card Saldo hoje, que também soma a box `"casa"`.
  - A diferença só aparece quando **toda box** que entrou tem saldo informado (em algum banco ou
    na própria box). Senão: "Informe o saldo de ana, bruno para conferir." (nomes das boxes que
    faltam, separados por vírgula).
- Salvar grava só o que mudou: `repo.atualizarBanco` para banco e `repo.salvarBox` para box.
- O saldo declarado único da casa (`Config.saldoDeclaradoCent`) deixa de aparecer na tela. O dado
  antigo continua guardado e no backup; nada é apagado.
- Numa box só, a aba não muda.
- "Transferir entre bancos" continua fora da casa (já é assim).

### 3. Cenários têm dono (Simular)

**Modelo:** `Cenario` ganha `escopo?: string` em `src/domain/types.ts`: o id de uma box ou o texto
`'casa'`. Ausente vale `'casa'`. Sem índice novo, então sem `this.version(n)` no Dexie. O campo
entra no backup e na mesclagem como os outros campos opcionais.

**Regra de visão:** um cenário pertence à visão `v` quando `(cenario.escopo ?? 'casa') === v`, onde
`v` é `boxSel` (`'casa'` ou o id da box). Função pura nova em `src/domain/cenarios.ts`:

```ts
export function escopoDoCenario(c: Cenario): string      // c.escopo ?? 'casa'
export function cenarioDaVisao(c: Cenario, boxSel: string): boolean
```

**Onde a regra vale:**
- `cenariosLigados(dados, boxSel)` (`src/state/store.ts`) devolve só os ligados da visão. Todo
  chamador passa `boxSel`: `TelaHoje` (duas vezes), `TelaFluxo`, `SimuladorFluxo`. Assim, o gráfico
  e a projeção da casa somam só cenários da casa, e os de cada box, só os dela.
- `SimuladorFluxo`: lista só os cenários da visão; `porCenario` e a tabela combinada usam só eles;
  "Nenhum cenário ainda." vale para a visão.
- `SimuladorSimples`: o rascunho nasce com o escopo da visão; o resultado e o "Guardar" usam só o
  cenário da visão. "Guardar" mantém o escopo.
- Criar cenário (`SimuladorFluxo.criar`) grava `escopo: boxSel`.
- Item novo: `boxIdNovo` continua `boxIdEfetivo(dados, boxSel)`: numa box, a box do topo; na casa, a
  box `"casa"`. Ninguém escolhe box no Simular. O item da casa conta na casa porque a visão casa
  soma todas as boxes, inclusive a `"casa"`.
- O app não tem exclusão de box, então nenhum cenário fica órfão por causa do `escopo`. Se um dia
  houver, ela terá de apagar os cenários da box e os itens deles.
- Backup: `validarBackup` aceita `escopo` ausente ou texto; outro tipo é rejeitado (só mais
  rígido, nunca mais frouxo). Backup antigo, sem `escopo`, importa como cenário da casa.
- **Converter em real** (`converterCenarioEmReal`) não muda: o cenário da casa vira lançamento
  real na box `"casa"`. Limitação aceita: esses lançamentos não têm tela de edição na casa.

### 4. Importar o extrato da conta na casa

`src/ui/ajustes/Importar.tsx` já tem o passo "2. Destino", com um grupo de botões "Box de destino"
para o extrato da conta. Hoje esse passo lista **todas** as boxes e já vem marcado com
`boxIdEfetivo(dados, boxSel)`, que na casa é a box `"casa"`. Muda:

- Os botões listam só as boxes com saldo próprio (`saldoInicial !== null`).
- A marcação inicial é a box do topo quando ela é concreta; com `boxSel === 'casa'`, nenhuma box vem
  marcada (`boxIdEscolhida: null`). Sem box marcada, o passo 3 (confirmar) continua bloqueado,
  como já é com `destinoCompleto` falso.
- Fatura de cartão não muda: o cartão escolhido define a box, e na casa qualquer cartão ativo
  entra.

## Pontos de chamada

- `boxIdEfetivo` sai de `Bancos` e deixa de dar a marcação inicial do extrato em `Importar` (fica só
  em `cartoesAtivos`, que já trata a casa à parte). Permanece em `SimuladorFluxo` (item novo),
  `SimuladorSimples`, `CenarioCard` (mensagem de box ausente continua) e `AdicionarSheet`.
- `cenariosLigados`: `TelaHoje`, `TelaFluxo`, `SimuladorFluxo` e testes. Confira também
  `src/dossie/`.
- `dados.cenarios`: `SimuladorFluxo`, `SimuladorSimples`, repo (apagar, converter, rascunhos),
  backup (exportar, mesclar, importar substituindo).
- Nenhum caminho de pagamento muda.

## Consistência entre telas

Hoje → Conferir na casa usa as mesmas frases, cores e sinal da conferência por banco e da conferência
da fatura. As telas por box (Bancos incluso) dizem a mesma frase do aviso. "Os cenários da visão"
vale igual no gráfico de Hoje, no gráfico do Fluxo e no Simular.

## Documentação e catálogo

- `docs/wiki/`: Conferir na casa por box; Simular com dono (cada visão tem os seus cenários;
  cenários antigos viraram da casa); Importar pede a box na casa; Bancos pede uma box.
- `docs/dominio.md`: `Cenario.escopo`, regra da visão, efeito em `cenariosLigados`; Bancos e o
  extrato deixam de gravar na box `"casa"` pela UI; `boxIdEfetivo` só em Simular e `AdicionarSheet`.
- `docs/estilo/catalogo.md`: nenhuma classe nova; se surgir componente, catalogar.
- `changelog.d/`: fragmentos `alterado-*.md` e `adicionado-*.md`.
- `TODO.md` (local): VB-23 e VB-24 saem do item 34 para `TODO-CONCLUIDOS.md`.

## Testes

- `cenarioDaVisao`/`escopoDoCenario`: ausente é da casa; box e casa se separam.
- `cenariosLigados(dados, boxSel)`: casa só os da casa; box só os dela; cenário desligado não entra.
- Projeção: um cenário de ana ligado não muda o gráfico da casa nem o de bruno; um cenário da casa
  não muda o de ana.
- Simular: lista só os cenários da visão; criar na casa grava `escopo: 'casa'`; criar em ana grava o
  id de ana; item novo na casa vai para a box `"casa"`; backup antigo sem `escopo` aparece na casa.
- Backup (testes adversariais): `escopo` numérico é rejeitado; `escopo` ausente é aceito;
  `alteradoEm` no futuro; JSON malformado; `config` nulo; mesclar preserva `escopo`.
- Conferir na casa: seção por box; box com bancos mostra bancos; box sem bancos mostra "Saldo da
  box"; box `"casa"` fora; total e diferença só com todas as boxes informadas; frase com os nomes
  que faltam; salvar grava banco e box; numa box só, igual a hoje.
- Bancos na casa: título e aviso, sem formulário nem lista.
- Importar na casa: nenhuma box marcada por padrão, só boxes com saldo próprio nos botões, confirmar
  bloqueado sem box; numa box só, a box do topo vem marcada; fatura de cartão sem mudança.
- Varredura com Playwright (Galaxy S25+), duas boxes e a casa, dados sintéticos.

## Fora desta entrega

Mover um cenário de uma visão para outra. Converter cenário da casa em lançamento real de uma box.
