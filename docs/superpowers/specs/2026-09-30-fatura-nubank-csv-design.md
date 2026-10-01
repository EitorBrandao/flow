# Fatura do cartão Nubank em CSV — design

Data: 2026-09-30. Mockup aprovado pelo usuário no chat (v2), com dados sintéticos.

## Objetivo

A tela **Ajustes → Importar e conferir** passa a ler o CSV da fatura do cartão Nubank. O
usuário escolhe o arquivo no mesmo botão "Escolher arquivo". O Flow reconhece o formato pelo
cabeçalho e confere cada linha contra o cartão escolhido no passo "Destino".

A spec `2026-09-17-conferencia-por-extrato-design.md` adiou este leitor para a entrega 3, com
a nota "o usuário não usa esse cartão". O usuário agora usa esse cartão. As outras peças da
entrega 3 continuam fora.

## O formato real

Dois arquivos reais (vencimentos de setembro e outubro de 2026) confirmaram o formato. Os
arquivos foram lidos e apagados. Nenhum dado real entra no repositório. Os exemplos abaixo são
sintéticos.

```
date,title,amount
2026-08-18,Mercado Alfa,"50,00"
2026-08-04,Pagamento recebido,"- 1.234,56"
2026-08-01,Loja Gama - Parcela 1/4,"100,03"
2026-07-30,Loja Delta - Parcela 3/10,"40,00"
2026-07-30,Pix no Crédito - Fulano de Tal - 2/5,"35,00"
2026-09-18,"Crédito de ""Loja Gama""","- 20,00"
```

Fatos do formato:

- O cabeçalho é exatamente `date,title,amount`.
- A data vem em `AAAA-MM-DD`.
- O valor vem no formato brasileiro, entre aspas. O negativo tem um espaço depois do sinal.
  `parsearValorExtrato` (`src/importar/valores.ts`) já aceita as duas formas.
- Compra é positiva. Pagamento e crédito são negativos.
- A parcela vem no fim do título, de duas formas: ` - Parcela 3/10` e ` - 3/10` (esta no Pix
  no Crédito).
- O crédito de uma compra vem como `Crédito de "<loja>"`, com aspas duplicadas dentro do campo.
  `lerCsv` já trata esse caso.
- **Parcela 1/N e compra à vista trazem a data real da compra.** Parcela 2/N em diante traz a
  data de abertura do ciclo da fatura, a mesma em todas as parcelas antigas daquela fatura.
- Os dois arquivos chegaram com os acentos em UTF-8 duplo: `Crédito` virou `CrÃ©dito`. A
  origem do defeito (Nubank ou o caminho até o app) é incerta.
- Os centavos que sobram da divisão vão para a parcela 1 (ex.: 100,03 na 1/4 e 100,00 nas
  outras). É a mesma regra de `valorParcela` no Flow.

## Regra da data estimada

Uma parcela n > 1 com data de linha `D` (abertura do ciclo atual) veio de uma compra feita no
ciclo em que caiu a parcela 1. Esse ciclo começa `n − 1` meses antes de `D`.

- Data mínima da compra: `addMesesData(D, −(n − 1))`.
- Data máxima da compra: `addDias(addMesesData(D, −(n − 2)), −1)`.
- Data estimada: a mínima.

Exemplo: parcela 3/10 com `D` = 2026-07-30 → compra entre 2026-05-30 e 2026-06-29, estimada em
2026-05-30.

Prova com os arquivos reais: a parcela 1/4 de uma compra trouxe a data real 01/08. Na fatura
seguinte, a parcela 2/4 trouxe `D` = 30/08. A regra dá o intervalo 30/07 a 29/08, que contém
01/08.

Parcela 1/N e compra à vista não têm data estimada.

## Componentes

### 1. Correção de acentos — `src/importar/texto.ts` (novo)

`corrigirUtf8Duplo(texto: string): string`.

- Se o texto não contém o padrão de UTF-8 duplo (`Ã` ou `Â` seguido de um caractere entre
  U+0080 e U+00BF), devolve o texto sem mudança.
- Senão, trata cada caractere como um byte (só se todos forem ≤ U+00FF) e decodifica os bytes
  como UTF-8, com `fatal: true`.
- Se algum caractere passar de U+00FF, ou a decodificação falhar, devolve o texto original.
  Nunca lança.

Só o leitor da fatura Nubank usa esta função. O leitor do extrato da conta não muda.

### 2. Leitor — `src/importar/adapters/nubankFatura.ts` (novo)

- `id: 'nubank-fatura-csv'`, `rotulo: 'Nubank — fatura do cartão (CSV)'`.
- `detectar`: a primeira linha, sem BOM, sem espaços nas pontas e em minúsculas, é igual a
  `date,title,amount`.
- `ler`: decodifica em UTF-8, aplica `corrigirUtf8Duplo` e chama
  `lerNubankFatura(texto): LeituraAdapter`.
