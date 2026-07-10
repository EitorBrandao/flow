# Guia de estilo por níveis de edição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o guia de estilo do Flow em um índice roteador (`docs/estilo-visual.md`) + capítulos por nível de edição (`docs/estilo/*.md`), com regras mecânicas para subagentes.

**Architecture:** Trabalho 100% de documentação. Cada tarefa cria um arquivo Markdown cujo conteúdo integral está no próprio passo — copie exatamente, sem resumir nem "melhorar". A última tarefa substitui o conteúdo de `docs/estilo-visual.md` pelo índice e verifica que todos os links resolvem.

**Tech Stack:** Markdown, git. Nenhum código de produção.

**Spec:** `docs/superpowers/specs/2026-07-10-guia-estilo-por-niveis-design.md`

## Global Constraints

- **NÃO tocar em `src/`** — nenhuma mudança de código de produção neste plano.
- Todo texto em **português**.
- Caminhos exatos: capítulos em `docs/estilo/`, índice em `docs/estilo-visual.md` (caminho preservado).
- Conteúdo dos arquivos: usar **exatamente** o que está nos blocos de código do plano (eles foram derivados do código real — `src/styles.css`, `Shell.tsx`, `Sheet.tsx`).
- Um commit por tarefa, mensagem indicada na tarefa.
- Não editar planos/specs históricos que citem `docs/estilo-visual.md` — são registros.

---

### Task 1: `docs/estilo/fundamentos.md`

**Files:**
- Create: `docs/estilo/fundamentos.md`

**Interfaces:**
- Produces: arquivo de referência citado pelos capítulos de nível como `fundamentos.md`. A tabela de tokens e as escalas são a fonte canônica que o nível 3 atualiza.

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
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
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/fundamentos.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/fundamentos.md
git commit -m "docs(estilo): capitulo de referencia fundamentos"
```

---

### Task 2: `docs/estilo/catalogo.md`

**Files:**
- Create: `docs/estilo/catalogo.md`

**Interfaces:**
- Produces: arquivo de referência citado como `catalogo.md`; os níveis 2, 4 e 5 terminam com "registre no catálogo" apontando para as duas seções daqui (tabela de classes e bullets de componentes).

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Catálogo — classes e componentes existentes

Referência do que **já existe**. Reaproveite antes de criar qualquer coisa.
**Quem cria, cataloga:** classe compartilhada nova (nível 2), componente novo (nível 4) ou
tela nova (nível 5) entram aqui **no mesmo commit** que os cria.

## Classes (em `src/styles.css`)

| Classe | Para quê |
|---|---|
| `.tela` | wrapper de toda tela (`display: flex; flex-direction: column; gap: 14px`) |
| `.card` | bloco de destaque (ex.: card herói do saldo) — `--surface`, raio 20px, padding 20px |
| `.lista` / `.item` | lista vertical de itens-card; `.item-coluna` quando o item precisa de uma segunda linha (ex.: ações abaixo); `.linha-topo` para a linha principal dentro de um item-coluna |
| `.cresce` | filho flex que ocupa o espaço restante (`flex: 1; min-width: 0`) |
| `.acoes` | linha de botões de ação dentro de um item (ex.: Confirmar/Descartar) |
| `.botao`, `.botao-primario`, `.botao-perigo` | botão padrão / ação principal (azul) / ação destrutiva (texto vermelho) |
| `.chip` | pílula `--surface` no topo (seletor de box, botão de ajustes) e filtros |
| `.valor-ganho`, `.valor-gasto` | valor monetário em pílula (listas/cards); sem pílula automaticamente dentro de `.tabela` ou em `<strong>` |
| `.saldo-grande` (+ `.negativo`) | saldo em destaque (card herói) |
| `.delta` (+ `.pos`/`.neg`) | badge de variação/projeção com seta ▲/▼ |
| `.badge` | pílula neutra pequena (contagem, status) |
| `.aviso` | faixa âmbar de aviso |
| `.rotulo` | rótulo maiúsculo pequeno acima de um valor/seção |
| `.rotulo-grupo` | rótulo maiúsculo pequeno de subgrupo dentro de uma lista (ex.: "À vista"/"Parceladas" na fatura do cartão) |
| `.botao-ver-mais` | link azul de mostrar/ocultar uma lista longa (ex.: lançamentos da fatura, escondidos por padrão) |
| `.secao` (+ `.acao`) | cabeçalho de seção: título à esquerda, ação/contagem em azul à direita |
| `.campo` | wrapper label+input; `.linha` para agrupar campos lado a lado |
| `.campo-busca` | input de busca avulso (fora de `.campo`) |
| `.sub` | subtítulo/texto secundário 13px em `--muted` |
| `.grade-categorias` | grade 3 colunas de seleção de categoria; `.selecionada` marca o item ativo |
| `table.tabela` | tabela numérica (Fluxo, Análises) — alinhado à direita exceto 1ª coluna, sem linhas verticais |
| `.rolavel` | wrapper com `overflow-x: auto` para conteúdo largo (tabelas) |
| `.sheet-backdrop` / `.sheet` / `.sheet-alca` | bottom sheet (ver componente `Sheet`) |
| `.navegacao` | tab bar mobile / sidebar desktop (breakpoint 900px) |
| `.shell` / `.topo` / `.conteudo` | casco do app (ver componente `Shell`) |
| `.grafico-expandido-*` | classes internas do `FluxoChartModal` (exemplo do padrão de prefixo por componente) |

## Componentes compartilhados (em `src/ui/`)

- **`Sheet.tsx`** — bottom sheet padrão (framer-motion: slide-up com mola, drag-to-dismiss,
  backdrop com fade). Use para editores modais (ex.: `LancEditor`). Formulários de Ajustes
  ficam **inline**, não em sheet (decisão registrada em
  `docs/superpowers/specs/2026-07-05-redesign-visual-design.md` — mudar isso é nível 6).
- **`Shell.tsx`** — casco fixo: nav + topo (chip de box + chip de ajustes) + `.conteudo`
  central + transição de aba via `motion.div` (fade + leve deslize).
- **`BalanceChart.tsx`** — linha verde com gradiente, marcador "hoje", cenários em azul
  tracejado.
- **`FluxoChartModal.tsx`** — versão em tela cheia do `BalanceChart`, com pan/zoom, via
  `recharts` carregado sob demanda (`React.lazy`). Ver
  `docs/superpowers/specs/2026-07-08-grafico-fluxo-pan-zoom-design.md`.
- **`FaturaResumo.tsx`** — resumo somente leitura de uma fatura de cartão.
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/catalogo.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/catalogo.md
git commit -m "docs(estilo): capitulo de referencia catalogo"
```

