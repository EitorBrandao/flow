# Conferência por extrato — entrega 1

Data: 2026-09-17
Estado: desenho aprovado, plano por escrever
Backlog: item 11 do `TODO.md` ("Importar extrato bancário")

## O problema

O Flow não tem caminho de entrada em massa. Quem passa uma semana sem lançar precisa digitar
cada item na aba Lançar. Isso não escala, e o que não escala vira abandono.

O banco já tem esses dados. O Nubank exporta o extrato da conta e a fatura do cartão em CSV.
O Santander manda a fatura do cartão em PDF, por e-mail, todo mês.

## A decisão central

**Isto não é uma importação. É uma conferência.**

Uma importação despeja lançamentos e cria duplicatas. Uma conferência compara duas listas — a
do banco e a do app — e mostra onde elas divergem. O arquivo do banco é a verdade. O app é o
que você lembrou de lançar.

Essa diferença muda tudo o que vem depois. O resultado do arquivo não é uma lista de coisas a
criar. É uma lista de **itens classificados**, cada um com um estado e uma ação padrão. Você
percorre a lista, ajusta o que discorda, e confirma uma vez.

O ganho maior não é a entrada em massa. É descobrir o lançamento que você inventou, o que
digitou com o valor errado, e o previsto que venceu e ninguém confirmou.

## Escopo

**Dentro da entrega 1:**

- Adapter do extrato da conta Nubank (CSV).
- Adapter da fatura do cartão Nubank (CSV).
- Adapter da fatura do cartão Santander (PDF).
- Classificação nos cinco estados.
- Reconstrução das compras parceladas.
- Tela de conferência em Ajustes.
- Gravação atômica das decisões.

**Fora da entrega 1:**

| Assunto | Vai para |
|---|---|
| Categoria sugerida por palavra-chave e histórico | entrega 2 |
| Aviso de "X dias sem lançamentos" na tela Hoje | entrega 3 |
| Web Share Target (receber arquivo pelo Android) | entrega 3 |
| Adapter OFX genérico | entrega 3 |
| Descompactação do zip do Nubank | entrega 3 |
| Detecção automática de banco e mapeamento manual de colunas | entrega 3 |

O adapter OFX estava previsto para esta entrega e saiu dela. O `_parse_ofx_transactions` do
`finance.py` continua servindo de referência quando a entrega 3 chegar. A interface `Adapter`
já o acomoda sem retrabalho.

O zip do Nubank também saiu. Na entrega 1 você descompacta no celular e envia os CSV soltos.

## Onde o código mora

```
src/importar/                  # lógica pura, sem E/S — irmã de src/backup/
  tipos.ts                     # LancamentoBruto, Adapter, ItemConferencia
  valores.ts                   # parsearValorExtrato, parsearDataExtrato
  csv.ts                       # leitor CSV próprio
  parcelas.ts                  # "03/10" → compra original reconstruída
  conferencia.ts               # brutos × Dados → itens classificados
  aplicar.ts                   # decisões → repo
  adapters/
    nubankConta.ts
    nubankCartao.ts
    santanderFatura.ts
    textoPdf.ts                # casca fina isolando o pdf.js
    index.ts                   # registro e detecção
  fixtures/                    # dados sintéticos para os testes
  CLAUDE.md
src/ui/importar/
  Importar.tsx                 # seção de Ajustes
  ListaConferencia.tsx
  ItemConferencia.tsx
```

`src/importar/` é lógica pura, como `src/domain/`. Ela não fica em `src/domain/` porque tem
muitos arquivos e um assunto próprio, do jeito que `src/backup/` também tem.

Os nomes são em português, pela regra do `CLAUDE.md`. O desenho original usava
`ImportAdapter`, `RawTransaction`, `date` e `amount`. Aqui são `Adapter`, `LancamentoBruto`,
`data` e `valorCent`.

## O fluxo

