---
name: ciclo-de-entrega
description: Use ao fechar qualquer trabalho no Flow — integrar um branch na main, criar fragmento de changelog, rodar release, publicar deploy, ou decidir se uma mudança é visível ao usuário. Também quando um guard (release ou predeploy) abortar e for preciso reconciliar.
---

# Ciclo de entrega do Flow

Do código pronto no branch até o app publicado. **Siga na ordem** — os passos existem porque
cada um já falhou uma vez.

Antes de tudo, a pergunta que define metade do ciclo:

## A mudança é visível ao usuário?

O critério está em `changelog.d/README.md`: **muda o que ele vê ou o resultado que obtém**.
Inclui correção de cálculo ou de comportamento, por mais sutil. **Não** inclui refactor puro,
documentação, teste e tooling.

- **Visível** → tem fragmento de changelog → tem release → tem deploy. Ciclo inteiro.
- **Não visível** → sem fragmento, sem release, sem deploy. Termina no merge da `main`.

Errar para o lado de "visível" gera uma versão publicada que não muda nada para ninguém;
errar para o lado de "não visível" deixa o usuário sem saber que algo mudou no dinheiro dele.
Na dúvida, é visível.

## Passo 1 — Código no worktree da feature

Nunca na `main`. Sessões concorrentes usam o mesmo checkout, então é worktree, não `checkout -b`:

```
git worktree add .worktrees/<nome> -b <nome> main
cd .worktrees/<nome> && npm ci
```

## Passo 2 — Mockup aprovado, se envolver UI

**Ponto de parada: espere o usuário.** Aprovado = o usuário respondeu confirmando o mockup
nesta sessão. **Silêncio não é aprovação.** Só dispensa mockup a mudança trivial: texto, ou
reordenar elementos que já existem com classes do catálogo.

Antes de escrever UI, `docs/estilo-visual.md` e o capítulo do nível da mudança. Classe ou
componente novo se cataloga em `docs/estilo/catalogo.md` **no mesmo commit** — o guard do
release bloqueia se faltar.

## Passo 3 — Suíte completa verde

```
npm test
```

Suíte inteira, não só os arquivos que você tocou. Rodar um subconjunto e reportar "verde" já
aconteceu e escondeu cinco falhas. Se um teste cair, rode-o isolado antes de concluir que
quebrou: a máquina local fica na fronteira sob paralelismo.

## Passo 3.5 — Wiki, se a feature mudou

**Toda feature incluída, alterada ou removida atualiza `docs/wiki/` no mesmo branch.** A wiki
é a explicação do app para quem chega agora — é o item que existe justamente porque o usuário
não vai conseguir explicar tudo pessoalmente. Wiki desatualizada é pior que wiki ausente:
ensina o app errado com a autoridade de quem sabe.

O critério é o mesmo do fragmento de changelog: **mudou o que o usuário vê ou o resultado que
obtém?** Se sim, algum capítulo precisa mudar. Refactor, teste e tooling não mexem na wiki.

Onde procurar o capítulo:

| Mudou... | Capítulo |
|---|---|
| tela ou fluxo de uso | `6-telas.md` |
| subtela de Ajustes, campos obrigatórios/padrão | `7-ajustes.md` |
| cartão, fatura, parcelamento, assinatura | `5-cartao.md` |
| conceito, entidade ou invariante do modelo | `3-conceitos.md`, `4-motor.md` |
| entidade ou termo novo | `8-glossario.md` |
| primeiro uso, onboarding | `1-primeiros-passos.md` |

Entidade nova costuma tocar **três** capítulos: a tela onde se cadastra, a tela onde aparece,
e o glossário. Feature removida sai da wiki no mesmo commit que a remove do código.

O parser da wiki aceita um **subconjunto fechado** de markdown (`docs/wiki/README.md`):
sintaxe fora dele **lança exceção** em vez de ser ignorada. Valide antes de seguir:

```
npx vitest run src/ui/ajustes/capitulos.test.ts
```

## Passo 3.6 — Revisão do dossiê

Rode `npm run dossie`. Se `docs/dossie/` mudou, commite a regeneração e invoque a skill
`revisar-dossie` no recorte por branch. Entregue a leitura ao usuário. Não é guarda que
aborta — é leitura que ele recebe.

## Passo 4 — Fragmento de changelog e revisão

Só se a mudança for visível (ver acima). Arquivo novo em `changelog.d/`, nome
`<adicionado|alterado|removido>-<slug>.md`, **bullets planos** — o parser do app (`src/ui/
ajustes/changelog.ts`) só entende isso, e markdown rico passa no release e quebra a tela de
Versão depois.

Nunca edite `package.json` (`version`) nem o topo do `CHANGELOG.md` num branch de feature.

**Ponto de parada: espere o usuário.** Mostre a revisão (Adicionado/Alterado/Removido) e
espere **confirmação literal**. Subagentes param aqui e reportam ao orquestrador.

## Passo 5 — Integração na `main`

Uma vez só, e só depois da confirmação:

```
git checkout main && git merge --no-ff <branch>
npm run release -- <patch|minor|major>
```

Escolha do bump: só correções → `patch`; recurso ou comportamento novo → `minor`; remoção ou
quebra de compatibilidade de dados/backup → `major`. **Olhe os fragmentos que já estavam em
`changelog.d/`** antes do seu: um fragmento pendente de outra sessão pode forçar `minor`
mesmo que o seu trabalho seja só correção.

O release roda os guards sozinho (branch, working tree, tag, catálogo, formato dos bullets) e
só então escreve. Se abortar, o motivo está na mensagem — corrija a causa, não o guard.

## Passo 6 — Push

```
git push origin main --follow-tags
```

## Passo 7 — Deploy

```
npm run deploy
```

O `predeploy` checa branch, working tree, ancestralidade dos commits `chore(release)` de
outros branches e HEAD = `origin/main`.

**Se ele abortar, pare e reconcilie** — merge do que faltou e renumeração da versão. Deploy de
branch desatualizado já regrediu o site publicado três vezes. `DEPLOY_FORCE=1` existe, pula
todos os guards, e **só se usa a pedido explícito do usuário**; nunca como atalho.

Vale ainda a checagem que o guard não faz por inteiro: um branch irmão com release não
mesclado.

```
git log --all --oneline --grep="chore(release)"
```

Achou release fora da ancestralidade do HEAD? Reconcilie antes: merge, resolva a colisão de
número de versão, rode a suíte de novo.

## Depois

O `CHANGELOG.md` já saiu atualizado pelo release, **antes** do deploy — a tela de Ajustes lê o
`CHANGELOG.md` do build, então a versão exibida fica em dia sozinha. Confirme o CI verde
(`gh run list --branch main --limit 1`) e limpe o worktree:

```
git worktree remove .worktrees/<nome> && git branch -d <nome>
```
