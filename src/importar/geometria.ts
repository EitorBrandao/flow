/** Geometria da correção de inclinação e do recorte do comprovante. Funções puras: o canvas fica
 *  em `preparoImagem.ts`. Coordenadas de imagem: x para a direita, y para baixo; ângulo em graus,
 *  positivo = texto descendo para a direita (sentido horário). */

export interface Caixa { x0: number; y0: number; x1: number; y1: number }

export interface LinhaLida {
  texto: string;
  confianca: number;
  caixa: Caixa;
  baseline: Caixa; // x0,y0 → x1,y1 da linha de base
}

/** Só linhas legíveis entram nas medidas: foto de comprovante traz mão, mesa e sombra que o OCR
 *  lê como lixo de baixa confiança. */
const CONFIANCA_MINIMA = 60;
const CARACTERES_MINIMOS = 5;

export function linhasUteis(linhas: LinhaLida[]): LinhaLida[] {
  return linhas.filter((l) => l.confianca >= CONFIANCA_MINIMA
    && l.texto.replace(/[^\p{L}\p{N}]/gu, '').length >= CARACTERES_MINIMOS);
}

/** Mediana ponderada pelo comprimento da linha: uma linha longa diz mais sobre o ângulo do papel
 *  do que uma palavra solta. Limitada a ±20°; acima disso, é mais provável erro de leitura que
 *  inclinação real. `0` sem linha útil. */
export function anguloDeInclinacao(linhas: LinhaLida[]): number {
  const medidas = linhasUteis(linhas)
    .map((l) => {
      const dx = l.baseline.x1 - l.baseline.x0;
      const dy = l.baseline.y1 - l.baseline.y0;
      return { graus: (Math.atan2(dy, dx) * 180) / Math.PI, peso: Math.hypot(dx, dy) };
    })
    .filter((m) => m.peso > 0 && Math.abs(m.graus) <= 20)
    .sort((a, b) => a.graus - b.graus);
  const total = medidas.reduce((s, m) => s + m.peso, 0);
  if (total === 0) return 0;
  let acumulado = 0;
  for (const m of medidas) {
    acumulado += m.peso;
    if (acumulado >= total / 2) return m.graus;
  }
  return 0;
}

/** Caixa que envolve as linhas úteis, com margem proporcional. `undefined` quando nada é útil ou
 *  quando a caixa é pequena demais para ser o comprovante (menos de `minimoFracao` da imagem). */
export function caixaDoTexto(
  linhas: LinhaLida[], imagem: { largura: number; altura: number }, margemFracao = 0.06, minimoFracao = 0.1,
): Caixa | undefined {
  const uteis = linhasUteis(linhas);
  if (uteis.length === 0) return undefined;
  const x0 = Math.min(...uteis.map((l) => l.caixa.x0));
  const y0 = Math.min(...uteis.map((l) => l.caixa.y0));
  const x1 = Math.max(...uteis.map((l) => l.caixa.x1));
  const y1 = Math.max(...uteis.map((l) => l.caixa.y1));
  if ((x1 - x0) * (y1 - y0) < imagem.largura * imagem.altura * minimoFracao) return undefined;
  const mx = (x1 - x0) * margemFracao;
  const my = (y1 - y0) * margemFracao;
  return {
    x0: Math.max(0, x0 - mx), y0: Math.max(0, y0 - my),
    x1: Math.min(imagem.largura, x1 + mx), y1: Math.min(imagem.altura, y1 + my),
  };
}

export interface Transformacao {
  /** matriz para `ctx.setTransform(a, b, c, d, e, f)` */
  a: number; b: number; c: number; d: number; e: number; f: number;
  largura: number; altura: number; // tamanho da saída, em pixels
}

/** Gira a imagem em torno do centro para desfazer a inclinação, recorta `caixa` (coordenadas da
 *  imagem original) e escala para que o recorte tenha `larguraAlvo` pixels de largura. */
export function transformacaoDoRecorte(
  imagem: { largura: number; altura: number }, caixa: Caixa, graus: number, larguraAlvo: number,
): Transformacao {
  const phi = (-graus * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const cx = imagem.largura / 2;
  const cy = imagem.altura / 2;
  const girar = (x: number, y: number) => ({
    x: cos * (x - cx) - sin * (y - cy),
    y: sin * (x - cx) + cos * (y - cy),
  });
  const cantos = [
    girar(caixa.x0, caixa.y0), girar(caixa.x1, caixa.y0), girar(caixa.x0, caixa.y1), girar(caixa.x1, caixa.y1),
  ];
  const minX = Math.min(...cantos.map((p) => p.x));
  const maxX = Math.max(...cantos.map((p) => p.x));
  const minY = Math.min(...cantos.map((p) => p.y));
  const maxY = Math.max(...cantos.map((p) => p.y));
  const escala = larguraAlvo / (maxX - minX);
  return {
    a: escala * cos, b: escala * sin, c: -escala * sin, d: escala * cos,
    e: escala * (-(cos * cx - sin * cy) - minX),
    f: escala * (-(sin * cx + cos * cy) - minY),
    largura: Math.round(larguraAlvo), altura: Math.round(escala * (maxY - minY)),
  };
}

/** Ângulo das linhas de texto por perfil de projeção, sem OCR: para cada ângulo candidato, soma
 *  os pixels escuros por linha inclinada; o ângulo certo concentra a tinta em poucas linhas
 *  (soma dos quadrados máxima). Serve de plano B quando o OCR não acha texto numa foto muito
 *  torta. Busca de −25° a 25° (passo de 2°) e refina em torno do melhor (passo de 0,5°). */
export function anguloPorProjecao(cinza: Uint8ClampedArray, largura: number, altura: number): number {
  let soma = 0;
  for (const v of cinza) soma += v;
  const limiar = (soma / cinza.length) * 0.7;
  const escuros: Array<[number, number]> = [];
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    if (cinza[y * largura + x] < limiar) escuros.push([x, y]);
  }
  if (escuros.length === 0) return 0;
  const pontuar = (graus: number) => {
    const r = (graus * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const faixas = new Map<number, number>();
    for (const [x, y] of escuros) {
      // linha de base inclinada em `graus` (y para baixo): y' = y − x·tan(graus)
      const k = Math.round((y * cos - x * sin));
      faixas.set(k, (faixas.get(k) ?? 0) + 1);
    }
    let pontos = 0;
    for (const n of faixas.values()) pontos += n * n;
    return pontos;
  };
  const melhorEm = (de: number, ate: number, passo: number) => {
    let melhor = 0;
    let pontos = -1;
    for (let g = de; g <= ate + 1e-9; g += passo) {
      const p = pontuar(g);
      if (p > pontos) { pontos = p; melhor = g; }
    }
    return melhor;
  };
  const grosso = melhorEm(-25, 25, 2);
  return melhorEm(grosso - 2, grosso + 2, 0.5);
}