```
arquivo → detectar → adapter.ler → LancamentoBruto[] → conferir(brutos, dados) → ItemConferencia[]
                                                                                        ↓
                                                                    você decide item a item
                                                                                        ↓
                                                                          aplicar → repo
```

`conferir` é uma função pura. Ela recebe os brutos e o snapshot `Dados`, e devolve a lista
classificada. Ela não toca em IndexedDB, em React, nem em arquivo. É onde mora toda a
inteligência da feature, e é onde os testes pegam tudo.

## Tipos

```ts
/** Uma linha lida de um arquivo de banco, antes de qualquer decisão. É formato
 *  intermediário: aqui o valor ainda carrega sinal, porque é assim que o banco escreve. */
export interface LancamentoBruto {
  data: ISODate;
  valorCent: number;       // negativo = saída
  descricao: string;
  fonte: 'conta' | 'cartao';
  externalId?: string;     // "Identificador" do Nubank; FITID do OFX na entrega 3
  parcela?: { n: number; total: number };  // "03/10"
}

export interface Adapter {
  id: 'nubank-conta-csv' | 'nubank-cartao-csv' | 'santander-fatura-pdf';
  rotulo: string;
  detectar(nome: string, inicio: string): boolean;
  ler(conteudo: ArrayBuffer): Promise<LeituraAdapter>;
}

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;   // linhas ilegíveis; nunca exceção
}
```

O sinal do `valorCent` morre na conferência. No Flow o valor é sempre positivo, e quem diz
entrada ou saída é o `tipo` da categoria (`ganho` ou `gasto`). O sinal existe no
`LancamentoBruto` só porque é o que o arquivo traz.

## Os cinco estados

```ts
export type EstadoItem = 'confere' | 'previsto' | 'divergente' | 'novo' | 'sobra';
```

| Estado | O que é | Ação padrão |
|---|---|---|
| `confere` | já existe no app um lançamento igual | nada |
| `previsto` | casa com um previsto ou recorrência ainda não confirmado | confirmar |
| `divergente` | casa por data e descrição, mas o valor não bate | confirmar com o valor do banco |
| `novo` | não existe nada parecido no app | adicionar |
| `sobra` | está no app, dentro do período, e não está no arquivo | nenhuma |

O `sobra` é o que transforma isto numa conferência de verdade. Ele é a única forma de
descobrir um lançamento duplicado ou inventado.

A ação padrão do `sobra` é `ignorar`. Excluir um lançamento nunca é padrão: o banco pode
simplesmente não ter processado ainda. O `sobra` chama atenção; quem decide é você.

O `sobra` só olha o período coberto pelo arquivo. Esse período é a data mínima e a máxima dos
brutos lidos. Fora dele, o silêncio do arquivo não significa nada.

```ts
export interface ItemConferencia {
  estado: EstadoItem;
  bruto?: LancamentoBruto;        // ausente em 'sobra'
  lancamentoId?: ID;              // o lançamento do app que casou
  compraCartaoId?: ID;            // a compra do cartão que casou
  compraReconstruida?: CompraReconstruida;
  acao: AcaoItem;
}

export type AcaoItem =
  | { tipo: 'ignorar' }
  | { tipo: 'confirmar' }
  | { tipo: 'confirmarComValor'; valorCent: number }
  | { tipo: 'adicionarLancamento'; categoriaId: ID }
  | { tipo: 'adicionarCompra'; categoriaCartaoId: ID }
  | { tipo: 'excluir' };           // só a partir de 'sobra', nunca automático
```

## Casamento

A ordem importa. Cada regra só roda sobre o que a anterior não resolveu.

1. **Por `externalId`.** O `Identificador` do Nubank é estável entre exportações. Quando ele
   existe e já foi visto, o casamento é exato e não admite dúvida.
2. **Por data, valor e descrição.** Data com tolerância de ±3 dias, valor exato, descrição
   normalizada igual. O banco posta em D+1, e às vezes em D+3 depois de um fim de semana.
3. **Por data e descrição, valor diferente.** Mesma tolerância de data. Resulta em
   `divergente`.

