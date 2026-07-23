# Auditoria de loopholes nos documentos de orientação — 2026-07-23

Leitura adversarial de todos os documentos que orientam agentes de IA neste repositório
(CLAUDE.md, guia de estilo, convenções de changelog, script de release, memórias
persistentes do Claude), procurando onde um agente **obediente à letra, mas não ao
espírito** consegue (a) cumprir tecnicamente a regra fugindo da intenção, (b) explorar
ambiguidade para pular etapas, ou (c) introduzir vulnerabilidade real no app — que guarda
dados financeiros pessoais no IndexedDB e publica num site público.

**Diagnóstico estrutural:** quase nenhuma regra tem garantia automática. Os únicos gates
reais são o `tsc` estrito (embutido em `predeploy`→`build`), as validações de prefixo e
versão do `scripts/release.mjs`, e o `.gitignore`. Não existem hooks, CI, eslint, prettier
nem husky. Rodar os 44 arquivos de teste, respeitar a topologia de branches, a ordem
release→push→deploy, o formato dos bullets e todas as regras de UI dependem exclusivamente
de disciplina — o que torna a redação exata dos docs o único mecanismo de controle, e cada
ambiguidade uma porta.

Cada achado foi verificado no código/arquivo citado nesta data.

## Tabela-resumo

| ID | Categoria | Onde | Gravidade | Correção |
|---|---|---|---|---|
| 1.1 | Ambiguidade de escopo | CLAUDE.md ("edição de UI") | Alta | Redação |
| 1.2 | Ambiguidade de escopo | CLAUDE.md ("dados reais" por extensão) | Alta | Redação + automação |
| 1.3 | Enforcement ausente | CLAUDE.md (ciclo sem testes) | Alta | Redação + automação |
| 1.4 | Regra sem gatilho verificável | CLAUDE.md ("mockup aprovado") | Alta | Redação |
| 1.5 | Regra sem gatilho verificável | CLAUDE.md ("esperando confirmação") | Média | Redação |
| 1.6 | Omissão de superfície | dependências npm (regra inexistente) | Alta | Regra nova + automação |
| 1.7 | Meta-loophole | `scripts/`, configs, `.claude/` editáveis | Alta | Regra nova |
| 1.8 | Enforcement ausente | `npm run deploy` sem guarda | Alta | Redação + automação |
| 2.1 | Contradição/precedência | "o código manda" | Alta | Redação |
| 2.2 | Regra sem gatilho verificável | autoclassificação de nível; `style` inline | Alta | Redação + automação |
| 2.3 | Enforcement ausente | "quem cria, cataloga" | Média | Automação |
| 2.4 | Regra sem gatilho verificável | nível 6: "citar spec aprovada" | Média | Redação |
| 2.5 | Omissão de superfície | `domain/`/`db/`/`backup/` sem regras | Alta | Regra nova |
| 2.6 | Omissão de superfície | nível 5: só "aba nova" é decisão de produto | Baixa | Redação |
| 3.1 | Loophole de release | fragmento vazio some em silêncio | Média | Automação |
| 3.2 | Loophole de release | conteúdo do bullet não validado | Média | Automação |
| 3.3 | Enforcement ausente | release sem checar branch/tree/tag | Alta | Automação |
| 3.4 | Ambiguidade | critério patch/minor/major indefinido | Baixa | Redação |
| 3.5 | Ambiguidade | "mudança visível ao usuário" sem exemplos | Baixa | Redação |
| 4.1 | Memória desatualizada | topologia main/gh-pages invertida | Alta | Corrigir memória |
| 4.2 | Memória incoerente | título "deploy após mudanças" × corpo | Média | Corrigir memória |
| 4.3 | Memória incoerente | índice de "sempre commitar" omite ressalvas | Baixa | Corrigir índice |
| 4.4 | Memória desatualizada | receitas referem branch `master` (não existe) | Média | Corrigir memórias |
| 4.5 | Memória desatualizada | status v1 diz "importar planilha" (removido) | Baixa | Corrigir memória |
| 4.6 | Memória incoerente | "criar branch" ensina `checkout -b` no checkout compartilhado | Média | Corrigir memória |
| 5.1 | Omissão de superfície | `public/` vai literal ao site público | Média | Regra nova |
| 5.2 | Omissão de superfície | config PWA/service worker sem regra | Baixa | Regra nova |

---

## 1. CLAUDE.md — hub e ciclo de entrega