---

### Task 3: `docs/estilo/transversais.md`

**Files:**
- Create: `docs/estilo/transversais.md`

**Interfaces:**
- Produces: arquivo de referência citado como `transversais.md` pelos níveis 1, 4 e 5 (receitas de animação e regras de acessibilidade).

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Transversais — movimento e acessibilidade

Referência válida em **qualquer** nível de edição.

## Movimento (framer-motion)

Receitas estabelecidas — use exatamente estas, não invente tempos novos:

| Contexto | Receita |
|---|---|
| Troca de conteúdo (aba, subtela) | `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.18, ease: 'easeOut' }}` (já vem do `Shell` para abas — não duplique) |
| Backdrop (fade) | `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}`, `transition={{ duration: 0.15 }}` |
| Sheet (entrada) | `initial={{ y: '100%' }}` → `animate={{ y: 0 }}`, `transition={{ type: 'spring', damping: 32, stiffness: 340 }}` |

Regras:

1. Anime só **entrada/saída e trocas de estado discretas**.
   ❌ Não animar valores monetários mudando, nem layout enquanto o usuário digita.
2. Micro-feedback (hover/active) pode ser CSS `transition`; qualquer coreografia de
   entrada/saída → framer-motion com as receitas acima.
3. Um tipo de animação não coberto pela tabela → nível 6 (é linguagem nova).

## Acessibilidade

4. Elemento clicável é `<button>` (a classe `.item` já estiliza button), nunca `div onClick`.
   ✅ `<button className="item" onClick={...}>` ❌ `<div className="item" onClick={...}>`
