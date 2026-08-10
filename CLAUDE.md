# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) no trabalho com o código deste repositório.

Este arquivo segue o padrão ASD-STE100 e os quatro princípios de Zinsser — clareza, simplicidade, brevidade, humanidade: frases curtas, uma ideia por frase, voz ativa, vocabulário consistente. Mantenha esse estilo em qualquer edição futura.

## O projeto

**Flow** é um app de controle financeiro pessoal. Mostra o fluxo de caixa diário com saldo projetado.

O Flow é um PWA local-first, sem servidor:

- Interface em React 18, TypeScript e Vite.
- Estado global em Zustand.
- Persistência em IndexedDB via Dexie.
- Gráficos em Recharts.
- Animações em framer-motion.

Todos os dados vivem no IndexedDB do navegador. Por isso, backup e export são funcionalidades críticas.

Código, UI e documentação usam **português**.

**Todo texto que você escrever para o usuário — respostas, UI, docs, mensagens de commit — é sempre em português.** Nunca misture frases ou palavras soltas em inglês no meio do texto. Ao verter um termo do inglês, nunca traduza literalmente, palavra por palavra: traduza pelo contexto e pelo sentido, do jeito que um falante nativo técnico escreveria.

## Comandos

```
npm run dev          # servidor de desenvolvimento (Vite)
npm run build        # tsc -b && vite build
npm test             # vitest run (uma passada)
npm run test:watch   # vitest em modo watch
npx vitest run src/domain/fatura.test.ts        # um arquivo de teste
npx vitest run -t "nome do teste"               # um teste pelo nome
npm run deploy       # build + publica dist/ no branch gh-pages de EitorBrandao/flow (GitHub Pages)
                     # → usuário testa em https://eitorbrandao.github.io/flow/
npm run release -- <patch|minor|major>
                     # Junta os fragmentos de changelog.d/ numa nova versão no CHANGELOG.md.
                     # Bumpa a versão em package.json e cria commit + tag.
                     # Use só na integração, no branch main.
```

Os testes usam jsdom e fake-indexeddb (`src/test-setup.ts`). Ficam ao lado do código, com o sufixo `*.test.ts(x)`.

O Vitest ignora `.worktrees/` de propósito. Cada worktree paralelo tem seu próprio `node_modules`. Coletar testes de lá quebra os hooks do React.

Os timeouts são **deliberadamente generosos**. Vivem em dois lugares independentes:

- `testTimeout` e `hookTimeout` (20 s), em `vite.config.ts`, para o Vitest.
- `asyncUtilTimeout` (10 s), em `src/test-setup.ts`, para os `findBy*`/`waitFor` do Testing Library.

Mudar um valor não afeta o outro.

Não aperte esses timeouts. Não use `{ timeout: n }` numa chamada de `findBy*`: um timeout local vira um teto mais baixo e volta a deixar a suíte instável numa máquina ocupada. Um timeout alto não custa tempo em teste que passa — só limita o quanto um teste travado segura a suíte.

## Guardas automáticas

Algumas regras deste arquivo já são bloqueios automáticos, não só disciplina. Saber quais são automáticas evita dois erros: refazer a checagem à mão, ou tratar um abort como defeito.

| Guarda | Onde | O que bloqueia |
|---|---|---|
| CI | `.github/workflows/ci.yml` | `npm ci` + `npm test` + `npm run build` em push/PR para `main` |
| Release | `scripts/release.mjs` | branch ≠ `main`, working tree suja fora de `CHANGELOG.md`/`package.json`/`changelog.d/`, tag da versão já existente, fragmento vazio ou com bullet fora do formato, nenhum item resultante |
| Catálogo | `scripts/verificar-catalogo.mjs --strict`, chamado pelo release | classe de `src/styles.css` ou componente de `src/ui/` fora de `docs/estilo/catalogo.md` (e o inverso), e o próprio `catalogo.md` ausente havendo `src/styles.css`. Rode sozinho quando quiser: `node scripts/verificar-catalogo.mjs` — sem `--strict` ele só avisa (exit 0) |
| Deploy | `scripts/predeploy.mjs` | branch ≠ `main`, working tree suja, commit `chore(release)` de outro branch fora da ancestralidade do HEAD, HEAD ≠ `origin/main` (este último é pulado com aviso se o `git fetch` falhar; a checagem de ancestralidade só enxerga refs já presentes localmente) |
| Dados reais | `scripts/verificar-dados-reais.mjs --strict`, chamado pelo release | valor em real fora das exceções sintéticas, ou termo de `~/.claude/flow-dados-reais.txt`, em **qualquer** arquivo versionado. Rode sozinho quando quiser: `node scripts/verificar-dados-reais.mjs` — sem `--strict` ele só avisa (exit 0) |
| Lembretes | `.claude/hooks/` (ver `.claude/hooks/README.md`) | **nada** — só avisam, ao editar UI, ao editar com HEAD na `main`, ao instalar dependência e ao commitar |

