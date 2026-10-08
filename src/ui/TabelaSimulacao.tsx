import { mesCurto } from '../domain/dates';
import { classeEfeito, classeSaldo, formatarSaldoSemSimbolo, formatarSemSimbolo } from '../domain/money';
import type { LinhaMes } from '../domain/simulacao';

interface Props {
  linhas: LinhaMes[];
  /** Largura de cada coluna de valor, em caracteres (`larguraColunaValor`). Vem dos extremos
   *  possíveis de todos os cenários, então ligar ou desligar um cenário não a muda. */
  larguraCh: number;
  aberta: boolean;
  onAlternar: () => void;
  /** Sem cenário ligado: só o saldo real (Mês e Saldo). Com e Diferença só existem com cenário. */
  soReal?: boolean;
}

// "out/26": 6 caracteres; o padding de cada célula é 8px de cada lado.
const MES_CH = 6;
const PADDING_PX = 16;

/** Tabela mês a mês do Simular: saldo com e sem os cenários, e a diferença. Com e Sem são
 *  saldos (abaixo de zero levam "−"); Diferença é movimento (sem sinal, a cor diz).
 *  Com `soReal`, mostra só o saldo real. */
export default function TabelaSimulacao({ linhas, larguraCh, aberta, onAlternar, soReal = false }: Props) {
  const colunas = soReal ? 2 : 4;
  const minWidth = `calc(${MES_CH + (colunas - 1) * larguraCh}ch + ${colunas * PADDING_PX}px)`;
  return (
    <>
      <button
        type="button" className="botao-ver-mais" aria-expanded={aberta} onClick={onAlternar}
        style={{ display: 'block', margin: '0 16px 8px' }}
      >
        Tabela por mês <span aria-hidden="true">{aberta ? '▲' : '▼'}</span>
      </button>

      {aberta && (
        <>
          <p className="sub" style={{ margin: '0 8px 4px', textAlign: 'right' }}>Valores em R$</p>
          <div className="rolavel rolavel-12">
            <table className="tabela tabela-fixa" style={{ minWidth }}>
              <colgroup>
                <col style={{ width: `calc(${MES_CH}ch + ${PADDING_PX}px)` }} />
                {soReal ? <col /> : <><col /><col /><col /></>}
              </colgroup>
              <thead>
                {soReal
                  ? <tr><th>Mês</th><th>Saldo</th></tr>
                  : <tr><th>Mês</th><th>Com</th><th>Diferença</th><th>Sem</th></tr>}
              </thead>
              <tbody>
                {linhas.map((l) => soReal ? (
                  <tr key={l.mes}>
                    <td>{mesCurto(l.mes)}</td>
                    <td><strong className={classeSaldo(l.sem)}>{formatarSaldoSemSimbolo(l.sem)}</strong></td>
                  </tr>
                ) : (
                  <tr key={l.mes}>
                    <td>{mesCurto(l.mes)}</td>
                    <td><strong className={classeSaldo(l.com)}>{formatarSaldoSemSimbolo(l.com)}</strong></td>
                    <td>
                      {l.dif === 0 ? <strong className="valor-neutro">—</strong> : <strong className={classeEfeito(l.dif)}>{formatarSemSimbolo(l.dif)}</strong>}
                    </td>
                    <td><strong className={classeSaldo(l.sem)}>{formatarSaldoSemSimbolo(l.sem)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ margin: '8px 16px 12px' }}>
            {soReal
              ? 'Saldo real no fim de cada mês. Ligue um cenário para ver o saldo com ele e a diferença.'
              : 'Saldo no fim de cada mês. Com: contando os cenários ligados. Sem: só o saldo real. Diferença: o quanto os cenários mudam.'}
          </p>
        </>
      )}
    </>
  );
}
