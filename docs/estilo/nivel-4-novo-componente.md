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