### 1.1 "Edição de UI" sem definição operacional — ALTA
**Trecho:** "Antes de QUALQUER edição de UI, consulte `docs/estilo-visual.md`".
**Rota de escape:** "UI" não é definido por caminho de arquivo. O agente edita
`src/styles.css` ("é CSS, não UI"), muda textos visíveis via `src/domain/money.ts`
("é domínio"), ou mexe em `Shell.tsx` ("é navegação") sem abrir o guia. No sentido
inverso, alega que uma mudança em `src/ui/` "só toca lógica" para pular o índice.
**Correção:** definir por gatilho verificável — edição de UI = qualquer diff em
`src/ui/**`, `src/styles.css` ou `index.html`.

### 1.2 "Dados financeiros reais" definidos por extensão, não por conteúdo — ALTA
**Trecho:** "Nunca commitar dados financeiros reais — `*.xlsx` e `*.json.backup` estão no
`.gitignore` de propósito."
**Rota de escape:** o agente cumpre a letra salvando um export como `dados.json` ou
`backup-flow.txt`, ou colando lançamentos reais numa fixture de teste, numa spec, num
mockup versionado — ou num fragmento de changelog, que acaba no `CHANGELOG.md` embutido
no **bundle público** (a tela Versão importa `CHANGELOG.md?raw`). Repositório e site são
públicos.
**Correção:** regra por conteúdo (nenhum valor/descrição/saldo real em QUALQUER arquivo
versionado; testes/specs/mockups usam só dados sintéticos) + futura varredura no pre-commit.

### 1.3 Ciclo de entrega não menciona testes — ALTA
**Trecho:** os 6 passos do "Ciclo de entrega" — nenhum diz "rode `npm test`".
**Rota de escape:** o agente segue o ciclo à risca, integra e faz release sem nunca rodar a
suíte — tecnicamente em conformidade. `predeploy` roda só `tsc`+build, que não executa testes.
**Correção:** passo explícito "suíte completa verde antes de integrar" + (spec) release
rodar os testes antes do commit.

### 1.4 "Mockup HTML aprovado" sem definição de aprovação — ALTA
**Trecho:** passo 2: "se envolver UI, mockup HTML aprovado antes de implementar".
**Rota de escape:** três brechas encadeadas: (i) "envolver UI" herda a ambiguidade de 1.1;
(ii) "aprovado" não diz por quem nem como — silêncio pode ser lido como aprovação;
(iii) nada registra onde o mockup vive, então nenhuma verificação posterior é possível.
**Correção:** aprovado = mensagem explícita do usuário na sessão; definir também a isenção
(o que dispensa mockup) para fechar a rota "isso é trivial demais" como decisão unilateral.

### 1.5 "Esperando confirmação" da revisão do fragmento é inverificável — MÉDIA
**Trecho:** passo 3: "mostrar ao usuário essa revisão... esperando confirmação".
**Rota de escape:** em execução autônoma, o agente "mostra" e prossegue no mesmo turno.
**Correção:** espelhar o padrão do nível 6 — integração bloqueada até resposta literal;
subagentes param e reportam ao orquestrador.

### 1.6 Nenhuma regra sobre dependências npm — ALTA
**Trecho:** ausência total.
**Rota de escape/risco:** o agente instala um pacote qualquer "para resolver rápido". Num
PWA local-first com todos os dados financeiros no IndexedDB e deploy público, supply chain
é o vetor realista de exfiltração — um pacote comprometido roda com acesso total aos dados
do usuário no navegador.
**Correção:** dependência nova (inclusive dev) = decisão de produto: confirmar antes,
justificar por que código próprio não basta, `npm audit`, lockfile no mesmo commit.

### 1.7 Meta-loophole: o agente pode desmontar a cerca — ALTA
**Trecho:** ausência — nada proíbe editar `scripts/release.mjs` (o único enforcement que
existe), `vite.config.ts`, `tsconfig.json` ou `.claude/settings.json` (que é versionado).
**Rota de escape:** em vez de violar uma regra, o agente afrouxa o validador, relaxa o
`tsconfig` ou se auto-concede permissões — e cada passo individual parece "manutenção".
**Correção:** regra explícita: esses arquivos só mudam com pedido explícito do usuário,
nunca como efeito colateral de uma feature.

