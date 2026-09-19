# Conferência por extrato — entrega 1

Data: 2026-09-17
Estado: desenho aprovado, formatos verificados contra arquivos reais, plano por escrever
Backlog: item 11 do `TODO.md` ("Importar extrato bancário")

## O problema

O Flow não tem caminho de entrada em massa. Quem passa uma semana sem lançar precisa digitar
cada item na aba Lançar. Isso não escala, e o que não escala vira abandono.

O banco já tem esses dados. O Nubank exporta o extrato da conta em CSV. O Santander manda a
fatura do cartão em PDF, por e-mail, todo mês.

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
- Adapter da fatura do cartão Santander (PDF).
- Classificação nos seis estados.
- Reconstrução das compras parceladas.
- Conferência do pagamento da fatura.
- Tela de conferência em Ajustes.
- Gravação atômica das decisões.

**Fora da entrega 1:**

| Assunto | Vai para | Por quê |
|---|---|---|
| Categoria sugerida por palavra-chave e histórico | entrega 2 | escopo |
| Aviso de "X dias sem lançamentos" na tela Hoje | entrega 3 | escopo |
| Web Share Target (receber arquivo pelo Android) | entrega 3 | escopo |
| Adapter OFX genérico | entrega 3 | escopo |
| Descompactação do zip do Nubank | entrega 3 | escopo |
| Detecção automática de banco e mapeamento de colunas | entrega 3 | escopo |
| Adapter da fatura do cartão Nubank (CSV) | entrega 3 | o usuário não usa esse cartão |
| Gravar estorno de cartão | item próprio | ver "Estorno" |

## Os formatos

Os dois formatos abaixo foram verificados contra arquivos reais do usuário, em 2026-09-17, numa
conversa separada. Os arquivos nunca entraram no repositório nem na sessão de desenho. O que
segue é a descrição da forma, com todo conteúdo trocado por dado sintético.

### Extrato da conta Nubank (CSV)

| Item | Valor |
|---|---|
| Cabeçalho | `Data,Valor,Identificador,Descrição` |
| Separador | vírgula; campos sem aspas neste arquivo |
| Codificação | UTF-8; BOM não verificado — ler tolerando BOM |
| Data | `DD/MM/AAAA` |
| Valor | ponto decimal, 2 casas, **sem separador de milhar**, sem `R$`; negativo com sinal antes |
| Identificador | UUID de 36 caracteres, hexadecimal minúsculo |
| Colunas | 4 em todas as linhas; nenhuma linha que não seja transação |

O `Identificador` vira o `externalId` do `LancamentoBruto`. Ele ainda não casa nada — ver
"Casamento".

**Moldes de descrição.** O Nubank monta a descrição por template. Os moldes vistos:

```
Resgate RDB
Aplicação RDB
Pagamento de boleto efetuado - {BENEFICIÁRIO}
Transferência enviada pelo Pix - {NOME} - {DOC} - {BANCO} ({CÓD}) Agência: {AG} Conta: {CONTA}
Transferência recebida pelo Pix - {…mesmo resto…}
Transferência recebida pelo Pix via Open Banking - {…mesmo resto…}
```

**Armadilha registrada:** o nome do banco pode conter ` - `, como em `BANCO ALFA - IP (0001)`.
Partir a descrição por ` - ` quebra nesses casos. A regra é ancorar em `\(\d{4}\) Agência:` e
cortar a partir dali.

O `{DOC}` é CPF mascarado com `•` (U+2022) para pessoa física, e CNPJ completo para empresa. O
`{NOME}` de MEI vem precedido de `NN NNN NNN`.

### Fatura do cartão Santander (PDF)

O detalhamento fica na seção `Detalhamento da Fatura`, dividida em **um bloco por cartão**. O
cabeçalho do bloco é `FULANO DE TAL - 0000 XXXX XXXX 0000`, e um cartão virtual leva o prefixo
`@ `. Dentro de cada bloco há três subseções, nesta ordem:

1. `Pagamento e Demais Créditos`
2. `Parcelamentos`
3. `Despesas`

A linha de lançamento tem a forma `[ícone] DD/MM DESCRIÇÃO [NN/NN] VALOR`, com espaço simples
entre os campos.

| Item | Valor |
|---|---|
| Data | `DD/MM`, **sem ano** |
| Valor | sem `R$`, ponto de milhar, vírgula decimal; negativo com sinal antes |
| Parcela | `NN/NN` com zero à esquerda, **depois** da descrição e antes do valor |
| Ícone | vira o caractere solto `2 ` (compra online) ou `3 ` (aproximação); pode não haver |
| Coluna US$ | existe no layout, vazia em todas as linhas — some na extração |

