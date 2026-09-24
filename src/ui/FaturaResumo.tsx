import { formatarDataBR, nomeDoMes } from '../domain/dates';
import { useState } from 'react';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, faturaForaDoFluxo, type Fatura,
} from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import AvisoFaturaForaDoFluxo from './AvisoFaturaForaDoFluxo';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';
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
  const { dados, hoje, setAba } = useApp();
  // Valor com que abre a correção do pagamento; enquanto definido, a folha de pagamento toma
  // o lugar desta (uma folha por vez).
  const [corrigindoCom, setCorrigindoCom] = useState<number | null>(null);
  if (!dados) return null;
  const cartao = dados.cartoes.find((c) => c.id === lanc.cartaoId);
  if (!cartao) return null;
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const mes = lanc.faturaMes ?? '';
  const fatura = calcularFaturas(cartao, compras, dados.config.horizonteProjecao, ajustes)
    .find((f) => f.mes === mes);
  const { dataFechamento, dataVencimento } = fatura ?? datasFaturaDoMes(cartao, mes, ajustes);
  const itens = fatura?.itens ?? [];
  const nomeCatCartao = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const total = lanc.valor;
  const conferencia = dados.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const foraDoFluxo = fatura
    ? faturaForaDoFluxo({ cartao, fatura, compras, lancFatura: lanc, conferencia, hoje })
    : null;

  const aVista = itens.filter((i) => i.totalParcelas === 1).sort((a, b) => b.data.localeCompare(a.data));
  const parceladas = itens.filter((i) => i.totalParcelas > 1).sort((a, b) => b.data.localeCompare(a.data));
  const mostrarGrupos = aVista.length > 0 && parceladas.length > 0;

  function abrirCartao() {
    setAba('cartao');
    onFechar();
  }

  if (corrigindoCom != null) {
    return (
      <PagamentoFaturaSheetModal
        lancamento={lanc} totalFaturaCent={fatura?.totalCent ?? 0} valorInicialCent={corrigindoCom}
        onFechar={onFechar}
      />
    );
  }

  return (
    <Sheet
      aberto onFechar={onFechar} rotulo={`${cartao.nome} · fatura de ${nomeDoMes(mes)}`}
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{cartao.nome} · fatura de {nomeDoMes(mes)}</h2>
          <p className="sub" style={{ margin: 0 }}>
            {total > 0 ? <strong className="valor-gasto">{formatarBRL(total)}</strong> : <strong>{formatarBRL(total)}</strong>}
            {' · '}fecha {formatarDataBR(dataFechamento)} · vence {formatarDataBR(dataVencimento)}
          </p>
        </>
      )}
    >
      {foraDoFluxo && <AvisoFaturaForaDoFluxo situacao={foraDoFluxo} onCorrigir={setCorrigindoCom} />}
      <div className="lista" style={{ marginTop: 8 }}>
        {mostrarGrupos && <p className="rotulo-grupo">À vista</p>}
        {aVista.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {mostrarGrupos && <p className="rotulo-grupo" style={{ marginTop: 6 }}>Parceladas</p>}
        {parceladas.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {itens.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
      </div>
      <button className="botao-ver-mais" style={{ marginTop: 10 }} onClick={abrirCartao}>
        Ver fatura completa na aba Cartão →
      </button>
    </Sheet>
  );
}
