# Contraste dos cards/itens contra o fundo

**Data:** 2026-07-17
**Status:** aprovado em brainstorming (mockup interativo com 3 opções + escolha personalizada)

## Objetivo

`--surface` (`#161b24`, fundo de cards/itens de lista) é quase idêntico a `--bg`
(`#0b0d11`, fundo do app) — a única separação hoje é contraste de superfície (princípio
já documentado em `fundamentos.md`: "sem bordas em cards/itens"). Em telas com brilho
baixo, essa diferença fica praticamente imperceptível: o usuário não consegue ver onde
um item de lista termina e o próximo começa (relatado com print da aba Ajustes →
Recorrências).

Este spec só muda o **valor** dos tokens `--surface`/`--surface2` — não muda o princípio
de "separação por contraste, sem borda", só o quanto de contraste.

## Decisões (validadas com o usuário)

1. **Mockup interativo antes de decidir.** Foram apresentadas 3 variações lado a lado
   (moderado, forte, personalizado com color-picker ao vivo) reproduzindo a tela real de
   Recorrências. O usuário escolheu **moderado**.
2. **Valores escolhidos:**
   - `--surface`: `#161b24` → `#1c2331`
   - `--surface2`: `#212836` → `#29334a`
3. **`--bg` não muda.** O ajuste é só nos tokens de superfície — o fundo do app continua
   `#0b0d11`.
4. **Escopo é global, não por tela.** `--surface`/`--surface2` são consumidos por várias
   classes (`.card`, `.item`, `.chip`, `.botao`, `.badge`, inputs, `.sheet-alca`, etc.) —
   mudar o valor do token propaga pro app inteiro automaticamente. Nenhuma classe muda de
   token, só o valor que os tokens já usados apontam.

## Componentes afetados

### `docs/estilo/fundamentos.md`

Tabela de tokens (linhas 36-37): atualizar os valores de `--surface` e `--surface2` para
`#1c2331` e `#29334a`.

### `src/styles.css`

`:root` (linhas 2-3): atualizar os mesmos valores. Nenhuma outra classe muda — todas já
referenciam os tokens por nome.

## Testes

Nenhum teste automatizado cobre cor (não há asserção de estilo computado nos testes
existentes). Verificação é visual.

## Critérios de sucesso

1. `npm run build` sem erros (troca de valor de token, não deveria quebrar nada).
2. Conferido no celular via `npm run deploy`: cards/itens de lista (Recorrências,
   Assinaturas, Hoje, Fluxo, Cartão, Análises) visivelmente separados do fundo em brilho
   baixo, sem parecer "chapado" com o `--bg`.

## Fora de escopo

- Estrutura do texto dentro dos itens de Recorrências/Assinaturas (word-wrap) — tratado à
  parte, reestruturando o JSX com as classes já existentes `.item-coluna`/`.linha-topo`/
  `.acoes` (nível 1/2, não nível 6, não precisa de spec).
- Qualquer outro token (`--ac`, `--pos`, `--neg`, `--line`, etc.) ou princípio de
  `fundamentos.md` além do valor de `--surface`/`--surface2`.
