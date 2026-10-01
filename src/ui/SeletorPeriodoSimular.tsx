import { addMeses, mesDe, mesAbreviado } from '../domain/dates';
import { ajustarAteSim, ajustarDeSim, type PeriodoSimulacao } from '../domain/simulacao';

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

interface Props {
  periodo: PeriodoSimulacao;
  /** mês de hoje ('AAAA-MM'): marca o piso do período inicial */
  mesHoje: string;
  /** horizonte do app (ISODate) para calcular o aviso de faturas de cartão */
  horizonte: string;
  onMudar: (p: PeriodoSimulacao) => void;
}

/** Seletor de período do Simular: setas ‹ › e seletores de mês e ano em duas linhas "de" e "até".
 *  Padrão: até 60 meses. Aviso se ultrapassar o horizonte: faturas de cartão não vêm além dele. */
export default function SeletorPeriodoSimular({ periodo, mesHoje, horizonte, onMudar }: Props) {
  const [anoHoje] = mesHoje.split('-').map(Number);
  const mesHorizonte = mesDe(horizonte);
  const ultrapassaHorizonte = periodo.ate > mesHorizonte;

  const mesesEntrePeriodo = [];
  let m = periodo.de;
  while (m <= periodo.ate) {
    mesesEntrePeriodo.push(m);
    m = addMeses(m, 1);
  }

  function atualizarDe(novoDe: string) {
    onMudar(ajustarDeSim(periodo, novoDe, mesHoje));
  }

  function atualizarAte(novoAte: string) {
    onMudar(ajustarAteSim(periodo, novoAte, mesHoje));
  }

  const [anoInicial, mesInicial] = periodo.de.split('-').map(Number);
  const [anoFinal, mesFinal] = periodo.ate.split('-').map(Number);

  const anosDisponiveis = Array.from(
    { length: (anoHoje + 5) - anoHoje + 1 },
    (_, i) => anoHoje + i,
  );

  return (
    <div className="card" style={{ padding: '8px 16px' }}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button
          className="botao"
          aria-label="Mês inicial anterior"
          onClick={() => atualizarDe(addMeses(periodo.de, -1))}
        >
          ‹
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span className="sub">de</span>
          <span className="campo" style={{ flex: 1, minWidth: 0 }}>
            <select
              aria-label="Mês inicial"
              value={mesInicial}
              onChange={(e) => atualizarDe(`${anoInicial}-${String(Number(e.target.value)).padStart(2, '0')}`)}
            >
              {NOMES_MES.map((nome, i) => (
                <option key={nome} value={i + 1}>{nome}</option>
              ))}
            </select>
          </span>
          <span className="campo" style={{ flex: 1, minWidth: 0 }}>
            <select
              aria-label="Ano inicial"
              value={anoInicial}
              onChange={(e) => atualizarDe(`${e.target.value}-${String(mesInicial).padStart(2, '0')}`)}
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </span>
        </span>
        <button
          className="botao"
          aria-label="Mês inicial seguinte"
          onClick={() => atualizarDe(addMeses(periodo.de, 1))}
        >
          ›
        </button>
      </div>

      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button
          className="botao"
          aria-label="Mês final anterior"
          onClick={() => atualizarAte(addMeses(periodo.ate, -1))}
        >
          ‹
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span className="sub">até</span>
          <span className="campo" style={{ flex: 1, minWidth: 0 }}>
            <select
              aria-label="Mês final"
              value={mesFinal}
              onChange={(e) => atualizarAte(`${anoFinal}-${String(Number(e.target.value)).padStart(2, '0')}`)}
            >
              {NOMES_MES.map((nome, i) => (
                <option key={nome} value={i + 1}>{nome}</option>
              ))}
            </select>
          </span>
          <span className="campo" style={{ flex: 1, minWidth: 0 }}>
            <select
              aria-label="Ano final"
              value={anoFinal}
              onChange={(e) => atualizarAte(`${e.target.value}-${String(mesFinal).padStart(2, '0')}`)}
            >
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </span>
        </span>
        <button
          className="botao"
          aria-label="Mês final seguinte"
          onClick={() => atualizarAte(addMeses(periodo.ate, 1))}
        >
          ›
        </button>
      </div>

      <div className="linha" style={{ justifyContent: 'center' }}>
        <span className="sub">
          {mesesEntrePeriodo.length} {mesesEntrePeriodo.length === 1 ? 'mês' : 'meses'} · máximo de 60
        </span>
      </div>

      {ultrapassaHorizonte && (
        <p className="sub" style={{ margin: '8px 0 0' }}>
          Depois de {mesAbreviado(mesHorizonte)}, a tabela não inclui faturas de cartão.
        </p>
      )}
    </div>
  );
}