Duas consequências valem por escrito:

- **`DEPLOY_FORCE=1` pula todos os guards do deploy.** Essa opção existe para o caso de o repositório estar num estado que os checks não sabem julgar. Use-a só com pedido explícito do usuário — nunca como atalho para um check que incomodou.
- **O texto `chore(release)` é reservado às mensagens de commit geradas por `npm run release`.** O guard do deploy procura essa string com `git log --grep`. Essa busca casa em **qualquer posição** da mensagem, não só no começo. Por isso, um commit comum que contenha esse texto, num branch lateral, causa um aborto falso do deploy. Esse é o **único** guard que ainda depende de casar texto: o do catálogo bloqueia pelo código de saída (`--strict`), porque reescrever o relatório desligava o guard em silêncio.

## Arquitetura

`docs/dominio.md` descreve o modelo conceitual e os invariantes de `src/domain/`, `src/db/` e `src/backup/`. Cobre: o que é a box `'casa'`, a matriz `status` × `origem` do lançamento, o ciclo da fatura, e o que `validarBackup` garante e não garante.

Camadas, de baixo para cima:

- **`src/domain/`** — lógica pura, sem E/S (entrada/saída).
  - `types.ts`: define as entidades (Box, Categoria, Lancamento, Recorrencia, Cartao, CategoriaCartao, CompraCartao, RecorrenciaCartao, ConferenciaFatura, Cenario, Viagem, Config) e o snapshot `Dados`, que agrega todas elas.
  - `projection.ts` (`projetarBoxes`): calcula o saldo dia a dia até `config.horizonteProjecao`.
  - `recurrence.ts`: materializa recorrências em lançamentos `previsto`.
  - `fatura.ts`: calcula os ciclos de fechamento e vencimento do cartão, e gera as faturas.
  - `aggregations.ts`: alimenta a aba Análises.
  - `categorias.ts`: guarda a ordenação e a numeração de ordem das categorias (`compararCategorias`, `diffOrdem`, `proximaOrdem`).
  - `viagem.ts`: resolve a viagem ativa numa data e agrega os itens de uma viagem (`viagemAtivaEm`, `itensDaViagem`).
  - `money.ts`: é o único lugar de parse e format de dinheiro.
  - `dates.ts`: concentra a aritmética de calendário sobre `ISODate` (ver `docs/dominio.md` para as exceções de formatação de data na UI).
- **`src/db/`**
  - `database.ts`: é o schema Dexie, versionado. Uma tabela ou índice novo exige uma nova `this.version(n)`.
  - `repo.ts`: concentra TODA a persistência. Mutations que afetam recorrências ou cartões recebem `horizonte` e re-materializam ou sincronizam (`materializarTodas`, `sincronizarCartoes`). Faturas viram lançamentos com `origem: 'cartao'`, na categoria de fatura do cartão.
- **`src/state/store.ts`** — um único store Zustand.
  - `iniciar()`: carrega tudo (`repo.carregarTudo()`), materializa e sincroniza.
  - Depois de qualquer mutation, a UI chama `recarregar()`. Essa função recarrega o snapshot inteiro (`dados: Dados`).
  - `boxSel`: aceita um ID de box, ou o sentinela `'casa'` para todas as boxes consolidadas.
  - `aba`: define a tela ativa.
- **`src/ui/`** — telas, navegação e sheets. Detalhes em `src/ui/CLAUDE.md`.
- **`src/backup/`** — exporta e importa backup em JSON, com merge (`mesclar`).

Convenções do domínio:

- Valores monetários são **centavos inteiros**.
- Datas são strings ISO `"AAAA-MM-DD"`.
- Lançamentos têm `status` (`efetivo` ou `previsto`) e `origem` (`manual`, `recorrencia` ou `cartao` — tipo `OrigemLancamento`, em `src/domain/types.ts`). O antigo valor `import` saiu junto com a importação de xlsx.
- Cenários são lançamentos hipotéticos. Podem ser ligados ou desligados na projeção, mas nunca têm `status: efetivo`.

## Regras do repositório

