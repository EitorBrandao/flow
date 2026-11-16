# Plano B — Backlog em dia e uma regra só para subagentes

> **Para quem executa:** este plano é de documentação e de arquivos locais. Não há código nem teste novo. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** o `TODO.md` volta a refletir o que falta, e o projeto passa a ter uma regra única, escrita, sobre qual modelo implementa e qual revisa.

**Arquitetura:** a revisão do backlog é manual e acontece no checkout principal, porque `TODO.md` e `TODO-CONCLUIDOS.md` são locais. A regra de subagentes entra no `CLAUDE.md` do projeto, que é versionado e vale em qualquer sessão, inclusive na nuvem. Uma sessão sem `TODO.md` passa a deixar uma marca que a próxima sessão local encontra por `git log`.

**Origem:** itens D3 e D4 da revisão de 2026-11-15. Decisão do usuário na mesma data: Sonnet implementa as tarefas complexas e Haiku o resto; Opus revisa tudo; Sonnet revisa as tarefas de complexidade intermediária.

## Restrições globais

- Versionados que mudam: `CLAUDE.md` e `docs/licoes-aprendidas.md`. Nada em `.claude/` nem em `scripts/`.
- `TODO.md` e `TODO-CONCLUIDOS.md` são editados **no checkout principal**, nunca no worktree. Eles não entram em commit.
- Nenhum valor, nome ou termo real em arquivo versionado.
- Mudança não visível ao usuário: termina no merge.
- O `~/.claude/CLAUDE.md` global é do usuário e vale para todos os projetos dele. Este plano só o altera com o "sim" dele (Tarefa 3).

## Modelo por tarefa

| Tarefa | Complexidade | Quem faz | Revisa |
|---|---|---|---|
| 1 | intermediária, só no PC do usuário | sessão principal | Opus |
| 2 | simples | Haiku | Opus |
| 3 | manual | usuário decide | — |

---

### Tarefa 1: Conferir o `TODO.md` contra o que já saiu

O cabeçalho do `TODO.md` diz "Última revisão: 2026-10-08, contra o código e o changelog até a v0.63.2". A `main` está na v0.72.3.

**Arquivos (locais, no checkout principal):** `TODO.md`, `TODO-CONCLUIDOS.md`. Leitura: `CHANGELOG.md`, `TODO-REVISAO-2026-11-15.md`, `TODO-PLANOS-2026-11-15.md`.

- [ ] **Passo 1:** liste o que saiu desde a última revisão.

Rode: `git log --oneline v0.63.2..HEAD -- CHANGELOG.md`
Depois leia, no `CHANGELOG.md`, as seções da v0.63.3 até a v0.72.3.

- [ ] **Passo 2:** para **cada item aberto** do `TODO.md`, responda três perguntas e anote a resposta ao lado do item, numa lista de trabalho na pasta de rascunho:

1. Alguma versão do passo 1 entregou isto, inteiro ou em parte? Cite a versão.
2. O código confirma? Procure pelo nome da tela, da função ou do texto que o item descreve.
3. As "decisões em aberto" do item ainda estão em aberto?

- [ ] **Passo 3:** aplique o resultado.

- Item entregue inteiro: sai do `TODO.md` e vai inteiro para o `TODO-CONCLUIDOS.md`, com a versão e uma linha de relato.
- Item parcial: fica no `TODO.md`, reescrito para descrever só o que falta, e aponta para o `TODO-CONCLUIDOS.md`.
- Item intocado: fica como está.
- Renumere a "Ordem de ataque".

- [ ] **Passo 4:** para **cada versão** do passo 1 que não correspondeu a item nenhum, acrescente uma linha no `TODO-CONCLUIDOS.md`, na seção do que saiu sem item.

- [ ] **Passo 5:** traga os achados da revisão de 2026-11-15 para o backlog, no formato de quatro partes que o arquivo já usa (o que muda, impacto × esforço, decisões em aberto, conflitos):

| Novo item | Vem de | Observação |
|---|---|---|
| Guard de dados reais sem a lista | D1, D2 | aponta para o plano A |
| Varredura fixa | R1, R2 | aponta para o plano C |
| Confirmação própria e retorno ao salvar | U2, U3, D5, V2 | aponta para os planos D1 e D2 |
| Pendentes à vista no Hoje | U1 | aponta para o plano E |
| Botão Lançar escondido atrás da barra | V1 | sem plano ainda |
| Alvos de toque abaixo de 38 px | V8 | sem plano ainda; a varredura fixa do plano C os lista como conhecidos |
| Demais achados V3 a V14 | varredura | um item só, com a lista |
| Worktrees e branches remotos parados | D11 | decisão do usuário sobre o que apagar |
| Backups reais em `.tests/` | D12 | decisão do usuário |

Os achados D6 a D10 e D13 a D15 entram num item único, "Documentação: achados da revisão de 2026-11-15", apontando para `TODO-REVISAO-2026-11-15.md`.

- [ ] **Passo 6:** atualize o cabeçalho do `TODO.md`: "Última revisão: <data de hoje>, contra o código e o changelog até a v0.72.3 (`a643c4f`)", com um parágrafo curto do que fechou e do que abriu.

- [ ] **Passo 7:** mostre ao usuário o resumo: quantos itens fecharam, quantos ficaram parciais, quantos abriram, e a nova "Ordem de ataque". Não é ponto de parada.

---

### Tarefa 2: Regra única de subagentes e marca de backlog não conferido

