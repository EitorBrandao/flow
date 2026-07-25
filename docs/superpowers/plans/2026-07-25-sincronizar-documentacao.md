# Sincronizar a documentação com o repositório — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir a documentação que hoje contradiz o código, documentar as guardas automáticas que existem mas ninguém registrou, carimbar os documentos históricos que envelheceram e dar uma porta de entrada ao repositório público.

**Architecture:** cinco tarefas independentes, todas em arquivos de texto (`.md`). Nenhum arquivo de `src/` é tocado, nenhuma dependência é instalada, nenhum script de build/release muda. Cada tarefa termina com uma verificação mecânica (`grep`) que prova o resultado, e um commit próprio.

**Tech Stack:** markdown. As verificações usam `grep`, `node scripts/verificar-catalogo.mjs` e `npm test` (só na verificação final, feita pelo orquestrador).

## Global Constraints

- **Idioma:** todo texto novo em **português**, incluindo comentários e títulos.
- **Nenhum dado financeiro real** em nenhum arquivo — o repositório e o site são públicos. Exemplos, se houver, são sintéticos.
- **Não editar** `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, nem qualquer arquivo em `src/`. Este plano é só documentação.
- **Exceção autorizada nesta sessão:** criar `.claude/hooks/README.md` (Task 4). `.claude/` normalmente só muda a pedido do usuário — este pedido existe e está registrado aqui.
- **Sem fragmento em `changelog.d/`:** doc e tooling não são visíveis ao usuário (ver `changelog.d/README.md`). Nenhuma tarefa cria fragmento.
- **Branch:** todo o trabalho acontece no worktree `.worktrees/sincronizar-documentacao` (branch `sincronizar-documentacao`). Nunca commitar na `main`.
- **Um commit por tarefa**, mensagem em português, sem o prefixo `chore(release):` (reservado a commits gerados por `npm run release`).
- **Não invente conteúdo:** todo texto de substituição está escrito abaixo, literal. Se um `old_string` não bater exatamente com o arquivo, **pare e reporte** em vez de improvisar uma variação.

---

### Task 1: `CLAUDE.md` — arquitetura e domínio

O `CLAUDE.md` descreve um domínio que mudou: cita um valor de `origem` que não existe mais, omite três entidades e dois módulos, lista as telas de forma incompleta e aponta para um `TODO.md` que nunca existe num clone.

**Files:**
- Modify: `CLAUDE.md` (seção "Arquitetura", bullets de `src/domain/` e `src/ui/`; parágrafo "Convenções do domínio"; bullet de specs em "Regras do repositório")

**Interfaces:**
- Consumes: nada.
- Produces: nada consumido por outras tarefas. Task 2 edita o mesmo arquivo em seções diferentes — se as duas rodarem em sequência no mesmo worktree, não há conflito de texto.

- [ ] **Step 1: Confirmar o estado atual (o que justifica a mudança)**

Rode, do diretório do worktree:

```bash
grep -n "'import'" src/domain/types.ts CLAUDE.md
grep -n "^export interface" src/domain/types.ts
```

Esperado: `src/domain/types.ts` **não** contém `'import'` (só `CLAUDE.md` contém); a lista de `export interface` inclui `CategoriaCartao`, `RecorrenciaCartao` e `Viagem`. Se `types.ts` contiver `'import'`, **pare e reporte**: a premissa do plano mudou.

- [ ] **Step 2: Corrigir a descrição de `src/domain/`**

Em `CLAUDE.md`, substitua exatamente esta linha:

```
- **`src/domain/`** — lógica pura, sem IO. `types.ts` define as entidades (Box, Categoria, Lancamento, Recorrencia, Cartao, CompraCartao, ConferenciaFatura, Cenario, Config). `projection.ts` (`projetarBoxes`) calcula o saldo dia a dia até `config.horizonteProjecao`. `recurrence.ts` materializa recorrências em lançamentos `previsto`. `fatura.ts` calcula ciclos de fechamento/vencimento do cartão e gera as faturas. `aggregations.ts` alimenta a aba Análises. `money.ts`/`dates.ts` são os únicos lugares de parse/format.
```

por:

```
- **`src/domain/`** — lógica pura, sem IO. `types.ts` define as entidades (Box, Categoria, Lancamento, Recorrencia, Cartao, CategoriaCartao, CompraCartao, RecorrenciaCartao, ConferenciaFatura, Cenario, Viagem, Config) e o snapshot `Dados`, que agrega todas elas. `projection.ts` (`projetarBoxes`) calcula o saldo dia a dia até `config.horizonteProjecao`. `recurrence.ts` materializa recorrências em lançamentos `previsto`. `fatura.ts` calcula ciclos de fechamento/vencimento do cartão e gera as faturas. `aggregations.ts` alimenta a aba Análises. `categorias.ts` guarda a ordenação e a numeração de ordem das categorias (`compararCategorias`, `diffOrdem`, `proximaOrdem`); `viagem.ts` resolve a viagem ativa numa data e agrega os itens de uma viagem (`viagemAtivaEm`, `itensDaViagem`). `money.ts`/`dates.ts` são os únicos lugares de parse/format.
```

- [ ] **Step 3: Corrigir a lista de telas**

Substitua exatamente esta linha:

```
- **`src/ui/`** — uma `Tela*.tsx` por aba (Hoje, Fluxo, Cartão, Análises, Ajustes...), `Shell.tsx` é a navegação. Sheets/modais compartilhados (`Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`).
```

por:

```
- **`src/ui/`** — uma `Tela*.tsx` por tela: `TelaHoje`, `TelaFluxo`, `TelaLancar`, `TelaCartao`, `TelaAnalises`, `TelaAjustes` e `TelaSimulador` (esta última existe mas está fora da navegação — ver `ABAS` em `Shell.tsx`). `Shell.tsx` é a navegação; Ajustes é uma tela-menu com dez subtelas em `src/ui/ajustes/`. Sheets/modais compartilhados (`Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`).
```

- [ ] **Step 4: Remover o valor de `origem` que não existe mais**

No parágrafo "Convenções do domínio", substitua exatamente:

```
Lançamentos têm `status` (`efetivo`/`previsto`) e `origem` (`manual`/`recorrencia`/`import`/`cartao`).
```

por:

```
Lançamentos têm `status` (`efetivo`/`previsto`) e `origem` (`manual`/`recorrencia`/`cartao` — `OrigemLancamento` em `src/domain/types.ts`; o antigo `import` saiu junto com a importação de xlsx).
```

- [ ] **Step 5: Dizer que o `TODO.md` é local**

Em "Regras do repositório", substitua exatamente:

```
- Specs e planos de features ficam em `docs/superpowers/specs/` e `docs/superpowers/plans/`; o backlog com contexto e decisões em aberto está em `TODO.md`.
```

por:

```
- Specs e planos de features ficam em `docs/superpowers/specs/` e `docs/superpowers/plans/`. O backlog com contexto e decisões em aberto está em `TODO.md`, que é **local e fora do git de propósito** (está no `.gitignore`): num clone limpo, no CI ou num worktree novo ele não existe, e isso é esperado — peça o conteúdo ao usuário em vez de recriá-lo.
```

- [ ] **Step 6: Verificar mecanicamente**

```bash
grep -c "'import'" CLAUDE.md
grep -c "CategoriaCartao\|RecorrenciaCartao\|Viagem" CLAUDE.md
grep -n "TelaSimulador\|local e fora do git" CLAUDE.md
```

Esperado: o primeiro comando imprime `0`; o segundo imprime um número ≥ 3; o terceiro mostra as duas linhas novas. Se o primeiro não for `0`, a substituição do Step 4 não pegou.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: sincroniza a descricao de dominio e telas do CLAUDE.md com o codigo"
```