5. Todo botão só-ícone leva `aria-label` em português.
   ✅ `<button aria-label="Fechar"><X size={18} /></button>`
6. Focus ring global já existe (`:focus-visible` com outline azul) — não remover `outline`,
   não criar focus próprio.
7. Alvos de toque respeitam as alturas mínimas de `fundamentos.md` (38–56px).
8. Informação nunca depende só de cor: valores monetários têm contexto/sinal (▲/▼ no
   `.delta`, rótulos de ganho/gasto).
9. Números em `tabular-nums` (as classes de valor já aplicam; classe nova com número segue a
   regra do nível 2).
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/transversais.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/transversais.md
git commit -m "docs(estilo): capitulo de referencia transversais (movimento + a11y)"
```

---

### Task 4: `docs/estilo/nivel-1-editar-tela.md`

**Files:**
- Create: `docs/estilo/nivel-1-editar-tela.md`

**Interfaces:**
- Consumes: `catalogo.md` (Task 2), `transversais.md` (Task 3) — citados por nome de arquivo.
- Produces: capítulo roteado pelo índice (Task 10) para "mudar uma tela existente".

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 1 — Editar uma tela existente

**Você está no nível certo?** Sim, se a mudança usa apenas classes do `catalogo.md` e
componentes existentes, **sem tocar `src/styles.css`**.
- Precisa de uma classe que não existe → `nivel-2-nova-classe.md` antes de continuar.
- Vai criar um arquivo de tela novo → `nivel-5-nova-tela.md`.

## Regras

1. **Antes de escrever markup, escolha as classes no `catalogo.md`.**
   ✅ `<button className="item">` para um item de lista clicável
   ❌ `<div className="linha-lancamento" onClick={...}>` (classe inventada + div clicável)

2. **`style={{ }}` inline só para ajuste pontual de layout de UMA instância**
   (`marginTop`, `width` de um campo específico, `opacity` condicional).
   ✅ `style={{ width: 120 }}` num input específico
   ❌ `style={{ background: '#212836', borderRadius: 12 }}` — cor, raio e fonte vêm de
   classe/token; se precisar disso, é nível 2.

3. **Dinheiro:** `formatarBRL(...)` + `.valor-ganho`/`.valor-gasto` em listas/cards. Dentro
   de `.tabela` ou `<strong>` a pílula some sozinha via CSS — não reimplemente.

4. **Ações:** azul (`.botao-primario`) só na ação principal; demais botões `.botao`;
   destrutiva `.botao-perigo`. Nunca verde/vermelho em botão.

5. **Ícone:** importar de `lucide-react`, `size={18}` por padrão, uso utilitário
   (ação/estado). ❌ Ícone decorativo por categoria em itens de lista.

6. **Texto visível, `aria-label` e nomes: português.**

## Checklist de saída

- [ ] `src/styles.css` não foi tocado e nenhuma classe nova foi inventada no markup
- [ ] Nenhum `style` inline com cor, raio ou fonte
- [ ] Testado em largura estreita (mobile, tab bar embaixo) e ≥900px (desktop, sidebar)
- [ ] Regras de `transversais.md` respeitadas (button semântico, aria-label, foco, animação)
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-1-editar-tela.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-1-editar-tela.md
git commit -m "docs(estilo): capitulo nivel 1 (editar tela existente)"
```

---

### Task 5: `docs/estilo/nivel-2-nova-classe.md`

**Files:**
- Create: `docs/estilo/nivel-2-nova-classe.md`

**Interfaces:**
- Consumes: `catalogo.md`, `fundamentos.md`, `nivel-3-novo-token.md`, `nivel-4-novo-componente.md` — citados por nome.
- Produces: capítulo roteado pelo índice para "criar classe CSS nova"; seu checklist ("quem cria, cataloga") é citado pelos níveis 4 e 5.

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 2 — Criar uma classe CSS nova

**Você está no nível certo?** Sim, se nenhuma classe do `catalogo.md` resolve e a novidade
cabe em `src/styles.css` **usando só tokens existentes**.
- Precisa de cor/valor que não existe em `:root` → `nivel-3-novo-token.md` antes.
- O markup + comportamento vai se repetir em 2+ telas ou tem estado próprio →
  `nivel-4-novo-componente.md`.

