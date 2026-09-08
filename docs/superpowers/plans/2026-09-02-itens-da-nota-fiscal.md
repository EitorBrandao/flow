# Itens da nota fiscal na compra do cartão — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa.
> Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** ler os itens (`det/prod`) do XML da NFC-e que o Flow já importa, guardá-los
junto da compra do cartão e mostrar, no formulário da compra, como o total se distribuiu.

**Arquitetura:** o parser que já existe (`src/domain/notaFiscal.ts`) ganha os itens; uma
tabela nova `notasFiscais` (Dexie v5) guarda só os itens, nunca o XML; a tabela entra no
snapshot `Dados` — e portanto no backup (schema 5); a UI inteira mora dentro de
`FormCompra.tsx`, sem tela nem sheet nova.

**Stack:** React 18, TypeScript, Vite, Zustand, Dexie/IndexedDB, Vitest + Testing Library +
fake-indexeddb. `DOMParser` é nativo. **Nenhuma dependência npm nova.**

**Spec:** `docs/superpowers/specs/2026-08-30-itens-da-nota-fiscal-design.md`

## Restrições globais

Valem em toda tarefa, sem repetição:

- **Português em tudo:** código, identificadores, UI, comentários, docs, mensagens de commit.
  Nunca misture inglês em texto corrido.
- **Zero dependência npm nova.** Se alguma tarefa parecer precisar de uma, pare e pergunte.
- **Nenhum dado financeiro real em arquivo versionado.** Fixtures de teste usam nomes
  sintéticos ("Mercado Exemplo LTDA", "Produto A") e valores inventados.
- **Nunca versione arquivo `.xml`.** Todo XML de teste é string literal dentro do `.test.ts`.
- **Dinheiro é centavo inteiro**; datas são `ISODate` (`"AAAA-MM-DD"`).
- **`money.ts` é o único lugar de parse/format de dinheiro.** Quantidade não é dinheiro e não
  passa por lá.
- **Não altere `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json` nem `.claude/`.**
- **Antes de qualquer diff em `src/ui/`, `src/styles.css` ou `index.html`:** leia
  `docs/estilo-visual.md` e o capítulo do nível correspondente em `docs/estilo/`. Classe nova
  é nível 2 e vai para `docs/estilo/catalogo.md` **no mesmo commit** (o guard
  `verificar-catalogo.mjs --strict` aborta o release sem isso).
- **Trabalhe no worktree `.worktrees/nota-fiscal-itens`, branch `nota-fiscal-itens`.** Nunca
  na `main`.
- **Não edite `package.json` `"version"` nem o topo do `CHANGELOG.md`.** O changelog desta
  feature é um fragmento em `changelog.d/` (Tarefa 9).
- **Contrato do parser:** as funções de `src/domain/notaFiscal.ts` **nunca lançam exceção**.
  XML malformado é entrada esperada, não bug.
- **Rode `npm test` antes de cada commit.** Os timeouts do projeto são generosos de propósito
  — nunca os aperte, nunca passe `{ timeout: n }` num `findBy*`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/domain/types.ts` | `ItemNota`, `NotaFiscalSalva`, campo `notasFiscais` em `Dados` | 1, 2, 3 |
| `src/domain/notaFiscal.ts` | parse dos itens, escolha da nota da compra, distribuição | 1, 4, 5 |
| `src/db/database.ts` | schema Dexie v5 com a tabela `notasFiscais` | 2 |
| `src/db/repo.ts` | carregar/substituir tudo, salvar/excluir nota, excluir compra | 3, 4 |
| `src/backup/backup.ts` | schema de backup 4 → 5, validação, backfill, merge | 3 |
| `src/ui/FormCompra.tsx` | anexar, exibir, expandir e remover a nota | 7, 8 |
| `src/ui/AdicionarSheet.tsx` | leva os itens do escaneamento até o formulário | 8 |
| `src/ui/EscanearNotaSheet.tsx` | XML só com itens deixa de ser "ilegível" | 8 |
| `src/styles.css` | classes da lista de itens | 7 |
| `docs/estilo/catalogo.md` | registro das classes novas | 7 |
| `docs/wiki/5-cartao.md`, `6-telas.md`, `8-glossario.md` | o que o usuário passa a ver | 9 |
| `changelog.d/adicionado-itens-da-nota-fiscal.md` | fragmento de changelog | 9 |

**Correção em relação à spec:** a spec colocava `ItemNota` em `notaFiscal.ts`. Este plano a
põe em `types.ts`, porque `NotaFiscalSalva` (entidade persistida) precisa dela e `types.ts` é
o lugar das entidades — o inverso criaria import circular entre os dois arquivos.

---

### Tarefa 1: itens no parser da NFC-e

**Arquivos:**
- Modificar: `src/domain/types.ts` (novo tipo `ItemNota`)
- Modificar: `src/domain/notaFiscal.ts`
- Testar: `src/domain/notaFiscal.test.ts`
- Ajustar fallout: `src/ui/EscanearNotaSheet.test.tsx:52`, `:73`, `:102`

**Interfaces:**
- Consome: `parsearCentavosDecimal` (`src/domain/money.ts`), `textoDaTag` (privada, já existe
  em `notaFiscal.ts`).
- Produz: `ItemNota` (em `types.ts`) e `NotaFiscalExtraida.itens: ItemNota[]` — sempre um
  array, nunca `undefined`.

- [ ] **Passo 1: escreva os testes que falham**

Acrescente ao fim de `src/domain/notaFiscal.test.ts`:

```ts
const XML_COM_ITENS = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <det nItem="1">
        <prod><xProd>Produto A</xProd><qCom>2.0000</qCom><uCom>UN</uCom><vProd>10.00</vProd></prod>
      </det>
      <det nItem="2">
        <prod><xProd>Produto B</xProd><qCom>0.5675</qCom><uCom>KG</uCom><vProd>52.40</vProd></prod>
      </det>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('itens da nota (det/prod)', () => {
  it('extrai descrição, quantidade, unidade e valor de cada item', () => {
    expect(parsearNotaFiscal(XML_COM_ITENS).itens).toEqual([
      { descricao: 'Produto A', quantidade: 20000, unidade: 'UN', valorCent: 1000 },
      { descricao: 'Produto B', quantidade: 5675, unidade: 'KG', valorCent: 5240 },
    ]);
  });

  it('guarda a quantidade em décimos de milésimo, sem perder a quarta casa', () => {
    // 0,5675 kg em milésimos viraria 0,567 — a quarta casa existe no schema da NFe
    expect(parsearNotaFiscal(XML_COM_ITENS).itens[1].quantidade).toBe(5675);
  });

  it('descarta item sem xProd, sem virar linha de valor zero', () => {
    const semNome = XML_COM_ITENS.replace('<xProd>Produto A</xProd>', '');
    const itens = parsearNotaFiscal(semNome).itens;
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe('Produto B');
  });

  it('descarta item com vProd fora do formato de duas casas', () => {
    const tresCasas = XML_COM_ITENS.replace('<vProd>10.00</vProd>', '<vProd>10.005</vProd>');
    const itens = parsearNotaFiscal(tresCasas).itens;
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe('Produto B');
  });

  it('quantidade e unidade ausentes viram undefined, o item continua válido', () => {
    const magro = '<NFe><infNFe><det><prod><xProd>Produto C</xProd><vProd>7.50</vProd></prod></det></infNFe></NFe>';
    expect(parsearNotaFiscal(magro).itens).toEqual([{ descricao: 'Produto C', valorCent: 750 }]);
  });

  it('nota sem nenhum det devolve lista vazia', () => {
    expect(parsearNotaFiscal(XML_VALIDO).itens).toEqual([]);
  });

  it('XML malformado devolve lista vazia, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha').itens).toEqual([]);
    expect(parsearNotaFiscal('').itens).toEqual([]);
  });
});
```

E atualize as cinco asserções já existentes no mesmo arquivo, que passam a ver `itens`:

```ts
  it('extrai valor, data e descrição de um XML válido', () => {
    expect(parsearNotaFiscal(XML_VALIDO)).toEqual({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA', itens: [],
    });
  });

  it('XML parcial: campo faltando vira undefined, não quebra os outros', () => {
    const semNome = XML_VALIDO.replace('<emit><xNome>Mercado Exemplo LTDA</xNome></emit>', '<emit></emit>');
    expect(parsearNotaFiscal(semNome)).toEqual({
      valorTotal: 6240, data: '2026-08-29', descricao: undefined, itens: [],
    });
  });

  it('XML malformado devolve objeto vazio, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha')).toEqual({ itens: [] });
  });

  it('string vazia devolve objeto vazio', () => {
    expect(parsearNotaFiscal('')).toEqual({ itens: [] });
  });

  it('XML bem formado mas de outro schema (sem os campos esperados) devolve objeto vazio', () => {
    expect(parsearNotaFiscal('<raiz><outraCoisa>123</outraCoisa></raiz>')).toEqual({
      valorTotal: undefined, data: undefined, descricao: undefined, itens: [],
    });
  });
