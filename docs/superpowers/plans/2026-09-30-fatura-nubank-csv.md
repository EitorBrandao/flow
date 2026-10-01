# Fatura do cartão Nubank em CSV — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a tela Importar e conferir lê o CSV da fatura do cartão Nubank, estima a data das parcelas antigas e deixa o usuário corrigir essa data antes de confirmar.

**Arquitetura:** um leitor novo (`nubankFatura.ts`) produz `LancamentoBruto` com `dataEstimada` nas parcelas n > 1. A conferência casa essas parcelas numa janela de ciclo. A UI troca "Corrigir total" por "Corrigir compra", com um campo de data limitado ao ciclo. A data corrigida mora no store, como o total corrigido, e substitui `compraReconstruida.data` na confirmação.

**Tecnologia:** React 18, TypeScript, Zustand, Vitest + Testing Library (jsdom, fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-09-30-fatura-nubank-csv-design.md`.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\fatura-nubank-csv`. Não toque no checkout principal (`C:\Users\eitor\Claude\ProjetoFinancas`).
- Todo texto de UI, comentário e mensagem de commit em português.
- Só dados sintéticos em testes. Nenhum valor ou nome real.
- Nenhuma dependência nova. Não mude `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.claude/`.
- Nenhuma classe CSS nova. Não mexa em `src/styles.css`.
- Regex e strings de código sem caractere não-ASCII colado: use escape (`\u00e9`), como o leitor do Santander faz.
- Arquivos em UTF-8 sem BOM.
- Antes de dizer que terminou: `npm test` completo verde. O teste `TelaFluxo.test.tsx` é instável na suíte cheia (timeout no diálogo do gráfico); se só ele falhar, rode-o isolado e relate.
- Não edite `docs/dossie/`, `docs/estilo/catalogo.md`, `docs/wiki/` nem `changelog.d/` (a Tarefa 4 cuida disso). O `dossie.test.ts` pode reprovar antes da Tarefa 4: relate, não regenere.
- Trailer de todo commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0184ZVYL1PYkKu8bWrTHAKG6
  ```

---

### Tarefa 1: Leitor da fatura Nubank (CSV)

**Arquivos:**
- Criar: `src/importar/texto.ts`, `src/importar/texto.test.ts`
- Criar: `src/importar/adapters/nubankFatura.ts`, `src/importar/adapters/nubankFatura.test.ts`
- Modificar: `src/importar/tipos.ts` (campo `dataEstimada`, id do adapter, `DecisaoData`)
- Modificar: `src/importar/adapters/index.ts`, `src/importar/adapters/index.test.ts`

**Interfaces:**
- Produz: `corrigirUtf8Duplo(texto: string): string`
- Produz: `intervaloDaCompra(dataLinha: ISODate, n: number): { min: ISODate; max: ISODate }`
- Produz: `lerNubankFatura(texto: string): LeituraAdapter`, `nubankFatura: Adapter`
- Produz em `tipos.ts`: `LancamentoBruto.dataEstimada?: { min: ISODate; max: ISODate }`; `Adapter['id']` com `'nubank-fatura-csv'`; `interface DecisaoData { estado: EstadoItem; data: ISODate }`

- [ ] **Passo 1: tipos.** Em `src/importar/tipos.ts`:

Em `LancamentoBruto`, depois de `natureza?: NaturezaBruto;`:
```ts
  // Só a fatura do Nubank preenche: parcela n > 1 vem com a data de abertura do ciclo, não a
  // da compra. `data` é então a mínima do intervalo em que a compra pode ter sido feita.
  dataEstimada?: { min: ISODate; max: ISODate };
```
Em `Adapter`:
```ts
  id: 'nubank-conta-csv' | 'nubank-fatura-csv' | 'santander-fatura-pdf';
```
Depois de `DecisaoTotal`:
```ts
/** Mesmo tratamento de `DecisaoTotal`, para a correção da data estimada de uma parcela. */
export interface DecisaoData {
  estado: EstadoItem;
  data: ISODate;
}
```

- [ ] **Passo 2: teste de `corrigirUtf8Duplo`.** Criar `src/importar/texto.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { corrigirUtf8Duplo } from './texto';

describe('corrigirUtf8Duplo', () => {
  it('não muda texto sem o defeito', () => {
    expect(corrigirUtf8Duplo('Pix no Cr\u00e9dito - Loja Gama')).toBe('Pix no Cr\u00e9dito - Loja Gama');
    expect(corrigirUtf8Duplo('Mercado Alfa')).toBe('Mercado Alfa');
  });

  it('corrige o UTF-8 duplo', () => {
    expect(corrigirUtf8Duplo('Pix no Cr\u00c3\u00a9dito')).toBe('Pix no Cr\u00e9dito');
    expect(corrigirUtf8Duplo('Servi\u00c3\u00a7o \u00c3\u00a0 vista')).toBe('Servi\u00e7o \u00e0 vista');
  });

  it('devolve o original quando há caractere acima de U+00FF', () => {
    const t = 'Cr\u00c3\u00a9dito \u2014 Loja';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });

  it('devolve o original quando os bytes não formam UTF-8 válido', () => {
    // "\u00c3" seguido de "\u0080" e depois "\u00c3" sozinho no fim: o segundo é sequência truncada.
    const t = '\u00c3\u0080 e \u00c3';
    expect(corrigirUtf8Duplo(t)).toBe(t);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar.** `npx vitest run src/importar/texto.test.ts` → FALHA, "Failed to resolve import './texto'".

- [ ] **Passo 4: implementar.** Criar `src/importar/texto.ts`:
```ts
/** Sinal de UTF-8 decodificado duas vezes: "Ã" ou "Â" seguidos de um caractere de
 *  continuação (U+0080 a U+00BF). É como "é" vira "Ã©". */
const UTF8_DUPLO = /[\u00c2\u00c3][\u0080-\u00bf]/;

/**
 * Desfaz o UTF-8 duplo: cada caractere vira um byte, e os bytes são lidos de novo como UTF-8.
 * O CSV da fatura do Nubank chegou assim duas vezes, e a origem do defeito é incerta.
 *
 * Nunca lança. Texto sem o sinal, com caractere acima de U+00FF (não pode ter vindo de bytes)
 * ou com bytes que não formam UTF-8 válido volta sem mudança.
 */
export function corrigirUtf8Duplo(texto: string): string {
  if (!UTF8_DUPLO.test(texto)) return texto;
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c > 0xff) return texto;
    bytes[i] = c;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return texto;
  }
}
```

- [ ] **Passo 5: rodar e ver passar.** `npx vitest run src/importar/texto.test.ts` → PASSA.

- [ ] **Passo 6: teste do leitor.** Criar `src/importar/adapters/nubankFatura.test.ts`. Valores recalculados à mão (ver comentários).
```ts
import { describe, expect, it } from 'vitest';
import { intervaloDaCompra, lerNubankFatura, nubankFatura } from './nubankFatura';

const CAB = 'date,title,amount';

function ler(...linhas: string[]) {
  return lerNubankFatura([CAB, ...linhas].join('\n'));
}

describe('nubankFatura.detectar', () => {
  it('reconhece o cabeçalho, com BOM, espaços e maiúsculas', () => {
    expect(nubankFatura.detectar('x.csv', CAB)).toBe(true);
    expect(nubankFatura.detectar('x.csv', '\uFEFFDate,Title,Amount  \n2026-08-01,A,"1,00"')).toBe(true);
  });

  it('recusa o extrato da conta e outro CSV', () => {
    expect(nubankFatura.detectar('x.csv', 'Data,Valor,Identificador,Descri\u00e7\u00e3o')).toBe(false);
    expect(nubankFatura.detectar('x.csv', 'date,title,amount,extra')).toBe(false);
    expect(nubankFatura.detectar('x.pdf', '%PDF-1.4')).toBe(false);
  });
});

describe('intervaloDaCompra', () => {
  it('3/10 com a linha em 30/07: compra entre 30/05 e 29/06', () => {
    expect(intervaloDaCompra('2026-07-30', 3)).toEqual({ min: '2026-05-30', max: '2026-06-29' });
  });
  it('2/4 com a linha em 30/08: compra entre 30/07 e 29/08', () => {
    expect(intervaloDaCompra('2026-08-30', 2)).toEqual({ min: '2026-07-30', max: '2026-08-29' });
  });
  it('2/2 com a linha em 31/03: a mínima cai no fim de fevereiro', () => {
    // 31/03 − 1 mês → 28/02 (2026 não é bissexto); máxima = 31/03 − 1 dia = 30/03.
    expect(intervaloDaCompra('2026-03-31', 2)).toEqual({ min: '2026-02-28', max: '2026-03-30' });
  });
  it('vira o ano: 3/6 com a linha em 15/01/2027', () => {
    // mínima = 15/01/2027 − 2 meses = 15/11/2026; máxima = 15/12/2026 − 1 dia = 14/12/2026.
    expect(intervaloDaCompra('2027-01-15', 3)).toEqual({ min: '2026-11-15', max: '2026-12-14' });
  });
});

describe('lerNubankFatura', () => {
  it('compra à vista: sinal invertido, sem parcela e sem natureza', () => {
    const r = ler('2026-08-18,Mercado Alfa,"50,00"');
    expect(r.brutos).toEqual([
      { data: '2026-08-18', valorCent: -5000, descricao: 'Mercado Alfa', fonte: 'cartao' },
    ]);
    expect(r.linhasIgnoradas).toBe(0);
  });

  it('lê valor com milhar e negativo com espaço depois do sinal', () => {
    const r = ler('2026-08-04,Pagamento recebido,"- 1.234,56"');
    expect(r.brutos[0].valorCent).toBe(123456);
    expect(r.brutos[0].natureza).toBe('pagamentoFatura');
  });

  it('parcela 1/N: data real, sem data estimada', () => {
    const r = ler('2026-08-01,Loja Gama - Parcela 1/4,"100,03"');
    expect(r.brutos[0]).toEqual({
      data: '2026-08-01', valorCent: -10003, descricao: 'Loja Gama', fonte: 'cartao',
      parcela: { n: 1, total: 4 },
    });
  });

  it('parcela n > 1: data estimada e intervalo', () => {
    const r = ler('2026-07-30,Loja Delta - Parcela 3/10,"40,00"');
    expect(r.brutos[0]).toEqual({
      data: '2026-05-30', valorCent: -4000, descricao: 'Loja Delta', fonte: 'cartao',
      parcela: { n: 3, total: 10 },
      dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
    });
  });

  it('parcela no formato do Pix no Crédito ("- 2/5")', () => {
    const r = ler('2026-07-30,Pix no Cr\u00e9dito - Fulano de Tal - 2/5,"35,00"');
    expect(r.brutos[0].descricao).toBe('Pix no Cr\u00e9dito - Fulano de Tal');
    expect(r.brutos[0].parcela).toEqual({ n: 2, total: 5 });
    expect(r.brutos[0].dataEstimada).toEqual({ min: '2026-06-30', max: '2026-07-29' });
  });

  it('numeração de parcela impossível fica na descrição e vira compra à vista', () => {
    const r = ler('2026-08-10,Loja Beta - 0/3,"10,00"', '2026-08-11,Loja Beta - Parcela 5/3,"10,00"');
    expect(r.brutos[0]).toEqual({ data: '2026-08-10', valorCent: -1000, descricao: 'Loja Beta - 0/3', fonte: 'cartao' });
    expect(r.brutos[1].descricao).toBe('Loja Beta - Parcela 5/3');
    expect(r.brutos[1].parcela).toBeUndefined();
  });

  it('crédito de compra: estorno, com a descrição só o nome da loja', () => {
    const r = ler('2026-09-18,"Cr\u00e9dito de ""Loja Gama""","- 20,00"');
    expect(r.brutos[0]).toEqual({
      data: '2026-09-18', valorCent: 2000, descricao: 'Loja Gama', fonte: 'cartao',
      natureza: 'estornoCartao',
    });
  });

  it('outro valor negativo é estorno; IOF positivo é gasto comum', () => {
    const r = ler('2026-08-12,Ajuste a cr\u00e9dito,"- 5,00"', '2026-08-12,IOF de compra internacional,"1,10"');
    expect(r.brutos[0].natureza).toBe('estornoCartao');
    expect(r.brutos[1].natureza).toBeUndefined();
    expect(r.brutos[1].valorCent).toBe(-110);
  });

  it('corrige acentos em UTF-8 duplo', async () => {
    const texto = [CAB, '2026-07-30,Pix no Cr\u00c3\u00a9dito - Fulano - 2/2,"10,00"'].join('\n');
    const bytes = new TextEncoder().encode(texto);
    const r = await nubankFatura.ler(bytes.buffer);
    expect(r.brutos[0].descricao).toBe('Pix no Cr\u00e9dito - Fulano');
  });

  it('linha ilegível vai para as não reconhecidas', () => {
    const r = ler('2026-13-01,Loja X,"1,00"', '2026-08-01,Loja Y,abc', '2026-08-01,,"1,00"', '2026-08-02,Loja Z,"2,00"');
    expect(r.linhasIgnoradas).toBe(3);
    expect(r.linhasNaoReconhecidas).toHaveLength(3);
    expect(r.brutos).toHaveLength(1);
  });

  it('um bloco só, sem total declarado, com todos os brutos', () => {
    const r = ler('2026-08-18,Mercado Alfa,"50,00"', '2026-08-04,Pagamento recebido,"- 50,00"');
    expect(r.blocos).toEqual([{ rotulo: 'Fatura Nubank', brutos: r.brutos }]);
  });

  it('ler() devolve o texto extraído, já corrigido', async () => {
    const texto = [CAB, '2026-08-18,Mercado Alfa,"50,00"'].join('\n');
    const r = await nubankFatura.ler(new TextEncoder().encode(texto).buffer);
    expect(r.textoExtraido).toBe(texto);
  });

  it('sem cabeçalho reconhecido, não lê nada', () => {
    const r = lerNubankFatura('Data,Valor\n01/08/2026,10.00');
    expect(r.brutos).toEqual([]);
    expect(r.linhasIgnoradas).toBe(0);
  });
});
```

- [ ] **Passo 7: rodar e ver falhar.** `npx vitest run src/importar/adapters/nubankFatura.test.ts` → FALHA, import não resolvido.

- [ ] **Passo 8: implementar.** Criar `src/importar/adapters/nubankFatura.ts`:
```ts
import { addDias, addMesesData } from '../../domain/dates';
import type { ISODate } from '../../domain/types';
import { lerCsv } from '../csv';
import { corrigirUtf8Duplo } from '../texto';
import type { Adapter, LancamentoBruto, LeituraAdapter, NaturezaBruto } from '../tipos';
import { parsearDataExtrato, parsearValorExtrato } from '../valores';

const CABECALHO = 'date,title,amount';

/** Parcela no fim do título: " - Parcela 3/10" nas compras, " - 3/10" no Pix no Crédito. */
const PARCELA = /\s+-\s+(?:Parcela\s+)?(\d{1,2})\/(\d{1,2})$/i;

/** Crédito de uma compra: `Crédito de "<loja>"`. "é" com escape. */
const CREDITO_DE = /^Cr(?:\u00e9|e)dito de "(.+)"$/i;

function ehCabecalho(linha: string): boolean {
  return linha.replace(/^\uFEFF/, '').trim().toLowerCase() === CABECALHO;
}

/**
 * Intervalo em que a compra de uma parcela n > 1 pode ter sido feita.
 *
 * A parcela n > 1 vem com a data de abertura do ciclo atual. A parcela 1 caiu no ciclo que
 * abriu `n − 1` meses antes; a compra foi feita dentro desse ciclo, que termina um dia antes
 * do ciclo seguinte abrir. Confirmado com dois arquivos reais: a parcela 1/4 trouxe a data
 * real da compra, e a 2/4, na fatura seguinte, deu um intervalo que contém essa data.
 */
export function intervaloDaCompra(dataLinha: ISODate, n: number): { min: ISODate; max: ISODate } {
  return {
    min: addMesesData(dataLinha, -(n - 1)),
    max: addDias(addMesesData(dataLinha, -(n - 2)), -1),
  };
}

function naturezaDe(descricao: string, valorArquivoCent: number): NaturezaBruto | undefined {
  if (valorArquivoCent >= 0) return undefined;
  return /^pagamento recebido$/i.test(descricao) ? 'pagamentoFatura' : 'estornoCartao';
}

/**
 * Fatura do cartão Nubank, em CSV (`date,title,amount`). O valor vem no formato brasileiro,
 * com compra positiva — o oposto da convenção do `LancamentoBruto`, então o sinal é invertido,
 * como no leitor do Santander.
 *
 * O CSV não separa titular de cartão virtual nem traz o total da fatura: tudo cai num bloco só,
 * sem `totalDeclaradoCent`.
 */
export function lerNubankFatura(texto: string): LeituraAdapter {
  const linhas = lerCsv(texto);
  const brutos: LancamentoBruto[] = [];
  const linhasNaoReconhecidas: string[] = [];
  let linhasIgnoradas = 0;

  if (linhas.length === 0 || !ehCabecalho(linhas[0].join(','))) {
    return { brutos, linhasIgnoradas, avisos: [], blocos: [] };
  }

  for (const colunas of linhas.slice(1)) {
    const data = parsearDataExtrato(colunas[0] ?? '');
    const titulo = (colunas[1] ?? '').trim();
    const valorArquivo = parsearValorExtrato(colunas[2] ?? '');
    if (data == null || valorArquivo == null || titulo === '') {
      linhasIgnoradas++;
      linhasNaoReconhecidas.push(colunas.join(','));
      continue;
    }

    let descricao = titulo;
    let parcela: { n: number; total: number } | undefined;
    const m = PARCELA.exec(titulo);
    if (m) {
      const n = Number(m[1]);
      const total = Number(m[2]);
      // Numeração impossível: o trecho fica na descrição, e a linha vale como compra à vista.
      if (n >= 1 && n <= total) {
        parcela = { n, total };
        descricao = titulo.slice(0, m.index).trim();
      }
    }
    const credito = CREDITO_DE.exec(descricao);
    if (credito) descricao = credito[1].trim();

    const natureza = naturezaDe(titulo, valorArquivo);
    const dataEstimada = parcela && parcela.n > 1 ? intervaloDaCompra(data, parcela.n) : undefined;
    brutos.push({
      data: dataEstimada ? dataEstimada.min : data,
      valorCent: -valorArquivo,
      descricao,
      fonte: 'cartao',
      ...(parcela ? { parcela } : {}),
      ...(natureza ? { natureza } : {}),
      ...(dataEstimada ? { dataEstimada } : {}),
    });
  }

  return {
    brutos, linhasIgnoradas, avisos: [], linhasNaoReconhecidas,
    blocos: [{ rotulo: 'Fatura Nubank', brutos }],
  };
}

export const nubankFatura: Adapter = {
  id: 'nubank-fatura-csv',
  rotulo: 'Nubank \u2014 fatura do cart\u00e3o (CSV)',
  detectar: (_nome, inicio) => ehCabecalho(inicio.split('\n')[0] ?? ''),
  ler: async (conteudo) => {
    const texto = corrigirUtf8Duplo(new TextDecoder('utf-8').decode(conteudo));
    // Só para diagnóstico: deixa o usuário copiar o texto lido quando algo não é reconhecido.
    return { ...lerNubankFatura(texto), textoExtraido: texto };
  },
};
```
Atenção: `-valorArquivo` de `0` dá `-0`. Não há valor zero na fatura real; se um teste comparar `valorCent` de zero, use `toBe(0)` com `Object.is` em mente. Nenhum teste deste plano usa zero.

- [ ] **Passo 9: rodar e ver passar.** `npx vitest run src/importar/adapters/nubankFatura.test.ts src/importar/texto.test.ts` → PASSA.

- [ ] **Passo 10: registro.** Em `src/importar/adapters/index.ts`, importar `nubankFatura` e registrar. Atualizar o comentário:
```ts
import type { Adapter } from '../tipos';
import { nubankConta } from './nubankConta';
import { nubankFatura } from './nubankFatura';
import { santanderFatura } from './santanderFatura';

/** Registro dos adapters conhecidos. A entrega 3 acrescenta o OFX genérico — ver
 *  `docs/superpowers/specs/2026-09-17-conferencia-por-extrato-design.md`. A fatura do Nubank
 *  veio antes, em `2026-09-30-fatura-nubank-csv-design.md`. */
export const ADAPTERS: Adapter[] = [nubankConta, nubankFatura, santanderFatura];
```
Em `src/importar/adapters/index.test.ts`, acrescentar dentro do `describe` existente:
```ts
  it('reconhece o CSV da fatura do Nubank pelo cabeçalho', () => {
    expect(detectarAdapter('Nubank_2026-09-06.csv', 'date,title,amount\n2026-08-01,A,"1,00"')?.id)
      .toBe('nubank-fatura-csv');
  });
```

- [ ] **Passo 11: suíte e commit.** `npm test` → verde (salvo as ressalvas das restrições globais). Depois:
```bash
git add src/importar/texto.ts src/importar/texto.test.ts src/importar/tipos.ts src/importar/adapters/
git commit -m "feat(importar): lê o CSV da fatura do cartão Nubank" -m "<trailer>"
```

---

### Tarefa 2: Casamento e validação da data estimada

**Arquivos:**
- Modificar: `src/importar/conferencia.ts` (`candidatoDeParcelaCompativel`, `conferir`, novas `dataEfetiva` e `dataCorrigidaValida`)
- Teste: `src/importar/conferencia.test.ts`

**Interfaces:**
- Consome: `LancamentoBruto.dataEstimada`, `DecisaoData` (Tarefa 1)
- Produz: `dataEfetiva(item: ItemConferencia, decisao: DecisaoData | undefined): ISODate | undefined`
- Produz: `dataCorrigidaValida(item: ItemConferencia, data: ISODate | undefined): ISODate | undefined`

- [ ] **Passo 1: testes.** Em `src/importar/conferencia.test.ts`, acrescentar `dataCorrigidaValida, dataEfetiva` ao import de `./conferencia`. Dentro de `describe('casamento de compra parcelada', ...)`, acrescentar:
```ts
    // Parcela n > 1 do Nubank: a data do bruto é estimada; a compra real está em algum ponto do
    // intervalo. Compra cadastrada: 100000 em 10 → parcela 3 vale 10000.
    const ESTIMADA = { min: '2026-05-30', max: '2026-06-29' };
    function brutoEstimado() {
      return bruto({
        data: '2026-05-30', valorCent: -10000, fonte: 'cartao',
        parcela: { n: 3, total: 10 }, dataEstimada: ESTIMADA,
      });
    }

    it('parcela com data estimada casa com compra no meio do intervalo', () => {
      const d = dadosCom([], [compraCartao({ id: 'meio', data: '2026-06-20', valorTotal: 100000, parcelas: 10 })]);
      const itens = conferir([brutoEstimado()], d, OPCOES);
      expect(itens[0].estado).toBe('confere');
      expect(itens[0].compraCartaoId).toBe('meio');
    });

    it('parcela com data estimada casa na folga de 2 dias depois da máxima', () => {
      const d = dadosCom([], [compraCartao({ id: 'folga', data: '2026-07-01', valorTotal: 100000, parcelas: 10 })]);
      expect(conferir([brutoEstimado()], d, OPCOES)[0].estado).toBe('confere');
    });

    it('parcela com data estimada não casa 3 dias depois da máxima', () => {
      const d = dadosCom([], [compraCartao({ id: 'fora', data: '2026-07-02', valorTotal: 100000, parcelas: 10 })]);
      expect(conferir([brutoEstimado()], d, OPCOES)[0].estado).toBe('novo');
    });

    it('parcela com data estimada não casa 3 dias antes da mínima', () => {
      const d = dadosCom([], [compraCartao({ id: 'antes', data: '2026-05-27', valorTotal: 100000, parcelas: 10 })]);
      expect(conferir([brutoEstimado()], d, OPCOES)[0].estado).toBe('novo');
    });

    it('sem data estimada, a tolerância continua 3 dias (Santander)', () => {
      const d = dadosCom([], [compraCartao({ id: 'x', data: '2026-06-20', valorTotal: 100000, parcelas: 10 })]);
      const b = bruto({ data: '2026-05-30', valorCent: -10000, fonte: 'cartao', parcela: { n: 3, total: 10 } });
      expect(conferir([b], d, OPCOES)[0].estado).toBe('novo');
    });

    it('novo com data estimada: a compra reconstruída usa a data estimada', () => {
      const itens = conferir([brutoEstimado()], dadosCom([]), OPCOES);
      expect(itens[0].estado).toBe('novo');
      expect(itens[0].compraReconstruida?.data).toBe('2026-05-30');
    });
```
No fim do arquivo, acrescentar:
```ts
describe('dataEfetiva e dataCorrigidaValida', () => {
  const item: ItemConferencia = {
    estado: 'novo',
    bruto: {
      data: '2026-05-30', valorCent: -10000, descricao: 'LOJA DELTA', fonte: 'cartao',
      parcela: { n: 3, total: 10 }, dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
    },
    acao: { tipo: 'adicionarCompra', categoriaCartaoId: CAT_CARTAO },
  };

  it('dataEfetiva só vale para o mesmo estado', () => {
    expect(dataEfetiva(item, { estado: 'novo', data: '2026-06-10' })).toBe('2026-06-10');
    expect(dataEfetiva(item, { estado: 'confere', data: '2026-06-10' })).toBeUndefined();
    expect(dataEfetiva(item, undefined)).toBeUndefined();
  });

  it('dataCorrigidaValida aceita as pontas e recusa fora do intervalo', () => {
    expect(dataCorrigidaValida(item, '2026-05-30')).toBe('2026-05-30');
    expect(dataCorrigidaValida(item, '2026-06-29')).toBe('2026-06-29');
    expect(dataCorrigidaValida(item, '2026-05-29')).toBeUndefined();
    expect(dataCorrigidaValida(item, '2026-06-30')).toBeUndefined();
    expect(dataCorrigidaValida(item, undefined)).toBeUndefined();
  });

  it('dataCorrigidaValida recusa item sem data estimada', () => {
    const semEstimada: ItemConferencia = { ...item, bruto: { ...item.bruto!, dataEstimada: undefined } };
    expect(dataCorrigidaValida(semEstimada, '2026-06-10')).toBeUndefined();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run src/importar/conferencia.test.ts` → FALHA: os testes de intervalo viram `novo`, e `dataEfetiva`/`dataCorrigidaValida` não existem.

- [ ] **Passo 3: implementar.** Em `src/importar/conferencia.ts`:

Import: `import { addDias, diasEntre } from '../domain/dates';` e acrescentar `DecisaoData` ao import de `./tipos`.

Logo antes de `candidatoDeParcelaCompativel`, acrescentar:
```ts
/** Folga, em dias, nas duas pontas do intervalo de uma data estimada. Cobre um fechamento de
 *  fatura que mude de dia num mês curto. A tela não usa esta folga: o calendário fica no
 *  intervalo exato. */
const FOLGA_INTERVALO_DIAS = 2;
```
Trocar a assinatura e o filtro de data de `candidatoDeParcelaCompativel` (manter o comentário acima dela e acrescentar ao fim do comentário: "Com `dataEstimada` (fatura do Nubank), a data do bruto é só a mínima do intervalo da compra: o critério de data passa a ser estar dentro do intervalo, com `FOLGA_INTERVALO_DIAS` de folga."):
```ts
function candidatoDeParcelaCompativel(
  candidatos: Candidato[], b: LancamentoBruto, tolerancia: number, usados: Set<ID>,
): Candidato | undefined {
  const parcela = b.parcela!;
  const valorBrutoAbsCent = Math.abs(b.valorCent);
  const est = b.dataEstimada;
  const dataCompativel = est
    ? (c: Candidato) => c.data >= addDias(est.min, -FOLGA_INTERVALO_DIAS)
        && c.data <= addDias(est.max, FOLGA_INTERVALO_DIAS)
    : (c: Candidato) => diferencaEmDias(c.data, b.data) <= tolerancia;
  return candidatos
    .filter((c) => !usados.has(c.id)
      && c.parcelas === parcela.total
      && dataCompativel(c)
      && Math.abs(valorParcela(c.valorCent, c.parcelas as number, parcela.n) - valorBrutoAbsCent)
        <= (c.parcelas as number) - 1)
    .sort((x, y) => diferencaEmDias(x.data, b.data) - diferencaEmDias(y.data, b.data))[0];
}
```
Em `conferir`, a chamada vira:
```ts
      const candidato = candidatoDeParcelaCompativel(doCartao, b, tolerancia, usados);
```
Depois de `totalCorrigidoValido`, no fim do arquivo:
```ts
/** Mesmo critério de `acaoEfetiva`, para a data corrigida de uma parcela com data estimada. */
export function dataEfetiva(item: ItemConferencia, decisao: DecisaoData | undefined): ISODate | undefined {
  return decisao && decisao.estado === item.estado ? decisao.data : undefined;
}

/** A data corrigida só vale para item com data estimada, e dentro do intervalo exato — sem a
 *  folga do casamento. Fora disso, `aplicar` grava a data estimada. */
export function dataCorrigidaValida(
  item: ItemConferencia, data: ISODate | undefined,
): ISODate | undefined {
  const est = item.bruto?.dataEstimada;
  if (data == null || est == null) return undefined;
  return data >= est.min && data <= est.max ? data : undefined;
}
```
Confirme que `ISODate` já está importado em `conferencia.ts` (está, via `../domain/types`); se não, importe.

- [ ] **Passo 4: rodar e ver passar.** `npx vitest run src/importar/conferencia.test.ts` → PASSA (inclusive os testes antigos de parcela).

- [ ] **Passo 5: suíte e commit.** `npm test` → verde. Depois:
```bash
git add src/importar/conferencia.ts src/importar/conferencia.test.ts
git commit -m "feat(conferencia): casa parcela de data estimada no intervalo da compra" -m "<trailer>"
```

---

### Tarefa 3: Tela — "Corrigir compra" com a data estimada

**Antes de começar:** leia `docs/estilo-visual.md` e `docs/estilo/nivel-1-editar-tela.md`. Esta tarefa é nível 1: nenhuma classe nova.

**Arquivos:**
- Modificar: `src/state/store.ts` (`ImportacaoPendente.datasCorrigidas`, `IMPORTACAO_VAZIA`)
- Modificar: `src/ui/ajustes/LinhaConferencia.tsx`, `src/ui/ajustes/LinhaConferencia.test.tsx`
- Modificar: `src/ui/ajustes/ListaConferencia.tsx`, `src/ui/ajustes/ListaConferencia.test.tsx`
- Modificar: `src/ui/ajustes/Importar.tsx`, `src/ui/ajustes/Importar.test.tsx`

**Interfaces:**
- Consome: `dataEfetiva`, `dataCorrigidaValida`, `totalEfetivo`, `acaoEfetiva` (`conferencia.ts`); `DecisaoData` (`tipos.ts`); `CampoData` (`src/ui/CampoData.tsx`, props `id, value, onChange, min, max`)
- Produz: `LinhaConferencia` com props novas `dataCorrigida?: ISODate` e `onCorrigirData?: (data: ISODate | undefined) => void`; `ListaConferencia` com props novas `datasCorrigidas: Record<string, DecisaoData>` e `onCorrigirData: (chave: string, estado: EstadoItem, data: ISODate | undefined) => void`

- [ ] **Passo 1: store.** Em `src/state/store.ts`, importar `DecisaoData` junto de `DecisaoTotal`. Em `ImportacaoPendente`, depois de `totaisCorrigidos`:
```ts
  datasCorrigidas: Record<string, DecisaoData>;
```
Em `IMPORTACAO_VAZIA`, acrescentar `datasCorrigidas: {},` depois de `totaisCorrigidos: {},`.

- [ ] **Passo 2: testes da linha.** Em `src/ui/ajustes/LinhaConferencia.test.tsx`:

(a) No teste existente `'novo com compra reconstruída: mostra Corrigir total, que abre um campo de valor'`, trocar o nome do teste para `'novo com compra reconstruída: mostra Corrigir compra, que abre um campo de valor'` e o botão clicado para `{ name: 'Corrigir compra' }`. Acrescentar nesse teste, depois do clique: `expect(screen.queryByLabelText('Data da compra')).not.toBeInTheDocument();` (o Santander não tem data estimada). Faça o mesmo troca de rótulo em qualquer outro uso de `'Corrigir total'` no arquivo (`grep -n "Corrigir total"`).

(b) Mudar `renderLinha` para aceitar a data corrigida:
```tsx
function renderLinha(item: ItemConferencia, dados: Dados = dadosVazios(), dataCorrigida?: string) {
  const onTrocarAcao = vi.fn();
  const onCorrigirTotal = vi.fn();
  const onCorrigirData = vi.fn();
  render(
    <LinhaConferencia
      item={item} dados={dados} acaoAtual={item.acao}
      onTrocarAcao={onTrocarAcao} onCorrigirTotal={onCorrigirTotal}
      dataCorrigida={dataCorrigida} onCorrigirData={onCorrigirData}
    />,
  );
  return { onTrocarAcao, onCorrigirTotal, onCorrigirData };
}
```
(c) Acrescentar no `describe`:
```tsx
  const ITEM_ESTIMADO: ItemConferencia = {
    estado: 'novo',
    bruto: {
      data: '2026-05-30', valorCent: -4000, descricao: 'Loja Delta', fonte: 'cartao',
      parcela: { n: 3, total: 10 }, dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
    },
    compraReconstruida: { data: '2026-05-30', valorTotalCent: 40000, parcelas: 10, anoDeduzidoComAviso: false },
    acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cc-1' },
  };

  it('data estimada: a linha marca "(estimada)"', () => {
    renderLinha(ITEM_ESTIMADO);
    expect(screen.getByText(/30\/05\/2026 \(estimada\)/)).toBeInTheDocument();
  });

  it('data estimada: Corrigir compra mostra o campo de data com o intervalo e a dica', async () => {
    renderLinha(ITEM_ESTIMADO);
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    const campo = screen.getByLabelText('Data da compra');
    expect(campo).toHaveAttribute('min', '2026-05-30');
    expect(campo).toHaveAttribute('max', '2026-06-29');
    expect(screen.getByText('Pela parcela, a compra foi entre 30/05/2026 e 29/06/2026. Estimada: 30/05/2026.'))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar para a data estimada' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total da compra')).toBeInTheDocument();
  });

  it('mudar a data chama onCorrigirData; escolher a estimada apaga a correção', async () => {
    const { onCorrigirData } = renderLinha(ITEM_ESTIMADO);
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    fireEvent.change(screen.getByLabelText('Data da compra'), { target: { value: '2026-06-10' } });
    expect(onCorrigirData).toHaveBeenLastCalledWith('2026-06-10');
  });

  it('com data corrigida: some "(estimada)" e aparece "Voltar para a data estimada"', async () => {
    const { onCorrigirData } = renderLinha(ITEM_ESTIMADO, dadosVazios(), '2026-06-10');
    expect(screen.getByText(/10\/06\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/\(estimada\)/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para a data estimada' }));
    expect(onCorrigirData).toHaveBeenLastCalledWith(undefined);
  });

  it('data corrigida fora do intervalo é ignorada: a linha mostra a estimada', () => {
    renderLinha(ITEM_ESTIMADO, dadosVazios(), '2026-07-03');
    expect(screen.getByText(/30\/05\/2026 \(estimada\)/)).toBeInTheDocument();
  });

  it('confere com data estimada mostra a data da compra cadastrada no app', () => {
    const dados = dadosVazios();
    dados.comprasCartao = [{
      id: 'cc', cartaoId: 'k', categoriaCartaoId: 'c', data: '2026-06-12', valorTotal: 40000,
      parcelas: 10, descricao: 'Loja Delta', criadoEm: '', alteradoEm: '',
    } as Dados['comprasCartao'][number]];
    renderLinha({ ...ITEM_ESTIMADO, estado: 'confere', compraCartaoId: 'cc', acao: { tipo: 'ignorar' } }, dados);
    expect(screen.getByText(/12\/06\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/30\/05\/2026/)).not.toBeInTheDocument();
  });
```
Acrescentar `fireEvent` ao import de `@testing-library/react`.

- [ ] **Passo 3: rodar e ver falhar.** `npx vitest run src/ui/ajustes/LinhaConferencia.test.tsx` → FALHA (botão ainda "Corrigir total", sem campo de data).

- [ ] **Passo 4: implementar a linha.** Em `src/ui/ajustes/LinhaConferencia.tsx`:

Imports: acrescentar `dataCorrigidaValida` ao import de `../../importar/conferencia`, e `import CampoData from '../CampoData';`.

Props:
```ts
interface Props {
  item: ItemConferencia;
  dados: Dados;
  acaoAtual: AcaoItem;
  onTrocarAcao: (acao: AcaoItem) => void;
  totalCorrigidoCent?: number;
  onCorrigirTotal: (novoValorCent: number) => void;
  /** Data corrigida pelo usuário para uma parcela com data estimada (fatura do Nubank). */
  dataCorrigida?: ISODate;
  /** `undefined` apaga a correção e volta à data estimada. */
  onCorrigirData?: (data: ISODate | undefined) => void;
}
```
Desestruturar `dataCorrigida, onCorrigirData` no componente. Trocar `const data = dataDoItem(item, dados);` por:
```ts
  const estimada = item.bruto?.dataEstimada;
  const dataCorrigidaOk = dataCorrigidaValida(item, dataCorrigida);
  // Parcela de data estimada que casou: a data que vale é a da compra cadastrada no app.
  const compraDoApp = item.estado === 'confere' && estimada && item.compraCartaoId
    ? dados.comprasCartao.find((c) => c.id === item.compraCartaoId)
    : undefined;
  const data = compraDoApp?.data ?? dataCorrigidaOk ?? dataDoItem(item, dados);
  const marcaEstimada = item.estado === 'novo' && estimada && dataCorrigidaOk == null ? ' (estimada)' : '';
```
Na `etiqueta`, trocar `{' · '}{formatarDataBR(data)}` por `{' · '}{formatarDataBR(data)}{marcaEstimada}`.

Botão: trocar o texto `Corrigir total` por `Corrigir compra`.

Painel: trocar o bloco `{corrigindo && item.compraReconstruida && ( <div className="campo"> ... </div> )}` por:
```tsx
      {corrigindo && item.compraReconstruida && (
        <>
          {estimada && (
            <div className="campo">
              <label htmlFor={`${uid}-data`}>Data da compra</label>
              <CampoData
                id={`${uid}-data`}
                value={dataCorrigidaOk ?? estimada.min}
                min={estimada.min}
                max={estimada.max}
                // Escolher a própria estimada é o mesmo que não corrigir.
                onChange={(v) => { if (v) onCorrigirData?.(v === estimada.min ? undefined : v); }}
              />
              <p className="sub">
                Pela parcela, a compra foi entre {formatarDataBR(estimada.min)} e{' '}
                {formatarDataBR(estimada.max)}. Estimada: {formatarDataBR(estimada.min)}.
              </p>
              {dataCorrigidaOk && (
                <button type="button" className="botao-ver-mais" onClick={() => onCorrigirData?.(undefined)}>
                  Voltar para a data estimada
                </button>
              )}
            </div>
          )}
          <div className="campo">
            <label htmlFor={`${uid}-total`}>Total da compra</label>
            <CampoValor
              id={`${uid}-total`}
              valorCentavos={totalCorrigidoCent ?? item.compraReconstruida.valorTotalCent}
              onChange={onCorrigirTotal}
            />
            {totalCorrigidoCent != null && totalCorrigidoValido(item, totalCorrigidoCent) == null && (
              <p className="sub">O total não pode ser menor que uma parcela.</p>
            )}
          </div>
        </>
      )}
```
Atenção ao texto da dica: o teste espera a frase inteira num só nó de texto. JSX com `{' '}` e expressões gera vários nós de texto dentro do mesmo `<p>`; `getByText` com string compara o `textContent` do elemento, então passa. Se não passar, monte a frase numa constante `const dica = \`Pela parcela, ...\`` e renderize `{dica}`.

- [ ] **Passo 5: rodar e ver passar.** `npx vitest run src/ui/ajustes/LinhaConferencia.test.tsx` → PASSA.

- [ ] **Passo 6: testes da lista.** Em `src/ui/ajustes/ListaConferencia.test.tsx`, veja como o arquivo monta `ListaConferencia` hoje (props e itens) e: (a) acrescente as props novas `datasCorrigidas={{}}` e `onCorrigirData={vi.fn()}` em toda montagem existente (ou no helper de montagem, se houver); (b) acrescente os testes abaixo, adaptando o helper do arquivo para receber `itens`, `trocas` e `datasCorrigidas`:
```tsx
  const ESTIMADO = (chave: string): ItemComContexto => ({
    chave, boxId: 'b', cartaoId: 'k',
    item: {
      estado: 'novo',
      bruto: {
        data: '2026-05-30', valorCent: -4000, descricao: `Loja ${chave}`, fonte: 'cartao',
        parcela: { n: 3, total: 10 }, dataEstimada: { min: '2026-05-30', max: '2026-06-29' },
      },
      compraReconstruida: { data: '2026-05-30', valorTotalCent: 40000, parcelas: 10, anoDeduzidoComAviso: false },
      acao: { tipo: 'adicionarCompra', categoriaCartaoId: 'cc' },
    },
  });
  const AVISO_2 = 'A fatura do Nubank não traz o dia da compra das parcelas antigas. 2 datas estão '
    + 'estimadas: corrija em "Corrigir compra" antes de confirmar, se souber o dia.';
  const AVISO_1 = 'A fatura do Nubank não traz o dia da compra das parcelas antigas. 1 data está '
    + 'estimada: corrija em "Corrigir compra" antes de confirmar, se souber o dia.';

  it('aviso conta as datas estimadas pendentes', () => {
    montar({ itens: [ESTIMADO('a'), ESTIMADO('b')] });
    expect(screen.getByText(AVISO_2)).toBeInTheDocument();
  });

  it('aviso não conta data corrigida nem item ignorado, e some no zero', () => {
    const { rerender } = montar({
      itens: [ESTIMADO('a'), ESTIMADO('b')],
      datasCorrigidas: { a: { estado: 'novo', data: '2026-06-10' } },
    });
    expect(screen.getByText(AVISO_1)).toBeInTheDocument();
    rerender(/* a mesma montagem, com */ {
      itens: [ESTIMADO('a'), ESTIMADO('b')],
      datasCorrigidas: { a: { estado: 'novo', data: '2026-06-10' } },
      trocas: { b: { estado: 'novo', acao: { tipo: 'ignorar' } } },
    });
    expect(screen.queryByText(/datas? est(á|ão) estimadas?/)).not.toBeInTheDocument();
  });
```
O `montar`/`rerender` acima é ilustrativo: use o helper que o arquivo já tem e, para o segundo caso, faça uma segunda montagem num teste próprio se o arquivo não tiver `rerender`. O que precisa ser provado: (1) duas estimadas → `AVISO_2`; (2) uma corrigida → `AVISO_1`; (3) uma corrigida e a outra ignorada → nenhum aviso.

- [ ] **Passo 7: rodar e ver falhar.** `npx vitest run src/ui/ajustes/ListaConferencia.test.tsx` → FALHA (sem aviso).

- [ ] **Passo 8: implementar a lista.** Em `src/ui/ajustes/ListaConferencia.tsx`:

Imports: `acaoEfetiva, dataCorrigidaValida, dataEfetiva, totalEfetivo` de `../../importar/conferencia`; `DecisaoData` de `../../importar/tipos`; `ISODate` de `../../domain/types`.

Props, depois de `onCorrigirTotal`:
```ts
  datasCorrigidas: Record<string, DecisaoData>;
  onCorrigirData: (chave: string, estado: EstadoItem, data: ISODate | undefined) => void;
```
Desestruturar as duas. Depois de `ordenados`:
```ts
  // Parcelas do Nubank com data ainda estimada que vão ser gravadas: o aviso pede ao usuário
  // para corrigir antes de confirmar. Conta a lista inteira, não só os visíveis no filtro.
  const estimadasPendentes = useMemo(() => itens.filter((ic) => ic.item.estado === 'novo'
    && ic.item.bruto?.dataEstimada != null
    && acaoEfetiva(ic.item, trocas[ic.chave]).tipo !== 'ignorar'
    && dataCorrigidaValida(ic.item, dataEfetiva(ic.item, datasCorrigidas[ic.chave])) == null,
  ).length, [itens, trocas, datasCorrigidas]);
```
Logo depois do bloco `{filtro && (<p className="sub">Mostrando só ...</p>)}` e antes de `<div className="lista">`:
```tsx
      {estimadasPendentes > 0 && (
        <p className="sub">
          A fatura do Nubank não traz o dia da compra das parcelas antigas.{' '}
          {estimadasPendentes === 1 ? '1 data está estimada' : `${estimadasPendentes} datas estão estimadas`}:
          corrija em &quot;Corrigir compra&quot; antes de confirmar, se souber o dia.
        </p>
      )}
```
Atenção: o JSX quebra a linha entre `:` e `corrija` — o JSX junta as linhas com um espaço, então o texto fica "estimadas: corrija". Confira com o teste.

Na `LinhaConferencia`, passar:
```tsx
            dataCorrigida={dataEfetiva(ic.item, datasCorrigidas[ic.chave])}
            onCorrigirData={(data) => onCorrigirData(ic.chave, ic.item.estado, data)}
```

- [ ] **Passo 9: rodar e ver passar.** `npx vitest run src/ui/ajustes/ListaConferencia.test.tsx src/ui/ajustes/LinhaConferencia.test.tsx` → PASSA.

- [ ] **Passo 10: teste de ponta a ponta.** Em `src/ui/ajustes/Importar.test.tsx`, acrescentar no fim:
```tsx
describe('fatura do Nubank em CSV', () => {
  const CSV_FATURA_NUBANK = [
    'date,title,amount',
    '2026-08-18,Mercado Alfa,"50,00"',
    '2026-07-30,Loja Delta - Parcela 3/10,"40,00"',
  ].join('\n');

  it('grava a parcela antiga com a data corrigida e o total reconstruído', async () => {
    const box = await montarBox();
    await repo.salvarCartao(
      { boxId: box.id, nome: 'Cartão Nubank', diaFechamento: 29, diaVencimento: 6 }, '2027-12-31',
    );
    await useApp.getState().iniciar();
    useApp.getState().setBoxSel(box.id);
    render(<Importar />);

    await userEvent.upload(
      screen.getByLabelText('Escolher arquivo'),
      new File([CSV_FATURA_NUBANK], 'Nubank_2026-09-06.csv', { type: 'text/csv' }),
    );

    await screen.findByText('Loja Delta');
    expect(screen.getByText(/30\/05\/2026 \(estimada\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir compra' }));
    fireEvent.change(screen.getByLabelText('Data da compra'), { target: { value: '2026-06-10' } });
    expect(screen.queryByText(/\(estimada\)/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Confirmar — 2 mudanças/ }));
    await screen.findByText(/2 adicionados/);

    const dados = await repo.carregarTudo();
    const parcelada = dados.comprasCartao.find((c) => c.parcelas === 10);
    expect(parcelada?.data).toBe('2026-06-10');
    // 4000 por parcela × 10 parcelas = 40000.
    expect(parcelada?.valorTotal).toBe(40000);
  });
});
```
Se o cartão não vier pré-selecionado no passo "Destino" (ver o teste `'o passo 2 só oferece cartões da box selecionada'`), clique no rádio do cartão antes de procurar "Loja Delta". Se o rótulo exato do resumo depois de gravar for outro, use o que o teste `'erro no meio da gravação'` usa (`/1 adicionados/`).

- [ ] **Passo 11: rodar e ver falhar.** `npx vitest run src/ui/ajustes/Importar.test.tsx` → FALHA (a data corrigida não chega à gravação; `datasCorrigidas` não ligado).

- [ ] **Passo 12: ligar em `Importar.tsx`.**

(a) Imports: `dataCorrigidaValida, dataEfetiva` de `../../importar/conferencia`.

(b) Desestruturar `datasCorrigidas` de `importacao`, ao lado de `totaisCorrigidos`.

(c) Em `lerComAdapter`, a linha `setImportacao(() => ({ adapterAtual: adapter, trocas: {}, totaisCorrigidos: {}, filtro: null }));` passa a incluir `datasCorrigidas: {}`.

(d) Em `confirmar`, trocar a montagem de `compraReconstruida` por:
```ts
        const totalCorrigido = totalCorrigidoValido(ic.item, totalEfetivo(ic.item, totaisCorrigidos[ic.chave]));
        const dataCorrigida = dataCorrigidaValida(ic.item, dataEfetiva(ic.item, datasCorrigidas[ic.chave]));
        let compraReconstruida = ic.item.compraReconstruida;
        if (compraReconstruida && totalCorrigido != null) {
          compraReconstruida = { ...compraReconstruida, valorTotalCent: totalCorrigido };
        }
        if (compraReconstruida && dataCorrigida != null) {
          compraReconstruida = { ...compraReconstruida, data: dataCorrigida };
        }
```
e atualizar o comentário acima: "Junta a ação final de cada item (default ou trocada) e, se houve correção do total ou da data estimada de uma parcelada reconstruída, aplica antes de gravar — só quando válida."

(e) Na `<ListaConferencia>`, depois de `onCorrigirTotal`:
```tsx
            datasCorrigidas={datasCorrigidas}
            onCorrigirData={(chave, estado, data) => setImportacao((im) => {
              const novo = { ...im.datasCorrigidas };
              if (data) novo[chave] = { estado, data };
              else delete novo[chave];
              return { datasCorrigidas: novo };
            })}
```

(f) Procure outros pontos que zeram `totaisCorrigidos` (`grep -n "totaisCorrigidos" src/ui/ajustes/Importar.tsx`) e zere `datasCorrigidas` junto em cada um.

- [ ] **Passo 13: rodar e ver passar.** `npx vitest run src/ui/ajustes/` → PASSA.

- [ ] **Passo 14: checagens.** `grep -rn "Corrigir total" src` → nenhum resultado. `npx tsc -b` → sem erro.

- [ ] **Passo 15: suíte e commit.** `npm test` → verde. Depois:
```bash
git add src/state/store.ts src/ui/ajustes/
git commit -m "feat(conferencia): Corrigir compra com data estimada da parcela do Nubank" -m "<trailer>"
```

---

### Tarefa 4: Wiki, changelog, dossiê e verificadores (controlador)

**Arquivos:**
- Modificar: `docs/wiki/7-ajustes.md`
- Criar: `changelog.d/adicionado-fatura-nubank-csv.md`, `changelog.d/alterado-corrigir-compra.md`
- Talvez: `docs/dossie/` (só via `npm run dossie`)

- [ ] **Passo 1: wiki.** Em `docs/wiki/7-ajustes.md`, seção "Importar e conferir":
  - Trocar "Hoje o Flow lê dois arquivos: o extrato da conta Nubank, em CSV, e a fatura do cartão Santander, em PDF." por "Hoje o Flow lê três arquivos: o extrato da conta Nubank e a fatura do cartão Nubank, os dois em CSV, e a fatura do cartão Santander, em PDF."
  - No parágrafo de diagnóstico, trocar "Na fatura em PDF, "Copiar texto extraído" também aparece nesse caso" por "Nas faturas, "Copiar texto extraído" também aparece nesse caso".
  - No parágrafo **Uma compra parcelada**, trocar "Corrigir total" por "Corrigir compra", e acrescentar um parágrafo depois:
    "**A fatura do Nubank não traz o dia da compra das parcelas antigas.** Da segunda parcela em diante, o arquivo traz a data em que o ciclo da fatura abriu. O Flow estima a data da compra pelo número da parcela e marca a linha com "(estimada)". Em "Corrigir compra", o calendário só aceita o ciclo em que a primeira parcela caiu; "Voltar para a data estimada" desfaz a correção. Se a compra já estiver cadastrada no app, a parcela aparece como Confere, com a data do app."
  - Validar: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 2: fragmentos.** `changelog.d/adicionado-fatura-nubank-csv.md`:
```
- Importar e conferir lê a fatura do cartão Nubank em CSV.
  - A data da compra das parcelas antigas é estimada pelo número da parcela, e dá para corrigi-la antes de confirmar.
  - A parcela casa com a compra já cadastrada mesmo sem a data exata.
```
`changelog.d/alterado-corrigir-compra.md`:
```
- Na conferência, "Corrigir total" passou a se chamar "Corrigir compra".
```

- [ ] **Passo 3: dossiê e verificadores.** `npm test`; se `dossie.test.ts` reprovar por dossiê desatualizado, `npm run dossie` e revisar o diff com a skill `revisar-dossie`. Rodar `node scripts/verificar-catalogo.mjs` (deve ficar sem aviso novo) e `node scripts/verificar-dados-reais.mjs` (sem ocorrência). `npm run build` → sem erro.

- [ ] **Passo 4: commit.**
```bash
git add docs/wiki/7-ajustes.md changelog.d/ docs/dossie/
git commit -m "docs: wiki e changelog da fatura do Nubank em CSV" -m "<trailer>"
```

- [ ] **Passo 5: varredura com Playwright** (ciclo de entrega), com um CSV sintético no formato real, no Galaxy S25+, e capturas enviadas ao usuário.
