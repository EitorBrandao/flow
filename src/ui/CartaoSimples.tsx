import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR } from '../domain/dates';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, faturaForaDoFluxo, mesFaturaDaCompra, valorSincronizado,
  type Fatura,
} from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Cartao, ConferenciaFatura } from '../domain/types';
import { useApp } from '../state/store';
import AvisoFaturaForaDoFluxo from './AvisoFaturaForaDoFluxo';
import CampoValor from './CampoValor';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';
import SeletorMes from './SeletorMes';

/** Cartão no modo Simples: só o valor da fatura do mês. O valor vira uma `ConferenciaFatura`
 *  com `usarValorApp` (mesma conferência da aba Conferência do Avançado) — não cria compra. */
export default function CartaoSimples({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() =>
    mesFaturaDaCompra(cartao, hoje, ajustesDoCartao(dados?.ajustesFechamento ?? [], cartao.id)),
  );
  if (!dados) return null;
  return (
    <div className="tela">
      <div className="barra-fixa">
        <h2 style={{ margin: '2px 0 6px' }}>{cartao.nome}</h2>
        <SeletorMes mes={mes} onMudar={setMes} />
      </div>
      {/* `key` por cartão e mês: o campo de valor recomeça do valor gravado a cada troca de mês. */}
      <FaturaDoMes key={`${cartao.id}:${mes}`} cartao={cartao} mes={mes} />
    </div>
  );
}

function FaturaDoMes({ cartao, mes }: { cartao: Cartao; mes: string }) {
  const { dados, hoje, recarregar } = useApp();
  const uid = useId();
  const conf = dados?.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const [pagando, setPagando] = useState(false);
  const [valorInicialPagamento, setValorInicialPagamento] = useState<number | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  if (!dados) return null;

  const horizonte = dados.config.horizonteProjecao;
  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
  const ate = dataVencimento > horizonte ? dataVencimento : horizonte;
  const fatura: Fatura = calcularFaturas(cartao, compras, ate, ajustes).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
  const lancFatura = dados.lancamentos.find((l) => l.cartaoId === cartao.id && l.faturaMes === mes);

  // Sem edição ainda: o campo mostra o que a fatura já leva ao Flow (soma das compras ou valor do app).
  const atual = valorSincronizado(fatura, conf);
  const valor = cents ?? atual;
  // Com o campo editado, o aviso já considera o valor digitado, antes de salvar.
  const confVigente: ConferenciaFatura | undefined = cents === null ? conf : {
    ...(conf ?? { id: '', criadoEm: '', alteradoEm: '', cartaoId: cartao.id, mes }),
    valorAppCent: valor, usarValorApp: true,
  };
  const foraDoFluxo = faturaForaDoFluxo({ cartao, fatura, compras, lancFatura, conferencia: confVigente, hoje });
  // Nada a salvar: campo intocado ou igual ao que já vale. Evita um toque sem editar sobrescrever
  // uma conferência do Avançado (valor do banco, `usarValorApp: false`) com a soma das compras.
  const nadaASalvar = cents === null || valor === atual;

  async function salvar() {
    if (valor <= 0 || nadaASalvar) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, valor, true, horizonte);
    await recarregar();
  }

  async function removerValor() {
    await repo.removerConferenciaFatura(cartao.id, mes, horizonte);
    setCents(null);
    await recarregar();
  }

  async function pagarTudo() {
    if (!lancFatura) return;
    await repo.confirmarPendente(lancFatura.id);
    await recarregar();
  }

  return (
    <>
      <div className="card lista">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor da fatura</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setCents} />
        </div>
        <p className="sub" style={{ margin: 0 }}>Vencimento: {formatarDataBR(fatura.dataVencimento)}</p>
        {/* Sem frase de pista: o único requisito é o valor, e sem valor, nada (padrão de `oQueFalta`
            em TelaLancar — o campo já está à vista). */}
        <button className="botao botao-primario" disabled={valor <= 0 || nadaASalvar} onClick={salvar}>
          Salvar fatura
        </button>
        {conf?.usarValorApp && (
          <button className="botao botao-perigo" onClick={removerValor}>Remover valor</button>
        )}
        <p className="sub" style={{ margin: 0 }}>
          Entra no Fluxo como um gasto único no vencimento. Quer detalhar compra a compra? Troque para Avançado.
        </p>
        {foraDoFluxo && (
          <AvisoFaturaForaDoFluxo
            situacao={foraDoFluxo}
            onCorrigir={(v) => { setValorInicialPagamento(v); setPagando(true); }}
          />
        )}
      </div>

      {lancFatura && (
        <div className="card lista">
          <div className="rotulo-grupo">Pagamento</div>
          {lancFatura.status === 'efetivo' ? (
            <p className="sub" style={{ margin: 0 }}>
              {`Pago: ${formatarBRL(lancFatura.valor)}`}
              {' · '}
              <button className="botao-ver-mais" onClick={() => { setValorInicialPagamento(null); setPagando(true); }}>
                corrigir ou parcelar
              </button>
            </p>
          ) : (
            <>
              <p className="sub" style={{ margin: 0 }}>{`A pagar: ${formatarBRL(lancFatura.valor)}`}</p>
              <div className="acoes">
                <button className="botao" onClick={pagarTudo}>Paguei tudo</button>
                <button className="botao" onClick={() => { setValorInicialPagamento(null); setPagando(true); }}>
                  Paguei outro valor
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <PagamentoFaturaSheetModal
        lancamento={pagando ? lancFatura ?? null : null}
        totalFaturaCent={fatura.totalCent}
        valorInicialCent={valorInicialPagamento ?? undefined}
        onFechar={() => setPagando(false)}
      />
    </>
  );
}
