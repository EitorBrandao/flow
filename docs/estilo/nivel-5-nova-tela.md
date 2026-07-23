# Nível 5 — Criar uma tela nova

**Você está no nível certo?** Sim, se vai existir um arquivo de tela novo: aba principal
(`src/ui/Tela<Nome>.tsx`) ou subtela de Ajustes (`src/ui/ajustes/<Nome>.tsx`).
- **Aba nova, subtela de Ajustes nova, remoção ou renomeação de tela é decisão de
  produto**, não de estilo — confirme com o usuário antes de implementar. Vale para
  qualquer superfície que aparece ou some da navegação, não só a tab bar.

## Estrutura

1. **Arquivo:** `Tela<Nome>.tsx` em `src/ui/` (ou `src/ui/ajustes/<Nome>.tsx` para subtela
   de Ajustes); teste `.test.tsx` no mesmo commit.
2. **Esqueleto:** `.tela` como wrapper > blocos `.card` e/ou `.secao` + `.lista`/`.item`.
   ✅ `<div className="tela"><h2>Título</h2><section className="card">…</section></div>`
3. **Ação de criar/adicionar vem ANTES da lista existente** (formulário no topo, lista
   embaixo) — não force rolar até o fim da tela pra achar como adicionar algo.
4. Reaproveite o `catalogo.md` (regras do nível 1 valem aqui); classe nova só via nível 2;
   componente novo só via nível 4.

## Conteúdo

5. **Dinheiro:** `formatarBRL` + `.valor-ganho`/`.valor-gasto`; conjunto denso de números →
   `table.tabela` (a cor sem pílula já é automática lá).
6. **No máximo UMA ação principal azul por tela** (`.botao-primario`); demais `.botao` /
   `.botao-perigo`.
7. **Estado vazio:** texto `.sub` explicando o que aparecerá ali.
   ❌ Ilustração, emoji grande ou ícone decorativo de estado vazio.
8. **Título, textos e `aria-label`: português.**

## Integração

9. Aba principal: registrar a rota/botão em `Shell.tsx` — a transição de conteúdo já vem do
   `Shell`; não adicione outra animação de entrada.
10. Subtela de Ajustes: formulário **inline** (sem sheet), seguindo o padrão de
    `TelaAjustes.tsx` e `src/ui/ajustes/`.

## Checklist de saída

- [ ] `.tela` na raiz; classes do catálogo; sem `max-width`/breakpoint próprios
- [ ] Testado em mobile (tab bar embaixo) e desktop ≥900px (sidebar)
- [ ] `.test.tsx` cobrindo a renderização principal, no mesmo commit
- [ ] Classes/componentes novos passaram pelos níveis 2/4 (inclusive catalogação)
- [ ] Regras de `transversais.md` respeitadas
