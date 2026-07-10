# Fundamentos — princípios, tokens e escalas

Arquivo de **referência** (não é um nível de edição): a linguagem visual do Flow.
**Mudar qualquer regra deste arquivo é edição de nível 6** (`nivel-6-mudanca-de-linguagem.md`).
Fonte da verdade dos valores: `src/styles.css` (`:root` e classes base).

## Princípios

- **Dark-only.** Não existe tema claro nem `prefers-color-scheme`. `color-scheme: dark` fixo.
- **Azul (`--ac`) é a única cor de ação:** botão primário, aba/item ativo, FAB, links "ver
  tudo", focus ring. Nunca usar azul para outra coisa, nem outra cor para ação.
- **Verde (`--pos`) e vermelho (`--neg`) são exclusivos de dinheiro:** ganho/gasto, saldo,
  gráfico. Nunca em botões, navegação ou estados de UI genéricos.
- **Sem bordas em cards/itens.** Separação por contraste de superfície (`--surface` sobre
  `--bg`), não por `border`. `--line` só aparece em separadores raros (linhas de tabela,
  borda do nav/topo).
- **Valores monetários em pílula tingida** dentro de listas/cards (fundo translúcido + texto
  na cor plena); **sem pílula** dentro de tabelas ou texto corrido — só a cor.
- **Números sempre `tabular-nums`.**
- **Ícones são utilitários, não decorativos** (via `lucide-react`). Não ilustrar itens de
  lista com ícone por categoria — título forte + subtítulo apagado basta.
- **Fonte:** stack do sistema (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`),
  16px base. Sem fonte customizada/importada.
- **CSS em um único arquivo:** todo estilo vive em `src/styles.css`, como classes
  reutilizáveis. Não há CSS modules, styled-components nem Tailwind.

## Tokens (`:root` em `src/styles.css`)

Token novo → `nivel-3-novo-token.md`. Mudar valor de token existente → nível 6.

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0b0d11` | fundo do app |
| `--fg` | `#e9edf3` | texto principal |
| `--muted` | `#8b95a3` | texto secundário, rótulos, subtítulos |
| `--surface` | `#161b24` | cards, itens de lista, sheet, chip |
| `--surface2` | `#212836` | inputs, botão secundário, elevação sobre `--surface` |
| `--line` | `#232936` | separadores raros (borda do nav, linha de tabela) |
| `--ac` / `--ac-dim` | `#3b9df8` / `rgba(59,157,248,.14)` | ação (única cor de ação do app) |
| `--pos` / `--pos-bg` | `#2ee6a8` / `rgba(46,230,168,.14)` | ganho / saldo positivo |
| `--neg` / `--neg-bg` | `#ff6b7a` / `rgba(255,107,122,.13)` | gasto / saldo negativo |
| `--aviso-bg` / `--aviso-fg` | `#423306` / `#fcd34d` | aviso âmbar (ex.: backup atrasado) |

## Escalas

**Raios:** cards 20px · itens de lista 18px · botões/inputs 12px · chips/pílulas/badges 999px
· FAB 18px (14px no desktop) · sheet 24px (topo, ou nos 4 cantos em desktop).
Não existe outro raio — precisar de um novo é nível 6.

**Tipografia:** títulos de seção (`.tela h2`) 16px/700 · rótulo maiúsculo (`.rotulo`) 12px/600
com `letter-spacing: .05em` · subtítulo (`.sub`) 13px em `--muted` · saldo grande
(`.saldo-grande`) 38px/800 com `letter-spacing: -.03em` · valores monetários 14.5px/700 ·
texto de navegação 12px/600 (15px no desktop).

**Espaçamento (valores recorrentes):** gap entre blocos de tela (`.tela`) 14px · gap entre
itens de lista (`.lista`) 10px · gap interno de item 12px · padding de card 20px · padding
de item 14px 16px · padding de botão 10px 14px · padding de input 11px 12px. Escolha o valor
já usado no contexto igual mais próximo; não invente espaçamentos novos.

**Alturas mínimas (alvo de toque):** chip 38px · botão 42px · input/campo-busca 44px · botão
de categoria 56px · FAB 52px.

**Layout:** conteúdo central `max-width: 720px` (mobile) / `900px` (desktop) · breakpoint
único `@media (min-width: 900px)` — tab bar vira sidebar de 190px. Não criar breakpoints.