```

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/domain/notaFiscal.test.ts
```

Esperado: FALHA — `Property 'itens' does not exist on type 'NotaFiscalExtraida'`.

- [ ] **Passo 3: crie o tipo `ItemNota`**

Em `src/domain/types.ts`, logo **antes** de `export interface CompraCartao`:

```ts
/** Uma linha de produto de uma nota fiscal (`det/prod` no XML da NFC-e). */
export interface ItemNota {
  descricao: string;   // xProd
  quantidade?: number; // qCom em décimos de milésimo (o schema da NFe dá 4 casas), inteiro
  unidade?: string;    // uCom ("UN", "KG")
  valorCent: number;   // vProd em centavos
}
```

- [ ] **Passo 4: implemente o parse dos itens**

Em `src/domain/notaFiscal.ts`, troque o import de tipos:

```ts
import type { ISODate, ItemNota } from './types';
```

Acrescente `itens` à interface (o comentário de contrato do arquivo continua valendo):

```ts
export interface NotaFiscalExtraida {
  valorTotal?: number; // centavos
  data?: ISODate;
  descricao?: string;
  itens: ItemNota[]; // sempre presente; vazia quando não há det/prod legível
}
```

Acrescente, depois de `textoDaTag`:

```ts
/** `qCom` tem quatro casas decimais no schema da NFe. Guardar em milésimos transformaria
 *  0,5675 kg em 0,567 — por isso décimos de milésimo, inteiro. `undefined` fora do formato. */
function parsearQuantidade(texto: string): number | undefined {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(texto.trim());
  if (!m) return undefined;
  const fracao = (m[2] ?? '').padEnd(4, '0');
  return Number(m[1]) * 10000 + Number(fracao);
}

/** Itens da nota, na ordem do XML. Item sem nome ou sem valor legível é descartado, não vira
 *  linha de valor zero: ele reaparece na linha de diferença, que é onde toda sobra vai parar
 *  de qualquer jeito. */
function extrairItens(doc: Document): ItemNota[] {
  const itens: ItemNota[] = [];
  const dets = doc.getElementsByTagName('det');
  for (let i = 0; i < dets.length; i++) {
    const prod = dets[i].getElementsByTagName('prod')[0];
    if (!prod) continue;
    const descricao = textoDaTag(prod, 'xProd');
    const vProd = textoDaTag(prod, 'vProd');
    const valorCent = vProd ? parsearCentavosDecimal(vProd) : undefined;
    if (!descricao || valorCent == null) continue;
    const qCom = textoDaTag(prod, 'qCom');
    itens.push({
      descricao,
      quantidade: qCom ? parsearQuantidade(qCom) : undefined,
      unidade: textoDaTag(prod, 'uCom'),
      valorCent,
    });
  }
  return itens;
}
```

Em `parsearNotaFiscal`, troque os dois retornos antecipados e o retorno final:

```ts
  try {
    doc = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    return { itens: [] };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return { itens: [] };
```

```ts
  return {
    valorTotal: vNF ? parsearCentavosDecimal(vNF) : undefined,
    data: dhEmi ? dataDeISODatetime(dhEmi) : undefined,
    descricao: xNome,
    itens: extrairItens(doc),
  };
```

- [ ] **Passo 5: conserte as asserções da sheet de escaneamento**

Em `src/ui/EscanearNotaSheet.test.tsx`, os três `toHaveBeenCalledWith` passam a incluir
`itens` (as duas do XML válido — colado e por arquivo — e a do XML ilegível):

```ts
    expect(onConcluir).toHaveBeenCalledWith({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA', itens: [],
    });
```

```ts
  await waitFor(() => expect(onConcluir).toHaveBeenCalledWith({ itens: [] }));
```

- [ ] **Passo 6: rode os testes**

```
npx vitest run src/domain/notaFiscal.test.ts src/ui/EscanearNotaSheet.test.tsx
```

Esperado: PASSA, tudo verde.

- [ ] **Passo 7: rode a suíte inteira**

```
npm test
```

Esperado: PASSA. Se outro arquivo comparar o retorno de `parsearNotaFiscal` por igualdade,
acrescente `itens: []` à expectativa — não afrouxe a asserção.

- [ ] **Passo 8: commit**

```bash
git add src/domain/types.ts src/domain/notaFiscal.ts src/domain/notaFiscal.test.ts src/ui/EscanearNotaSheet.test.tsx
git commit -m "feat: parser lê os itens (det/prod) da NFC-e"
```

---

### Tarefa 2: tabela `notasFiscais` no Dexie (schema 5)

**Arquivos:**
- Modificar: `src/db/database.ts`
- Modificar: `src/domain/types.ts` (`NotaFiscalSalva`)
- Testar: `src/db/database.test.ts`

**Interfaces:**
- Consome: `ItemNota` (Tarefa 1), `Entidade`/`ID`/`ISODate` (`types.ts`).
- Produz: `NotaFiscalSalva`; `db.notasFiscais: Table<NotaFiscalSalva, string>`; índice
  `'id, compraCartaoId'`.

O teste-guarda no fim de `database.test.ts` **vai falhar de propósito** assim que a versão
subir. É o lembrete de escrever o salto novo — faça os dois na mesma tarefa.

- [ ] **Passo 1: escreva os testes que falham**

Em `src/db/database.test.ts`, acrescente o schema histórico da v4 depois de `SCHEMA_V3`:

```ts
/** Schema da v4 do FlowDB — literal, histórico, nunca mude. */
const SCHEMA_V4 = {
  boxes: 'id',
  categorias: 'id, boxId',
  lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
  recorrencias: 'id, boxId, origem',
  cenarios: 'id',
  config: 'id',
  cartoes: 'id, boxId',
  categoriasCartao: 'id, cartaoId',
  comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
  recorrenciasCartao: 'id, cartaoId',
  conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
  viagens: 'id, dataInicio, dataFim',
  bancos: 'id, boxId',
};
```

Acrescente o teste de salto, antes do teste-guarda:

```ts
  it('salto v4 → v5: dados sobrevivem e notasFiscais nasce vazia', async () => {
    const nome = `flow-teste-v4-${novoId()}`;
    const { box, categoriaGanho, categoriaGasto, lancamentoEfetivo, lancamentoPrevisto, recorrencia, cenario, config } = dadosBase();
    const { cartao, categoriaCartao, compraCartao, recorrenciaCartao, conferenciaFatura } = dadosCartao(box.id);

    const antigo = new Dexie(nome);
    antigo.version(1).stores(SCHEMA_V1);
    antigo.version(2).stores(SCHEMA_V2);
    antigo.version(3).stores(SCHEMA_V3);
    antigo.version(4).stores(SCHEMA_V4);
    try {
      await antigo.open();
      await antigo.table('boxes').add(box);
      await antigo.table('categorias').bulkAdd([categoriaGanho, categoriaGasto]);
      await antigo.table('lancamentos').bulkAdd([lancamentoEfetivo, lancamentoPrevisto]);
      await antigo.table('recorrencias').add(recorrencia);
      await antigo.table('cenarios').add(cenario);
      await antigo.table('config').put(config);
      await antigo.table('cartoes').add(cartao);
      await antigo.table('categoriasCartao').add(categoriaCartao);
      await antigo.table('comprasCartao').add(compraCartao);
      await antigo.table('recorrenciasCartao').add(recorrenciaCartao);
      await antigo.table('conferenciasFatura').add(conferenciaFatura);
    } finally {
      await antigo.close();
    }

    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(5);

      expect(await flow.boxes.get(box.id)).toEqual(box);
      expect(await flow.lancamentos.get(lancamentoEfetivo.id)).toEqual(lancamentoEfetivo);
      expect(await flow.cartoes.get(cartao.id)).toEqual(cartao);
      expect(await flow.comprasCartao.get(compraCartao.id)).toEqual(compraCartao);
      expect(await flow.conferenciasFatura.get(conferenciaFatura.id)).toEqual(conferenciaFatura);
      expect(await flow.config.get('config')).toEqual(config);

      await expect(flow.notasFiscais.count()).resolves.toBe(0);

      // O índice é não-único de propósito: duas notas da mesma compra podem coexistir depois
      // de um merge de backups, e é a UI que escolhe a mais recente (ver notaDaCompra).
      const agora = agoraISO();
      await flow.notasFiscais.bulkAdd([
        { id: novoId(), compraCartaoId: compraCartao.id, itens: [], criadoEm: agora, alteradoEm: agora },
        { id: novoId(), compraCartaoId: compraCartao.id, itens: [], criadoEm: agora, alteradoEm: agora },
      ]);
      await expect(
        flow.notasFiscais.where('compraCartaoId').equals(compraCartao.id).count(),
      ).resolves.toBe(2);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });
```

