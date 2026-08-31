# Compra no cartão a partir da nota fiscal (QR-code/XML) — plano de implementação

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam caixinhas
> (`- [ ]`) para acompanhamento.

**Objetivo:** deixar o usuário escanear o QR-code de uma NFC-e, extrair a chave de acesso,
buscar o XML fora do app e voltar com valor/data/estabelecimento pré-preenchidos numa compra
de cartão nova.

**Arquitetura:** duas funções puras em `src/domain/notaFiscal.ts` fazem toda a extração
(chave a partir da URL do QR-code; campos a partir do XML). `EscanearNotaSheet.tsx` orquestra
câmera (`jsQR`) → chave → upload/colar XML → resultado, e devolve o resultado por callback.
`AdicionarSheet.tsx` ganha um ícone no cabeçalho que abre esse fluxo e semeia o `FormCompra`
existente, reaproveitando o roteamento de escolha de cartão que já existe.

**Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom + fake-indexeddb), `jsqr`
(nova dependência, decodificação de QR-code em canvas).

**Spec:** `docs/superpowers/specs/2026-08-29-compra-por-nota-fiscal-design.md`.

## Restrições globais

- Código, comentários, UI, commits e docs em **português**.
- Valores monetários são **centavos inteiros**; datas são strings ISO `"AAAA-MM-DD"`.
- **Todo format e parse de dinheiro vive em `src/domain/money.ts`** — nenhum outro arquivo
  formata ou converte valor.
- **Toda conversão de formato de data estranho para `ISODate` vive em `src/domain/dates.ts`**
  (mesmo padrão de `serialExcelParaISO`).
- `src/domain/` é **puro, sem E/S**. Não importe `src/db/`, `src/state/` nem React ali. Nunca
  lança exceção para entrada malformada — devolve campo `undefined`.
- **Classe nova em `src/styles.css` entra em `docs/estilo/catalogo.md` no mesmo commit** —
  igual para **componente novo em `src/ui/`**. O guard do release bloqueia o contrário. Só
  tokens existentes: nada de cor, raio ou fonte fora de `:root` e das escalas de
  `docs/estilo/fundamentos.md`. Reaproveite classe existente antes de criar (`.chip`, `.campo`,
  `.linha`, `.botao`, `.aviso` já cobrem quase tudo deste fluxo).
- **`jsqr` é dependência nova, decisão já confirmada com o usuário na sessão de brainstorming**
  (escolhida no lugar da API nativa `BarcodeDetector`, por compatibilidade). Ainda assim, rode
  `npm audit` e inclua o lockfile no mesmo commit que a instala — já verificado nesta sessão:
  `jsqr@1.4.0`, zero dependências transitivas, zero vulnerabilidades.
- Não toque em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem
  `.claude/`.
- Não edite `"version"` em `package.json` nem o topo do `CHANGELOG.md` — isso é da integração.
- Não aperte timeouts de teste e não passe `{ timeout: n }` em `findBy*`.
- Trabalhe no worktree `.worktrees/compra-nota-fiscal`, branch `compra-nota-fiscal`. Nunca na
  `main`.
