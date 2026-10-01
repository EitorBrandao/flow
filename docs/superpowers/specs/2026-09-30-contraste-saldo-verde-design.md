# Contraste do saldo positivo em verde

Status: aprovada em 2026-10-01 — não implementada

## Objetivo

O verde do totalizador do dia no Fluxo (`--total-pos: #008000`) tem contraste insuficiente contra fundos escuros do app. A razão fica abaixo de 3 sobre `--surface` e `--bg`, tornando-o ilegível em certos contextos, especialmente na linha "hoje" com fundo próprio.

Este spec muda o valor de `--total-pos` para um verde mais claro, com contraste melhorado em todos os fundos.

## Decisões (validadas com o usuário)

1. **Novo valor:** `--total-pos: #4ade80` ("verde claro").
2. **Contraste medido:**
   - Sobre `--surface` (#1c2331): razão **9.03** ✓
   - Sobre `--bg` (#0b0d11): razão **11.16** ✓
   - Sobre `--hoje-bg` (#0d4a32): razão **5.90** ✓
   
   Todas as razões estão acima de 4.5:1, o mínimo exigido por acessibilidade (WCAG AA).

3. **`--total-neg` não muda:** continua em `#ff4d4d`.

4. **Escopo:** o novo valor é aplicado ao token existente (`--total-pos` em `src/styles.css:7`). Nenhuma estrutura HTML muda, nenhuma classe nova, nenhum componente afetado além da cor.

## Componentes afetados

### `src/styles.css`

Linha 7: trocar `--total-pos: #008000` por `--total-pos: #4ade80`.

### `docs/estilo/fundamentos.md`

Tabela de tokens (linha 42): atualizar o valor de `--total-pos` de `#008000` para `#4ade80` e renomear a cor de "verde-escuro" para "verde-claro" (ou manter só "verde", conforme o nível de detalhe da tabela).

## Testes

Nenhum teste automatizado cobre cor. Verificação é visual, na varredura da Tarefa 10.

## Critérios de sucesso

1. `npm run build` sem erros.
2. Conferido no celular via `npm run deploy`: no Fluxo, o total do dia aparece em verde claro, legível em todos os fundos (cabeçalho de dia, linha "hoje", gráfico Simular, Conferir), em dias positivos.

## Fora de escopo

- Qualquer outra tela/lista (Hoje, Cartão, Análises, Simular na pílula — só cabeçalho).
- `--total-neg` (vermelho).