Nos três saltos que já existem (v1 → v4, v2 → v4, v3 → v4), troque `expect(flow.verno).toBe(4)`
por `toBe(5)`, renomeie os títulos para `→ v5` e acrescente, junto das outras tabelas novas:

```ts
      await expect(flow.notasFiscais.count()).resolves.toBe(0);
```

E atualize o teste-guarda:

```ts
  // Guarda de versão: ao adicionar `this.version(6)` em database.ts, este teste falha de
  // propósito — é o lembrete forçado para escrever o salto 5 → 6 (schema congelado + teste
  // de migração) antes de mexer no schema real.
  it('a versão atual do schema é 5 — subiu de versão? adicione o salto novo aqui', async () => {
    const nome = `flow-teste-guarda-versao-${novoId()}`;
    const flow = new FlowDB(nome);
    try {
      await flow.open();
      expect(flow.verno).toBe(5);
    } finally {
      await flow.close();
      await Dexie.delete(nome);
    }
  });
```

No comentário do topo do arquivo, troque "Só os schemas das versões 1, 2 e 3 são literais
aqui" por "Só os schemas das versões 1, 2, 3 e 4 são literais aqui".

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/db/database.test.ts
```

Esperado: FALHA — `Property 'notasFiscais' does not exist on type 'FlowDB'` e
`expected 4 to be 5`.

- [ ] **Passo 3: crie `NotaFiscalSalva`**

Em `src/domain/types.ts`, logo **depois** de `export interface CompraCartao`:

```ts
/** Itens de uma NFC-e anexada a uma compra do cartão. Só os itens são guardados, nunca o XML
 *  original: um XML de NFC-e pesa dezenas de KB e o backup carregaria isso para sempre.
 *  Uma nota por compra — a unicidade é aplicada em `repo.salvarNotaFiscal`, não por índice
 *  único no Dexie (ver `src/db/database.ts`). */
export interface NotaFiscalSalva extends Entidade {
  compraCartaoId: ID;
  emitente?: string;
  emissao?: ISODate;
  totalNotaCent?: number; // total declarado na nota; pode divergir do total da compra
  itens: ItemNota[];
}
```

- [ ] **Passo 4: suba o schema para a versão 5**

Em `src/db/database.ts`, acrescente `NotaFiscalSalva` ao import de tipos, declare a tabela na
classe (depois de `bancos`) e adicione a versão 5 depois da 4:

```ts
  notasFiscais!: Table<NotaFiscalSalva, string>;
```

```ts
    // `compraCartaoId` é índice NÃO-único de propósito. `&compraCartaoId` seria a expressão
    // natural de "uma nota por compra", mas faria o merge de dois backups com notas
    // diferentes da mesma compra estourar ConstraintError no meio da transação — e a
    // importação inteira falharia, num app onde importar backup é caminho crítico.
    this.version(5).stores({
      boxes: 'id',
      categorias: 'id, boxId',
      lancamentos: 'id, boxId, data, recorrenciaId, cenarioId, origem, cartaoId, viagemId',
      recorrencias: 'id, boxId, origem',
      cenarios: 'id',
      config: 'id',
      cartoes: 'id, boxId',
      categoriasCartao: 'id, cartaoId',
      comprasCartao: 'id, cartaoId, recorrenciaCartaoId, viagemId',
      recorrenciasCartao: 'id, cartaoId',
      conferenciasFatura: 'id, cartaoId, [cartaoId+mes]',
      viagens: 'id, dataInicio, dataFim',
      bancos: 'id, boxId',
      notasFiscais: 'id, compraCartaoId',
    });
```

- [ ] **Passo 5: rode os testes**

```
npx vitest run src/db/database.test.ts
```

Esperado: PASSA, incluindo o salto v4 → v5.

- [ ] **Passo 6: commit**

```bash
git add src/db/database.ts src/db/database.test.ts src/domain/types.ts
git commit -m "feat: tabela notasFiscais no schema Dexie 5"
```

---

### Tarefa 3: `notasFiscais` no snapshot `Dados` e no backup

**Arquivos:**
- Modificar: `src/domain/types.ts` (campo em `Dados`)
- Modificar: `src/db/repo.ts` (`carregarTudo`, `substituirTudo`)
- Modificar: `src/backup/backup.ts`
- Testar: `src/backup/backup.test.ts`, `src/db/repo.test.ts`
- Ajustar fallout: `src/domain/aggregations.test.ts:139`, `src/dossie/invariantes.test.ts:37`

**Interfaces:**
- Consome: `NotaFiscalSalva` (Tarefa 2), `db.notasFiscais` (Tarefa 2).
- Produz: `Dados.notasFiscais: NotaFiscalSalva[]`; `Backup.schema: 5`.

Estas três mudanças são uma só tarefa: acrescentar o campo a `Dados` quebra a compilação de
todo lugar que constrói um `Dados` — `repo` e `backup` — até que as três estejam feitas.

> **Por que a tabela entra em `Dados`:** `gerarBackup` serializa o objeto `Dados` inteiro.
> Uma tabela fora dele simplesmente não entra no arquivo de backup — o usuário restauraria e
> as notas teriam sumido, em silêncio.

- [ ] **Passo 1: escreva os testes que falham**

Em `src/backup/backup.test.ts`, acrescente `notasFiscais: []` ao literal do helper `dados()`
(linha 9) e aos outros dois literais de `Dados` (linhas 141 e 165). Troque as duas asserções
`expect(...schema).toBe(4)` por `toBe(5)`. Depois, acrescente:

```ts
it('gerarBackup emite schema 5 e leva as notas fiscais', () => {
  const d = dados();
  d.notasFiscais = [{
    id: 'n1', compraCartaoId: 'c1', emitente: 'Mercado Exemplo LTDA', emissao: '2026-08-29',
    totalNotaCent: 6240, itens: [{ descricao: 'Produto A', valorCent: 1000 }],
    criadoEm: 'x', alteradoEm: '2026-08-29T00:00:00Z',
  }];
  const b = gerarBackup(d);
  expect(b.schema).toBe(5);
  const volta = validarBackup(JSON.parse(JSON.stringify(b)));
  expect(volta.dados.notasFiscais).toHaveLength(1);
  expect(volta.dados.notasFiscais[0].itens[0].valorCent).toBe(1000);
});

it('backup de schema 4 sem notasFiscais backfila lista vazia', () => {
  const d = dados() as unknown as Record<string, unknown>;
  delete d.notasFiscais;
  const volta = validarBackup({ app: 'flow', schema: 4, exportadoEm: 'x', dados: d });
  expect(volta.dados.notasFiscais).toEqual([]);
  expect(volta.schema).toBe(5);
});

it('backup de schema 5 sem notasFiscais é recusado como corrompido', () => {
  const d = dados() as unknown as Record<string, unknown>;
  delete d.notasFiscais;
  expect(() => validarBackup({ app: 'flow', schema: 5, exportadoEm: 'x', dados: d }))
    .toThrow(/corrompido/);
});

