import { formatarBRL } from '../domain/money';
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
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default function ComposicaoBarChart({ linhas, base, onClicarLinha }: Props) {
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
                {l.pctDaRenda != null && <span className="composicao-pct">{pct(l.pctDaRenda)}</span>}
                <strong className={l.tipo === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
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
      {linhas.length === 0 && <p className="sub">Sem movimentos no mês.</p>}
    </div>
  );
}
