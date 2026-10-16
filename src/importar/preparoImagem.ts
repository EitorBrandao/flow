/** Preparo de imagem para OCR de comprovante térmico: o papel é claro, mas a foto tem sombra,
 *  mão e fundo. Dividir cada pixel pela luz local (um desfoque grande) tira a sombra, e o limiar
 *  deixa só tinta e papel. Cada variante erra dígitos diferentes — o OCR roda nas duas e vota. */

/** Normaliza o cinza pelo fundo local: papel claro vira ~200, tinta escura fica escura. */
export function normalizarPeloFundo(cinza: Uint8ClampedArray, fundo: Uint8ClampedArray): Uint8ClampedArray {
  const saida = new Uint8ClampedArray(cinza.length);
  for (let i = 0; i < cinza.length; i++) saida[i] = (cinza[i] / (fundo[i] + 1)) * 200;
  return saida;
}

export function aplicarLimiar(cinza: Uint8ClampedArray, limiar: number): Uint8ClampedArray {
  return cinza.map((v) => (v > limiar ? 255 : 0));
}

const LADO_MAXIMO = 1800;
const LIMIAR = 150;

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

/** Devolve duas variantes da foto: cinza normalizado e preto-e-branco. A orientação do EXIF é
 *  respeitada (foto de celular costuma vir deitada). */
export async function prepararVariantes(imagem: Blob): Promise<Blob[]> {
  const bitmap = await createImageBitmap(imagem, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const origem = document.createElement('canvas');
  origem.width = largura;
  origem.height = altura;
  const ctx = origem.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, largura, altura).data;
  const cinza = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < cinza.length; i++) {
    cinza[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }

  // Fundo local: reduz a 1/16 e amplia com suavização — um desfoque barato.
  const pequeno = document.createElement('canvas');
  pequeno.width = Math.max(1, Math.round(largura / 16));
  pequeno.height = Math.max(1, Math.round(altura / 16));
  const pctx = pequeno.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(canvasDeCinza(cinza, largura, altura), 0, 0, pequeno.width, pequeno.height);
  const grande = document.createElement('canvas');
  grande.width = largura;
  grande.height = altura;
  const gctx = grande.getContext('2d', { willReadFrequently: true })!;
  gctx.imageSmoothingQuality = 'high';
  gctx.drawImage(pequeno, 0, 0, largura, altura);
  const fundoRgba = gctx.getImageData(0, 0, largura, altura).data;
  const fundo = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < fundo.length; i++) fundo[i] = fundoRgba[i * 4];

  const normalizada = normalizarPeloFundo(cinza, fundo);
  return Promise.all([
    paraBlob(canvasDeCinza(normalizada, largura, altura)),
    paraBlob(canvasDeCinza(aplicarLimiar(normalizada, LIMIAR), largura, altura)),
  ]);
}
