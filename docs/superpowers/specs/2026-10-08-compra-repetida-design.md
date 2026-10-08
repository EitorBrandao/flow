# Aviso de compra repetida no cartão

Estende o [aviso de lançamento repetido](2026-10-08-lancamento-repetido-design.md) às compras no cartão.

## Regra de domínio

`compraRepetida`, em `src/domain/lancamentoRepetido.ts`. Duas compras são iguais quando têm o mesmo cartão, a mesma data, o mesmo valor total e o mesmo número de parcelas. Compra gerada por assinatura também conta.

## Interface

`FormCompra.tsx`, só ao criar compra nova. Ao tocar em **Salvar**, se houver compra igual, o formulário não grava e abre o `ConfirmarRepetidoSheet`:

- título "Compra repetida?";
- frase "Já existe uma compra de R$ X em Nx no cartão C, feita em dd/mm/aaaa: “descrição”." — à vista, "à vista" no lugar de "em 1x";
- botões **Cancelar** e **Salvar mesmo assim**.

Editar compra não pergunta. O toque duplo em Salvar ganha a mesma trava que o Lançar.

## Mudança no componente

`ConfirmarRepetidoSheet` deixa de conhecer `Lancamento`. Recebe `aberto`, `titulo`, `frase`, `apoio`, `rotuloConfirmar`, `onCancelar` e `onConfirmar`. `TelaLancar` e `FormCompra` montam a própria frase.

## Fora do escopo

Compras importadas por lote e assinaturas geradas automaticamente: não passam pelo formulário.
