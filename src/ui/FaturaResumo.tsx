import { calcularFaturas, type Fatura } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import Sheet from './Sheet';

function LinhaFatura({ item, nomeCat }: { item: Fatura['itens'][number]; nomeCat: (id: string) => string }) {
  return (
    <div className="item">
      <div className="cresce">
        <div>{item.descricao ?? nomeCat(item.categoriaCartaoId)}</div>
        <div className="sub">
          {item.data.split('-').reverse().join('/')} · {nomeCat(item.categoriaCartaoId)}
          {item.totalParcelas > 1 ? ` · ${item.parcela}/${item.totalParcelas}` : ''}
        </div>
      </div>
      <span className="valor-gasto">{formatarBRL(item.valorCent)}</span>
    </div>
  );
}

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

  const aVista = itens.filter((i) => i.totalParcelas === 1).sort((a, b) => b.data.localeCompare(a.data));
  const parceladas = itens.filter((i) => i.totalParcelas > 1).sort((a, b) => b.data.localeCompare(a.data));
  const mostrarGrupos = aVista.length > 0 && parceladas.length > 0;

  function abrirCartao() {
    setAba('cartao');
    onFechar();
  }

  return (
    <Sheet
      aberto onFechar={onFechar} rotulo={`Fatura ${cartao.nome}`}
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura {mesBonito}</h2>
          <p className="sub" style={{ margin: 0 }}>Total: <strong className="valor-gasto">{formatarBRL(lanc.valor)}</strong></p>
        </>
      )}
    >
      <div className="lista" style={{ marginTop: 8 }}>
        {mostrarGrupos && <p className="rotulo-grupo">À vista</p>}
        {aVista.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {mostrarGrupos && <p className="rotulo-grupo" style={{ marginTop: 6 }}>Parceladas</p>}
        {parceladas.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {itens.length === 0 && <p className="sub">Nenhum lançamento nesta fatura.</p>}
      </div>
      <button className="botao-ver-mais" style={{ marginTop: 10 }} onClick={abrirCartao}>
        Ver fatura completa na aba Cartão →
      </button>
    </Sheet>
  );
}