---

### Task 2: `CLAUDE.md` — guardas automáticas e ciclo de entrega

Existem quatro guardas bloqueantes e três hooks no repositório, e o `CLAUDE.md` não menciona nenhum. O efeito prático: o passo (7) do ciclo manda fazer à mão uma checagem que o `predeploy` já faz sozinho, a válvula de escape `DEPLOY_FORCE=1` não está documentada em lugar nenhum, e o prefixo `chore(release):` — pelo qual o guard identifica releases — não está reservado por escrito.

**Files:**
- Modify: `CLAUDE.md` (nova seção "Guardas automáticas" logo após o bloco de comandos; passo (7) do "Ciclo de entrega")

**Interfaces:**
- Consumes: nada. Pode rodar antes ou depois da Task 1 — as seções não se sobrepõem.
- Produces: a seção "Guardas automáticas", referenciada por `.claude/hooks/README.md` (Task 4).

- [ ] **Step 1: Confirmar que as guardas existem e o doc não as cita**

```bash
grep -c "predeploy\|verificar-catalogo\|DEPLOY_FORCE" CLAUDE.md
ls scripts/predeploy.mjs scripts/verificar-catalogo.mjs .github/workflows/ci.yml
```

Esperado: o `grep` imprime `0`; o `ls` lista os três arquivos. Se o `grep` não for `0`, alguém já documentou parte disso — **pare e reporte**.

