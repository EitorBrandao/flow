import type { Worker } from 'tesseract.js';
import {
  anguloDeInclinacao, anguloPorProjecao, caixaDoPapel, caixaDoTexto, transformacaoDoRecorte, type LinhaLida,
} from './geometria';
import { abrirImagem, recortarGirado, reduzir, rgbaDe, tintaLocal, variantesDe, type Fonte } from './preparoImagem';

/** Lado maior da cópia usada no primeiro olhar, e largura do recorte da segunda fase. Texto de
 *  maquininha na foto inteira fica pequeno demais; o recorte ampliado é o que o OCR lê bem. */
const LADO_PRIMEIRO_OLHAR = 1600;
const LARGURA_RECORTE = 2400;
/** Largura máxima da foto inteira endireitada pelo ângulo da tinta. */
const LARGURA_ENDIREITADA = 3000;
/** Passadas possíveis: o primeiro olhar e 2 variantes × 2 modos de página. */
const PASSADAS = 5;

/** O motor (worker, wasm e idioma) leva segundos para subir, e o usuário gasta esse tempo tirando
 *  a foto. `aquecerOcr` começa a subir quando a tela abre; `liberarOcr` desliga ao fechar. */
let motor: Promise<Worker> | null = null;
let aoProgredirAtual: ((fracao: number) => void) | undefined;
let feitasAtual = 0;

export function aquecerOcr(): void {
  if (motor) return;
  motor = (async () => {
    const { createWorker } = await import('tesseract.js');
    const base = new URL(`${import.meta.env.BASE_URL}tesseract/`, document.baseURI).href;
    const worker = await createWorker('por', 1, {
      workerPath: `${base}worker.min.js`,
      corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
      langPath: base,
      gzip: false,
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text') aoProgredirAtual?.((feitasAtual + m.progress) / PASSADAS);
      },
    });
    // Sem o teste de texto invertido: comprovante é sempre tinta escura em papel claro.
    await worker.setParameters({ tessedit_do_invert: '0' });
    return worker;
  })();
  // Falha ao subir (rede na primeira vez, por exemplo): a próxima leitura tenta de novo.
  motor.catch(() => { motor = null; });
}

export function liberarOcr(): void {
  const atual = motor;
  motor = null;
  atual?.then((w) => w.terminate()).catch(() => {});
}

/** Lê o texto de uma imagem por OCR, 100% no aparelho. Os arquivos do motor ficam em
 *  `public/tesseract/` (versão fixa, sem CDN de terceiros) e só são baixados quando o usuário
 *  abre a leitura de comprovante — o `import()` mantém o tesseract.js fora do bundle principal.
 *
 *  Duas fases. Na primeira, uma leitura rápida da foto reduzida mostra onde está o texto e quão
 *  torto ele está. Na segunda, o comprovante é desentortado, recortado e ampliado, e lido em
 *  duas variantes × dois modos de página. Devolve um texto por passada: num comprovante térmico
 *  cada passada erra dígitos diferentes, e quem chama vota entre elas. `confiavel` recebe os
 *  textos até agora; devolvendo `true`, as passadas restantes são puladas. */
