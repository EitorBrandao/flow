# Primeiro preenchimento guiado — item 2 do backlog

## Context

A direção do projeto é **preparar o app para outras pessoas**. O item 1 (wiki dentro do app)
saiu na v0.14.0: agora dá para explicar o Flow sem estar junto. Este item ataca o mesmo
problema pelo outro lado — **o app em si**, que hoje abre mudo para quem acabou de instalar.

Quem instala vê a tela Hoje com **R$ 0,00**, um gráfico reto, "Nada a confirmar — tudo em dia"
e nenhuma instrução. Tocar no **+** para lançar leva a uma tela que responde "Nenhuma categoria
— crie em Ajustes" (`src/ui/SeletorCategoria.tsx:17`), e o botão Lançar não faz nada, em
silêncio, porque `valido` é falso (`src/ui/TelaLancar.tsx:41`). A pessoa precisa adivinhar que
o caminho é ⚙️ → Boxes → Categorias antes de conseguir registrar o primeiro gasto.

**Achado que muda o plano — e que já está publicado.** Ao levantar o terreno, descobri que
`docs/wiki/1-primeiros-passos.md:3` afirma: *"O Flow começa vazio: sem box, sem categoria, sem
cartão — nem a box 'casa' vem pronta."* **Isso é falso.** `iniciar()` cria a box "casa"
automaticamente a cada abertura, se ela não existir (`src/state/store.ts:29-35`). Escrevi
aquela frase depois de conferir só `repo.carregarTudo()`, que de fato só cria a `config` — a
criação da box mora na camada de cima, e eu não olhei. A wiki foi ao ar na v0.14.0 com o erro,
na primeira frase do primeiro capítulo que uma pessoa nova lê. Corrigir isso é a Tarefa 1.

## O que é verdade numa instalação nova (verificado no código)

| Fato | Onde |
|---|---|
| A box **"casa"** é criada sozinha, sem saldo próprio (`saldoInicial: null`) | `src/state/store.ts:29-35` |
| Não há categoria, cartão, recorrência nem lançamento | `src/db/repo.ts` (nenhuma semente) |
| O seletor do topo mostra só boxes com saldo próprio, mais o sentinela `'casa'` — ou seja, só "casa" | `src/ui/Shell.tsx:34` |
| Lançar resolve `'casa'` para a box casa, então o destino existe; o que falta é categoria | `src/state/store.ts:69-72`, `src/ui/TelaLancar.tsx:32` |
| Criar box pela tela de Boxes já nasce com `saldoInicial: 0` e data de hoje — ela **aparece** no seletor | `src/ui/ajustes/Boxes.tsx:69-78` |
| Box só some do seletor se o usuário desmarcar "Esta box tem saldo próprio" no editor | `src/ui/ajustes/Boxes.tsx:36-40` |

Duas correções ao que o `TODO.md` registrava sobre este item: a box "casa" **não** precisa ser
criada pelo usuário, e "box sem saldo some do seletor" não é um acidente de criação — é o
resultado de desmarcar uma caixa cujo rótulo explica o efeito. O item encolhe de quatro partes
para três, e ganha a correção da wiki.

## Escopo

1. Corrigir a wiki (o erro acima) — e mantê-la coerente com o que as tarefas seguintes mudarem.
2. **Estado de primeiro uso na tela Hoje**: no lugar do R$ 0,00 mudo, um cartão que conduz.
3. **Categorias sugeridas**: tirar o degrau de criar uma a uma antes do primeiro lançamento.
4. **Assistente de contas fixas** (recorrências) — a maior das três e a mais cortável; está por
   último de propósito.

## Arquivos

| Arquivo | O quê |
|---|---|
| `docs/wiki/1-primeiros-passos.md` | corrigir o parágrafo de abertura e o passo "A primeira box" |
| `src/state/store.ts` | `ajustesSecao` + ação para abrir Ajustes já numa subtela |
| `src/ui/TelaAjustes.tsx` | ler a subtela inicial do store |
| `src/ui/TelaHoje.tsx` | estado de primeiro uso |
| `src/ui/PrimeiroUso.tsx` (novo) + `.test.tsx` | o cartão que conduz |
| `src/ui/ajustes/Categorias.tsx` | bloco de categorias sugeridas quando a box não tem nenhuma |
| `src/domain/categoriasSugeridas.ts` (novo) + teste | a lista sugerida, fora da UI |
| `src/ui/ajustes/Recorrencias.tsx` | estado vazio que conduz (tarefa 5) |
| `src/styles.css` + `docs/estilo/catalogo.md` | classes novas, catalogadas no mesmo commit |
| `changelog.d/adicionado-primeiro-uso.md` | fragmento (visível ao usuário) |

## Tarefas

### Tarefa 1 — corrigir a wiki

Sem código de app. Trocar a abertura de `1-primeiros-passos.md` pelo que é verdade: o app
começa **quase** vazio — a box "casa" já existe, para os gastos compartilhados; o que falta é
a sua box com saldo próprio e as categorias. Ajustar o passo "A primeira box" para não mandar
criar a casa. Rodar `npx vitest run src/ui/ajustes/capitulos.test.ts` (a guarda de sintaxe
continua valendo) e commitar sozinho — é correção de erro publicado, não depende do resto.

### Tarefa 2 — abrir Ajustes direto numa subtela

Hoje `TelaAjustes` guarda a subtela num `useState` interno (`src/ui/TelaAjustes.tsx:31`), então
quem está fora só consegue levar ao menu — é o que o aviso de backup da Hoje já faz
(`setAba('ajustes')`). Os botões do estado de primeiro uso precisam cair direto em Boxes e em
Categorias, senão a instrução vira "procure aí".

