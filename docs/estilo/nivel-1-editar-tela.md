# Nível 1 — Editar uma tela existente

**Você está no nível certo?** Sim, se a mudança usa apenas classes do `catalogo.md` e
componentes existentes, **sem tocar `src/styles.css`**.
- Precisa de uma classe que não existe → `nivel-2-nova-classe.md` antes de continuar.
- Vai criar um arquivo de tela novo → `nivel-5-nova-tela.md`.

## Regras

1. **Antes de escrever markup, escolha as classes no `catalogo.md`.**
   ✅ `<button className="item">` para um item de lista clicável
   ❌ `<div className="linha-lancamento" onClick={...}>` (classe inventada + div clicável)

2. **`style={{ }}` inline só para ajuste pontual de layout de UMA instância**, e só com
   propriedades de layout (`margin*`, `width`/`maxWidth`, `opacity`, `flex*`, `gap`).
   Nunca cor, raio, fonte, sombra ou borda — isso vem de classe/token; se precisar, é
   nível 2. O mesmo ajuste inline repetido em duas instâncias já é um estilo paralelo:
   vire classe (nível 2) em vez de copiar o `style`.
   ✅ `style={{ width: 120 }}` num input específico
   ❌ `style={{ background: '#212836', borderRadius: 12 }}` — cor e raio via classe/token
   ❌ o mesmo `style={{ marginTop: 12 }}` colado em cinco itens — é uma classe

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