- [ ] **Step 2: Inserir a seção "Guardas automáticas"**

No `CLAUDE.md`, logo **depois** do parágrafo que começa com `Testes usam jsdom + fake-indexeddb` (o último da seção "Comandos") e **antes** da linha `## Arquitetura`, insira este texto (deixando uma linha em branco antes e depois):

```markdown
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
- **O prefixo `chore(release):` é reservado** aos commits gerados por `npm run release`: o
  guard do deploy identifica releases por esse prefixo, e um commit comum com ele num branch
  lateral provoca aborto falso do deploy.
```

- [ ] **Step 3: Reescrever o passo (7) do ciclo de entrega**

No bullet "Ciclo de entrega", substitua exatamente este trecho:

```
(7) **imediatamente antes do deploy, rode `git log --all --oneline --grep="chore(release)"`** — release commit fora da ancestralidade do seu HEAD = pare e reconcilie (merge + renumeração) antes de publicar; deploy de branch desatualizado já regrediu o site publicado três vezes; (8) só então `npm run deploy`.
```

por:

```
(7) `npm run deploy` — o guard `predeploy` checa sozinho branch, working tree, ancestralidade dos commits `chore(release)` de outros branches e HEAD = `origin/main`. Se ele abortar, **pare e reconcilie** (merge + renumeração) em vez de forçar: deploy de branch desatualizado já regrediu o site publicado três vezes.
```

- [ ] **Step 4: Verificar mecanicamente**

```bash
grep -n "Guardas automáticas" CLAUDE.md
grep -c "DEPLOY_FORCE" CLAUDE.md
grep -c "git log --all --oneline" CLAUDE.md
```

Esperado: a seção aparece uma vez; `DEPLOY_FORCE` aparece ao menos 1 vez; o `git log --all --oneline` manual imprime `0`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta as guardas automaticas e simplifica o passo de deploy"
```

---

### Task 3: Catálogo × telas e a regra de precedência num lugar só

Duas inconsistências pequenas do guia de estilo. (a) `catalogo.md` afirma que "tela nova (nível 5)" entra no catálogo — nenhuma das telas está lá, e o verificador ignora `Tela*` de propósito: a regra existe e é universalmente descumprida. (b) A regra "se código e guia divergirem" está escrita duas vezes, com redações diferentes, no `CLAUDE.md` e no `docs/estilo-visual.md` — duplicação garante divergência futura.

**Files:**
- Modify: `docs/estilo/catalogo.md:4-6` (parágrafo "Quem cria, cataloga")
- Modify: `docs/estilo-visual.md:3-8` (parágrafo de abertura)

**Interfaces:**
- Consumes: nada. Independente das Tasks 1, 2, 4 e 5.
- Produces: nada.

- [ ] **Step 1: Confirmar que nenhuma tela está catalogada**

```bash
grep -c "TelaHoje\|TelaFluxo\|TelaAnalises" docs/estilo/catalogo.md
node scripts/verificar-catalogo.mjs
```

Esperado: `0` telas catalogadas e `✓ Catálogo e código em dia.` Se o verificador acusar divergência, **pare e reporte** — não é este plano que resolve.

- [ ] **Step 2: Corrigir a promessa do catálogo**

Em `docs/estilo/catalogo.md`, substitua exatamente:

```
**Quem cria, cataloga:** classe compartilhada nova (nível 2), componente novo (nível 4) ou
tela nova (nível 5) entram aqui **no mesmo commit** que os cria.
```

por:

```
**Quem cria, cataloga:** classe compartilhada nova (nível 2) e componente novo (nível 4)
entram aqui **no mesmo commit** que os criam. Telas não entram: `Tela*.tsx` e
`src/ui/ajustes/*.tsx` se registram na navegação (`Shell.tsx`, `TelaAjustes.tsx`), e o
verificador de catálogo as ignora de propósito.
```

- [ ] **Step 3: Deixar a regra de precedência num lugar só**

Em `docs/estilo-visual.md`, substitua exatamente este parágrafo:

```
**Consulte este índice antes de QUALQUER edição de UI.** Ele leva ao capítulo do seu nível
de edição em `docs/estilo/` — leia o capítulo indicado (são curtos) antes de escrever
código. Se código e guia divergirem, o código manda **apenas quando a divergência já
existia antes de você chegar** — atualize o guia junto com a mudança. Divergência que a
sua própria edição criaria não é divergência: é uma mudança do nível correspondente
(valor de token ou princípio = nível 6). Esta regra nunca legitima uma mudança sua.
```

por:

```
**Consulte este índice antes de QUALQUER edição de UI.** Ele leva ao capítulo do seu nível
de edição em `docs/estilo/` — leia o capítulo indicado (são curtos) antes de escrever
código.