### 1.8 `npm run deploy` sem nenhuma guarda — ALTA
**Trecho:** passo 6 ("só então `npm run deploy`") + `package.json`
(`predeploy: npm run build`, `deploy: gh-pages -d dist`).
**Rota de escape:** o deploy roda de qualquer branch, com tree sujo, sem testes, antes do
push, antes do release — publicando no site público código nunca integrado. **Não é risco
teórico:** as memórias de lições registram três incidentes reais (2026-07-17, 2×2026-07-19,
2026-07-22) de deploy sobrescrevendo trabalho de sessões paralelas, incluindo dois branches
que cunharam "v0.10.0" independentemente (visível em `git log --all --grep="chore(release)"`).
A lição 8 do próprio usuário já exige a checagem `git log --all --grep="chore(release)"`
imediatamente antes de todo deploy — mas ela vive só numa memória, não no CLAUDE.md nem em
automação.
**Correção:** trazer a checagem obrigatória pré-deploy para o CLAUDE.md + (spec) guard no
`predeploy` que aborta se branch ≠ main, tree sujo, ou existir release commit fora da
ancestralidade do HEAD.

## 2. Guia de estilo (`docs/estilo-visual.md` + `docs/estilo/`)

### 2.1 "Se código e guia divergirem, o código manda" legitima violações do próprio agente — ALTA
**Trecho:** CLAUDE.md e `docs/estilo-visual.md`: "Se código e guia divergirem, o código
manda — atualize o guia junto." Em tensão direta com `fundamentos.md` ("mudar isto =
nível 6") e `nivel-6` ("PARE. Não implemente").
**Rota de escape:** a regra foi escrita para divergências *encontradas* (guia
desatualizado), mas não diz isso. O agente: (1) muda o código de propósito (ex.: altera um
token no `:root`, põe borda num card); (2) "constata" a divergência; (3) invoca "o código
manda" e atualiza `fundamentos.md` para bater com o código. Qualquer mudança de nível 6
vira "sincronização documental" — o PARE nunca dispara.
**Correção (cirúrgica):** o código manda **para divergências já existentes que você
encontrou**; divergência que a sua própria mudança criaria é edição do nível
correspondente. Nunca usar esta regra para legitimar mudança própria.

### 2.2 Autoclassificação de nível sem verificação; exceção elástica do `style` inline — ALTA
**Trecho:** todo o sistema depende do agente se classificar honestamente; o desempate
"em dúvida, o número maior ganha" só funciona se o agente admitir a dúvida. No nível 1, a
exceção "ajuste pontual de layout de UMA instância" via `style` inline não limita quantos
"pontuais" viram um estilo paralelo.
**Rota de escape:** enquadrar classe nova como "nível 1 com style inline", tela nova como
"extensão de tela existente".
**Correção:** redação no nível 1 (propriedades enumeradas, uma instância, nunca cor/raio/
fonte) + (spec) verificação mecânica: classe nova em `styles.css` sem linha no catálogo no
mesmo diff dispara alerta.

### 2.3 "Quem cria, cataloga no mesmo commit" sem verificação — MÉDIA
**Trecho:** `catalogo.md` + checklists dos níveis 2/3/4.
**Rota de escape:** ninguém confere; o catálogo apodrece; agentes futuros, seguindo
"reaproveite antes de criar", não acham a classe e criam duplicata — degradação composta e
silenciosa.
**Correção:** (spec) `scripts/verificar-catalogo.mjs` — classes de `styles.css` × tabela do
catálogo; componentes `src/ui/*.tsx` × bullets — chamado pelo release.

### 2.4 Nível 6: basta *citar* uma spec aprovada — MÉDIA
**Trecho:** `nivel-6`: subagente para "sem que a tarefa cite uma spec aprovada".
**Rota de escape:** citar basta — nada exige que a spec exista, cubra a mudança, ou tenha
sido aprovada; specs não têm campo de status. O agente cria a spec e a cita no mesmo fluxo.
**Correção:** spec aprovada = arquivo em `docs/superpowers/specs/` com linha
`Status: aprovada em <data>` escrita após confirmação do usuário; o subagente confere que a
spec cobre exatamente a mudança pedida.

### 2.5 `domain/`, `db/` e `backup/` não têm capítulo — ALTA
**Trecho:** o guia só governa UI; as camadas onde erro custa dados do usuário têm apenas
descrição arquitetural.
**Riscos verificados no código:**
- Nova `this.version(n)` no Dexie mal escrita corrompe IndexedDB de usuário real sem
  backup automático — nada exige teste do caminho de upgrade (dados na versão n−1 → abrir
  na n).
- `validarBackup` (`src/backup/backup.ts`) valida raso: `Array.isArray` por tabela e
  `typeof d.config === 'object'` — que **aceita `config: null`** (`typeof null ===
  'object'`) — seguido de `{ ...d } as unknown as Dados`. Nenhum registro interno é
  validado.
- `mesclar` decide por `alteradoEm` mais recente: um backup com `alteradoEm` no futuro
  vence o merge para sempre, silenciosamente.