**Arquivos:**
- Modificar: `CLAUDE.md` (seção "Regras de trabalho" › "Subagentes de implementação"; seção "Planejamento")
- Modificar: `docs/licoes-aprendidas.md` (seções "Subagentes e revisão" e "Planejamento e backlog")

- [ ] **Passo 1:** em `CLAUDE.md`, na seção "### Subagentes de implementação", acrescente no começo da lista:

```markdown
- A escolha do modelo é fixa. Tarefa complexa: Sonnet implementa. Todo o resto: Haiku implementa. Opus revisa tudo, inclusive a revisão final do branch. Sonnet revisa também as tarefas de complexidade intermediária, antes do Opus.
- O plano marca a complexidade de cada tarefa (simples, intermediária ou complexa). Quem executa não reavalia a complexidade na hora.
- Uma tarefa é complexa quando muda `src/db/`, `src/backup/`, uma função de `src/domain/`, ou um componente usado por três telas ou mais. É intermediária quando muda mais de um arquivo de `src/ui/` ou um guard de `scripts/`. O resto é simples.
```

- [ ] **Passo 2:** em `CLAUDE.md`, na seção "### Planejamento", acrescente no fim da lista:

```markdown
- Todo plano traz uma tabela "Modelo por tarefa", com a complexidade de cada tarefa e quem implementa e quem revisa, pela regra de "Subagentes de implementação".
- Uma sessão sem `TODO.md` (na nuvem, ou num clone limpo) não consegue fechar item do backlog. Ela escreve, no corpo do commit de merge, a linha `Backlog: não conferido`. A próxima sessão local procura essa linha com `git log --grep="Backlog: não conferido"`, confere o `TODO.md` contra esses merges e registra a conferência no cabeçalho do arquivo.
```

- [ ] **Passo 3:** em `docs/licoes-aprendidas.md`, no fim da seção "Subagentes e revisão":

```markdown
- **Duas regras de modelo valiam ao mesmo tempo.** Uma dizia que o modelo menor só lê e resume. A outra dizia que ele implementa. Cada sessão seguia a que lia primeiro. *Faça:* uma regra de processo tem um endereço só, no arquivo versionado do projeto. Uma preferência guardada fora do repositório não chega a uma sessão na nuvem.
```

- [ ] **Passo 4:** em `docs/licoes-aprendidas.md`, no fim da seção "Planejamento e backlog":

```markdown
- **O passo que fecha o backlog não roda onde o backlog não existe.** O ciclo de entrega manda conferir o `TODO.md` antes do merge. O arquivo é local. Nove versões saíram de sessões que não tinham o arquivo, e o backlog ficou 19 versões atrasado. *Faça:* quando um passo depende de um arquivo local, a sessão que não o tem deixa uma marca que a próxima sessão local encontra. Aqui a marca é a linha `Backlog: não conferido` no commit de merge.
```

- [ ] **Passo 5:** confira os dois números da lição do passo 4 antes de gravar. Conte as versões entre a última revisão do `TODO.md` e a `main`:

Rode: `git tag --sort=v:refname | sed -n '/^v0\.63\.2$/,$p' | wc -l` (desconte 1, a própria v0.63.2)
Rode: `git log --oneline v0.63.2..HEAD --merges --grep="ccr-" | wc -l`
Troque "Nove" e "19" pelos números que saírem. Se o segundo comando não refletir bem as sessões na nuvem, escreva "Várias versões" em vez de um número.

- [ ] **Passo 6:** rode `npm test`. Esperado: tudo passa (o dossiê e o catálogo não dependem destes arquivos, mas a suíte inteira é a regra).

- [ ] **Passo 7: commit**

```bash
git add CLAUDE.md docs/licoes-aprendidas.md
git commit -m "docs: regra única de modelos dos subagentes e marca de backlog não conferido"
```

---

### Tarefa 3: Alinhar o `~/.claude/CLAUDE.md` global (precisa do "sim" do usuário)

O arquivo global diz: "Subagentes Haiku não modificam arquivos" e "Execução e edição ficam na sessão principal (Sonnet)". No Flow, a regra da Tarefa 2 diz o contrário. As instruções do projeto já têm precedência dentro do projeto, mas duas frases opostas confundem.

- [ ] **Passo 1:** pergunte ao usuário qual das duas saídas ele quer.

1. Acrescentar ao arquivo global, na seção "Subagentes", a linha: "Um projeto pode definir outra divisão no próprio `CLAUDE.md`; nesse caso vale a do projeto."
2. Deixar o global como está.

- [ ] **Passo 2:** com o "sim" para a saída 1, edite o arquivo e mostre o trecho ao usuário.

- [ ] **Passo 3:** atualize a memória `feedback_sdd_model_haiku_impl_sonnet_review.md`: tire a frase que diz que o global ainda contradiz o projeto, ou confirme que ela continua valendo.

---

## Encerramento

- [ ] `npm test` verde.
- [ ] `git -C <checkout principal> status --porcelain` vazio (os `TODO*.md` são ignorados pelo git).
- [ ] Skill `ciclo-de-entrega`: mudança não visível, termina no merge na `main`.

## Fora do escopo

- Editar a skill `ciclo-de-entrega`: ela mora em `.claude/`, e o usuário não autorizou mexer ali neste plano. A regra nova fica no `CLAUDE.md`, que a skill já manda ler.
- Apagar worktrees e branches parados (D11) e os backups em `.tests/` (D12): viram itens do backlog na Tarefa 1 e esperam decisão do usuário.
