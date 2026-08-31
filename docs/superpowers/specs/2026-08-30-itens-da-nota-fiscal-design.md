# Itens da nota fiscal na compra do cartão

## Contexto

A spec de 2026-08-29 (`2026-08-29-compra-por-nota-fiscal-design.md`) trouxe a compra por nota
fiscal: o Flow lê o XML da NFC-e e preenche valor, data e descrição da `CompraCartao`. Ela
deixou de fora, por escrito, os itens da nota (`det/prod`). Esta spec cobre exatamente esse
resto.

O mesmo XML que já entra no app carrega, em cada `det/prod`, o nome do produto (`xProd`) e o
valor da linha (`vProd`). Com isso o app responde uma pergunta que hoje ele não responde:
**como o total daquela compra se distribuiu**. Um mercado de R$ 400 deixa de ser um número
único e passa a ser uma lista.

A feature é de leitura. Ela não divide a compra, não cria categorias por item e não muda
nenhum valor já gravado.

## O que o usuário faz

1. Na sheet Adicionar, o fluxo de compra por nota fiscal continua igual: câmera, chave, XML.
   A diferença é que agora, ao chegar no `FormCompra`, a nota traz os itens junto.
2. Numa compra **já salva**, um botão no `FormCompra` abre o mesmo painel de XML (arquivo ou
   texto colado) e anexa a nota a ela.
3. Com a nota anexada, o formulário mostra um bloco com emitente, data e total da nota, mais
   "N itens". Expandindo, aparece a lista: descrição, quantidade, valor e percentual.

## Decisões

### A compra manda; a nota explica

O valor da `CompraCartao` é a verdade. A soma dos `vProd` quase nunca bate com ele — desconto,
frete, acréscimo, item com valor ilegível. Quando não bate, a lista ganha uma linha final
`desconto/frete` com a sobra, e ela fecha no valor da compra.

Os percentuais são calculados sobre o **valor total da compra**, não sobre o total da nota e
não sobre a parcela. Numa compra parcelada em 3×, as percentagens continuam sendo do total.

Consequência prática: **anexar uma nota a uma compra já salva nunca altera valor nem data.**
Só a criação de compra nova preenche esses campos, e isso já é o comportamento de hoje.

### O percentual não é campo guardado

É derivado na exibição. Guardá-lo congelaria um número que muda assim que o usuário editar o
valor da compra.

### Uma nota por compra

Anexar de novo substitui a anterior. A regra é aplicada no repo, não por índice único no
Dexie — ver "Persistência".

### Nada de acumulado entre notas

Somar itens de várias notas ("quanto gastei em café em seis meses") é outra feature, com outra
UI e outro índice. A tabela separada desta spec deixa isso possível depois sem migração, mas
não está aqui.

## Arquitetura

### `src/domain/notaFiscal.ts` (existente, estendido)

O arquivo já tem `extrairChaveDoQrCode` e `parsearNotaFiscal`. Ganha os itens.

```ts
export interface ItemNota {
  descricao: string;          // xProd
  quantidade?: number;        // qCom em décimos de milésimo (4 casas), inteiro
  unidade?: string;           // uCom ("UN", "KG")
  valorCent: number;          // vProd em centavos
}

export interface NotaFiscalExtraida {
  valorTotal?: number;
  data?: ISODate;
  descricao?: string;
  itens: ItemNota[];          // vazio quando o XML não tem det/prod legível
}
```

`parsearNotaFiscal` passa a percorrer `infNFe/det`, e para cada um lê `prod/xProd` e
`prod/vProd`. Quatro regras herdadas do contrato que o arquivo já tem:

- **Nunca lança exceção.** XML malformado é entrada esperada, não bug. Sem itens legíveis,
  `itens` é `[]`.
- **`getElementsByTagName`, não seletor CSS** — o motivo já está documentado no arquivo:
  `querySelector` sobre documento XML tem suporte inconsistente entre motores.
- **Item sem `xProd` ou sem `vProd` legível é descartado**, não vira item de valor zero. Ele
  reaparece na linha de diferença, que é onde qualquer sobra vai parar de qualquer forma.
- **Valor via `parsearCentavosDecimal`** (`money.ts`), que já existe e já é o único lugar de
  parse de dinheiro. Ele aceita até duas casas decimais, que é o que o schema define para
  `vProd`. Um emissor que escreva mais casas cai no descarte acima.

A quantidade não é dinheiro e não passa por `money.ts`. Ganha um parse local em décimos de
milésimo, porque `qCom` tem quatro casas decimais no schema: guardar em milésimos
transformaria `0,5675 kg` em `0,567`. Inteiro, como tudo que precisa ser exato.

### Persistência: tabela `notasFiscais`

Nova `this.version(5)` em `src/db/database.ts`, repetindo as tabelas atuais mais:

```
notasFiscais: 'id, compraCartaoId'
```

```ts
export interface NotaFiscalSalva extends Entidade {
  compraCartaoId: ID;
  emitente?: string;
  emissao?: ISODate;
  totalNotaCent?: number;
  itens: ItemNota[];
}
```

**O índice é não-único de propósito.** `&compraCartaoId` seria a expressão natural de "uma nota
por compra", mas faz o merge de dois backups com notas diferentes para a mesma compra estourar
`ConstraintError` no meio da transação — a importação inteira falharia, num app onde importar
backup é caminho crítico. A unicidade é aplicada em `repo.salvarNotaFiscal`, que apaga as
anteriores daquela compra dentro da mesma transação. Se um merge deixar duas, a UI usa a de
`alteradoEm` mais recente em vez de quebrar.

