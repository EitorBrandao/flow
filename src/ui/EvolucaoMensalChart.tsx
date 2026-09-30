import {
  Bar, ComposedChart, Line, ResponsiveContainer, XAxis,
} from 'recharts';
import type { ResumoMesSimples } from '../domain/aggregations';
import { mesCurto } from '../domain/dates';
import { classeEfeito, formatarBRL, formatarSobraCompacta } from '../domain/money';

interface Props {
  serie: ResumoMesSimples[];
  /** mês em destaque no eixo; `null` = nenhum (período de vários meses) */
  mesAtual: string | null;
}

interface TickProps {
  x: number | string;
  y: number | string;
  payload: { value: string };
}

/** Acima disso, os rótulos de sobra de cada mês se sobrepõem no celular. */
const MAX_ROTULOS_SOBRA = 6;
/** Acima disso, o eixo mostra um mês a cada 3, com o ano (jan/25). */
const MAX_ROTULOS_EIXO = 12;

function rotuloMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
}

export default function EvolucaoMensalChart({ serie, mesAtual }: Props) {
  const longo = serie.length > MAX_ROTULOS_EIXO;
  const sobraTotal = serie.reduce((s, m) => s + m.sobra, 0);
  return (
    <div>
      {serie.length <= MAX_ROTULOS_SOBRA ? (
        <div className="evolucao-rotulos-sobra">
          {serie.map((s) => (
            <span
              key={s.mes}
              className={`evolucao-sobra${s.sobra > 0 ? ' pos' : s.sobra < 0 ? ' neg' : ''}`}
            >
              {formatarSobraCompacta(s.sobra)}
            </span>
          ))}
        </div>
      ) : (
        <p className="sub" style={{ margin: '0 0 4px' }}>
          sobra do período <strong className={classeEfeito(sobraTotal)}>{formatarBRL(sobraTotal)}</strong>
        </p>
      )}
      <div className="evolucao-area">
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={serie} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="mes"
              interval={longo ? 2 : 0}
              tick={({ x, y, payload }: TickProps) => {
                const ativo = payload.value === mesAtual;
                return (
                  <text
                    x={x} y={Number(y) + 12} textAnchor="middle" fontSize={11}
                    fontWeight={ativo ? 700 : 400} fill={ativo ? 'var(--fg)' : 'var(--muted)'}
                  >
                    {longo ? mesCurto(payload.value) : rotuloMes(payload.value)}
                  </text>
                );
              }}
              axisLine={{ stroke: 'var(--line)' }} tickLine={false}
            />
            <Bar dataKey="ganhos" fill="var(--pos)" radius={[3, 3, 0, 0]} barSize={longo ? 4 : 9} isAnimationActive={false} />
            <Bar dataKey="gastos" fill="var(--neg)" radius={[3, 3, 0, 0]} barSize={longo ? 4 : 9} isAnimationActive={false} />
            <Line
              type="linear" dataKey="ganhos" stroke="var(--pos)" strokeWidth={1.6}
              strokeDasharray="5 4" dot={false} isAnimationActive={false}
            />
            <Line
              type="linear" dataKey="gastos" stroke="var(--neg)" strokeWidth={1.6}
              strokeDasharray="5 4" dot={false} isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="evolucao-legenda">
        <span><i className="evolucao-legenda-cor ganho" /> ganhos</span>
        <span><i className="evolucao-legenda-cor gasto" /> gastos</span>
        <span>‐ ‐ linha tracejada = tendência</span>
      </div>
    </div>
  );
}
