# Conferência por extrato — plano de implementação (entrega 1)

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa de seleção (`- [ ]`) para acompanhamento.

**Objetivo:** ler o extrato da conta Nubank (CSV) e a fatura do cartão Santander (PDF),
comparar com o que já existe no app, e gravar só o que você aprovar.

**Arquitetura:** `src/importar/` é lógica pura, sem E/S, irmã de `src/backup/`. Cada adapter
devolve `LancamentoBruto[]`. A função pura `conferir` cruza os brutos com o snapshot `Dados` e
devolve itens classificados em seis estados. `aplicar` traduz as decisões em chamadas do
`repo`, numa transação só. O pdf.js fica isolado atrás de `textoPdf.ts`, para que o parser da
fatura seja testado com texto.

**Tecnologias:** TypeScript, Vitest, Dexie (via `repo`), React 18. Uma dependência nova,
`pdfjs-dist`, com portão de aprovação próprio na tarefa 9.

**Spec:** `docs/superpowers/specs/2026-09-17-conferencia-por-extrato-design.md`

## Restrições globais

Valem para **todas** as tarefas. Estão no `CLAUDE.md` da raiz e na spec.

- **Valores monetários são centavos inteiros.** Nunca float, nunca string.
- **Datas são `ISODate`**, string `"AAAA-MM-DD"`.
- **Código, comentário, teste e mensagem de commit em português.** Nunca misturar inglês.
- **Nenhum dado financeiro real em arquivo versionado.** Fixtures usam só valores da lista
  aprovada em `scripts/verificar-dados-reais.mjs`: `R$ 12,34`, `R$ 1,23`, `R$ 123,45`,
  `R$ 1.234,56`, `1.234,56`, `R$ 0,00`, `R$ 1.000,00`, `1.000,00`, `R$ 100,00`, `R$ 500,00`,
  `R$ 650,00`, `R$ 51,90`, `R$ 45,00`, `R$ 39,90`, `R$ 10,00`, `R$ 11,00`. Nomes de
  estabelecimento sintéticos: `MERCADO ALFA`, `POSTO BETA`, `LOJA GAMA`, `FARMACIA DELTA`.
  Pessoas: `FULANO DE TAL`.
- **Nenhuma dependência npm nova sem o portão da tarefa 9.**
- **Nunca editar `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem
  `.claude/`.**
- **Nunca editar `"version"` em `package.json` nem o topo do `CHANGELOG.md`.**
- **Não apertar timeout de teste.** Nunca passar `{ timeout: n }` num `findBy*`.
- **Nenhum parser lança exceção.** Entrada malformada é entrada esperada.
- **Antes de qualquer diff em `src/ui/**` ou `src/styles.css`:** consultar
  `docs/estilo-visual.md` e o capítulo que ele indicar.
- **Trabalho no worktree `.worktrees/conferencia-extrato`, branch `conferencia-extrato`.**
  Nunca na `main`.
- Rodar um arquivo de teste: `npx vitest run <caminho>`. Rodar tudo: `npm test`.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/importar/tipos.ts` | os tipos compartilhados; nenhuma lógica | 1 |
| `src/importar/valores.ts` | texto → centavos inteiros; texto → `ISODate` | 1 |
| `src/importar/csv.ts` | texto CSV → matriz de strings | 2 |
| `src/importar/descricao.ts` | normalizar descrição; moldes do Nubank | 3 |
| `src/importar/adapters/nubankConta.ts` | CSV da conta → `LancamentoBruto[]` | 4 |
| `src/importar/parcelas.ts` | `NN/NN` + data sem ano → compra original | 5 |
| `src/importar/adapters/santanderFatura.ts` | texto da fatura → `LancamentoBruto[]` | 6 |
| `src/importar/conferencia.ts` | brutos × `Dados` → `ItemConferencia[]` | 7 |
| `src/db/repo.ts` | caminho em lote para compras de cartão | 8 |
| `src/importar/aplicar.ts` | `ItemConferencia[]` → chamadas do `repo` | 8 |
| `src/importar/adapters/textoPdf.ts` | única parte que conhece o pdf.js | 9 |
| `src/ui/importar/*.tsx` | a tela de conferência | 10 |
| `src/importar/adapters/index.ts` | registro e detecção de adapter | 11 |
| `src/ui/TelaAjustes.tsx` | seção nova "Importar" | 11 |
| `docs/wiki/`, `changelog.d/`, `docs/estilo/catalogo.md` | documentação | 12 |

---

### Tarefa 1: Tipos e leitura de valores e datas

**Arquivos:**
- Criar: `src/importar/tipos.ts`
- Criar: `src/importar/valores.ts`
- Testar: `src/importar/valores.test.ts`

**Interfaces:**
- Consome: `ISODate` de `src/domain/types.ts`.
- Produz: `LancamentoBruto`, `NaturezaBruto`, `Adapter`, `LeituraAdapter`, `EstadoItem`,
  `AcaoItem`, `ItemConferencia`, `CompraReconstruida`;
  `parsearValorExtrato(texto: string): number | undefined` (centavos);
  `parsearDataExtrato(texto: string): ISODate | undefined`.

- [ ] **Passo 1: Criar `src/importar/tipos.ts`**

```ts
import type { ID, ISODate } from '../domain/types';

/** Uma linha lida de um arquivo de banco, antes de qualquer decisão. É formato
 *  intermediário: aqui o valor ainda carrega sinal, porque é assim que o banco escreve. No
 *  Flow o valor é sempre positivo, e quem diz entrada ou saída é o tipo da categoria. */
export interface LancamentoBruto {
  data: ISODate;
  valorCent: number; // negativo = saída
  descricao: string;
  fonte: 'conta' | 'cartao';
  externalId?: string;
  parcela?: { n: number; total: number };
  natureza?: NaturezaBruto;
}

/** Linhas que não são gasto nem ganho comum, reconhecidas pelo adapter. */
export type NaturezaBruto =
  | 'aplicacaoInterna'
  | 'resgateInterno'
  | 'pagamentoFatura'
  | 'estornoCartao';

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;
  avisos: string[];
}

export interface Adapter {
  id: 'nubank-conta-csv' | 'santander-fatura-pdf';
  rotulo: string;
  detectar(nome: string, inicio: string): boolean;
  ler(conteudo: ArrayBuffer): Promise<LeituraAdapter>;
}

export type EstadoItem =
  | 'confere' | 'previsto' | 'divergente' | 'novo' | 'sobra' | 'interno';

/** Compra de cartão remontada a partir de uma linha parcelada da fatura. */
export interface CompraReconstruida {
  data: ISODate;
  valorTotalCent: number;
  parcelas: number;
  anoDeduzidoComAviso: boolean;
}

export type AcaoItem =
  | { tipo: 'ignorar' }
  | { tipo: 'confirmar' }
  | { tipo: 'confirmarComValor'; valorCent: number; data?: ISODate }
  | { tipo: 'adicionarLancamento'; categoriaId: ID }
  | { tipo: 'adicionarCompra'; categoriaCartaoId: ID }
  | { tipo: 'excluir' };

export interface ItemConferencia {
  estado: EstadoItem;
  bruto?: LancamentoBruto;
  lancamentoId?: ID;
  compraCartaoId?: ID;
  compraReconstruida?: CompraReconstruida;
  acao: AcaoItem;
  aviso?: string;
}
```

- [ ] **Passo 2: Escrever o teste que falha**

Criar `src/importar/valores.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsearDataExtrato, parsearValorExtrato } from './valores';

describe('parsearValorExtrato', () => {
  it('lê o formato internacional do CSV do Nubank', () => {
    expect(parsearValorExtrato('1234.56')).toBe(123456);
    expect(parsearValorExtrato('-1234.56')).toBe(-123456);
    expect(parsearValorExtrato('45.00')).toBe(4500);
  });

  it('lê o formato brasileiro da fatura do Santander', () => {
    expect(parsearValorExtrato('1.234,56')).toBe(123456);
    expect(parsearValorExtrato('-1.234,56')).toBe(-123456);
    expect(parsearValorExtrato('123,45')).toBe(12345);
  });

  it('aceita R$ e espaço não separável', () => {
    expect(parsearValorExtrato('R$ 1.234,56')).toBe(123456);
    expect(parsearValorExtrato('R$ 1.234,56')).toBe(123456);
  });

  // A regra do finance.py lê "1.234" como um inteiro e duzentos e trinta e quatro milésimos.
  // Ponto seguido de exatamente três dígitos, sem vírgula na string, é separador de milhar.
  it('trata ponto de milhar sem centavos como milhar', () => {
    expect(parsearValorExtrato('1.234')).toBe(123400);
  });

  it('devolve undefined em vez de lançar', () => {
    expect(parsearValorExtrato('')).toBeUndefined();
    expect(parsearValorExtrato('-')).toBeUndefined();
    expect(parsearValorExtrato('abc')).toBeUndefined();
  });
});

describe('parsearDataExtrato', () => {
  it('lê os quatro formatos previstos', () => {
    expect(parsearDataExtrato('2026-08-15')).toBe('2026-08-15');
    expect(parsearDataExtrato('15/08/2026')).toBe('2026-08-15');
    expect(parsearDataExtrato('15/08/26')).toBe('2026-08-15');
    expect(parsearDataExtrato('20260815')).toBe('2026-08-15');
  });

  it('devolve undefined em vez de lançar', () => {
    expect(parsearDataExtrato('32/13/2026')).toBeUndefined();
    expect(parsearDataExtrato('bla')).toBeUndefined();
  });
});
```

- [ ] **Passo 3: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/valores.test.ts`
Esperado: FALHA com "Failed to resolve import './valores'".

- [ ] **Passo 4: Escrever a implementação mínima**

Criar `src/importar/valores.ts`:

