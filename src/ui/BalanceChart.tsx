import { useId } from 'react';
import type { DiaSaldo } from '../domain/projection';
import type { ISODate } from '../domain/types';
import MinMaxSeries from './MinMaxSeries';

interface Props {
  serie: DiaSaldo[];
  hoje: ISODate;
  altura?: number;
  mostrarCenarios?: boolean;
  /** Diz o que o mín/máx cobre (ex.: "no período"). Sem ele, o rodapé fica só com os valores. */
  rotuloMinMax?: string;
}

export default function BalanceChart({ serie, hoje, altura = 160, mostrarCenarios = false, rotuloMinMax }: Props) {
  if (serie.length < 2) return null;
  const valoresReal = serie.flatMap((s) => {
    // a linha "passado" plota saldoEfetivo para os dias já ocorridos; o domínio
    // precisa cobri-lo também, senão ela pode extrapolar o viewBox (ex.: um
    // recebimento confirmado maior que qualquer saldo projetado no horizonte).
    return s.data <= hoje ? [s.saldoProjetado, s.saldoEfetivo] : [s.saldoProjetado];
  });
  // A linha de cenário só é desenhada de hoje em diante; é dela que saem o mín e o máx do cenário.
  const valoresCenario = mostrarCenarios ? serie.filter((s) => s.data >= hoje).map((s) => s.saldoComCenarios) : [];
  // O rodapé mostra o menor e o maior saldo reais; o zero entra só na escala do desenho,
  // para a linha do zero ficar sempre visível (como no FluxoChartModal).
  const real = { min: Math.min(...valoresReal), max: Math.max(...valoresReal) };
  const cenario = valoresCenario.length > 0
    ? { min: Math.min(...valoresCenario), max: Math.max(...valoresCenario) }
    : null;
  const min = Math.min(real.min, cenario?.min ?? real.min);
  const max = Math.max(real.max, cenario?.max ?? real.max);
  const escalaMin = Math.min(min, 0);
  const escalaMax = Math.max(max, 0);
  const amp = escalaMax - escalaMin || 1;
  const x = (i: number) => (i / (serie.length - 1)) * 100;
  const y = (v: number) => 38 - ((v - escalaMin) / amp) * 36;
  const pontos = (sel: { i: number; v: number }[]) =>
    sel.map((p) => `${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  const passado = serie.map((s, i) => ({ i, v: s.saldoEfetivo, data: s.data })).filter((p) => p.data <= hoje);
  const futuro = serie.map((s, i) => ({ i, v: s.saldoProjetado, data: s.data })).filter((p) => p.data >= hoje);
  const cenarios = serie.map((s, i) => ({ i, v: s.saldoComCenarios, data: s.data })).filter((p) => p.data >= hoje);
  const iHoje = serie.findIndex((s) => s.data >= hoje);
  const uid = useId();
  // Série que atravessa anos (o Fluxo vai até o horizonte) mostra o ano nas pontas;
  // dentro de um ano só, dia e mês bastam.
  const cruzaAno = serie[0].data.slice(0, 4) !== serie.at(-1)!.data.slice(0, 4);
  const dataPonta = (d: string) =>
    `${d.slice(8, 10)}/${d.slice(5, 7)}${cruzaAno ? `/${d.slice(0, 4)}` : ''}`;
  const minMax = <MinMaxSeries real={real} cenario={cenario} rotulo={rotuloMinMax} />;
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
        {/* área entre a linha e o zero: verde acima dele, vermelha abaixo (como no modal expandido) */}
        <clipPath id={`${uid}-acima`}><rect x="0" y="0" width="100" height={y(0)} /></clipPath>
        <clipPath id={`${uid}-abaixo`}><rect x="0" y={y(0)} width="100" height="40" /></clipPath>
        {linhaCheia.length > 1 && (
          <>
            <polygon
              points={`${pontos(linhaCheia)} ${x(linhaCheia.at(-1)!.i).toFixed(2)},${y(0).toFixed(2)} ${x(linhaCheia[0].i).toFixed(2)},${y(0).toFixed(2)}`}
              fill={`url(#${uid}-g)`} clipPath={`url(#${uid}-acima)`}
            />
            <polygon
              points={`${pontos(linhaCheia)} ${x(linhaCheia.at(-1)!.i).toFixed(2)},${y(0).toFixed(2)} ${x(linhaCheia[0].i).toFixed(2)},${y(0).toFixed(2)}`}
              fill="var(--neg)" fillOpacity=".16" clipPath={`url(#${uid}-abaixo)`}
            />
          </>
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
      {cruzaAno ? (
        // Com o ano, as datas não cabem na mesma linha do mín/máx num celular estreito.
        <div className="grafico-rodape duas-linhas">
          <div className="grafico-rodape-datas">
            <span>{dataPonta(serie[0].data)}</span>
            <span>{dataPonta(serie.at(-1)!.data)}</span>
          </div>
          <div className="grafico-rodape-minmax">{minMax}</div>
        </div>
      ) : (
        <div className="grafico-rodape">
          <span>{dataPonta(serie[0].data)}</span>
          <span>{minMax}</span>
          <span>{dataPonta(serie.at(-1)!.data)}</span>
        </div>
      )}
    </div>
  );
}
