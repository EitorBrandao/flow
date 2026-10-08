# Modo de uso por box — desenho

Data: 2026-10-08. Estado: aguardando revisão. Mockup aprovado pelo usuário no chat.

## Problema

Hoje o modo Simples ou Avançado é global. `Config.modos` guarda um modo por tela, e vale para todas as boxes. Quem tem uma box pessoal simples e uma box de empresa detalhada não consegue ter as duas.

## Decisões

1. **Cada box tem seus cinco modos** (Hoje, Fluxo, Cartão, Análises, Lançar). Trocar a box no topo troca o modo das telas.
2. **A visão `casa` tem modos próprios.** Eles ficam na box real chamada `"casa"` (ver `docs/dominio.md`, seção "A box `'casa'`"). Se essa box foi renomeada ou removida, a visão casa usa o modo global.
3. **Box existente herda o modo global.** Nada muda de aparência para quem já usa. Não há migração de dados.
4. **Ajustes → Modo de uso edita a box escolhida no topo**, inclusive a casa. Não há seletor de box na tela. Outras telas de configuração por box seguem o mesmo padrão.

## Modelo

- `Box.modos?: Partial<ModosUso>`. Ausente ou sem a tela = herda o global.
- `Config.modos` continua. Passa a ser o **padrão** de toda box que não tem modo próprio.
- Regra de resolução, em `src/domain/modos.ts`:
  `modoDaBox(dados, boxSel, tela)` = `box.modos?.[tela]` → `config.modos?.[tela]` → `'avancado'`.
  - `boxSel` é um ID de box: usa essa box.
  - `boxSel === 'casa'`: usa a box real `"casa"` (`boxIdEfetivo`). Sem ela, usa o global.
- `modoDe(config, tela)` fica como está. É o passo global da regra acima.
- Instalação nova: `Config.modos` começa em Simples (`modosInstalacaoNova`). Box nova herda, então começa Simples.
- Sem tabela nova, sem índice novo, sem `this.version(n)`.

## Persistência (`src/db/repo.ts`)

- Novo `salvarModoBox(boxId, tela, modo)`. Numa transação `rw` em `db.boxes` e `db.config`:
  - lê os modos efetivos da box (box → global → `'avancado'`);
  - troca só a tela pedida;
  - grava as **cinco** telas em `Box.modos`. Assim a box deixa de herdar: mudar o global depois não a altera.
- **Não** muda `alteradoEm` da box e **não** chama `marcarMudanca`. Trocar de modo não é dado a salvar em backup, e mexer em `alteradoEm` faria o `mesclar` preferir essa box inteira por engano.
- `salvarModo(tela, modo)` (global) fica sem mudança. Deixa de ter tela própria e vira só o padrão de partida. Os testes atuais continuam valendo.
- `salvarBox(box)` faz `put` do objeto inteiro. O `modos` só sobrevive se o chamador parte da box existente. Conferido por grep: os chamadores que **editam** box usam `{ ...box, ...campos }` (`Boxes.tsx` `atualizar`, `TelaHoje.tsx` nas duas conferências de saldo). Os que **criam** box montam o objeto novo, sem `modos`, e a box nova herda o global (`store.ts` `iniciar` para a casa, `Boxes.tsx` `criar`, `dossie/executar.ts`, `dossie/roteiro.ts`). Nenhum monta box existente campo a campo. Um teste cobre a preservação.

## Backup (`src/backup/backup.ts`)

Regra de dados: `validarBackup` nunca relaxa.

- `validarBackup` não reconstrói as boxes: ele só faz `{ ...d }`. Por isso o `modos` de cada box atravessa intacto. Hoje ele também não valida cada box; passa a validar só o `modos`.
- Se uma box traz `modos` (e não `undefined`), ele deve passar em `modosValidos`. Senão lança `Backup corrompido: modos de uso inválidos.` Box nula ou sem `modos` valida e volta sem `modos`. O export (`gerarBackup`) grava `dados` inteiro, sem lista fixa de campos.
- `substituirTudo`: as boxes do backup trazem seus `modos`. Box sem `modos` herda o `Config.modos` do backup.
- `mesclar`: `config` vem de `atual`, e o modo é preferência do aparelho. Para toda box que já existe em `atual`, o resultado mantém o `modos` de `atual` (ou fica sem `modos`, se `atual` não tem), mesmo quando a box do backup vence por `alteradoEm`. Box só do backup entra com os `modos` dela.
- O backup antigo, sem `modos` nas boxes, continua válido.

## UI