**Normalizar a descrição** é: minúscula, sem acento, sem pontuação, sem espaço duplicado, e
sem os sufixos de terminal e NSU que o banco acrescenta. Duas descrições normalizadas iguais
são a mesma coisa.

**O casamento é um-para-um e guloso.** Cada lançamento do app casa no máximo uma vez. Sem
isso, dois cafés de R$ 10,00 no mesmo dia casam os dois com o mesmo lançamento: um vira
`confere` e o outro vira `novo`. Errado nos dois sentidos. A ordem gulosa é a distância de
data, do menor para o maior, com empate resolvido pela ordem do arquivo.

**Onde procurar.** Bruto com `fonte: 'conta'` casa contra `Lancamento`. Bruto com
`fonte: 'cartao'` casa contra `CompraCartao`. As duas listas nunca se cruzam: uma compra de
cartão não pode casar com um lançamento da box, porque no Flow o lançamento de cartão é a
fatura inteira, calculada por `fatura.ts`.

## Cartão

**Gasto de cartão vira `CompraCartao`, nunca `Lancamento`.** A fatura o Flow já calcula
sozinho, a partir das compras. Criar um lançamento para cada linha da fatura duplicaria tudo.

**A categoria na entrega 1 é "A classificar".** Uma `CategoriaCartao` criada sob demanda no
cartão, no mesmo padrão de `repo.categoriaAssinaturasDe`. Classificar 80 itens na hora da
conferência mata o hábito antes dele nascer. A entrega 2 sugere a categoria; até lá, você
reclassifica na aba Cartão, quando quiser.

## Parcelas

Uma linha `PARCELA 03/10 — R$ 100,00` na fatura não é uma compra de R$ 100,00 neste mês. É a
terceira parcela de uma compra de R$ 1.000,00 feita dois meses atrás.

`CompraCartao` guarda `valorTotal` e `parcelas`. O `fatura.ts` espalha as parcelas a partir da
data da compra. Então a reconstrução é:

```
data       = mês da fatura menos (n − 1) meses, no mesmo dia da linha
valorTotal = valor da parcela × total de parcelas
parcelas   = total
```

Aceitar o item faz o Flow voltar a projetar as parcelas futuras sozinho. Essa é a razão de
reconstruir em vez de gravar a parcela do mês: sem isso, a projeção fica otimista até você
importar a fatura seguinte.

**A identidade para o casamento de uma parcelada** é o cartão, a descrição normalizada, o
valor da parcela e o total de parcelas. Ela não inclui o número da parcela. Assim, importar a
fatura do mês seguinte reconhece a mesma compra e a classifica como `confere`.

**O arredondamento não fecha.** `valorParcela` em `fatura.ts` joga a sobra dos centavos na
primeira parcela. Uma compra de R$ 1.000,00 em 3× dá 333,34 + 333,33 + 333,33. Se o banco
dividir de outro jeito, a reconstrução erra o total em alguns centavos. A tela mostra o total
reconstruído e deixa você corrigir. Não vale inventar heurística para isso.

**Em aberto:** o Santander não escreve todas as parceladas no mesmo formato. IOF, câmbio e
estorno de parcela podem mudar a linha. Só a amostra decide as regras finais.

## Adapters

### Nubank conta (CSV)

Cabeçalho: `Data, Valor, Identificador, Descrição`. Positivo é entrada, negativo é saída.
`fonte: 'conta'`. O `Identificador` vira `externalId`.

### Nubank cartão (CSV)

Cabeçalho: `date, title, amount`. **Positivo é gasto** — o sinal é invertido na leitura, para
respeitar a convenção do `LancamentoBruto`. `fonte: 'cartao'`. Não há identificador.

### Santander fatura (PDF)

Duas metades, separadas de propósito:

- `textoPdf.ts` expõe só `extrairTextoPdf(buf): Promise<string>`. É a única parte que conhece
  o pdf.js.
