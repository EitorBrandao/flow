# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

**Flow** — app de controle financeiro pessoal (fluxo de caixa diário com saldo projetado). PWA local-first: React 18 + TypeScript + Vite, estado em Zustand, persistência em IndexedDB via Dexie, gráficos em Recharts, animação em framer-motion. Não existe servidor — todos os dados vivem no IndexedDB do navegador, por isso backup/export é funcionalidade crítica. Código, UI e docs são em **português**.

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
                     # junta os fragmentos de changelog.d/ numa nova versão no CHANGELOG.md,
                     # bumpa package.json e cria commit + tag. Só na integração, no branch main.
```

Testes usam jsdom + fake-indexeddb (`src/test-setup.ts`) e são colocados ao lado do código (`*.test.ts(x)`). O Vitest exclui `.worktrees/` de propósito — worktrees paralelos têm node_modules próprio e coletar testes de lá quebra os hooks do React.

## Guardas automáticas

Parte das regras deste arquivo já é bloqueio de máquina, não disciplina. Saber o que é
automático evita tanto refazer a checagem à mão quanto tratar um abort como defeito:

| Guarda | Onde | O que bloqueia |
|---|---|---|
| CI | `.github/workflows/ci.yml` | `npm ci` + `npm test` + `npm run build` em push/PR para `main` |
| Release | `scripts/release.mjs` | branch ≠ `main`, working tree suja, tag da versão já existente, fragmento vazio ou com bullet fora do formato, nenhum item resultante |
| Catálogo | `scripts/verificar-catalogo.mjs`, chamado pelo release | classe de `src/styles.css` ou componente de `src/ui/` fora de `docs/estilo/catalogo.md` (e o inverso). Rode sozinho quando quiser: `node scripts/verificar-catalogo.mjs` |
| Deploy | `scripts/predeploy.mjs` | branch ≠ `main`, working tree suja, commit `chore(release)` de outro branch fora da ancestralidade do HEAD, HEAD ≠ `origin/main` |
| Lembretes | `.claude/hooks/` (ver `.claude/hooks/README.md`) | **nada** — só avisam, ao editar UI, ao instalar dependência e ao commitar |

Duas consequências que valem por escrito:

- **`DEPLOY_FORCE=1` pula todos os guards do deploy.** Existe para o caso de o repositório
  estar num estado que os checks não sabem julgar; usar exige pedido explícito do usuário,
  nunca como atalho para um check que incomodou.
- **O texto `chore(release)` é reservado** às mensagens de commit geradas por
  `npm run release`: o guard do deploy procura essa string com `git log --grep`, que casa em
  **qualquer posição** da mensagem — não só no começo. Um commit comum que a contenha, num
  branch lateral, provoca aborto falso do deploy.

## Arquitetura

Camadas, de baixo para cima:

- **`src/domain/`** — lógica pura, sem IO. `types.ts` define as entidades (Box, Categoria, Lancamento, Recorrencia, Cartao, CategoriaCartao, CompraCartao, RecorrenciaCartao, ConferenciaFatura, Cenario, Viagem, Config) e o snapshot `Dados`, que agrega todas elas. `projection.ts` (`projetarBoxes`) calcula o saldo dia a dia até `config.horizonteProjecao`. `recurrence.ts` materializa recorrências em lançamentos `previsto`. `fatura.ts` calcula ciclos de fechamento/vencimento do cartão e gera as faturas. `aggregations.ts` alimenta a aba Análises. `categorias.ts` guarda a ordenação e a numeração de ordem das categorias (`compararCategorias`, `diffOrdem`, `proximaOrdem`); `viagem.ts` resolve a viagem ativa numa data e agrega os itens de uma viagem (`viagemAtivaEm`, `itensDaViagem`). `money.ts`/`dates.ts` são os únicos lugares de parse/format.
- **`src/db/`** — `database.ts` é o schema Dexie (versionado; nova tabela/índice = nova `this.version(n)`). `repo.ts` concentra TODA a persistência. Mutations que afetam recorrências ou cartões recebem `horizonte` e re-materializam/sincronizam (`materializarTodas`, `sincronizarCartoes`) — faturas viram lançamentos com `origem: 'cartao'` na categoria de fatura do cartão.
- **`src/state/store.ts`** — um único store Zustand. `iniciar()` carrega tudo (`repo.carregarTudo()`), materializa e sincroniza; depois de qualquer mutation a UI chama `recarregar()`, que recarrega o snapshot inteiro (`dados: Dados`). `boxSel` aceita um ID de box ou o sentinela `'casa'` (todas as boxes consolidadas). `aba` define a tela ativa.
- **`src/ui/`** — uma `Tela*.tsx` por tela: `TelaHoje`, `TelaFluxo`, `TelaLancar`, `TelaCartao`, `TelaAnalises`, `TelaAjustes` e `TelaSimulador` (esta última existe mas está fora da navegação — ver `ABAS` em `Shell.tsx`). `Shell.tsx` é a navegação; Ajustes é uma tela-menu com dez subtelas em `src/ui/ajustes/`. Sheets/modais compartilhados (`Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`).
- **`src/backup/`** — export/import de backup JSON com merge (`mesclar`).

Convenções do domínio: valores monetários são **centavos inteiros**; datas são strings ISO `"AAAA-MM-DD"`. Lançamentos têm `status` (`efetivo`/`previsto`) e `origem` (`manual`/`recorrencia`/`cartao` — `OrigemLancamento` em `src/domain/types.ts`; o antigo `import` saiu junto com a importação de xlsx). Cenários são lançamentos hipotéticos ligáveis/desligáveis na projeção — nunca `efetivo`.

## Regras do repositório

- **Antes de qualquer edição de UI, consulte `docs/estilo-visual.md`.** Edição de UI = qualquer diff em `src/ui/**`, `src/styles.css` ou `index.html` — o critério é o caminho do arquivo, não o que a mudança "parece ser". O índice aponta para o capítulo certo em `docs/estilo/` conforme o nível da mudança (editar tela, nova classe, novo token, novo componente, nova tela, mudança de linguagem). Quem cria classe/componente cataloga em `docs/estilo/catalogo.md`. Se código e guia divergirem, o código manda **apenas para divergências que já existiam antes de você chegar** — atualize o guia junto. Divergência que a sua própria mudança criaria não é divergência: é uma edição do nível correspondente (mudar valor de token ou princípio = nível 6). Esta regra nunca legitima uma mudança sua.
- Specs e planos de features ficam em `docs/superpowers/specs/` e `docs/superpowers/plans/`. O backlog com contexto e decisões em aberto está em `TODO.md`, que é **local e fora do git de propósito** (está no `.gitignore`): num clone limpo, no CI ou num worktree novo ele não existe, e isso é esperado — peça o conteúdo ao usuário em vez de recriá-lo.
- **Nunca commitar dados financeiros reais — o critério é o conteúdo, não a extensão.** Nenhum valor, saldo, descrição de lançamento ou nome de estabelecimento real do usuário entra em QUALQUER arquivo versionado: testes, fixtures, specs, mockups e fragmentos de changelog usam só dados sintéticos (o `CHANGELOG.md` vai embutido no bundle público, e o repositório é público). `*.xlsx` e `*.json.backup` estão no `.gitignore` de propósito — renomear o arquivo não o torna commitável.
- **Dependência npm nova (inclusive `devDependencies`) é decisão de produto:** confirme com o usuário antes de instalar, justifique por que código próprio não basta, rode `npm audit` e inclua o lockfile no mesmo commit. Os dados financeiros vivem no navegador do usuário — supply chain é o vetor de ataque mais realista deste app.
- **`scripts/`, configs de build (`vite.config.ts`, `tsconfig.json`, scripts do `package.json`) e `.claude/` só mudam com pedido explícito do usuário** — nunca como efeito colateral de uma feature. Em particular, `scripts/release.mjs` é o único enforcement automatizado do fluxo: afrouxá-lo não é manutenção, é mudança de processo.
- **`public/` vai literal para o site público** (entra em `dist/` e é publicado): arquivo novo ali é decisão explícita, nunca depósito de trabalho. Mudança em config de PWA/service worker: confirme com o usuário — erro de cache pode prender usuários numa versão velha do app.
- **Topologia de branches:** `main` é o branch **fonte** canônico (código). O site publicado (o build `dist/`) vive num branch separado, **`gh-pages`**, gerado por `npm run deploy` — nunca edite `gh-pages` à mão. Nunca trabalhar direto na `main`: criar branch antes de alterar arquivos. Sessões concorrentes rodam no mesmo checkout — trabalho com commits deve ir para um git worktree próprio (`.worktrees/`).
- **Versão e changelog só na integração (isto evita colisão entre sessões paralelas):** branches de feature **nunca** editam `"version"` em `package.json` nem o topo do `CHANGELOG.md`. Toda mudança visível ao usuário vira um **fragmento** em `changelog.d/` — arquivo `<tipo>-<slug>.md` (`tipo` = `adicionado`/`alterado`/`removido`, bullets planos; ver `changelog.d/README.md`). O número da versão é decidido **uma única vez**, na integração, por `npm run release`.
- **Ciclo de entrega:** (1) fazer as alterações de código no worktree da feature; (2) se envolver UI, mockup HTML **aprovado** antes de implementar — aprovado = o usuário respondeu confirmando o mockup nesta sessão; silêncio não é aprovação, e só mudança trivial (texto, reordenar elementos existentes com classes do catálogo) dispensa mockup; (3) rodar a suíte completa (`npm test`) e só seguir com tudo verde; (4) criar/atualizar o(s) fragmento(s) em `changelog.d/` e mostrar ao usuário essa revisão (Adicionado/Alterado/Removido) — a integração fica **bloqueada até a confirmação literal do usuário**; subagentes param aqui e reportam ao orquestrador; (5) **integração no branch `main`** (uma vez): merge da feature em `main`, depois `npm run release -- <patch|minor|major>` — que monta a seção no `CHANGELOG.md`, apaga os fragmentos, bumpa `package.json` e cria commit + tag; (6) `git push origin main`; (7) `npm run deploy` — o guard `predeploy` checa sozinho branch, working tree, ancestralidade dos commits `chore(release)` de outros branches e HEAD = `origin/main`. Se ele abortar, **pare e reconcilie** (merge + renumeração) em vez de forçar: deploy de branch desatualizado já regrediu o site publicado três vezes. O `CHANGELOG.md` já sai atualizado pelo release **antes** do deploy — a tela de Ajustes (`src/ui/ajustes/Versao.tsx`) lê o `CHANGELOG.md` do build, então a versão exibida fica sempre em dia.

## Regras de dados (`src/db/`, `src/backup/`)

Erro aqui custa dados financeiros do usuário — que não têm servidor nem cópia automática:

- Nova `this.version(n)` no Dexie exige, no mesmo commit, teste do caminho de upgrade: popular dados no schema n−1 e abrir no schema n.
- Mudança em `src/backup/` exige testes adversariais (JSON malformado, campos ausentes, `config` nulo, `alteradoEm` no futuro). **Nunca relaxe `validarBackup`** — a validação de import só endurece, nunca afrouxa.