```ts
import type { ISODate } from '../domain/types';

/** Converte um valor monetário de extrato em centavos inteiros. Aceita o formato
 *  internacional do CSV do Nubank ("1234.56") e o brasileiro da fatura do Santander
 *  ("1.234,56"). Devolve `undefined` fora desses formatos — nunca lança, porque a entrada vem
 *  de fora do app. */
export function parsearValorExtrato(texto: string): number | undefined {
  let limpo = texto.trim()
    .replace(/R\$/gi, '')
    .replace(/ /g, '')
    .replace(/\s/g, '');
  if (limpo === '' || limpo === '-') return undefined;

  const negativo = limpo.startsWith('-');
  if (negativo) limpo = limpo.slice(1);

  if (limpo.includes(',')) {
    // Formato brasileiro: o ponto é milhar e a vírgula é decimal.
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // Ponto de milhar sem centavos: "1.234" é mil duzentos e trinta e quatro.
    limpo = limpo.replace(/\./g, '');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return undefined;
  const [inteiro, fracao = ''] = limpo.split('.');
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return negativo ? -centavos : centavos;
}

function montar(ano: number, mes: number, dia: number): ISODate | undefined {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${ano}-${mm}-${dd}`;
}

/** Converte uma data de extrato em `ISODate`. Aceita AAAA-MM-DD, DD/MM/AAAA, DD/MM/AA e
 *  AAAAMMDD. Devolve `undefined` fora desses formatos — nunca lança. O DD/MM sem ano da
 *  fatura do Santander NÃO entra aqui: ele depende do ano deduzido, em `parcelas.ts`. */
