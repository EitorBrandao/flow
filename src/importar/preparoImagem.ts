import type { Transformacao } from './geometria';

/** Preparo de imagem para OCR de comprovante térmico: o papel é claro, mas a foto tem sombra,
 *  mão e fundo. Dividir cada pixel pela luz local (um desfoque grande) tira a sombra, e o limiar
 *  deixa só tinta e papel. Cada variante erra dígitos diferentes — o OCR roda nas duas e vota. */

/** Normaliza o cinza pelo fundo local: papel claro vira ~200, tinta escura fica escura. */
export function normalizarPeloFundo(cinza: Uint8ClampedArray, fundo: Uint8ClampedArray): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(cinza.length);
  for (let i = 0; i < cinza.length; i++) saida[i] = (cinza[i] / (fundo[i] + 1)) * 200;
  return saida;
}

/** Estica o contraste: leva o 1º percentil de brilho a 0 e o 99º a 255. Mantém a textura do
 *  traço — o recorte limpo lê melhor que qualquer binarização. */
export function esticarContraste(cinza: Uint8ClampedArray): Uint8ClampedArray {
  const histograma = new Uint32Array(256);
  for (const v of cinza) histograma[v]++;
  const corte = (fracao: number) => {
    let acumulado = 0;
    for (let v = 0; v < 256; v++) {
      acumulado += histograma[v];
      if (acumulado >= cinza.length * fracao) return v;
    }
    return 255;
  };
  const baixo = corte(0.01);
  const alto = corte(0.99);
  if (alto <= baixo) return cinza.slice();
  return cinza.map((v) => ((v - baixo) / (alto - baixo)) * 255);
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas vazio'))), 'image/png');
  });
}

function canvasDeCinza(cinza: Uint8ClampedArray, largura: number, altura: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(largura, altura);
  for (let i = 0; i < cinza.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = cinza[i];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Abre a imagem respeitando a orientação do EXIF (foto de celular costuma vir deitada). */
/** Foto aberta ou canvas já preparado: ambos desenham e têm largura e altura. */
export type Fonte = ImageBitmap | HTMLCanvasElement;

export function abrirImagem(imagem: Blob): Promise<ImageBitmap> {
  return createImageBitmap(imagem, { imageOrientation: 'from-image' });
}

/** Cópia reduzida para o primeiro olhar (achar o texto): mais barata de ler. */
export function reduzir(bitmap: Fonte, ladoMaximo: number): { canvas: HTMLCanvasElement; escala: number } {
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, escala };
}

/** Desfaz a inclinação, recorta a caixa do texto e escala para `larguraAlvo` — texto pequeno
 *  demais na foto inteira é a principal causa de dígito trocado. */
export function recortarGirado(bitmap: Fonte, t: Transformacao): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = t.largura;
  canvas.height = t.altura;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, t.largura, t.altura);
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/** Desfoque barato do cinza: reduz por `divisor` e amplia com suavização. */
function fundoDe(cinza: Uint8ClampedArray, largura: number, altura: number, divisor: number): Uint8ClampedArray {
  const pequeno = document.createElement('canvas');
  pequeno.width = Math.max(1, Math.round(largura / divisor));
  pequeno.height = Math.max(1, Math.round(altura / divisor));
  pequeno.getContext('2d')!.drawImage(canvasDeCinza(cinza, largura, altura), 0, 0, pequeno.width, pequeno.height);
  const grande = document.createElement('canvas');
  grande.width = largura;
  grande.height = altura;
  const gctx = grande.getContext('2d', { willReadFrequently: true })!;
  gctx.imageSmoothingQuality = 'high';
  gctx.drawImage(pequeno, 0, 0, largura, altura);
  const rgba = gctx.getImageData(0, 0, largura, altura).data;
  const fundo = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < fundo.length; i++) fundo[i] = rgba[i * 4];
  return fundo;
}

/** Duas variantes de um canvas, ambas em tons de cinza: contraste esticado, e normalizada pela
 *  luz de fundo (janela larga, para não criar halo ao redor das letras). Sem binarização: a
 *  imagem limpa lê melhor, e cada variante erra dígitos diferentes — o OCR roda nas duas e vota. */
export async function variantesDe(origem: HTMLCanvasElement): Promise<Blob[]> {
  const { width: largura, height: altura } = origem;
  const rgba = origem.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, largura, altura).data;
  const cinza = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < cinza.length; i++) {
    cinza[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  const normalizada = esticarContraste(normalizarPeloFundo(cinza, fundoDe(cinza, largura, altura, 48)));
  return Promise.all([
    paraBlob(canvasDeCinza(esticarContraste(cinza), largura, altura)),
    paraBlob(canvasDeCinza(normalizada, largura, altura)),
  ]);
}

/** Tons de cinza de um canvas, para as medidas que não passam pelo OCR. */
export function cinzaDe(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const rgba = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
  const cinza = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < cinza.length; i++) {
    cinza[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return cinza;
}

/** Só a tinta: 0 onde o pixel é bem mais escuro que a vizinhança, 255 no resto. Mão, mesa e
 *  sombra grande somem — o que sobra é traço de letra, que é o que o ângulo precisa medir. */
export function tintaLocal(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const cinza = cinzaDe(canvas);
  const fundo = fundoDe(cinza, canvas.width, canvas.height, 12);
  return cinza.map((v, i) => (fundo[i] - v > 25 ? 0 : 255));
}
