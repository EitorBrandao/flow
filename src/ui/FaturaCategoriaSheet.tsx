import { formatarDataBR, nomeDoMes } from '../domain/dates';
import { ajustesDoCartao, calcularFaturas, datasFaturaDoMes, resumoPorCategoria } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { AjusteFechamento, Cartao, CategoriaCartao, CompraCartao, ISODate } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  cartao: Cartao | null;
  mes: string;
  comprasCartao: CompraCartao[];
  categoriasCartao: CategoriaCartao[];
  horizonteProjecao: ISODate;
  ajustesFechamento?: AjusteFechamento[];
  onFechar: () => void;
  onAbrirCartao: () => void;
}

export default function FaturaCategoriaSheet({
  aberto, cartao, mes, comprasCartao, categoriasCartao, horizonteProjecao, ajustesFechamento = [],
  onFechar, onAbrirCartao,
}: Props) {
  if (!cartao) return null;
  const compras = comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const ajustes = ajustesDoCartao(ajustesFechamento, cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
  const ate = dataVencimento > horizonteProjecao ? dataVencimento : horizonteProjecao;
  const fatura = calcularFaturas(cartao, compras, ate, ajustes).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
  const resumo = resumoPorCategoria(fatura);
  const nomeCat = (id: string) => categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const total = fatura.totalCent;

  return (
    <Sheet
      aberto={aberto} onFechar={onFechar} rotulo={cartao.nome}
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura de {nomeDoMes(mes)}</h2>
          <p className="sub" style={{ margin: 0 }}>
            {total > 0 ? <strong className="valor-gasto">{formatarBRL(total)}</strong> : <strong>{formatarBRL(total)}</strong>}
            {' · '}fecha {formatarDataBR(fatura.dataFechamento)} · vence {formatarDataBR(fatura.dataVencimento)}
          </p>
        </>
      )}
    >
      <div className="lista">
        {resumo.map(([catId, cent]) => (
          <div className="item" key={catId} style={{ cursor: 'default' }}>
            <div className="cresce">{nomeCat(catId)}</div>
            <span className="valor-gasto">{formatarBRL(cent)}</span>
          </div>
        ))}
        {resumo.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
      </div>
      <button className="botao-ver-mais" style={{ marginTop: 10 }} onClick={onAbrirCartao}>
        Ver fatura completa na aba Cartão →
      </button>
    </Sheet>
  );
}
