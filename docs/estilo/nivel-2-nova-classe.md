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