- Rode a suíte com `npx vitest run <arquivo>` para um arquivo e `npm test` para tudo.
- **Nenhum dado financeiro real** em teste, fixture ou doc — nomes e valores sintéticos (ex.:
  "Mercado Exemplo LTDA").

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/domain/money.ts` | ganha `parsearCentavosDecimal` | 1 |
| `src/domain/dates.ts` | ganha `dataDeISODatetime` | 2 |
| `src/domain/notaFiscal.ts` (novo) | `extrairChaveDoQrCode`, `parsearNotaFiscal`, `NotaFiscalExtraida` | 3 |
| `src/ui/FormCompra.tsx` | `inicial` ganha `data`, `descricao`, `categoriaCartaoId` opcional; tipo `InicialCompra` exportado | 4 |
| `package.json` + `package-lock.json` | ganham `jsqr` | 5 |
| `src/ui/EscanearNotaSheet.tsx` (novo) | câmera + chave manual + upload/colar XML | 5 |
| `src/styles.css` + `docs/estilo/catalogo.md` | `.escanear-nota-video` + entrada do componente | 5 |
| `src/ui/AdicionarSheet.tsx` | ícone no cabeçalho, passo `'escanear'`, roteamento | 6 |
| `docs/wiki/` + `changelog.d/` | o que o usuário lê | 7 |

---

### Tarefa 1 — decimal do XML em centavos

**Arquivos:**
- Modificar: `src/domain/money.ts`
- Teste: `src/domain/money.test.ts`

**Interfaces:**
- Consome: nada.
- Produz: `parsearCentavosDecimal(texto: string): number | undefined`. A tarefa 3 depende
  deste nome exato.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao import do topo de `src/domain/money.test.ts` o nome `parsearCentavosDecimal`, e
ao fim do arquivo:

```ts
describe('parsearCentavosDecimal', () => {
  it('converte decimal com duas casas', () => {
    expect(parsearCentavosDecimal('123.45')).toBe(12345);
    expect(parsearCentavosDecimal('0.50')).toBe(50);
  });

  it('completa com zero quando falta a segunda casa', () => {
    expect(parsearCentavosDecimal('10.5')).toBe(1050);
  });

  it('aceita inteiro sem ponto decimal', () => {
    expect(parsearCentavosDecimal('10')).toBe(1000);
  });

  it('devolve undefined para texto que não é decimal simples', () => {
    expect(parsearCentavosDecimal('abc')).toBeUndefined();
    expect(parsearCentavosDecimal('')).toBeUndefined();
    expect(parsearCentavosDecimal('-5.00')).toBeUndefined();
    expect(parsearCentavosDecimal('1.234')).toBeUndefined();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/domain/money.test.ts
```

Esperado: erro de compilação — `parsearCentavosDecimal` não existe.

- [ ] **Passo 3: implementar**

Ao fim de `src/domain/money.ts`:

```ts
/** Converte uma string decimal simples (formato do XML da NFe, ex. "123.45") em centavos
 *  inteiros. `undefined` se o texto não casar com esse formato — não lança exceção. */
export function parsearCentavosDecimal(texto: string): number | undefined {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto.trim());
  if (!m) return undefined;
  const fracao = (m[2] ?? '').padEnd(2, '0');
  return Number(m[1]) * 100 + Number(fracao);
}
```

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/domain/money.test.ts
```

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `.padEnd(2, '0')` por `m[2] ?? ''` sem padding | "completa com zero quando falta a segunda casa" |
| trocar o regex por `/^-?\d+(\.\d+)?$/` (aceita negativo/mais casas) | "devolve undefined para texto que não é decimal simples" |

Cole no relato a saída de pelo menos uma dessas mutações.

- [ ] **Passo 6: commitar**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "money: parsearCentavosDecimal para valores do XML da NFe"
```

---

### Tarefa 2 — data ISO a partir de um datetime

**Arquivos:**
- Modificar: `src/domain/dates.ts`
- Teste: `src/domain/dates.test.ts`

**Interfaces:**
- Consome: nada.
- Produz: `dataDeISODatetime(texto: string): ISODate | undefined`. A tarefa 3 depende deste
  nome exato.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente `dataDeISODatetime` ao import do topo de `src/domain/dates.test.ts`, e ao fim do
arquivo:

```ts
it('dataDeISODatetime extrai a data de um datetime ISO 8601 com fuso', () => {
  expect(dataDeISODatetime('2026-08-29T14:23:00-03:00')).toBe('2026-08-29');
});

it('dataDeISODatetime extrai a data de um datetime sem fuso', () => {
  expect(dataDeISODatetime('2026-01-05T00:00:00')).toBe('2026-01-05');
});

it('dataDeISODatetime devolve undefined para texto que não começa com AAAA-MM-DDT', () => {
  expect(dataDeISODatetime('29/08/2026')).toBeUndefined();
  expect(dataDeISODatetime('')).toBeUndefined();
  expect(dataDeISODatetime('2026-08-29')).toBeUndefined(); // sem o T — não é datetime
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/domain/dates.test.ts
```

Esperado: erro de compilação — `dataDeISODatetime` não existe.

- [ ] **Passo 3: implementar**

Ao fim de `src/domain/dates.ts`:

```ts
/** Primeiros 10 caracteres de um datetime ISO 8601 (ex. "2026-08-29T14:23:00-03:00" →
 *  "2026-08-29"). `undefined` se o texto não tiver esse formato — não lança exceção. */
export function dataDeISODatetime(texto: string): ISODate | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(texto.trim());
  return m?.[1];
}
```

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/domain/dates.test.ts
```

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `^(\d{4}-\d{2}-\d{2})T` por `^(\d{4}-\d{2}-\d{2})` (sem exigir o T) | "devolve undefined... sem o T" |

- [ ] **Passo 6: commitar**

```bash
git add src/domain/dates.ts src/domain/dates.test.ts
git commit -m "dates: dataDeISODatetime para o dhEmi da NFe"
```

---

### Tarefa 3 — extração de chave e parse do XML

**Arquivos:**
- Criar: `src/domain/notaFiscal.ts`
- Teste: `src/domain/notaFiscal.test.ts`

**Interfaces:**
- Consome: `parsearCentavosDecimal` (tarefa 1), `dataDeISODatetime` (tarefa 2), `ISODate` de
  `./types`.
- Produz: `extrairChaveDoQrCode(texto: string): string | undefined`,
  `parsearNotaFiscal(xml: string): NotaFiscalExtraida`, e o tipo
  `NotaFiscalExtraida { valorTotal?: number; data?: ISODate; descricao?: string }`. As
  tarefas 5 e 6 dependem destes três nomes exatos.

- [ ] **Passo 1: escrever os testes que falham**

Crie `src/domain/notaFiscal.test.ts`:

```ts
import { extrairChaveDoQrCode, parsearNotaFiscal } from './notaFiscal';

const CHAVE = '35240100000000000000000000000000000000000000';

describe('extrairChaveDoQrCode', () => {
  it('extrai a chave de uma URL no formato padrão nacional', () => {
    const url = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${CHAVE}|2|1|1|abcdef0123456789`;
    expect(extrairChaveDoQrCode(url)).toBe(CHAVE);
  });

  it('extrai a chave quando o separador vem URL-encoded (%7C)', () => {
    const url = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${CHAVE}%7C2%7C1%7C1%7Cabc`;
    expect(extrairChaveDoQrCode(url)).toBe(CHAVE);
  });

  it('devolve undefined para texto sem o parâmetro p= de 44 dígitos', () => {
    expect(extrairChaveDoQrCode('https://exemplo.com/sem-chave')).toBeUndefined();
    expect(extrairChaveDoQrCode('p=123|2|1|1|abc')).toBeUndefined(); // chave curta demais
    expect(extrairChaveDoQrCode('')).toBeUndefined();
  });
});

const XML_VALIDO = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('parsearNotaFiscal', () => {
  it('extrai valor, data e descrição de um XML válido', () => {
    expect(parsearNotaFiscal(XML_VALIDO)).toEqual({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA',
    });
  });

  it('XML parcial: campo faltando vira undefined, não quebra os outros', () => {
    const semNome = XML_VALIDO.replace('<emit><xNome>Mercado Exemplo LTDA</xNome></emit>', '<emit></emit>');
    expect(parsearNotaFiscal(semNome)).toEqual({ valorTotal: 6240, data: '2026-08-29', descricao: undefined });
  });

  it('XML malformado devolve objeto vazio, sem lançar exceção', () => {
    expect(parsearNotaFiscal('<isto não fecha')).toEqual({});
  });

  it('string vazia devolve objeto vazio', () => {
    expect(parsearNotaFiscal('')).toEqual({});
  });

  it('XML bem formado mas de outro schema (sem os campos esperados) devolve objeto vazio', () => {
    expect(parsearNotaFiscal('<raiz><outraCoisa>123</outraCoisa></raiz>')).toEqual({
      valorTotal: undefined, data: undefined, descricao: undefined,
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/domain/notaFiscal.test.ts
```

Esperado: falha ao resolver o módulo `./notaFiscal` (arquivo ainda não existe).

- [ ] **Passo 3: implementar**

Crie `src/domain/notaFiscal.ts`:

```ts
import { dataDeISODatetime } from './dates';
import { parsearCentavosDecimal } from './money';
import type { ISODate } from './types';

/** Dado extraído do XML de uma NFC-e. Cada campo falta quando o XML não o contém ou é
 *  irreconhecível — as funções deste arquivo nunca lançam exceção, porque XML malformado é
 *  entrada esperada aqui (veio de fora do app, colado ou enviado pelo usuário). */
export interface NotaFiscalExtraida {
  valorTotal?: number; // centavos
  data?: ISODate;
  descricao?: string;
}

/**
 * Extrai a chave de acesso (44 dígitos) da URL do QR-code da NFC-e, no formato padrão
 * nacional: ".../nfce/qrcode?p=<chave>|<versão>|<ambiente>|<tipo>|<hash>". O separador `|`
 * pode chegar como `%7C` (URL-encoded), dependendo de como o QR foi gerado.
 */
export function extrairChaveDoQrCode(texto: string): string | undefined {
  const normalizado = texto.replace(/%7C/gi, '|');
  const m = /[?&]p=(\d{44})(?:\||$)/.exec(normalizado);
  return m?.[1];
}

function textoDaTag(raiz: Element | Document, tag: string): string | undefined {
  const texto = raiz.getElementsByTagName(tag)[0]?.textContent?.trim();
  return texto ? texto : undefined;
}

/**
 * Faz o parse do XML padrão da NFC-e/NFe. Usa `getElementsByTagName` em vez de seletor CSS
 * porque `querySelector` sobre documento XML (não HTML) tem suporte inconsistente entre
 * motores — `getElementsByTagName` funciona igual nos dois. Tolerante: cada campo ausente ou
 * fora do formato esperado vira `undefined`, nunca lança exceção.
 */
export function parsearNotaFiscal(xml: string): NotaFiscalExtraida {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    return {};
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return {};

  const icmsTot = doc.getElementsByTagName('ICMSTot')[0];
  const vNF = icmsTot ? textoDaTag(icmsTot, 'vNF') : undefined;

  const dhEmi = textoDaTag(doc, 'dhEmi');

  const emit = doc.getElementsByTagName('emit')[0];
  const xNome = emit ? textoDaTag(emit, 'xNome') : undefined;

  return {
    valorTotal: vNF ? parsearCentavosDecimal(vNF) : undefined,
    data: dhEmi ? dataDeISODatetime(dhEmi) : undefined,
    descricao: xNome,
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/domain/notaFiscal.test.ts
```

Se `parsearNotaFiscal('<isto não fecha')` não devolver `{}`: confirme no relato o que o
`DOMParser` do jsdom realmente produz para XML malformado (rode só esse teste com
`console.log(doc.documentElement?.outerHTML)` temporário) — o nome da tag de erro pode
diferir; ajuste a checagem em `parsearNotaFiscal` para o nome real, sem mudar o teste.

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `[?&]p=` por `p=` (sem exigir `?` ou `&` antes) | nenhum dos existentes deve quebrar — **é o ponto**: confirme que continuam passando, e então cole no relato por que esse caso não aparece nos testes atuais (se achar um caso real que quebraria, acrescente o teste) |
| remover a checagem de `parsererror` | "XML malformado devolve objeto vazio" |
| trocar `icmsTot ? textoDaTag(icmsTot, 'vNF') : undefined` por `textoDaTag(doc, 'vNF')` (busca no documento inteiro) | nenhum teste atual pega isso — cole no relato essa lacuna, é aceitável para este escopo (NFC-e não tem `vNF` fora de `ICMSTot`) |

Cole no relato a saída de pelo menos duas mutações reais (parsererror e a chave URL-encoded).

- [ ] **Passo 6: commitar**

```bash
git add src/domain/notaFiscal.ts src/domain/notaFiscal.test.ts
git commit -m "domain: extração de chave de acesso e parse do XML da NFC-e"
```

---

### Tarefa 4 — `FormCompra` aceita valor, data e descrição semeados

**Arquivos:**
- Modificar: `src/ui/FormCompra.tsx:1-28`
- Teste: `src/ui/FormCompra.test.tsx`

**Interfaces:**
- Consome: nada das tarefas 1-3.
- Produz: o tipo exportado `InicialCompra { valorTotal?: number; categoriaCartaoId?: ID;
  data?: ISODate; descricao?: string }` e a prop `inicial?: InicialCompra` em `FormCompra`
  (substituindo o tipo inline mais estreito que já existia). A tarefa 6 importa `InicialCompra`
  e passa essa prop.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/FormCompra.test.tsx` (o arquivo já tem o helper `montarCartao()`
usado nos testes vizinhos de `inicial`):

```ts
it('inicial semeia também data e descrição, vindas de uma nota fiscal escaneada', async () => {
  const { box, cartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      inicial={{ valorTotal: 6240, data: '2026-06-15', descricao: 'Mercado Exemplo LTDA' }}
      onFechar={() => {}}
    />,
  );

  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(6240));
  expect(screen.getByLabelText('Data')).toHaveValue('2026-06-15');
  expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado Exemplo LTDA');
  // sem categoriaCartaoId no inicial: a categoria existente não fica selecionada
  expect(screen.getByRole('button', { name: 'mercado' })).not.toHaveClass('selecionada');
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/ui/FormCompra.test.tsx
```

Esperado: `data` e `descricao` de `inicial` são ignorados — os campos ficam com o padrão
(`hoje` e vazio) em vez dos valores semeados.

- [ ] **Passo 3: implementar**

Em `src/ui/FormCompra.tsx`, troque os imports do topo e a assinatura do componente:

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import * as repo from '../db/repo';
import { addMesesData } from '../domain/dates';
import { categoriasCartaoReservadasIds } from '../domain/categorias';
import type { Cartao, CompraCartao, ID, ISODate } from '../domain/types';
import { viagemAtivaEm } from '../domain/viagem';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';

/** Semente de uma compra NOVA (atalho da sheet Adicionar ou nota fiscal escaneada). Cada
 *  campo é opcional porque as duas origens preenchem subconjuntos diferentes: o atalho de
 *  "Frequentes" sempre traz `categoriaCartaoId`, a nota fiscal nunca traz (não há categoria
 *  no XML). `compra` (edição) tem precedência sobre `inicial` em todos os campos. */
export interface InicialCompra {
  valorTotal?: number;
  categoriaCartaoId?: ID;
  data?: ISODate;
  descricao?: string;
}

export default function FormCompra({ cartao, compra, inicial, onFechar }: {
  cartao: Cartao;
  compra?: CompraCartao;
  inicial?: InicialCompra;
  onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra?.valorTotal ?? inicial?.valorTotal ?? 0);
  const [data, setData] = useState(compra?.data ?? inicial?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState<string | null>(
    compra?.categoriaCartaoId ?? inicial?.categoriaCartaoId ?? null,
  );
  const [parcelas, setParcelas] = useState(compra ? String(compra.parcelas) : '1');
  const [parcelasPagas, setParcelasPagas] = useState('');
  const [descricao, setDescricao] = useState(compra?.descricao ?? inicial?.descricao ?? '');
```

O resto do arquivo (a partir de `const [viagemMarcada, ...]`) não muda.

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/ui/FormCompra.test.tsx
```

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| remover `?? inicial?.data` | "inicial semeia também data e descrição" |
| remover `?? inicial?.descricao` | "inicial semeia também data e descrição" |

- [ ] **Passo 6: commitar**

```bash
git add src/ui/FormCompra.tsx src/ui/FormCompra.test.tsx
git commit -m "FormCompra: inicial também semeia data e descrição"
```

---

### Tarefa 5 — `EscanearNotaSheet`: câmera, chave manual, XML

**Arquivos:**
- Modificar: `package.json`, `package-lock.json` (instala `jsqr`)
- Criar: `src/ui/EscanearNotaSheet.tsx`
- Modificar: `src/styles.css` (fim do arquivo)
- Modificar: `docs/estilo/catalogo.md`
- Teste: `src/ui/EscanearNotaSheet.test.tsx`

**Interfaces:**
- Consome: `extrairChaveDoQrCode`, `parsearNotaFiscal`, `NotaFiscalExtraida` (tarefa 3).
- Produz: o componente `EscanearNotaSheet({ onConcluir: (r: NotaFiscalExtraida) => void,
  onFechar: () => void })`. A tarefa 6 monta esse componente.

**Leia antes:** `docs/estilo/nivel-4-novo-componente.md`, `docs/estilo/catalogo.md`.

- [ ] **Passo 1: instalar a dependência**

```bash
npm install jsqr@1.4.0
npm audit
```

Esperado: `npm audit` sem vulnerabilidade nova (já verificado nesta sessão: 0 vulnerabilidades,
0 dependências transitivas). `jsqr` já publica seus próprios tipos (`dist/index.d.ts`) — não
precisa de `@types/jsqr`.

- [ ] **Passo 2: escrever os testes que falham**

Crie `src/ui/EscanearNotaSheet.test.tsx`. Em jsdom não há `navigator.mediaDevices`, então o
componente cai sozinho no caminho sem câmera — é esse caminho que os testes cobrem.

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscanearNotaSheet from './EscanearNotaSheet';

const XML_VALIDO = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

async function irParaEtapaXml(chave = '3'.repeat(44)) {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), chave);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

it('sem câmera no ambiente, mostra só o campo de chave manual', async () => {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  expect(await screen.findByLabelText('Chave de acesso')).toBeInTheDocument();
  expect(screen.queryByLabelText('Câmera')).not.toBeInTheDocument();
});

it('chave com menos de 44 dígitos mostra erro e não avança de etapa', async () => {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '123');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('A chave de acesso tem 44 dígitos.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Chave extraída')).not.toBeInTheDocument();
});

it('chave válida avança e mostra a chave extraída, somente leitura', async () => {
  await irParaEtapaXml('3'.repeat(44));
  expect(await screen.findByLabelText('Chave extraída')).toHaveValue('3'.repeat(44));
});

it('cola o XML e conclui com os campos extraídos', async () => {
  const onConcluir = vi.fn();
  render(<EscanearNotaSheet onConcluir={onConcluir} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, { target: { value: XML_VALIDO } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  await waitFor(() => {
    expect(onConcluir).toHaveBeenCalledWith({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA',
    });
  });
});

it('XML sem nenhum campo reconhecível mostra erro mas ainda conclui', async () => {
  const onConcluir = vi.fn();
  render(<EscanearNotaSheet onConcluir={onConcluir} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, { target: { value: 'não é xml' } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByText('Não foi possível ler esse XML. Confira o formulário abaixo.'))
    .toBeInTheDocument();
  await waitFor(() => expect(onConcluir).toHaveBeenCalledWith({}));
});

it('XML em branco não deixa continuar', async () => {
  await irParaEtapaXml();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Cole o XML ou envie o arquivo.')).toBeInTheDocument();
});

it('cancelar chama onFechar em qualquer etapa', async () => {
  const onFechar = vi.fn();
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={onFechar} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onFechar).toHaveBeenCalledOnce();
});
```

- [ ] **Passo 3: rodar e ver falhar**

```
npx vitest run src/ui/EscanearNotaSheet.test.tsx
```

Esperado: falha ao resolver o módulo `./EscanearNotaSheet` (arquivo ainda não existe).

- [ ] **Passo 4: implementar**

Crie `src/ui/EscanearNotaSheet.tsx`:

```tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import jsQR from 'jsqr';
import { extrairChaveDoQrCode, parsearNotaFiscal, type NotaFiscalExtraida } from '../domain/notaFiscal';

type Etapa = 'chave' | 'xml';

/**
 * Fluxo de captura de compra por nota fiscal: câmera decodifica o QR-code (ou o usuário
 * digita a chave à mão, sempre disponível como saída) → mostra a chave extraída → usuário
 * busca o XML fora do app e volta com ele (upload ou colar texto) → parse → `onConcluir`.
 * O Flow nunca busca a página da Sefaz sozinho (CORS bloqueia; ver a spec).
 */
export default function EscanearNotaSheet({ onConcluir, onFechar }: {
  onConcluir: (resultado: NotaFiscalExtraida) => void;
  onFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>('chave');
  const [chave, setChave] = useState('');
  const [chaveDigitada, setChaveDigitada] = useState('');
  const [xmlTexto, setXmlTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Calculado uma vez: em jsdom (testes) navigator.mediaDevices não existe, e o componente
  // cai sozinho no caminho de digitar a chave — é esse caminho que os testes cobrem.
  const [cameraDisponivel] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );

  function confirmarChave(valor: string) {
    setChave(valor);
    setErro(null);
    setEtapa('xml');
  }

  useEffect(() => {
    if (!cameraDisponivel || etapa !== 'chave') return undefined;
    let cancelado = false;
    let quadro = 0;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        function tick() {
          if (cancelado || !ctx || !video) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const codigo = jsQR(frame.data, frame.width, frame.height);
            const extraida = codigo ? extrairChaveDoQrCode(codigo.data) : undefined;
            if (extraida) { confirmarChave(extraida); return; }
          }
          quadro = requestAnimationFrame(tick);
        }
        quadro = requestAnimationFrame(tick);
      })
      // Permissão negada ou sem câmera: o campo de chave manual, já visível, continua a saída.
      .catch(() => {});

    return () => {
      cancelado = true;
      cancelAnimationFrame(quadro);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraDisponivel, etapa]);

  function enviarChaveManual() {
    const limpa = chaveDigitada.replace(/\D/g, '');
    if (limpa.length !== 44) { setErro('A chave de acesso tem 44 dígitos.'); return; }
    confirmarChave(limpa);
  }

  async function onArquivoXml(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setXmlTexto(await arquivo.text());
  }

  function concluir() {
    if (!xmlTexto.trim()) { setErro('Cole o XML ou envie o arquivo.'); return; }
    const resultado = parsearNotaFiscal(xmlTexto);
    if (resultado.valorTotal == null && resultado.data == null && resultado.descricao == null) {
      setErro('Não foi possível ler esse XML. Confira o formulário abaixo.');
    }
    onConcluir(resultado);
  }

  if (etapa === 'chave') {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Escanear nota fiscal</h2>
        {cameraDisponivel && (
          <video ref={videoRef} className="escanear-nota-video" muted playsInline aria-label="Câmera" />
        )}
        <p className="sub">Aponte para o QR-code da nota, ou digite a chave de acesso:</p>
        <div className="linha">
          <input
            aria-label="Chave de acesso" className="cresce" placeholder="44 dígitos"
            value={chaveDigitada} onChange={(e) => setChaveDigitada(e.target.value)}
          />
          <button className="botao botao-primario" onClick={enviarChaveManual}>Continuar</button>
        </div>
        {erro && <p className="aviso">{erro}</p>}
        <button className="botao" onClick={onFechar}>Cancelar</button>
      </>
    );
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Buscar XML da nota</h2>
      <div className="campo">
        <label htmlFor="escanear-nota-chave">Chave extraída</label>
        <div className="linha">
          <input id="escanear-nota-chave" aria-label="Chave extraída" className="cresce" value={chave} readOnly />
          <button className="botao" onClick={() => navigator.clipboard?.writeText(chave)}>Copiar</button>
        </div>
      </div>
      <p className="sub">
        Cole essa chave num site de consulta de NFC-e e baixe o XML. Depois, volte aqui e
        envie o arquivo ou cole o texto abaixo.
      </p>
      <div className="campo">
        <label htmlFor="escanear-nota-arquivo">Arquivo XML</label>
        <input id="escanear-nota-arquivo" type="file" accept=".xml,text/xml" onChange={onArquivoXml} />
      </div>
      <div className="campo">
        <label htmlFor="escanear-nota-texto">Ou cole o texto do XML</label>
        <textarea
          id="escanear-nota-texto" rows={5} value={xmlTexto}
          onChange={(e) => setXmlTexto(e.target.value)}
        />
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha">
        <button className="botao botao-primario" onClick={concluir}>Continuar</button>
        <button className="botao" onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
```

- [ ] **Passo 5: as classes, em `src/styles.css`**

Ao fim do arquivo, em bloco próprio:

```css
/* ---- EscanearNotaSheet.tsx ---- */
.escanear-nota-video {
  width: 100%; aspect-ratio: 4 / 3; border-radius: 16px; background: #000; object-fit: cover;
}
```

- [ ] **Passo 6: catalogar, no mesmo commit**

Em `docs/estilo/catalogo.md`, uma linha na tabela de classes:

```
| `.escanear-nota-video` | preview da câmera em `EscanearNotaSheet.tsx` |
```

E, na lista de "Componentes compartilhados", ao fim:

```
- **`EscanearNotaSheet.tsx`** — captura de compra por nota fiscal: câmera decodifica o
  QR-code via `jsQR` (ou chave digitada à mão, sempre disponível); mostra a chave extraída;
  aceita o XML da nota por upload ou colado, faz o parse (`domain/notaFiscal.ts`) e devolve o
  resultado por `onConcluir`. Usado por `AdicionarSheet`.
```

- [ ] **Passo 7: rodar tudo e ver passar**

```
npx vitest run src/ui/EscanearNotaSheet.test.tsx
node scripts/verificar-catalogo.mjs
npm test
npm run build
```

- [ ] **Passo 8: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `limpa.length !== 44` por `limpa.length !== 0` | "chave com menos de 44 dígitos mostra erro" |
| remover a checagem de `valorTotal == null && data == null && descricao == null` (nunca mostrar erro) | "XML sem nenhum campo reconhecível mostra erro" |
| trocar `!xmlTexto.trim()` por `false` | "XML em branco não deixa continuar" |

Cole no relato a saída de pelo menos duas dessas mutações.

- [ ] **Passo 9: commitar**

```bash
git add package.json package-lock.json src/ui/EscanearNotaSheet.tsx src/ui/EscanearNotaSheet.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "Captura de compra por nota fiscal: câmera, chave e XML"
```

---

### Tarefa 6 — ícone na sheet Adicionar e roteamento

**Arquivos:**
- Modificar: `src/ui/AdicionarSheet.tsx`
- Teste: `src/ui/AdicionarSheet.test.tsx`

**Interfaces:**
- Consome: `EscanearNotaSheet` e `NotaFiscalExtraida` (tarefa 5, via `domain/notaFiscal`),
  `InicialCompra` (tarefa 4).
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/AdicionarSheet.test.tsx`. Use o helper `montarBox()` e
`montarComHistorico()` já existentes no arquivo quando servirem; os testes abaixo só
precisam de um cartão.

```ts
async function montarComCartao() {
  const box = await montarBox();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Farmácia', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  return { box, cartao };
}

it('ícone de câmera no cabeçalho abre o escaneamento de nota fiscal', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));

  expect(await screen.findByRole('heading', { name: 'Escanear nota fiscal' })).toBeInTheDocument();
});

it('nota fiscal escaneada, com um só cartão ativo, abre o formulário direto preenchido', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));

  await userEvent.type(await screen.findByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, {
    target: {
      value: '<nfeProc><NFe><infNFe>'
        + '<ide><dhEmi>2026-08-15T10:00:00-03:00</dhEmi></ide>'
        + '<emit><xNome>Mercado Exemplo LTDA</xNome></emit>'
        + '<total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>'
        + '</infNFe></NFe></nfeProc>',
    },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  expect(screen.getByLabelText('Valor')).toHaveValue(formatarBRL(6240));
  expect(screen.getByLabelText('Data')).toHaveValue('2026-08-15');
  expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado Exemplo LTDA');
  // nenhuma categoria vem do XML: a categoria existente não fica selecionada
  expect(screen.getByRole('button', { name: 'Farmácia' })).not.toHaveClass('selecionada');
});

it('cancelar o escaneamento volta pro menu', async () => {
  await montarComCartao();
  render(<AdicionarSheet aberto onFechar={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Compra por nota fiscal' }));
  await screen.findByRole('heading', { name: 'Escanear nota fiscal' });

  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(await screen.findByRole('heading', { name: 'Adicionar' })).toBeInTheDocument();
});
```

Confira se `fireEvent` já está importado no topo do arquivo de teste; se não estiver,
acrescente `fireEvent` ao import existente de `@testing-library/react`.

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/ui/AdicionarSheet.test.tsx
```

Esperado: os três testes novos falham por não achar o botão "Compra por nota fiscal".

- [ ] **Passo 3: implementar**

Em `src/ui/AdicionarSheet.tsx`, acrescente aos imports:

```tsx
import { Camera } from 'lucide-react';
import type { NotaFiscalExtraida } from '../domain/notaFiscal';
import EscanearNotaSheet from './EscanearNotaSheet';
import FormCompra, { type InicialCompra } from './FormCompra';
```

(Remova o import antigo de `FormCompra` sem o tipo, se houver um separado — deixe só esta
linha combinada.)

Troque a declaração de `Passo` e `ROTULOS`:

```tsx
type Passo = 'menu' | 'sem-cartao' | 'escolher-cartao' | 'escanear' | 'form';

const ROTULOS: Record<Passo, string> = {
  menu: 'Adicionar',
  'sem-cartao': 'Nenhum cartão cadastrado',
  'escolher-cartao': 'Compra em qual cartão?',
  escanear: 'Compra por nota fiscal',
  form: 'Nova compra',
};
```

Troque o tipo do estado `inicialCompra`:

```tsx
const [inicialCompra, setInicialCompra] = useState<InicialCompra | null>(null);
```

Depois de `irParaCompra`, acrescente:

```tsx
function irParaEscanear() {
  setPasso('escanear');
}

function aoConcluirEscaneamento(resultado: NotaFiscalExtraida) {
  setInicialCompra({
    ...(resultado.valorTotal != null ? { valorTotal: resultado.valorTotal } : {}),
    ...(resultado.data != null ? { data: resultado.data } : {}),
    ...(resultado.descricao != null ? { descricao: resultado.descricao } : {}),
  });
  if (cartoesAtivos.length === 0) { setPasso('sem-cartao'); return; }
  if (cartoesAtivos.length === 1) { setCartaoEscolhido(cartoesAtivos[0]); setPasso('form'); return; }
  setPasso('escolher-cartao');
}
```

No bloco `passo === 'menu'`, troque o `<h2>` isolado por uma linha com o ícone à direita:

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <h2 style={{ marginTop: 0 }}>Adicionar</h2>
  <button className="chip" aria-label="Compra por nota fiscal" onClick={irParaEscanear}>
    <Camera size={18} />
  </button>
</div>
```

Acrescente o novo passo, ao lado dos outros blocos `passo === '...'`:

```tsx
{passo === 'escanear' && (
  <EscanearNotaSheet onConcluir={aoConcluirEscaneamento} onFechar={() => setPasso('menu')} />
)}
```

No `useEffect` do `!aberto`, já existente, nada muda — `setPasso('menu')` já cobre voltar do
passo `'escanear'` ao fechar a sheet inteira.

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/ui/AdicionarSheet.test.tsx
```

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `aria-label="Compra por nota fiscal"` por outro texto | "ícone de câmera no cabeçalho abre o escaneamento" |
| remover o `data` do spread em `aoConcluirEscaneamento` | "nota fiscal escaneada... abre o formulário direto preenchido" |
| trocar `onFechar={() => setPasso('menu')}` por `onFechar={onFechar}` (fecha a sheet inteira em vez de voltar ao menu) | "cancelar o escaneamento volta pro menu" |

- [ ] **Passo 6: rodar tudo**

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
```

- [ ] **Passo 7: commitar**

```bash
git add src/ui/AdicionarSheet.tsx src/ui/AdicionarSheet.test.tsx
git commit -m "Sheet Adicionar: atalho de compra por nota fiscal"
```

---

### Tarefa 7 — o que o usuário lê

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md`, seção `## Lançar`
- Modificar: `docs/wiki/8-glossario.md`
- Criar: `changelog.d/adicionado-compra-por-nota-fiscal.md`

**Interfaces:** nenhuma.

**Leia antes:** `docs/wiki/README.md` — o parser aceita um subconjunto **fechado** de
markdown e lança exceção fora dele. `changelog.d/README.md` — bullets planos, sem negrito nem
aninhamento.

- [ ] **Passo 1: escrever o trecho da wiki**

Na seção `## Lançar` de `docs/wiki/6-telas.md`, acrescente, no mesmo formato dos bullets já
existentes:

```
- O cabeçalho da tela Adicionar tem um ícone de câmera: escaneia o QR-code de uma nota fiscal (NFC-e) e extrai a chave de acesso.
- Com a chave, você busca o XML fora do app (num site de consulta de NFC-e) e volta com ele — por upload de arquivo ou colando o texto.
- O Flow lê o XML e pré-preenche valor, data e descrição da compra; categoria e cartão continuam por sua conta.
- Sem câmera disponível, ou se o QR não for lido, dá pra digitar a chave de 44 dígitos à mão.
```

No glossário (`docs/wiki/8-glossario.md`), uma entrada nova, no formato `: termo | definição.`
já usado no arquivo:

```
: chave de acesso | Número de 44 dígitos que identifica uma nota fiscal eletrônica; extraído do QR-code, é usado para buscar o XML da nota fora do Flow.
```

- [ ] **Passo 2: validar o parser da wiki**

```
npx vitest run src/ui/ajustes/capitulos.test.ts
```

Esperado: verde. Se lançar exceção, o markdown saiu do subconjunto aceito — simplifique.

- [ ] **Passo 3: escrever o fragmento de changelog**

`changelog.d/adicionado-compra-por-nota-fiscal.md` — só bullets planos, **sem cabeçalho**:

```markdown
- Compra no cartão a partir da nota fiscal: escaneie o QR-code da NFC-e, busque o XML fora do app e volte com ele para pré-preencher valor, data e descrição.
  - Sem câmera, ou se o QR não for lido, dá pra digitar a chave de acesso à mão.
  - Categoria e cartão continuam por sua conta — o XML não indica isso.
```

Confira o formato exato contra `changelog.d/README.md` e contra um fragmento antigo do
histórico do git.

- [ ] **Passo 4: rodar os guards**

```
node scripts/verificar-dados-reais.mjs
npm test
```

- [ ] **Passo 5: commitar**

```bash
git add docs/wiki changelog.d/adicionado-compra-por-nota-fiscal.md
git commit -m "Wiki e changelog da compra por nota fiscal"
```

---

## Ao fim de todas as tarefas

Não integre sozinho. Esta feature é UI nova (ícone + fluxo inteiro de `EscanearNotaSheet`) e
**ainda não teve mockup aprovado** — nenhuma sessão de visual companion rodou durante o
brainstorming. O ciclo de entrega (`.claude/skills/ciclo-de-entrega/SKILL.md`) exige esse
aprovado, além da confirmação do usuário sobre o fragmento de changelog, antes do merge.

Verificação final, antes de chamar o usuário:

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```

Lembrete de teste manual: a decodificação de QR-code por câmera real não é testável em jsdom
(cobrimos só o caminho de digitar a chave à mão). Antes de considerar a Tarefa 5 realmente
pronta, teste no celular — aponte a câmera para um QR-code de NFC-e real ou gerado para teste
e confirme que a chave é extraída e a etapa avança sozinha.
