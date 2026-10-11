import { itemFaturaBate } from '../domain/buscaFatura';
import { formatarDataBR, nomeDoMes } from '../domain/dates';
import { useState } from 'react';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, faturaForaDoFluxo, type Fatura,
} from '../domain/fatura';
import { classeEfeito, formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import AvisoFaturaForaDoFluxo from './AvisoFaturaForaDoFluxo';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';
import Sheet from './Sheet';

function LinhaFatura({ item, nomeCat, destaque = false }: {
  item: Fatura['itens'][number]; nomeCat: (id: string) => string; destaque?: boolean;
}) {
  return (
    <div className={destaque ? 'item ativo' : 'item'}>
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

/** `busca`: o texto que levou a esta fatura (busca do Fluxo). As compras que casam com ele sobem
 *  para o grupo "Encontrado na busca". */
export default function FaturaResumo({ lanc, busca = '', onFechar }: {
  lanc: Lancamento; busca?: string; onFechar: () => void;
}) {
  const { dados, hoje, abrirCartao } = useApp();
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

  // A busca pode ter casado só com o lançamento da fatura (o nome do cartão, por exemplo) e não
  // com nenhuma compra: então não há grupo, e a aba Cartão abre sem busca.
  const termo = busca.trim().toLowerCase();
  const encontrados = termo ? itens.filter((i) => itemFaturaBate(i, termo, nomeCatCartao)) : [];
  const restantes = itens.filter((i) => !encontrados.includes(i));
  const porDataDesc = (a: Fatura['itens'][number], b: Fatura['itens'][number]) => b.data.localeCompare(a.data);
  const aVista = restantes.filter((i) => i.totalParcelas === 1).sort(porDataDesc);
  const parceladas = restantes.filter((i) => i.totalParcelas > 1).sort(porDataDesc);
  encontrados.sort(porDataDesc);
  const mostrarGrupos = encontrados.length > 0 || (aVista.length > 0 && parceladas.length > 0);

  const cartaoId = cartao.id;
  function irParaCartao() {
    abrirCartao({ cartaoId, mes, busca: encontrados.length > 0 ? busca.trim() : undefined });
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
            <strong className={classeEfeito(-total)}>{formatarBRL(total)}</strong>
            {' · '}fecha {formatarDataBR(dataFechamento)} · vence {formatarDataBR(dataVencimento)}
          </p>
          <button className="botao-ver-mais" style={{ marginTop: 6 }} onClick={irParaCartao}>
            Ver fatura completa na aba Cartão →
          </button>
        </>
      )}
    >
      {foraDoFluxo && <AvisoFaturaForaDoFluxo situacao={foraDoFluxo} onCorrigir={setCorrigindoCom} />}
      <div className="lista" style={{ marginTop: 8 }}>
        {encontrados.length > 0 && <p className="rotulo-grupo">Encontrado na busca</p>}
        {encontrados.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} destaque />)}
        {mostrarGrupos && aVista.length > 0 && (
          <p className="rotulo-grupo" style={encontrados.length > 0 ? { marginTop: 6 } : undefined}>À vista</p>
        )}
        {aVista.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {mostrarGrupos && parceladas.length > 0 && <p className="rotulo-grupo" style={{ marginTop: 6 }}>Parceladas</p>}
        {parceladas.map((i) => <LinhaFatura key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCatCartao} />)}
        {itens.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
      </div>
    </Sheet>
  );
}