## Nomenclatura

1. **Português, kebab-case.**
   ✅ `.grafico-expandido-fechar` ❌ `.close-btn`, `.graficoExpandidoFechar`
2. **Classe compartilhada** (faz sentido em qualquer tela) → nome curto e genérico.
   ✅ `.badge`, `.aviso`, `.rotulo-grupo`
3. **Classe de um componente/tela específica** → prefixo com o nome do componente.
   ✅ `.grafico-expandido-legenda` (só existe no `FluxoChartModal`)
4. **Modificador** → classe curta encadeada, sem sintaxe BEM.
   ✅ `.saldo-grande.negativo`, `.delta.pos`, `.navegacao button.ativo`
   ❌ `.saldo-grande--negativo`, `.delta__pos`

## Conteúdo da classe

5. **Cor, fundo e raio só via token/escala** (`var(--...)` e raios de `fundamentos.md`:
   12/18/20/24/999px). Única exceção: `#fff` como texto sobre fundo azul sólido.
   ✅ `background: var(--surface2); border-radius: 12px;`
   ❌ `background: #1c2230; border-radius: 10px;`
6. **Vai exibir número?** → `font-variant-numeric: tabular-nums`.
7. **Sem `border`** para separar superfícies (contraste de fundo separa); `--line` só em
   separador de tabela/nav.

## Onde inserir em `src/styles.css`

8. Classe compartilhada: junto do bloco de classes afins (botão perto de `.botao`, texto
   perto de `.rotulo`, formulário perto de `.campo`).
9. Classe de componente: no bloco comentado do componente, ao fim do arquivo
   (`/* ---- Nome (Arquivo.tsx) ---- */`); crie o bloco se não existir.
10. Ajuste desktop: dentro do `@media (min-width: 900px)` **existente** — nunca criar outro
    breakpoint.

## Checklist de saída

- [ ] Nome em português kebab-case; prefixado se for de componente
- [ ] Sem cor/raio/fonte hardcoded (fora a exceção `#fff` sobre azul)
- [ ] Inserida na seção certa de `styles.css` (regras 8–10)
- [ ] Se compartilhada: **linha adicionada à tabela do `catalogo.md` no mesmo commit**
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-2-nova-classe.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-2-nova-classe.md
git commit -m "docs(estilo): capitulo nivel 2 (nova classe css)"
```

---

### Task 6: `docs/estilo/nivel-3-novo-token.md`

**Files:**
- Create: `docs/estilo/nivel-3-novo-token.md`

**Interfaces:**
- Consumes: `fundamentos.md` (tabela de tokens que este nível atualiza), `nivel-6-mudanca-de-linguagem.md` — citados por nome.
- Produces: capítulo roteado pelo índice para "criar token/cor nova".

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 3 — Criar um token novo

**Você está no nível certo?** Sim, se uma classe nova (nível 2) precisa de uma **cor com
significado** que nenhum token cobre. Token novo é raro — o app inteiro tem 13.
- Mudar o **valor** de um token existente, criar tema, fonte nova, raio novo ou outra cor de
  ação → `nivel-6-mudanca-de-linguagem.md`. PARE lá.

## Antes de criar, prove que não existe

1. Ação/navegação/seleção → é `--ac`. Dinheiro/saldo → `--pos`/`--neg`. Superfície/elevação
   → `--surface`/`--surface2`. Texto → `--fg`/`--muted`. Destaque de alerta → `--aviso-*`.
   Se a resposta está nessa lista, volte ao nível 2.
2. Token novo só para **significado semântico novo** — uma categoria de informação que o app
   ainda não comunica por cor (foi o caso de `--aviso-*`). Se é só "um tom diferente para
   ficar bonito", não é token: é nível 6 (mudança de linguagem).

## Regras

3. **Par cor + fundo translúcido:** declare a cor plena `--x` e, se ela aparecer em
   pílula/fundo, `--x-bg` com alpha `.13`–`.14`.
   ✅ `--pos: #2ee6a8; --pos-bg: rgba(46, 230, 168, .14);`
