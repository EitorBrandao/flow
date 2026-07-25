# Hooks do Claude Code neste repositório

Quatro hooks `PreToolUse`, registrados em `.claude/settings.json` (versionado). **Nenhum deles
bloqueia**: todos terminam com `exit 0` e só imprimem um lembrete. São rede contra
esquecimento, não guarda — o que bloqueia de verdade está em `scripts/` e no CI (ver
"Guardas automáticas" no `CLAUDE.md`).

| Hook | Dispara em | O que faz |
|---|---|---|
| `lembrete-ui.mjs` | `Edit`/`Write` em `src/ui/`, `src/styles.css` ou `index.html`, **exceto** `*.test.tsx`/`*.test.ts` | lembra de consultar `docs/estilo-visual.md`; dedupe por sessão **e por arquivo** (marcador no tmpdir) |
| `lembrete-main.mjs` | `Edit`/`Write` em arquivo **versionado** com o checkout na `main` | lembra de criar worktree + branch antes; arquivo gitignored (ex.: `TODO.md`) não conta; dedupe por sessão |
| `lembrete-deps.mjs` | `Bash` com `npm install`, `npm i ` ou `npm add` (não `uninstall`) | lembra que dependência nova é decisão de produto: confirmar com o usuário, justificar por que código próprio não basta, `npm audit`, lockfile no mesmo commit |
| `scan-dados-reais.mjs` | `Bash` com `git commit` | varre `git diff --cached -U0` procurando dados financeiros reais; avisa citando o arquivo e **o termo da lista** que casou, nunca o trecho do diff — ou seja, os termos da lista aparecem no contexto da sessão |

O comportamento dos quatro é coberto por testes em `scripts/hooks.test.mjs`, que roda junto com
`npm test`.

## O filtro `if` do `settings.json` é otimização, não proteção

Os hooks de `Bash` são registrados com `"if": "Bash(npm install*)"` e afins. O campo existe e
funciona (filtra pelo conteúdo do comando, com a sintaxe das regras de permissão), mas serve
para **não subir um `node` à toa** — quem decide se o hook age é a guarda de comando dentro do
próprio script. Assim, mexer no `settings.json` não muda silenciosamente o que um hook faz, e
o teste do script cobre a decisão inteira.

Os testes de `settings.json` em `scripts/hooks.test.mjs` conferem a **forma** do arquivo (JSON
válido, matchers presentes, filtros `if` presentes) — eles não provam que o Claude Code está
roteando, o que só se verifica na prática, editando um arquivo e vendo o aviso aparecer.

## Cobertura do `scan-dados-reais.mjs` é só o diff

Ele varre `git diff --cached`: a mudança que está entrando agora, nunca o que já está no
repositório. Para o histórico existe `scripts/verificar-dados-reais.mjs`, que varre todos os
arquivos versionados — os dois lêem a mesma lista privada.

## O `scan-dados-reais.mjs` depende de um arquivo local

Ele lê os termos a procurar de `~/.claude/flow-dados-reais.txt` — um arquivo **fora do
repositório**, porque a lista em si é dado sensível (nomes de estabelecimentos, descrições,
valores reais). Sem esse arquivo o hook sai em silêncio, procurando nada.

O arquivo foi criado nesta máquina em 2026-07-25, a partir da planilha local do usuário e
calibrado contra o repositório inteiro até zerar os falsos positivos. Ele **não** viaja com o
repositório: num clone novo, noutra máquina ou no CI, o hook volta a ficar inerte e a regra
"nunca commitar dados financeiros reais" do `CLAUDE.md` vale só por disciplina.

Formato: um termo (ou regex JS) por linha; linhas vazias e linhas começando com `#` são
ignoradas; regex inválida é ignorada em silêncio. Ao acrescentar um termo, rode
`node scripts/verificar-dados-reais.mjs` no repositório: termo genérico demais (uma palavra
comum, um cabeçalho de planilha) casa com conteúdo sintético legítimo e vira falso positivo
que **bloqueia o release** — desde 2026-07-25 o `release.mjs` chama o verificador com
`--strict`.