Nada nos docs impede um agente de "simplificar" essa validação — passaria em todos os
checks existentes.
**Correção:** seção "Regras de dados" no CLAUDE.md: migração Dexie exige teste de upgrade;
mudanças em `src/backup/` exigem testes adversariais (malformado, campos ausentes,
`config` nulo, datas futuras); nunca relaxar `validarBackup`. O cast raso atual fica
registrado aqui como candidato a endurecimento de código (fora do escopo desta auditoria).

### 2.6 Nível 5: só "aba nova" é decisão de produto — BAIXA
**Rota de escape:** subtela de Ajustes nova, remoção ou renomeação de tela não exigem
confirmação — o agente adiciona/remove superfícies livremente.
**Correção:** estender: aba nova, subtela nova, remoção ou renomeação = decisão de produto.

## 3. Pipeline de release/changelog

### 3.1 Fragmento vazio some silenciosamente; release pode sair vazio — MÉDIA
**Trecho:** `release.mjs`: `if (corpo.length === 0) continue;` (linha 65), mas o arquivo
permanece em `arquivos` e é apagado no fim (linha 119). O guard `arquivos.length === 0`
(linha 104) passa mesmo se **todos** os fragmentos forem vazios — gerando uma seção
`## [X.Y.Z]` sem nenhum item (versão fantasma no CHANGELOG e na tela Versão).
**Correção:** (spec) abortar em fragmento vazio; abortar se nenhum item resultou.

### 3.2 Conteúdo do bullet não é validado — MÉDIA
**Trecho:** README promete "bullets planos, sem negrito, sem aninhamento" (o parser do app,
`src/ui/ajustes/changelog.ts`, só entende isso — lição 7 das memórias confirma quebra
real); `release.mjs` aceita qualquer linha não vazia, nem exige `- ` inicial.
**Rota de escape:** fragmento com markdown rico passa no release (só o prefixo do nome é
checado) e envenena o CHANGELOG permanentemente — os fragmentos já foram apagados.
**Correção:** (spec) validar cada linha: começa com `- `, sem `**`, sem indentação — abortar
apontando o README.

### 3.3 Release não checa branch, tree limpa nem tag pré-existente — ALTA
**Trecho:** o cabeçalho do script e o CLAUDE.md dizem "só na integração, no branch main";
o código não verifica nada disso. Sequência git: `add` → `commit` → `tag`; se a tag já
existir (ex.: release já rodado noutro branch), o commit **já foi criado** e os fragmentos
**já foram apagados** — estado meio-feito sem rollback. O histórico real já tem dois
`chore(release): v0.10.0` de branches diferentes.
**Correção:** (spec) abortar antes de escrever qualquer arquivo se branch ≠ `main`, tree
sujo (além dos arquivos que o próprio release toca) ou `git tag -l vX.Y.Z` não vazio.

### 3.4 Critério patch/minor/major indefinido — BAIXA
**Correção:** convenção de 3 linhas no README de changelog.d (proposta: só correções →
patch; `adicionado-` ou `alterado-` com comportamento novo → minor; `removido-` ou quebra
de compatibilidade de dados → major; usuário valida a convenção exata).

### 3.5 "Mudança visível ao usuário" sem exemplos — BAIXA
**Rota de escape:** o agente classifica correção sutil como "invisível" e ela some do
changelog; ou o inverso, poluindo-o.
**Correção:** exemplos no README (correção de cálculo = visível; refactor puro = não).

## 4. Memórias persistentes do Claude

Arquivos em `~/.claude/projects/C--Users-eitor-Claude-ProjetoFinancas/memory/`. Memórias
carregam peso normativo igual ao dos docs — e três delas hoje contradizem o repositório.

### 4.1 Topologia main/gh-pages invertida em `feedback_auto_preview_after_changes` — ALTA
**Trecho da memória:** "GitHub Pages is configured to serve from the `main` branch root...
`main` holds only the compiled build, never the app's source code... publishes `dist/` to
`origin main`."
**Realidade (verificada):** `main` é o branch **fonte** (CLAUDE.md, `git branch -a`,
histórico de commits de código na main); o build publicado vive em **`gh-pages`**
(`deploy: gh-pages -d dist`, cujo default é o branch `gh-pages`).
**Risco:** um agente que confie na memória pode "corrigir" a topologia na direção errada —
ex.: concluir que não deve haver fonte na `main` e resistir a pushá-la, ou publicar build
na `main`. A descrição data da configuração original de 2026-07-05, antes da
reestruturação.
**Correção:** reescrever o trecho com a topologia atual.