4. Exceção ao par: faixas de destaque não-monetárias usam fundo opaco escuro + texto claro,
   como `--aviso-bg: #423306; --aviso-fg: #fcd34d` — siga esse padrão nesses casos.
5. **Nome em português** para semântica de produto (`--aviso-*`). As abreviações `--ac`,
   `--pos`, `--neg` são herança — não criar abreviação nova.
6. Declarar **apenas** no `:root` de `src/styles.css`; a cor crua nunca aparece fora dele.
7. A cor precisa ser legível sobre `--bg` **e** sobre `--surface` (o app é dark-only);
   alvo de contraste para texto: ~4.5:1 (AA).

## Checklist de saída

- [ ] Token declarado em `:root`, usado no CSS só via `var(--...)`
- [ ] Par `--x`/`--x-bg` criado se houver uso em pílula/fundo
- [ ] **Linha adicionada à tabela de tokens de `fundamentos.md` no mesmo commit**
- [ ] Nenhum valor de token existente foi alterado (isso seria nível 6)
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-3-novo-token.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-3-novo-token.md
git commit -m "docs(estilo): capitulo nivel 3 (novo token)"
```

---

### Task 7: `docs/estilo/nivel-4-novo-componente.md`

**Files:**
- Create: `docs/estilo/nivel-4-novo-componente.md`

**Interfaces:**
- Consumes: `nivel-2-nova-classe.md` (regras de prefixo e catalogação), `transversais.md`, `catalogo.md` — citados por nome.
- Produces: capítulo roteado pelo índice para "criar componente compartilhado".

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 4 — Criar um componente compartilhado

**Você está no nível certo?** Sim, se o mesmo markup + comportamento aparece (ou vai
aparecer) em 2+ lugares, **ou** o elemento tem estado/gesto próprio (animação, drag,
teclado).
- Markup repetido mas trivial (2–3 linhas com classes do catálogo) → apenas repita; não
  abstraia.
- É uma tela inteira → `nivel-5-nova-tela.md`.

## Regras

1. **Arquivo:** `src/ui/<Nome>.tsx`, PascalCase em português (`FaturaResumo.tsx`); teste em
   `src/ui/<Nome>.test.tsx` **no mesmo commit**.
2. **Classes CSS do componente:** prefixadas com o nome do componente (nível 2, regra 3), em
   bloco comentado próprio no fim de `src/styles.css`.
   ✅ `/* ---- Fatura resumo (FaturaResumo.tsx) ---- */` com `.fatura-resumo-*`
3. **Modal deslizante → use `Sheet.tsx`.** Não crie outro mecanismo de sheet. Formulários de
   Ajustes ficam inline (decisão registrada; mudar isso = nível 6).
4. **Dependência pesada** (gráficos, parsing) → `React.lazy` + `Suspense`, como o `recharts`
   em `FluxoChartModal`.
5. **Animação:** só as receitas de `transversais.md`.
6. **Props em português e interface mínima (YAGNI):** comece com as props que a primeira
   tela consumidora precisa; nada "para o futuro".

## Checklist de saída

- [ ] `src/ui/<Nome>.tsx` + `src/ui/<Nome>.test.tsx` criados juntos
- [ ] Classes novas prefixadas e com o checklist do nível 2 cumprido
- [ ] Procurou em `src/ui/` antes — nenhum componente existente faz o mesmo papel
- [ ] **Bullet adicionado em "Componentes compartilhados" do `catalogo.md` no mesmo commit**
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-4-novo-componente.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-4-novo-componente.md
git commit -m "docs(estilo): capitulo nivel 4 (novo componente)"
```

---

### Task 8: `docs/estilo/nivel-5-nova-tela.md`

**Files:**
- Create: `docs/estilo/nivel-5-nova-tela.md`

**Interfaces:**
- Consumes: `catalogo.md`, `nivel-2-nova-classe.md`, `nivel-4-novo-componente.md`, `transversais.md` — citados por nome.
- Produces: capítulo roteado pelo índice para "criar tela nova".

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 5 — Criar uma tela nova