it('mesclar une notas fiscais dos dois lados e resolve conflito pelo alteradoEm', () => {
  const atual = dados();
  const backup = dados();
  atual.notasFiscais = [{
    id: 'n1', compraCartaoId: 'c1', itens: [{ descricao: 'Produto A', valorCent: 1000 }],
    criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  backup.notasFiscais = [
    {
      id: 'n1', compraCartaoId: 'c1', itens: [{ descricao: 'Produto B', valorCent: 2000 }],
      criadoEm: 'x', alteradoEm: '2026-06-01T00:00:00Z',
    },
    { id: 'n2', compraCartaoId: 'c2', itens: [], criadoEm: 'x', alteradoEm: 'x' },
  ];
  const m = mesclar(atual, backup);
  expect(m.notasFiscais).toHaveLength(2);
  expect(m.notasFiscais.find((n) => n.id === 'n1')!.itens[0].descricao).toBe('Produto B');
});
```

Em `src/db/repo.test.ts`, acrescente `notasFiscais: []` ao literal de `Dados` da linha 255 (e
ao da 597, se for um `Dados` completo) e acrescente:

```ts
it('carregarTudo devolve notasFiscais e substituirTudo as regrava', async () => {
  const agora = agoraISO();
  await db.notasFiscais.add({
    id: novoId(), compraCartaoId: 'c1', emitente: 'Mercado Exemplo LTDA',
    itens: [{ descricao: 'Produto A', valorCent: 1000 }], criadoEm: agora, alteradoEm: agora,
  });
  const dados = await repo.carregarTudo();
  expect(dados.notasFiscais).toHaveLength(1);

  await repo.substituirTudo({ ...dados, notasFiscais: [] });
  await expect(db.notasFiscais.count()).resolves.toBe(0);
});
```

Em `src/domain/aggregations.test.ts:139` e `src/dossie/invariantes.test.ts:37`, acrescente
`notasFiscais: []` ao literal de `Dados`.

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/backup/backup.test.ts src/db/repo.test.ts
```

Esperado: FALHA — `notasFiscais` não existe em `Dados`; `expected 4 to be 5`.

- [ ] **Passo 3: acrescente o campo a `Dados`**

Em `src/domain/types.ts`, dentro de `export interface Dados`, depois de `bancos: Banco[];`:

```ts
  notasFiscais: NotaFiscalSalva[];
```

- [ ] **Passo 4: carregue e regrave a tabela no repo**

Em `src/db/repo.ts`, `carregarTudo` — acrescente à desestruturação, ao `Promise.all` e ao
retorno:

```ts
  const [
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos,
    notasFiscais,
  ] = await Promise.all([
    db.boxes.toArray(), db.categorias.toArray(), db.lancamentos.toArray(),
    db.recorrencias.toArray(), db.cenarios.toArray(),
    db.cartoes.toArray(), db.categoriasCartao.toArray(), db.comprasCartao.toArray(),
    db.recorrenciasCartao.toArray(), db.conferenciasFatura.toArray(), db.viagens.toArray(), db.bancos.toArray(),
    db.notasFiscais.toArray(),
  ]);
```

```ts
  return {
    boxes, categorias, lancamentos, recorrencias, cenarios,
    cartoes, categoriasCartao, comprasCartao, recorrenciasCartao, conferenciasFatura, viagens, bancos,
    notasFiscais, config,
  };
```

Em `substituirTudo`, acrescente a tabela à lista e o `bulkAdd`:

```ts
  const tabelas = [
    db.boxes, db.categorias, db.lancamentos, db.recorrencias, db.cenarios,
    db.cartoes, db.categoriasCartao, db.comprasCartao, db.recorrenciasCartao,
    db.conferenciasFatura, db.viagens, db.bancos, db.notasFiscais, db.config,
  ];
```

```ts
    await db.bancos.bulkAdd(d.bancos);
    await db.notasFiscais.bulkAdd(d.notasFiscais);
```

- [ ] **Passo 5: suba o backup para o schema 5**

Em `src/backup/backup.ts`:

```ts
export interface Backup {
  app: 'flow';
  schema: 5;
  exportadoEm: string;
  dados: Dados;
}

export function gerarBackup(dados: Dados): Backup {
  return { app: 'flow', schema: 5, exportadoEm: new Date().toISOString(), dados };
}
```

Depois de `TABELAS_BANCO`:

```ts
const TABELAS_NOTA = ['notasFiscais'] as const;
```

Em `validarBackup`, aceite o schema novo:

```ts
  if (b.schema !== 1 && b.schema !== 2 && b.schema !== 3 && b.schema !== 4 && b.schema !== 5) {
    throw new Error(`Backup de versão incompatível (${String(b.schema)}). Atualize o app e tente de novo.`);
  }
```

Depois do bloco de `bancos`, na mesma forma que ele usa:

```ts
  // notasFiscais nasceu no schema 5: a partir daqui é obrigatória e bem formada.
  if (b.schema >= 5 && TABELAS_NOTA.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
  // num backup de schema < 5 a chave pode vir mesmo assim (a entidade nasceu no código antes
  // de o schema subir): aí é opcional, mas se vier, tem que vir como array.
  if (d.notasFiscais !== undefined && TABELAS_NOTA.some((t) => !Array.isArray(d[t]))) {
    throw new Error('Backup corrompido: estrutura de dados inesperada.');
  }
```

Depois do backfill de `bancos`:

```ts
  if (!Array.isArray(dados.notasFiscais)) {
    // backup de schema < 5 sem a chave: backfill. A condição é por array, e não por schema,
    // para não sobrescrever com [] um notasFiscais real já presente num backup antigo.
    const md = dados as unknown as Record<string, unknown[]>;
    for (const t of TABELAS_NOTA) md[t] = [];
  }
```

E o retorno:

```ts
  return {
    app: 'flow', schema: 5,
    exportadoEm: typeof b.exportadoEm === 'string' ? b.exportadoEm : new Date().toISOString(),
    dados,
  };
```

Em `mesclar`, depois da linha de `bancos`:

```ts
    notasFiscais: mesclarTabela(atual.notasFiscais, doBackup.notasFiscais),
```

- [ ] **Passo 6: rode os testes**

```
npx vitest run src/backup/backup.test.ts src/db/repo.test.ts
```

Esperado: PASSA.

- [ ] **Passo 7: rode a suíte inteira e o build**

```
npm test
npm run build
```

Esperado: ambos PASSAM. Qualquer erro de tipo restante é um literal de `Dados` sem
`notasFiscais: []` — acrescente o campo, não silencie com `as`.

- [ ] **Passo 8: commit**

```bash
git add src/domain/types.ts src/db/repo.ts src/db/repo.test.ts src/backup/backup.ts src/backup/backup.test.ts src/domain/aggregations.test.ts src/dossie/invariantes.test.ts
git commit -m "feat: notas fiscais entram no snapshot Dados e no backup (schema 5)"
```

---

### Tarefa 4: salvar, excluir e escolher a nota de uma compra

**Arquivos:**
- Modificar: `src/db/repo.ts`
- Modificar: `src/domain/notaFiscal.ts`
- Testar: `src/db/repo.test.ts`, `src/domain/notaFiscal.test.ts`

**Interfaces:**
- Consome: `db.notasFiscais`, `NotaFiscalSalva`, `ItemNota`, `marcarMudanca`, `novoId`,
  `agoraISO` (todos já existem).
- Produz:
  - `repo.NovaNotaFiscal = { compraCartaoId: ID; emitente?: string; emissao?: ISODate; totalNotaCent?: number; itens: ItemNota[] }`
  - `repo.salvarNotaFiscal(n: NovaNotaFiscal): Promise<NotaFiscalSalva>`
  - `repo.excluirNotaFiscalDaCompra(compraCartaoId: ID): Promise<void>`
  - `notaFiscal.notaDaCompra(notas: NotaFiscalSalva[], compraCartaoId: ID): NotaFiscalSalva | undefined`

`salvarNotaFiscal` **não** recebe `horizonte` e **não** chama `sincronizarCartoes`: a nota não
entra em nenhuma projeção.

- [ ] **Passo 1: escreva os testes que falham**

Em `src/db/repo.test.ts`:

```ts
async function compraComCartao() {
  const { box } = await boxECategoria();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'cartão teste', diaFechamento: 20, diaVencimento: 27,
  }, '2027-12-31');
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-07-05', valorTotal: 6240, parcelas: 1,
  }, '2027-12-31');
  return { compra };
}

it('salvarNotaFiscal grava a nota e marca mudança desde backup', async () => {
  const { compra } = await compraComCartao();
  const nota = await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, emitente: 'Mercado Exemplo LTDA', emissao: '2026-07-05',
    totalNotaCent: 6240, itens: [{ descricao: 'Produto A', valorCent: 1000 }],
  });
  expect(await db.notasFiscais.get(nota.id)).toMatchObject({ compraCartaoId: compra.id });
  expect((await db.config.get('config'))!.mudancasDesdeBackup).toBe(true);
});

it('anexar duas vezes deixa uma nota só: a última vence', async () => {
  const { compra } = await compraComCartao();
  await repo.salvarNotaFiscal({ compraCartaoId: compra.id, itens: [{ descricao: 'Produto A', valorCent: 1000 }] });
  await repo.salvarNotaFiscal({ compraCartaoId: compra.id, itens: [{ descricao: 'Produto B', valorCent: 2000 }] });
  const notas = await db.notasFiscais.where('compraCartaoId').equals(compra.id).toArray();
  expect(notas).toHaveLength(1);
  expect(notas[0].itens[0].descricao).toBe('Produto B');
});

it('excluirNotaFiscalDaCompra apaga a nota da compra', async () => {
  const { compra } = await compraComCartao();
  await repo.salvarNotaFiscal({ compraCartaoId: compra.id, itens: [] });
  await repo.excluirNotaFiscalDaCompra(compra.id);
  await expect(db.notasFiscais.where('compraCartaoId').equals(compra.id).count()).resolves.toBe(0);
});

it('excluirCompraCartao leva a nota fiscal junto', async () => {
  const { compra } = await compraComCartao();
  await repo.salvarNotaFiscal({ compraCartaoId: compra.id, itens: [] });
  await repo.excluirCompraCartao(compra.id, '2027-12-31');
  await expect(db.notasFiscais.count()).resolves.toBe(0);
});
```

Em `src/domain/notaFiscal.test.ts`:

```ts
describe('notaDaCompra', () => {
  const base = { itens: [], criadoEm: 'x' };

  it('devolve a nota da compra pedida', () => {
    const notas = [
      { id: 'n1', compraCartaoId: 'c1', alteradoEm: '2026-01-01T00:00:00Z', ...base },
      { id: 'n2', compraCartaoId: 'c2', alteradoEm: '2026-01-01T00:00:00Z', ...base },
    ];
    expect(notaDaCompra(notas, 'c2')!.id).toBe('n2');
  });

  it('com duas notas da mesma compra (herança de merge), vence a de alteradoEm mais recente', () => {
    const notas = [
      { id: 'n1', compraCartaoId: 'c1', alteradoEm: '2026-01-01T00:00:00Z', ...base },
      { id: 'n2', compraCartaoId: 'c1', alteradoEm: '2026-06-01T00:00:00Z', ...base },
    ];
    expect(notaDaCompra(notas, 'c1')!.id).toBe('n2');
  });

  it('devolve undefined quando a compra não tem nota', () => {
    expect(notaDaCompra([], 'c1')).toBeUndefined();
  });
});
```

Acrescente `notaDaCompra` ao import do topo do arquivo de teste.

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/db/repo.test.ts src/domain/notaFiscal.test.ts
```

Esperado: FALHA — `repo.salvarNotaFiscal is not a function`; `notaDaCompra` não exportada.

- [ ] **Passo 3: implemente as funções do repo**

Em `src/db/repo.ts`, acrescente `ItemNota` e `NotaFiscalSalva` ao import de tipos de
`../domain/types` e, logo depois de `excluirCompraCartao`:

```ts
// ---------- Nota fiscal da compra ----------

export interface NovaNotaFiscal {
  compraCartaoId: ID;
  emitente?: string;
  emissao?: ISODate;
  totalNotaCent?: number;
  itens: ItemNota[];
}

/** Anexa a nota à compra, substituindo a anterior. Uma nota por compra: o índice do Dexie é
 *  não-único de propósito (ver database.ts), então a unicidade é aplicada aqui, dentro da
 *  mesma transação que grava a nova. Não mexe em projeção — nota não vira lançamento. */
export async function salvarNotaFiscal(n: NovaNotaFiscal): Promise<NotaFiscalSalva> {
  const agora = agoraISO();
  const nota: NotaFiscalSalva = { id: novoId(), criadoEm: agora, alteradoEm: agora, ...n };
  await db.transaction('rw', db.notasFiscais, db.config, async () => {
    const antigas = await db.notasFiscais.where('compraCartaoId').equals(n.compraCartaoId).primaryKeys();
    await db.notasFiscais.bulkDelete(antigas);
    await db.notasFiscais.add(nota);
    await marcarMudanca();
  });
  return nota;
}

export async function excluirNotaFiscalDaCompra(compraCartaoId: ID): Promise<void> {
  await db.transaction('rw', db.notasFiscais, db.config, async () => {
    const ids = await db.notasFiscais.where('compraCartaoId').equals(compraCartaoId).primaryKeys();
    if (ids.length === 0) return;
    await db.notasFiscais.bulkDelete(ids);
    await marcarMudanca();
  });
}
```

E em `excluirCompraCartao`, acrescente a tabela à transação e apague as notas junto — sem
isso, cada compra excluída deixa lixo permanente, que o backup carrega para sempre:

```ts
export async function excluirCompraCartao(id: ID, horizonte: ISODate): Promise<void> {
  await db.transaction('rw', db.comprasCartao, db.notasFiscais, db.config, async () => {
    await db.comprasCartao.delete(id);
    const notas = await db.notasFiscais.where('compraCartaoId').equals(id).primaryKeys();
    await db.notasFiscais.bulkDelete(notas);
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}
```

- [ ] **Passo 4: implemente `notaDaCompra`**

Em `src/domain/notaFiscal.ts`, acrescente `ID` e `NotaFiscalSalva` ao import de tipos e, ao
fim do arquivo:

```ts
/** A nota anexada a uma compra. Um merge de backups pode deixar mais de uma da mesma compra
 *  (o índice é não-único de propósito) — nesse caso vence a de `alteradoEm` mais recente, em
 *  vez de quebrar. */
export function notaDaCompra(
  notas: NotaFiscalSalva[], compraCartaoId: ID,
): NotaFiscalSalva | undefined {
  let escolhida: NotaFiscalSalva | undefined;
  for (const n of notas) {
    if (n.compraCartaoId !== compraCartaoId) continue;
    if (!escolhida || n.alteradoEm > escolhida.alteradoEm) escolhida = n;
  }
  return escolhida;
}
```

- [ ] **Passo 5: rode os testes**

```
npx vitest run src/db/repo.test.ts src/domain/notaFiscal.test.ts
```

Esperado: PASSA.

- [ ] **Passo 6: commit**

```bash
git add src/db/repo.ts src/db/repo.test.ts src/domain/notaFiscal.ts src/domain/notaFiscal.test.ts
git commit -m "feat: salvar, excluir e escolher a nota fiscal de uma compra"
```

---

### Tarefa 5: distribuição do total entre os itens

**Arquivos:**
- Modificar: `src/domain/notaFiscal.ts`
- Testar: `src/domain/notaFiscal.test.ts`

**Interfaces:**
- Consome: `ItemNota` (Tarefa 1).
- Produz:

```ts
export interface LinhaDistribuicao {
  descricao: string;
  quantidade?: number;   // décimos de milésimo, como em ItemNota
  unidade?: string;
  valorCent: number;
  percentual: number;    // 0..100, sobre o valor total da COMPRA
  diferenca?: true;      // linha final de desconto/frete
}
export function distribuirItens(itens: ItemNota[], totalCompraCent: number): LinhaDistribuicao[]
```

Regras: ordem por valor decrescente (empate mantém a ordem da nota); percentual sobre o total
da compra, não sobre o total da nota nem sobre a parcela; linha final de diferença quando a
soma dos itens não fecha no total da compra.

- [ ] **Passo 1: escreva o teste que falha**

Em `src/domain/notaFiscal.test.ts`:

```ts
describe('distribuirItens', () => {
  const itens = [
    { descricao: 'Produto A', valorCent: 1000 },
    { descricao: 'Produto B', valorCent: 5000 },
    { descricao: 'Produto C', valorCent: 240 },
  ];

  it('ordena por valor decrescente, não pela ordem da nota', () => {
    const linhas = distribuirItens(itens, 6240);
    expect(linhas.map((l) => l.descricao)).toEqual(['Produto B', 'Produto A', 'Produto C']);
  });

  it('calcula o percentual sobre o total da compra', () => {
    const linhas = distribuirItens(itens, 6240);
    expect(linhas[0].percentual).toBeCloseTo(80.13, 2);
    expect(linhas.reduce((s, l) => s + l.percentual, 0)).toBeCloseTo(100, 6);
  });

  it('sem diferença, não gera linha de diferença', () => {
    expect(distribuirItens(itens, 6240).some((l) => l.diferenca)).toBe(false);
  });

  it('itens somando menos que a compra geram linha de frete ou acréscimo', () => {
    const linhas = distribuirItens(itens, 7240);
    expect(linhas[linhas.length - 1]).toMatchObject({
      descricao: 'Frete ou acréscimo', valorCent: 1000, diferenca: true,
    });
    expect(linhas.reduce((s, l) => s + l.valorCent, 0)).toBe(7240);
  });

  it('itens somando mais que a compra geram linha de desconto, com valor negativo', () => {
    const linhas = distribuirItens(itens, 5240);
    expect(linhas[linhas.length - 1]).toMatchObject({
      descricao: 'Desconto', valorCent: -1000, diferenca: true,
    });
    expect(linhas.reduce((s, l) => s + l.valorCent, 0)).toBe(5240);
  });

  it('lista de itens vazia devolve lista vazia, sem linha de diferença solta', () => {
    expect(distribuirItens([], 6240)).toEqual([]);
  });

  it('total da compra zero não divide por zero: percentual é 0', () => {
    expect(distribuirItens(itens, 0).every((l) => l.percentual === 0)).toBe(true);
  });

  it('preserva quantidade e unidade de cada item', () => {
    const linhas = distribuirItens(
      [{ descricao: 'Produto B', quantidade: 5675, unidade: 'KG', valorCent: 5240 }], 5240,
    );
    expect(linhas[0]).toMatchObject({ quantidade: 5675, unidade: 'KG' });
  });
});
```

Acrescente `distribuirItens` ao import do topo do arquivo de teste.

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/domain/notaFiscal.test.ts -t distribuirItens
```

Esperado: FALHA — `distribuirItens` não exportada.

- [ ] **Passo 3: implemente**

Ao fim de `src/domain/notaFiscal.ts`:

```ts
/** Uma linha da lista "item → valor → % do total". */
export interface LinhaDistribuicao {
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valorCent: number;
  percentual: number; // 0..100
  diferenca?: true;
}

/**
 * Distribui o total da COMPRA entre os itens da nota. A compra manda: a soma dos `vProd`
 * quase nunca bate com ela (desconto, frete, acréscimo, item de valor ilegível), e a sobra
 * vira uma linha final em vez de sumir. Os percentuais são sempre do total da compra — nunca
 * do total da nota, nunca da parcela.
 */
export function distribuirItens(itens: ItemNota[], totalCompraCent: number): LinhaDistribuicao[] {
  if (itens.length === 0) return [];
  const pct = (v: number) => (totalCompraCent === 0 ? 0 : (v / totalCompraCent) * 100);
  // ordenação estável no ES2019+: itens de mesmo valor mantêm a ordem da nota
  const linhas: LinhaDistribuicao[] = [...itens]
    .sort((a, b) => b.valorCent - a.valorCent)
    .map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valorCent: i.valorCent,
      percentual: pct(i.valorCent),
    }));
  const soma = itens.reduce((s, i) => s + i.valorCent, 0);
  const resto = totalCompraCent - soma;
  if (resto !== 0) {
    linhas.push({
      descricao: resto < 0 ? 'Desconto' : 'Frete ou acréscimo',
      valorCent: resto,
      percentual: pct(resto),
      diferenca: true,
    });
  }
  return linhas;
}
```

- [ ] **Passo 4: rode os testes**

```
npx vitest run src/domain/notaFiscal.test.ts
```

Esperado: PASSA.

- [ ] **Passo 5: commit**

```bash
git add src/domain/notaFiscal.ts src/domain/notaFiscal.test.ts
git commit -m "feat: distribuição do total da compra entre os itens da nota"
```

---

### Tarefa 6: mockup da UI (portão de aprovação)

**Arquivos:**
- Criar: `mockup-itens-nota.html`, no diretório de scratchpad da sessão — **fora do
  repositório**, nunca versionado.

Nenhum código de UI antes deste portão. O ciclo de entrega para aqui e espera o usuário.

- [ ] **Passo 1: leia o guia de estilo**

Leia `docs/estilo-visual.md` e siga o índice até o capítulo do nível 2 (classe nova) e o de
editar tela. Leia também `docs/estilo/catalogo.md` antes de inventar classe: se algo já
existe, reaproveite.

- [ ] **Passo 2: monte o mockup**

Um arquivo HTML único, com `<meta charset="utf-8">` na primeira linha (sem isso os acentos
viram lixo no celular). Três estados, um abaixo do outro, dentro de um recorte do
`FormCompra`:

1. **Sem nota** — o botão "Anexar nota fiscal" no formulário.
2. **Painel de anexar** — upload de `.xml` e campo de colar texto, mais Cancelar.
3. **Nota anexada** — bloco com emitente, data, total da nota e "N itens", com os botões
   "Ver itens" e "Remover"; abaixo, a lista expandida: descrição, quantidade/unidade, valor e
   percentual, ordenada por valor decrescente, com a linha final de diferença.

Use só dados sintéticos ("Mercado Exemplo LTDA", "Produto A"). Use os tokens de cor do app,
nunca cor literal nova.

- [ ] **Passo 3: entregue e espere**

Envie o arquivo ao usuário e **pare**. Só siga para a Tarefa 7 com a aprovação explícita
dele. Se ele pedir mudança, refaça o mockup e entregue de novo.

---

### Tarefa 7: bloco da nota dentro do `FormCompra`

**Arquivos:**
- Modificar: `src/ui/FormCompra.tsx`
- Modificar: `src/styles.css`
- Modificar: `docs/estilo/catalogo.md`
- Testar: `src/ui/FormCompra.test.tsx`

**Interfaces:**
- Consome: `notaDaCompra`, `distribuirItens`, `parsearNotaFiscal`, `NotaFiscalExtraida`
  (Tarefas 1, 4, 5); `repo.salvarNotaFiscal`, `repo.excluirNotaFiscalDaCompra` (Tarefa 4);
  `formatarBRL` (`money.ts`); `dados.notasFiscais` do store.
- Produz: `InicialCompra.nota?: NotaFiscalExtraida` (usado pela Tarefa 8); as classes
  `.nota-bloco`, `.nota-itens`, `.nota-item`, `.nota-item-diferenca`.

O estado da nota no formulário é tri-estado, porque "não mexi" e "removi" são coisas
diferentes na hora de salvar.

- [ ] **Passo 1: escreva os testes que falham**

Em `src/ui/FormCompra.test.tsx` (acrescente `fireEvent` ao import de
`@testing-library/react`):

```ts
const XML_NOTA = `<?xml version="1.0"?>
<nfeProc><NFe><infNFe>
  <ide><dhEmi>2026-07-01T10:00:00-03:00</dhEmi></ide>
  <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
  <det><prod><xProd>Produto A</xProd><qCom>1.0000</qCom><uCom>UN</uCom><vProd>20.00</vProd></prod></det>
  <det><prod><xProd>Produto B</xProd><qCom>2.0000</qCom><uCom>UN</uCom><vProd>60.00</vProd></prod></det>
  <total><ICMSTot><vNF>80.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

async function compraSalva() {
  const { box, cartao, catCartao } = await montarCartao();
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id,
    data: '2026-07-01', valorTotal: 10000, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });
  return { cartao, compra };
}

it('anexa nota a uma compra salva sem mexer em valor nem data', async () => {
  const { cartao, compra } = await compraSalva();
  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: XML_NOTA } });
  await userEvent.click(screen.getByRole('button', { name: 'Anexar' }));

  expect(await screen.findByText('Mercado Exemplo LTDA')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    await expect(db.notasFiscais.where('compraCartaoId').equals(compra.id).count()).resolves.toBe(1);
  });
  expect(await db.comprasCartao.get(compra.id)).toMatchObject({ valorTotal: 10000, data: '2026-07-01' });
});