- Para cada linha depois do cabeçalho:
  - `data` por `parsearDataExtrato`, valor por `parsearValorExtrato`, título sem espaços nas
    pontas. Data inválida, valor inválido ou título vazio: a linha vai para
    `linhasIgnoradas` e `linhasNaoReconhecidas`.
  - Parcela: o regex `/\s+-\s+(?:Parcela\s+)?(\d{1,2})\/(\d{1,2})$/i` no fim do título. Vale só
    se `1 ≤ n ≤ total`. Numeração inválida: o trecho fica na descrição, e a linha é tratada
    como compra à vista. A descrição perde o trecho da parcela.
  - Crédito de compra: `/^Cr[ée]dito de "(.+)"$/i`. A descrição vira o nome entre aspas.
  - `natureza`: `pagamentoFatura` para `Pagamento recebido` (sem diferença de caixa);
    `estornoCartao` para qualquer outro valor negativo; nenhuma para valor positivo. IOF e
    encargos são positivos e entram como gasto comum.
  - Sinal: `valorCent = −valor do arquivo`, a mesma inversão do leitor do Santander.
  - `fonte: 'cartao'`.
  - Parcela n > 1: `data` = data estimada, e `dataEstimada = { min, max }` (ver a regra acima).
- Um bloco só, `rotulo: 'Fatura Nubank'`, sem `totalDeclaradoCent`. O CSV não separa titular
  de cartão virtual, e não traz o total da fatura.
- `textoExtraido`: o texto decodificado e corrigido, para o botão "Copiar texto extraído".

Registro: `ADAPTERS` em `src/importar/adapters/index.ts` ganha `nubankFatura`. O tipo
`Adapter['id']` em `src/importar/tipos.ts` ganha `'nubank-fatura-csv'`.

### 3. Tipo — `LancamentoBruto.dataEstimada`

`dataEstimada?: { min: ISODate; max: ISODate }`, em `src/importar/tipos.ts`. Quando existe,
`data === min`. Só o leitor da fatura Nubank preenche este campo.

### 4. Casamento — `src/importar/conferencia.ts`

`candidatoDeParcelaCompativel` recebe o bruto inteiro, ou o intervalo. Com `dataEstimada`, o
critério de data passa a ser: a data da compra cadastrada está entre `min − 2 dias` e
`max + 2 dias`. Os outros dois critérios não mudam: o mesmo número de parcelas e o valor da
parcela N compatível. Sem `dataEstimada`, a regra atual (até `tolerancia` dias) continua igual.
A folga de 2 dias cobre um fechamento que mude de dia num mês curto. A tela não usa essa folga.

O item "Novo" de uma parcela com `dataEstimada` recebe `compraReconstruida.data` igual à data
estimada, como hoje recebe `b.data`.

### 5. Correção da data — estado e aplicação

- `src/importar/tipos.ts`: `DecisaoData { estado: EstadoItem; data: ISODate }`, no mesmo molde
  de `DecisaoTotal`.
- `src/state/store.ts`: `importacao.datasCorrigidas: Record<string, DecisaoData>`. Zera nos
  mesmos pontos em que `totaisCorrigidos` zera.
- `src/importar/conferencia.ts`:
  - `dataEfetiva(item, decisao)`: a data da decisão, só se o `estado` for o mesmo.
  - `dataCorrigidaValida(item, data)`: devolve a data só quando o item tem
    `bruto.dataEstimada` e `min ≤ data ≤ max`. Senão, devolve `undefined`.
- `src/ui/ajustes/Importar.tsx`, ao confirmar: uma data corrigida válida substitui
  `compraReconstruida.data`, ao lado da correção do total que já existe. `aplicar.ts` já grava
  `compraReconstruida.data`, então não muda.

### 6. Tela — `LinhaConferencia.tsx` e `ListaConferencia.tsx`

Segue o mockup aprovado. Nenhuma classe nova: usa `.campo`, `CampoData`, `.sub`,
`.botao-ver-mais` e o resto que a linha já usa.

- O botão **"Corrigir total" passa a se chamar "Corrigir compra"**, para o Nubank e para o
  Santander. O painel mostra:
  - Só para item com `dataEstimada`: o campo "Data da compra" (`CampoData`, com `min` e `max` do
    intervalo, sem folga). Embaixo, um `.sub` com "Pela parcela, a compra foi entre {min} e
    {max}. Estimada: {min}." Quando a data efetiva difere da estimada, aparece o botão
    `.botao-ver-mais` "Voltar para a data estimada". Esse botão apaga a decisão.
  - Para todo item com `compraReconstruida`: o campo "Total da compra", como hoje.
  - No Santander a data da compra é real, por isso o painel mostra só o total.
- Na linha "Novo", a data exibida é a efetiva. Enquanto ela for a estimada, segue o texto
  " (estimada)": "Novo · 30/05/2026 (estimada) · parcela 3 de 10 · compra de {total}".
