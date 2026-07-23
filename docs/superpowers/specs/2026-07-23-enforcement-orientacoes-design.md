# Enforcement automático das orientações — design

Status: aprovada em 2026-07-23 — implementada por completo no mesmo dia (B1/B2/B3 no branch enforcement-orientacoes; D e CI no branch enforcement-fase2, aprovados pelo usuário). Pendência de acompanhamento: sanear o catálogo e promover verificar-catalogo.mjs a bloqueio (item 2 do TODO local).
Data: 2026-07-23
Origem: `docs/auditoria-orientacoes-2026-07-23.md` (IDs citados abaixo)

## Problema

A auditoria de 2026-07-23 mostrou que quase todas as regras do repositório dependem só de
disciplina do agente. Os pontos de custo mais alto — release, deploy, catálogo de estilo —
já falharam na prática (três incidentes de deploy regredindo o site; dois branches
cunhando `v0.10.0` independentemente). Esta spec define os guards automáticos, em ordem de
retorno por esforço. Implementação em sessão futura (não-Fable), cada pacote como um
branch/fragmento próprio.

Restrição transversal: **nenhum guard novo pode ser afrouxado ou removido sem pedido
explícito do usuário** (regra já registrada no CLAUDE.md — os scripts desta spec são
mudança de processo, não manutenção).

## Pacote B1 — Guards no `scripts/release.mjs` (auditoria 3.1, 3.2, 3.3, 1.3)

Todos os checks abaixo rodam **antes de escrever qualquer arquivo** (hoje o script escreve
CHANGELOG/package.json e apaga fragmentos antes do primeiro comando git — uma falha na tag
deixa estado meio-feito). Ordem: validar tudo → só então escrever → só então git.

1. **Branch:** `git rev-parse --abbrev-ref HEAD` ≠ `main` → abortar
   (`release: rode na main — branches de feature não fazem release`). Pular com
   `RELEASE_DRY_RUN=1` (permite testar de qualquer branch).
2. **Working tree:** `git status --porcelain` com qualquer entrada fora de
   `CHANGELOG.md`, `package.json`, `changelog.d/*` → abortar (tree sujo).
3. **Tag:** `git tag -l vX.Y.Z` não vazio → abortar (a versão calculada já existe — outro
   branch fez release; reconcilie primeiro).
4. **Fragmento vazio:** corpo sem nenhuma linha útil → abortar nomeando o arquivo (hoje:
   `continue` silencioso + o arquivo é apagado mesmo assim).
5. **Formato do bullet:** cada linha útil deve casar `/^- /`, sem `**` e sem indentação
   inicial → abortar apontando `changelog.d/README.md` (hoje: markdown rico passa e quebra
   o parser do app com os fragmentos já apagados).
6. **Nenhum item resultante** após os filtros → abortar (impede seção de versão vazia).
7. **Testes (opcional, decidir na implementação):** rodar `npm test` antes do commit;
   se lento demais no fluxo, deixar só como passo documentado do ciclo (já registrado).

Aceite: com `RELEASE_DRY_RUN=1`, cada caso acima tem um teste (novo
`scripts/release.test.mjs` ou casos vitest chamando o script num diretório temporário):
- fragmento vazio → exit 1, nada escrito, fragmento preservado;
- fragmento com `**bold**`, linha indentada, ou linha sem `- ` → exit 1 citando o README;
- todos os fragmentos válidos → CHANGELOG novo bate com o esperado byte a byte (CRLF e LF).
Casos git (branch/tag/tree) testáveis com um repo temporário de fixture.

## Pacote B2 — Guard de deploy (auditoria 1.8; lições 6/8 das memórias)

Novo `scripts/predeploy.mjs`, chamado pelo script npm `predeploy` (antes do build).
Aborta se:

