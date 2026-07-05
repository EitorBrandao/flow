# Redesign visual do Flow — dark-first minimalista

**Data:** 2026-07-05
**Status:** aprovado em brainstorming (mockup interativo validado pelo usuário)
**Mockup de referência:** `flow-conceito.html` (scratchpad da sessão; valores de cor transcritos abaixo)

## Objetivo

Transformar a cara do Flow de "site de 2009" para "aplicativo nativo", **sem alterar nenhuma funcionalidade**. Todas as telas, fluxos e comportamentos atuais permanecem; muda apenas apresentação, navegação visual e microinterações.

## Decisões (validadas com o usuário)

1. **Direção:** dark-first minimalista. O app passa a ser **somente tema escuro** (remove o tema claro e a media query `prefers-color-scheme`). Identidade única e consistente.
2. **Papel das cores:**
   - **Azul** (`#3b9df8`) é a única cor de ação: botão primário, confirmar, FAB "+", aba ativa, links "ver tudo", focus ring.
   - **Verde** (`#2ee6a8`) e **vermelho** (`#ff6b7a`) são exclusivos de **valores monetários** (ganho/gasto) e do gráfico de saldo. Nunca em botões ou navegação.
3. **Valores em pílulas de contraste:** todo valor monetário em listas aparece dentro de uma pílula com fundo tingido translúcido (verde ~14% para ganhos, vermelho ~13% para gastos), texto na cor plena.
4. **Sem ícones decorativos nos itens de lista** — título forte + subtítulo apagado apenas. Barra de navegação com rótulos de texto (sem ícones). Ícones utilitários pontuais (engrenagem, chevron, ✓, ✕) via **lucide-react**.
5. **Escopo:** visual **+ estrutura** — bottom sheets para editores, tab bar estilo app com FAB, transições com **framer-motion**.

## Design tokens (novo `styles.css`)

```css
:root {
  --bg: #0b0d11;        /* fundo do app */
  --surface: #161b24;   /* cards e itens */
  --surface2: #212836;  /* inputs, botão secundário, camada elevada */
  --fg: #e9edf3;
  --muted: #8b95a3;
  --line: #232936;      /* separadores raros (ex.: borda do nav) */
  --ac: #3b9df8;        --ac-dim: rgba(59,157,248,.14);
  --pos: #2ee6a8;       --pos-bg: rgba(46,230,168,.14);
  --neg: #ff6b7a;       --neg-bg: rgba(255,107,122,.13);
  --aviso-bg: #423306;  --aviso-fg: #fcd34d;
}
```

- **Raios:** cards 20px; itens de lista 18px; botões e inputs 12px; chips/pílulas 999px; FAB 18px.
- **Tipografia:** mantém `system-ui`; saldo grande 38px/800 com `letter-spacing: -0.03em` e centavos em `--pos`/`--neg`; títulos de seção 15px/700; subtítulos 12.5–13px em `--muted`; números sempre `tabular-nums`.
- **Sem bordas em cards/itens** — separação por contraste de superfície (`--surface` sobre `--bg`), não por linha cinza.
- Variáveis antigas (`--card`, `--border`, `--accent`, `--ganho`, `--gasto`) são substituídas pelas novas em todos os usos.

## Linguagem de componentes

- **Card** (`.card`): fundo `--surface`, raio 20px, padding 20px, sem borda nem sombra.
- **Item de lista** (`.item`): card individual (raio 18px, gap 14px entre itens via container), não mais linhas com `border-bottom`. Título 15px/600, subtítulo em `--muted`.
- **Pílula de valor** (`.val.pos` / `.val.neg`): substitui `.valor-ganho`/`.valor-gasto` em listas; padding 6px 12px, raio 12px, fundo tingido. Em contextos de tabela (Fluxo, Análises) o valor pode ficar sem pílula, só na cor, para não poluir.
- **Botões:** primário = fundo `--ac`, texto branco; secundário = fundo `--surface2`, texto `--muted`; perigo = texto `--neg` (fundo `--surface2`). Sem bordas. Altura confortável (~44px de área de toque).
- **Chips** (`.chip`): pílula `--surface` usada no topo (seletor de box, engrenagem) e em filtros.
- **Badge de projeção** (`.delta`): pílula tingida com seta ▲/▼, usada no card de saldo ("▲ R$ X nos próximos 28 dias" = variação do saldo projetado no horizonte visível do gráfico).
- **Inputs e selects:** fundo `--surface2`, sem borda, raio 12px, focus ring azul (`outline: 2px solid --ac`). Labels pequenos em `--muted`.
- **Aviso** (backup, etc.): mantém pílula âmbar, raio 12px.
- **Cabeçalhos de seção** (`.secao`): substituem `h2` soltos — título à esquerda, contagem/ação à direita em azul (ex.: "Pendentes | 2 itens").

