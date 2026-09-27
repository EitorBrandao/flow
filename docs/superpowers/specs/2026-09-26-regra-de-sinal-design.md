# Regra de sinal: valor sem sinal, a cor diz o sentido

Data: 2026-09-26. Branch: `regra-de-sinal`.

Status: aprovada em 2026-09-26

Entra **antes** do simulador no Fluxo (`2026-09-26-simulador-no-fluxo-design.md`), que já
nasce seguindo esta regra.

## Problema

O app mistura dois jeitos de mostrar o sentido de um valor. Lançamentos aparecem sem sinal,
só com a cor. Saldos negativos e diferenças aparecem com "−" ou "+". No simulador, a mesma
tabela teria os dois jeitos lado a lado.

## Decisões (com o usuário, 2026-09-26)

1. **Valor mostrado nunca tem "+" nem "−".** Vale para o app inteiro.
2. **A cor diz o efeito no saldo:** verde entra ou sobra; vermelho sai ou falta. Zero fica
   sem cor.
3. **Estorno** (valor negativo numa categoria de gasto, ou o inverso) segue o efeito no
   saldo: estorno de gasto fica **verde**, com o rótulo **"estorno"** ao lado.
4. A mudança vai num branch próprio, antes do simulador.

É uma mudança de **linguagem** (nível 6 do guia de estilo): a regra entra em
`docs/estilo/fundamentos.md`.

## Domínio — `src/domain/money.ts`

- **`formatarBRL(c)`** passa a formatar `Math.abs(c)`. O comentário sobre o U+2212 sai.
- **`formatarSobraCompacta(c)`** perde o sinal ("1.870", "410").
- **`efeitoNoSaldo(valor: number, tipo: TipoCategoria): number`** (nova) — `+valor` para
  ganho, `−valor` para gasto. Estorno sai com o sinal invertido naturalmente.
- **`classeEfeito(efeito: number): 'valor-ganho' | 'valor-gasto' | undefined`** (nova) —
  `> 0` verde, `< 0` vermelho, `0` sem classe.

`formatarPercentual` não muda: só recebe valores ≥ 0 hoje.

## Onde muda

Levantado com `grep -rn "formatarBRL(\|formatarSobraCompacta(\|'+'\|'−'" src/ui`.

### 1. Sinal escrito à mão sai

| Arquivo | Trecho |
|---|---|
| `TelaHoje.tsx` (`Diferenca`) | "Diferença: −… — falta inserir no app" / "+… — sobra no app" |
| `TelaCartao.tsx` (conferência) | "Diferença: −… — falta inserir no cartão" / "+… — sobra no cartão" |
| `TelaHoje.tsx` | "{±}… nos próximos 28 dias" (`.delta.pos/.neg`) |
| `TelaFluxo.tsx` | "{±}… em relação a hoje" (`.delta.pos/.neg`) |
| `EvolucaoMensalChart.tsx` | rótulo de sobra acima das barras (`formatarSobraCompacta`) |

As duas conferências continuam com as **mesmas frases e cores** entre si.
O rótulo de sobra do gráfico de evolução precisa ter cor pelo sinal; se hoje não tiver,
ganha `pos`/`neg` do próprio gráfico.

### 2. Valor neutro que pode ser negativo ganha cor

| Arquivo | Valor |
|---|---|
| `TelaHoje.tsx` (`TotalFlow`) | "Total calculado no Flow" |
| `TelaHoje.tsx` | "Total informado" |
| `ajustes/Boxes.tsx` | saldo inicial da box |
| `ajustes/Bancos.tsx` | saldo informado do banco |

Cor por `classeEfeito(valor)` (saldo positivo verde, negativo vermelho).

### 3. Cor pelo efeito, e não pela categoria; rótulo "estorno"

Hoje a cor vem de `tipoCat(...) === 'ganho'`. Passa a vir de
`classeEfeito(efeitoNoSaldo(l.valor, tipo))`. Quando `l.valor < 0`, um `.badge` "estorno"
aparece ao lado da descrição.

| Arquivo | Onde |
|---|---|
| `TelaFluxo.tsx` | lista de lançamentos |
| `TelaHoje.tsx` | pendentes (valor fixo e botão "Corrigir valor") |
| `LancamentosSheet.tsx` | total, subtotais e itens |
| `ajustes/Recorrencias.tsx` | valor da recorrência |
| `TelaAnalises.tsx` | tabela Comparativo (total de categoria pode ficar negativo) |

`ViagemSheet.tsx`, `TransferenciaSheet.tsx`, `AssinaturasResumoSheet.tsx`, `FaturaResumo.tsx`,
`FaturaCategoriaSheet.tsx` e `TelaCartao.tsx` fixam `valor-gasto`: seus valores são gastos
de cartão ou de viagem, sempre ≥ 0 hoje. Ficam como estão.

### 4. Não muda

- Botões ± dos campos de valor (`TelaHoje`, `Boxes`, `Bancos`): são controle de entrada.
- `CampoValor`: mostra a magnitude digitada.
- Valores já positivos por natureza: fatura, pagamento, parcelas, juros, orçamento de viagem
  (`PagamentoFaturaSheet`, `LinhaOrcamentoViagem`, `AvisoFaturaForaDoFluxo`, `FormCompra`).
- Já coloridos pelo sinal, só perdem o "−": saldo do dia no Fluxo (`.total-dia`), mín/máx
  dos gráficos (`b.pos/.neg`), leitura do gráfico expandido (`.saldo-grande`), "projetado"
  no Hoje, sobra em Análises.
- **Saldo grande do Hoje:** positivo segue branco com os centavos em verde; negativo segue
  vermelho. O desenho atual já distingue os dois sem sinal.
- Busca do Fluxo e do Cartão por valor: continua casando o texto formatado (agora sem "−").

## Testes

- `money.test.ts`: `formatarBRL` de negativo sai sem sinal; `formatarSobraCompacta`;
  `efeitoNoSaldo` (ganho, gasto, estorno de gasto, estorno de ganho); `classeEfeito` (zero).
- Testes de tela que conferem "−R$" ou "+R$" são atualizados para o texto sem sinal **e** para
  a classe de cor.
- Novo: estorno na lista do Fluxo aparece verde, com o rótulo "estorno".
- Novo: diferença da conferência (Hoje e Cartão) sem sinal, com a mesma frase.
- Dossiê regenerado (`npm run dossie`).
- Varredura com Playwright no Galaxy S25+: Hoje (saldo negativo, conferência), Fluxo (saldo
  negativo, estorno), Análises, Ajustes → Boxes.

## Documentação

- `docs/estilo/fundamentos.md`: a regra, com o estorno.
- `docs/estilo/catalogo.md`: `.valor-ganho`/`.valor-gasto` passam a significar efeito no
  saldo, não tipo de categoria.
- `docs/dominio.md`: `efeitoNoSaldo`.
- Wiki: onde citar sinal de valor mostrado (`7-ajustes.md` fala do "−" **digitado**, que não
  muda). Glossário: "estorno".

## Entrega

Fragmento `changelog.d/alterado-valores-sem-sinal.md`. Mudança visível: passa pelo ciclo
completo (varredura, wiki, release, deploy).
