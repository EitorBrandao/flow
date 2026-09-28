import { Fragment } from 'react';
import { mediaMovel3 } from '../domain/aggregations';
import { compararCategoriasCartao } from '../domain/categorias';
import { addMeses, mesAbreviado } from '../domain/dates';
import { ajustesDoCartao, totaisCategoriaCartaoPorMes } from '../domain/fatura';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ID } from '../domain/types';

export interface LinhaCategoriaCartao {
  cartaoId: ID;
  categoriaCartaoId: ID;
}

interface Props {
  mes: string;
  boxIds: readonly ID[];
  cartoes: Cartao[];
  categoriasCartao: CategoriaCartao[];
  comprasCartao: CompraCartao[];
  ajustesFechamento: AjusteFechamento[];
  onAbrir: (linha: LinhaCategoriaCartao) => void;
}

/**
 * Card "Categorias do cartão" de Análises: para cada cartão das boxes selecionadas (ativo ou
 * não — desativado ainda tem histórico), cada categoria do cartão no mês da fatura × mês
 * anterior × mesmo mês do ano passado × média 3m. Mesmas colunas e mesma regra de linha do
 * Comparativo: a linha aparece se algum dos três meses tem valor.
 */
export default function CategoriasCartaoCard({
  mes, boxIds, cartoes, categoriasCartao, comprasCartao, ajustesFechamento, onAbrir,
}: Props) {
  // posições: 0 = ano passado, 1 = mês − 2, 2 = mês anterior, 3 = mês escolhido
  const meses = [addMeses(mes, -12), addMeses(mes, -2), addMeses(mes, -1), mes];
  const blocos = cartoes
    .filter((cartao) => boxIds.includes(cartao.boxId))
    .map((cartao) => {
      const totais = totaisCategoriaCartaoPorMes(
        cartao,
        comprasCartao.filter((c) => c.cartaoId === cartao.id),
        meses,
        ajustesDoCartao(ajustesFechamento, cartao.id),
      );
      const linhas = categoriasCartao
        .filter((cat) => cat.cartaoId === cartao.id && totais.has(cat.id))
        .sort(compararCategoriasCartao)
        .map((cat) => {
          const [anoPassado, doisAntes, anterior, atual] = totais.get(cat.id)!;
          const media = mediaMovel3([doisAntes, anterior, atual]).at(-1) ?? 0;
          return { categoria: cat, atual, anterior, anoPassado, media };
        })
        .filter((l) => l.atual !== 0 || l.anterior !== 0 || l.anoPassado !== 0);
      return { cartao, linhas };
    })
    .filter((b) => b.linhas.length > 0);
  const cor = (v: number) => classeEfeito(efeitoNoSaldo(v, 'gasto'));

  return (
    <div className="card">
      <h2>Categorias do cartão</h2>
      <p className="sub" style={{ margin: '2px 2px 0' }}>pelo mês da fatura</p>
      {blocos.length === 0 ? (
        <p className="sub">Sem gastos no cartão para comparar.</p>
      ) : (
        <div className="rolavel">
          <table className="tabela">
            <thead>
              <tr><th>Categoria</th><th>{mesAbreviado(mes)}</th><th>mês anterior</th><th>ano passado</th><th>média 3m</th></tr>
            </thead>
            <tbody>
              {blocos.map(({ cartao, linhas }) => (
                <Fragment key={cartao.id}>
                  {blocos.length > 1 && (
                    <tr>
                      {/* o nome vai na 1ª célula (a coluna fixa), nunca num colSpan: uma célula
                          mais larga que a coluna fixa rola junto com os valores */}
                      <td style={{ whiteSpace: 'nowrap' }}><span className="rotulo-grupo">{cartao.nome}</span></td>
                      <td colSpan={4} />
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
                      <td className={cor(l.atual)}>{formatarBRL(l.atual)}</td>
                      <td className={cor(l.anterior)}>{formatarBRL(l.anterior)}</td>
                      <td className={cor(l.anoPassado)}>{formatarBRL(l.anoPassado)}</td>
                      <td className={cor(l.media)}>{formatarBRL(l.media)}</td>
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
