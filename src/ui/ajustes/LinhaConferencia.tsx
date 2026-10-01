import { useId, useState } from 'react';
import { formatarDataBR } from '../../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../../domain/money';
import type { Dados, ISODate } from '../../domain/types';
import { CATEGORIA_A_CLASSIFICAR, dataCorrigidaValida, totalCorrigidoValido } from '../../importar/conferencia';
import { contraparteNubank } from '../../importar/descricao';
import type { AcaoItem, EstadoItem, ItemConferencia } from '../../importar/tipos';
import CampoData from '../CampoData';
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

/** Classe de cor do valor: pelo sinal do bruto quando existe (o item "fica como está" —
 *  ver `docs/superpowers/specs/2026-09-26-regra-de-sinal-design.md`); para "sobra", uma
 *  compra de cartão é sempre saída, e um lançamento do app segue o efeito no saldo
 *  (`efeitoNoSaldo`), com o mesmo estorno das outras telas. */
function classeValorDoItem(item: ItemConferencia, dados: Dados): 'valor-ganho' | 'valor-gasto' | 'valor-neutro' {
  if (item.bruto) return item.bruto.valorCent < 0 ? 'valor-gasto' : 'valor-ganho';
  if (item.compraCartaoId) return 'valor-gasto';
  if (item.lancamentoId) {
    const l = dados.lancamentos.find((x) => x.id === item.lancamentoId);
    if (!l) return 'valor-gasto';
    const categoria = dados.categorias.find((c) => c.id === l.categoriaId);
    return classeEfeito(efeitoNoSaldo(l.valor, categoria?.tipo ?? 'gasto'));
  }
  return 'valor-gasto';
}

/** Rótulo "estorno" só para o lançamento do app (sem bruto do banco) com valor negativo —
 *  mesmo critério das outras telas (`l.valor < 0`). */
function mostrarEstorno(item: ItemConferencia, dados: Dados): boolean {
  if (item.bruto || !item.lancamentoId) return false;
  const l = dados.lancamentos.find((x) => x.id === item.lancamentoId);
  return (l?.valor ?? 0) < 0;
}

export function valorDoItem(item: ItemConferencia, dados: Dados, totalCorrigidoCent: number | undefined): number {
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
  /** Data corrigida pelo usuário para uma parcela com data estimada (fatura do Nubank). */
  dataCorrigida?: ISODate;
  /** `undefined` apaga a correção e volta à data estimada. */
  onCorrigirData?: (data: ISODate | undefined) => void;
}

export default function LinhaConferencia({
  item, dados, acaoAtual, onTrocarAcao, totalCorrigidoCent, onCorrigirTotal,
  dataCorrigida, onCorrigirData,
}: Props) {
  const [corrigindo, setCorrigindo] = useState(false);
  const uid = useId();

  const descricao = descricaoDoItem(item, dados);
  const estimada = item.bruto?.dataEstimada;
  const dataCorrigidaOk = dataCorrigidaValida(item, dataCorrigida);
  // Parcela de data estimada que casou: a data que vale é a da compra cadastrada no app.
  const compraDoApp = item.estado === 'confere' && estimada && item.compraCartaoId
    ? dados.comprasCartao.find((c) => c.id === item.compraCartaoId)
    : undefined;
  const data = compraDoApp?.data ?? dataCorrigidaOk ?? dataDoItem(item, dados);
  const marcaEstimada = item.estado === 'novo' && estimada && dataCorrigidaOk == null ? ' (estimada)' : '';
  const valorCent = valorDoItem(item, dados, totalCorrigidoCent);
  const classeValor = classeValorDoItem(item, dados);
  const estorno = mostrarEstorno(item, dados);

  // Pagamento sem fatura correspondente, ou compra de cartão sem categoria de destino: a
  // conferência já decidiu que não há ação possível, só o aviso explica por quê.
  if (item.estado === 'novo' && item.acao.tipo === 'ignorar') {
    return (
      <div className="item">
        <div className="cresce">
          <div>{descricao}{estorno && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}</div>
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
      {' · '}{formatarDataBR(data)}{marcaEstimada}
    </>
  );

  if (item.estado === 'confere') {
    return (
      <div className="item">
        <div className="cresce">
          <div>{descricao}{estorno && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}</div>
          <div className="sub">{etiqueta}</div>
          {item.aviso && <div className="sub">{item.aviso}</div>}
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
          <div>{descricao}{estorno && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}</div>
          <div className="sub">{etiqueta}{detalhe ? ` · ${detalhe}` : ''}</div>
        </div>
        <span className={classeValor}>{formatarBRL(valorCent)}</span>
      </div>
      {(item.estado === 'interno' || item.estado === 'previsto') && item.aviso
        && <p className="sub">{item.aviso}</p>}
      <div className="acoes">
        {item.estado === 'novo' && (
          <>
            <button
              className={`botao ${acaoAtual.tipo !== 'ignorar' ? 'ativo' : ''}`}
              onClick={() => onTrocarAcao(item.acao)}
            >Adicionar</button>
            {item.compraReconstruida && (
              <button className="botao" onClick={() => setCorrigindo((v) => !v)}>Corrigir compra</button>
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
        <>
          {estimada && (
            <div className="campo">
              <label htmlFor={`${uid}-data`}>Data da compra</label>
              <CampoData
                id={`${uid}-data`}
                value={dataCorrigidaOk ?? estimada.min}
                min={estimada.min}
                max={estimada.max}
                // Escolher a própria estimada é o mesmo que não corrigir.
                onChange={(v) => { if (v) onCorrigirData?.(v === estimada.min ? undefined : v); }}
              />
              <p className="sub">
                Pela parcela, a compra foi entre {formatarDataBR(estimada.min)} e{' '}
                {formatarDataBR(estimada.max)}. Estimada: {formatarDataBR(estimada.min)}.
              </p>
              {dataCorrigidaOk && (
                <button type="button" className="botao-ver-mais" onClick={() => onCorrigirData?.(undefined)}>
                  Voltar para a data estimada
                </button>
              )}
            </div>
          )}
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
        </>
      )}
    </div>
  );
}
