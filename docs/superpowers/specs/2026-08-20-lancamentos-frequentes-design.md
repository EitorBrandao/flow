# Lançamentos frequentes — atalhos na sheet Adicionar

## Problema

O gesto mais repetido do app é o mais caro. Lançar o café de todo dia exige abrir a sheet
Adicionar, escolher "Lançamento" ou "Compra no cartão", escolher o cartão, digitar o valor,
escolher o tipo, escolher a categoria e confirmar. Nada disso muda de um dia para o outro,
mas o app pergunta tudo de novo toda vez.

A tela Lançar (`src/ui/TelaLancar.tsx`) e o formulário de compra (`src/ui/FormCompra.tsx`)
sempre abrem vazios. O app já sabe o que você repete — está tudo em `dados.lancamentos` e
`dados.comprasCartao` — e não usa esse conhecimento em lugar nenhum.

Item 3 do backlog, prioridade declarada.

## Decisões tomadas com o usuário (2026-08-20)

| Pergunta | Decisão |
|---|---|
| O que o chip carrega | **Categoria + destino + valor**. O destino é a box atual ou um cartão específico — há gasto que só acontece num cartão |
| O valor entra na chave? | **Não.** Senão "Mercado 180" e "Mercado 210" seriam chips diferentes e nenhum se repetiria. O valor mostrado é o da ocorrência mais recente |
| Onde a faixa mora | **No topo da sheet Adicionar**, acima dos dois caminhos — é o único lugar que serve lançamento e compra de cartão |
| Como escolher os chips | **Mais usados nos últimos 60 dias, no máximo 6** |
| O que o toque faz | **Abre o formulário preenchido.** Nada é gravado sem você ver |
| Desenho do chip | **Uma linha** (`● Café  8,50`), com ponto azul marcando destino de cartão. Valor sem `R$` |

## Solução

### O que é um chip

Uma combinação **categoria + destino** que você digitou pelo menos uma vez nos últimos 60
dias, com o valor da vez mais recente.

Contam só as entradas **que você digitou**:

- `Lancamento` com `origem === 'manual'` e sem `cenarioId`.
- `CompraCartao` sem `recorrenciaCartaoId`.

Ficam de fora recorrências, faturas, assinaturas e parcelamentos de fatura. Todos entram
sozinhos no app; um atalho para eles convidaria a lançar em duplicidade — exatamente o erro
que o Flow não tem como desfazer.

Também ficam de fora:

- Categoria arquivada, ou que não existe mais.
- Categoria de cartão reservada (`categoriasCartaoReservadasIds` — "Assinaturas" e
  "Parcelamento").
- Cartão inativo.

`status` **não** filtra. Um `previsto` que você digitou à mão é um gesto seu igual a um
`efetivo`; o que separa gesto de automação é `origem`, não `status`.

A janela é medida pela `data` do lançamento, não por `criadoEm`. Quem digita hoje o gasto do
mês passado quer que ele conte no mês passado. Consequência aceita: um `previsto` manual com
data futura fica fora da janela até o dia chegar.

### Cálculo — `frequentes` em `src/domain/aggregations.ts`

```ts
export type DestinoFrequente =
  | { tipo: 'box'; categoriaId: ID }
  | { tipo: 'cartao'; cartaoId: ID; categoriaCartaoId: ID };

export interface ChipFrequente {
  chave: string;      // 'box:<categoriaId>' | 'cartao:<cartaoId>:<categoriaCartaoId>'
  destino: DestinoFrequente;
  rotulo: string;     // nome da categoria
  valorCent: number;  // valor da ocorrência mais recente
  usos: number;
}

export function frequentes(
  dados: Dados,
  opcoes: { hoje: ISODate; boxId: ID | null; cartaoIds: readonly ID[]; janelaDias?: number; limite?: number },
): ChipFrequente[]
```

Padrões: `janelaDias = 60`, `limite = 6`. A janela é `[addDias(hoje, -(janelaDias - 1)), hoje]`,
fechada nas duas pontas.

A função recebe `Dados` inteiro, e não arrays soltos como as outras agregações do arquivo.
É um desvio deliberado: ela atravessa cinco coleções — lançamentos, compras, categorias,
categorias de cartão e cartões — e a lista de parâmetros ficaria pior que a dependência.
`Dados` é tipo de domínio (`src/domain/types.ts`), então a função continua pura e sem E/S.

