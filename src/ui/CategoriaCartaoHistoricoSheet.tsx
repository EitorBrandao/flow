import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { rotuloIntervalo } from '../domain/periodo';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  cartao: Cartao | null;
  categoria: CategoriaCartao | null;
  mes: string;
  /** meses do período (2+); sem ele, os 6 meses até `mes` */
  periodo?: readonly string[];
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onFechar: () => void;
}

/** Folha somente leitura: uma categoria do cartão nos 6 meses de fatura que terminam em `mes`,
 *  ou nos meses de `periodo`, em barras (100% = maior mês), com a média dos 6. Mesma conta da tabela de Análises. */
export default function CategoriaCartaoHistoricoSheet({
  aberto, cartao, categoria, mes, periodo, comprasCartao, ajustesFechamento, onFechar,
}: Props) {
  if (!cartao || !categoria) return null;
  const meses: readonly string[] = periodo ?? [-5, -4, -3, -2, -1, 0].map((n) => addMeses(mes, n));
  const serie = totaisCategoriaCartaoPorMes(
    cartao,
    comprasCartao.filter((c) => c.cartaoId === cartao.id),
    meses,
    ajustesDoCartao(ajustesFechamento, cartao.id),
  ).get(categoria.id) ?? meses.map(() => 0);
  const maior = Math.max(...serie.map(Math.abs));
  const media = Math.round(serie.reduce((a, b) => a + b, 0) / serie.length);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));
  const titulo = `${categoria.nome} · ${cartao.nome}`;

  return (
    <Sheet
      aberto={aberto} onFechar={onFechar} rotulo={titulo}
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{titulo}</h2>
          <p className="sub" style={{ margin: 0 }}>
            {periodo ? `${rotuloIntervalo(periodo)}, pelo mês da fatura` : 'últimos 6 meses, pelo mês da fatura'}
          </p>
        </>
      )}
    >
      <div className="composicao-lista">
        {meses.map((m, i) => {
          const v = serie[i];
          const largura = maior === 0 ? 0 : Math.round((Math.abs(v) / maior) * 10000) / 100;
          return (
            <div className="composicao-linha" key={m} style={{ cursor: 'default' }}>
              <div className="composicao-rotulo">
                <span className="composicao-nome">{mesAbreviado(m)}</span>
                <span className="composicao-valores">
                  <strong className={cor(v)}>{formatarBRL(v)}</strong>
                </span>
              </div>
              <div className="composicao-trilho">
                <div className={`composicao-preenchimento ${v < 0 ? 'ganho' : 'gasto'}`} style={{ width: `${largura}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        {periodo ? 'média por mês' : 'média 6m'} <strong className={cor(media)}>{formatarBRL(media)}</strong>
      </p>
    </Sheet>
  );
}
