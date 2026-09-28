import { mesCurto } from '../domain/dates';
import { classeEfeito, classeSaldo, formatarSaldoSemSimbolo, formatarSemSimbolo } from '../domain/money';
import type { LinhaMes } from '../domain/simulacao';

interface Props {
  linhas: LinhaMes[];
  /** Largura de cada coluna de valor, em caracteres (`larguraColunaValor`). Vem dos extremos
   *  possíveis de todos os cenários, então ligar ou desligar um cenário não a muda. */
  larguraCh: number;
}

// "out/26": 6 caracteres; o padding de cada célula é 8px de cada lado.
const MES_CH = 6;
const PADDING_PX = 16;

/** Tabela mês a mês do Simular: saldo com e sem os cenários, e a diferença. Com e Sem são
 *  saldos (abaixo de zero levam "−"); Diferença é movimento (sem sinal, a cor diz). */
export default function TabelaSimulacao({ linhas, larguraCh }: Props) {
  const minWidth = `calc(${MES_CH + 3 * larguraCh}ch + ${4 * PADDING_PX}px)`;
  return (
    <>
      <p className="sub" style={{ margin: '0 8px 4px', textAlign: 'right' }}>Valores em R$</p>
      <div className="rolavel">
        <table className="tabela tabela-fixa" style={{ minWidth }}>
          <colgroup>
            <col style={{ width: `calc(${MES_CH}ch + ${PADDING_PX}px)` }} />
            <col /><col /><col />
          </colgroup>
          <thead>
            <tr><th>Mês</th><th>Com</th><th>Diferença</th><th>Sem</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
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
    </>
  );
}