Acrescentar ao store `ajustesSecao: SecaoAjustes | null` e uma ação `abrirAjustes(secao)` que
seta `aba: 'ajustes'` e a seção; `TelaAjustes` inicializa por ela e a limpa ao voltar ao menu.
`Shell.tsx` já remonta a tela por `ajustesKey` quando se toca na engrenagem — conferir que o
caminho pela engrenagem continua caindo no menu.

Teste: com `abrirAjustes('boxes')`, a tela de Boxes aparece sem passar pelo menu; tocar em
"‹ Ajustes" volta ao menu; abrir pela engrenagem cai no menu.

### Tarefa 3 — estado de primeiro uso na Hoje

Componente novo `PrimeiroUso.tsx`, renderizado por `TelaHoje` **no lugar** do card de saldo
enquanto o app estiver zerado. Critério, calculado do snapshot que a tela já tem:

```ts
const semBoxPropria = !dados.boxes.some((b) => b.saldoInicial != null);
const semCategorias = dados.categorias.length === 0;
const primeiroUso = semBoxPropria || semCategorias;
```

Conteúdo: uma linha dizendo onde a pessoa está, e **dois caminhos**, na ordem:
- **Criar a primeira box** (Ajustes → Boxes), que é o fluxo padrão. Quando já houver box mas não categorias,
  **criar categorias** (Ajustes → Categorias). Os dois passos aparecem com o feito riscado,
  para a pessoa ver que avançou.
- **"Já usa o Flow em outro aparelho?" → importar backup**, que leva a Ajustes → Backup, atalho
  disponível em ambas as fases (com ou sem box).

O card some sozinho quando os dois critérios caem. Não inventar estado persistido para
"onboarding concluído": o próprio dado responde, e um flag a mais é uma migração a mais.

Testes: com banco vazio, a Hoje mostra o cartão e **não** mostra o saldo grande; com box e
categoria, mostra o saldo e não o cartão; os botões chamam `abrirAjustes` com a seção certa.

### Tarefa 4 — categorias sugeridas

`src/domain/categoriasSugeridas.ts`: lista pura, sem IO, com nome e tipo — ganho (salário, pix,
outros) e gasto (mercado, transporte, moradia, contas, saúde, lazer, pix). Teste: nomes únicos
por tipo, e a lista contém ao menos uma de cada tipo.

Na tela de Categorias, quando a box selecionada não tem **nenhuma** categoria, mostrar o bloco
sugerido com as marcadas por padrão e um botão "Criar as marcadas". Ele grava com
`repo.salvarCategoria` (`src/db/repo.ts:107`), usando `proximaOrdem` da mesma forma que
`criar()` já faz (`src/ui/ajustes/Categorias.tsx`), preservando a ordem em que aparecem.

Teste: box sem categorias mostra o bloco; criar as marcadas grava exatamente elas, com tipo
certo e ordem crescente; com pelo menos uma categoria, o bloco não aparece.

### Tarefa 5 — assistente de contas fixas (cortável)

O que enche a projeção são as recorrências; sem elas o gráfico do Fluxo é uma linha reta e o
app parece inútil. Na tela de Recorrências, quando não houver nenhuma, um cartão explicando o
que é uma conta fixa e por que ela vale mais que lançar à mão, com o formulário já focado.
Nada de fluxo novo de várias etapas: a tela já tem o formulário — o que falta é dizer para que
serve.

Se o tempo apertar, **esta é a tarefa que cai** — as três anteriores já entregam o valor.

### Tarefa 6 — estilo, catálogo, changelog

Classes novas ao fim de `src/styles.css`, só com tokens existentes; catalogar em
`docs/estilo/catalogo.md` **no mesmo commit** (o guard do release bloqueia). Fragmento em
`changelog.d/`, bullets planos.

## Mockup — ponto de parada

Mudança de UI exige mockup aprovado antes do código (`docs/estilo-visual.md` e a skill
`ciclo-de-entrega`). O mockup cobre o cartão de primeiro uso e o bloco de categorias
sugeridas, num HTML só, como foi feito para a wiki. **A execução para aí e espera o usuário.**

## Verificação

```
npm test                                   # suíte inteira
npm run build                              # tsc + vite
node scripts/verificar-catalogo.mjs        # classes catalogadas
node scripts/verificar-dados-reais.mjs     # nada real versionado
npx vitest run src/ui/ajustes/capitulos.test.ts   # a wiki continua parseando
```

E, no celular, depois do deploy: instalar o PWA num navegador sem dados (ou limpar os dados do
site) e percorrer o caminho inteiro — cartão de primeiro uso → criar box → categorias sugeridas
→ primeiro lançamento — conferindo que o cartão some sozinho ao fim.

## Fora de escopo

- Persistir "onboarding concluído" em `Config` (o dado já responde).
- Importar extrato bancário (item 11) e busca de lançamentos (item 4).
- Mexer no comportamento da box "casa" criada automaticamente: ele está certo, só estava mal
  documentado.

## Decisão do mockup (2026-07-26)

O usuário escolheu a **variante B** do cartão de primeiro uso: uma pergunta ("Primeira vez por
aqui?") e dois caminhos — criar a box com o saldo do banco, ou importar backup de outro
aparelho. Sem passos numerados e sem botão desabilitado; o segundo passo (categorias) aparece
como frase, não como item de lista.

Mockup aprovado: `flow-mockup-primeiro-uso.html`, na pasta Claude do usuário — fora do
repositório, porque é material de trabalho e não faz parte do produto.
