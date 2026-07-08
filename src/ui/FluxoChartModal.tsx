import { useEffect, useId, useState } from 'react';
import {
  Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import { formatarBRL } from '../domain/money';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import { janelaInicial, type Janela } from './chartGestures';

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

      <div className="grafico-expandido-area" data-testid="grafico-expandido-area">
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