- `useModo(tela)` (`src/ui/useModo.ts`) passa a ler `boxSel` e chamar `modoDaBox`. Os cinco usos (`TelaHoje`, `TelaFluxo`, `TelaCartao`, `TelaAnalises`, `TelaLancar`) não mudam.
- `ModoDeUso.tsx`: lê e grava pela box do topo (`boxSel`). A frase de abertura é a do mockup aprovado, palavra por palavra:
  - Box real: "Escolha o quanto de detalhe cada tela mostra **na box X**. Para mudar outra box, troque a box no topo. Seus dados são os mesmos nos dois modos e nada se perde ao trocar."
  - Visão casa: "…cada tela mostra **na visão casa** (todas as boxes juntas). Para mudar outra box, …" (resto igual).
- **Duas mudanças visíveis que o mockup não mostrou** (precisam de aprovação própria):
  1. `TelaAjustes.tsx`: o detalhe do item passa de "Simples ou avançado, por tela" para "Simples ou avançado, por box e por tela".
  2. `ModoDeUso.tsx`, só se a visão casa não tem a box real `"casa"` (renomeada ou removida): grava o modo global e a frase diz "…cada tela mostra **no padrão do app**. …" (resto igual).
- Nenhuma classe nem componente novo. `docs/estilo/catalogo.md` não muda.
- O Lançar usa o modo da **box do topo**, não o da box de destino do lançamento. Na casa, o formulário já exige escolher uma box, mas o modo continua o da casa.

## Consistência entre telas

O mesmo conceito ("modo de uma tela") aparece em Ajustes e em cada tela. Hoje ambos leem `config.modos`. Depois, ambos leem `modoDaBox`. O teste de consistência `modos.consistencia.test.tsx` continua valendo nos dois modos.

## Pontos de chamada (grep)

Grep completo, fora dos testes:

- `modoDe`: `useModo.ts:6`, `ModoDeUso.tsx:52`, `modos.ts` (`modosEfetivos`).
- `useModo`: `TelaHoje:436`, `TelaFluxo:37`, `TelaCartao:338`, `TelaAnalises:39`, `TelaLancar:24`.
- `salvarModo`: `ModoDeUso.tsx:40` (passa a usar `salvarModoBox`); testes de cada tela.
- `modosEfetivos`: `repo.ts:277`, `test-setup.ts:23`.
- `Config.modos`: `repo.ts` (instalação nova, `salvarModo`, `substituirTudo`), `backup.ts:45` (`validarBackup`), `mesclar`.
- Escrita em `db.boxes`: `salvarBox`, `substituirTudo` (`bulkAdd`), categorias de transferência. Só `salvarBox` e `substituirTudo` carregam `modos`; as outras usam `update` parcial e preservam o campo.
- Exclusão de box: o `modos` some junto com a box. Não deixa resíduo.

## Testes

- `modoDaBox`: box com modo próprio; box sem `modos` herda o global; tela ausente na box herda só aquela tela; sem global vale Avançado; `boxSel === 'casa'` com e sem a box real; box inexistente.
- `salvarModoBox`: grava as cinco telas; trocar uma não muda as outras; duas boxes ficam independentes; não muda `alteradoEm` nem `mudancasDesdeBackup`; escritas simultâneas em duas telas da mesma box são atômicas.
- `salvarBox` preserva `modos`.
- Backup: box com `modos` válido sai de `validarBackup` com o `modos` **intacto** (igualdade profunda); `modos` inválido (valor, tela desconhecida, array, `null`) lança; backup antigo passa; `mesclar` mantém o `modos` do aparelho mesmo se a box do backup é mais nova; `substituirTudo` traz os `modos`.
- UI: Ajustes mostra e grava os modos da box do topo; trocar a box no topo troca os modos mostrados; a tela Hoje muda entre Simples e Avançado ao trocar a box; visão casa usa os modos da box `"casa"`.
- Varredura com Playwright no Galaxy S25+ (411 × 744), dados sintéticos, só em `localhost`.
- `npm test` completo e `npm run build`.

## Documentação e entrega

- `docs/dominio.md`: reescrever o parágrafo de `Config.modos` (linhas ~113–119) para descrever `Box.modos` e a regra de resolução.
- `docs/wiki/`: capítulo do Modo de uso passa a dizer que o modo é por box.
- `changelog.d/alterado-modo-por-box.md`.
- `docs/superpowers/README.md`: linha da nova spec e do plano.
- Dossiê: `npm run dossie`, se o roteiro mudar.
- Fora de escopo: botão "aplicar a todas as boxes" e cópia de modos entre boxes. Pode virar item de backlog.
