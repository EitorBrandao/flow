# Cor no mín/máx do rodapé dos gráficos (Hoje, Fluxo, modal expandido)

**Data:** 2026-07-23
**Status:** aprovado em brainstorming (mockup HTML com 3 cenários de sinal)

## Objetivo

O rodapé "mín · máx" sob o gráfico de saldo (aba Hoje, aba Fluxo, e o modal de gráfico
expandido do Fluxo) hoje é todo cinza (`--muted`), sem indicar se o mínimo/máximo do
período é positivo ou negativo. Este spec colore cada valor pelo próprio sinal —
verde (`--pos`) quando `>= 0`, vermelho (`--neg`) quando `< 0` — mantendo o resto do rodapé
(rótulos "mín"/"máx", separador "·", datas de borda) em `--muted`, sem alterar o peso visual
do rodapé (continua 12px, sem pílula).

## Decisões (validadas com o usuário)

1. **Mockup HTML comparando duas opções antes de decidir**, com 3 cenários de sinal (mín
   negativo/máx positivo, ambos positivos, ambos negativos):
   - **A** — reaproveitar `.valor-ganho`/`.valor-gasto` (pílula 14.5px/700), rejeitada: ficava
     mais pesada que o resto da linha (data 12px cinza ao lado), competindo com o gráfico.
   - **B** — classe nova, mesma tipografia do rodapé atual (12px, sem pílula), só a cor muda.
     **Escolhida.**
2. **Regra de cor é pelo sinal do próprio valor, não pelo papel** (não é "mín sempre
   vermelho, máx sempre verde"). Se o mínimo do período for positivo, aparece verde também.
3. **Escopo: os três rodapés** — `BalanceChart.tsx` (usado em `TelaHoje.tsx` e
   `TelaFluxo.tsx`) e `.grafico-expandido-rodape` em `FluxoChartModal.tsx`.
4. **Corrige de passagem uma divergência preexistente:** o rodapé do `BalanceChart` hoje é
   um `<div className="linha" style={{ justifyContent: 'space-between', fontSize: 12, color:
   'var(--muted)' }}>` — cor via `style` inline já violava `nivel-1-editar-tela.md` regra 2
   antes desta mudança. Vira uma classe própria (`.grafico-rodape`) no mesmo commit, já que a
   linha está sendo tocada de qualquer forma.
5. **Modificador `.pos`/`.neg` fica no elemento do valor, não no container do rodapé** — cada
   linha tem dois valores (mín e máx) que podem ter sinais diferentes na mesma linha, então
   encadear o modificador no container (como `.total-dia.pos`) não serve; o padrão vira
   descendente (`.grafico-rodape .pos`), reaproveitado também por `.grafico-expandido-rodape`.

## Componentes afetados

### `src/styles.css`

Novo bloco de classe compartilhada, perto de `.linha`/`.valor-ganho` (regra 8 de
`nivel-2-nova-classe.md`):

```css
.grafico-rodape {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums;
}
.grafico-rodape .pos, .grafico-expandido-rodape .pos { color: var(--pos); }
.grafico-rodape .neg, .grafico-expandido-rodape .neg { color: var(--neg); }
```

`.grafico-expandido-rodape` (bloco do `FluxoChartModal.tsx`, já existente em
`src/styles.css`) não muda — só ganha os dois seletores descendentes acima.

### `src/ui/BalanceChart.tsx`

Troca a `div` com `style` inline por `className="grafico-rodape"`; envolve cada valor
formatado num `<b>` com `pos`/`neg` conforme o sinal:

```tsx
<div className="grafico-rodape">
  <span>{serie[0].data.slice(8, 10)}/{serie[0].data.slice(5, 7)}</span>
  <span>
    mín <b className={min >= 0 ? 'pos' : 'neg'}>{formatarBRL(min)}</b>
    {' · máx '}
    <b className={max >= 0 ? 'pos' : 'neg'}>{formatarBRL(max)}</b>
  </span>
  <span>{serie.at(-1)!.data.slice(8, 10)}/{serie.at(-1)!.data.slice(5, 7)}</span>
</div>
```

### `src/ui/FluxoChartModal.tsx`

Mesma lógica dentro do `.grafico-expandido-rodape` existente:

```tsx
<div className="grafico-expandido-rodape">
  mín <b className={min >= 0 ? 'pos' : 'neg'}>{formatarBRL(min)}</b>
  {' · máx '}
  <b className={max >= 0 ? 'pos' : 'neg'}>{formatarBRL(max)}</b>
</div>
```

### `docs/estilo/catalogo.md`

Adicionar linha na tabela de classes compartilhadas: `.grafico-rodape` (+ `.pos`/`.neg`) —
rodapé "mín · máx" sob o gráfico de saldo (Hoje, Fluxo); modificadores reaproveitados também
por `.grafico-expandido-rodape` (modal).

## Testes

- `FluxoChartModal.test.tsx` já tem um teste (linha 69-74) que faz `getByText` no texto
  inteiro do rodapé como string única. **Isso quebra** com o `<b>` novo: `getByText` só
  concatena os nós de texto **diretos** do elemento (não desce em filhos-elemento), então o
  texto some do match assim que o valor vira filho de um `<b>`. Ajustar esse teste para
  `toHaveTextContent` (que recursa no `textContent` completo, incluindo descendentes) em vez
  de `getByText` na string inteira. Atenção ao espaçamento na JSX de qualquer forma (por
  isso `{' · máx '}` explícito acima, em vez de quebra de linha entre elementos) — afeta o
  texto renderizado independentemente de qual matcher o teste usa.
- Adicionar casos cobrindo os 3 cenários de sinal do mockup (mín neg/máx pos, ambos pos,
  ambos neg) em `BalanceChart.test.tsx` e `FluxoChartModal.test.tsx`, verificando que o
  elemento do valor tem a classe `pos` ou `neg` esperada.

## Critérios de sucesso

1. `npm test` verde, incluindo os casos novos de sinal.
2. `npm run build` sem erros.
3. Conferido no celular via `npm run deploy` (ao fim do ciclo): nas abas Hoje e Fluxo, e no
   modal expandido do Fluxo, mín/máx aparecem coloridos pelo próprio sinal, sem alterar o
   tamanho/peso do rodapé.

## Fora de escopo

- Qualquer outro valor monetário fora desses três rodapés.
- Mudar a regra de cor para "papel" (mín sempre vermelho, máx sempre verde) — rejeitada nas
  perguntas de brainstorming.
