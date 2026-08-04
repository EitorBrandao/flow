import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR } from '../domain/dates';
import { resumoParcelamento } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import Sheet from './Sheet';

/**
 * Registra o pagamento de uma fatura por um valor diferente do total e, se for o caso, o
 * parcelamento do restante no banco.
 *
 * O app **não** calcula juros: quem digita as parcelas é o usuário, lendo o que o banco
 * mostrou, e os juros já vêm embutidos ali. A linha de contas só explicita a diferença entre
 * o que vai ser pago e o que deixou de ser pago — inclusive quando ela é negativa, que é
 * incoerência do preenchimento e merece aparecer em vez de ser corrigida por baixo do pano.
 */
export default function PagamentoFaturaSheet({ lancamento, totalFaturaCent, onFechar }: {
  lancamento: Lancamento;
  totalFaturaCent: number;
  onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valorPago, setValorPago] = useState(lancamento.valor);
  // Pendente ⇒ o pagamento está acontecendo agora (inclusive adiantado, já que a fila mostra
  // a fatura antes de vencer). Já efetivo ⇒ manter a data registrada, para uma correção de
  // valor não mover a saída de dia sem querer.
  const [dataPagamento, setDataPagamento] = useState(
    lancamento.status === 'efetivo' ? lancamento.data : hoje,
  );
  const [parcelas, setParcelas] = useState('2');
  const [valorParcela, setValorParcela] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const uid = useId();
  if (!dados) return null;

  const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));
  const conta = resumoParcelamento(totalFaturaCent, valorPago, {
    parcelas: parcelasNum, valorParcelaCent: valorParcela,
  });
  // Sobrou valor ⇒ os campos de parcelamento aparecem sozinhos. A primeira versão escondia
  // tudo atrás de uma caixa "Parcelei o restante no banco" que `.campo label` pintava de
  // cinza 13px, igual a uma legenda — dava para pagar parcialmente e ver milhares de reais
  // sumirem da projeção sem o app dizer nada. Portão nenhum: quem não parcelou deixa a
  // parcela zerada e lê o aviso.
  const sobrou = conta.restanteCent > 0;
  const parcelando = sobrou && valorParcela > 0;
  const podeSalvar = !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await repo.registrarPagamentoFatura({
        lancamentoId: lancamento.id,
        cartaoId: lancamento.cartaoId!,
        faturaMes: lancamento.faturaMes!,
        valorPagoCent: valorPago,
        dataPagamento,
        ...(parcelando ? { parcelamento: { parcelas: parcelasNum, valorParcelaCent: valorParcela } } : {}),
        horizonte: dados!.config.horizonteProjecao,
      });
      await recarregar();
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <p className="sub" style={{ margin: 0 }}>
        Fatura {lancamento.faturaMes?.split('-').reverse().join('/')} · total{' '}
        <strong>{formatarBRL(totalFaturaCent)}</strong>
      </p>

      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-pago`}>Quanto você pagou</label>
          <CampoValor id={`${uid}-pago`} valorCentavos={valorPago} onChange={setValorPago} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Quando pagou</label>
          <CampoData id={`${uid}-data`} value={dataPagamento} onChange={setDataPagamento} />
        </div>
      </div>
      {dataPagamento < lancamento.data && (
        <p className="sub" style={{ margin: 0 }}>
          Pagamento adiantado: o valor sai da conta em{' '}
          {formatarDataBR(dataPagamento)}, e não no vencimento ({formatarDataBR(lancamento.data)}).
        </p>
      )}

      {sobrou && (
        <>
          <p className="rotulo" style={{ margin: 0 }}>Parcelou o restante no banco?</p>
          <div className="linha">
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
              <input
                id={`${uid}-parcelas`} inputMode="numeric" value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            </div>
            <div className="campo" style={{ flex: 2 }}>
              <label htmlFor={`${uid}-valor-parcela`}>Valor de cada parcela</label>
              <CampoValor id={`${uid}-valor-parcela`} valorCentavos={valorParcela} onChange={setValorParcela} />
            </div>
          </div>
        </>
      )}

      <div className="pagamento-fatura-resumo">
        <div className="linha-conta">
          <span>Restou da fatura</span><strong>{formatarBRL(conta.restanteCent)}</strong>
        </div>
        {parcelando && (
          <>
            <div className="linha-conta">
              <span>{parcelasNum} × {formatarBRL(valorParcela)}</span>
              <strong>{formatarBRL(conta.totalParceladoCent)}</strong>
            </div>
            <div className="linha-conta">
              {conta.jurosCent === 0 ? (
                <>
                  <span>Juros</span>
                  <strong className="pagamento-fatura-semjuros">sem juros</strong>
                </>
              ) : conta.jurosCent > 0 ? (
                <>
                  <span>Juros</span>
                  <strong className="pagamento-fatura-juros">{formatarBRL(conta.jurosCent)}</strong>
                </>
              ) : (
                <>
                  <span>Faltam</span>
                  <strong className="pagamento-fatura-erro">{formatarBRL(-conta.jurosCent)}</strong>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {sobrou && !parcelando && (
        <p className="aviso" style={{ margin: 0 }}>
          Sem parcelamento, os {formatarBRL(conta.restanteCent)} que sobraram{' '}
          <strong>somem da projeção</strong> — não voltam em nenhuma fatura. Se o banco
          parcelou, preencha acima; se foi desconto ou estorno, pode salvar assim.
        </p>
      )}

      <button className="botao botao-primario" disabled={!podeSalvar} onClick={salvar} style={{ padding: 14 }}>
        Confirmar pagamento
      </button>
    </>
  );
}

/** A folha em si, com o `Sheet` em volta — o conteúdo fica separado para o teste montar sem
 *  depender do backdrop e da animação. */
export function PagamentoFaturaSheetModal({ lancamento, totalFaturaCent, onFechar }: {
  lancamento: Lancamento | null;
  totalFaturaCent: number;
  onFechar: () => void;
}) {
  return (
    <Sheet aberto={lancamento != null} onFechar={onFechar} rotulo="Pagamento da fatura">
      {lancamento && (
        <PagamentoFaturaSheet
          lancamento={lancamento} totalFaturaCent={totalFaturaCent} onFechar={onFechar}
        />
      )}
    </Sheet>
  );
}
