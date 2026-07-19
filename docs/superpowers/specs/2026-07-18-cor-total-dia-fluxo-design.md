# Cor própria pro totalizador do dia (Fluxo)

**Data:** 2026-07-18
**Status:** aprovado em brainstorming (mockup interativo com sliders HSV)

## Objetivo

Na aba Fluxo, o totalizador do dia (saldo projetado ao lado da data, no cabeçalho de cada
dia) e o valor de cada transação dentro do dia usavam a mesma cor (`--pos`/`--neg`) — os
dois grupos se misturavam visualmente, dificultando separar "isto é o resumo do dia" de
"isto é um lançamento".

Este spec introduz um par de tokens novo, exclusivo do totalizador do dia, com um verde e
um vermelho mais fechados/sérios que o `--pos`/`--neg` vivo usado nas pílulas de transação.

## Decisões (validadas com o usuário)

1. **Mockup interativo antes de decidir**, com presets fixos e depois sliders de
   matiz/saturação/valor (HSV) — o `<input type="color">` nativo se mostrou pouco confiável
   no Android do usuário (valor escolhido não batia com o exibido), então o mockup final
   usa 3 `<input type="range">` (H 0-360°, S 0-100%, V 0-100%) com conversão HSV→hex em JS.
2. **Valores escolhidos:**
   - `--total-pos`: `#008000` (verde puro, HSV 120°/100%/50% — "verde, saturação máxima,
     metade do valor", nas palavras do usuário).
   - `--total-neg`: `#ff4d4d` (vermelho vivo, calibrado pelo usuário no slider).
3. **Escopo é só o cabeçalho do dia na aba Fluxo** (`.cabecalho-dia` em `TelaFluxo.tsx`). A
   pílula de valor de cada transação continua em `--pos`/`--neg` — não muda.
4. **Não reaproveita `.valor-ganho`/`.valor-gasto`.** Como o contexto (cabeçalho, sem
   pílula) e a cor são diferentes das pílulas de transação, o totalizador ganha classes
   próprias (`.total-dia` + modificador `.pos`/`.neg`), em vez de sobrecarregar as classes
   de pílula existentes com mais um significado.

## Componentes afetados

### `docs/estilo/fundamentos.md`

Tabela de tokens: adicionar `--total-pos` (`#008000`) e `--total-neg` (`#ff4d4d`) com uso
"totalizador do dia no Fluxo (cabeçalho, fora da pílula de transação)".

### `src/styles.css`

- Novos tokens em `:root`, perto de `--pos`/`--neg`:
  ```css
  --total-pos: #008000; --total-neg: #ff4d4d;
  ```
- Novas classes, perto de `.cabecalho-dia`:
  ```css
  .total-dia { font-variant-numeric: tabular-nums; }
  .total-dia.pos { color: var(--total-pos); }
  .total-dia.neg { color: var(--total-neg); }
  ```

### `src/ui/TelaFluxo.tsx`

No cabeçalho do dia, troca o `<strong className={valor-ganho/valor-gasto}>` do saldo por
`<strong className="total-dia pos/neg">`, mantendo o wrapper `<span className="sub">`
(mesmo tamanho de fonte de antes, só a cor muda):
```tsx
<span className="sub">
  <strong className={`total-dia ${(saldoPorDia.get(dia) ?? 0) >= 0 ? 'pos' : 'neg'}`}>
    {formatarBRL(saldoPorDia.get(dia) ?? 0)}
  </strong>
</span>
```

## Testes

Nenhum teste automatizado cobre cor. Verificação é visual.

## Critérios de sucesso

1. `npm run build` sem erros.
2. Conferido no celular via `npm run deploy`: no Fluxo, o total do dia aparece em
   verde/vermelho fechado, visualmente distinto da pílula de transação (`--pos`/`--neg`
   vivo), em dias positivos e negativos.

## Fora de escopo

- Qualquer outra tela/lista (Hoje, Cartão, Análises) — o par `--total-pos`/`--total-neg` é
  exclusivo do cabeçalho de dia no Fluxo por enquanto.
- Peso da fonte do totalizador (já resolvido em sessão anterior, `.lista-fluxo`).
