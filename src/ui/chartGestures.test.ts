import { describe, expect, it } from 'vitest';
import {
  JANELA_DIAS_MIN, clampJanela, janelaInicial, panJanela, zoomJanela,
} from './chartGestures';

describe('clampJanela', () => {
  it('mantém uma janela já válida inalterada', () => {
    expect(clampJanela({ inicioIdx: 10, fimIdx: 30 }, 100)).toEqual({ inicioIdx: 10, fimIdx: 30 });
  });

  it('encolhe a janela para caber numa série mais curta que o mínimo de zoom', () => {
    expect(clampJanela({ inicioIdx: 0, fimIdx: 20 }, 5)).toEqual({ inicioIdx: 0, fimIdx: 4 });
  });

  it('empurra a janela para dentro dos limites quando o início é negativo', () => {
    expect(clampJanela({ inicioIdx: -10, fimIdx: 10 }, 100)).toEqual({ inicioIdx: 0, fimIdx: 20 });
  });

  it('empurra a janela para dentro dos limites quando o fim passa do tamanho da série', () => {
    expect(clampJanela({ inicioIdx: 90, fimIdx: 120 }, 100)).toEqual({ inicioIdx: 69, fimIdx: 99 });
  });
});

describe('janelaInicial', () => {
  it('abre com 30 dias antes e 30 depois de hoje', () => {
    expect(janelaInicial(100, 300)).toEqual({ inicioIdx: 70, fimIdx: 130 });
  });

  it('abre com a série inteira quando ela é mais curta que a janela padrão', () => {
    expect(janelaInicial(20, 40)).toEqual({ inicioIdx: 0, fimIdx: 39 });
  });
});

describe('panJanela', () => {
  it('desloca a janela mantendo o mesmo tamanho', () => {
    expect(panJanela({ inicioIdx: 20, fimIdx: 40 }, 5, 100)).toEqual({ inicioIdx: 25, fimIdx: 45 });
  });

  it('não deixa a janela passar do início da série', () => {
    expect(panJanela({ inicioIdx: 5, fimIdx: 25 }, -20, 100)).toEqual({ inicioIdx: 0, fimIdx: 20 });
  });

  it('não deixa a janela passar do fim da série', () => {
    expect(panJanela({ inicioIdx: 70, fimIdx: 90 }, 20, 100)).toEqual({ inicioIdx: 79, fimIdx: 99 });
  });
});

describe('zoomJanela', () => {
  it('reduz a janela ao dar zoom in, mantendo a âncora dentro do intervalo', () => {
    const janela = zoomJanela({ inicioIdx: 0, fimIdx: 100 }, 0.5, 50, 200);
    expect(janela.fimIdx - janela.inicioIdx).toBe(50);
    expect(janela.inicioIdx).toBeLessThanOrEqual(50);
    expect(janela.fimIdx).toBeGreaterThanOrEqual(50);
  });

  it('não deixa o zoom in passar do mínimo de dias configurado', () => {
    const janela = zoomJanela({ inicioIdx: 40, fimIdx: 60 }, 0.01, 50, 200);
    expect(janela.fimIdx - janela.inicioIdx).toBe(JANELA_DIAS_MIN - 1);
  });

  it('não deixa o zoom out passar do tamanho da série inteira', () => {
    const janela = zoomJanela({ inicioIdx: 40, fimIdx: 60 }, 100, 50, 80);
    expect(janela).toEqual({ inicioIdx: 0, fimIdx: 79 });
  });
});
