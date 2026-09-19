// @vitest-environment node
//
// Roda no ambiente `node`, não `jsdom`, porque o mock abaixo precisa de `structuredClone` com
// transferência de buffer (`{ transfer: [...] }") para imitar fielmente o que o pdf.js de
// verdade faz — o jsdom deste projeto não garante essa API.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FATURA_SANTANDER } from '../fixtures/santander-fatura';

/** Um item de texto como o pdf.js real entrega: `hasEOL` marca o fim de uma linha visual da
 *  página. É a marca que `textoPdf.ts` usa para saber onde uma linha termina e a próxima
 *  começa — sem ela, tudo vira uma linha só. */
interface ItemTextoFalso { str: string; hasEOL?: boolean }

/** Itens de cada página que o pdf.js falso devolve. Mutável: cada teste ajusta antes de
 *  importar `extrairTextoPdf`, porque o mock do módulo é montado uma vez para o arquivo
 *  inteiro — `beforeEach` devolve o valor padrão. */
let paginasFalsas: ItemTextoFalso[][] = [[{ str: 'LOJA GAMA' }]];

/** Imita, no essencial, o que `node_modules/pdfjs-dist/build/pdf.mjs` faz com `{ data }`:
 *  - `getDataProp` (linha ~8695) embrulha o `ArrayBuffer` num `Uint8Array` SEM COPIAR — é
 *    uma vista sobre a mesma memória.
 *  - `getDocument` (linha ~15532) TRANSFERE esse buffer pro worker
 *    (`sendWithPromise("GetDocRequest", docParams, data ? [data.buffer] : null)`), o que
 *    esvazia (`detached`) o buffer de origem.
 *  Por isso, um mock que só copiasse os bytes não provaria nada: o defeito está exatamente
 *  nessa transferência, que só aparece copiando o comportamento, não o resultado. */
function getDocument(src: { data?: unknown }) {
  const data = src.data instanceof ArrayBuffer ? new Uint8Array(src.data) : (src.data as Uint8Array | undefined);
  if (data) {
    // Transfere o buffer de origem — esvazia quem chamou, como o worker real faz.
    structuredClone(data, { transfer: [data.buffer] });
  }
  const documentoFalso = {
    numPages: paginasFalsas.length,
    getPage: async (n: number) => ({
      getTextContent: async () => ({ items: paginasFalsas[n - 1] }),
    }),
  };
  return { promise: Promise.resolve(documentoFalso) };
}

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

describe('extrairTextoPdf', () => {
  beforeEach(() => {
    vi.resetModules();
    paginasFalsas = [[{ str: 'LOJA GAMA' }]];
  });

  it('lê o mesmo buffer duas vezes, sem esvaziá-lo', async () => {
    const { extrairTextoPdf } = await import('./textoPdf');

    const bytes = new TextEncoder().encode('conteudo de pdf sintetico para o teste');
    const buf = bytes.buffer.slice(0);
    const tamanhoOriginal = buf.byteLength;

    const primeira = await extrairTextoPdf(buf);
    expect(primeira).toBe('LOJA GAMA');

    // Reproduz `escolherFormatoManualmente`, em `src/ui/ajustes/Importar.tsx`: reusa o mesmo
    // `buf` guardado em estado para uma segunda leitura, com outro adapter.
    const segunda = await extrairTextoPdf(buf);
    expect(segunda).toBe('LOJA GAMA');

    expect(buf.byteLength).toBe(tamanhoOriginal);
  });

  // Teste da costura entre `textoPdf.ts` e `santanderFatura.ts`. O pdf.js real não devolve uma
  // linha por item: cada linha da página sai em vários itens de texto, e só o último de cada
  // linha vem com `hasEOL: true` — a marca de fim de linha do próprio pdf.js. Ele também
  // intercala itens de texto vazio (`str: ''`) com `hasEOL: true`, que não correspondem a
  // nenhuma linha de conteúdo. `lerSantanderFatura` depende de linha por transação, por
  // cabeçalho de cartão e por "VALOR TOTAL" — se `extrairTextoPdf` não preservar essas
  // quebras, nada é reconhecido.
  it('preserva as linhas da fatura do Santander, para o parser reconhecer os lançamentos', async () => {
    const itens: ItemTextoFalso[] = [];
    for (const linha of FATURA_SANTANDER.split('\n')) {
      const palavras = linha.split(' ');
      palavras.forEach((palavra, i) => {
        itens.push({ str: palavra, hasEOL: i === palavras.length - 1 });
      });
    }
    // Item de texto vazio que o pdf.js real intercala, sem linha de conteúdo correspondente.
    itens.push({ str: '', hasEOL: true });
    paginasFalsas = [itens];

    const { extrairTextoPdf } = await import('./textoPdf');
    const { lerSantanderFatura } = await import('./santanderFatura');

    const bytes = new TextEncoder().encode('conteudo de pdf sintetico para o teste');
    const texto = await extrairTextoPdf(bytes.buffer.slice(0));
    const leitura = lerSantanderFatura(texto, '2026-09');

    expect(leitura.linhasIgnoradas).toBe(0);
    expect(leitura.brutos).toHaveLength(6);
  });
});
