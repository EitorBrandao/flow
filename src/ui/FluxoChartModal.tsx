import {
  useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import { formatarDataBR } from '../domain/dates';
import { classeEfeito, formatarSaldo } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import {
  PERIODOS_ATALHO, atalhoAtivo, centralizarJanela, janelaDoPeriodo, janelaInicial, panJanela,
  zoomJanela, type Janela,
} from './chartGestures';
import MinMaxSeries from './MinMaxSeries';
import { useTravarRolagem } from './useTravarRolagem';

/** Um lançamento do dia, já com o efeito no saldo (positivo entra, negativo sai). */
export interface ItemDia {
  id: string;
  rotulo: string;
  efeito: number;
}

interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  mostrarCenarios: boolean;
  /** Lançamentos de cada dia, para o cartão do dia selecionado e o marcador do degrau grande. */
  itensPorDia?: Map<ISODate, ItemDia[]>;
  onFechar: () => void;
}

/** Quanto tempo o dedo fica parado para o gesto virar "ver cada dia". */
const SEGURAR_MS = 300;
/** Quanto o dedo anda antes de o gesto virar "mover a janela". */
const MOVER_PX = 8;
const ITENS_NO_CARTAO = 2;

function ddmm(d: ISODate): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

function semana(d: ISODate): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
}

function maisPesados(itens: ItemDia[] | undefined): ItemDia[] {
  return [...(itens ?? [])].sort((a, b) => Math.abs(b.efeito) - Math.abs(a.efeito));
}

