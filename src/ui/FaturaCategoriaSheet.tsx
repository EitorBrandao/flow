import { calcularFaturas, datasFaturaDoMes, resumoPorCategoria } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Cartao, CategoriaCartao, CompraCartao, ISODate } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  cartao: Cartao | null;
  mes: string;
  comprasCartao: CompraCartao[];
  categoriasCartao: CategoriaCartao[];
  horizonteProjecao: ISODate;
  onFechar: () => void;
  onAbrirCartao: () => void;
}

export default function FaturaCategoriaSheet({
  aberto, cartao, mes, comprasCartao, categoriasCartao, horizonteProjecao, onFechar, onAbrirCartao,
}: Props) {
  if (!cartao) return null;
  const compras = comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataVencimento } = datasFaturaDoMes(cartao, mes);
  const ate = dataVencimento > horizonteProjecao ? dataVencimento : horizonteProjecao;
  const fatura = calcularFaturas(cartao, compras, ate).find((f) => f.mes === mes)
    ?? { mes, dataFechamento: dataVencimento, dataVencimento, itens: [], totalCent: 0 };
  const resumo = resumoPorCategoria(fatura);
  const nomeCat = (id: string) => categoriasCartao.find((c) => c.id === id)?.nome ?? '?';

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={cartao.nome}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{cartao.nome}</h2>
        <strong className="valor-gasto">{formatarBRL(fatura.totalCent)}</strong>
      </div>
      <p className="sub" style={{ margin: '2px 0 10px' }}>
        fatura de {mes.split('-').reverse().join('/')} · vence {dataVencimento.split('-').reverse().join('/')}
      </p>
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