export async function lerTextosDaImagem(
  imagem: Blob,
  aoProgredir?: (fracao: number) => void,
  confiavel?: (textos: string[]) => boolean,
): Promise<string[]> {
  aquecerOcr();
  const [{ PSM }, bitmap, worker] = await Promise.all([import('tesseract.js'), abrirImagem(imagem), motor!]);
  aoProgredirAtual = aoProgredir;
  feitasAtual = 0;
  try {
    const textos: string[] = [];
    const passada = async (alvo: Blob, modo: (typeof PSM)[keyof typeof PSM], blocos = false) => {
      await worker.setParameters({ tessedit_pageseg_mode: modo });
      const { data } = await worker.recognize(alvo, {}, blocos ? { text: true, blocks: true } : { text: true });
      feitasAtual++;
      aoProgredir?.(feitasAtual / PASSADAS);
      textos.push(data.text);
      return data;
    };

    // Fase 1: onde está o texto e quão torto está.
    const olhar = async (fonte: Fonte) => {
      const { canvas, escala } = reduzir(fonte, LADO_PRIMEIRO_OLHAR);
      const data = await passada(await variantesDe(canvas).esticada(), PSM.SPARSE_TEXT, true);
      const linhas: LinhaLida[] = (data.blocks ?? []).flatMap((b) => b.paragraphs).flatMap((p) => p.lines)
        .map((l) => ({ texto: l.text, confianca: l.confidence, caixa: l.bbox, baseline: l.baseline }));
      return {
        escala, graus: anguloDeInclinacao(linhas),
        caixa: caixaDoTexto(linhas, { largura: canvas.width, altura: canvas.height }, 0.15),
      };
    };
    // O papel (claro e sem cor) contra o tecido e a pele: recortá-lo deixa o texto grande para o
    // primeiro olhar, tira da leitura a textura que a deixa lenta e errada, e deixa a medida de
    // inclinação olhar só para linhas de texto, sem a borda da mão ou da mesa.
    let fonte: Fonte = bitmap;
    const { canvas: panorama, escala: escalaPanorama } = reduzir(bitmap, 400);
    const papel = caixaDoPapel(rgbaDe(panorama), panorama.width, panorama.height);
    if (papel) {
      const folga = 0.03;
      const fx = (papel.x1 - papel.x0) * folga;
      const fy = (papel.y1 - papel.y0) * folga;
      const caixaPapel = {
        x0: Math.max(0, (papel.x0 - fx) / escalaPanorama), y0: Math.max(0, (papel.y0 - fy) / escalaPanorama),
        x1: Math.min(bitmap.width, (papel.x1 + fx) / escalaPanorama), y1: Math.min(bitmap.height, (papel.y1 + fy) / escalaPanorama),
      };
      fonte = recortarGirado(bitmap, transformacaoDoRecorte(
        { largura: bitmap.width, altura: bitmap.height }, caixaPapel, 0,
        Math.min(caixaPapel.x1 - caixaPapel.x0, LARGURA_RECORTE),
      ));
    }
    // Foto torta: o ângulo pela tinta (sem OCR) endireita antes do primeiro olhar, que então só
    // mede a inclinação que sobrou.
    const { canvas: miniatura } = reduzir(fonte, 500);
    const grosso = anguloPorProjecao(tintaLocal(miniatura), miniatura.width, miniatura.height);
    if (Math.abs(grosso) >= 2) {
      fonte = recortarGirado(fonte, transformacaoDoRecorte(
        { largura: fonte.width, altura: fonte.height },
        { x0: 0, y0: 0, x1: fonte.width, y1: fonte.height }, grosso, Math.min(fonte.width, LARGURA_ENDIREITADA),
      ));
    }
    const { escala, graus, caixa } = await olhar(fonte);

    // Fase 2: o comprovante desentortado e ampliado. Sem caixa confiável, a foto inteira.
    const caixaOriginal = caixa
      ? { x0: caixa.x0 / escala, y0: caixa.y0 / escala, x1: caixa.x1 / escala, y1: caixa.y1 / escala }
      : { x0: 0, y0: 0, x1: fonte.width, y1: fonte.height };
    const recorte = recortarGirado(fonte, transformacaoDoRecorte(
      { largura: fonte.width, altura: fonte.height }, caixaOriginal, caixa ? graus : 0, LARGURA_RECORTE,
    ));
    bitmap.close();
    const variantes = variantesDe(recorte);
    const plano = [
      { gerar: variantes.esticada, modo: PSM.SPARSE_TEXT }, { gerar: variantes.esticada, modo: PSM.SINGLE_BLOCK },
      { gerar: variantes.normalizada, modo: PSM.SPARSE_TEXT }, { gerar: variantes.normalizada, modo: PSM.SINGLE_BLOCK },
    ];
    for (const { gerar, modo } of plano) {
      if (textos.length >= 3 && confiavel?.(textos)) break;
      await passada(await gerar(), modo);
    }
    return textos;
  } finally {
    aoProgredirAtual = undefined;
  }
}
