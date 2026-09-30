import { Fragment } from 'react';
import { compararCategoriasCartao } from '../domain/categorias';
import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import {
  anoAnteriorRepete, notaComparacao, periodoAnoAnterior, periodoAnterior,
} from '../domain/periodo';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ID } from '../domain/types';

export interface LinhaCategoriaCartao {
  cartaoId: ID;
  categoriaCartaoId: ID;
}

interface Props {
  mes: string;
  /** período de 2+ meses (Análises fora do modo Mês); sem ele, as colunas do modo Mês */
  periodo?: readonly string[];
  /** cabeçalho da coluna do período ("2025", "12 meses", "7 meses") */
  rotuloPeriodo?: string;
  boxIds: readonly ID[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onAbrir: (linha: LinhaCategoriaCartao) => void;
}

/** Uma coluna de valor: soma dos meses listados, dividida por `divisor` (média) e arredondada. */
interface Coluna {
  cabecalho: string;
  meses: readonly string[];
  divisor: number;
  /** coluna de média: não conta para decidir se a linha aparece */
  media: boolean;
}

function colunasDoMes(mes: string): Coluna[] {
  return [
    { cabecalho: mesAbreviado(mes), meses: [mes], divisor: 1, media: false },
    { cabecalho: 'mês anterior', meses: [addMeses(mes, -1)], divisor: 1, media: false },
    { cabecalho: 'ano passado', meses: [addMeses(mes, -12)], divisor: 1, media: false },
    { cabecalho: 'média 3m', meses: [addMeses(mes, -2), addMeses(mes, -1), mes], divisor: 3, media: true },
  ];
}

function colunasDoPeriodo(meses: readonly string[], rotulo: string): Coluna[] {
  return [
    { cabecalho: rotulo, meses, divisor: 1, media: false },
    { cabecalho: 'anterior', meses: periodoAnterior(meses), divisor: 1, media: false },
    ...(anoAnteriorRepete(meses)
      ? []
      : [{ cabecalho: 'ano anterior', meses: periodoAnoAnterior(meses), divisor: 1, media: false }]),
    { cabecalho: 'média/mês', meses, divisor: meses.length, media: true },
  ];
}

/**
 * Card "Categorias do cartão" de Análises: para cada cartão das boxes selecionadas (ativo ou
 * não — desativado ainda tem histórico), cada categoria do cartão pelo mês da fatura. No modo
 * Mês: mês × mês anterior × mesmo mês do ano passado × média 3m. Com um período de vários
 * meses: período × anterior × ano anterior (some com 12 meses) × média/mês — as mesmas colunas
 * do Comparativo. A linha aparece se alguma coluna que não é média tem valor. Linhas em ordem
 * decrescente da 1ª coluna.
 */
export default function CategoriasCartaoCard({
  mes, periodo, rotuloPeriodo, boxIds, cartoes, categoriasCartao, comprasCartao, ajustesFechamento, onAbrir,
}: Props) {
  const varios = periodo != null && periodo.length > 1;
  const colunas = varios ? colunasDoPeriodo(periodo, rotuloPeriodo ?? `${periodo.length} meses`) : colunasDoMes(mes);
  const todos = [...new Set(colunas.flatMap((c) => c.meses))];
  const blocos = cartoes
    .filter((cartao) => boxIds.includes(cartao.boxId))
    .map((cartao) => {
      const totais = totaisCategoriaCartaoPorMes(
        cartao,
        comprasCartao.filter((c) => c.cartaoId === cartao.id),
        todos,
        ajustesDoCartao(ajustesFechamento, cartao.id),
      );
      const linhas = categoriasCartao
        .filter((cat) => cat.cartaoId === cartao.id && totais.has(cat.id))
        .sort(compararCategoriasCartao)
        .map((cat) => {
          const serie = totais.get(cat.id)!;
          const valores = colunas.map((col) =>
            Math.round(col.meses.reduce((s, m) => s + serie[todos.indexOf(m)], 0) / col.divisor));
          return { categoria: cat, valores };
        })
        .filter((l) => l.valores.some((v, i) => !colunas[i].media && v !== 0))
        // maior gasto primeiro, como o Cartão → Resumo; empate pela 2ª coluna e, por fim, pela
        // ordem das categorias do cartão (o sort é estável)
        .sort((a, b) => b.valores[0] - a.valores[0] || b.valores[1] - a.valores[1]);
      return { cartao, linhas };
    })
    .filter((b) => b.linhas.length > 0);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));

  return (
    <div className="card">
      <h2>Categorias do cartão</h2>
      <p className="sub" style={{ margin: '2px 2px 0' }}>
        pelo mês da fatura{varios ? ` · ${notaComparacao(periodo)}` : ''}
      </p>
      {blocos.length === 0 ? (
        <p className="sub">Sem gastos no cartão para comparar.</p>
      ) : (
        <div className="rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Categoria</th>{colunas.map((c) => <th key={c.cabecalho}>{c.cabecalho}</th>)}</tr>
            </thead>
            <tbody>
              {blocos.map(({ cartao, linhas }) => (
                <Fragment key={cartao.id}>
                  {blocos.length > 1 && (
                    <tr>
                      {/* o nome vai na 1ª célula (a coluna fixa), nunca num colSpan: uma célula
                          mais larga que a coluna fixa rola junto com os valores */}
                      <td style={{ whiteSpace: 'nowrap' }}><span className="rotulo-grupo">{cartao.nome}</span></td>
                      <td colSpan={colunas.length} />
                    </tr>
                  )}
                  {linhas.map((l) => (
                    <tr key={l.categoria.id}>
                      <td>
                        <button
                          className="tabela-nome-tocavel"
                          onClick={() => onAbrir({ cartaoId: cartao.id, categoriaCartaoId: l.categoria.id })}
                        >
                          {l.categoria.nome}
                        </button>
                      </td>
                      {l.valores.map((v, i) => (
                        <td key={colunas[i].cabecalho} className={cor(v)}>{formatarBRL(v)}</td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
