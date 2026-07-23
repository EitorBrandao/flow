# Alcinha do sheet em branco — decisão de linguagem visual

## O quê

A alcinha de arrastar-para-fechar dos sheets (`.sheet-alca`, em `Sheet.tsx`) passa a usar
branco puro (`#ffffff`) em vez de `var(--surface2)` (o cinza azulado usado hoje em toda
elevação de superfície do app).

## Por quê

O usuário reportou que a alcinha, no tom `--surface2`, fica difícil de enxergar sobre o
fundo `--surface` do sheet — o contraste entre as duas superfícies é baixo de propósito
(a hierarquia visual do app separa superfícies por contraste sutil, não por borda). Um
mockup comparando branco, `--surface2` atual e um cinza neutro (referência: barra de
arrastar do app da Uber) foi apresentado e aprovado.

## O que substitui

`.sheet-alca::before { background: var(--surface2); }` → `background: var(--alca);` com
`--alca: #fff;` declarado em `:root`.

## Por que é nível 6, não nível 3

`--alca` não carrega significado semântico novo (não é uma categoria de informação, como
`--aviso-*` ou `--pos`/`--neg`) — é uma exceção pontual ao padrão de superfície do app,
justificada por legibilidade num elemento de toque específico. `nivel-3-novo-token.md`
exclui explicitamente esse caso ("um tom diferente para ficar bonito"), redirecionando
para nível 6. Segue o precedente de `--hoje-bg`: token de uso único, documentado na
tabela de `fundamentos.md`, sem introduzir novo par cor+fundo nem nova regra semântica.

## Escopo

Só `.sheet-alca` (compartilhado por todo `Sheet.tsx`, logo por todos os sheets do app).
Não afeta `--surface2` em nenhum outro uso (inputs, botão secundário, etc.).
