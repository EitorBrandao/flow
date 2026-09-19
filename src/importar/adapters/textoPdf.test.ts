// @vitest-environment node
//
// Roda no ambiente `node`, não `jsdom`, porque o mock abaixo precisa de `structuredClone` com
// transferência de buffer (`{ transfer: [...] }") para imitar fielmente o que o pdf.js de
// verdade faz — o jsdom deste projeto não garante essa API.
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => ({ items: [{ str: 'LOJA GAMA' }] }),
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
});