- **Antes de editar a UI, consulte `docs/estilo-visual.md`.** Edição de UI é qualquer diff em `src/ui/**`, `src/styles.css` ou `index.html`. O critério é o caminho do arquivo, não a aparência da mudança. O índice de `docs/estilo-visual.md` aponta para o capítulo certo em `docs/estilo/`, conforme o nível da mudança: editar tela, nova classe, novo token, novo componente, nova tela, ou mudança de linguagem. Quem cria uma classe ou componente cataloga em `docs/estilo/catalogo.md`. Se o código e o guia divergirem, o código manda — mas só para divergências que já existiam antes da sua mudança; nesse caso, atualize o guia também. Uma divergência criada pela sua própria mudança não conta como divergência: é uma edição do nível correspondente (mudar o valor de um token ou um princípio é nível 6). Esta regra nunca autoriza sua própria mudança a divergir do guia.
- Specs e planos de features ficam em `docs/superpowers/specs/` e `docs/superpowers/plans/`. O backlog, com contexto e decisões em aberto, está em `TODO.md`. Esse arquivo é **local e fica fora do git de propósito** — está no `.gitignore`. Por isso, ele não existe num clone limpo, no CI, ou num worktree novo. Isso é esperado: peça o conteúdo ao usuário, em vez de recriá-lo.
- **Nunca faça commit de dados financeiros reais do usuário.** O critério é o conteúdo do arquivo, não a extensão. Nenhum valor, saldo, descrição de lançamento ou nome de estabelecimento real pode entrar em nenhum arquivo versionado: testes, fixtures, specs, mockups e fragmentos de changelog usam só dados sintéticos. Isso vale até para o `CHANGELOG.md`, porque ele vai embutido no bundle público, e o repositório é público. `*.xlsx` e `*.json.backup` estão no `.gitignore` de propósito — renomear o arquivo não o torna seguro para commit.
- **Toda dependência npm nova, inclusive em `devDependencies`, é uma decisão de produto.** Antes de instalar: confirme com o usuário, justifique por que código próprio não basta, rode `npm audit`, e inclua o lockfile no mesmo commit. Os dados financeiros do usuário vivem só no navegador dele — por isso, supply chain é o vetor de ataque mais realista deste app.
- **`scripts/`, os arquivos de configuração de build (`vite.config.ts`, `tsconfig.json`, scripts do `package.json`) e `.claude/` só mudam com pedido explícito do usuário.** Nunca mude esses arquivos como efeito colateral de uma feature. Os guards em `scripts/` (`release.mjs`, `predeploy.mjs`, `verificar-catalogo.mjs` — ver "Guardas automáticas") aplicam o fluxo de forma automática. Afrouxar qualquer um deles não é manutenção: é mudança de processo.
- **Tudo em `public/` vai, sem alteração, para o site público** — entra em `dist/` e é publicado. Um arquivo novo ali é uma decisão explícita, nunca um depósito de trabalho. Antes de mudar a configuração de PWA ou de service worker, confirme com o usuário: um erro de cache pode prender usuários numa versão velha do app.
- **Topologia de branches:** `main` é o branch fonte canônico — o código vive ali. O site publicado, o build `dist/`, vive num branch separado, **`gh-pages`**, gerado por `npm run deploy`. Nunca edite `gh-pages` à mão. Nunca trabalhe direto na `main`: crie um branch antes de alterar qualquer arquivo. Sessões concorrentes rodam no mesmo checkout — por isso, todo trabalho com commits deve ir para um git worktree próprio, em `.worktrees/`.
- **Versão e changelog só mudam na integração.** Essa regra evita colisão entre sessões paralelas. Branches de feature **nunca** editam `"version"` em `package.json`, nem o topo do `CHANGELOG.md`. Toda mudança visível ao usuário vira um **fragmento** em `changelog.d/`: um arquivo `<tipo>-<slug>.md`, com `tipo` igual a `adicionado`, `alterado` ou `removido`, e bullets planos (ver `changelog.d/README.md`). O número da versão é decidido **uma única vez**, na integração, por `npm run release`.
- **O ciclo de entrega é obrigatório.** O passo a passo está na skill `ciclo-de-entrega` (`.claude/skills/ciclo-de-entrega/SKILL.md`). **Invoque essa skill antes de integrar qualquer trabalho.** Ela cobre tudo, da criação do worktree ao deploy. Ela também define os dois pontos onde o ciclo para e espera você — o mockup aprovado, e a confirmação literal da revisão do changelog —, o critério que decide se há release, e o que fazer quando um guard aborta. Resumo em uma linha: worktree → mockup aprovado, se for UI → `npm test` verde → **wiki atualizada, se a feature mudou** → fragmento em `changelog.d/` mais confirmação do usuário → merge na `main` mais `npm run release` → push → `npm run deploy`. Uma mudança **não** visível ao usuário — refactor, docs, tooling — termina no merge: sem fragmento, sem wiki, sem release, sem deploy.
- **Toda feature incluída, alterada ou removida atualiza `docs/wiki/`, no mesmo branch.** O critério é o mesmo do fragmento de changelog: a mudança alterou o que o usuário vê? A wiki explica o app a quem chega agora. Uma wiki desatualizada ensina o app errado, com autoridade. O parser da wiki aceita só um subconjunto **fechado** de markdown (`docs/wiki/README.md`) e **lança uma exceção** fora dele: valide com `npx vitest run src/ui/ajustes/capitulos.test.ts`.

## Regras de dados (`src/db/`, `src/backup/`)

Um erro aqui custa dados financeiros do usuário. Esses dados não têm servidor, nem cópia automática. `docs/dominio.md` descreve o modelo conceitual e os invariantes: o que cada entidade significa, o que o código garante, e o que é só expectativa.

Regras específicas de cada pasta estão em `src/db/CLAUDE.md` e `src/backup/CLAUDE.md`.