Achou o guia divergindo do código? A regra de precedência é **única** e vive no `CLAUDE.md`
(primeiro bullet de "Regras do repositório") — leia lá antes de "corrigir" o guia. Em uma
linha: ela vale para divergências que você **encontrou**, nunca para legitimar uma que a
sua própria mudança criaria.
```

- [ ] **Step 4: Verificar mecanicamente**

```bash
grep -c "tela nova (nível 5) entram aqui" docs/estilo/catalogo.md
grep -c "o código manda" docs/estilo-visual.md
grep -c "o código manda" CLAUDE.md
node scripts/verificar-catalogo.mjs
```

Esperado: `0`, `0`, `1` (a regra sobrou só no `CLAUDE.md`) e `✓ Catálogo e código em dia.`

- [ ] **Step 5: Commit**

```bash
git add docs/estilo/catalogo.md docs/estilo-visual.md
git commit -m "docs(estilo): telas fora do catalogo e regra de precedencia num lugar so"
```

---

### Task 4: Carimbar os documentos históricos e documentar os hooks

`docs/auditoria-orientacoes-2026-07-23.md` afirma hoje que "não existem hooks, CI, eslint, prettier nem husky" e que a automação fica "para sessão futura" — as duas coisas ficaram falsas no mesmo dia em que o documento foi escrito. A spec de enforcement ainda declara uma pendência que foi resolvida. E os três hooks versionados em `.claude/hooks/` não são documentados em lugar nenhum — inclusive o `scan-dados-reais.mjs`, que está **inerte** por falta de um arquivo local.

**Files:**
- Modify: `docs/auditoria-orientacoes-2026-07-23.md` (bloco de status logo após o título)
- Modify: `docs/superpowers/specs/2026-07-23-enforcement-orientacoes-design.md:3` (linha `Status:`)
- Create: `.claude/hooks/README.md`

**Interfaces:**
- Consumes: a seção "Guardas automáticas" do `CLAUDE.md` (Task 2) — o `README` dos hooks aponta para ela. Se a Task 2 ainda não rodou, crie o arquivo mesmo assim: o ponteiro passa a valer quando ela rodar.
- Produces: `.claude/hooks/README.md`, referenciado pela tabela da Task 2.

- [ ] **Step 1: Confirmar o estado dos fatos citados**

```bash
git log --oneline -1 c8b990e
git log --oneline -1 b1ed6a7
ls ~/.claude/flow-dados-reais.txt
```

Esperado: os dois commits existem (`docs(estilo): sanear catalogo...` e `chore(release): torna o verificador de catalogo bloqueante`); o `ls` **falha** com "No such file or directory" — é isso que prova que o hook está inerte. Se o arquivo existir, ajuste o texto do Step 4 para dizer que o scan está ativo e reporte a diferença.

- [ ] **Step 2: Carimbar a auditoria**

Em `docs/auditoria-orientacoes-2026-07-23.md`, logo **abaixo** da linha do título `# Auditoria de loopholes nos documentos de orientação — 2026-07-23` e **antes** do parágrafo que começa com `Leitura adversarial`, insira (com uma linha em branco antes e depois):

