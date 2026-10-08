# Aviso de lançamento repetido

Status: aprovada em 2026-10-08 — implementada
Nota: saiu na v0.64.0; a regra foi estreitada para a categoria na versão seguinte.

## Objetivo

Avisar a pessoa quando ela vai lançar um valor igual a outro já lançado no mesmo dia. O aviso pega o toque duplo e o lançamento esquecido. Não atrapalha o caso normal.

## Regra de domínio

Função pura `lancamentoRepetido`, em `src/domain/lancamentoRepetido.ts`.

Entrada: lançamentos e o candidato `{ boxId, data, valor, categoriaId }`.
Saída: o primeiro lançamento igual, ou `null`.

Dois lançamentos são iguais quando têm a mesma box, a mesma data, o mesmo valor em centavos e a mesma categoria. A categoria já fixa o tipo (gasto ou ganho). Até a v0.65.0 a regra comparava só o tipo; o usuário pediu em 2026-10-08 que ela fosse mais estreita, para não avisar sobre dois gastos diferentes de mesmo valor.

Entram na comparação:
- lançamentos `efetivo` e `previsto`;
- com origem `manual` ou `recorrencia`.

Ficam fora:
- origem `cartao` e `transferencia`;
- qualquer lançamento com `cenarioId`.

## Interface

`TelaLancar.tsx`, nos dois modos:

- Simples: a data é hoje. A categoria é a que o lançamento vai usar, sem criar nada: a do atalho dos Frequentes, a da descrição, ou a "A classificar" que já existe. Sem nenhuma delas, não há o que comparar e não avisa.
- Avançado: a data e a categoria são as escolhidas.

Ao tocar em **Lançar**, se houver lançamento igual, a tela não salva. Abre o sheet `ConfirmarRepetidoSheet`, que usa o componente `Sheet`.

O sheet mostra:
- título "Lançamento repetido?";
- um `.aviso` com tipo, valor, data, box e descrição do lançamento existente;
- uma frase de apoio;
- os botões **Cancelar** e **Lançar mesmo assim**.

**Cancelar** fecha o sheet e mantém o formulário preenchido. **Lançar mesmo assim** salva sem checar de novo. Fechar o sheet por gesto ou Esc equivale a Cancelar.

O mockup aprovado está no chat de 2026-10-08.

## Fora do escopo

- Edição de lançamento (`LancEditor`): o lançamento já existe.
- Cenários (`FormItemCenario`): são hipotéticos.
- Transferência: o código gera as duas pontas.
- Compra no cartão.

## Testes

- Domínio: igual; valor diferente; data diferente; box diferente; categoria diferente do mesmo tipo; tipo diferente (gasto × ganho com mesmo valor); `previsto` conta; cartão, transferência e cenário não contam; lista vazia.
- Tela, Simples e Avançado: sem repetido salva direto; com repetido abre o sheet e não salva; Cancelar não salva e mantém o formulário; Lançar mesmo assim salva uma vez.

## Documentação

- `docs/estilo/catalogo.md`: entrada do `ConfirmarRepetidoSheet`.
- `docs/wiki/`: capítulo de lançar menciona a confirmação.
- `changelog.d/adicionado-aviso-lancamento-repetido.md`.
