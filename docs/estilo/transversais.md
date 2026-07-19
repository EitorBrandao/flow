# Transversais — movimento e acessibilidade

Referência válida em **qualquer** nível de edição.

## Movimento (framer-motion)

Receitas estabelecidas — use exatamente estas, não invente tempos novos:

| Contexto | Receita |
|---|---|
| Troca de conteúdo (aba, subtela) | `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.18, ease: 'easeOut' }}` (já vem do `Shell` para abas — não duplique) |
| Backdrop (fade) | `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}`, `transition={{ duration: 0.15 }}` |
| Sheet (entrada) | `initial={{ y: '100%' }}` → `animate={{ y: 0 }}`, `transition={{ type: 'spring', damping: 32, stiffness: 340 }}` |
| Reordenar lista (arrastar) | `Reorder.Group`/`Reorder.Item` do framer-motion, `axis="y"`, física padrão (spring interno do framer-motion) — não customizar `transition` |

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
