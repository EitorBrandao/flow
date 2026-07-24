import { useId } from 'react';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import { formatarBRL } from '../domain/money';

interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  altura?: number;
  mostrarCenarios?: boolean;
}

export default function BalanceChart({ serie, hoje, altura = 160, mostrarCenarios = false }: Props) {
  if (serie.length < 2) return null;
  const valores = serie.flatMap((s) => {
    const v = mostrarCenarios ? [s.saldoProjetado, s.saldoComCenarios] : [s.saldoProjetado];
    // a linha "passado" plota saldoEfetivo para os dias já ocorridos; o domínio
    // precisa cobri-lo também, senão ela pode extrapolar o viewBox (ex.: um
    // recebimento confirmado maior que qualquer saldo projetado no horizonte).
    return s.data <= hoje ? [...v, s.saldoEfetivo] : v;
  });
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);
  const amp = max - min || 1;
  const x = (i: number) => (i / (serie.length - 1)) * 100;
  const y = (v: number) => 38 - ((v - min) / amp) * 36;
  const pontos = (sel: { i: number; v: number }[]) =>
    sel.map((p) => `${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  const passado = serie.map((s, i) => ({ i, v: s.saldoEfetivo, data: s.data })).filter((p) => p.data <= hoje);
  const futuro = serie.map((s, i) => ({ i, v: s.saldoProjetado, data: s.data })).filter((p) => p.data >= hoje);
  const cenarios = serie.map((s, i) => ({ i, v: s.saldoComCenarios, data: s.data })).filter((p) => p.data >= hoje);
  const iHoje = serie.findIndex((s) => s.data >= hoje);
  const uid = useId();
  const ultimoPassado = passado.at(-1)?.i ?? -1;
  const linhaCheia = [...passado, ...futuro.filter((f) => f.i > ultimoPassado)];
  return (
    <div>
      <svg
        viewBox="0 0 100 40" preserveAspectRatio="none"
        style={{ width: '100%', height: altura, display: 'block' }}
        role="img" aria-label="Linha do saldo no tempo"
      >
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--pos)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--pos)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {linhaCheia.length > 1 && (
          <polygon
            points={`${pontos(linhaCheia)} ${x(linhaCheia.at(-1)!.i).toFixed(2)},40 ${x(linhaCheia[0].i).toFixed(2)},40`}
            fill={`url(#${uid}-g)`}
          />
        )}
        {/* linha do zero: hairline recessiva, sempre sólida (referência, não dado) */}
        <line
          x1="0" x2="100" y1={y(0)} y2={y(0)}
          stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke"
        />
        {/* marcador do hoje: guia recessiva, tracejada para se distinguir da linha do zero */}
        {iHoje >= 0 && (
          <line
            x1={x(iHoje)} x2={x(iHoje)} y1="0" y2="40"
            stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
          />
        )}
        {/* saldo: uma única série (um hue), estado codificado por padrão de traço:
            sólido = passado/efetivo, tracejado = futuro/projetado, pontilhado = cenário hipotético */}
        {passado.length > 1 && (
          <polyline
            points={pontos(passado)} fill="none" stroke="var(--fg)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        )}
        {futuro.length > 1 && (
          <polyline
            points={pontos(futuro)} fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeDasharray="5 4"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        )}
        {mostrarCenarios && cenarios.length > 1 && (
          <polyline
            points={pontos(cenarios)} fill="none" stroke="var(--ac)" strokeWidth="2" strokeDasharray="1 3"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="grafico-rodape">
        <span>{serie[0].data.slice(8, 10)}/{serie[0].data.slice(5, 7)}</span>
        <span>
          mín <b className={min >= 0 ? 'pos' : 'neg'}>{formatarBRL(min)}</b>
          {' · máx '}
          <b className={max >= 0 ? 'pos' : 'neg'}>{formatarBRL(max)}</b>
        </span>
        <span>{serie.at(-1)!.data.slice(8, 10)}/{serie.at(-1)!.data.slice(5, 7)}</span>
      </div>
    </div>
  );
}
