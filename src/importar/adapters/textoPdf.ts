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
