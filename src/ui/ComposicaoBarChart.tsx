import { classeEfeito, efeitoNoSaldo, formatarBRL, formatarPercentual } from '../domain/money';
import type { TipoCategoria } from '../domain/types';

export interface LinhaComposicao {
  chave: string;
  nome: string;
  badge?: string;
  tipo: TipoCategoria;
  total: number;
  pctDaRenda: number | null;
}

interface Props {
  linhas: LinhaComposicao[];
  base: number;
  onClicarLinha: (chave: string) => void;
  /** texto quando não há linhas */
  vazio?: string;
}

export default function ComposicaoBarChart({ linhas, base, onClicarLinha, vazio = 'Sem movimentos no mês.' }: Props) {
  return (
    <div className="composicao-lista">
      {linhas.map((l) => {
        const percentual = (Math.abs(l.total) / base) * 100;
        const largura = Math.min(100, Math.round(percentual * 100) / 100);
        return (
          <div
            key={l.chave}
            className="composicao-linha"
            role="button"
            tabIndex={0}
            onClick={() => onClicarLinha(l.chave)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClicarLinha(l.chave); }
            }}
          >
            <div className="composicao-rotulo">
              <span className="composicao-nome">
                {l.nome}
                {l.badge && <> <span className="badge">{l.badge}</span></>}
              </span>
              <span className="composicao-valores">
                {l.pctDaRenda != null && <span className="composicao-pct">{formatarPercentual(Math.abs(l.pctDaRenda) * 100)}</span>}
                <strong className={classeEfeito(efeitoNoSaldo(l.total, l.tipo))}>
                  {formatarBRL(l.total)}
                </strong>
              </span>
            </div>
            <div className="composicao-trilho">
              <div
                className={`composicao-preenchimento ${l.tipo === 'ganho' ? 'ganho' : 'gasto'}`}
                style={{ width: `${largura}%` }}
              />
            </div>
          </div>
        );
      })}
      {linhas.length === 0 && <p className="sub">{vazio}</p>}
    </div>
  );
}
