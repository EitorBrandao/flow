# Mapa de `docs/`

Para quem chega no repositório sem saber o que existe aqui. Este arquivo diz **onde** está
cada coisa — não repete o que ela diz.

## Para entender o app

- **[`wiki/`](wiki/)** — a wiki do app, em markdown. Explica o Flow a quem chega agora, na
  língua das telas. O app embute esses capítulos (Ajustes → Wiki). O parser aceita só um
  subconjunto fechado de markdown, descrito em [`wiki/README.md`](wiki/README.md).
  Toda mudança visível ao usuário atualiza a wiki no mesmo branch.
- **[`dominio.md`](dominio.md)** — modelo conceitual e invariantes de `src/domain/`, `src/db/`
  e `src/backup/`: o que cada entidade significa, a matriz `status` × `origem` do lançamento, o
  ciclo da fatura, o que `validarBackup` garante e o que não garante. Separa **invariante
  garantido pelo código** de **expectativa não garantida** — leitura obrigatória antes de mexer
  em dados.
- **[`dossie/`](dossie/)** — dossiê de comportamento: o app inteiro em ação, num roteiro
  sintético de 12 meses. **Conteúdo gerado** por `npm run dossie`; nunca edite à mão. Serve
  para julgar o que um branch mudou no comportamento. Ver [`dossie/README.md`](dossie/README.md).

## Para editar a interface

- **[`estilo-visual.md`](estilo-visual.md)** — índice roteador do guia de estilo visual do
  Flow. Leitura **obrigatória antes de qualquer edição de UI** (o critério exato — quais
  caminhos contam como "edição de UI" — está no `CLAUDE.md` da raiz). O índice aponta pro
  capítulo certo conforme o nível da sua mudança.
- **[`estilo/`](estilo/)** — os capítulos do guia: `fundamentos.md` (princípios e tokens),
  `catalogo.md` (classes e componentes existentes), `transversais.md` (movimento e
  acessibilidade), e os seis níveis de edição (`nivel-1-editar-tela.md` até
  `nivel-6-mudanca-de-linguagem.md`).

## Para planejar e entregar

- **[`superpowers/specs/`](superpowers/specs/)** e **[`superpowers/plans/`](superpowers/plans/)**
  — decisões de produto (o quê e por quê, aprovado com o usuário) e planos de execução (como
  implementar). Índice com data, tema, situação de implementação e o par spec↔plano de cada
  uma: [`superpowers/README.md`](superpowers/README.md).
- **[`licoes-aprendidas.md`](licoes-aprendidas.md)** — o que o projeto aprendeu errando, por
  tema: sessões e deploy, subagentes, testes, dados, interface, backlog. Leia a seção do tema
  antes de mexer numa área que já deu problema.
- **[`../changelog.d/README.md`](../changelog.d/README.md)** — formato dos fragmentos de
  changelog. O `CHANGELOG.md` da raiz é gerado a partir deles por `npm run release`.
- **[`../.claude/skills/`](../.claude/skills/)** — as skills do projeto: `ciclo-de-entrega`
  (do worktree ao deploy) e `revisar-dossie` (como ler o dossiê). O passo a passo da entrega
  vive lá, não neste mapa.
- **[`../.claude/hooks/README.md`](../.claude/hooks/README.md)** — os lembretes automáticos
  do Claude Code. Eles só avisam; não bloqueiam nada.

## Histórico

- **[`auditoria-orientacoes-2026-07-23.md`](auditoria-orientacoes-2026-07-23.md)** —
  relatório histórico, já fechado (ver aviso no topo do próprio arquivo): descreve o
  repositório como ele estava em 2026-07-23, não o estado atual.

## Fora do git

O backlog vive em dois arquivos **locais**, que o `.gitignore` exclui de propósito. Eles não
existem num clone limpo, no CI nem num worktree novo. Peça o conteúdo ao usuário em vez de
recriá-los.

- `TODO.md` — o que ainda falta, com a ordem de ataque.
- `TODO-CONCLUIDOS.md` — o que já foi feito, com o relato de cada item.

## Fora de `docs/`

- **[`CLAUDE.md`](../CLAUDE.md)** (raiz do repositório) — arquitetura do app, comandos,
  guardas automáticas e regras do repositório para quem mexe em código. Três subpastas têm o
  seu: `src/ui/`, `src/db/` e `src/backup/`.
- **[`README.md`](../README.md)** (raiz do repositório) — o que é o Flow, o link do app
  publicado e o que cada aba faz.
- **[`CHANGELOG.md`](../CHANGELOG.md)** (raiz do repositório) — histórico de versões. O app
  embute o arquivo (Ajustes → Versão).
- **[`public/README.md`](../public/README.md)** — o que pode entrar em `public/`, que vai
  inteiro para o site público.