```markdown
> **Documento histórico — fechado em 2026-07-25.** Descreve o repositório como ele estava
> em 2026-07-23. **O diagnóstico estrutural abaixo está vencido:** onde ele diz "não existem
> hooks, CI, eslint, prettier nem husky", hoje existem CI (`.github/workflows/ci.yml`),
> guards bloqueantes em `scripts/release.mjs` e `scripts/predeploy.mjs`, o verificador de
> catálogo e três hooks em `.claude/hooks/` (ver a seção "Guardas automáticas" do
> `CLAUDE.md`).
>
> **Situação dos achados:** as correções de redação (1.1–1.8, 2.1, 2.2, 2.4–2.6, 3.4, 3.5,
> 5.1, 5.2) estão aplicadas no `CLAUDE.md` e no guia de estilo; as correções de memória
> (4.1–4.6) foram aplicadas fora do repositório; a automação (1.3, 1.8, 2.3, 3.1–3.3) foi
> implementada pela spec
> [`2026-07-23-enforcement-orientacoes-design.md`](superpowers/specs/2026-07-23-enforcement-orientacoes-design.md).
>
> **Continua aberto:** o achado 1.2 depende do hook `scan-dados-reais.mjs`, que só age se
> existir `~/.claude/flow-dados-reais.txt` na máquina do usuário. O arquivo não existe — a
> varredura de dados reais está **inerte**. Ver [`.claude/hooks/README.md`](../.claude/hooks/README.md).
```

- [ ] **Step 3: Atualizar o status da spec de enforcement**

Em `docs/superpowers/specs/2026-07-23-enforcement-orientacoes-design.md`, substitua exatamente:

```
Pendência de acompanhamento: sanear o catálogo e promover verificar-catalogo.mjs a bloqueio (item 2 do TODO local).
```

por:

```
Pendência de acompanhamento **resolvida em 2026-07-23**: catálogo saneado (`c8b990e`) e `verificar-catalogo.mjs` promovido a guard bloqueante do release (`b1ed6a7`). Nenhuma pendência aberta.
```

Se a linha do arquivo diferir em pontuação, use como `old_string` só a frase `Pendência de acompanhamento:` até o fim da linha, preservando o que vem antes.

- [ ] **Step 4: Criar `.claude/hooks/README.md`**

Crie o arquivo com exatamente este conteúdo:

```markdown
# Hooks do Claude Code neste repositório

Três hooks `PreToolUse`, registrados em `.claude/settings.json` (versionado). **Nenhum deles
bloqueia**: todos terminam com `exit 0` e só imprimem um lembrete. São rede contra
esquecimento, não guarda — o que bloqueia de verdade está em `scripts/` e no CI (ver
"Guardas automáticas" no `CLAUDE.md`).

| Hook | Dispara em | O que faz |
|---|---|---|
| `lembrete-ui.mjs` | `Edit`/`Write` em `src/ui/`, `src/styles.css` ou `index.html` | lembra de consultar `docs/estilo-visual.md`; dedupe por sessão (marcador no tmpdir), uma vez por sessão |
| `lembrete-deps.mjs` | `Bash` com `npm install`, `npm i ` ou `npm add` (não `uninstall`) | lembra que dependência nova é decisão de produto: confirmar com o usuário, justificar por que código próprio não basta, `npm audit`, lockfile no mesmo commit |
| `scan-dados-reais.mjs` | `Bash` com `git commit` | varre `git diff --cached` procurando dados financeiros reais e avisa **sem nunca ecoar o trecho encontrado** |

O comportamento dos três é coberto por testes em `scripts/hooks.test.mjs`, que roda junto com
`npm test`.

## O `scan-dados-reais.mjs` está inerte por padrão

Ele lê os termos a procurar de `~/.claude/flow-dados-reais.txt` — um arquivo **fora do
repositório**, porque a lista em si é dado sensível (nomes de estabelecimentos, descrições,
valores reais). Sem esse arquivo o hook sai em silêncio: hoje, nesta máquina, **ele não está
procurando nada**.

Para ativar, crie o arquivo com um termo por linha; linhas vazias e linhas começando com `#`
são ignoradas. Ele nunca é lido por nada além do hook local e nunca entra no repositório.

Enquanto o arquivo não existir, a regra "nunca commitar dados financeiros reais" do
`CLAUDE.md` continua valendo por disciplina, sem rede de segurança.
```

- [ ] **Step 5: Verificar mecanicamente**

```bash
grep -c "Documento histórico — fechado em 2026-07-25" docs/auditoria-orientacoes-2026-07-23.md
grep -c "Nenhuma pendência aberta" docs/superpowers/specs/2026-07-23-enforcement-orientacoes-design.md
grep -c "inerte" .claude/hooks/README.md
```

Esperado: `1`, `1` e um número ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add docs/auditoria-orientacoes-2026-07-23.md docs/superpowers/specs/2026-07-23-enforcement-orientacoes-design.md .claude/hooks/README.md
git commit -m "docs: carimba auditoria e spec de enforcement, documenta os hooks"
```

---

### Task 5: `README.md`