it('a lista sai por valor decrescente e fecha com a linha de diferença', async () => {
  const { cartao, compra } = await compraSalva(); // compra de 100,00; nota soma 80,00
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, emitente: 'Mercado Exemplo LTDA', emissao: '2026-07-01',
    totalNotaCent: 8000,
    itens: [
      { descricao: 'Produto A', valorCent: 2000 },
      { descricao: 'Produto B', valorCent: 6000 },
    ],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Ver itens' }));

  const linhas = await screen.findAllByRole('listitem');
  expect(linhas[0]).toHaveTextContent('Produto B');
  expect(linhas[1]).toHaveTextContent('Produto A');
  expect(linhas[2]).toHaveTextContent('Frete ou acréscimo');
  expect(linhas[0]).toHaveTextContent('60,0%');
});

it('sem diferença, a linha de diferença não aparece', async () => {
  const { cartao, compra } = await compraSalva();
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, itens: [{ descricao: 'Produto A', valorCent: 10000 }],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Ver itens' }));

  expect(screen.queryByText('Frete ou acréscimo')).not.toBeInTheDocument();
  expect(screen.queryByText('Desconto')).not.toBeInTheDocument();
});

it('XML inválido mostra erro e não altera nada da compra', async () => {
  const { cartao, compra } = await compraSalva();
  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }));
  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: 'não é xml' } });
  await userEvent.click(screen.getByRole('button', { name: 'Anexar' }));

  expect(await screen.findByText('Não foi possível ler os itens desse XML.')).toBeInTheDocument();
  await expect(db.notasFiscais.count()).resolves.toBe(0);
  expect(await db.comprasCartao.get(compra.id)).toMatchObject({ valorTotal: 10000 });
});

