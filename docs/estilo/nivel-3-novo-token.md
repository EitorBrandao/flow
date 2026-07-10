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
