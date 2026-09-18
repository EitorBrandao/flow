import { useId, useState } from 'react';
import { formatarDataBR } from '../../domain/dates';
import { formatarBRL } from '../../domain/money';
import type { Dados, ISODate } from '../../domain/types';
import { CATEGORIA_A_CLASSIFICAR, totalCorrigidoValido } from '../../importar/conferencia';
import { contraparteNubank } from '../../importar/descricao';
import type { AcaoItem, EstadoItem, ItemConferencia } from '../../importar/tipos';
import CampoValor from '../CampoValor';

export const ROTULOS_ESTADO: Record<EstadoItem, string> = {
  confere: 'Confere',
  previsto: 'Previsto',
  divergente: 'Divergente',
  novo: 'Novo',
  sobra: 'Sobra',
  interno: 'Interno',
};

/** Data usada para ordenar e exibir o item: a do bruto quando existe; senão, a do
 *  lançamento ou da compra do app que a "sobra" referencia. */
export function dataDoItem(item: ItemConferencia, dados: Dados): ISODate {
  if (item.bruto) return item.bruto.data;
  if (item.lancamentoId) {
    return dados.lancamentos.find((l) => l.id === item.lancamentoId)?.data ?? '';
  }
  if (item.compraCartaoId) {
    return dados.comprasCartao.find((c) => c.id === item.compraCartaoId)?.data ?? '';
  }
  return '';
}

/** Para conta, a contraparte extraída da descrição do banco; para cartão, a descrição
 *  crua (já vem limpa da fatura); para "sobra" (sem bruto), a nota do lançamento ou a
 *  descrição da compra do app. */
function descricaoDoItem(item: ItemConferencia, dados: Dados): string {
  if (item.bruto) {
    return item.bruto.fonte === 'conta' ? contraparteNubank(item.bruto.descricao) : item.bruto.descricao;
  }
  if (item.lancamentoId) {
    return dados.lancamentos.find((l) => l.id === item.lancamentoId)?.nota || '(sem nota)';
  }
  if (item.compraCartaoId) {
    return dados.comprasCartao.find((c) => c.id === item.compraCartaoId)?.descricao || '(sem descrição)';
  }
  return '';
}

/** Entrada ou saída: pelo sinal do bruto quando existe; para "sobra", uma compra de
 *  cartão é sempre saída, e um lançamento do app segue o tipo da própria categoria —
 *  o sinal gravado nele não decide isso (ver docs/dominio.md). */
function entradaOuSaida(item: ItemConferencia, dados: Dados): 'entrada' | 'saida' {
  if (item.bruto) return item.bruto.valorCent < 0 ? 'saida' : 'entrada';
  if (item.compraCartaoId) return 'saida';
  if (item.lancamentoId) {
    const l = dados.lancamentos.find((x) => x.id === item.lancamentoId);
    const categoria = dados.categorias.find((c) => c.id === l?.categoriaId);
    return categoria?.tipo === 'ganho' ? 'entrada' : 'saida';
  }
  return 'saida';
}

function valorDoItem(item: ItemConferencia, dados: Dados, totalCorrigidoCent: number | undefined): number {
  if (totalCorrigidoCent != null) return totalCorrigidoCent;
  if (item.bruto) return Math.abs(item.bruto.valorCent);
  if (item.lancamentoId) return dados.lancamentos.find((l) => l.id === item.lancamentoId)?.valor ?? 0;
  if (item.compraCartaoId) return dados.comprasCartao.find((c) => c.id === item.compraCartaoId)?.valorTotal ?? 0;
  return 0;
}

function detalheDoItem(item: ItemConferencia, dados: Dados, totalCorrigidoCent: number | undefined): string | undefined {
  if (item.estado === 'divergente' && item.lancamentoId) {
    const l = dados.lancamentos.find((x) => x.id === item.lancamentoId);
    if (l) return `previsto era ${formatarBRL(l.valor)}`;
  }
  if (item.estado === 'novo' && item.compraReconstruida && item.bruto?.parcela) {
    const total = totalCorrigidoCent ?? item.compraReconstruida.valorTotalCent;
    return `parcela ${item.bruto.parcela.n} de ${item.compraReconstruida.parcelas} · compra de ${formatarBRL(total)}`;
  }
  if (item.estado === 'sobra') return 'só no app';
  return undefined;
}

interface Props {
  item: ItemConferencia;
  dados: Dados;
  acaoAtual: AcaoItem;
  onTrocarAcao: (acao: AcaoItem) => void;
  totalCorrigidoCent?: number;
  onCorrigirTotal: (novoValorCent: number) => void;
}

