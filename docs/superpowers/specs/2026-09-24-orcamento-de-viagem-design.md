# Orçamento de viagem (item 19)

Data: 2026-09-24. Branch: `orcamento-viagem`.

## Problema

O app responde "quanto a viagem custou", mas não "quanto ainda posso gastar". Essa é a
pergunta de quem está no meio da viagem, na hora de lançar um gasto.

## Decisões (com o usuário, 2026-09-24)

1. O orçamento compara o **valor previsto para a viagem** com o **total gasto**, pelo valor
   cheio das compras (parcelada conta inteira).
2. O gasto conta **só o que já aconteceu**: lançamentos efetivos e compras no cartão. Previsto
   fica de fora até ser confirmado.
3. O orçamento aparece **na tela de adicionar**, não na Hoje.
4. Orçamento **só do total**, sem divisão por categoria.
5. Cor para sobra e para estouro, e um ícone de alerta quando passar.
6. Aparece na tela de adicionar e na lista de Ajustes → Viagens. O detalhe da viagem nas
   Análises não mostra o orçamento.
7. A linha da tela de adicionar inclui o valor que está sendo digitado ("Com este gasto").
8. **Só gastos contam.** Ganho marcado na viagem (ex.: reembolso) não entra — nem no
   orçamento, nem nos totais de viagem das Análises (alinhamento no mesmo branch).

## Modelo

`Viagem` ganha `orcamentoCent?: number` (centavos, opcional). Ausente ou `0` = sem orçamento.

- Sem nova `this.version(n)` no Dexie: o campo não tem índice.
- Sem bump de schema de backup: `validarBackup` confere tabelas, não campos; `mesclar` copia
  o registro inteiro.
- `repo.atualizarViagem` passa a aceitar `orcamentoCent` no patch. Apagar o orçamento grava
  `undefined`.

## Domínio (`src/domain/viagem.ts`)

Regra única de "gasto de viagem":

- Lançamento conta se `viagemId === viagem.id`, `status === 'efetivo'` e a categoria dele é
  de `tipo === 'gasto'`.
- Compra de cartão conta se `viagemId === viagem.id`, pelo `valorTotal`.

Funções:

- `gastoDaViagem(viagem, lancamentos, comprasCartao, categorias): number` — todas as boxes,
  só efetivos, só gastos.
- `situacaoOrcamento(orcamentoCent, gastoCent): { gastoCent, orcamentoCent, restanteCent }`
  — `restanteCent = orcamentoCent − gastoCent` (negativo = passou).

Alinhamento das somas que já existem (mesma regra de "só gastos"):

- `itensDaViagem` e `totalViagemNoMes` recebem `categorias` e ignoram lançamentos de categoria
  `ganho`. O filtro de box e o `incluirPrevistos` delas continuam como hoje.
- Pontos de chamada: `TelaAnalises.tsx` (as duas funções), `ViagemSheet.tsx`
  (`itensDaViagem`; ganha a prop `categorias`) e os testes delas.

## Interface

### A linha do orçamento

Um componente novo, `LinhaOrcamentoViagem`, usado nos três lugares, para o texto ser um só.

- Dentro do orçamento: `R$ 1.200,00 de R$ 3.000,00 · falta <strong class="valor-ganho">R$ 1.800,00</strong>`.
- Exatamente no limite: `falta` com `R$ 0,00`, verde.
- Passou: `R$ 3.200,00 de R$ 3.000,00 · passou <strong class="valor-gasto">⚠ R$ 200,00</strong>`, com o ícone `TriangleAlert` (lucide-react, 16px) **dentro** do `<strong>`, para herdar o vermelho sem `style` de cor.
- Prefixo opcional `Com este gasto: ` quando a linha já soma o valor digitado.
- Container: `<p className="sub">` — nenhuma classe CSS nova.

### Tela de adicionar

`TelaLancar.tsx` (débito) e `FormCompra.tsx` (cartão), logo abaixo do checkbox
"Viagem: Nome". Aparece só se a viagem ativa tem orçamento **e** a caixa está marcada.

O valor digitado entra na conta ("Com este gasto:") quando o gasto **vai contar** depois de
salvo:

- Débito: valor > 0, tipo Gasto, não marcado como previsto e data ≤ hoje.
- Cartão: valor > 0 (compra no cartão sempre conta).

Nos outros casos, a linha mostra o estado atual, sem prefixo.

Ao editar uma compra de cartão já marcada na viagem (`FormCompra` com `compra`), a prévia
desconta o valor antigo dela antes de somar o novo, para não contar a compra duas vezes.

### Ajustes → Viagens

- Formulário (criar e editar) ganha o campo `Orçamento (opcional)` (`CampoValor`).
- Cada viagem com orçamento mostra a linha, sem prefixo, abaixo das datas.

## Consistência

- Cores e frases seguem as da conferência: verde (`.valor-ganho`) para o que sobra, vermelho
  (`.valor-gasto`) para o que falta ou passou.
- O detalhe da viagem nas Análises e o orçamento passam a concordar sobre o que é gasto
  (ganho não entra). Eles ainda podem diferir no filtro de box e nos previstos — por isso o
  orçamento não aparece nas Análises (decisão 6).

## Testes

- `gastoDaViagem`: efetivo conta; previsto não; ganho não; outra viagem não; compra de cartão
  conta pelo valor cheio (parcelada); várias boxes somam.
- `situacaoOrcamento`: dentro, no limite, passou.
- `itensDaViagem` / `totalViagemNoMes`: ganho marcado na viagem não entra.
- `LinhaOrcamentoViagem`: textos e classes dos três casos, prefixo.
- `TelaLancar`: sem orçamento não mostra; com orçamento mostra; valor digitado entra; previsto,
  data futura e ganho não entram; desmarcar a viagem esconde a linha.
- `FormCompra`: valor digitado entra; editar compra da viagem não conta em dobro.
- `Viagens`: salvar, editar e apagar o orçamento; linha na lista.

## Entrega

- Mockup aprovado antes do código.
- Wiki: `3-conceitos.md` (Viagem) e `7-ajustes.md` (Viagens).
- Catálogo: `LinhaOrcamentoViagem` em `docs/estilo/catalogo.md`.
- Fragmento `adicionado-orcamento-de-viagem.md`.
