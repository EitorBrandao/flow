import { esticarContraste, normalizarPeloFundo } from './preparoImagem';

describe('normalizarPeloFundo', () => {
  it('papel igual ao fundo vira cinza claro uniforme, em qualquer sombra', () => {
    const r = normalizarPeloFundo(Uint8ClampedArray.of(250, 100), Uint8ClampedArray.of(250, 100));
    expect(Array.from(r)).toEqual([199, 198]);
  });

  it('tinta bem mais escura que o fundo fica escura', () => {
    expect(normalizarPeloFundo(Uint8ClampedArray.of(40), Uint8ClampedArray.of(200))[0]).toBeLessThan(50);
  });
});

describe('esticarContraste', () => {
  it('leva o mais escuro a 0 e o mais claro a 255', () => {
    const entrada = Uint8ClampedArray.from({ length: 100 }, (_, i) => 100 + i); // 100..199
    const r = esticarContraste(entrada);
    expect(r[0]).toBe(0);
    expect(r[99]).toBe(255);
  });

  it('imagem de uma cor só fica como está', () => {
    expect(Array.from(esticarContraste(Uint8ClampedArray.of(80, 80, 80)))).toEqual([80, 80, 80]);
  });
});