O repositório é público, o site é público, e não existe porta de entrada: nem o que o app é, nem o link do app, nem o aviso de que os dados vivem só no navegador — que é a informação mais importante de um app local-first sem servidor.

**Files:**
- Create: `README.md` (raiz do repositório)

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Confirmar que não existe README**

```bash
ls README.md
```

Esperado: falha com "No such file or directory". Se existir, **pare e reporte**.

- [ ] **Step 2: Criar o `README.md`**

Crie o arquivo com exatamente este conteúdo:

````markdown
# Flow

App de controle financeiro pessoal: fluxo de caixa diário com saldo projetado. PWA
local-first — **não existe servidor**, todos os dados vivem no IndexedDB do seu navegador.

**[→ Abrir o app](https://eitorbrandao.github.io/flow/)**

## O que ele faz

- **Hoje** — saldo atual, entradas e saídas do dia, projeção dos próximos dias.
- **Fluxo** — lançamentos dia a dia com saldo projetado até o horizonte configurado, em lista e em gráfico.
- **Lançar** — ganhos e gastos manuais, e compras no cartão (à vista ou parceladas).
- **Cartão** — faturas por ciclo de fechamento/vencimento, assinaturas e conferência.
- **Análises** — composição por categoria, evolução mensal, comparativo e viagens.
- **Ajustes** — boxes, categorias, recorrências, cartões, viagens, backup, wiki e versão.

Boxes são contas ou perfis separados; o chip do topo escolhe qual box o app inteiro enxerga.

## Seus dados ficam só no seu navegador

Não há conta, login nem sincronização. Isso significa que **limpar os dados do site, trocar
de aparelho ou desinstalar o PWA apaga tudo**. Exporte um backup em
**Ajustes → Backup e restauração** com regularidade e guarde o arquivo fora do navegador.

## Rodar localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # suíte completa (vitest)
npm run build    # checagem de tipos + build de produção
```

Node 24 (a mesma versão do CI).

## Stack

React 18 + TypeScript + Vite · Zustand (estado) · Dexie/IndexedDB (persistência) · Recharts
(gráficos) · framer-motion (animação) · vite-plugin-pwa. Código, interface e documentação em
português.

## Documentação

- [`CLAUDE.md`](CLAUDE.md) — arquitetura, convenções e regras do repositório.
- [`docs/estilo-visual.md`](docs/estilo-visual.md) — guia de estilo da interface, indexado por nível de edição.
- [`CHANGELOG.md`](CHANGELOG.md) — histórico de versões (a mesma lista aparece em Ajustes → Versão).
````

Atenção: o bloco de conteúdo acima está cercado por quatro crases porque contém um bloco de código de três crases. O arquivo final começa em `# Flow` e termina na linha do `CHANGELOG.md` — **sem** as crases externas.

- [ ] **Step 3: Verificar mecanicamente**

```bash
grep -c "eitorbrandao.github.io/flow" README.md
grep -c "Backup e restauração" README.md
head -1 README.md
```

Esperado: `1`, `1`, e a primeira linha é exatamente `# Flow`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: adiciona README com o que e o Flow, link do app e aviso de dados locais"
```

---

## Verificação final (orquestrador, não subagente)

- [ ] **Nada em `src/`, `scripts/` ou config foi tocado:**

```bash
git diff --name-only main...HEAD
```

Esperado: só arquivos `.md` — `CLAUDE.md`, `README.md`, `docs/...`, `.claude/hooks/README.md` e este plano.

- [ ] **A suíte continua verde.** Um worktree recém-criado **não** tem `node_modules` (cada um tem o seu); rode `npm ci` antes, na primeira vez:

```bash
npm test
```

Esperado: todos os testes passando, mesmo número de antes (nenhum arquivo de código mudou).

- [ ] **O catálogo continua em dia:**

```bash
node scripts/verificar-catalogo.mjs
```

Esperado: `✓ Catálogo e código em dia.`

- [ ] **Nenhum dado financeiro real entrou:** revisar `git diff main...HEAD` procurando valores, saldos, nomes de estabelecimento ou descrições reais. Esperado: nenhum — todo o conteúdo é descritivo.

## Integração

Sem fragmento em `changelog.d/` e **sem release**: nada aqui é visível ao usuário do app, então não há versão nova nem deploy. A integração é o merge de `sincronizar-documentacao` em `main` e o push — **bloqueada até a confirmação literal do usuário**, conforme o ciclo de entrega do `CLAUDE.md`.