**Três armadilhas registradas:**

1. **A extração junta transações numa mesma linha.** Na página 3 do arquivo verificado, várias
   transações e o cabeçalho de colunas saíram numa linha só. O parser **não pode** assumir uma
   transação por linha. Ele segmenta o texto inteiro por `(?:[23] )?\d{2}/\d{2} `. O resultado
   varia conforme a biblioteca de extração, então a segmentação por regex é obrigatória, não uma
   otimização.
2. **A descrição contém números.** `MERCADO ALFA 103` é descrição, não parcela. A regex de
   parcela tem de estar ancorada em `\d{2}/\d{2} ` imediatamente antes do valor final.
3. **Não há ano na data.** Ver "Parcelas".

**Ruído a descartar.** Estes trechos se repetem ou parecem lançamento:

```
N/4                                         (número de página)
Detalhamento da Fatura
Compra Data Descrição Parcela R$ US$        (cabeçalho de colunas)
VALOR TOTAL ...                             (fecha cada bloco de cartão)
JUL. / AGO. ...                             (linhas do Histórico de Faturas)
(+) ... / (-) ... / (=) ...                 (linhas do Resumo da Fatura)
```

Mais a linha da anuidade no quadro da página 1, e as datas e valores do boleto na Ficha de
Compensação.

**Soma de verificação.** Cada bloco de cartão fecha com uma linha `VALOR TOTAL`, que soma
`Parcelamentos` + `Despesas` daquele cartão, sem os créditos. O parser compara a própria soma
com esse número. Divergência não aborta nada: vira um aviso no topo da lista, porque o propósito
da tela é justamente mostrar divergência.

**O que a fatura verificada não tem:** não há linha de IOF nem compra internacional no
detalhamento. O IOF aparece só no `Resumo da Fatura`, como `(+) IOF`, e
`(+) Total Despesas/Débitos no Exterior` está zerado. O desenho anterior previa parsear os dois
no detalhamento. Isso saiu. Se um mês trouxer uma compra internacional, a linha cai em "não
reconhecida" e é contada, nunca adivinhada.

## Onde o código mora

```
src/importar/                  # lógica pura, sem E/S — irmã de src/backup/
  tipos.ts                     # LancamentoBruto, Adapter, ItemConferencia
  valores.ts                   # parsearValorExtrato, parsearDataExtrato
  csv.ts                       # leitor CSV próprio
  descricao.ts                 # normalizar, e os moldes do Nubank
  parcelas.ts                  # "NN/NN" → compra original
  conferencia.ts               # brutos × Dados → itens classificados
  aplicar.ts                   # decisões → repo
  adapters/
    nubankConta.ts
    santanderFatura.ts         # recebe TEXTO, devolve brutos
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

Os nomes são em português, pela regra do `CLAUDE.md`. O desenho original usava `ImportAdapter`,
`RawTransaction`, `date` e `amount`. Aqui são `Adapter`, `LancamentoBruto`, `data` e `valorCent`.

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
  externalId?: string;     // "Identificador" do Nubank
  parcela?: { n: number; total: number };
  natureza?: NaturezaBruto;  // o que o adapter reconheceu na linha
}

/** Linhas que não são gasto nem ganho comum, reconhecidas pelo adapter. */
export type NaturezaBruto =
  | 'aplicacaoInterna'      // "Aplicação RDB"
  | 'resgateInterno'        // "Resgate RDB"
  | 'pagamentoFatura'       // "PAGAMENTO DE FATURA-INTERNET"
  | 'estornoCartao';        // crédito em "Pagamento e Demais Créditos"

export interface Adapter {
  id: 'nubank-conta-csv' | 'santander-fatura-pdf';
  rotulo: string;
  detectar(nome: string, inicio: string): boolean;
  ler(conteudo: ArrayBuffer): Promise<LeituraAdapter>;
}

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;   // linhas ilegíveis; nunca exceção
  avisos: string[];          // ex.: soma do bloco diferente do VALOR TOTAL
}
```

O sinal do `valorCent` morre na conferência. No Flow o valor é sempre positivo, e quem diz
entrada ou saída é o `tipo` da categoria (`ganho` ou `gasto`). O sinal existe no
`LancamentoBruto` só porque é o que o arquivo traz.

## Os seis estados