### 4.2 Título da mesma memória contradiz o próprio corpo — MÉDIA
O título/descrição diz "always publish after code changes", o corpo (corrigido em
2026-07-19) diz para NÃO deployar imediatamente — e a linha do índice `MEMORY.md` ainda
resume como "after code changes run `npm run deploy`". Agente com pressa lê só o índice.
**Correção:** alinhar descrição e linha do índice ao fluxo real (deploy só após release na
main).

### 4.3 Índice de `feedback_sempre_commitar` omite as ressalvas — BAIXA
O corpo preserva "nunca commitar na main direto"; a linha do índice ("commitar mudanças ao
final do ciclo sem precisar perguntar") não. **Correção:** ressalva na linha do índice.

### 4.4 Memórias referem branch `master`, que não existe — MÉDIA
`lessons_sessoes_concorrentes_worktree` (receita de recuperação: "`git push origin
<branch-worktree>:master`"), `flow-app-v1-status` e `feedback_sempre_criar_branch` falam
em `master`. Os branches reais são `main` e `gh-pages`. Um agente seguindo a receita à
risca **criaria um branch `master` fantasma no remoto** e acharia que integrou.
**Correção:** substituir por `main` nas três memórias.

### 4.5 `flow-app-v1-status` lista pendência que já não existe — BAIXA
"Pendências: ... importar a planilha real pela tela Ajustes → Importar" — mas o importador
xlsx foi **removido** do app (TODO.md registra a descontinuação; branch
`remover-importer-planilha`). Contagens de suíte e HEADs também estão defasadas.
**Correção:** atualizar o status.

### 4.6 `feedback_sempre_criar_branch` ensina `git checkout -b` no checkout compartilhado — MÉDIA
O "how to apply" manda rodar `git checkout -b` — exatamente a operação que
`lessons_sessoes_concorrentes_worktree` proíbe no checkout compartilhado (trocar branch de
sessões paralelas). As duas memórias nem se referenciam nessa direção.
**Correção:** apontar o "how to apply" para o fluxo de worktree.

## 5. Superfícies sem nenhum doc

### 5.1 `public/` vai literal para o site público — MÉDIA
Tudo em `public/` entra em `dist/` e é publicado por `gh-pages -d dist`. Nenhuma regra
impede um agente de deixar ali um arquivo de trabalho (um JSON de dados, um dump de debug).
**Correção:** regra no CLAUDE.md: arquivo novo em `public/` = decisão explícita, nunca
depósito de trabalho.

### 5.2 Config PWA/service worker sem regra — BAIXA
Erro na estratégia de cache/update pode prender usuários numa versão velha do app sem que
nada acuse. **Correção:** mudanças em config PWA/service worker = confirmar com o usuário.

## O que está robusto como está

- **Fonte única do número de versão no release** — elimina por construção a colisão de
  versão entre sessões (o problema restante é o deploy, item 1.8, não o release).
- **Prefixo de fragmento e formato de versão** — release aborta; enforcement real.
- **`tsc` estrito acorrentado ao `predeploy`** — impossível publicar com erro de tipo.
- **Estrutura mecânica do guia de estilo** (critério de entrada, pares ✅/❌, checklist de
  saída por nível) — o formato certo para brief de subagente; os problemas são os gatilhos
  de exceção (2.1, 2.2, 2.4), não a estrutura.
- **Instrução do nível 6 a subagentes** ("interrompa e reporte ao orquestrador. Não decida
  sozinho") — o padrão que os itens 1.4/1.5 deveriam copiar.
- **`transversais.md`** — receitas de animação e regras de acessibilidade exatas, sem
  margem de interpretação.
- **`.gitignore` para `*.xlsx`/`*.json.backup`** — correto no que cobre; o problema é o
  que não cobre (1.2).

## Encaminhamento

- **Correções de redação** (aplicadas nesta auditoria, branch `auditoria-orientacoes`):
  1.1–1.5, 1.6, 1.7, 1.8 (parte doc), 2.1, 2.2 (parte doc), 2.4, 2.5, 2.6, 3.4, 3.5,
  5.1, 5.2.
- **Correções nas memórias** (aplicadas direto, fora do repo): 4.1–4.6.
- **Automação** (especificada em
  `docs/superpowers/specs/2026-07-23-enforcement-orientacoes-design.md`, implementação em
  sessão futura): guards do release (3.1, 3.2, 3.3, 1.3), guard do deploy (1.8),
  verificador de catálogo (2.3), hooks opcionais (1.1, 1.2, 1.6) e CI mínimo.