export default function LinhaConferencia({
  item, dados, acaoAtual, onTrocarAcao, totalCorrigidoCent, onCorrigirTotal,
}: Props) {
  const [corrigindo, setCorrigindo] = useState(false);
  const uid = useId();

  const descricao = descricaoDoItem(item, dados);
  const data = dataDoItem(item, dados);
  const valorCent = valorDoItem(item, dados, totalCorrigidoCent);
  const classeValor = entradaOuSaida(item, dados) === 'entrada' ? 'valor-ganho' : 'valor-gasto';

  // Pagamento sem fatura correspondente, ou compra de cartão sem categoria de destino: a
  // conferência já decidiu que não há ação possível, só o aviso explica por quê.
  if (item.estado === 'novo' && item.acao.tipo === 'ignorar') {
    return (
      <div className="item">
        <div className="cresce">
          <div>{descricao}</div>
          <div className="sub">{item.aviso}</div>
        </div>
        <span className={classeValor}>{formatarBRL(valorCent)}</span>
      </div>
    );
  }

  const etiqueta = (
    <>
      <i className={`importar-ponto ${item.estado}`} aria-hidden="true" />
      {' '}
      <span className={`importar-estado ${item.estado}`}>{ROTULOS_ESTADO[item.estado]}</span>
      {' · '}{formatarDataBR(data)}
    </>
  );

  if (item.estado === 'confere') {
    return (
      <div className="item">
        <div className="cresce">
          <div>{descricao}</div>
          <div className="sub">{etiqueta}</div>
        </div>
        <span className={classeValor}>{formatarBRL(valorCent)}</span>
      </div>
    );
  }

  const detalhe = detalheDoItem(item, dados, totalCorrigidoCent);

  return (
    <div className="item item-coluna">
      <div className="linha-topo linha-topo-2-1">
        <div className="cresce">
          <div>{descricao}</div>
          <div className="sub">{etiqueta}{detalhe ? ` · ${detalhe}` : ''}</div>
        </div>
        <span className={classeValor}>{formatarBRL(valorCent)}</span>
      </div>
      {item.estado === 'interno' && item.aviso && <p className="sub">{item.aviso}</p>}
      <div className="acoes">
        {item.estado === 'novo' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo !== 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao(item.acao)}
            >Adicionar</button>
            {item.compraReconstruida && (
              <button className="botao" onClick={() => setCorrigindo((v) => !v)}>Corrigir total</button>
            )}
            <button
              className={`botao ${acaoAtual.tipo === 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'ignorar' })}
            >Descartar</button>
          </>
        )}
        {item.estado === 'previsto' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo === 'confirmar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'confirmar' })}
            >Confirmar</button>
            <button
              className={`botao ${acaoAtual.tipo === 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'ignorar' })}
            >Descartar</button>
          </>
        )}
        {item.estado === 'divergente' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo === 'confirmarComValor' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao(item.acao)}
            >Confirmar {formatarBRL(valorCent)}</button>
            <button
              className={`botao ${acaoAtual.tipo === 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'ignorar' })}
            >Descartar</button>
          </>
        )}
        {item.estado === 'interno' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo === 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'ignorar' })}
            >Ignorar</button>
            {item.bruto?.natureza === 'aplicacaoInterna' && (
              <button
                className={`botao ${acaoAtual.tipo === 'adicionarLancamento' ? 'ativo' : ''}`}
                onClick={() => onTrocarAcao({ tipo: 'adicionarLancamento', categoriaId: CATEGORIA_A_CLASSIFICAR.gasto })}
              >É saída de verdade</button>
            )}
          </>
        )}
        {item.estado === 'sobra' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo === 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'ignorar' })}
            >Manter</button>
            <button
              className={`botao botao-perigo ${acaoAtual.tipo === 'excluir' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao({ tipo: 'excluir' })}
            >Excluir do app</button>
          </>
        )}
      </div>
      {corrigindo && item.compraReconstruida && (
        <div className="campo">
          <label htmlFor={`${uid}-total`}>Total da compra</label>
          <CampoValor
            id={`${uid}-total`}
            valorCentavos={totalCorrigidoCent ?? item.compraReconstruida.valorTotalCent}
            onChange={onCorrigirTotal}
          />
          {totalCorrigidoCent != null && totalCorrigidoValido(item, totalCorrigidoCent) == null && (
            <p className="sub">O total não pode ser menor que uma parcela.</p>
          )}
        </div>
      )}
    </div>
  );
}