```ts
export type EstadoItem =
  | 'confere' | 'previsto' | 'divergente' | 'novo' | 'sobra' | 'interno';
```

| Estado | O que é | Ação padrão |
|---|---|---|
| `confere` | já existe no app um lançamento igual | nada |
| `previsto` | casa com um previsto ou recorrência ainda não confirmado | confirmar |
| `divergente` | casa por data e descrição, mas o valor não bate | confirmar com o valor do banco |
| `novo` | não existe nada parecido no app | adicionar |
| `sobra` | está no app, dentro do período, e não está no arquivo | nenhuma |
| `interno` | movimento que não é ganho nem gasto | ignorar |

O `sobra` é o que transforma isto numa conferência de verdade. Ele é a única forma de descobrir
um lançamento duplicado ou inventado.

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
  | { tipo: 'confirmarComValor'; valorCent: number; data?: ISODate }
  | { tipo: 'adicionarLancamento'; categoriaId: ID }
  | { tipo: 'adicionarCompra'; categoriaCartaoId: ID }
  | { tipo: 'excluir' };           // só a partir de 'sobra', nunca automático
```

## Movimento interno: a caixinha do Nubank

`Aplicação RDB` e `Resgate RDB` são dinheiro entrando e saindo da caixinha do Nubank. Se virarem
lançamentos comuns, o fluxo de caixa ganha entradas e saídas que não existem.

Os dois casos **não são simétricos**, e é isso que o desenho precisa respeitar.

**`Resgate RDB` é sempre interno.** O dinheiro sai da caixinha para ser gasto em seguida, e esse
gasto aparece como outra linha do mesmo extrato. Contar o resgate somaria a mesma quantia duas
vezes. Estado `interno`, ação `ignorar`, sem pergunta.

**`Aplicação RDB` é ambíguo, e o CSV não distingue.** O mesmo rótulo cobre duas coisas
diferentes:

- guardar na caixinha principal — dinheiro que continua disponível, movimento interno;
- mandar para uma reserva de longo prazo que você nem conta — saída de verdade.

Nenhuma regra automática separa as duas. O item entra como `interno` com ação `ignorar`, e a
lista oferece, ali mesmo, trocar para "é uma saída de verdade" e escolher a categoria. A decisão
é sua, item a item.

**Pressuposto que isto assume:** o saldo da box já inclui o dinheiro da caixinha. É o que decorre
de você não querer o resgate no fluxo. Se um dia o saldo passar a contar só a conta, esta regra
se inverte e precisa ser revista.

**Por que não virar uma transferência de verdade.** A v0.29.0 trouxe
`repo.registrarTransferencia`, que liga dois `Banco` da mesma box por um par de lançamentos
`origem: 'transferencia'` em categorias ocultas. Seria o modelo certo para a caixinha — mas
exige que a caixinha exista como `Banco` cadastrado, e ela não existe hoje. Criar bancos por
conta própria, a partir de um rótulo de CSV, seria a importação decidindo o cadastro do
usuário. Na entrega 1 o `interno` não grava nada. Ligar os dois é melhoria da entrega 2, e o
desenho não precisa mudar para isso acontecer.

## Pagamento da fatura

A fatura traz uma linha `PAGAMENTO DE FATURA-INTERNET`, com valor negativo, em `Pagamento e
Demais Créditos`. Isso é o pagamento da fatura **anterior**, não uma compra. Gravá-lo como
`CompraCartao` estaria errado duas vezes: inverteria o sinal do ciclo e duplicaria o que o Flow
já modela.

No Flow, a fatura é um `Lancamento` com `origem: 'cartao'`, `cartaoId` e `faturaMes`. Pagá-la é
deixar esse lançamento `efetivo`, com o valor pago e a data do pagamento —
`repo.confirmarPendente(id, valorReal, dataReal)` faz exatamente isso.

Então a linha de pagamento **é conferida**, não ignorada:

| Situação no app | Estado | Ação padrão |
|---|---|---|
| lançamento da fatura `efetivo`, mesmo valor | `confere` | nada |
| lançamento da fatura `previsto` | `previsto` | confirmar com valor e data do banco |
| `efetivo` com outro valor | `divergente` | confirmar com o valor do banco |
| nenhum lançamento de fatura naquele mês | `novo` | nada — ver abaixo |

O último caso não gera ação. Um pagamento sem fatura correspondente significa que o cartão não
está cadastrado, ou que o ciclo está configurado errado. Criar um lançamento solto esconderia o
problema. A lista diz o que houve e para por aí.

A linha `Pagamento de boleto efetuado - {BENEFICIÁRIO}` do CSV da conta segue a regra geral: é um
gasto comum, e vira `novo` ou casa com o previsto. Ela **não** é tratada como pagamento de
fatura, porque o beneficiário de um boleto pode ser qualquer um.

## Parcelas

Esta é a parte que mais mudou depois de ver o arquivo real.

**A fatura já traz a data da compra original.** Na subseção `Parcelamentos`, a data da linha é a
da compra, não a do mês corrente, e pode ser de um ano anterior. A linha
`02/11 LOJA GAMA 10/12 123,45` quer dizer: compra em 02/11, parcela 10 de 12, e 123,45 por
parcela.

O desenho anterior calculava a data original subtraindo `(n − 1)` meses do mês da fatura. Isso
era aproximação, e saiu. A reconstrução agora é direta:

```
data       = a data da própria linha, com o ano deduzido
valorTotal = valor da parcela × total de parcelas
parcelas   = total
```

`CompraCartao` guarda `valorTotal` e `parcelas`, e `fatura.ts` espalha as parcelas a partir da
data da compra. Aceitar o item faz o Flow voltar a projetar as parcelas futuras sozinho. É a
razão de reconstruir em vez de gravar só a parcela do mês: sem isso, a projeção fica otimista até
você importar a fatura seguinte.

**Deduzir o ano.** A data vem como `DD/MM`, sem ano. O ano escolhido é o que põe a data mais
perto de `mês da fatura − (n − 1) meses`. Quando a data deduzida cai a mais de um mês do
esperado, o item é marcado com aviso e fica visível para você conferir. Nunca se inventa um ano
em silêncio.

**A identidade para o casamento** de uma parcelada é o cartão, a descrição normalizada, o valor
da parcela e o total de parcelas. Ela **não** inclui o número da parcela. Assim, importar a
fatura do mês seguinte reconhece a mesma compra e a classifica como `confere`.

**Anuidade.** Uma linha de anuidade usa o formato de parcela (`01/12`) mas aparece em `Despesas`,
não em `Parcelamentos`. A regra é a mesma para as duas subseções: `NN/NN` antes do valor é
parcela, venha de onde vier. Para a anuidade isso é correto — ela é mesmo uma cobrança em 12
vezes, e a parcela 1 tem a data do próprio mês.

**O arredondamento não fecha.** `valorParcela` em `fatura.ts` joga a sobra dos centavos na
primeira parcela. Se o banco dividir de outro jeito, a reconstrução erra o total em alguns
centavos. A tela mostra o total reconstruído e deixa corrigir. Não vale inventar heurística para
isso.

## Estorno

Créditos aparecem em `Pagamento e Demais Créditos` com a descrição do estabelecimento e valor
negativo. Não há rótulo "ESTORNO".

**Decisão: a entrega 1 reconhece o estorno e não o grava.** Ele entra como `interno`, com a
explicação na lista.

A razão não é a aritmética. A investigação do código mostrou que o cálculo aguenta valor
negativo:

- `valorParcela(v, 1, 1)` devolve `v` exato — estorno é sempre à vista, sem arredondamento.
- `calcularFaturas` soma, e o total da fatura baixa, que é o comportamento certo.
- `sincronizarCartoes` grava um `Lancamento` cujo valor pode ser negativo, e `types.ts` já diz
  que negativo é permitido para estorno.

**O que bloqueia é a edição.** `CampoValor` monta o valor dígito a dígito (`/^[0-9]$/` em
`src/ui/CampoValor.tsx:38`) e não tem como expressar um número negativo. Uma compra negativa
gravada pela importação abriria no `FormCompra` sem conseguir se representar, e salvar trocaria o
sinal em silêncio. Isso é corrupção de dado por um caminho que o usuário nem percebe.

Dois efeitos menores, registrados para quem for fechar o item: `TelaCartao.tsx:196` fixa a classe
`negativo` no total da fatura, então uma fatura credora apareceria estilizada como dívida; e
`aggregations.ts:264` deixaria uma compra negativa entrar na lista de frequentes.

Gravar estorno vira item próprio, e o pré-requisito dele é `CampoValor` aceitar negativo.

## Casamento

A ordem importa. Cada regra só roda sobre o que a anterior não resolveu.

1. **Por data e valor, para `confere`/`previsto`.** Data com tolerância de ±3 dias, valor
   exato. **A descrição NÃO é exigida aqui** — foi revisto depois da primeira conferência real:
   o usuário digita a compra com as próprias palavras, e o banco escreve outra coisa
   ("MERCADOLIVRE\*MERCADOL"). Exigir descrição igual fazia quase nada casar. Entre vários
   candidatos de mesmo valor na janela de data, a ordem de preferência é: descrição igual
   primeiro, depois a menor distância de data, depois a ordem de chegada no arquivo.
2. **Por data e descrição, valor diferente, para `divergente`.** Mesma tolerância de data. Aqui
   a descrição normalizada igual **continua exigida** — sem isso, qualquer lançamento do mesmo
   dia pareceria divergente, não só o que é de fato o mesmo gasto com o valor errado.

**Compra parcelada casa contra o TOTAL gravado, não contra o valor da parcela.** O bruto de uma
parcela traz o valor de UMA parcela e `parcela: { n, total }`; a `CompraCartao` do app guarda o
`valorTotal` e `parcelas`. Comparar os dois direto nunca bate, e uma parcelada já lançada virava
`novo` a cada mês. Para bruto de cartão com `parcela`, o candidato casa quando: `compra.parcelas`
é igual a `parcela.total`; a data da compra está a até 3 dias da data do bruto (que já é a data
original, reconstruída pelo adapter); e `valorParcela(compra.valorTotal, compra.parcelas,
parcela.n)` (de `fatura.ts`) difere do valor absoluto do bruto em no máximo `compra.parcelas`
centavos — a sobra de arredondamento que `valorParcela` empurra para a primeira parcela. A
descrição também não é exigida aqui. Casou: `confere`, ação `ignorar`. Sem candidato: `novo`,
como antes desta regra existir.

**O `externalId` fica de fora desta entrega.** O `Identificador` do Nubank é um UUID estável
entre exportações, e seria a melhor chave possível — mas `Lancamento` não tem campo para
guardá-lo. Sem gravar, o app nunca tem um `externalId` para comparar, e a regra casaria sempre
zero. Guardá-lo exigiria uma versão nova do schema Dexie e mudança em `src/backup/`, na camada
onde erro custa dados, por um ganho que só aparece ao reimportar um período já importado. O
adapter continua lendo o campo e pondo no `LancamentoBruto`: quando a entrega 3 criar onde
guardá-lo, o dado já está no lugar certo. Enquanto isso, quem pega a reimportação é a própria
lista de conferência.

**Normalizar a descrição** é: minúscula, sem acento, sem pontuação, sem espaço duplicado. Para o
Nubank, `descricao.ts` aplica antes os moldes conhecidos e extrai a contraparte — o `{NOME}` do
Pix, o `{BENEFICIÁRIO}` do boleto. É essa contraparte que casa, não a linha inteira: o resto do
molde (agência, conta, banco) é ruído estável que só atrapalha.

**O casamento é um-para-um e guloso.** Cada lançamento do app casa no máximo uma vez. Sem isso,
dois lançamentos iguais no mesmo dia casam os dois com o mesmo registro: um vira `confere` e o
outro vira `novo`. Errado nos dois sentidos. A ordem gulosa é a distância de data, do menor para
o maior, com empate resolvido pela ordem do arquivo.

**Onde procurar.** Bruto com `fonte: 'conta'` casa contra `Lancamento`. Bruto com
`fonte: 'cartao'` casa contra `CompraCartao`. As duas listas nunca se cruzam: uma compra de
cartão não pode casar com um lançamento da box, porque no Flow o lançamento de cartão é a fatura
inteira, calculada por `fatura.ts`. A única exceção é a linha de pagamento de fatura, que casa
contra o `Lancamento` da fatura — ver "Pagamento da fatura".

## Cartão

**Gasto de cartão vira `CompraCartao`, nunca `Lancamento`.** A fatura o Flow já calcula sozinho,
a partir das compras. Criar um lançamento para cada linha da fatura duplicaria tudo.

**A categoria na entrega 1 é "A classificar".** Uma `CategoriaCartao` criada sob demanda no
cartão, no mesmo padrão de `repo.categoriaAssinaturasDe`. Classificar dezenas de itens na hora da
conferência mata o hábito antes dele nascer. A entrega 2 sugere a categoria; até lá, você
reclassifica na aba Cartão, quando quiser.

**Um bloco de cartão por vez.** A fatura pode ter mais de um cartão (titular, adicional, virtual).
As linhas não trazem os dígitos; elas herdam do cabeçalho do bloco. Na entrega 1, a tela pergunta
a qual `Cartao` do Flow cada bloco corresponde, e trata "não importar este bloco" como resposta
válida.

## Leitura de valores e datas

`valores.ts` porta `_parse_amount` e `_parse_date` do `finance.py`, com duas mudanças:

- O resultado é **centavos inteiros**, não float. O `money.ts` só tem `parsearCentavosDecimal`,
  que aceita só o formato decimal simples do XML da NFe — sem negativo e sem formato brasileiro.
  A função nova precisa dos dois formatos, porque os dois arquivos discordam: o CSV do Nubank usa
  ponto decimal e a fatura do Santander usa vírgula decimal com ponto de milhar.
- Valor ilegível devolve `undefined`. Não lança exceção.

**Ambiguidade registrada.** A regra do `finance.py` é: vírgula e ponto juntos, ou só vírgula →
formato brasileiro; caso contrário, internacional. Ela erra quando o ponto é separador de milhar
e não há centavos, porque aí lê o ponto como decimal. Nenhum dos dois arquivos produz esse caso —
o Nubank sempre escreve as duas casas decimais e o Santander sempre usa vírgula. Mesmo assim, a
função trata ponto seguido de exatamente três dígitos, sem vírgula na string, como separador de
milhar, e há teste para isso.

As datas aceitas são `AAAA-MM-DD`, `DD/MM/AAAA`, `DD/MM/AA` e `AAAAMMDD`. O `DD/MM` da fatura não
entra aqui: ele depende do ano deduzido e é tratado em `parcelas.ts`.

`csv.ts` é um leitor próprio, de umas 40 linhas. Ele trata BOM, aspas e vírgula dentro de aspas.
O arquivo verificado não tem aspas nem vírgula em descrição, mas outro mês pode ter, e uma
dependência de CSV não se justifica para 40 linhas.

## Gravação

`aplicar.ts` traduz as ações em chamadas do `repo`:

| Ação | Chamada |
|---|---|
| `confirmar` | `repo.confirmarPendente(id)` |
| `confirmarComValor` | `repo.confirmarPendente(id, valorCent, data)` |
| `adicionarLancamento` | `repo.salvarLancamento(...)` |
| `adicionarCompra` | `repo.salvarCompraCartao(...)` |
| `excluir` | `repo.excluirLancamento(id)` ou `repo.excluirCompraCartao(id, horizonte)` |
| `ignorar` | nenhuma |

Duas exigências:

1. **A gravação é atômica.** Uma transação Dexie só. Gravar metade faz a próxima conferência
   mentir sobre o que já entrou.
2. **A sincronização de cartões roda uma vez, no fim.** `repo.salvarCompraCartao` recebe
   `horizonte` e chama `sincronizarCartoes` a cada compra. Dezenas de compras disparariam dezenas
   de sincronizações, cada uma recalculando todas as faturas de todos os cartões. `aplicar.ts`
   precisa de um caminho em lote, que grava tudo e sincroniza uma vez. **Isso é trabalho novo em
   `src/db/repo.ts`**, e `src/db/` é a camada onde erro custa dados: o plano trata esse passo em
   separado, com teste próprio.

Depois de aplicar, a UI chama `recarregar()`, como qualquer outra mutação.

## Interface

Entra como seção nova em Ajustes, vizinha de "Backup e restauração". Importar e exportar moram
juntos. O padrão de seção já existe em `TelaAjustes.tsx` e `abrirAjustes(secao)` já leva até lá —
o que a entrega 3 vai usar para o aviso de lacuna.

A tela tem três passos:

1. **Escolher o arquivo.** Um seletor de arquivo. O adapter detectado aparece por escrito, com
   opção de trocar.
2. **Escolher o destino.** `fonte: 'conta'` pede a box, e o banco quando a box tem mais de um.
   `fonte: 'cartao'` pede o `Cartao` de cada bloco da fatura. Vem pré-marcado com a única opção,
   ou com a última usada. Nada é gravado até o passo 3.
3. **Conferir a lista.** Os itens em ordem de data, agrupados por estado, com um resumo no topo:
   quantos conferem, quantos são novos, quantos divergem, quantos sobram, quantos são internos, e
   quantas linhas foram ignoradas. Cada item mostra a ação padrão e deixa trocá-la ou descartá-lo.
   Um botão confirma tudo.

Os avisos do adapter (soma do bloco diferente do `VALOR TOTAL`, ano deduzido fora do esperado)
aparecem no topo da lista, não como erro.

O formulário vem antes da lista, pela regra de `docs/estilo/nivel-5-nova-tela.md`.

Tela nova exige mockup aprovado antes do código, pela regra do `CLAUDE.md`. O mockup é o primeiro
passo do plano de implementação, não uma etapa do desenho.

## Erros

**Nenhum parser lança exceção.** É o padrão de `src/domain/notaFiscal.ts`, e pela mesma razão: a
entrada vem de fora do app, e arquivo malformado é entrada esperada, não defeito.

Linha ilegível é contada em `linhasIgnoradas` e aparece no topo da lista. Arquivo que nenhum
adapter reconhece dá uma mensagem que diz o que era esperado, como o `detect_and_parse` já faz.

Arquivo sem nenhuma linha legível não abre a tela de conferência. Ele avisa e volta.

## Testes

Os testes ficam ao lado do código, com o sufixo `.test.ts`, como no resto do repositório.

O grosso da cobertura é `conferencia.test.ts`, porque `conferir` é pura e concentra as decisões.
Os casos que importam:

- Cada um dos seis estados, isolado.
- Dois lançamentos iguais no mesmo dia, para provar o casamento um-para-um.
- Casamento dentro e fora da tolerância de ±3 dias.
- `sobra` fora do período do arquivo, que não deve aparecer.
- Parcelada reconstruída, e a mesma parcelada reconhecida no mês seguinte.
- `Resgate RDB` sempre interno; `Aplicação RDB` interno com a troca para saída disponível.
- Pagamento de fatura nos quatro casos da tabela.

Em `santanderFatura.test.ts`, dois casos não negociáveis:

- Texto com várias transações grudadas numa linha só, segmentado corretamente.
- Descrição com número no fim (`MERCADO ALFA 103`) que não vira parcela.

E em `descricao.test.ts`: nome de banco contendo ` - ` que não parte a descrição no lugar errado.

**As fixtures são sintéticas, escritas à mão.** Nenhum arquivo real do banco entra no
repositório. O guard `scripts/verificar-dados-reais.mjs` bloqueia valor em real fora da lista de
sintéticos aprovados, e termos privados, em qualquer arquivo versionado. As fixtures usam só
valores daquela lista.

Os arquivos reais nunca entraram na sessão de desenho. A descrição dos formatos veio de uma
conversa separada, que devolveu só a forma, com o conteúdo trocado.

## pdf.js

`pdfjs-dist` é dependência nova. Pelo `CLAUDE.md`, isso é decisão de produto: exige confirmação
do usuário, justificativa, `npm audit`, e o lockfile no mesmo commit.

**A justificativa:** extrair texto de PDF não é código que se escreva por conta própria. Um PDF
guarda glifos posicionados, não frases. Reconstruir a ordem de leitura a partir de coordenadas é
o trabalho inteiro do pdf.js.

**A mitigação:** `import()` dinâmico. O pdf.js fica fora do bundle inicial do PWA e só baixa
quando você importa uma fatura pela primeira vez. Nenhum teste o carrega — `textoPdf.ts` existe
justamente para que `santanderFatura.ts` receba texto puro.

Esse passo é explícito no plano de implementação, e para antes de instalar.

## Riscos

| Risco | O que acontece | O que fazemos |
|---|---|---|
| A extração de texto muda de ordem | a segmentação por regex pega linhas fora de ordem | a soma por bloco é comparada com o `VALOR TOTAL` e a divergência vira aviso |
| Layout do PDF muda | o parser para de reconhecer linhas | linha não reconhecida é ignorada e contada, nunca inventada |
| Compra internacional aparece num mês | formato nunca visto | cai em "não reconhecida"; ninguém adivinha câmbio |
| Descrição do banco muda entre exportações | o mesmo gasto vira `novo` na segunda vez | `externalId` resolve no Nubank; no Santander, tolerância de data e normalização |
| Arredondamento da parcela | total reconstruído erra por centavos | a tela mostra o total e deixa corrigir |
| Compra perto do fechamento | cai num ciclo diferente do que o banco usou | `fatura.ts` decide pelo ciclo; a conferência não mexe nisso |
| `Aplicação RDB` classificada errado | some do fluxo um gasto real, ou entra um gasto que não existe | nunca é automático: a lista sempre pergunta |

## Entregas seguintes

**Entrega 2 — categoria sugerida.** Regras por palavra-chave mais histórico de descrições já
classificadas. Substitui o "A classificar" por uma sugestão editável, no item da lista. A
contraparte extraída pelos moldes do Nubank (`descricao.ts`) é a chave do histórico.

**Entrega 3 — alcance.** Aviso de "X dias sem lançamentos" na tela Hoje, com atalho para a
conferência. Web Share Target, para receber o arquivo pelo menu Compartilhar do Android. Adapter
da fatura do cartão Nubank (CSV). Adapter OFX genérico. Descompactação do zip do Nubank. Detecção
automática de banco e mapeamento manual de colunas, como último recurso. Campo para guardar o
`externalId` do banco no `Lancamento`, com a versão nova do schema Dexie e o ajuste em
`src/backup/` que ela exige.

**Itens soltos que esta spec abriu:**

- Gravar estorno de cartão, com `CampoValor` aceitando negativo como pré-requisito.
- Ligar o estado `interno` às transferências do branch `transferencia-bancos`, depois que ele
  entrar na `main`.

## Decisões depois do mockup (2026-09-18)

**Variante B, cronológica.** A lista segue a ordem dos dias, como o extrato. O estado vira
uma etiqueta colorida em cada item, em vez de agrupar. Os passos 1 e 2, o aviso do adapter e
o resumo de contagens ficam no topo. Item que confere aparece em linha compacta, sem botões.

**A categoria padrão depende do sinal.** A primeira versão de `conferir` usava uma categoria
só para todo lançamento novo de conta. No Flow, quem decide se um valor soma ou subtrai no
saldo é o tipo da categoria (`projection.ts`). Uma entrada gravada em categoria de gasto
tiraria o valor da projeção em vez de somar. Agora `conferir` recebe
`categoriasPadrao: { ganho, gasto }` e escolhe pelo sinal do bruto.

**"A classificar" nasce só na confirmação.** A conferência usa identificadores-sentinela no
lugar das categorias padrão. `aplicar` troca cada sentinela pela categoria real, criando-a
só se algum item precisar dela. Assim nada é gravado antes de o usuário confirmar. A
categoria é achada pelo nome, ou criada: não há campo novo no schema. Na box, o gasto vai
para "A classificar" e a entrada para "A classificar (entrada)"; no cartão, para "A
classificar". São categorias comuns e visíveis: o usuário reclassifica quando quiser.

**Sem escolha de banco nesta entrega.** O desenho previa escolher o banco quando a box tem
mais de um. Mas `Lancamento.bancoId` existe só nas pernas de transferência: lançamento comum
não guarda banco. Isso depende da entrega 2 do item de bancos, ainda aberta.

**Cor do estado "novo" é token novo** (`--estado-novo`), pelo nível 3 do guia de estilo. Os
outros cinco estados reusam tokens que já existem.

## Decisões depois da primeira conferência real (2026-09-19)

A primeira conferência com uma fatura de verdade (Santander, PDF) revelou quatro problemas que
nenhum arquivo sintético tinha exercitado. Os quatro são consertos de comportamento errado, não
mudança de desenho — registrados aqui porque mexem exatamente no que "Casamento" e "Parcelas"
descrevem.

**A leitura do Santander ignorava só o "óbvio", não a página inteira.** O cabeçalho de cartão da
página 1 (acima de "Total a Pagar") tem a mesma forma do cabeçalho de bloco dentro do
detalhamento, e abria um bloco fantasma — o resto da página 1 (resumo, boleto, autenticação
mecânica) virava "linha ignorada". A leitura agora fica restrita à região entre a primeira linha
"Detalhamento da Fatura" e a "Resumo da Fatura" seguinte; fora dela, nada abre bloco, vira
transação, ou conta como ignorado. Sem o título (arquivo que a extração não devolveu por
completo), a leitura volta a valer desde o começo, por compatibilidade.

**O centro do ano deduzido estava deslocado em um mês.** A parcela 1 de uma compra feita no mês
P entra na fatura que VENCE em P+1, não na própria P. `reconstruirCompra` usava `mesFatura −
(n − 1)` como centro; o certo é `mesFatura − n`. Com o centro errado, toda compra comum
(à vista) do começo do ciclo de fechamento ficava a dois meses do esperado e ganhava "Ano
deduzido com incerteza" à toa — foi o que apareceu em compras comuns de mercado.

**Compra parcelada nunca casava — ver "Casamento".** E **confere/previsto não podiam exigir
descrição igual — ver "Casamento".** Os dois já estão descritos na seção acima; entram aqui só
para registrar que as quatro correções nasceram da mesma sessão de uso real, não de desenho
separado.