- Na linha "Confere" de uma parcela com `dataEstimada`, a data exibida é a da compra cadastrada
  no app (`compraCartaoId`), não a estimada.
- `ListaConferencia`: acima da lista, depois do aviso de filtro, um `.sub` aparece quando há
  itens "Novo" com data ainda estimada (sem correção) e ação diferente de ignorar: "A fatura do
  Nubank não traz o dia da compra das parcelas antigas. {N} datas estão estimadas: corrija em
  "Corrigir compra" antes de confirmar, se souber o dia." No singular: "1 data está estimada".
- O botão "Copiar texto extraído" aparece nas mesmas condições de hoje (há `textoExtraido` e linha não reconhecida, ou nada lido). Agora
  ele também aparece para este CSV. O texto do aviso "O texto contém os dados da sua fatura"
  continua igual.

## Consistência entre telas

- "Corrigir compra" muda o Santander também, no mesmo branch. O usuário aprovou isso junto com
  o mockup.
- A data estimada só existe na conferência. Depois de gravada, a compra é uma compra comum do
  cartão. A tela Cartão não ganha marca de data estimada.

## Pontos de chamada (grep)

- `ADAPTERS`, `detectarAdapter`: `src/importar/adapters/index.ts`; a lista de formatos manuais
  em `Importar.tsx`.
- `candidatoDeParcelaCompativel`: só `conferir`, em `conferencia.ts`.
- `totaisCorrigidos` / `DecisaoTotal`: `store.ts`, `Importar.tsx` (limpar, confirmar, passar
  para a lista), `ListaConferencia.tsx`, `conferencia.ts`. `datasCorrigidas` segue os mesmos
  pontos.
- `compraReconstruida.data`: `aplicar.ts` (grava a compra). Sem mudança.
- Backup, exclusão e pagamento não mudam: a feature não cria entidade nem campo persistido.

## Fora do escopo

- Separar titular, adicional e virtual (o CSV não traz isso).
- Aviso de soma divergente (o CSV não traz o total).
- Estimar a data no Santander (lá a data é real).
- O resto da entrega 3: OFX, zip do Nubank, Web Share Target, aviso de dias sem lançamento.

## Testes

Todos com dados sintéticos.

- `texto.test.ts`: texto limpo não muda; `CrÃ©dito` vira `Crédito`; caractere acima de U+00FF
  impede a correção; sequência inválida devolve o original.
- `nubankFatura.test.ts`:
  - detecção pelo cabeçalho, com BOM e em maiúsculas; recusa o cabeçalho do extrato da conta e
    um CSV qualquer;
  - valor brasileiro, negativo com espaço, milhar;
  - as duas formas de parcela; numeração inválida (`0/3`, `5/3`) vira compra à vista;
  - `Pagamento recebido` → `pagamentoFatura`; `Crédito de "X"` → `estornoCartao` com descrição
    `X`; outro negativo → `estornoCartao`; positivo sem natureza;
  - sinal invertido;
  - data estimada: 3/10 em 2026-07-30 → min 2026-05-30, max 2026-06-29; 2/4 em 2026-08-30 → 
    2026-07-30 a 2026-08-29; 2/2 em 2026-03-31 → min 2026-02-28 (fim de mês), max 2026-03-30;
    parcela 1/N e à vista sem `dataEstimada`;
  - linha ilegível vai para `linhasNaoReconhecidas`; um bloco só; `textoExtraido` presente;
    acentos corrigidos.
- `index.test.ts`: `detectarAdapter` escolhe o leitor certo para os três formatos.
- `conferencia.test.ts`: parcela com `dataEstimada` casa com compra dentro do intervalo, casa
  com compra na folga de 2 dias, não casa fora dela; o Santander, sem `dataEstimada`, mantém a
  tolerância de 3 dias; `dataCorrigidaValida` aceita as pontas e recusa fora do intervalo e item
  sem `dataEstimada`.
- `LinhaConferencia.test.tsx` e `ListaConferencia.test.tsx`: rótulo "Corrigir compra"; campo de
  data só com `dataEstimada`; "(estimada)" some ao corrigir; "Voltar para a data estimada"
  aparece e restaura; aviso do topo conta só os "Novo" estimados não corrigidos e não
  ignorados; linha "Confere" mostra a data do app.
- `Importar.test.tsx`: a confirmação grava a compra com a data corrigida.

## Documentação

- `docs/wiki/7-ajustes.md`, seção "Importar e conferir": três arquivos lidos; a data estimada
  das parcelas do Nubank e como corrigi-la; "Corrigir compra" no lugar de "Corrigir total";
  "Copiar texto extraído" também para o CSV.
- Fragmentos em `changelog.d/`: `adicionado-fatura-nubank-csv.md` e
  `alterado-corrigir-compra.md`.