it('remover a nota só vale depois de salvar', async () => {
  const { cartao, compra } = await compraSalva();
  await repo.salvarNotaFiscal({
    compraCartaoId: compra.id, itens: [{ descricao: 'Produto A', valorCent: 10000 }],
  });
  await useApp.getState().recarregar();

  render(<FormCompra cartao={cartao} compra={compra} onFechar={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remover' }));
  await expect(db.notasFiscais.count()).resolves.toBe(1); // ainda não

  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(async () => {
    await expect(db.notasFiscais.count()).resolves.toBe(0);
  });
});
```

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/ui/FormCompra.test.tsx
```

Esperado: FALHA — `Unable to find role="button" and name "Anexar nota fiscal"`.

- [ ] **Passo 3: crie as classes no CSS**

Ao fim de `src/styles.css`:

```css
/* ---- Nota fiscal anexada à compra (FormCompra.tsx) ---- */
.nota-bloco {
  background: var(--surface2); border-radius: 12px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.nota-itens {
  list-style: none; margin: 0; padding: 0;
  max-height: 240px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 2px;
}
.nota-item {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 13px; padding: 4px 0;
}
.nota-item-diferenca { color: var(--muted); font-style: italic; }
```

Confirme os nomes dos tokens (`--surface2`, `--muted`) contra o topo de `src/styles.css`
antes de escrever; use os que existem. Token novo é nível 6 e exige decisão do usuário —
pare e pergunte se algum faltar.

- [ ] **Passo 4: catalogue as classes**

Em `docs/estilo/catalogo.md`, na tabela **Classes**, acrescente:

```
| `.nota-bloco` | resumo da nota fiscal anexada a uma compra do cartão (`FormCompra.tsx`) — emitente, data, total da nota e contagem de itens sobre `--surface2`; também envolve o painel de anexar o XML |
| `.nota-itens` / `.nota-item` / `.nota-item-diferenca` | lista compacta "item → valor → % do total" dentro do `.nota-bloco`, com rolagem própria; `.nota-item-diferenca` marca a linha final de desconto/frete |
```

- [ ] **Passo 5: implemente o bloco no `FormCompra`**

Acrescente aos imports de `src/ui/FormCompra.tsx`:

```ts
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { distribuirItens, notaDaCompra, parsearNotaFiscal, type NotaFiscalExtraida } from '../domain/notaFiscal';
import { formatarBRL } from '../domain/money';
```

Confirme em `src/domain/dates.ts` o nome exato do formatador de data brasileiro
(`formatarDataBR`) antes de importá-lo; se o nome for outro, use o que existe.

Acrescente `nota` a `InicialCompra` (a Tarefa 8 é quem passa a preenchê-la):

```ts
export interface InicialCompra {
  valorTotal?: number;
  categoriaCartaoId?: ID;
  data?: ISODate;
  descricao?: string;
  nota?: NotaFiscalExtraida;
}
```

Acrescente, antes do componente:

```ts
/** "Não mexi", "anexei uma" e "removi" são três coisas diferentes na hora de salvar: sem o
 *  terceiro estado, remover a nota seria indistinguível de não ter feito nada. */
type EstadoNota =
  | { tipo: 'inalterada' }
  | { tipo: 'nova'; nota: NotaFiscalExtraida }
  | { tipo: 'removida' };

function formatarPercentual(p: number): string {
  return `${p.toFixed(1).replace('.', ',')}%`;
}

/** Quantidade vem em décimos de milésimo. Só vale mostrar quando não for a unidade solta. */
function formatarQuantidade(quantidade?: number, unidade?: string): string | null {
  if (quantidade == null) return null;
  if (quantidade === 10000 && (unidade === 'UN' || !unidade)) return null;
  const n = (quantidade / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  return unidade ? `${n} ${unidade}` : n;
}
```

Dentro do componente, junto dos outros `useState`:

```ts
  const [estadoNota, setEstadoNota] = useState<EstadoNota>(
    inicial?.nota ? { tipo: 'nova', nota: inicial.nota } : { tipo: 'inalterada' },
  );
  const [anexando, setAnexando] = useState(false);
  const [xmlTexto, setXmlTexto] = useState('');
  const [erroNota, setErroNota] = useState<string | null>(null);
  const [verItens, setVerItens] = useState(false);
```

Depois de `if (!dados) return null;`:

```ts
  const notaSalva = compra ? notaDaCompra(dados.notasFiscais, compra.id) : undefined;
  const notaExibida: NotaFiscalExtraida | null =
    estadoNota.tipo === 'nova' ? estadoNota.nota
      : estadoNota.tipo === 'removida' ? null
        : notaSalva
          ? {
            valorTotal: notaSalva.totalNotaCent, data: notaSalva.emissao,
            descricao: notaSalva.emitente, itens: notaSalva.itens,
          }
          : null;
  const linhas = notaExibida ? distribuirItens(notaExibida.itens, valor) : [];
```

Acrescente os manipuladores:

```ts
  async function onArquivoXml(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErroNota(null);
    try {
      setXmlTexto(await arquivo.text());
    } catch {
      setErroNota('Não foi possível ler esse arquivo.');
    }
  }

  function anexarNota() {
    const extraida = parsearNotaFiscal(xmlTexto);
    if (extraida.itens.length === 0) {
      setErroNota('Não foi possível ler os itens desse XML.');
      return;
    }
    setEstadoNota({ tipo: 'nova', nota: extraida });
    setAnexando(false);
    setXmlTexto('');
    setErroNota(null);
    setVerItens(true);
  }

  function removerNota() {
    setEstadoNota({ tipo: 'removida' });
    setVerItens(false);
  }
```

Reescreva `salvar()` para ter o id da compra nos dois caminhos e gravar a nota depois:

```ts
  async function salvar() {
    if (valor <= 0 || !categoriaId) return;
    const campos = {
      data, valorTotal: valor, parcelas: parcelasNum, categoriaCartaoId: categoriaId,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
      // viagemId sempre presente (mesmo undefined) para permitir desmarcar ao editar
      viagemId: (viagemAtiva && viagemMarcada) ? viagemAtiva.id : undefined,
    };
    let compraId: ID;
    if (compra) {
      await repo.atualizarCompraCartao(compra.id, campos, horizonte);
      compraId = compra.id;
    } else {
      compraId = (await repo.salvarCompraCartao({ cartaoId: cartao.id, ...campos }, horizonte)).id;
    }
    if (estadoNota.tipo === 'nova') {
      await repo.salvarNotaFiscal({
        compraCartaoId: compraId,
        emitente: estadoNota.nota.descricao,
        emissao: estadoNota.nota.data,
        totalNotaCent: estadoNota.nota.valorTotal,
        itens: estadoNota.nota.itens,
      });
    } else if (estadoNota.tipo === 'removida') {
      await repo.excluirNotaFiscalDaCompra(compraId);
    }
    await recarregar();
    onFechar();
  }
```

Acrescente o JSX entre o campo de Categoria e a linha de Descrição. O painel de anexar troca
o conteúdo por estado, **nunca abre sheet dentro de sheet**: duas camadas de
arrastar-para-fechar disputando o mesmo gesto quebram no celular.

```tsx
      {anexando ? (
        <div className="nota-bloco">
          <p className="sub">
            Baixe o XML da nota num site de consulta de NFC-e e envie o arquivo, ou cole o
            texto aqui.
          </p>
          <div className="campo">
            <label htmlFor={`${uid}-nota-arquivo`}>Arquivo XML</label>
            <input id={`${uid}-nota-arquivo`} type="file" accept=".xml,text/xml" onChange={onArquivoXml} />
          </div>
          <div className="campo">
            <label htmlFor={`${uid}-nota-texto`}>Ou cole o texto do XML</label>
            <textarea
              id={`${uid}-nota-texto`} rows={4} value={xmlTexto}
              onChange={(e) => { setXmlTexto(e.target.value); setErroNota(null); }}
            />
          </div>
          {erroNota && <p className="aviso">{erroNota}</p>}
          <div className="linha">
            <button className="botao botao-primario" onClick={anexarNota}>Anexar</button>
            <button className="botao" onClick={() => { setAnexando(false); setErroNota(null); }}>Cancelar</button>
          </div>
        </div>
      ) : notaExibida ? (
        <div className="nota-bloco">
          <div className="linha-topo">
            <span className="cresce">
              <strong>{notaExibida.descricao ?? 'Nota fiscal'}</strong>
              {notaExibida.data && <span className="sub"> · {formatarDataBR(notaExibida.data)}</span>}
            </span>
            {notaExibida.valorTotal != null && (
              <span className="badge">{formatarBRL(notaExibida.valorTotal)}</span>
            )}
          </div>
          <div className="linha">
            <span className="sub cresce">{notaExibida.itens.length} itens</span>
            <button className="botao-ver-mais" onClick={() => setVerItens((v) => !v)}>
              {verItens ? 'Ocultar itens' : 'Ver itens'}
            </button>
            <button className="botao botao-perigo" onClick={removerNota}>Remover</button>
          </div>
          {verItens && (
            <ul className="nota-itens">
              {linhas.map((l, i) => {
                const quantidade = formatarQuantidade(l.quantidade, l.unidade);
                return (
                  <li key={`${l.descricao}-${i}`} className={`nota-item${l.diferenca ? ' nota-item-diferenca' : ''}`}>
                    <span className="cresce">
                      {l.descricao}
                      {quantidade && <span className="sub"> · {quantidade}</span>}
                    </span>
                    <span>{formatarBRL(l.valorCent)}</span>
                    <span className="sub">{formatarPercentual(l.percentual)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <button className="botao" onClick={() => { setAnexando(true); setErroNota(null); }}>
          Anexar nota fiscal
        </button>
      )}
```

- [ ] **Passo 6: rode os testes**

```
npx vitest run src/ui/FormCompra.test.tsx
```

Esperado: PASSA.

- [ ] **Passo 7: verifique o catálogo**

```
node scripts/verificar-catalogo.mjs
```

Esperado: sem divergência entre `src/styles.css` e `docs/estilo/catalogo.md`.

- [ ] **Passo 8: rode a suíte inteira**

```
npm test
```

Esperado: PASSA.

- [ ] **Passo 9: commit**

```bash
git add src/ui/FormCompra.tsx src/ui/FormCompra.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat: bloco da nota fiscal e lista de itens no formulário da compra"
```

---

### Tarefa 8: os itens atravessam o escaneamento até a compra nova

**Arquivos:**
- Modificar: `src/ui/AdicionarSheet.tsx`
- Modificar: `src/ui/EscanearNotaSheet.tsx`
- Testar: `src/ui/AdicionarSheet.test.tsx`

**Interfaces:**
- Consome: `InicialCompra.nota` (Tarefa 7), `NotaFiscalExtraida` (Tarefa 1).
- Produz: nada novo — fecha o caminho compra nova → nota salva.

- [ ] **Passo 1: escreva o teste que falha**

Em `src/ui/AdicionarSheet.test.tsx`, acrescente `import { db } from '../db/database';` ao topo
(o arquivo ainda não importa `db`) e `waitFor` ao import de `@testing-library/react`. O helper `montarComCartao()` já existe no arquivo: ele
monta a box, o cartão "Cartão A" e a categoria de cartão "Farmácia", inicia o store e fixa
`hoje` em `'2026-08-20'`.

```ts
const XML_COM_ITENS = '<nfeProc><NFe><infNFe>'
  + '<ide><dhEmi>2026-08-15T10:00:00-03:00</dhEmi></ide>'
  + '<emit><xNome>Mercado Exemplo LTDA</xNome></emit>'
  + '<det><prod><xProd>Produto A</xProd><vProd>10.00</vProd></prod></det>'
  + '<det><prod><xProd>Produto B</xProd><vProd>52.40</vProd></prod></det>'
  + '<total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>'
  + '</infNFe></NFe></nfeProc>';

it('itens da nota escaneada chegam até a compra salva', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));
  await userEvent.type(await screen.findByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  fireEvent.change(await screen.findByLabelText('Ou cole o texto do XML'), { target: { value: XML_COM_ITENS } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.getByText('Mercado Exemplo LTDA')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Farmácia' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    expect(await db.notasFiscais.count()).toBe(1);
  });
  const [nota] = await db.notasFiscais.toArray();
  const [compraSalva] = await db.comprasCartao.toArray();
  expect(nota.itens).toHaveLength(2);
  expect(nota.emitente).toBe('Mercado Exemplo LTDA');
  expect(nota.compraCartaoId).toBe(compraSalva.id);
});
```

- [ ] **Passo 2: rode e veja falhar**

```
npx vitest run src/ui/AdicionarSheet.test.tsx
```

Esperado: FALHA — nenhuma nota gravada (`expected 0 to be 1`).

- [ ] **Passo 3: repasse os itens no `AdicionarSheet`**

Em `src/ui/AdicionarSheet.tsx`, na função `aoConcluirEscaneamento`:

```ts
  function aoConcluirEscaneamento(resultado: NotaFiscalExtraida) {
    rotearParaCompra({
      valorTotal: resultado.valorTotal,
      data: resultado.data,
      descricao: resultado.descricao,
      // só anexa quando há itens: uma nota sem item legível não tem o que mostrar
      nota: resultado.itens.length > 0 ? resultado : undefined,
    });
  }
```

- [ ] **Passo 4: um XML só com itens deixa de ser "ilegível"**

Em `src/ui/EscanearNotaSheet.tsx`, na função `concluir`, a checagem de vazio passa a
considerar os itens — sem isso, uma nota cujo `vNF`/`dhEmi`/`xNome` o app não reconhece, mas
com itens perfeitamente legíveis, seria tratada como erro:

```ts
    const vazio = resultado.valorTotal == null && resultado.data == null
      && resultado.descricao == null && resultado.itens.length === 0;
```

- [ ] **Passo 5: rode os testes**

```
npx vitest run src/ui/AdicionarSheet.test.tsx src/ui/EscanearNotaSheet.test.tsx
```

Esperado: PASSA.

- [ ] **Passo 6: rode a suíte inteira e o build**

```
npm test
npm run build
```

Esperado: ambos PASSAM.

- [ ] **Passo 7: commit**

```bash
git add src/ui/AdicionarSheet.tsx src/ui/AdicionarSheet.test.tsx src/ui/EscanearNotaSheet.tsx
git commit -m "feat: itens da nota escaneada chegam até a compra salva"
```

---

### Tarefa 9: dossiê, wiki e fragmento de changelog

**Arquivos:**
- Regenerar: `docs/dossie/`
- Modificar: `docs/wiki/5-cartao.md`, `docs/wiki/6-telas.md`, `docs/wiki/8-glossario.md`
- Criar: `changelog.d/adicionado-itens-da-nota-fiscal.md`

- [ ] **Passo 1: regenere o dossiê**

```
npm run dossie
npx vitest run src/dossie/dossie.test.ts
```

Esperado: PASSA. Se um invariante **garantido** for violado, pare e reporte — é bug real, não
desatualização.

- [ ] **Passo 2: atualize a wiki**

Em `docs/wiki/6-telas.md`, na seção da tela Adicionar, depois da linha "O Flow lê o XML e
pré-preenche valor, data e descrição da compra…":

```markdown
- A nota também traz seus itens: no formulário da compra, "Ver itens" mostra a lista de produtos com valor e percentual do total.
```

Em `docs/wiki/5-cartao.md`, ao fim da seção "Cartão, compras e assinaturas":

```markdown
Cada compra pode ter uma nota fiscal anexada. No formulário da compra, "Anexar nota fiscal" aceita o XML da NFC-e — por arquivo ou colando o texto — e guarda a lista de itens.

- A lista mostra item, valor e percentual do total da compra, do maior para o menor.
- A compra manda: o valor dela não muda ao anexar a nota. Quando a soma dos itens não fecha com o valor da compra, uma linha final mostra a diferença (desconto, frete ou acréscimo).
- Uma compra tem no máximo uma nota: anexar de novo substitui a anterior.
- Só os itens ficam guardados; o arquivo XML não.
- Excluir a compra apaga a nota junto.
```

Em `docs/wiki/8-glossario.md`, na ordem alfabética:

```markdown
: item da nota | Uma linha de produto do XML da nota fiscal (nome e valor); o Flow usa os itens para mostrar como o total de uma compra do cartão se distribuiu.
```

Valide o subconjunto de markdown que o parser da wiki aceita:

```
npx vitest run src/ui/ajustes/capitulos.test.ts
```

Esperado: PASSA. Se lançar exceção, o markdown saiu do subconjunto fechado — veja
`docs/wiki/README.md`.

- [ ] **Passo 3: crie o fragmento de changelog**

Crie `changelog.d/adicionado-itens-da-nota-fiscal.md`. Sem negrito, no máximo dois níveis,
detalhe com exatamente dois espaços de indentação:

```markdown
- Itens da nota fiscal na compra do cartão.
  - Anexe o XML da NFC-e a uma compra, nova ou já salva, e veja a lista de produtos com valor e percentual do total.
  - A lista vem do maior para o menor valor; quando a soma dos itens não fecha com a compra, uma linha final mostra a diferença.
  - O valor e a data da compra nunca mudam ao anexar a nota.
  - Só os itens ficam guardados, nunca o arquivo XML; excluir a compra apaga a nota junto.
```

- [ ] **Passo 4: rode todos os verificadores**

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Esperado: tudo verde, sem valor real nem termo privado apontado.

- [ ] **Passo 5: commit**

```bash
git add docs/dossie docs/wiki changelog.d/adicionado-itens-da-nota-fiscal.md
git commit -m "docs: wiki, dossiê e changelog dos itens da nota fiscal"
```

- [ ] **Passo 6: pare no portão do ciclo de entrega**

A feature está pronta no branch. **Invoque a skill `ciclo-de-entrega`** para a integração:
ela exige a confirmação literal do usuário sobre o fragmento de changelog antes do merge na
`main`, e só depois vêm `npm run release`, push e `npm run deploy`. Não faça merge sem passar
por ela.

---

## Fora de escopo (não implemente)

- Acumular itens entre notas ("quanto gastei em café em seis meses").
- Categorizar item por item, ou dividir a compra em várias.
- Anexar nota a `Lancamento` (débito/dinheiro) — só `CompraCartao` nesta entrega.
- Ler cupom por foto (OCR).
- Buscar o XML na Sefaz pela chave (CORS; ver a spec de 2026-08-29).
- Julgar situação fiscal da nota (cancelada, denegada).
- Varredura de limpeza de notas órfãs. Um merge pode deixar uma nota sem compra; ela fica
  invisível e não afeta nenhum cálculo.