**Só os itens são guardados, nunca o XML original.** Um XML de NFC-e pesa de 20 a 60 KB; cem
notas engordariam o backup em vários MB. Os itens de um mercado de 40 linhas cabem em ~3 KB.

### `Dados` e o backup

`notasFiscais` **entra** no snapshot `Dados`, como todas as outras tabelas. Não é uma escolha
de conveniência: `gerarBackup` serializa o objeto `Dados` inteiro (`src/backup/backup.ts`), e
uma tabela fora dele simplesmente não entraria no arquivo de backup — o usuário restauraria e
as notas teriam sumido, em silêncio.

O custo é modesto: cem notas ≈ 240 KB, mesma ordem de grandeza dos lançamentos que já são
carregados inteiros a cada `carregarTudo()`.

Mudanças em volta:

- `carregarTudo` e `substituirTudo` (`src/db/repo.ts`) ganham a tabela.
- `mesclar` (`src/backup/backup.ts`) ganha `mesclarTabela(atual.notasFiscais, doBackup.notasFiscais)`.
- **Backup schema 4 → 5.** `validarBackup` passa a exigir `notasFiscais` como array em
  `schema >= 5`; backup de schema menor backfila `[]`, no mesmo padrão que `bancos` usou na
  subida para o schema 4.
- `excluirCompra` apaga a nota junto. Sem isso, cada compra excluída deixa lixo permanente,
  que o backup carrega para sempre.

Uma nota órfã ainda pode nascer de um merge (nota nova de um lado, compra excluída do outro).
Ela fica invisível e não afeta nenhum cálculo. Não há varredura de limpeza nesta entrega.

### UI: tudo dentro de `FormCompra`

Nenhuma tela nova, nenhuma aba nova. `FormCompra` é o formulário de compra nova e também o
sheet "Editar compra" da `TelaCartao`.

**Compra nova.** O caminho já existe: `EscanearNotaSheet` entrega uma `NotaFiscalExtraida` ao
`AdicionarSheet`, que a repassa como `InicialCompra` ao `FormCompra`. `InicialCompra` ganha
`itens`, e o `FormCompra` grava a nota junto com a compra ao salvar. Valor e data continuam
sendo preenchidos como hoje.

**Compra já salva.** Um botão "Anexar nota fiscal" troca o conteúdo do formulário por um painel
com upload de `.xml` e campo de colar texto — o mesmo par de vias que `EscanearNotaSheet` já
oferece, pelo mesmo motivo (sites de consulta entregam de jeitos diferentes). É troca de
conteúdo por estado, como o `AdicionarSheet` faz com seus passos, **nunca sheet dentro de
sheet**: duas camadas de arrastar-para-fechar disputando o mesmo gesto quebram no celular.

**Bloco da nota anexada.** Emitente, data, total da nota, "N itens", e dois botões: ver itens e
remover.

**Lista de itens**, expandindo no próprio formulário, com altura máxima e rolagem própria:

- Uma linha por item: descrição, quantidade e unidade quando não for `1 UN`, valor, percentual.
- **Ordenada por valor decrescente**, não pela ordem da nota. A pergunta é "onde o dinheiro
  foi", e ela se responde na primeira linha.
- Linha final de diferença quando a soma não fecha no valor da compra.

**Erros** aparecem no lugar do bloco, em texto: XML ilegível, XML que não é nota, nota sem
itens. Nenhum caminho de erro altera qualquer campo da compra.

Antes do código de UI, o ciclo de entrega pede mockup aprovado. Esta seção é o que ele deve
representar.

## Testes

- `src/domain/notaFiscal.test.ts` — fixtures como string no próprio arquivo, nunca `.xml`
  versionado. XML envelopado em `nfeProc` e XML `NFe` puro; nota de vários itens e de um item
  só; item sem `xProd`; item com `vProd` ilegível; `qCom` de quatro casas; nota sem nenhum
  `det`; XML malformado. Em todos, a garantia de nunca lançar exceção.
- `src/domain/money.test.ts` — nada novo: `parsearCentavosDecimal` já existe e já é testado.
- `src/db/repo.test.ts` — anexar duas vezes deixa uma nota só; `excluirCompra` leva a nota
  junto.
- `src/backup/backup.test.ts` — ida e volta no schema 5; backup schema 4 antigo backfila
  `notasFiscais: []`; `mesclar` com notas dos dois lados.
- `src/ui/FormCompra.test.tsx` — anexar em compra salva não mexe em valor nem data; lista sai
  por valor decrescente; a linha de diferença aparece quando a soma não fecha e some quando
  fecha; XML inválido mostra erro sem alterar nada.
- `src/ui/AdicionarSheet.test.tsx` — os itens atravessam de `EscanearNotaSheet` até a compra
  salva.
- `npm run dossie` regenerado: a feature muda comportamento observável.

## Fora de escopo

- Acumular itens entre notas ("quanto gastei em café").
- Categorizar item por item, ou dividir a compra em várias.
- Anexar nota a `Lancamento` (débito/dinheiro). Só `CompraCartao` nesta entrega.
- Ler cupom por foto (OCR) — já era outra spec.
- Buscar o XML na Sefaz pela chave: sem servidor e com CORS, não dá. O motivo completo está na
  spec de 2026-08-29.
- Julgar situação fiscal da nota (cancelada, denegada). O parser lê o que está lá; decidir o
  que fazer com o dinheiro de uma nota cancelada é outro escopo.

## Riscos conhecidos

Layouts de NFC-e variam por estado e por emissor, e o parser vai encontrar arquivo que não
previu. Por isso o contrato é o mesmo do parser que já existe: tolerante, sem exceção, e nunca
destrutivo — nenhum caminho de falha toca no valor da compra.
