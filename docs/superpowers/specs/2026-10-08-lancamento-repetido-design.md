# Aviso de lançamento repetido

## Objetivo

Avisar a pessoa quando ela vai lançar um valor igual a outro já lançado no mesmo dia. O aviso pega o toque duplo e o lançamento esquecido. Não atrapalha o caso normal.

## Regra de domínio

Função pura `lancamentoRepetido`, em `src/domain/lancamentoRepetido.ts`.

Entrada: lançamentos, categorias e o candidato `{ boxId, data, valor, tipo }`.
Saída: o primeiro lançamento igual, ou `null`.

Dois lançamentos são iguais quando têm a mesma box, a mesma data, o mesmo valor em centavos e o mesmo tipo. O tipo vem da categoria do lançamento existente.

Entram na comparação:
- lançamentos `efetivo` e `previsto`;
- com origem `manual` ou `recorrencia`.

Ficam fora:
- origem `cartao` e `transferencia`;
- qualquer lançamento com `cenarioId`.

## Interface

`TelaLancar.tsx`, nos dois modos:

- Simples: a data é hoje. O tipo vem do seletor Tipo.
- Avançado: a data é a escolhida. O tipo vem do seletor Tipo.

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

- Domínio: igual; valor diferente; data diferente; box diferente; tipo diferente (gasto × entrada com mesmo valor); `previsto` conta; cartão, transferência e cenário não contam; lista vazia.
- Tela, Simples e Avançado: sem repetido salva direto; com repetido abre o sheet e não salva; Cancelar não salva e mantém o formulário; Lançar mesmo assim salva uma vez.

## Documentação

- `docs/estilo/catalogo.md`: entrada do `ConfirmarRepetidoSheet`.
- `docs/wiki/`: capítulo de lançar menciona a confirmação.
- `changelog.d/adicionado-aviso-lancamento-repetido.md`.