- `santanderFatura.ts` recebe **texto** e devolve os brutos. Ele parseia as linhas de
  lançamento, e reconhece parcela, IOF, câmbio e estorno.

Essa separação é o que torna a feature testável. O parser de linhas roda sobre uma fixture de
texto. Nenhum teste carrega pdf.js, nem um PDF binário.

`fonte: 'cartao'`. Não há identificador.

### Detecção

`adapters/index.ts` tenta os adapters na ordem, com o nome do arquivo e os primeiros bytes.
CSV decide pelo cabeçalho, como no `detect_and_parse` do `finance.py`. PDF decide pela
assinatura `%PDF`. Nada casou: a tela pede que você escolha o formato na mão.

## Leitura de valores e datas

`valores.ts` porta `_parse_amount` e `_parse_date` do `finance.py`, com duas mudanças:

- O resultado é **centavos inteiros**, não float. O `money.ts` só tem
  `parsearCentavosDecimal("123.45")`, que não aceita negativo nem formato brasileiro. A função
  nova aceita `1.234,56`, `1234.56`, `-45,00` e `R$ 12,34`.
- Valor ilegível devolve `undefined`. Não lança exceção.

As datas aceitas são `AAAA-MM-DD`, `DD/MM/AAAA`, `DD/MM/AA` e `AAAAMMDD`.

`csv.ts` é um leitor próprio, de umas 40 linhas. Ele trata BOM, aspas e vírgula dentro de
aspas. Uma dependência de CSV não se justifica para isso.

## Gravação

`aplicar.ts` traduz as ações em chamadas do `repo`:

| Ação | Chamada |
|---|---|
| `confirmar` | `repo.confirmarPendente(id)` |
| `confirmarComValor` | `repo.confirmarPendente(id, valorCent)` |
| `adicionarLancamento` | `repo.salvarLancamento(...)` |
| `adicionarCompra` | `repo.salvarCompraCartao(...)` |
| `excluir` | `repo.excluirLancamento(id)` ou `repo.excluirCompraCartao(id, horizonte)` |

Duas exigências:

1. **A gravação é atômica.** Uma transação Dexie só. Gravar metade faz a próxima conferência
   mentir sobre o que já entrou.
2. **A sincronização de cartões roda uma vez, no fim.** `repo.salvarCompraCartao` recebe
   `horizonte` e chama `sincronizarCartoes` a cada compra. Oitenta compras disparariam oitenta
   sincronizações. `aplicar.ts` precisa de um caminho em lote, que grava tudo e sincroniza uma
   vez só. Isso é trabalho novo no `repo`, não só no `importar`.

Depois de aplicar, a UI chama `recarregar()`, como qualquer outra mutação.

## Interface

Entra como seção nova em Ajustes, vizinha de "Backup e restauração". Importar e exportar moram
juntos. O padrão de seção já existe em `TelaAjustes.tsx` e `abrirAjustes(secao)` já leva até
lá — o que a entrega 3 vai usar para o aviso de lacuna.

A tela tem três passos:

1. **Escolher o arquivo.** Um seletor de arquivo. O adapter detectado aparece por escrito,
   com opção de trocar.
2. **Escolher o destino.** `fonte: 'conta'` pede a box, e o banco quando a box tem mais de um.
   `fonte: 'cartao'` pede o cartão. Vem pré-marcado com a única opção, ou com a última usada.
   Nada é gravado até o passo 3.
3. **Conferir a lista.** Os itens em ordem de data, agrupados por estado, com um resumo no
   topo: quantos conferem, quantos são novos, quantos divergem, quantos sobram. Cada item
   mostra a ação padrão e deixa trocá-la ou descartá-lo. Um botão confirma tudo.

O formulário vem antes da lista, pela regra de `docs/estilo/nivel-5-nova-tela.md`.

Tela nova exige mockup aprovado antes do código, pela regra do `CLAUDE.md`. O mockup é o
primeiro passo do plano de implementação, não uma etapa do desenho.

## Erros

