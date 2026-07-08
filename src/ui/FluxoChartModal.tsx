import {
  useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import { janelaInicial, panJanela, zoomJanela, type Janela } from './chartGestures';

interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  mostrarCenarios: boolean;
  onFechar: () => void;
}

function ddmm(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function semana(d: ISODate): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
}

export default function FluxoChartModal({ serie, hoje, mostrarCenarios, onFechar }: Props) {
  const uid = useId();
  const hojeIdxBruto = serie.findIndex((s) => s.data >= hoje);
  const hojeIdx = hojeIdxBruto === -1 ? serie.length - 1 : hojeIdxBruto;
  const hojeData = serie[hojeIdx].data;

  const [janela, setJanela] = useState<Janela>(() => janelaInicial(hojeIdx, serie.length));
  const [selecionado, setSelecionado] = useState<ISODate>(hojeData);

  const areaRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, number>());
  const modoRef = useRef<'scrub' | 'pan' | null>(null);
  const panRefRef = useRef<{ x: number; janela: Janela } | null>(null);
  const pinchRef = useRef<{ dist: number; janela: Janela; ancoraIdx: number } | null>(null);
  const ultimoCliqueRef = useRef<{ tempo: number; x: number } | null>(null);

  const DBLCLIQUE_MS = 350;
  const DBLCLIQUE_PX = 24;

  function idxNaPosicao(clientX: number): number {
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx));
  }

  function selecionarPeloX(clientX: number) {
    const idx = Math.min(serie.length - 1, Math.max(0, idxNaPosicao(clientX)));
    setSelecionado(serie[idx].data);
  }

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ancoraIdx = janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx);
    const fator = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setJanela((j) => zoomJanela(j, fator, ancoraIdx, serie.length));
  }

  function onPointerDown(e: ReactPointerEvent) {
    areaRef.current?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, e.clientX);
    if (pointersRef.current.size === 1) {
      const ultimo = ultimoCliqueRef.current;
      const isDuplo = ultimo != null
        && e.timeStamp - ultimo.tempo < DBLCLIQUE_MS
        && Math.abs(e.clientX - ultimo.x) < DBLCLIQUE_PX;
      if (isDuplo) {
        modoRef.current = 'pan';
        panRefRef.current = { x: e.clientX, janela };
      } else {
        modoRef.current = 'scrub';
        selecionarPeloX(e.clientX);
      }
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      modoRef.current = null;
      panRefRef.current = null;
      const xs = [...pointersRef.current.values()];
      const dist = Math.max(Math.abs(xs[0] - xs[1]), 1);
      const rect = areaRef.current!.getBoundingClientRect();
      const midX = (xs[0] + xs[1]) / 2;
      const f = Math.min(1, Math.max(0, (midX - rect.left) / rect.width));
      pinchRef.current = { dist, janela, ancoraIdx: janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx) };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, e.clientX);
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const xs = [...pointersRef.current.values()];
      const dist = Math.max(Math.abs(xs[0] - xs[1]), 1);
      const { janela: janelaRef, ancoraIdx, dist: distInicial } = pinchRef.current;
      setJanela(zoomJanela(janelaRef, distInicial / dist, ancoraIdx, serie.length));
    } else if (pointersRef.current.size === 1 && modoRef.current === 'pan' && panRefRef.current) {
      const rect = areaRef.current!.getBoundingClientRect();
      const dx = e.clientX - panRefRef.current.x;
      const winLen = panRefRef.current.janela.fimIdx - panRefRef.current.janela.inicioIdx;
      const deltaIdx = (-dx / rect.width) * winLen;
      setJanela(panJanela(panRefRef.current.janela, deltaIdx, serie.length));
    } else if (pointersRef.current.size === 1 && modoRef.current === 'scrub') {
      selecionarPeloX(e.clientX);
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (modoRef.current) ultimoCliqueRef.current = { tempo: e.timeStamp, x: e.clientX };
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) { modoRef.current = null; panRefRef.current = null; }
  }

  function onPointerCancel(e: ReactPointerEvent) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null; modoRef.current = null; panRefRef.current = null;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const serieVisivel = serie.slice(janela.inicioIdx, janela.fimIdx + 1);
  const valores: number[] = [];
  serieVisivel.forEach((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    valores.push(s.saldoProjetado);
    if (mostrarCenarios) valores.push(s.saldoComCenarios);
    if (idxGlobal <= hojeIdx) valores.push(s.saldoEfetivo);
  });
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const dominioY: [number, number] = [Math.min(min, 0), Math.max(max, 0)];

  const pontos = serieVisivel.map((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    return {
      data: s.data,
      passado: idxGlobal <= hojeIdx ? s.saldoEfetivo : null,
      futuro: idxGlobal >= hojeIdx ? s.saldoProjetado : null,
      cenario: mostrarCenarios && idxGlobal >= hojeIdx ? s.saldoComCenarios : null,
    };
  });

  const hojeVisivel = hojeIdx >= janela.inicioIdx && hojeIdx <= janela.fimIdx;
  const selecionadoIdx = serie.findIndex((s) => s.data === selecionado);
  const selecionadoVisivel = selecionadoIdx >= janela.inicioIdx && selecionadoIdx <= janela.fimIdx;
  const diaSelecionado = serie[selecionadoIdx] ?? serie[hojeIdx];
  const valorSelecionado = selecionadoIdx <= hojeIdx
    ? diaSelecionado.saldoEfetivo
    : (mostrarCenarios ? diaSelecionado.saldoComCenarios : diaSelecionado.saldoProjetado);

  return (
    <div className="grafico-expandido" role="dialog" aria-modal="true" aria-label="Gráfico de saldo expandido">
      <div className="grafico-expandido-cabecalho">
        <span className="grafico-expandido-periodo" data-testid="grafico-expandido-periodo">
          {ddmm(serieVisivel[0].data)} – {ddmm(serieVisivel[serieVisivel.length - 1].data)}
        </span>
        <button type="button" className="grafico-expandido-fechar" aria-label="Fechar" onClick={onFechar}>
          <X size={16} />
        </button>
      </div>

      <div className="grafico-expandido-leitura">
        <span className={`saldo-grande${valorSelecionado < 0 ? ' negativo' : ''}`}>
          {formatarBRL(valorSelecionado)}
        </span>
        <span className="sub" data-testid="grafico-expandido-leitura-data">
          {semana(selecionado)}, {ddmm(selecionado)}{selecionado === hojeData ? ' · hoje' : ''}
        </span>
      </div>

      <div
        className="grafico-expandido-area" data-testid="grafico-expandido-area" ref={areaRef}
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={dominioY} />
            <XAxis
              dataKey="data" tickFormatter={(d: ISODate) => ddmm(d)}
              tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
            {hojeVisivel && <ReferenceLine x={hojeData} stroke="var(--muted)" strokeDasharray="2 2" />}
            <Area
              type="linear" dataKey="passado" stroke="var(--pos)" strokeWidth={2.5}
              fill={`url(#${uid}-g)`} isAnimationActive={false} connectNulls={false}
            />
            <Area
              type="linear" dataKey="futuro" stroke="var(--pos)" strokeWidth={2.5} strokeDasharray="5 4"
              fill={`url(#${uid}-g)`} isAnimationActive={false} connectNulls={false}
            />
            {mostrarCenarios && (
              <Area
                type="linear" dataKey="cenario" stroke="var(--ac)" strokeWidth={2} strokeDasharray="1 3"
                fill="none" isAnimationActive={false} connectNulls={false}
              />
            )}
            {selecionadoVisivel && (
              <ReferenceDot
                x={selecionado} y={valorSelecionado} r={4}
                fill="var(--bg)" stroke="var(--pos)" strokeWidth={1.4}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {mostrarCenarios && (
        <div className="grafico-expandido-legenda">
          <span className="real"><i /> Real</span>
          <span className="proj"><i /> Projetado</span>
          <span className="cen"><i /> Cenário</span>
        </div>
      )}

      <div className="grafico-expandido-rodape">mín {formatarBRL(min)} · máx {formatarBRL(max)}</div>
    </div>
  );
}