export function parsearDataExtrato(texto: string): ISODate | undefined {
  const t = texto.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return montar(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return montar(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(t);
  if (m) return montar(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return montar(Number(m[1]), Number(m[2]), Number(m[3]));
  return undefined;
}
```

- [ ] **Passo 5: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/valores.test.ts`
Esperado: PASSA, 6 testes.

- [ ] **Passo 6: Commitar**

```bash
git add src/importar/tipos.ts src/importar/valores.ts src/importar/valores.test.ts
git commit -m "feat(importar): tipos e leitura de valores e datas de extrato"
```

---

### Tarefa 2: Leitor de CSV

**Arquivos:**
- Criar: `src/importar/csv.ts`
- Testar: `src/importar/csv.test.ts`

**Interfaces:**
- Produz: `lerCsv(texto: string): string[][]` — a primeira linha é o cabeçalho, como qualquer
  outra. Trata BOM, aspas, vírgula dentro de aspas, aspas duplicadas e `\r\n`. Linha vazia é
  descartada.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerCsv } from './csv';

describe('lerCsv', () => {
  it('lê linhas e colunas simples', () => {
    expect(lerCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('descarta o BOM do começo', () => {
    expect(lerCsv('﻿Data,Valor\n15/08/2026,45.00')).toEqual([
      ['Data', 'Valor'], ['15/08/2026', '45.00'],
    ]);
  });

  it('respeita vírgula dentro de aspas', () => {
    expect(lerCsv('a,b\n"MERCADO ALFA, LTDA",45.00')).toEqual([
      ['a', 'b'], ['MERCADO ALFA, LTDA', '45.00'],
    ]);
  });

  it('trata aspas duplicadas como uma aspa literal', () => {
    expect(lerCsv('a\n"diz ""oi"""')).toEqual([['a'], ['diz "oi"']]);
  });

  it('aceita fim de linha do Windows e ignora linha vazia', () => {
    expect(lerCsv('a,b\r\n1,2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/csv.test.ts`
Esperado: FALHA com "Failed to resolve import './csv'".

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `src/importar/csv.ts`:

```ts
/** Lê texto CSV numa matriz de strings. A primeira linha não recebe tratamento especial.
 *  Trata BOM, aspas, vírgula dentro de aspas, aspas duplicadas e fim de linha do Windows.
 *  Linha vazia é descartada. Nunca lança: CSV malformado vira o que der para ler.
 *
 *  Por que não uma dependência: são 40 linhas, e cada pacote novo é superfície de ataque num
 *  app que guarda dados financeiros só no navegador do usuário. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  const fecharCampo = () => { linha.push(campo); campo = ''; };
  const fecharLinha = () => {
    fecharCampo();
    if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else { dentroDeAspas = false; }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ',') { fecharCampo(); continue; }
    if (c === '\r') continue;
    if (c === '\n') { fecharLinha(); continue; }
    campo += c;
  }
  if (campo !== '' || linha.length > 0) fecharLinha();
  return linhas;
}
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/csv.test.ts`
Esperado: PASSA, 5 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/importar/csv.ts src/importar/csv.test.ts
git commit -m "feat(importar): leitor de CSV próprio, sem dependência"
```

---

### Tarefa 3: Normalização de descrição e moldes do Nubank

**Arquivos:**
- Criar: `src/importar/descricao.ts`
- Testar: `src/importar/descricao.test.ts`

**Interfaces:**
- Produz:
  - `normalizarDescricao(texto: string): string` — minúscula, sem acento, sem pontuação, sem
    espaço duplicado.
  - `contraparteNubank(descricao: string): string` — extrai o nome da contraparte dos moldes
    conhecidos; devolve a descrição inteira quando nenhum molde casa.
  - `naturezaNubank(descricao: string): NaturezaBruto | undefined` — reconhece
    `Aplicação RDB` e `Resgate RDB`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/descricao.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contraparteNubank, naturezaNubank, normalizarDescricao } from './descricao';

describe('normalizarDescricao', () => {
  it('tira acento, pontuação, caixa e espaço duplicado', () => {
    expect(normalizarDescricao('  Farmácia  DELTA, Ltda. ')).toBe('farmacia delta ltda');
  });
});

describe('contraparteNubank', () => {
  it('extrai o nome do Pix enviado', () => {
    const d = 'Transferência enviada pelo Pix - FULANO DE TAL - •••.123.456-•• - '
      + 'BANCO ALFA S.A. (0001) Agência: 1234 Conta: 12345-6';
    expect(contraparteNubank(d)).toBe('FULANO DE TAL');
  });

  it('extrai o nome do Pix recebido via Open Banking', () => {
    const d = 'Transferência recebida pelo Pix via Open Banking - LOJA GAMA - '
      + '12.345.678/0001-90 - BANCO ALFA S.A. (0001) Agência: 1 Conta: 1234567-0';
    expect(contraparteNubank(d)).toBe('LOJA GAMA');
  });

  // O nome do banco pode conter " - ". Partir a descrição por " - " quebra aqui.
  it('não se perde quando o nome do banco tem hífen cercado de espaços', () => {
    const d = 'Transferência enviada pelo Pix - POSTO BETA - •••.123.456-•• - '
      + 'BANCO ALFA - IP (0001) Agência: 1 Conta: 1234567-0';
    expect(contraparteNubank(d)).toBe('POSTO BETA');
  });

  it('extrai o beneficiário do boleto', () => {
    expect(contraparteNubank('Pagamento de boleto efetuado - MERCADO ALFA S.A.'))
      .toBe('MERCADO ALFA S.A.');
  });

  it('devolve a descrição inteira quando nenhum molde casa', () => {
    expect(contraparteNubank('Compra no débito')).toBe('Compra no débito');
  });
});

describe('naturezaNubank', () => {
  it('reconhece os movimentos da caixinha', () => {
    expect(naturezaNubank('Aplicação RDB')).toBe('aplicacaoInterna');
    expect(naturezaNubank('Resgate RDB')).toBe('resgateInterno');
  });

  it('não reconhece o que não é movimento interno', () => {
    expect(naturezaNubank('Pagamento de boleto efetuado - LOJA GAMA')).toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/descricao.test.ts`
Esperado: FALHA com "Failed to resolve import './descricao'".

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `src/importar/descricao.ts`:

```ts
import type { NaturezaBruto } from './tipos';

/** Forma canônica de uma descrição, para comparar duas descrições que são a mesma coisa. */
export function normalizarDescricao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOLDE_PIX = /^Transfer[êe]ncia (?:enviada|recebida) pelo Pix(?: via Open Banking)? - /i;
const MOLDE_BOLETO = /^Pagamento de boleto efetuado - /i;

/**
 * Nome da contraparte de um lançamento do Nubank. O Nubank monta a descrição por template, e
 * o que identifica o lançamento é só a contraparte — agência, conta e banco são ruído estável.
 *
 * O corte do sufixo é ancorado em `(NNNN) Agência:`, e NÃO em ` - `: o nome do banco pode
 * conter ` - `, como em "BANCO ALFA - IP (0001)", e partir por ` - ` erraria o campo.
 */
export function contraparteNubank(descricao: string): string {
  const boleto = MOLDE_BOLETO.exec(descricao);
  if (boleto) return descricao.slice(boleto[0].length).trim();

  const pix = MOLDE_PIX.exec(descricao);
  if (!pix) return descricao;

  const resto = descricao.slice(pix[0].length);
  // Corta tudo a partir do bloco do banco; o que sobra é "NOME - DOC".
  const semBanco = resto.replace(/\s*-\s*[^-]*\(\d{4}\)\s*Ag[êe]ncia:.*$/i, '');
  // O DOC é a última parte; o nome é o que vem antes dela.
  const partes = semBanco.split(' - ');
  return (partes.length > 1 ? partes.slice(0, -1).join(' - ') : semBanco).trim();
}

/** Movimento interno da caixinha do Nubank. Ver a seção "Movimento interno" da spec. */
export function naturezaNubank(descricao: string): NaturezaBruto | undefined {
  const n = normalizarDescricao(descricao);
  if (n === 'aplicacao rdb') return 'aplicacaoInterna';
  if (n === 'resgate rdb') return 'resgateInterno';
  return undefined;
}
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/descricao.test.ts`
Esperado: PASSA, 7 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/importar/descricao.ts src/importar/descricao.test.ts
git commit -m "feat(importar): normalização de descrição e moldes do Nubank"
```

---

### Tarefa 4: Adapter do extrato da conta Nubank

**Arquivos:**
- Criar: `src/importar/adapters/nubankConta.ts`
- Testar: `src/importar/adapters/nubankConta.test.ts`

**Interfaces:**
- Consome: `lerCsv`, `parsearValorExtrato`, `parsearDataExtrato`, `naturezaNubank`,
  `LeituraAdapter`, `Adapter`.
- Produz: `nubankConta: Adapter` e `lerNubankConta(texto: string): LeituraAdapter`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/adapters/nubankConta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerNubankConta, nubankConta } from './nubankConta';

const CABECALHO = 'Data,Valor,Identificador,Descrição';
const UUID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('lerNubankConta', () => {
  it('lê uma entrada e uma saída, com o Identificador como externalId', () => {
    const csv = [
      CABECALHO,
      `15/08/2026,1000.00,${UUID},Resgate RDB`,
      '16/08/2026,-45.00,2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e,'
        + 'Pagamento de boleto efetuado - LOJA GAMA',
    ].join('\n');

    const r = lerNubankConta(csv);

    expect(r.linhasIgnoradas).toBe(0);
    expect(r.brutos).toHaveLength(2);
    expect(r.brutos[0]).toEqual({
      data: '2026-08-15',
      valorCent: 100000,
      descricao: 'Resgate RDB',
      fonte: 'conta',
      externalId: UUID,
      natureza: 'resgateInterno',
    });
    expect(r.brutos[1].valorCent).toBe(-4500);
    expect(r.brutos[1].natureza).toBeUndefined();
  });

  it('marca a aplicação como movimento interno', () => {
    const csv = `${CABECALHO}\n15/08/2026,-1000.00,${UUID},Aplicação RDB`;
    expect(lerNubankConta(csv).brutos[0].natureza).toBe('aplicacaoInterna');
  });

  it('conta a linha ilegível em vez de lançar', () => {
    const csv = [
      CABECALHO,
      `15/08/2026,1000.00,${UUID},Resgate RDB`,
      'data-torta,valor-torto,x,y',
    ].join('\n');

    const r = lerNubankConta(csv);
    expect(r.brutos).toHaveLength(1);
    expect(r.linhasIgnoradas).toBe(1);
  });

  it('não devolve nada quando o cabeçalho não é o esperado', () => {
    const r = lerNubankConta('date,title,amount\n2026-08-15,LOJA GAMA,45.00');
    expect(r.brutos).toHaveLength(0);
  });
});

describe('nubankConta.detectar', () => {
  it('reconhece pelo cabeçalho, não pelo nome do arquivo', () => {
    expect(nubankConta.detectar('qualquer.csv', CABECALHO)).toBe(true);
    expect(nubankConta.detectar('NU_2026.csv', 'date,title,amount')).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/adapters/nubankConta.test.ts`
Esperado: FALHA com "Failed to resolve import './nubankConta'".

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `src/importar/adapters/nubankConta.ts`:

```ts
import { lerCsv } from '../csv';
import { naturezaNubank } from '../descricao';
import type { Adapter, LancamentoBruto, LeituraAdapter } from '../tipos';
import { parsearDataExtrato, parsearValorExtrato } from '../valores';

/** O cabeçalho é a assinatura do formato. O nome do arquivo não serve: o Nubank manda nomes
 *  diferentes conforme o mês e o canal. */
function ehCabecalho(linha: string): boolean {
  const c = linha.toLowerCase();
  return c.includes('data') && c.includes('valor') && c.includes('identificador');
}

/** Extrato da conta corrente Nubank. Positivo é entrada, negativo é saída — a convenção do
 *  `LancamentoBruto` é a mesma, então não há inversão de sinal aqui. */
export function lerNubankConta(texto: string): LeituraAdapter {
  const linhas = lerCsv(texto);
  const brutos: LancamentoBruto[] = [];
  let linhasIgnoradas = 0;

  if (linhas.length === 0 || !ehCabecalho(linhas[0].join(','))) {
    return { brutos, linhasIgnoradas, avisos: [] };
  }

  for (const colunas of linhas.slice(1)) {
    const data = parsearDataExtrato(colunas[0] ?? '');
    const valorCent = parsearValorExtrato(colunas[1] ?? '');
    const descricao = (colunas[3] ?? '').trim();
    if (data == null || valorCent == null || descricao === '') {
      linhasIgnoradas++;
      continue;
    }
    const externalId = (colunas[2] ?? '').trim();
    const natureza = naturezaNubank(descricao);
    brutos.push({
      data, valorCent, descricao, fonte: 'conta',
      ...(externalId ? { externalId } : {}),
      ...(natureza ? { natureza } : {}),
    });
  }
  return { brutos, linhasIgnoradas, avisos: [] };
}

export const nubankConta: Adapter = {
  id: 'nubank-conta-csv',
  rotulo: 'Nubank — extrato da conta (CSV)',
  detectar: (_nome, inicio) => ehCabecalho(inicio.split('\n')[0] ?? ''),
  ler: async (conteudo) =>
    lerNubankConta(new TextDecoder('utf-8').decode(conteudo)),
};
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/adapters/nubankConta.test.ts`
Esperado: PASSA, 5 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/importar/adapters/nubankConta.ts src/importar/adapters/nubankConta.test.ts
git commit -m "feat(importar): adapter do extrato da conta Nubank"
```

---

### Tarefa 5: Reconstrução da compra parcelada

**Arquivos:**
- Criar: `src/importar/parcelas.ts`
- Testar: `src/importar/parcelas.test.ts`

**Interfaces:**
- Consome: `addMeses`, `mesDe` de `src/domain/dates.ts`; `CompraReconstruida` de `./tipos`.
- Produz: `reconstruirCompra(args): CompraReconstruida` com
  `args: { diaMes: string; parcelaN: number; parcelaTotal: number; valorParcelaCent: number; mesFatura: string }`.
  `diaMes` é `"DD/MM"`; `mesFatura` é `"AAAA-MM"`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/parcelas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { reconstruirCompra } from './parcelas';

describe('reconstruirCompra', () => {
  it('multiplica a parcela pelo total e usa a data da própria linha', () => {
    const c = reconstruirCompra({
      diaMes: '02/07', parcelaN: 3, parcelaTotal: 10,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c).toEqual({
      data: '2026-07-02',
      valorTotalCent: 100000,
      parcelas: 10,
      anoDeduzidoComAviso: false,
    });
  });

  // Parcela 10 de 12 numa fatura de fevereiro: a compra é de maio do ANO ANTERIOR.
  it('deduz o ano anterior quando a compra ficou para trás', () => {
    const c = reconstruirCompra({
      diaMes: '02/05', parcelaN: 10, parcelaTotal: 12,
      valorParcelaCent: 12345, mesFatura: '2026-02',
    });
    expect(c.data).toBe('2025-05-02');
    expect(c.anoDeduzidoComAviso).toBe(false);
  });

  it('avisa quando a data deduzida cai longe do mês esperado', () => {
    const c = reconstruirCompra({
      diaMes: '02/01', parcelaN: 3, parcelaTotal: 10,
      valorParcelaCent: 10000, mesFatura: '2026-09',
    });
    expect(c.anoDeduzidoComAviso).toBe(true);
  });

  it('trata a compra à vista como parcela 1 de 1', () => {
    const c = reconstruirCompra({
      diaMes: '07/09', parcelaN: 1, parcelaTotal: 1,
      valorParcelaCent: 4500, mesFatura: '2026-09',
    });
    expect(c).toEqual({
      data: '2026-09-07', valorTotalCent: 4500, parcelas: 1, anoDeduzidoComAviso: false,
    });
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/parcelas.test.ts`
Esperado: FALHA com "Failed to resolve import './parcelas'".

- [ ] **Passo 3: Escrever a implementação mínima**

Criar `src/importar/parcelas.ts`:

```ts
import { addMeses } from '../domain/dates';
import type { ISODate } from '../domain/types';
import type { CompraReconstruida } from './tipos';

export interface ArgsReconstrucao {
  diaMes: string;        // "DD/MM", como a fatura escreve
  parcelaN: number;      // 1-based
  parcelaTotal: number;
  valorParcelaCent: number;
  mesFatura: string;     // "AAAA-MM" do vencimento da fatura sendo lida
}

/** Distância em meses entre dois "AAAA-MM". */
function distanciaEmMeses(a: string, b: string): number {
  const [anoA, mesA] = a.split('-').map(Number);
  const [anoB, mesB] = b.split('-').map(Number);
  return Math.abs((anoA * 12 + mesA) - (anoB * 12 + mesB));
}

/**
 * Remonta a compra original a partir de uma linha parcelada da fatura.
 *
 * A fatura do Santander já traz a data da compra na subseção `Parcelamentos` — não é preciso
 * calcular nada subtraindo meses. O que falta é o ano, porque a data vem como "DD/MM".
 *
 * O ano escolhido é o que põe a data mais perto do mês esperado, que é
 * `mês da fatura − (n − 1) meses`. Quando nem o melhor candidato cai a menos de dois meses do
 * esperado, o resultado vem com `anoDeduzidoComAviso`, e a tela mostra isso. Nunca se inventa
 * um ano em silêncio.
 */
export function reconstruirCompra(args: ArgsReconstrucao): CompraReconstruida {
  const [dia, mes] = args.diaMes.split('/');
  const mesEsperado = addMeses(args.mesFatura, -(args.parcelaN - 1));
  const anoBase = Number(mesEsperado.slice(0, 4));

  let melhorAno = anoBase;
  let melhorDistancia = Infinity;
  for (const ano of [anoBase - 1, anoBase, anoBase + 1]) {
    const d = distanciaEmMeses(`${ano}-${mes}`, mesEsperado);
    if (d < melhorDistancia) { melhorDistancia = d; melhorAno = ano; }
  }

  const data = `${melhorAno}-${mes}-${dia}` as ISODate;
  return {
    data,
    valorTotalCent: args.valorParcelaCent * args.parcelaTotal,
    parcelas: args.parcelaTotal,
    anoDeduzidoComAviso: melhorDistancia > 1,
  };
}
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/parcelas.test.ts`
Esperado: PASSA, 4 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/importar/parcelas.ts src/importar/parcelas.test.ts
git commit -m "feat(importar): reconstrução da compra parcelada da fatura"
```

---

### Tarefa 6: Adapter da fatura do Santander (texto)

**Arquivos:**
- Criar: `src/importar/adapters/santanderFatura.ts`
- Criar: `src/importar/fixtures/santander-fatura.ts`
- Testar: `src/importar/adapters/santanderFatura.test.ts`

**Interfaces:**
- Consome: `parsearValorExtrato`, `reconstruirCompra`, `LeituraAdapter`, `LancamentoBruto`.
- Produz: `lerSantanderFatura(texto: string, mesFatura: string): LeituraAdapter`, e
  `BlocoCartao { rotulo: string; brutos: LancamentoBruto[]; totalDeclaradoCent?: number }`
  exposto em `LeituraAdapter.blocos`.

**Nota para quem executa:** esta tarefa acrescenta `blocos?: BlocoCartao[]` a `LeituraAdapter`
em `src/importar/tipos.ts`. A fatura tem um bloco por cartão, e a tela precisa perguntar a que
`Cartao` do Flow cada bloco corresponde.

- [ ] **Passo 1: Criar a fixture sintética**

Criar `src/importar/fixtures/santander-fatura.ts`:

```ts
/** Texto sintético no formato da fatura do Santander, escrito à mão. Nenhum dado real do
 *  usuário entra no repositório — ver o guard `scripts/verificar-dados-reais.mjs`.
 *
 *  A última linha de Despesas está com três transações grudadas DE PROPÓSITO: é assim que a
 *  extração de texto do PDF entregou a página 3 do arquivo real. */
export const FATURA_SANTANDER = [
  'Detalhamento da Fatura',
  'FULANO DE TAL - 0000 XXXX XXXX 0000',
  'Pagamento e Demais Créditos',
  'Compra Data Descrição Parcela R$ US$',
  '03/08 PAGAMENTO DE FATURA-INTERNET -1.234,56',
  '10/07 LOJA GAMA -0,02',
  'Parcelamentos',
  'Compra Data Descrição Parcela R$ US$',
  '02/07 LOJA GAMA 03/10 100,00',
  'Despesas',
  'Compra Data Descrição Parcela R$ US$',
  '3 07/08 MERCADO ALFA 103 45,00',
  '3 19/08 POSTO BETA 51,90 3 20/08 FARMACIA DELTA 39,90',
  'VALOR TOTAL 236,80 0,00',
  '2/4',
].join('\n');
```

- [ ] **Passo 2: Escrever o teste que falha**

Criar `src/importar/adapters/santanderFatura.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FATURA_SANTANDER } from '../fixtures/santander-fatura';
import { lerSantanderFatura } from './santanderFatura';

describe('lerSantanderFatura', () => {
  it('lê os cinco lançamentos do bloco único', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    expect(r.brutos).toHaveLength(5);
    expect(r.blocos).toHaveLength(1);
    expect(r.blocos![0].rotulo).toBe('FULANO DE TAL - 0000 XXXX XXXX 0000');
  });

  // Este é o caso que derruba qualquer parser que assuma uma transação por linha.
  it('separa transações grudadas numa linha só', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const descricoes = r.brutos.map((b) => b.descricao);
    expect(descricoes).toContain('POSTO BETA');
    expect(descricoes).toContain('FARMACIA DELTA');
  });

  // "MERCADO ALFA 103" — o 103 é parte da descrição, não uma parcela.
  it('não confunde número no fim da descrição com parcela', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const mercado = r.brutos.find((b) => b.descricao === 'MERCADO ALFA 103');
    expect(mercado).toBeDefined();
    expect(mercado!.parcela).toBeUndefined();
    expect(mercado!.valorCent).toBe(-4500);
  });

  it('reconstrói a compra parcelada a partir da data da própria linha', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const parcelada = r.brutos.find((b) => b.parcela != null)!;
    expect(parcelada.parcela).toEqual({ n: 3, total: 10 });
    expect(parcelada.data).toBe('2026-07-02');
  });

  it('marca o pagamento da fatura e o estorno pela natureza', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const naturezas = r.brutos.map((b) => b.natureza);
    expect(naturezas).toContain('pagamentoFatura');
    expect(naturezas).toContain('estornoCartao');
  });

  it('descarta o ruído: cabeçalho de colunas, VALOR TOTAL e número de página', () => {
    const r = lerSantanderFatura(FATURA_SANTANDER, '2026-09');
    const descricoes = r.brutos.map((b) => b.descricao).join(' | ');
    expect(descricoes).not.toContain('VALOR TOTAL');
    expect(descricoes).not.toContain('Descrição Parcela');
  });

  it('avisa quando a soma do bloco não bate com o VALOR TOTAL declarado', () => {
    const torto = FATURA_SANTANDER.replace('VALOR TOTAL 236,80', 'VALOR TOTAL 999,00');
    const r = lerSantanderFatura(torto, '2026-09');
    expect(r.avisos.join(' ')).toContain('VALOR TOTAL');
  });
});
```

- [ ] **Passo 3: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/adapters/santanderFatura.test.ts`
Esperado: FALHA com "Failed to resolve import './santanderFatura'".

- [ ] **Passo 4: Acrescentar `blocos` a `LeituraAdapter`**

Em `src/importar/tipos.ts`, trocar a interface `LeituraAdapter` por:

```ts
/** Um bloco de cartão da fatura. A fatura pode ter titular, adicional e virtual; as linhas
 *  não trazem os dígitos do cartão, elas herdam do cabeçalho do bloco. */
export interface BlocoCartao {
  rotulo: string;
  brutos: LancamentoBruto[];
  totalDeclaradoCent?: number;
}

export interface LeituraAdapter {
  brutos: LancamentoBruto[];
  linhasIgnoradas: number;
  avisos: string[];
  blocos?: BlocoCartao[];
}
```

- [ ] **Passo 5: Escrever a implementação mínima**

Criar `src/importar/adapters/santanderFatura.ts`:

```ts
import { reconstruirCompra } from '../parcelas';
import type { BlocoCartao, LancamentoBruto, LeituraAdapter, NaturezaBruto } from '../tipos';
import { parsearValorExtrato } from '../valores';

/** Começo de uma transação: ícone opcional (vira "2 " ou "3 " na extração) mais DD/MM. */
const INICIO_TRANSACAO = /(?:^|\s)(?:[23]\s)?(\d{2}\/\d{2})\s/g;

/** Valor no fim do segmento, com a parcela opcional imediatamente antes dele. Ancorar a
 *  parcela aqui é o que impede "MERCADO ALFA 103" de virar parcela. */
const FIM_TRANSACAO = /^(.*?)\s*(?:(\d{2}\/\d{2})\s+)?(-?[\d.]+,\d{2})\s*$/;

const CABECALHO_BLOCO = /^@?\s*.+ - \d{4} [X\d]{4} [X\d]{4} \d{4}$/;
const RUIDO = [
  /^Detalhamento da Fatura$/i,
  /^Compra Data Descri[çc][ãa]o Parcela/i,
  /^\d\/\d$/,
  /^(Pagamento e Demais Cr[ée]ditos|Parcelamentos|Despesas)$/i,
];

type Subsecao = 'creditos' | 'parcelamentos' | 'despesas';

function subsecaoDe(linha: string): Subsecao | undefined {
  const l = linha.trim().toLowerCase();
  if (l.startsWith('pagamento e demais')) return 'creditos';
  if (l === 'parcelamentos') return 'parcelamentos';
  if (l === 'despesas') return 'despesas';
  return undefined;
}

function naturezaDe(descricao: string, subsecao: Subsecao): NaturezaBruto | undefined {
  if (subsecao !== 'creditos') return undefined;
  return /pagamento de fatura/i.test(descricao) ? 'pagamentoFatura' : 'estornoCartao';
}

/** Quebra uma linha em segmentos, um por transação. A extração de texto do PDF junta várias
 *  transações numa linha só, então segmentar por regex é obrigatório, não otimização. */
function segmentar(linha: string): { diaMes: string; resto: string }[] {
  const marcas: { indice: number; diaMes: string; fim: number }[] = [];
  INICIO_TRANSACAO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INICIO_TRANSACAO.exec(linha)) != null) {
    marcas.push({ indice: m.index, diaMes: m[1], fim: m.index + m[0].length });
  }
  return marcas.map((marca, i) => ({
    diaMes: marca.diaMes,
    resto: linha.slice(marca.fim, marcas[i + 1]?.indice ?? linha.length).trim(),
  }));
}

/**
 * Fatura do cartão Santander, a partir do TEXTO já extraído do PDF. Esta função nunca vê um
 * PDF: `textoPdf.ts` é a única parte que conhece o pdf.js, e essa separação é o que torna o
 * parser testável.
 *
 * `mesFatura` é o "AAAA-MM" do vencimento, necessário para deduzir o ano das datas "DD/MM".
 */
export function lerSantanderFatura(texto: string, mesFatura: string): LeituraAdapter {
  const blocos: BlocoCartao[] = [];
  const avisos: string[] = [];
  let linhasIgnoradas = 0;
  let atual: BlocoCartao | undefined;
  let subsecao: Subsecao = 'despesas';

  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim();
    if (linha === '') continue;

    if (CABECALHO_BLOCO.test(linha)) {
      atual = { rotulo: linha, brutos: [] };
      blocos.push(atual);
      subsecao = 'despesas';
      continue;
    }

    const sub = subsecaoDe(linha);
    if (sub) { subsecao = sub; continue; }

    const total = /^VALOR TOTAL\s+(-?[\d.]+,\d{2})/.exec(linha);
    if (total && atual) {
      atual.totalDeclaradoCent = parsearValorExtrato(total[1]);
      continue;
    }

    if (RUIDO.some((re) => re.test(linha))) continue;
    if (!atual) continue;

    const segmentos = segmentar(linha);
    if (segmentos.length === 0) { linhasIgnoradas++; continue; }

    for (const seg of segmentos) {
      const m = FIM_TRANSACAO.exec(seg.resto);
      const valorCent = m ? parsearValorExtrato(m[3]) : undefined;
      if (!m || valorCent == null || m[1].trim() === '') { linhasIgnoradas++; continue; }

      const descricao = m[1].trim();
      const parcelaTexto = m[2];
      const n = parcelaTexto ? Number(parcelaTexto.slice(0, 2)) : 1;
      const total = parcelaTexto ? Number(parcelaTexto.slice(3)) : 1;

      const compra = reconstruirCompra({
        diaMes: seg.diaMes, parcelaN: n, parcelaTotal: total,
        valorParcelaCent: Math.abs(valorCent), mesFatura,
      });
      if (compra.anoDeduzidoComAviso) {
        avisos.push(`Ano deduzido com incerteza em "${descricao}".`);
      }

      const natureza = naturezaDe(descricao, subsecao);
      // O sinal do LancamentoBruto é o do banco: gasto de cartão é saída.
      const sinalizado = valorCent > 0 ? -valorCent : valorCent;
      atual.brutos.push({
        data: compra.data,
        valorCent: sinalizado,
        descricao,
        fonte: 'cartao',
        ...(parcelaTexto ? { parcela: { n, total } } : {}),
        ...(natureza ? { natureza } : {}),
      } satisfies LancamentoBruto);
    }
  }

  for (const b of blocos) {
    if (b.totalDeclaradoCent == null) continue;
    const soma = b.brutos
      .filter((x) => x.natureza == null)
      .reduce((s, x) => s + Math.abs(x.valorCent), 0);
    if (soma !== b.totalDeclaradoCent) {
      avisos.push(
        `A soma do cartão "${b.rotulo}" não bate com o VALOR TOTAL declarado na fatura.`,
      );
    }
  }

  return { brutos: blocos.flatMap((b) => b.brutos), linhasIgnoradas, avisos, blocos };
}
```

- [ ] **Passo 6: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/adapters/santanderFatura.test.ts`
Esperado: PASSA, 7 testes.

Se o teste da soma falhar, confira a fixture: `100,00 + 45,00 + 51,90 + 39,90 = 236,80`. Os
créditos ficam de fora da soma de propósito, como a própria fatura faz.

- [ ] **Passo 7: Commitar**

```bash
git add src/importar/adapters/santanderFatura.ts src/importar/adapters/santanderFatura.test.ts \
        src/importar/fixtures/santander-fatura.ts src/importar/tipos.ts
git commit -m "feat(importar): adapter da fatura do Santander, a partir do texto"
```

---

### Tarefa 7: A conferência

**Arquivos:**
- Criar: `src/importar/conferencia.ts`
- Testar: `src/importar/conferencia.test.ts`

**Interfaces:**
- Consome: `Dados`, `Lancamento`, `CompraCartao` de `src/domain/types.ts`;
  `normalizarDescricao`, `contraparteNubank`; `ItemConferencia`, `LancamentoBruto`.
- Produz:

```ts
export interface OpcoesConferencia {
  boxId: ID;
  cartaoId?: ID;                 // obrigatório quando há bruto com fonte 'cartao'
  categoriaPadraoId: ID;         // categoria da box para item 'novo'
  categoriaCartaoPadraoId?: ID;  // "A classificar" do cartão
  toleranciaDias?: number;       // padrão 3
}

export function conferir(
  brutos: LancamentoBruto[], dados: Dados, opcoes: OpcoesConferencia,
): ItemConferencia[];
```

Esta é a tarefa central. Toda a inteligência da feature mora aqui, e a função é pura: sem
IndexedDB, sem React, sem arquivo.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/conferencia.test.ts`. O teste monta um `Dados` mínimo à mão:

```ts
import { describe, expect, it } from 'vitest';
import type { Dados, Lancamento } from '../domain/types';
import { conferir } from './conferencia';
import type { LancamentoBruto } from './tipos';

const BOX = 'box-1';
const CAT = 'cat-1';
const CARTAO = 'cartao-1';
const CAT_CARTAO = 'catcartao-1';

function lancamento(p: Partial<Lancamento> & { data: string; valor: number }): Lancamento {
  return {
    id: p.id ?? `l-${p.data}-${p.valor}`,
    boxId: BOX, categoriaId: CAT, nota: p.nota, data: p.data, valor: p.valor,
    status: p.status ?? 'efetivo', origem: p.origem ?? 'manual',
    criadoEm: '2026-08-01T00:00:00.000Z', alteradoEm: '2026-08-01T00:00:00.000Z',
    ...p,
  } as Lancamento;
}

function dadosCom(lancamentos: Lancamento[]): Dados {
  return {
    boxes: [], categorias: [], lancamentos, recorrencias: [], cenarios: [],
    cartoes: [], categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [],
    conferenciasFatura: [], viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: BOX, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
  };
}

function bruto(p: Partial<LancamentoBruto> & { data: string; valorCent: number }): LancamentoBruto {
  return { descricao: 'LOJA GAMA', fonte: 'conta', ...p };
}

const OPCOES = { boxId: BOX, categoriaPadraoId: CAT, cartaoId: CARTAO,
                 categoriaCartaoPadraoId: CAT_CARTAO };

describe('conferir', () => {
  it('marca confere quando já existe lançamento igual', () => {
    const d = dadosCom([lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA' })]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    expect(itens[0].estado).toBe('confere');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('marca previsto e propõe confirmar', () => {
    const d = dadosCom([
      lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA', status: 'previsto' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    expect(itens[0].estado).toBe('previsto');
    expect(itens[0].acao.tipo).toBe('confirmar');
  });

  it('marca divergente e propõe o valor do banco', () => {
    const d = dadosCom([
      lancamento({ data: '2026-08-15', valor: 12000, nota: 'LOJA GAMA', status: 'previsto' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -13700 })], d, OPCOES);
    expect(itens[0].estado).toBe('divergente');
    expect(itens[0].acao).toEqual({ tipo: 'confirmarComValor', valorCent: 13700, data: '2026-08-15' });
  });

  it('marca novo e propõe adicionar na categoria padrão', () => {
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao).toEqual({ tipo: 'adicionarLancamento', categoriaId: CAT });
  });

  it('não marca sobra para lançamento fora do período, mesmo por um dia', () => {
    const d = dadosCom([
      lancamento({ id: 'sobrando', data: '2026-08-16', valor: 1000, nota: 'POSTO BETA' }),
    ]);
    const itens = conferir([bruto({ data: '2026-08-15', valorCent: -4500 })], d, OPCOES);
    const sobra = itens.find((i) => i.estado === 'sobra');
    expect(sobra).toBeUndefined(); // 16/08 está fora do período [15/08, 15/08]
  });

  it('não marca sobra fora do período coberto pelo arquivo', () => {
    const d = dadosCom([
      lancamento({ id: 'antigo', data: '2026-01-01', valor: 1000, nota: 'POSTO BETA' }),
      lancamento({ id: 'dentro', data: '2026-08-16', valor: 1000, nota: 'POSTO BETA' }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500 }),
      bruto({ data: '2026-08-17', valorCent: -5190, descricao: 'FARMACIA DELTA' }),
    ], d, OPCOES);
    const sobras = itens.filter((i) => i.estado === 'sobra').map((i) => i.lancamentoId);
    expect(sobras).toEqual(['dentro']);
  });

  // Sem casamento um-para-um, os dois brutos casam com o mesmo lançamento.
  it('casa um-para-um quando há dois lançamentos iguais no mesmo dia', () => {
    const d = dadosCom([
      lancamento({ id: 'a', data: '2026-08-15', valor: 1000, nota: 'LOJA GAMA' }),
      lancamento({ id: 'b', data: '2026-08-15', valor: 1000, nota: 'LOJA GAMA' }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -1000 }),
      bruto({ data: '2026-08-15', valorCent: -1000 }),
    ], d, OPCOES);
    expect(itens.filter((i) => i.estado === 'confere')).toHaveLength(2);
    expect(new Set(itens.map((i) => i.lancamentoId)).size).toBe(2);
  });

  it('casa dentro da tolerância de três dias e não fora dela', () => {
    const d = dadosCom([lancamento({ data: '2026-08-15', valor: 4500, nota: 'LOJA GAMA' })]);
    expect(conferir([bruto({ data: '2026-08-18', valorCent: -4500 })], d, OPCOES)[0].estado)
      .toBe('confere');
    expect(conferir([bruto({ data: '2026-08-19', valorCent: -4500 })], d, OPCOES)[0].estado)
      .toBe('novo');
  });

  it('marca o resgate como interno e ignora, sem perguntar', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: 100000, descricao: 'Resgate RDB',
              natureza: 'resgateInterno' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('marca a aplicação como interno, mas com aviso de que é sua decisão', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -100000, descricao: 'Aplicação RDB',
              natureza: 'aplicacaoInterna' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBeDefined();
  });

  it('marca o estorno como interno e não grava', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -2, fonte: 'cartao', natureza: 'estornoCartao' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('interno');
    expect(itens[0].acao.tipo).toBe('ignorar');
  });

  it('confere o pagamento da fatura contra o lançamento da fatura', () => {
    const d = dadosCom([
      lancamento({
        id: 'fatura', data: '2026-08-05', valor: 123456, status: 'previsto',
        origem: 'cartao', cartaoId: CARTAO, faturaMes: '2026-08',
      }),
    ]);
    const itens = conferir([
      bruto({ data: '2026-08-03', valorCent: -123456, fonte: 'cartao',
              descricao: 'PAGAMENTO DE FATURA-INTERNET', natureza: 'pagamentoFatura' }),
    ], d, OPCOES);
    expect(itens[0].estado).toBe('previsto');
    expect(itens[0].lancamentoId).toBe('fatura');
    expect(itens[0].acao).toEqual({
      tipo: 'confirmarComValor', valorCent: 123456, data: '2026-08-03',
    });
  });

  it('não cria nada quando o pagamento não acha fatura correspondente', () => {
    const itens = conferir([
      bruto({ data: '2026-08-03', valorCent: -123456, fonte: 'cartao',
              descricao: 'PAGAMENTO DE FATURA-INTERNET', natureza: 'pagamentoFatura' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao.tipo).toBe('ignorar');
    expect(itens[0].aviso).toBeDefined();
  });

  it('propõe adicionar compra para gasto de cartão não encontrado', () => {
    const itens = conferir([
      bruto({ data: '2026-08-15', valorCent: -4500, fonte: 'cartao' }),
    ], dadosCom([]), OPCOES);
    expect(itens[0].estado).toBe('novo');
    expect(itens[0].acao).toEqual({ tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO });
  });
});
```

- [ ] **Passo 2: Rodar o teste e confirmar que falha**

Rodar: `npx vitest run src/importar/conferencia.test.ts`
Esperado: FALHA com "Failed to resolve import './conferencia'".

- [ ] **Passo 3: Escrever a implementação**

Criar `src/importar/conferencia.ts`:

```ts
import { diasEntre } from '../domain/dates';
import type { CompraCartao, Dados, ID, ISODate, Lancamento } from '../domain/types';
import { contraparteNubank, normalizarDescricao } from './descricao';
import type { ItemConferencia, LancamentoBruto } from './tipos';

export interface OpcoesConferencia {
  boxId: ID;
  cartaoId?: ID;
  categoriaPadraoId: ID;
  categoriaCartaoPadraoId?: ID;
  toleranciaDias?: number;
}

/** Candidato do lado do app: um lançamento da box, ou uma compra de cartão. */
interface Candidato {
  id: ID;
  data: ISODate;
  valorCent: number;
  chave: string;
  ehPrevisto: boolean;
  ehCompra: boolean;
}

function diferencaEmDias(a: ISODate, b: ISODate): number {
  const [menor, maior] = a <= b ? [a, b] : [b, a];
  return diasEntre(menor, maior).length - 1;
}

function chaveDe(texto: string): string {
  return normalizarDescricao(contraparteNubank(texto));
}

/** O que identifica um bruto do lado do app. Para cartão, a nota da compra; para conta, a
 *  nota do lançamento. */
function chaveDoBruto(b: LancamentoBruto): string {
  return chaveDe(b.descricao);
}

function candidatosDaConta(dados: Dados, boxId: ID): Candidato[] {
  return dados.lancamentos
    .filter((l) => l.boxId === boxId && l.origem !== 'cartao' && l.origem !== 'transferencia')
    .map((l: Lancamento) => ({
      id: l.id, data: l.data, valorCent: l.valor,
      chave: chaveDe(l.nota ?? ''), ehPrevisto: l.status === 'previsto', ehCompra: false,
    }));
}

function candidatosDoCartao(dados: Dados, cartaoId: ID | undefined): Candidato[] {
  if (!cartaoId) return [];
  return dados.comprasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .map((c: CompraCartao) => ({
      id: c.id, data: c.data, valorCent: c.valorTotal,
      chave: chaveDe(c.descricao ?? ''), ehPrevisto: false, ehCompra: true,
    }));
}

/**
 * Compara o que o banco mandou com o que o app tem, e devolve um item por decisão.
 *
 * O casamento é UM-PARA-UM e guloso: cada candidato casa no máximo uma vez. Sem isso, dois
 * lançamentos iguais no mesmo dia casam os dois com o mesmo registro — um vira `confere`, o
 * outro vira `novo`, e os dois estão errados.
 *
 * O `externalId` do bruto é lido do arquivo mas NÃO casa nada nesta entrega: `Lancamento` não
 * tem onde guardá-lo, então o app nunca tem um para comparar. Ver a entrega 3 na spec.
 *
 * Função pura: nada de IndexedDB, React ou arquivo. Todos os testes vivem disso.
 */
export function conferir(
  brutos: LancamentoBruto[], dados: Dados, opcoes: OpcoesConferencia,
): ItemConferencia[] {
  const tolerancia = opcoes.toleranciaDias ?? 3;
  const itens: ItemConferencia[] = [];
  const usados = new Set<ID>();

  const daConta = candidatosDaConta(dados, opcoes.boxId);
  const doCartao = candidatosDoCartao(dados, opcoes.cartaoId);

  const faturas = dados.lancamentos.filter(
    (l) => l.origem === 'cartao' && l.cartaoId === opcoes.cartaoId,
  );

  for (const b of brutos) {
    // 1. Movimento interno e estorno: reconhecidos, nunca gravados.
    if (b.natureza === 'resgateInterno') {
      itens.push({ estado: 'interno', bruto: b, acao: { tipo: 'ignorar' } });
      continue;
    }
    if (b.natureza === 'aplicacaoInterna') {
      itens.push({
        estado: 'interno', bruto: b, acao: { tipo: 'ignorar' },
        aviso: 'Guardar na caixinha é movimento interno. Se este dinheiro foi para uma '
          + 'reserva que você não conta, marque como saída de verdade.',
      });
      continue;
    }
    if (b.natureza === 'estornoCartao') {
      itens.push({
        estado: 'interno', bruto: b, acao: { tipo: 'ignorar' },
        aviso: 'Estorno reconhecido. Esta versão ainda não grava estorno de cartão.',
      });
      continue;
    }

    // 2. Pagamento da fatura: casa contra o lançamento da fatura, nunca vira compra.
    if (b.natureza === 'pagamentoFatura') {
      const alvo = faturas
        .filter((f) => !usados.has(f.id))
        .sort((x, y) => diferencaEmDias(x.data, b.data) - diferencaEmDias(y.data, b.data))[0];
      if (!alvo) {
        itens.push({
          estado: 'novo', bruto: b, acao: { tipo: 'ignorar' },
          aviso: 'Pagamento sem fatura correspondente no Flow. Confira se o cartão está '
            + 'cadastrado e se o ciclo está certo.',
        });
        continue;
      }
      usados.add(alvo.id);
      const valorCent = Math.abs(b.valorCent);
      const igual = alvo.status === 'efetivo' && alvo.valor === valorCent;
      itens.push({
        estado: igual ? 'confere' : alvo.status === 'previsto' ? 'previsto' : 'divergente',
        bruto: b, lancamentoId: alvo.id,
        acao: igual
          ? { tipo: 'ignorar' }
          : { tipo: 'confirmarComValor', valorCent, data: b.data },
      });
      continue;
    }

    // 3. Casamento comum.
    const universo = b.fonte === 'cartao' ? doCartao : daConta;
    const valorCent = Math.abs(b.valorCent);
    const chave = chaveDoBruto(b);

    const perto = universo
      .filter((c) => !usados.has(c.id)
        && c.chave === chave
        && diferencaEmDias(c.data, b.data) <= tolerancia)
      .sort((x, y) => diferencaEmDias(x.data, b.data) - diferencaEmDias(y.data, b.data));

    const exato = perto.find((c) => c.valorCent === valorCent);
    if (exato) {
      usados.add(exato.id);
      itens.push({
        estado: exato.ehPrevisto ? 'previsto' : 'confere',
        bruto: b, ...refDe(exato),
        acao: exato.ehPrevisto ? { tipo: 'confirmar' } : { tipo: 'ignorar' },
      });
      continue;
    }

    const divergente = perto[0];
    if (divergente) {
      usados.add(divergente.id);
      itens.push({
        estado: 'divergente', bruto: b, ...refDe(divergente),
        acao: { tipo: 'confirmarComValor', valorCent, data: b.data },
      });
      continue;
    }

    itens.push({
      estado: 'novo', bruto: b,
      acao: b.fonte === 'cartao'
        ? { tipo: 'adicionarCompra', categoriaCartaoId: opcoes.categoriaCartaoPadraoId! }
        : { tipo: 'adicionarLancamento', categoriaId: opcoes.categoriaPadraoId },
    });
  }

  // 4. Sobra: o que o app tem, dentro do período do arquivo, e o arquivo não tem.
  const datas = brutos.map((b) => b.data).sort();
  if (datas.length > 0) {
    const [inicio, fim] = [datas[0], datas[datas.length - 1]];
    for (const c of [...daConta, ...doCartao]) {
      if (usados.has(c.id)) continue;
      if (c.data < inicio || c.data > fim) continue;
      itens.push({ estado: 'sobra', ...refDe(c), acao: { tipo: 'ignorar' } });
    }
  }

  return itens;
}

function refDe(c: Candidato): { lancamentoId: ID } | { compraCartaoId: ID } {
  return c.ehCompra ? { compraCartaoId: c.id } : { lancamentoId: c.id };
}
```

- [ ] **Passo 4: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/importar/conferencia.test.ts`
Esperado: PASSA, 15 testes.

- [ ] **Passo 5: Commitar**

```bash
git add src/importar/conferencia.ts src/importar/conferencia.test.ts
git commit -m "feat(importar): conferência com os seis estados e casamento um-para-um"
```

---

### Tarefa 8: Gravação em lote

**Arquivos:**
- Modificar: `src/db/repo.ts`
- Criar: `src/importar/aplicar.ts`
- Testar: `src/db/repo.test.ts` (acrescentar), `src/importar/aplicar.test.ts`

**Interfaces:**
- Produz em `repo`:
  `salvarComprasCartaoEmLote(compras: NovaCompraCartao[], horizonte: ISODate): Promise<void>`
  — grava todas numa transação e chama `sincronizarCartoes` **uma vez**, no fim.
- Produz em `aplicar.ts`:
  `aplicar(itens: ItemConferencia[], ctx: ContextoAplicar): Promise<ResumoAplicacao>` com
  `ContextoAplicar { boxId: ID; cartaoId?: ID; horizonte: ISODate }` e
  `ResumoAplicacao { confirmados: number; adicionados: number; excluidos: number; ignorados: number }`.

`src/db/` é a camada onde um erro custa dados financeiros do usuário. Leia
`src/db/CLAUDE.md` antes de tocar em `repo.ts`.

- [ ] **Passo 1: Escrever o teste que falha, em `src/db/repo.test.ts`**

```ts
it('salva compras em lote e sincroniza uma vez só', async () => {
  const box = await criarBoxDeTeste();           // helper já existente no arquivo
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão', diaFechamento: 20, diaVencimento: 1,
    categoriaFaturaId: await criarCategoriaDeTeste(box.id), ativo: true,
  }, HORIZONTE);
  const cat = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'Mercado' });

  await repo.salvarComprasCartaoEmLote([
    { cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-08-10',
      valorTotal: 4500, parcelas: 1, descricao: 'MERCADO ALFA' },
    { cartaoId: cartao.id, categoriaCartaoId: cat.id, data: '2026-08-11',
      valorTotal: 5190, parcelas: 3, descricao: 'POSTO BETA' },
  ], HORIZONTE);

  const dados = await repo.carregarTudo();
  expect(dados.comprasCartao).toHaveLength(2);
  // A fatura projetada existe, prova de que sincronizarCartoes rodou.
  expect(dados.lancamentos.some((l) => l.origem === 'cartao')).toBe(true);
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

Rodar: `npx vitest run src/db/repo.test.ts -t "em lote"`
Esperado: FALHA com "repo.salvarComprasCartaoEmLote is not a function".

- [ ] **Passo 3: Implementar em `src/db/repo.ts`**

Acrescentar logo depois de `salvarCompraCartao`:

```ts
/**
 * Grava várias compras numa transação só e sincroniza os cartões UMA vez, no fim.
 *
 * `salvarCompraCartao` chama `sincronizarCartoes` a cada compra, e cada chamada recalcula
 * todas as faturas de todos os cartões. Numa conferência de fatura são dezenas de compras —
 * dezenas de recálculos completos, com o app travado. Este caminho existe só para isso.
 *
 * A transação é única de propósito: gravar metade faria a próxima conferência mentir sobre o
 * que já entrou.
 */
export async function salvarComprasCartaoEmLote(
  compras: NovaCompraCartao[], horizonte: ISODate,
): Promise<void> {
  if (compras.length === 0) return;
  const agora = agoraISO();
  await db.transaction('rw', db.comprasCartao, db.config, async () => {
    await db.comprasCartao.bulkAdd(compras.map((n): CompraCartao => ({
      id: novoId(), criadoEm: agora, alteradoEm: agora, ...n,
    })));
    await marcarMudanca();
  });
  await sincronizarCartoes(horizonte);
}
```

- [ ] **Passo 4: Rodar e confirmar que passa**

Rodar: `npx vitest run src/db/repo.test.ts -t "em lote"`
Esperado: PASSA.

- [ ] **Passo 5: Escrever o teste de `aplicar`**

Criar `src/importar/aplicar.test.ts`, com um caso por ação:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../db/repo';
import { aplicar } from './aplicar';

const HORIZONTE = '2027-12-31';

describe('aplicar', () => {
  beforeEach(async () => { await repo.substituirTudo(await repo.carregarTudo()); });

  it('confirma um previsto com o valor do banco', async () => {
    const box = await repo.salvarBox({
      id: 'box-1', nome: 'Casa', saldoInicial: 0, dataSaldoInicial: '2026-08-01',
      criadoEm: '2026-08-01T00:00:00.000Z', alteradoEm: '2026-08-01T00:00:00.000Z',
    } as never).then(() => repo.carregarTudo()).then((d) => d.boxes[0]);
    const cat = await repo.salvarCategoria({
      boxId: box.id, nome: 'Mercado', tipo: 'gasto', ordem: 1, arquivada: false,
    });
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: cat.id, data: '2026-08-15', valor: 12000,
      status: 'previsto', nota: 'LOJA GAMA',
    });

    const resumo = await aplicar([{
      estado: 'divergente', lancamentoId: l.id,
      acao: { tipo: 'confirmarComValor', valorCent: 13700, data: '2026-08-15' },
    }], { boxId: box.id, horizonte: HORIZONTE });

    const dados = await repo.carregarTudo();
    const atualizado = dados.lancamentos.find((x) => x.id === l.id)!;
    expect(atualizado.status).toBe('efetivo');
    expect(atualizado.valor).toBe(13700);
    expect(resumo.confirmados).toBe(1);
  });

  it('não grava nada para itens ignorados', async () => {
    const antes = await repo.carregarTudo();
    const resumo = await aplicar(
      [{ estado: 'interno', acao: { tipo: 'ignorar' } }],
      { boxId: 'box-1', horizonte: HORIZONTE },
    );
    const depois = await repo.carregarTudo();
    expect(depois.lancamentos).toHaveLength(antes.lancamentos.length);
    expect(resumo.ignorados).toBe(1);
  });
});
```

- [ ] **Passo 6: Rodar e confirmar que falha**

Rodar: `npx vitest run src/importar/aplicar.test.ts`
Esperado: FALHA com "Failed to resolve import './aplicar'".

- [ ] **Passo 7: Implementar `src/importar/aplicar.ts`**

```ts
import * as repo from '../db/repo';
import type { ID, ISODate } from '../domain/types';
import type { ItemConferencia } from './tipos';

export interface ContextoAplicar {
  boxId: ID;
  cartaoId?: ID;
  horizonte: ISODate;
}

export interface ResumoAplicacao {
  confirmados: number;
  adicionados: number;
  excluidos: number;
  ignorados: number;
}

/**
 * Executa as decisões da conferência.
 *
 * As compras de cartão vão todas juntas por `salvarComprasCartaoEmLote`, para que
 * `sincronizarCartoes` rode uma vez só. O resto vai item a item, porque são operações
 * pontuais e o `repo` já as trata em transação própria.
 */
export async function aplicar(
  itens: ItemConferencia[], ctx: ContextoAplicar,
): Promise<ResumoAplicacao> {
  const resumo: ResumoAplicacao = {
    confirmados: 0, adicionados: 0, excluidos: 0, ignorados: 0,
  };
  const compras: repo.NovaCompraCartao[] = [];

  for (const item of itens) {
    const a = item.acao;
    switch (a.tipo) {
      case 'ignorar':
        resumo.ignorados++;
        break;
      case 'confirmar':
        await repo.confirmarPendente(item.lancamentoId!);
        resumo.confirmados++;
        break;
      case 'confirmarComValor':
        await repo.confirmarPendente(item.lancamentoId!, a.valorCent, a.data);
        resumo.confirmados++;
        break;
      case 'adicionarLancamento':
        await repo.salvarLancamento({
          boxId: ctx.boxId, categoriaId: a.categoriaId,
          data: item.bruto!.data, valor: Math.abs(item.bruto!.valorCent),
          status: 'efetivo', nota: item.bruto!.descricao,
        });
        resumo.adicionados++;
        break;
      case 'adicionarCompra': {
        const c = item.compraReconstruida;
        compras.push({
          cartaoId: ctx.cartaoId!, categoriaCartaoId: a.categoriaCartaoId,
          data: c?.data ?? item.bruto!.data,
          valorTotal: c?.valorTotalCent ?? Math.abs(item.bruto!.valorCent),
          parcelas: c?.parcelas ?? item.bruto!.parcela?.total ?? 1,
          descricao: item.bruto!.descricao,
        });
        resumo.adicionados++;
        break;
      }
      case 'excluir':
        if (item.compraCartaoId) {
          await repo.excluirCompraCartao(item.compraCartaoId, ctx.horizonte);
        } else {
          await repo.excluirLancamento(item.lancamentoId!);
        }
        resumo.excluidos++;
        break;
    }
  }

  await repo.salvarComprasCartaoEmLote(compras, ctx.horizonte);
  return resumo;
}
```

- [ ] **Passo 8: Rodar e confirmar que passa**

Rodar: `npx vitest run src/importar/aplicar.test.ts`
Esperado: PASSA, 2 testes.

- [ ] **Passo 9: Rodar a suíte inteira**

Rodar: `npm test`
Esperado: tudo verde, incluindo `src/dossie/dossie.test.ts`. Se o dossiê acusar desatualização,
rode `npm run dossie` e commite o resultado junto.

- [ ] **Passo 10: Commitar**

```bash
git add src/db/repo.ts src/db/repo.test.ts src/importar/aplicar.ts src/importar/aplicar.test.ts
git commit -m "feat(importar): gravação em lote das decisões da conferência"
```

---

### Tarefa 9: PORTÃO — decisão do pdf.js, e a extração de texto

**Este passo para e espera o usuário.** Não instale nada antes da confirmação.

**Arquivos:**
- Modificar: `package.json`, `package-lock.json` (só pela instalação)
- Criar: `src/importar/adapters/textoPdf.ts`

- [ ] **Passo 1: Levar a decisão ao usuário**

Apresentar, e esperar resposta:

- O que se pede: `pdfjs-dist`, em `dependencies`.
- Por que código próprio não basta: um PDF guarda glifos posicionados, não frases.
  Reconstruir a ordem de leitura a partir de coordenadas é o trabalho inteiro da biblioteca.
- Mitigação: `import()` dinâmico, então o pacote fica fora do bundle inicial do PWA e só baixa
  na primeira importação de fatura. Nenhum teste o carrega.
- Custo: por volta de 1 MB, baixado sob demanda.

- [ ] **Passo 2: Rodar a auditoria ANTES de instalar**

Rodar: `npm audit --package-lock-only`
Anotar o resultado e levá-lo ao usuário junto com a decisão. Vulnerabilidade alta ou crítica
em `pdfjs-dist` **cancela** a instalação, e o assunto volta ao usuário.

- [ ] **Passo 3: Instalar, com o lockfile no mesmo commit**

```bash
npm install pdfjs-dist
git add package.json package-lock.json
git commit -m "build: acrescenta pdfjs-dist para ler a fatura em PDF"
```

- [ ] **Passo 4: Escrever a casca**

Criar `src/importar/adapters/textoPdf.ts`:

```ts
/**
 * Única parte do app que conhece o pdf.js.
 *
 * A separação não é estética: `santanderFatura.ts` recebe TEXTO, e por isso é testado com
 * fixture, sem PDF binário e sem carregar a biblioteca. O `import()` é dinâmico para que o
 * pdf.js fique fora do bundle inicial do PWA — quem nunca importa uma fatura nunca o baixa.
 */
export async function extrairTextoPdf(conteudo: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;

  const doc = await pdfjs.getDocument({ data: conteudo }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudoTexto = await pagina.getTextContent();
    paginas.push(
      conteudoTexto.items
        .map((i) => ('str' in i ? i.str : ''))
        .join(' ')
        .replace(/\s+/g, ' '),
    );
  }
  return paginas.join('\n');
}
```

- [ ] **Passo 5: Confirmar que o build passa**

Rodar: `npm run build`
Esperado: sucesso. Se o TypeScript reclamar do `?url`, acrescente a declaração em
`src/ui/vite-env.d.ts` — esse arquivo já existe e é o lugar certo para tipos de import do Vite.

- [ ] **Passo 6: Commitar**

```bash
git add src/importar/adapters/textoPdf.ts
git commit -m "feat(importar): extração de texto do PDF, isolada do parser"
```

---

### Tarefa 10: PORTÃO — mockup da tela, e a tela de conferência

**Este passo para e espera o usuário.** Tela nova exige mockup aprovado antes do código.

**Arquivos:**
- Criar: `src/ui/importar/Importar.tsx`, `ListaConferencia.tsx`, `ItemConferencia.tsx`
- Criar: os testes ao lado de cada um
- Modificar: `src/styles.css` (só se o mockup pedir classe nova)

- [ ] **Passo 1: Ler o guia antes de desenhar**

Ler `docs/estilo-visual.md` e seguir o índice até `docs/estilo/nivel-5-nova-tela.md`. A regra
do formulário antes da lista vem de lá.

- [ ] **Passo 2: Produzir o mockup e esperar aprovação**

Um HTML único, com `<meta charset="utf-8">` na primeira linha. Mostrar os três passos e, na
lista, um exemplo de cada um dos seis estados, com a ação padrão visível. Só depois do "está
aprovado" é que o código de UI começa.

- [ ] **Passo 3 em diante**

Os passos de implementação da tela dependem do mockup aprovado e são detalhados quando ele
existir. O comportamento que a tela precisa entregar já está fechado, na seção "Interface" da
spec:

1. seletor de arquivo, com o adapter detectado por escrito e opção de trocar;
2. seletor de destino — box e banco para conta, `Cartao` por bloco para fatura, com "não
   importar este bloco" como resposta válida;
3. lista agrupada por estado, com resumo no topo (quantos conferem, novos, divergentes,
   sobras, internos, e quantas linhas foram ignoradas), ação padrão trocável por item, e um
   botão que confirma tudo;
4. avisos do adapter no topo da lista, nunca como erro;
5. nada gravado antes do botão de confirmar.

- [ ] **Passo final: Catalogar**

Toda classe nova de `src/styles.css` e todo componente novo de `src/ui/` entram em
`docs/estilo/catalogo.md`. O guard `scripts/verificar-catalogo.mjs --strict` roda no release e
bloqueia o que ficar de fora.

Conferir: `node scripts/verificar-catalogo.mjs`

---

### Tarefa 11: Registro de adapters e entrada em Ajustes

**Arquivos:**
- Criar: `src/importar/adapters/index.ts`
- Testar: `src/importar/adapters/index.test.ts`
- Modificar: `src/ui/TelaAjustes.tsx:18-26` (lista de seções) e `:63-73` (renderização)

**Interfaces:**
- Produz: `ADAPTERS: Adapter[]` e
  `detectarAdapter(nome: string, inicio: string): Adapter | undefined`.

- [ ] **Passo 1: Escrever o teste que falha**

Criar `src/importar/adapters/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectarAdapter } from './index';

