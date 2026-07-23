# Guia de estilo do Flow — índice

**Consulte este índice antes de QUALQUER edição de UI.** Ele leva ao capítulo do seu nível
de edição em `docs/estilo/` — leia o capítulo indicado (são curtos) antes de escrever
código. Se código e guia divergirem, o código manda **apenas quando a divergência já
existia antes de você chegar** — atualize o guia junto com a mudança. Divergência que a
sua própria edição criaria não é divergência: é uma mudança do nível correspondente
(valor de token ou princípio = nível 6). Esta regra nunca legitima uma mudança sua.

## Que mudança você vai fazer?

| Vou... | Leia | Junto com |
|---|---|---|
| mudar uma tela existente com o que já existe | [`nivel-1-editar-tela.md`](estilo/nivel-1-editar-tela.md) | `catalogo.md` |
| criar uma classe CSS nova | [`nivel-2-nova-classe.md`](estilo/nivel-2-nova-classe.md) | `catalogo.md`, `fundamentos.md` |
| criar um token/cor nova | [`nivel-3-novo-token.md`](estilo/nivel-3-novo-token.md) | `fundamentos.md` |
| criar/extrair componente compartilhado | [`nivel-4-novo-componente.md`](estilo/nivel-4-novo-componente.md) | `catalogo.md`, `transversais.md` |
| criar uma tela nova | [`nivel-5-nova-tela.md`](estilo/nivel-5-nova-tela.md) | `catalogo.md`, `transversais.md` |
| mudar princípio, tema, fonte, cor de ação ou valor de token | [`nivel-6-mudanca-de-linguagem.md`](estilo/nivel-6-mudanca-de-linguagem.md) | — |

**Em dúvida entre dois níveis, o número maior ganha.** Animação ou acessibilidade em
qualquer nível: [`transversais.md`](estilo/transversais.md).

## Referências (não são níveis)

- [`fundamentos.md`](estilo/fundamentos.md) — princípios, tokens, escalas. Mudar isto = nível 6.
- [`catalogo.md`](estilo/catalogo.md) — classes e componentes existentes. **Quem cria, cataloga.**
- [`transversais.md`](estilo/transversais.md) — movimento (receitas framer-motion) e acessibilidade.

Decisões pontuais históricas: specs em `docs/superpowers/specs/`.
