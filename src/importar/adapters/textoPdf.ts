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

  // O pdf.js TRANSFERE o buffer pro worker (esvazia o original) — por isso entregamos uma
  // cópia. Sem isso, reler o mesmo `ArrayBuffer` (como faz o botão "Trocar", em Importar.tsx)
  // lança "Cannot perform Construct on a detached ArrayBuffer" na segunda leitura.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(conteudo.slice(0)) }).promise;
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
