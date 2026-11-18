# Interação — confirmar, avisar e ordenar botões

Referência transversal, como `transversais.md`: vale em qualquer nível de edição. Leia antes de criar um botão que grava ou apaga.

## Confirmar

1. O app nunca usa `window.confirm`, `window.alert` nem `window.prompt`. O teste `src/ui/semDialogoNativo.test.ts` bloqueia.
2. **Exclusão simples apaga na hora e oferece "Desfazer".** É simples quando apaga um registro só e o registro pode voltar idêntico. Chame `avisar(texto, desfazer)`.
3. **Exclusão em cascata, ou sem volta, pede confirmação no `ConfirmarSheet`.** Vale para o que apaga mais de um registro, muda outros registros, ou troca os dados todos.
4. No `ConfirmarSheet`: o título é a pergunta; o resumo mostra o item; o apoio diz o efeito em uma frase. O botão que apaga usa `perigo`. O que converte ou mescla fica azul. O sheet ignora o segundo toque em confirmar.

## Avisar

5. **Toda gravação dá retorno**, pelo `Retorno`: `avisar('Alteração salva')`. Frase curta, no passado, sem ponto final.
6. O aviso some sozinho: 3 s, ou 6 s quando tem "Desfazer". Um aviso novo substitui o anterior, e o "Desfazer" do anterior deixa de existir. Com um sheet aberto, o aviso sobe para logo acima da borda do sheet, para não cobrir o conteúdo dele.
7. O retorno não substitui o aviso de validação. Erro de preenchimento continua abaixo do botão, em `.aviso`.

## Ordenar botões

8. Numa linha de botões há no máximo um azul (`.botao-primario`): a ação que o usuário veio fazer.
9. A ação que só sai da tela, como Fechar e Cancelar, tem contorno e não tem fundo (`.botao-discreto`).
10. A ação destrutiva fica à esquerda, longe da principal (`.sheet-botoes` com `.empurra`). A principal é sempre a última à direita.

## Onde está aplicado

As regras 1 a 4 e 8 a 10 valem no editor de lançamento e em todas as confirmações desde a entrega da confirmação própria. A regra 5 e a regra 9 chegam às demais telas na entrega seguinte (`docs/superpowers/plans/2026-11-15-d2-retorno-ao-salvar.md`). Ao tocar numa tela que ainda não as segue, alinhe-a.