**Você está no nível certo?** Sim, se vai existir um arquivo de tela novo: aba principal
(`src/ui/Tela<Nome>.tsx`) ou subtela de Ajustes (`src/ui/ajustes/<Nome>.tsx`).
- **Aba nova na navegação é decisão de produto**, não de estilo — confirme com o usuário
  antes de implementar.

## Estrutura

1. **Arquivo:** `Tela<Nome>.tsx` em `src/ui/` (ou `src/ui/ajustes/<Nome>.tsx` para subtela
   de Ajustes); teste `.test.tsx` no mesmo commit.
2. **Esqueleto:** `.tela` como wrapper > blocos `.card` e/ou `.secao` + `.lista`/`.item`.
   ✅ `<div className="tela"><h2>Título</h2><section className="card">…</section></div>`
3. Reaproveite o `catalogo.md` (regras do nível 1 valem aqui); classe nova só via nível 2;
   componente novo só via nível 4.

## Conteúdo

4. **Dinheiro:** `formatarBRL` + `.valor-ganho`/`.valor-gasto`; conjunto denso de números →
   `table.tabela` (a cor sem pílula já é automática lá).
5. **No máximo UMA ação principal azul por tela** (`.botao-primario`); demais `.botao` /
   `.botao-perigo`.
6. **Estado vazio:** texto `.sub` explicando o que aparecerá ali.
   ❌ Ilustração, emoji grande ou ícone decorativo de estado vazio.
7. **Título, textos e `aria-label`: português.**

## Integração

8. Aba principal: registrar a rota/botão em `Shell.tsx` — a transição de conteúdo já vem do
   `Shell`; não adicione outra animação de entrada.
9. Subtela de Ajustes: formulário **inline** (sem sheet), seguindo o padrão de
   `TelaAjustes.tsx` e `src/ui/ajustes/`.

## Checklist de saída

