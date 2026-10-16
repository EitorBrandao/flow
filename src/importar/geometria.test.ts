import { anguloDeInclinacao, anguloPorProjecao, caixaDoPapel, caixaDoTexto, transformacaoDoRecorte, type LinhaLida } from './geometria';

function linha(texto: string, x0: number, y0: number, x1: number, y1: number, confianca = 90): LinhaLida {
  return { texto, confianca, caixa: { x0, y0, x1, y1: y1 + 20 }, baseline: { x0, y0, x1, y1 } };
}

describe('anguloDeInclinacao', () => {
  it('texto descendo para a direita dá ângulo positivo', () => {
    // 100 px à direita, 10 px para baixo: ~5,7°
    expect(anguloDeInclinacao([linha('TOTAL PARCELAS', 0, 0, 100, 10)])).toBeCloseTo(5.71, 1);
  });

  it('mediana ponderada: uma linha curta torta não vence duas longas retas', () => {
    const r = anguloDeInclinacao([
      linha('PARCELAS TOTAL', 0, 0, 400, 4), linha('CREDITO PARCELADO', 0, 50, 400, 54),
      linha('abcde', 0, 100, 20, 120),
    ]);
    expect(r).toBeCloseTo(0.57, 1);
  });

  it('ignora linhas de baixa confiança, curtas ou com ângulo absurdo', () => {
    expect(anguloDeInclinacao([
      linha('lixo lixo', 0, 0, 100, 40, 20), linha('ab', 0, 0, 100, 10), linha('TOTAL PARCELAS', 0, 0, 100, 60),
    ])).toBe(0);
  });

  it('sem linhas, 0', () => {
    expect(anguloDeInclinacao([])).toBe(0);
  });
});

describe('caixaDoTexto', () => {
  const img = { largura: 1000, altura: 1000 };

  it('envolve as linhas úteis e soma a margem, sem passar da imagem', () => {
    const c = caixaDoTexto([linha('TOTAL PARCELAS', 100, 100, 500, 120), linha('CREDITO PARCELADO', 100, 400, 500, 420)], img, 0.1);
    expect(c).toEqual({ x0: 60, y0: 66, x1: 540, y1: 474 });
  });

  it('caixa pequena demais para ser o comprovante vira undefined', () => {
    expect(caixaDoTexto([linha('TOTAL PARCELAS', 0, 0, 50, 10)], img)).toBeUndefined();
  });

  it('sem linha útil, undefined', () => {
    expect(caixaDoTexto([linha('lixo lixo', 0, 0, 900, 900, 10)], img)).toBeUndefined();
  });
});

describe('transformacaoDoRecorte', () => {
  it('sem inclinação, só recorta e escala', () => {
    const t = transformacaoDoRecorte({ largura: 1000, altura: 1000 }, { x0: 100, y0: 200, x1: 500, y1: 600 }, 0, 800);
    expect(t).toMatchObject({ a: 2, d: 2, largura: 800, altura: 800 });
    expect(t.b).toBeCloseTo(0);
    // o canto (100,200) vai para (0,0)
    expect(t.a * 100 + t.c * 200 + t.e).toBeCloseTo(0);
    expect(t.b * 100 + t.d * 200 + t.f).toBeCloseTo(0);
  });

  it('com inclinação, um ponto sobre a linha torta termina na mesma linha horizontal', () => {
    // texto a 10° descendo para a direita: dois pontos na mesma linha de base
    const g = (10 * Math.PI) / 180;
    const p0 = { x: 200, y: 300 };
    const p1 = { x: 200 + 400 * Math.cos(g), y: 300 + 400 * Math.sin(g) };
    const t = transformacaoDoRecorte({ largura: 1000, altura: 1000 }, { x0: 100, y0: 200, x1: 700, y1: 700 }, 10, 900);
    const y = (p: { x: number; y: number }) => t.b * p.x + t.d * p.y + t.f;
    expect(y(p1)).toBeCloseTo(y(p0), 3);
  });
});

describe('anguloPorProjecao', () => {
  /** Imagem clara com linhas escuras de espessura 3 px, a cada 14 px, inclinadas em `graus`. */
  function linhasInclinadas(graus: number, largura = 240, altura = 160) {
    const cinza = new Uint8ClampedArray(largura * altura).fill(230);
    const t = Math.tan((graus * Math.PI) / 180);
    for (let x = 0; x < largura; x++) {
      for (let base = -200; base < altura + 200; base += 14) {
        const y = Math.round(base + x * t);
        for (let e = 0; e < 3; e++) {
          if (y + e >= 0 && y + e < altura) cinza[(y + e) * largura + x] = 20;
        }
      }
    }
    return cinza;
  }

  it.each([0, 6, -9, 14])('acha %d° em linhas inclinadas (tolerância de 1°)', (graus) => {
    expect(anguloPorProjecao(linhasInclinadas(graus), 240, 160)).toBeCloseTo(graus, 0);
  });

  it('imagem em branco devolve 0', () => {
    expect(anguloPorProjecao(new Uint8ClampedArray(100).fill(255), 10, 10)).toBe(0);
  });
});

describe('caixaDoPapel', () => {
  const L = 100;
  const A = 60;
  function foto(pintar: (x: number, y: number) => [number, number, number]) {
    const rgba = new Uint8ClampedArray(L * A * 4);
    for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) {
      const [r, g, b] = pintar(x, y);
      rgba.set([r, g, b, 255], (y * L + x) * 4);
    }
    return rgba;
  }
  const tecido: [number, number, number] = [60, 60, 60];
  const papel: [number, number, number] = [225, 225, 218];
  const pele: [number, number, number] = [235, 165, 140];
  const dentro = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

  it('acha o papel claro sobre o tecido escuro', () => {
    const rgba = foto((x, y) => (dentro(x, y, 20, 10, 80, 50) ? papel : tecido));
    expect(caixaDoPapel(rgba, L, A)).toEqual({ x0: 20, y0: 10, x1: 80, y1: 50 });
  });

  it('deixa a pele (colorida) de fora, mesmo encostada no papel', () => {
    const rgba = foto((x, y) => {
      if (dentro(x, y, 20, 10, 80, 50)) return papel;
      if (dentro(x, y, 0, 10, 20, 50)) return pele;
      return tecido;
    });
    expect(caixaDoPapel(rgba, L, A)).toEqual({ x0: 20, y0: 10, x1: 80, y1: 50 });
  });

  it('escolhe o maior bloco claro e ignora um reflexo pequeno', () => {
    const rgba = foto((x, y) => {
      if (dentro(x, y, 20, 10, 80, 50)) return papel;
      if (dentro(x, y, 90, 2, 95, 6)) return papel;
      return tecido;
    });
    expect(caixaDoPapel(rgba, L, A)).toEqual({ x0: 20, y0: 10, x1: 80, y1: 50 });
  });

  it('sem bloco claro grande, undefined', () => {
    expect(caixaDoPapel(foto(() => tecido), L, A)).toBeUndefined();
    expect(caixaDoPapel(foto((x, y) => (dentro(x, y, 0, 0, 5, 5) ? papel : tecido)), L, A)).toBeUndefined();
  });
});