describe('detectarAdapter', () => {
  it('reconhece o CSV da conta Nubank pelo cabeçalho', () => {
    const a = detectarAdapter('extrato.csv', 'Data,Valor,Identificador,Descrição\n');
    expect(a?.id).toBe('nubank-conta-csv');
  });

  it('reconhece o PDF pela assinatura %PDF', () => {
    const a = detectarAdapter('fatura.pdf', '%PDF-1.7\n');
    expect(a?.id).toBe('santander-fatura-pdf');
  });

  it('devolve undefined quando nada casa', () => {
    expect(detectarAdapter('notas.txt', 'sei lá')).toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar e confirmar que falha**

Rodar: `npx vitest run src/importar/adapters/index.test.ts`
Esperado: FALHA com "Failed to resolve import './index'".

- [ ] **Passo 3: Implementar**

Criar `src/importar/adapters/index.ts`:

```ts
import type { Adapter } from '../tipos';
import { nubankConta } from './nubankConta';
import { santanderFatura } from './santanderFatura';

/** Ordem importa: o primeiro que reconhecer vence. */
export const ADAPTERS: Adapter[] = [nubankConta, santanderFatura];

/** Reconhece o formato pelo conteúdo, não pelo nome do arquivo: o banco muda o nome do
 *  arquivo conforme o mês e o canal. Nada casou: a tela pede que o usuário escolha. */
export function detectarAdapter(nome: string, inicio: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.detectar(nome, inicio));
}
```

Em `santanderFatura.ts`, acrescentar o `Adapter` exportado:

```ts
export const santanderFatura: Adapter = {
  id: 'santander-fatura-pdf',
  rotulo: 'Santander — fatura do cartão (PDF)',
  detectar: (nome, inicio) =>
    inicio.startsWith('%PDF') || nome.toLowerCase().endsWith('.pdf'),
  ler: async (conteudo) => {
    const texto = await extrairTextoPdf(conteudo);
    return lerSantanderFatura(texto, mesFaturaDoTexto(texto));
  },
};
```

E, no mesmo arquivo, a dedução do mês da fatura a partir do rótulo `Vencimento`:

```ts
/** Mês de vencimento da fatura, lido do quadro "Vencimento" da página 1. Sem ele não dá para
 *  deduzir o ano das datas "DD/MM". Cai no mês corrente quando o rótulo não aparece. */
export function mesFaturaDoTexto(texto: string): string {
  const m = /Vencimento\s+(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (m) return `${m[3]}-${m[2]}`;
  return new Date().toISOString().slice(0, 7);
}
```

- [ ] **Passo 4: Rodar e confirmar que passa**

Rodar: `npx vitest run src/importar/adapters/index.test.ts`
Esperado: PASSA, 3 testes.

- [ ] **Passo 5: Ligar a seção em `src/ui/TelaAjustes.tsx`**

Na lista de seções, depois de `{ id: 'backup', rotulo: 'Backup e restauração' }`:

```tsx
{ id: 'importar', rotulo: 'Importar e conferir' },
```

E na renderização, junto das outras:

```tsx
{secao === 'importar' && <Importar />}
```

Acrescentar o import no topo, e `'importar'` ao tipo `SecaoAjustes`.

- [ ] **Passo 6: Rodar a suíte inteira**

Rodar: `npm test`
Esperado: tudo verde.

- [ ] **Passo 7: Commitar**

```bash
git add src/importar/adapters/ src/ui/TelaAjustes.tsx
git commit -m "feat(importar): registro de adapters e entrada em Ajustes"
```

---

### Tarefa 12: Wiki, changelog e fechamento

**Arquivos:**
- Criar: `docs/wiki/<capítulo>.md` ou modificar o capítulo existente que fale de entrada de dados
- Criar: `changelog.d/adicionado-conferencia-por-extrato.md`

- [ ] **Passo 1: Atualizar a wiki**

A feature muda o que o usuário vê, então a wiki muda no mesmo branch. Explicar: o que é a
conferência, de onde tirar os arquivos no Nubank e no Santander, o que significa cada um dos
seis estados, e por que a aplicação da caixinha pergunta.

O parser da wiki aceita só um subconjunto fechado de markdown e **lança exceção** fora dele.
Ler `docs/wiki/README.md` antes de escrever.

- [ ] **Passo 2: Validar a wiki**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA. Exceção aqui quer dizer markdown fora do subconjunto aceito.

- [ ] **Passo 3: Escrever o fragmento de changelog**

Criar `changelog.d/adicionado-conferencia-por-extrato.md`, no formato de
`changelog.d/README.md` — tópico e, se precisar, detalhe indentado. Sem negrito, sem
aninhamento além de dois níveis, e sem nenhum valor real.

- [ ] **Passo 4: Rodar os guards que o release vai rodar**

```bash
node scripts/verificar-dados-reais.mjs
node scripts/verificar-catalogo.mjs
npm test
npm run build
```

Esperado: os dois verificadores sem achado, suíte verde, build sem erro.

- [ ] **Passo 5: Levar o changelog ao usuário**

O ciclo de entrega para aqui e espera a confirmação literal da revisão do changelog. Só depois
vêm o merge na `main`, o `npm run release` e o `npm run deploy`.

Invocar a skill `ciclo-de-entrega` para conduzir o fechamento.

---

## Autorrevisão

**Cobertura da spec.** Cada seção da spec tem tarefa: formatos (4, 6), tipos (1), seis estados
(7), movimento interno (3, 7), pagamento da fatura (7), parcelas (5, 6), estorno (7),
casamento (7), cartão (7, 8), valores e datas (1, 2), gravação (8), interface (10), erros (1,
4, 6), testes (todas), pdf.js (9), riscos (6, 7).

**Consistência de tipos.** `LancamentoBruto`, `LeituraAdapter`, `ItemConferencia`, `AcaoItem` e
`CompraReconstruida` nascem na tarefa 1. A tarefa 6 acrescenta `BlocoCartao` e o campo
`blocos` a `LeituraAdapter`, e isso está escrito como passo explícito.
`salvarComprasCartaoEmLote` tem o mesmo nome na tarefa 8 e no `aplicar.ts`.

**Pontos que param e esperam o usuário:** tarefa 9 (pdf.js), tarefa 10 (mockup), tarefa 12
passo 5 (changelog).
