export interface Janela {
  inicioIdx: number;
  fimIdx: number;
}

/** Zoom mínimo: a janela nunca fica mais estreita que este número de dias. */
export const JANELA_DIAS_MIN = 14;

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Garante que a janela caiba em `[0, tamanhoSerie - 1]` e não fique mais estreita que
 *  `larguraMin` dias (nem mais larga que a série inteira). */
export function clampJanela(
  janela: Janela, tamanhoSerie: number, larguraMin: number = JANELA_DIAS_MIN,
): Janela {
  const maxLen = Math.max(0, tamanhoSerie - 1);
  const minLen = Math.min(larguraMin - 1, maxLen);
  const len = clampInt(janela.fimIdx - janela.inicioIdx, minLen, maxLen);
  const inicioIdx = clampInt(janela.inicioIdx, 0, maxLen - len);
  return { inicioIdx, fimIdx: inicioIdx + len };
}

/** Janela padrão ao abrir o modal: `meiaLargura` dias antes e depois de hoje, clampada aos
 *  limites da série (série mais curta que a janela padrão abre inteira). */
export function janelaInicial(hojeIdx: number, tamanhoSerie: number, meiaLargura = 30): Janela {
  return clampJanela({ inicioIdx: hojeIdx - meiaLargura, fimIdx: hojeIdx + meiaLargura }, tamanhoSerie);
}

/** Desloca a janela em `deltaIdx` posições, mantendo a mesma largura, sem sair de
 *  `[0, tamanhoSerie - 1]`. */
export function panJanela(janela: Janela, deltaIdx: number, tamanhoSerie: number): Janela {
  const largura = janela.fimIdx - janela.inicioIdx + 1;
  return clampJanela(
    { inicioIdx: janela.inicioIdx + deltaIdx, fimIdx: janela.fimIdx + deltaIdx },
    tamanhoSerie,
    largura,
  );
}

/** Redimensiona a janela por `fator` (< 1 aproxima/zoom in, > 1 afasta/zoom out), mantendo
 *  `ancoraIdx` estável (o mesmo ponto sob o cursor/dedo antes e depois do zoom). */
export function zoomJanela(
  janela: Janela, fator: number, ancoraIdx: number, tamanhoSerie: number,
  larguraMin: number = JANELA_DIAS_MIN,
): Janela {
  const oldLen = janela.fimIdx - janela.inicioIdx;
  const maxLen = Math.max(0, tamanhoSerie - 1);
  const newLen = clampInt(oldLen * fator, larguraMin - 1, maxLen);
  const f = oldLen > 0 ? (ancoraIdx - janela.inicioIdx) / oldLen : 0.5;
  const inicioIdx = ancoraIdx - f * newLen;
  return clampJanela({ inicioIdx, fimIdx: inicioIdx + newLen }, tamanhoSerie, larguraMin);
}
