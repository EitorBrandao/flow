# Guia de estilo por níveis de edição — design

**Data:** 2026-07-10
**Status:** aprovado em brainstorming, aguardando implementação

## Objetivo

Transformar `docs/estilo-visual.md` — hoje uma fotografia descritiva da UI — em um **sistema
normativo de decisão** para qualquer mudança futura de UI no Flow. A estrutura vira um "livro":
um índice roteador + um capítulo por **nível de edição**, em escala crescente de impacto.

**Audiência principal: subagentes de implementação (modelos menores, ex. Haiku).** As regras
devem ser mecânicas e verificáveis ("se X → faça Y"), com exemplos certo/errado tirados do
código real, sem depender de julgamento fino.

## Estrutura de arquivos

```
docs/estilo-visual.md                     ← ÍNDICE (roteador — consultar SEMPRE antes de editar UI)
docs/estilo/
  fundamentos.md                          ← referência: princípios, tokens, escalas (raio/tipografia/espaço)
  catalogo.md                             ← referência: classes existentes + componentes compartilhados
  nivel-1-editar-tela.md                  ← mudar tela existente só com o que já existe
  nivel-2-nova-classe.md                  ← criar classe CSS nova (nomenclatura, onde inserir, modificadores)
  nivel-3-novo-token.md                   ← criar token/escala nova (quando se justifica, padrão --x/--x-bg)
  nivel-4-novo-componente.md              ← extrair componente compartilhado, pastas, lazy-loading
  nivel-5-nova-tela.md                    ← tela nova do zero (checklist atual, expandido)
  nivel-6-mudanca-de-linguagem.md         ← mudar princípio/linguagem visual → exige spec + aprovação do usuário
  transversais.md                         ← referência: movimento (tempos/molas) + acessibilidade, valem em qualquer nível
```

Racional dos níveis — escala de impacto crescente:

| Nível | Toca em |
|---|---|
| 1 | só `.tsx` de telas, usando classes/componentes existentes |
| 2 | `src/styles.css` (classe nova) |
| 3 | `:root` de `src/styles.css` (token/escala nova) |
| 4 | arquivo novo de componente compartilhado |
| 5 | arquivo novo de tela (`Tela<Nome>.tsx`) |
| 6 | os próprios princípios (dark-only, azul-única-ação etc.) — único nível que **para e abre spec** |

Os três arquivos de referência (fundamentos, catálogo, transversais) não são níveis: são
consultados a partir de qualquer capítulo.

O caminho `docs/estilo-visual.md` é preservado como índice para não quebrar referências
existentes (memória do assistente, hábito). Planos históricos em `docs/superpowers/plans/`
que citam o caminho antigo não mudam — são registros.

## Formato do índice (`docs/estilo-visual.md`)

Curto (~40 linhas), sem conteúdo próprio — só roteamento:

1. Instrução de uso: "consulte este índice antes de qualquer edição de UI; ele leva ao
   capítulo do seu nível".
2. Tabela de roteamento: "vou fazer X → leia `nivel-N` (+ referências)". A primeira linha da
   tabela roteia pela pergunta-chave: *a mudança precisa de algo que não existe no catálogo?*
3. Regra de precedência: se código e guia divergirem, o código manda — atualizar o guia
   junto com a mudança.

## Formato dos capítulos de nível

Esqueleto comum:

1. **"Você está no nível certo?"** — 2–3 linhas com critério objetivo de entrada e de saída
   (quando subir de nível). Ex. nível 2: "você está aqui porque nenhuma classe do
   `catalogo.md` resolve; se precisar de cor/valor sem token, suba ao nível 3 antes".
2. **Regras mecânicas** "se X → faça Y", cada uma com par **✅ certo / ❌ errado** extraído do
   código do Flow (ex.: `✅ .grafico-expandido-fechar` / `❌ .close-btn`).
3. **Checklist de saída** — itens verificáveis antes de concluir (ex. nível 2: português
   kebab-case; inserida na seção certa do `styles.css`; sem cor/raio hardcoded; catalogada).

Regras de manutenção embutidas:

- **Quem cria, cataloga:** todo capítulo que cria algo (níveis 2–5) termina com o passo
  "atualize `catalogo.md`".
- **Tamanho-alvo:** capítulos de nível com ~40–80 linhas (cabem no contexto de um subagente
  junto com a tarefa); referências podem ser maiores.

## Migração do conteúdo atual

Nada se perde, só muda de endereço:

| Conteúdo atual de `estilo-visual.md` | Destino |
|---|---|
| Princípios, tokens, raios, tipografia | `fundamentos.md` |
| Catálogo de classes, componentes compartilhados | `catalogo.md` |
| Convenções de código (nomenclatura, inline style, ícones) | distribuídas nos níveis 2 e 4 |
| Tempos de transição/framer-motion | `transversais.md` |
| Checklist de tela nova | semente do `nivel-5-nova-tela.md` |

O conteúdo dos níveis 1, 3 e 6 e das regras mecânicas com exemplos certo/errado é **novo**,
derivado das convenções implícitas do `src/styles.css` e das decisões já registradas em specs.

## Pós-implementação

- Atualizar a memória persistente do assistente (`reference_estilo_visual.md`) para descrever
  a nova estrutura índice + capítulos.

## Fora de escopo

- Qualquer mudança em código de produção (`src/`) — este trabalho é só documentação.
- Reformar specs/planos históricos.
- Criar tema claro, novas cores ou novos componentes — o guia rege como decidir, não decide.
