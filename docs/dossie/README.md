# Dossiê de comportamento

Os quatro arquivos desta pasta descrevem o app inteiro em ação: um roteiro sintético de 12
meses, rodado pelo motor de projeção e de fatura de verdade, com o texto de cada tela
capturado em oito cortes de tempo.

- `00-roteiro.md` — os passos do roteiro, em ordem cronológica.
- `01-invariantes.md` — o resultado de cada invariante do domínio, em cada corte.
- `02-motor.md` — os números que o motor calculou: saldos, marcos da projeção e faturas.
- `03-telas.md` — o texto de cada aba, como o app realmente renderiza.

**Este conteúdo é gerado. Nunca edite estes quatro arquivos à mão.** Eles nascem de
`src/dossie/roteiro.ts` e do código do app — editar o markdown direto só cria uma
divergência que o guarda (`src/dossie/dossie.test.ts`) reprova no próximo `npm test`.

Para regenerar depois de mudar o roteiro ou o comportamento do app:

```
npm run dossie
```

Um conflito de merge nestes quatro arquivos se resolve regenerando, nunca editando à mão:
aceite qualquer lado (ou descarte os dois), rode `npm run dossie` de novo, e faça o commit do
resultado.