**Ordenação**, nesta ordem, para o resultado ser determinístico:

1. `usos` decrescente.
2. Data da ocorrência mais recente, decrescente.
3. `chave` crescente.

### A faixa, na sheet Adicionar

Fica no topo, acima de "Lançamento" e "Compra no cartão", com o rótulo `Frequentes`
(`.rotulo-grupo`). Sem chip nenhum, nada disso é renderizado: quem instalou ontem vê a sheet
exatamente como ela é hoje.

O chip é uma pílula de uma linha: ponto azul (só quando o destino é cartão), nome da
categoria, e o valor em `--muted` sem `R$`. A legenda `● vai para o cartão` fica abaixo da
faixa, e só aparece quando existe pelo menos um chip de cartão — sem ela o ponto não se
explica sozinho.

### O escopo de cada tipo de chip

A regra é uma só: **o chip só existe se o formulário de destino puder recebê-lo.** Daí a
assimetria, herdada das telas que já existem:

| Chip | Escopo | Porque |
|---|---|---|
| box | `boxIdEfetivo(dados, boxSel)` | é a box que a tela Lançar usa |
| cartão | cartões ativos de `boxIdsSelecionadas(dados, boxSel)` | é a lista que a própria sheet Adicionar já monta |

Na visão `casa`, portanto, os chips de box saem da box chamada "casa" e os de cartão saem de
todos os cartões ativos. É o comportamento que os dois destinos já têm hoje, não uma regra
nova.

### O que o toque faz

**Chip de cartão** → abre o `FormCompra` dentro da própria sheet, com cartão, categoria e
valor prontos e `parcelas = 1`. O passo "compra em qual cartão?" não acontece.

**Chip de box** → fecha a sheet, leva à tela Lançar e preenche valor, categoria e tipo.

Data sempre hoje. Nota nunca preenchida — é o campo que muda toda vez. Parcelamento nunca.

Duas mudanças de código sustentam isso:

- **`FormCompra` ganha `inicial?: { valorTotal: number; categoriaCartaoId: ID }`**, prop
  separada de `compra`. `compra` significa "estou editando" e tem precedência; `inicial` só
  semeia os campos de uma compra nova.

- **O store ganha `rascunhoLancar: { categoriaId: ID; valorCent: number } | null`** e
  `setRascunhoLancar`. É a única forma de a sheet mandar dados para uma tela que ela não
  renderiza. A tela Lançar consome num `useEffect` com dependência em `rascunhoLancar` — não
  só na montagem, porque a sheet pode ser aberta com a tela Lançar já visível — e limpa o
  rascunho em seguida. Ao consumir, ela também acerta o `tipo` a partir da categoria; sem
  isso a categoria semeada some da grade, que filtra por tipo.

### Estilo — nível 2

Classes novas em `src/styles.css`, em bloco próprio ao fim do arquivo
(`/* ---- Frequentes (AdicionarSheet.tsx) ---- */`), só com tokens existentes:

| Classe | O que é |
|---|---|
| `.frequentes` | a faixa: `flex` com `wrap` e `gap: 8px` |
| `.frequentes-chip` | a pílula: `--surface2` (elevação sobre o `--surface` da sheet), raio 999px, `min-height: 38px` |
| `.frequentes-detalhe` | o valor dentro do chip: `--muted`, `tabular-nums` |
| `.frequentes-ponto` | o ponto de 6px em `--ac` que marca destino de cartão |

O fundo é `--surface2` porque a sheet já é `--surface`; `.chip` (que é `--surface`) sumiria
dentro dela. As quatro entram em `docs/estilo/catalogo.md` no mesmo commit — o guard do
release bloqueia classe fora do catálogo.

Nenhum componente novo. O markup cabe em `AdicionarSheet.tsx`, é usado num lugar só e não tem
estado nem gesto próprio: `docs/estilo/nivel-4-novo-componente.md` diz para não abstrair
nesse caso.

## Arquivos