## Estrutura das telas

### Shell
- **Topo:** chip do seletor de box à esquerda (pílula com ▾), chip da engrenagem (ícone lucide `Settings`) à direita. Remove o título "Flow" central. Topo sem fundo sólido — integra ao `--bg`.
- **Tab bar (mobile):** fixa embaixo, fundo `rgba(15,18,24,.92)` com `backdrop-filter: blur(12px)`, borda superior `--line`, respeita `safe-area-inset-bottom`. Aba ativa: texto azul + fundo `--ac-dim` em pílula. FAB central "+" 52px, raio 18px, fundo azul, sombra azulada, elevado −14px.
- **Desktop (≥900px):** mantém sidebar à esquerda com o mesmo tratamento (item ativo com fundo `--ac-dim`, FAB vira botão retangular).

### Bottom sheet (novo componente `Sheet`)
- Painel que sobe de baixo com fundo `--surface`, raio superior 24px, alça (handle) no topo, backdrop escurecido; fecha por backdrop, botão ou arraste para baixo (drag via framer-motion).
- Passa a hospedar: **LancEditor** (edição de lançamento) e os formulários de criação/edição em Ajustes (categorias, boxes, cartões, recorrências, assinaturas) que hoje aparecem inline.
- **TelaLancar continua sendo uma aba** (aberta pelo FAB), não vira sheet — é fluxo principal, merece tela cheia.

### Transições (framer-motion)
- Troca de aba: fade + leve deslize (~150–200ms).
- Sheet: slide-up com mola, drag-to-dismiss.
- Itens de lista ao confirmar/descartar pendente: animação de saída (colapso + fade).
- Nada de animação em dados (gráfico não anima em v1).

### Gráfico de saldo (BalanceChart)
- Linha verde `--pos` 2.5px com preenchimento em gradiente vertical (verde 25% → transparente).
- Marcador "hoje": ponto verde + linha vertical tracejada `--line`.
- Cenários (linhas extras) em azul tracejado fino.
- Eixos/labels em `--muted`, sem molduras.

### Telas (todas re-skin, mesma lógica)
- **Hoje:** card herói do saldo (rótulo maiúsculo pequeno, saldo 38px, badge delta, gráfico integrado ao card); conferência de saldo dentro do mesmo card; pendentes como cards com botões Confirmar (azul) / Descartar (secundário) em linha própria.
- **Fluxo, Análises:** tabelas mantêm layout tabular, mas sem bordas verticais, linhas separadas por `--line` sutil, cabeçalho em `--muted` maiúsculo pequeno.
- **Lançar:** grade de categorias com células `--surface2`, selecionada com fundo `--ac-dim` + texto azul (substitui o outline).
- **Cartão, Simulador, Ajustes e subtelas:** aplicam a mesma linguagem (cards, chips, pílulas, sheets nos formulários).

## Dependências novas

- `lucide-react` — ícones utilitários (Settings, ChevronDown, Check, X, Plus).
- `framer-motion` — transições de aba, bottom sheet com drag, saída de itens.

## Restrições

- **Zero mudança de comportamento:** nenhuma alteração em `domain/`, `db/`, `state/`, `importer/`, `backup/`. Apenas `src/ui/**` e `styles.css` (e `package.json`).
- **Testes existentes continuam passando.** Eles consultam texto e roles — os rótulos, `aria-label`s e textos visíveis atuais devem ser preservados. Onde um formulário migrar para dentro do `Sheet`, o conteúdo renderizado deve manter os mesmos elementos acessíveis.
- PWA continua leve: framer-motion + lucide (tree-shaken) ≈ +35kb gzip aceitos pelo usuário.

## Critérios de sucesso

1. `npm run test` verde sem alterar asserções de comportamento (ajustes de seletores/wrappers são aceitáveis).
2. `npm run build` sem erros.
3. Visual conferido no celular via `npm run preview -- --host` (hábito do projeto).
4. Nenhuma funcionalidade perdida: todos os fluxos (lançar, confirmar, editar, importar, backup, cartão, simulador) operáveis.

## Fora de escopo

- Tema claro.
- Ícones na tab bar.
- Animações no gráfico.
- Mudanças de navegação/informação (mesmas abas, mesmos dados).
