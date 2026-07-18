import { calcularFaturas } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import Sheet from './Sheet';

export default function FaturaResumo({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { dados, setAba } = useApp();
  if (!dados) return null;
  const cartao = dados.cartoes.find((c) => c.id === lanc.cartaoId);
  if (!cartao) return null;
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const fatura = calcularFaturas(cartao, compras, dados.config.horizonteProjecao)
    .find((f) => f.mes === lanc.faturaMes);
  const itens = fatura?.itens ?? [];
  const nomeCatCartao = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const mesBonito = (lanc.faturaMes ?? '').split('-').reverse().join('/');

  function editar() {
    setAba('cartao');
    onFechar();
  }

  return (
    <Sheet aberto onFechar={onFechar} rotulo={`Fatura ${cartao.nome}`}>
      <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura {mesBonito}</h2>
      <p className="sub" style={{ margin: 0 }}>Total: <strong className="valor-gasto">{formatarBRL(lanc.valor)}</strong></p>
      <div className="lista" style={{ marginTop: 8 }}>
        {itens.map((i) => (
          <div className="item" key={`${i.compraId}:${i.parcela}`}>
            <div className="cresce">
              <div>{i.descricao ?? nomeCatCartao(i.categoriaCartaoId)}</div>
              <div className="sub">
                {i.data.split('-').reverse().join('/')} · {nomeCatCartao(i.categoriaCartaoId)}
                {i.totalParcelas > 1 ? ` · ${i.parcela}/${i.totalParcelas}` : ''}
              </div>
            </div>
            <span className="valor-gasto">{formatarBRL(i.valorCent)}</span>
          </div>
        ))}
        {itens.length === 0 && <p className="sub">Nenhum lançamento nesta fatura.</p>}
      </div>
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="botao botao-primario" onClick={editar}>Editar</button>
        <button className="botao" onClick={onFechar}>Fechar</button>
      </div>
    </Sheet>
  );
}