export default function FluxoChartModal({
  serie, hoje, mostrarCenarios, itensPorDia, onFechar,
}: Props) {
  useTravarRolagem();
  const uid = useId();
  const hojeIdxBruto = serie.findIndex((s) => s.data >= hoje);
  const hojeIdx = hojeIdxBruto === -1 ? serie.length - 1 : hojeIdxBruto;
  const hojeData = serie[hojeIdx].data;

  const [janela, setJanela] = useState<Janela>(() => janelaInicial(hojeIdx, serie.length));
  const [selecionado, setSelecionado] = useState<ISODate>(hojeData);

  const areaRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, number>());
  const modoRef = useRef<'pendente' | 'scrub' | 'pan' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panRefRef = useRef<{ x: number; janela: Janela } | null>(null);
  const pinchRef = useRef<{ dist: number; janela: Janela; ancoraIdx: number } | null>(null);

  function cancelarTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  useEffect(() => cancelarTimer, []);

  function idxNaPosicao(clientX: number): number {
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx));
  }

  function selecionarPeloX(clientX: number) {
    const idx = Math.min(serie.length - 1, Math.max(0, idxNaPosicao(clientX)));
    setSelecionado(serie[idx].data);
  }

  function onWheel(e: WheelEvent) {
    // listener nativo e não-passivo (registrado abaixo via useEffect): preventDefault
    // aqui de fato suprime o scroll da página, o que não acontece com onWheel do JSX
    // (React registra esse handler como passivo na raiz).
    e.preventDefault();
    const rect = areaRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ancoraIdx = janela.inicioIdx + f * (janela.fimIdx - janela.inicioIdx);
    const fator = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setJanela((j) => zoomJanela(j, fator, ancoraIdx, serie.length));
  }

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [janela, serie.length]);

  function onPointerDown(e: ReactPointerEvent) {
    areaRef.current?.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, e.clientX);
    if (pointersRef.current.size === 1) {
      // Um dedo: arrastar move a janela; segurar parado e arrastar mostra cada dia;
      // um toque rápido seleciona o dia tocado.
      modoRef.current = 'pendente';
      panRefRef.current = { x: e.clientX, janela };
      const x0 = e.clientX;
      cancelarTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (modoRef.current === 'pendente') {
          modoRef.current = 'scrub';
          selecionarPeloX(x0);
        }
      }, SEGURAR_MS);
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      cancelarTimer();
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
      return;
    }
    if (pointersRef.current.size !== 1) return;
    if (modoRef.current === 'pendente' && panRefRef.current
      && Math.abs(e.clientX - panRefRef.current.x) > MOVER_PX) {
      cancelarTimer();
      modoRef.current = 'pan';
    }
    if (modoRef.current === 'pan' && panRefRef.current) {
      const rect = areaRef.current!.getBoundingClientRect();
      const dx = e.clientX - panRefRef.current.x;
      const winLen = panRefRef.current.janela.fimIdx - panRefRef.current.janela.inicioIdx;
      const deltaIdx = (-dx / rect.width) * winLen;
      setJanela(panJanela(panRefRef.current.janela, deltaIdx, serie.length));
    } else if (modoRef.current === 'scrub') {
      selecionarPeloX(e.clientX);
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (modoRef.current === 'pendente' && pointersRef.current.size === 1) selecionarPeloX(e.clientX);
    cancelarTimer();
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) { modoRef.current = null; panRefRef.current = null; }
  }

  function onPointerCancel(e: ReactPointerEvent) {
    cancelarTimer();
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
  // O saldo que o dia mostra: efetivo até hoje; depois, o projetado (com cenários, se ligados).
  const valorDoDia = (idx: number): number => {
    const d = serie[idx];
    if (idx <= hojeIdx) return d.saldoEfetivo;
    return mostrarCenarios ? d.saldoComCenarios : d.saldoProjetado;
  };
  const valoresReal: number[] = [];
  const valoresCenario: number[] = [];
  serieVisivel.forEach((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    valoresReal.push(s.saldoProjetado);
    if (idxGlobal <= hojeIdx) valoresReal.push(s.saldoEfetivo);
    // a linha de cenário só é desenhada de hoje em diante
    if (mostrarCenarios && idxGlobal >= hojeIdx) valoresCenario.push(s.saldoComCenarios);
  });
  const real = { min: Math.min(...valoresReal), max: Math.max(...valoresReal) };
  const cenario = valoresCenario.length > 0
    ? { min: Math.min(...valoresCenario), max: Math.max(...valoresCenario) }
    : null;
  const min = Math.min(real.min, cenario?.min ?? real.min);
  const max = Math.max(real.max, cenario?.max ?? real.max);
  const dominioY: [number, number] = [Math.min(min, 0), Math.max(max, 0)];

  const pontos = serieVisivel.map((s, i) => {
    const idxGlobal = janela.inicioIdx + i;
    const base = idxGlobal <= hojeIdx ? s.saldoEfetivo : s.saldoProjetado;
    return {
      data: s.data,
      passado: idxGlobal <= hojeIdx ? s.saldoEfetivo : null,
      futuro: idxGlobal >= hojeIdx ? s.saldoProjetado : null,
      cenario: mostrarCenarios && idxGlobal >= hojeIdx ? s.saldoComCenarios : null,
      fundoPos: Math.max(base, 0),
      fundoNeg: Math.min(base, 0),
    };
  });

  const hojeVisivel = hojeIdx >= janela.inicioIdx && hojeIdx <= janela.fimIdx;
  const selecionadoIdx = serie.findIndex((s) => s.data === selecionado);
  const selecionadoVisivel = selecionadoIdx >= janela.inicioIdx && selecionadoIdx <= janela.fimIdx;
  const idxSel = selecionadoIdx === -1 ? hojeIdx : selecionadoIdx;
  const valorSelecionado = valorDoDia(idxSel);
  const variacaoSel = idxSel > 0 ? valorSelecionado - valorDoDia(idxSel - 1) : 0;
  const itensSel = maisPesados(itensPorDia?.get(serie[idxSel].data));
  const distHoje = idxSel - hojeIdx;
  const quando = distHoje === 0 ? ' · hoje'
    : distHoje > 0 ? ` · daqui a ${distHoje} ${distHoje === 1 ? 'dia' : 'dias'}`
      : ` · há ${-distHoje} ${distHoje === -1 ? 'dia' : 'dias'}`;

  // Degrau grande: o dia de maior variação na janela, se pesa pelo menos um quarto da amplitude.
  let degrauIdx = -1;
  let degrauAbs = 0;
  for (let i = Math.max(janela.inicioIdx, 1); i <= janela.fimIdx; i++) {
    const d = Math.abs(valorDoDia(i) - valorDoDia(i - 1));
    if (d > degrauAbs) { degrauAbs = d; degrauIdx = i; }
  }
  const amplitude = max - min;
  const degrau = degrauIdx >= 0 && amplitude > 0 && degrauAbs >= amplitude / 4
    ? {
      data: serie[degrauIdx].data,
      valor: valorDoDia(degrauIdx),
      sobe: valorDoDia(degrauIdx) > valorDoDia(degrauIdx - 1),
      rotulo: maisPesados(itensPorDia?.get(serie[degrauIdx].data))[0]?.rotulo,
      aDireita: degrauIdx - janela.inicioIdx < (janela.fimIdx - janela.inicioIdx) / 2,
    }
    : null;
  const ativo = atalhoAtivo(janela, serie.length);

  return (
    <div className="grafico-expandido" role="dialog" aria-modal="true" aria-label="Gráfico de saldo expandido">
      <div className="grafico-expandido-cabecalho">
        <span className="grafico-expandido-periodo" data-testid="grafico-expandido-periodo">
          {formatarDataBR(serieVisivel[0].data)} – {formatarDataBR(serieVisivel[serieVisivel.length - 1].data)}
        </span>
        <button type="button" className="grafico-expandido-fechar" aria-label="Fechar" onClick={onFechar}>
          <X size={16} />
        </button>
      </div>

      <div className="grafico-expandido-leitura">
        <span className={`saldo-grande ${valorSelecionado < 0 ? 'negativo' : 'positivo'}`}>
          {formatarSaldo(valorSelecionado)}
        </span>
        <span className="sub" data-testid="grafico-expandido-leitura-data">
          {semana(selecionado)}, {formatarDataBR(selecionado)}{quando}
        </span>
      </div>

      {/* Sempre presente, com altura mínima fixa: se o cartão sumisse em dia sem movimento,
          o gráfico mudaria de altura enquanto o dedo desliza. */}
      <div className="grafico-expandido-dia" data-testid="grafico-expandido-dia">
        <div className="grafico-expandido-dia-linha">
          <span className="sub">Variação no dia</span>
          <span className={`delta ${variacaoSel >= 0 ? 'pos' : 'neg'}`}>
            {variacaoSel > 0 ? '+' : ''}{formatarSaldo(variacaoSel)}
          </span>
        </div>
        {itensSel.slice(0, ITENS_NO_CARTAO).map((i) => (
          <div key={i.id} className="grafico-expandido-dia-linha">
            <span>{i.rotulo}</span>
            <span className={classeEfeito(i.efeito)}>{formatarSaldo(i.efeito)}</span>
          </div>
        ))}
        {itensSel.length > ITENS_NO_CARTAO && (
          <span className="sub">e mais {itensSel.length - ITENS_NO_CARTAO}</span>
        )}
        {itensSel.length === 0 && <span className="sub">Nenhum lançamento neste dia.</span>}
      </div>

      <div
        className="grafico-expandido-area" data-testid="grafico-expandido-area" ref={areaRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${uid}-n`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="var(--neg)" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <YAxis hide domain={dominioY} />
            <XAxis
              dataKey="data" tickFormatter={(d: ISODate) => ddmm(d)} minTickGap={32}
              tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <ReferenceLine
              y={0} stroke="var(--line)" strokeWidth={1}
              label={{ value: '0', position: 'insideBottomLeft', fill: 'var(--muted)', fontSize: 10 }}
            />
            {max > 0 && (
              <ReferenceLine
                y={max} stroke="var(--line)" strokeDasharray="1 4"
                label={{ value: formatarSaldo(max), position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 10 }}
              />
            )}
            {cenario ? (
              <>
                <ReferenceLine
                  y={real.min} stroke="var(--line)" strokeDasharray="1 4"
                  label={{
                    value: `${formatarSaldo(real.min)} · real`, fill: 'var(--muted)', fontSize: 10,
                    position: real.min <= cenario.min ? 'insideBottomLeft' : 'insideTopLeft',
                  }}
                />
                {cenario.min !== real.min && (
                  <ReferenceLine
                    y={cenario.min} stroke="var(--ac)" strokeDasharray="1 4"
                    label={{
                      value: `${formatarSaldo(cenario.min)} · cenário`, fill: 'var(--ac)', fontSize: 10,
                      position: cenario.min < real.min ? 'insideBottomLeft' : 'insideTopLeft',
                    }}
                  />
                )}
              </>
            ) : min < 0 && (
              <ReferenceLine
                y={min} stroke="var(--line)" strokeDasharray="1 4"
                label={{ value: formatarSaldo(min), position: 'insideBottomLeft', fill: 'var(--muted)', fontSize: 10 }}
              />
            )}
            {hojeVisivel && <ReferenceLine x={hojeData} stroke="var(--muted)" strokeDasharray="2 2" />}
            <Area
              type="linear" dataKey="fundoPos" stroke="none" baseValue={0} fill={`url(#${uid}-g)`}
              isAnimationActive={false} activeDot={false}
            />
            <Area
              type="linear" dataKey="fundoNeg" stroke="none" baseValue={0} fill={`url(#${uid}-n)`}
              isAnimationActive={false} activeDot={false}
            />
            <Area
              type="linear" dataKey="passado" stroke="var(--fg)" strokeWidth={2.5}
              fill="none" isAnimationActive={false} connectNulls={false} activeDot={false}
            />
            <Area
              type="linear" dataKey="futuro" stroke="var(--fg)" strokeWidth={2.5} strokeDasharray="5 4"
              fill="none" isAnimationActive={false} connectNulls={false} activeDot={false}
            />
            {mostrarCenarios && (
              <Area
                type="linear" dataKey="cenario" stroke="var(--ac)" strokeWidth={2} strokeDasharray="1 3"
                fill="none" isAnimationActive={false} connectNulls={false} activeDot={false}
              />
            )}
            {degrau && (
              <ReferenceDot
                x={degrau.data} y={degrau.valor} r={3}
                fill={degrau.sobe ? 'var(--pos)' : 'var(--neg)'} stroke="none"
                label={degrau.rotulo ? {
                  value: degrau.rotulo, position: degrau.aDireita ? 'right' : 'left',
                  fill: 'var(--muted)', fontSize: 10,
                } : undefined}
              />
            )}
            {selecionadoVisivel && (
              <ReferenceLine x={selecionado} stroke="var(--ac)" strokeWidth={1.5} />
            )}
            {selecionadoVisivel && (
              <ReferenceDot
                x={selecionado} y={valorSelecionado} r={4}
                fill="var(--bg)" stroke={valorSelecionado < 0 ? 'var(--neg)' : 'var(--pos)'} strokeWidth={1.4}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grafico-expandido-atalhos">
        <div className="pills">
          {PERIODOS_ATALHO.map((p, i) => (
            <button
              key={p.rotulo} type="button" className={i === ativo ? 'ativo' : ''}
              onClick={() => setJanela(janelaDoPeriodo(hojeIdx, serie.length, p.dias))}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <button
          type="button" className="grafico-expandido-hoje"
          onClick={() => { setJanela(centralizarJanela(janela, hojeIdx, serie.length)); setSelecionado(hojeData); }}
        >
          Hoje
        </button>
      </div>

      {mostrarCenarios && (
        <div className="grafico-expandido-legenda">
          <span className="real"><i /> Real</span>
          <span className="proj"><i /> Projetado</span>
          <span className="cen"><i /> Cenário</span>
        </div>
      )}

      <div className="grafico-expandido-rodape">
        <MinMaxSeries real={real} cenario={cenario} rotulo="na janela" />
      </div>
      <p className="grafico-expandido-dica">
        Arraste para mover · segure e arraste para ver cada dia · dois dedos para aproximar
      </p>
    </div>
  );
}
