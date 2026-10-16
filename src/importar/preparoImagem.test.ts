import { aplicarLimiar, normalizarPeloFundo } from './preparoImagem';

describe('normalizarPeloFundo', () => {
  it('papel igual ao fundo vira cinza claro uniforme, em qualquer sombra', () => {
    const r = normalizarPeloFundo(Uint8ClampedArray.of(250, 100), Uint8ClampedArray.of(250, 100));
    expect(Array.from(r)).toEqual([199, 198]);
  });

  it('tinta bem mais escura que o fundo fica escura', () => {
    expect(normalizarPeloFundo(Uint8ClampedArray.of(40), Uint8ClampedArray.of(200))[0]).toBeLessThan(50);
  });
});

describe('aplicarLimiar', () => {
  it('separa em preto e branco; o próprio limiar é preto', () => {
    expect(Array.from(aplicarLimiar(Uint8ClampedArray.of(10, 150, 151, 255), 150))).toEqual([0, 0, 255, 255]);
  });
});
