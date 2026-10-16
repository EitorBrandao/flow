import {
  anguloDeInclinacao, anguloPorProjecao, caixaDoTexto, transformacaoDoRecorte, type LinhaLida,
} from './geometria';
import { abrirImagem, recortarGirado, reduzir, tintaLocal, variantesDe, type Fonte } from './preparoImagem';

/** Lado maior da cópia usada no primeiro olhar, e largura do recorte da segunda fase. Texto de
 *  maquininha na foto inteira fica pequeno demais; o recorte ampliado é o que o OCR lê bem. */
const LADO_PRIMEIRO_OLHAR = 1600;
const LARGURA_RECORTE = 2400;
/** Largura máxima da foto inteira endireitada pelo ângulo da tinta. */
const LARGURA_ENDIREITADA = 3000;

/** Lê o texto de uma imagem por OCR, 100% no aparelho. Os arquivos do motor ficam em
 *  `public/tesseract/` (versão fixa, sem CDN de terceiros) e só são baixados quando o usuário
 *  pede a primeira leitura — o `import()` mantém o tesseract.js fora do bundle principal.
 *
 *  Duas fases. Na primeira, uma leitura rápida da foto reduzida mostra onde está o texto e quão
 *  torto ele está. Na segunda, o comprovante é desentortado, recortado e ampliado, e lido em
 *  duas variantes × dois modos de página. Devolve um texto por passada: num comprovante térmico
 *  cada passada erra dígitos diferentes, e quem chama (`parsearComprovantes`) vota entre elas. */
export async function lerTextosDaImagem(
  imagem: Blob,
  aoProgredir?: (fracao: number) => void,
): Promise<string[]> {
  const [{ createWorker, PSM }, bitmap] = await Promise.all([import('tesseract.js'), abrirImagem(imagem)]);
  const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, document.baseURI).href;
  const modos = [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
  const total = 1 + 2 * modos.length;
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
    const passada = async (alvo: Blob, modo: (typeof modos)[number], blocos = false) => {
      await worker.setParameters({ tessedit_pageseg_mode: modo });
      const { data } = await worker.recognize(alvo, {}, blocos ? { text: true, blocks: true } : { text: true });
      feitas++;
      aoProgredir?.(feitas / total);
      return data;
    };

    // Fase 1: onde está o texto e quão torto está.
    const olhar = async (fonte: Fonte) => {
      const { canvas, escala } = reduzir(fonte, LADO_PRIMEIRO_OLHAR);
      const [normalizada] = await variantesDe(canvas);
      const data = await passada(normalizada, PSM.SPARSE_TEXT, true);
      textos.push(data.text);
      const linhas: LinhaLida[] = (data.blocks ?? []).flatMap((b) => b.paragraphs).flatMap((p) => p.lines)
        .map((l) => ({ texto: l.text, confianca: l.confidence, caixa: l.bbox, baseline: l.baseline }));
      return {
        canvas, escala, graus: anguloDeInclinacao(linhas),
        caixa: caixaDoTexto(linhas, { largura: canvas.width, altura: canvas.height }, 0.15),
      };
    };
    // Foto torta: o ângulo pela tinta (sem OCR) endireita a foto inteira antes do primeiro olhar,
    // que então só mede a inclinação que sobrou.
    let fonte: Fonte = bitmap;
    const { canvas: miniatura } = reduzir(bitmap, 500);
    const grosso = anguloPorProjecao(tintaLocal(miniatura), miniatura.width, miniatura.height);
    if (Math.abs(grosso) >= 2) {
      fonte = recortarGirado(bitmap, transformacaoDoRecorte(
        { largura: bitmap.width, altura: bitmap.height },
        { x0: 0, y0: 0, x1: bitmap.width, y1: bitmap.height }, grosso, Math.min(bitmap.width, LARGURA_ENDIREITADA),
      ));
    }
    const achado = await olhar(fonte);
    const { escala, graus, caixa } = achado;

    // Fase 2: o comprovante desentortado e ampliado. Sem caixa confiável, a foto inteira.
    const caixaOriginal = caixa
      ? { x0: caixa.x0 / escala, y0: caixa.y0 / escala, x1: caixa.x1 / escala, y1: caixa.y1 / escala }
      : { x0: 0, y0: 0, x1: fonte.width, y1: fonte.height };
    const recorte = recortarGirado(fonte, transformacaoDoRecorte(
      { largura: fonte.width, altura: fonte.height }, caixaOriginal, caixa ? graus : 0, LARGURA_RECORTE,
    ));
    bitmap.close();
    for (const variante of await variantesDe(recorte)) {
      for (const modo of modos) textos.push((await passada(variante, modo)).text);
    }
    return textos;
  } finally {
    await worker.terminate();
  }
}
