import { prepararVariantes } from './preparoImagem';

/** Lê o texto de uma imagem por OCR, 100% no aparelho. Os arquivos do motor ficam em
 *  `public/tesseract/` (versão fixa, sem CDN de terceiros) e só são baixados quando o usuário
 *  pede a primeira leitura — o `import()` mantém o tesseract.js fora do bundle principal.
 *
 *  Devolve um texto por passada: duas variantes da foto × dois modos de segmentação de página
 *  (texto esparso e bloco único). Num comprovante térmico cada passada erra dígitos diferentes;
 *  quem chama (`parsearComprovantes`) vota entre elas. */
export async function lerTextosDaImagem(
  imagem: Blob,
  aoProgredir?: (fracao: number) => void,
): Promise<string[]> {
  const [{ createWorker, PSM }, variantes] = await Promise.all([
    import('tesseract.js'), prepararVariantes(imagem),
  ]);
  const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, document.baseURI).href;
  const modos = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
  const total = variantes.length * modos.length;
  let feitas = 0;
  const worker = await createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
    langPath: base,
    gzip: false,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') aoProgredir?.((feitas + m.progress) / total);
    },
  });
  try {
    const textos: string[] = [];
    for (const variante of variantes) {
      for (const modo of modos) {
        await worker.setParameters({ tessedit_pageseg_mode: modo });
        const { data } = await worker.recognize(variante);
        textos.push(data.text);
        feitas++;
        aoProgredir?.(feitas / total);
      }
    }
    return textos;
  } finally {
    await worker.terminate();
  }
}