- [ ] `.tela` na raiz; classes do catálogo; sem `max-width`/breakpoint próprios
- [ ] Testado em mobile (tab bar embaixo) e desktop ≥900px (sidebar)
- [ ] `.test.tsx` cobrindo a renderização principal, no mesmo commit
- [ ] Classes/componentes novos passaram pelos níveis 2/4 (inclusive catalogação)
- [ ] Regras de `transversais.md` respeitadas
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-5-nova-tela.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-5-nova-tela.md
git commit -m "docs(estilo): capitulo nivel 5 (nova tela)"
```

---

### Task 9: `docs/estilo/nivel-6-mudanca-de-linguagem.md`

**Files:**
- Create: `docs/estilo/nivel-6-mudanca-de-linguagem.md`

**Interfaces:**
- Consumes: `fundamentos.md`, `transversais.md` — citados por nome.
- Produces: capítulo roteado pelo índice para mudanças de princípio; citado pelos níveis 3 e 4 como destino de escalada.

- [ ] **Step 1: Criar o arquivo com este conteúdo exato**

````markdown
# Nível 6 — Mudar a linguagem visual

**Você está no nível certo?** Sim, se a mudança altera qualquer regra de `fundamentos.md` ou
`transversais.md`. Sinais claros: criar tema claro · nova cor de ação · verde/vermelho fora
de dinheiro · borda em card/item · fonte nova · mudar valor de token · raio fora da escala ·
tipo de animação novo · sheet para formulários de Ajustes.

## Regra única

**PARE. Não implemente.** Mudança de linguagem não é decisão de implementação:

1. Abra uma conversa de brainstorming com o usuário e registre a decisão em uma spec:
   `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` (o quê, por quê, o que substitui).
2. Só depois da spec aprovada: atualize `fundamentos.md`/`transversais.md` (a regra nova),
   os capítulos de nível afetados e **então** o código.
3. Guia e código mudam no mesmo branch — o guia nunca fica mentindo sobre o app.

**Se você é um subagente** executando uma tarefa e caiu neste nível sem que a tarefa cite
uma spec aprovada: **interrompa e reporte ao orquestrador.** Não decida sozinho.
````

- [ ] **Step 2: Verificar que o arquivo existe**

Run: `ls docs/estilo/nivel-6-mudanca-de-linguagem.md`
Expected: o caminho é listado sem erro.

- [ ] **Step 3: Commit**

```bash
git add docs/estilo/nivel-6-mudanca-de-linguagem.md
git commit -m "docs(estilo): capitulo nivel 6 (mudanca de linguagem)"
```

---

### Task 10: Índice — reescrever `docs/estilo-visual.md`

**Files:**
- Modify: `docs/estilo-visual.md` (substituir TODO o conteúdo — a fotografia antiga já migrou para os capítulos nas Tasks 1–9)

**Interfaces:**
- Consumes: todos os arquivos de `docs/estilo/` criados nas Tasks 1–9 (o índice linka cada um).
- Produces: o roteador que qualquer sessão/subagente consulta antes de editar UI.

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo por este**

````markdown
# Guia de estilo do Flow — índice

**Consulte este índice antes de QUALQUER edição de UI.** Ele leva ao capítulo do seu nível
de edição em `docs/estilo/` — leia o capítulo indicado (são curtos) antes de escrever
código. Se código e guia divergirem, o código manda — atualize o guia junto com a mudança.

## Que mudança você vai fazer?

| Vou... | Leia | Junto com |
|---|---|---|
| mudar uma tela existente com o que já existe | [`nivel-1-editar-tela.md`](estilo/nivel-1-editar-tela.md) | `catalogo.md` |
| criar uma classe CSS nova | [`nivel-2-nova-classe.md`](estilo/nivel-2-nova-classe.md) | `catalogo.md`, `fundamentos.md` |
| criar um token/cor nova | [`nivel-3-novo-token.md`](estilo/nivel-3-novo-token.md) | `fundamentos.md` |
| criar/extrair componente compartilhado | [`nivel-4-novo-componente.md`](estilo/nivel-4-novo-componente.md) | `catalogo.md`, `transversais.md` |
| criar uma tela nova | [`nivel-5-nova-tela.md`](estilo/nivel-5-nova-tela.md) | `catalogo.md`, `fundamentos.md` |
| mudar princípio, tema, fonte, cor de ação ou valor de token | [`nivel-6-mudanca-de-linguagem.md`](estilo/nivel-6-mudanca-de-linguagem.md) | — |

**Em dúvida entre dois níveis, o número maior ganha.** Animação ou acessibilidade em
qualquer nível: [`transversais.md`](estilo/transversais.md).

## Referências (não são níveis)

- [`fundamentos.md`](estilo/fundamentos.md) — princípios, tokens, escalas. Mudar isto = nível 6.
- [`catalogo.md`](estilo/catalogo.md) — classes e componentes existentes. **Quem cria, cataloga.**
- [`transversais.md`](estilo/transversais.md) — movimento (receitas framer-motion) e acessibilidade.

Decisões pontuais históricas: specs em `docs/superpowers/specs/`.
````

- [ ] **Step 2: Verificar que todos os links do índice resolvem**

Run (bash):

```bash
for f in fundamentos catalogo transversais nivel-1-editar-tela nivel-2-nova-classe nivel-3-novo-token nivel-4-novo-componente nivel-5-nova-tela nivel-6-mudanca-de-linguagem; do
  test -f "docs/estilo/$f.md" && echo "OK $f" || echo "FALTA $f"
done
```

Expected: nove linhas `OK ...`, nenhuma `FALTA`.

- [ ] **Step 3: Verificar que o índice ficou curto e sem conteúdo próprio**

Run: `wc -l docs/estilo-visual.md`
Expected: ~35–45 linhas (só roteamento; nenhuma tabela de tokens ou catálogo aqui).

- [ ] **Step 4: Commit**

```bash
git add docs/estilo-visual.md
git commit -m "docs(estilo): estilo-visual.md vira indice roteador dos capitulos por nivel"
```

---

## Pós-implementação (sessão principal — NÃO é tarefa de subagente)

- Atualizar a memória persistente do assistente (`reference_estilo_visual.md` no diretório de
  memória) para descrever a estrutura nova: índice em `docs/estilo-visual.md` + capítulos por
  nível em `docs/estilo/`, consulta obrigatória do índice antes de editar UI.