1. Branch atual ≠ `main`.
2. `git status --porcelain` não vazio.
3. `git log --all --grep="chore(release)" --format=%H` contém commit que não é ancestral
   do HEAD (`git merge-base --is-ancestor`) — é a checagem que as memórias de lições já
   exigem manualmente antes de todo deploy, e que falhou 3 vezes por depender de memória.
4. HEAD não está pushado (`git rev-parse origin/main` não é ancestral… ou simplesmente
   HEAD ≠ `origin/main` após `git fetch` — decidir custo/benefício do fetch na
   implementação; sem rede, avisar e seguir).

Escape explícito: `DEPLOY_FORCE=1` pula os checks imprimindo aviso — para o caso raro de
recuperação manual (ex.: republicar após reconciliação), e só quando o usuário pedir.
`deploy.bat` não muda (chama `npm run deploy`, que herda o guard).

Aceite: deploy de branch de feature → aborta; deploy da main com release de sibling não
mesclado → aborta citando o commit; main limpa e atualizada → passa.

## Pacote B3 — `scripts/verificar-catalogo.mjs` (auditoria 2.3)

Compara:
- seletores de classe de primeiro nível em `src/styles.css` (regex `^\.([a-z][a-z0-9-]*)`)
  × primeira coluna da tabela de `docs/estilo/catalogo.md`;
- arquivos `src/ui/*.tsx` exportando componente (exceto `Tela*.tsx`, testes)
  × bullets da seção de componentes do catálogo.

Saída: lista de "existe no código, falta no catálogo" e "está no catálogo, sumiu do
código". Chamado pelo `release.mjs` (aviso, não bloqueio, na primeira versão — o catálogo
atual pode já ter divergências acumuladas; promover a bloqueio depois de zerado).
Tolerâncias (classes utilitárias internas deliberadamente fora do catálogo) via lista de
exceções no topo do próprio script.

Aceite: rodar contra o repo atual e revisar o resultado com o usuário antes de acorrentar
ao release.

## Pacote D — Hooks do Claude Code (opcional, decidir com o usuário)

Em `.claude/settings.json` (versionado; mexer nele já exige pedido explícito):

1. **PreToolUse (Edit|Write) em `src/ui/**`, `src/styles.css`, `index.html`** → injeta
   lembrete: "Edição de UI: já consultou docs/estilo-visual.md e o capítulo do nível?"
   (auditoria 1.1). Não bloqueia; só torna o desvio consciente.
2. **PreToolUse (Bash) em `npm install`/`npm i`/`npm add`** → lembrete da regra de
   dependência (auditoria 1.6). Não bloqueia.
3. **PreToolUse (Bash) em `git commit`** → varredura leve dos arquivos staged por padrões
   de dado real (valores monetários grandes repetidos, nomes próprios conhecidos do
   usuário — lista privada fora do repo, ex.: `~/.claude/flow-dados-reais.txt`), avisa e
   pede confirmação (auditoria 1.2). Cuidado com falso positivo: começar só avisando.

## Pacote CI — GitHub Actions mínimo (decisão do usuário)

`.github/workflows/ci.yml`: em push/PR para `main`, rodar `npm ci`, `npm test`,
`npm run build`. Único efeito: sinal visível de quebra — nada hoje roda testes fora da
máquina local. Custo: expor Actions no repo público (grátis para repo público). Se o
usuário não quiser CI, os pacotes B1/B2 já cobrem os pontos de maior risco localmente.

## Fora de escopo desta spec (registrado na auditoria)

- Endurecer `validarBackup` (validação profunda por registro, rejeitar `config` nulo,
  tratar `alteradoEm` futuro no merge) — auditoria 2.5; é mudança de código do app, deve
  nascer de spec própria com testes adversariais.
- Formalizar `Status: aprovada em <data>` nas specs novas — já é regra de doc
  (nivel-6), sem automação por ora.

## Ordem sugerida de implementação

B1 (maior risco já materializado) → B2 → B3 → D/CI conforme decisão do usuário.
