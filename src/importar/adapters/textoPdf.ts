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
    // `lerSantanderFatura` (em `santanderFatura.ts`) depende de linha: o cabeçalho de cada
    // cartão, as subseções e o "VALOR TOTAL" só casam ancorados no início e no fim da linha.
    // `hasEOL` é a marca de fim de linha do próprio pdf.js — sem preservá-la, a página inteira
    // vira uma linha só e nada é reconhecido. Itens sem "str" são conteúdo marcado, sem texto.
    let bruto = '';
    for (const item of conteudoTexto.items) {
      if (!('str' in item)) continue;
      bruto += item.str + (item.hasEOL ? '\n' : ' ');
    }
    const linhas = bruto
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l !== '');
    paginas.push(linhas.join('\n'));
  }
  return paginas.join('\n');
}