| Arquivo | O quê |
|---|---|
| `src/domain/money.ts` + teste | `formatarSemSimbolo` — valor com centavos e sem `R$`, para caber no chip |
| `src/domain/aggregations.ts` + teste | `frequentes`, `ChipFrequente`, `DestinoFrequente` |
| `src/state/store.ts` | `rascunhoLancar` e `setRascunhoLancar` |
| `src/ui/AdicionarSheet.tsx` + teste | a faixa, e o que cada toque faz |
| `src/ui/FormCompra.tsx` + teste | prop `inicial` |
| `src/ui/TelaLancar.tsx` + teste | consumir e limpar o rascunho |
| `src/styles.css` + `docs/estilo/catalogo.md` | as quatro classes, catalogadas no mesmo commit |
| `docs/wiki/` | a faixa e o que ela significa |
| `changelog.d/adicionado-lancamentos-frequentes.md` | fragmento |

## Testes que precisam existir

**Domínio** (`aggregations.test.ts`) — cada um destes só passa se a regra correspondente
estiver implementada:

- A janela corta: uma combinação usada 5× há 70 dias não vira chip; a mesma há 50 dias vira.
- O limite corta: 8 combinações elegíveis devolvem 6, e são as 6 mais usadas.
- A chave agrupa valores diferentes: três "Mercado" de valores distintos são **um** chip com
  `usos: 3`, e o `valorCent` é o da data mais recente — não o maior, nem o primeiro.
- Cada exclusão, isolada: `origem: 'recorrencia'`, `origem: 'cartao'`, `cenarioId`,
  `recorrenciaCartaoId`, categoria arquivada, categoria reservada de cartão, cartão inativo.
- Box errada e cartão fora do escopo não entram.
- Desempate: com `usos` iguais, ganha o uso mais recente; com data igual também, a `chave`
  crescente. Os dados do teste precisam ter as duas ordens **discordando** da ordem esperada
  por acidente alfabético, senão o teste passa com a comparação errada.

**UI:**

- `AdicionarSheet` sem histórico não mostra a faixa nem o rótulo.
- Toque em chip de cartão abre o formulário com valor, categoria e cartão certos, sem passar
  pela escolha de cartão.
- Toque em chip de box fecha a sheet, muda a aba para `lancar` e grava o rascunho.
- `TelaLancar` consome o rascunho, acerta o tipo pela categoria e limpa o rascunho depois.
- `FormCompra` com `inicial` semeia os campos; com `compra` **e** `inicial`, `compra` ganha.

Todos os testes usam dados sintéticos — nenhum valor, nome de banco ou descrição real.

## Bordas conhecidas (documentar, não "consertar")

- **Um chip pode semear um valor velho.** É o preço de guardar o valor. Fica contido porque
  o formulário exige confirmação e porque o campo de valor passou a selecionar ao focar
  (v0.20.2): digitar substitui, não digitar mantém.
- **Trocar de box troca os chips**, inclusive fazendo a faixa sumir numa box sem histórico.
  É consequência do escopo, igual ao resto do app.
- **A ordem muda sozinha.** Lançar algo altera a contagem e pode reordenar os chips entre uma
  abertura e outra da sheet. É o que "mais usados" significa; a alternativa (ordem fixa) exige
  fixar chip à mão, que está fora de escopo.
- **Chip de ganho existe.** Um ganho manual repetido vira chip como qualquer outro, e a tela
  Lançar troca o tipo sozinha ao consumir o rascunho.

## Achado fora de escopo

Na sheet Adicionar, os dois botões de caminho usam `.item`, que é `--surface` — a mesma cor do
fundo da sheet. Eles não têm contraste nenhum contra o fundo. Encontrado ao montar o mockup;
o usuário decidiu em 2026-08-20 não incluir o conserto nesta entrega.

## Fora de escopo

- Fixar, renomear, reordenar ou remover chip à mão.
- Chip que guarda parcelamento, nota ou data diferente de hoje.
- Chip que lança direto, sem passar pelo formulário.
- Sugerir categoria a partir do texto da nota.

## Verificação

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

No celular, depois do deploy: abrir o `+` e conferir que os chips refletem o que você mais
lança; tocar num chip de cartão e confirmar que o formulário abre com cartão e categoria
certos; tocar num chip de box e confirmar que a tela Lançar abre preenchida, com o tipo certo;
trocar de box e ver a faixa mudar.