**Nenhum parser lança exceção.** É o padrão de `src/domain/notaFiscal.ts`, e pela mesma razão:
a entrada vem de fora do app, e arquivo malformado é entrada esperada, não defeito.

Linha ilegível é contada em `linhasIgnoradas` e aparece no topo da lista ("3 linhas
ignoradas"). Arquivo que nenhum adapter reconhece dá uma mensagem que diz o que era esperado,
como o `detect_and_parse` já faz.

Arquivo sem nenhuma linha legível não abre a tela de conferência. Ele avisa e volta.

## Testes

Os testes ficam ao lado do código, com o sufixo `.test.ts`, como no resto do repositório.

O grosso da cobertura é `conferencia.test.ts`, porque `conferir` é pura e concentra as
decisões. Os casos que importam:

- Cada um dos cinco estados, isolado.
- Dois lançamentos iguais no mesmo dia, para provar o casamento um-para-um.
- Casamento dentro e fora da tolerância de ±3 dias.
- `sobra` fora do período do arquivo, que não deve aparecer.
- `externalId` vencendo o casamento por data e valor.
- Parcelada reconstruída, e a mesma parcelada reconhecida no mês seguinte.

**As fixtures são sintéticas, escritas à mão.** Nenhum arquivo real do banco entra no
repositório. O guard `scripts/verificar-dados-reais.mjs` bloqueia valor em real e termos
privados em qualquer arquivo versionado, e um extrato real seria exatamente o que ele existe
para impedir.

As amostras reais anonimizadas ficam no scratchpad da sessão, fora do git, e servem só para
escrever as regras do parser.

## pdf.js

`pdfjs-dist` é dependência nova. Pelo `CLAUDE.md`, isso é decisão de produto: exige
confirmação do usuário, justificativa, `npm audit`, e o lockfile no mesmo commit.

**A justificativa:** extrair texto de PDF não é código que se escreva por conta própria. Um
PDF guarda glifos posicionados, não frases. Reconstruir a ordem de leitura a partir de
coordenadas é o trabalho inteiro do pdf.js.

**A mitigação:** `import()` dinâmico. O pdf.js fica fora do bundle inicial do PWA e só baixa
quando você importa uma fatura pela primeira vez. Nenhum teste o carrega.

Esse passo é explícito no plano de implementação, e para antes de instalar.

## Riscos

| Risco | O que acontece | O que fazemos |
|---|---|---|
| Layout do PDF muda | o parser para de reconhecer linhas | linha não reconhecida é ignorada e contada, nunca inventada |
| Descrição do banco muda entre exportações | o mesmo gasto vira `novo` na segunda vez | tolerância de data e normalização; `externalId` quando houver |
| Fatura importada com compras já lançadas à mão | risco de duplicar | é exatamente o que os estados resolvem |
| Arredondamento da parcela | total reconstruído erra por centavos | a tela mostra o total e deixa corrigir |
| Compra perto do fechamento | cai num ciclo diferente do que o banco usou | `fatura.ts` decide pelo ciclo; a conferência não mexe nisso |

## Decisões que a amostra vai fechar

Estas dependem dos arquivos de exemplo e não dá para decidir antes:

- O formato exato das linhas de parcela, IOF, câmbio e estorno na fatura do Santander.
- Se o CSV do Nubank cartão marca parcela no `title`, e como.
- Quais sufixos de terminal e NSU aparecem, para a normalização de descrição saber o que tirar.
- Se a tolerância de ±3 dias é suficiente na prática.

## Entregas seguintes

**Entrega 2 — categoria sugerida.** Regras por palavra-chave mais histórico de descrições já
classificadas. Substitui o "A classificar" por uma sugestão editável, no item da lista.

**Entrega 3 — alcance.** Aviso de "X dias sem lançamentos" na tela Hoje, com atalho para a
conferência. Web Share Target, para receber o arquivo pelo menu Compartilhar do Android.
Adapter OFX genérico. Descompactação do zip do Nubank. Detecção automática de banco e
mapeamento manual de colunas, como último recurso.
