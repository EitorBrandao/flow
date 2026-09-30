import { mesAbreviado } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { rotuloIntervalo } from '../domain/periodo';
import type { TipoCategoria } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  nome: string;
  tipo: TipoCategoria;
  meses: readonly string[];
  /** total da categoria em cada mês de `meses`, na mesma ordem */
  serie: readonly number[];
  /** o que o toque num mês abre: "os lançamentos" ou "a fatura" */
  verMes: string;
  onAbrirMes: (mes: string) => void;
  onFechar: () => void;
}

/** Folha de uma categoria num período de vários meses (Análises): total, uma barra por mês
 *  (100% = maior mês, mesmas classes `composicao-*` do ComposicaoBarChart) e a média por mês.
 *  Tocar num mês abre a folha daquele mês. */
export default function CategoriaPeriodoSheet({
  aberto, nome, tipo, meses, serie, verMes, onAbrirMes, onFechar,
}: Props) {
  const total = serie.reduce((a, b) => a + b, 0);
  const maior = Math.max(0, ...serie.map(Math.abs));
  const media = meses.length > 0 ? Math.round(total / meses.length) : 0;
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, tipo));

  return (
    <Sheet
      aberto={aberto} onFechar={onFechar} rotulo={nome}
      cabecalho={(
        <>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{nome}</h2>
            <strong className={cor(total)}>{formatarBRL(total)}</strong>
          </div>
          <p className="sub" style={{ margin: 0 }}>{rotuloIntervalo(meses)} · toque num mês para ver {verMes}</p>
        </>
      )}
    >
      <div className="composicao-lista">
        {meses.map((m, i) => {
          const v = serie[i] ?? 0;
          const largura = maior === 0 ? 0 : Math.round((Math.abs(v) / maior) * 10000) / 100;
          return (
            <div
              key={m}
              className="composicao-linha"
              role="button"
              tabIndex={0}
              onClick={() => onAbrirMes(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrirMes(m); }
              }}
            >
              <div className="composicao-rotulo">
                <span className="composicao-nome">{mesAbreviado(m)}</span>
                <span className="composicao-valores"><strong className={cor(v)}>{formatarBRL(v)}</strong></span>
              </div>
              <div className="composicao-trilho">
                <div
                  className={`composicao-preenchimento ${efeitoNoSaldo(v, tipo) > 0 ? 'ganho' : 'gasto'}`}
                  style={{ width: `${largura}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        média por mês <strong className={cor(media)}>{formatarBRL(media)}</strong>
      </p>
    </Sheet>
  );
}
