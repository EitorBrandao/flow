import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR, nomeDoMes } from '../domain/dates';
import { ajustesDoCartao, datasFaturaDoMes, jaLancadoDaFatura, resumoParcelamento } from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Dados, Lancamento } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorPills from './SeletorPills';
import Sheet from './Sheet';

type Destino = 'seguinte' | 'parcelei' | 'naovolta';

const OPCOES_DESTINO: { id: Destino; nome: string }[] = [
  { id: 'seguinte', nome: 'Mês seguinte' },
  { id: 'parcelei', nome: 'Parcelei' },
  { id: 'naovolta', nome: 'Não volta' },
];

/** Quanto desta fatura já foi para as seguintes — mesma regra do aviso da aba Cartão. */
function jaLancadoDoLancamento(dados: Dados | null, lancamento: Lancamento): number {
  const cartao = dados?.cartoes.find((c) => c.id === lancamento.cartaoId);
  if (!dados || !cartao || !lancamento.faturaMes) return 0;
  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const { dataFechamento } = datasFaturaDoMes(cartao, lancamento.faturaMes, ajustes);
  return jaLancadoDaFatura(cartao, dataFechamento, dados.comprasCartao);
}

/**
 * Registra o pagamento de uma fatura por um valor diferente do total e, se for o caso, o
 * parcelamento do restante no banco, ou a inclusão na fatura seguinte.
 *
 * O app **não** calcula juros: quem digita as parcelas ou o valor da próxima fatura é o usuário,
 * lendo o que o banco mostrou, e os juros já vêm embutidos ali. A linha de contas só explicita
 * a diferença entre o que vai ser pago e o que deixou de ser pago — inclusive quando ela é
 * negativa, que é incoerência do preenchimento e merece aparecer em vez de ser corrigida por
 * baixo do pano.
 */
export default function PagamentoFaturaSheet({ lancamento, totalFaturaCent, valorInicialCent, onFechar }: {
  lancamento: Lancamento;
  totalFaturaCent: number;
  /** Valor pago que a folha abre preenchido; sem ele, o valor já registrado no lançamento.
   *  O aviso "não chegaram no Fluxo" da aba Cartão abre com o valor que fecha a conta. */
  valorInicialCent?: number;
  onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valorPago, setValorPago] = useState(valorInicialCent ?? lancamento.valor);
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

  const jaLancado = jaLancadoDoLancamento(dados, lancamento);
  // Já existe restante ou parcelamento desta fatura ⇒ reabrir para corrigir não pode lançar
  // de novo por padrão. Sem nada lançado, o padrão é o que não perde dinheiro.
  const [destino, setDestino] = useState<Destino>(jaLancado > 0 ? 'naovolta' : 'seguinte');
  // O valor da próxima fatura acompanha o restante até o usuário digitar nele (juros do banco).
  const [valorProxDigitado, setValorProxDigitado] = useState<number | null>(null);

  if (!dados) return null;

  const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));
  const conta = resumoParcelamento(totalFaturaCent, valorPago, {
    parcelas: parcelasNum, valorParcelaCent: valorParcela,
  });
  const sobrou = conta.restanteCent > 0;
  const valorProx = valorProxDigitado ?? Math.max(0, conta.restanteCent);
  const plano = !sobrou ? null
    : destino === 'seguinte' && valorProx > 0 ? { parcelas: 1, valorParcelaCent: valorProx }
    : destino === 'parcelei' && valorParcela > 0 ? { parcelas: parcelasNum, valorParcelaCent: valorParcela }
    : null;
  const jurosCent = plano ? plano.parcelas * plano.valorParcelaCent - conta.restanteCent : 0;
  const some = `Os ${formatarBRL(conta.restanteCent)} que sobraram`;
  const avisoSobra = !sobrou || plano ? null
    : destino === 'parcelei' ? ' Se o banco parcelou, preencha acima.'
    : destino === 'naovolta' ? (jaLancado > 0 ? null : ' Use esta opção para desconto ou estorno.')
    : '';
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
        ...(plano ? { parcelamento: plano } : {}),
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
        Fatura de {lancamento.faturaMes ? nomeDoMes(lancamento.faturaMes) : ''} · total{' '}
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
          {jaLancado > 0 && (
            <p className="sub" style={{ margin: 0 }}>
              Já lançado na próxima fatura: <strong>{formatarBRL(jaLancado)}</strong>.
            </p>
          )}
          <p className="rotulo" style={{ margin: 0 }}>
            O que acontece com os {formatarBRL(conta.restanteCent)} que sobraram?
          </p>
          <SeletorPills
            opcoes={OPCOES_DESTINO} selecionadaId={destino} rotulo="Destino do que sobrou"
            onSelecionar={(id) => setDestino(id as Destino)}
          />
          {destino === 'seguinte' && (
            <div className="campo">
              <label htmlFor={`${uid}-prox`}>Valor na próxima fatura</label>
              <CampoValor id={`${uid}-prox`} valorCentavos={valorProx} onChange={setValorProxDigitado} />
            </div>
          )}
          {destino === 'parcelei' && (
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
          )}
        </>
      )}

      <div className="pagamento-fatura-resumo">
        <div className="linha-conta">
          <span>Restou da fatura</span><strong>{formatarBRL(conta.restanteCent)}</strong>
        </div>
        {plano && (
          <>
            <div className="linha-conta">
              <span>
                {plano.parcelas === 1 ? 'Na próxima fatura' : `${plano.parcelas} × ${formatarBRL(plano.valorParcelaCent)}`}
              </span>
              <strong>{formatarBRL(plano.parcelas * plano.valorParcelaCent)}</strong>
            </div>
            <div className="linha-conta">
              {jurosCent === 0 ? (
                <>
                  <span>Juros</span>
                  <strong className="pagamento-fatura-semjuros">sem juros</strong>
                </>
              ) : jurosCent > 0 ? (
                <>
                  <span>Juros</span>
                  <strong className="pagamento-fatura-juros">{formatarBRL(jurosCent)}</strong>
                </>
              ) : (
                <>
                  <span>Faltam</span>
                  <strong className="pagamento-fatura-erro">{formatarBRL(-jurosCent)}</strong>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {avisoSobra !== null && (
        <p className="aviso" style={{ margin: 0 }}>
          {some} <strong>somem da projeção</strong> — não voltam em nenhuma fatura.{avisoSobra}
        </p>
      )}
      {conta.restanteCent < 0 && (
        <p className="aviso" style={{ margin: 0 }}>
          Você pagou <strong>{formatarBRL(-conta.restanteCent)} a mais</strong> que a fatura. O banco
          costuma abater da próxima fatura; o Flow ainda não registra esse crédito.
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
export function PagamentoFaturaSheetModal({ lancamento, totalFaturaCent, valorInicialCent, onFechar }: {
  lancamento: Lancamento | null;
  totalFaturaCent: number;
  valorInicialCent?: number;
  onFechar: () => void;
}) {
  return (
    <Sheet aberto={lancamento != null} onFechar={onFechar} rotulo="Pagamento da fatura">
      {lancamento && (
        <PagamentoFaturaSheet
          lancamento={lancamento} totalFaturaCent={totalFaturaCent} valorInicialCent={valorInicialCent}
          onFechar={onFechar}
        />
      )}
    </Sheet>
  );
}
