import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { addMeses } from '../domain/dates';
import {
  calcularFaturas, datasFaturaDoMes, mesFaturaDaCompra, type Fatura,
} from '../domain/fatura';
import { formatarBRL, parseValorDigitado } from '../domain/money';
import type { Cartao, CompraCartao } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import FormCompra from './FormCompra';
import Sheet from './Sheet';

function centavosParaTexto(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

function fmtDia(d: string): string {
  const [, m, dia] = d.split('-');
  return `${dia}/${m}`;
}

function BlocoConferencia({ cartao, mes, totalCent }: { cartao: Cartao; mes: string; totalCent: number }) {
  const { dados, recarregar } = useApp();
  const conf = dados?.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const [valor, setValor] = useState(conf ? centavosParaTexto(conf.valorAppCent) : '');
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;

  async function salvar() {
    if (!valor.trim()) {
      if (conf) {
        await repo.removerConferenciaFatura(cartao.id, mes, horizonte);
        await recarregar();
      }
      return;
    }
    const cents = parseValorDigitado(valor);
    if (cents == null) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, cents, conf?.usarValorApp ?? false, horizonte);
    await recarregar();
  }

  async function alternarUsar(usar: boolean) {
    if (!conf) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, conf.valorAppCent, usar, horizonte);
    await recarregar();
  }

  const diff = conf != null ? conf.valorAppCent - totalCent : null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valorapp`}>Valor no app do banco</label>
          <input id={`${uid}-valorapp`} placeholder="0,00" inputMode="decimal"
            value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 140 }} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} aria-label="Salvar conferência" onClick={salvar}>Salvar</button>
      </div>
      {diff != null && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          {diff === 0
            ? '✓ Batido com o app.'
            : diff > 0
              ? `Falta bater ${formatarBRL(diff)} — tem gasto ainda não lançado aqui.`
              : `Itens somam ${formatarBRL(-diff)} a mais que o app.`}
        </p>
      )}
      {conf && (
        <label className="sub" style={{ display: 'block', marginTop: 4 }}>
          <input type="checkbox" checked={conf.usarValorApp}
            onChange={(e) => alternarUsar(e.target.checked)} />
          {' '}usar este valor no Flow
        </label>
      )}
    </div>
  );
}

function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() => mesFaturaDaCompra(cartao, hoje));
  const [editando, setEditando] = useState<CompraCartao | null>(null);
  if (!dados) return null;

  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes);
  const ate = dataVencimento > dados.config.horizonteProjecao ? dataVencimento : dados.config.horizonteProjecao;
  const fatura: Fatura = calcularFaturas(cartao, compras, ate).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };

  const nomeCat = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const porCategoria = new Map<string, number>();
  for (const i of fatura.itens) {
    porCategoria.set(i.categoriaCartaoId, (porCategoria.get(i.categoriaCartaoId) ?? 0) + i.valorCent);
  }
  const resumo = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="card">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button className="botao" aria-label="Mês anterior" onClick={() => setMes(addMeses(mes, -1))}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p className="sub" style={{ margin: 0 }}>{cartao.nome} · fatura {mes.split('-').reverse().join('/')}</p>
          <p className="saldo-grande" style={{ margin: '4px 0' }}>{formatarBRL(fatura.totalCent)}</p>
          <p className="sub" style={{ margin: 0 }}>
            fecha {fmtDia(fatura.dataFechamento)} · vence {fmtDia(fatura.dataVencimento)}
          </p>
        </div>
        <button className="botao" aria-label="Mês seguinte" onClick={() => setMes(addMeses(mes, 1))}>›</button>
      </div>
      <BlocoConferencia key={`${cartao.id}:${mes}`} cartao={cartao} mes={mes} totalCent={fatura.totalCent} />
      {resumo.length > 1 && (
        <div style={{ marginTop: 8 }}>
          {resumo.map(([catId, cent]) => (
            <p className="sub" key={catId} style={{ margin: 0 }}>{nomeCat(catId)}: {formatarBRL(cent)}</p>
          ))}
        </div>
      )}
      <div className="lista" style={{ marginTop: 8 }}>
        {fatura.itens.map((i) => (
          <button className="item" key={`${i.compraId}:${i.parcela}`}
            style={{ cursor: 'pointer', textAlign: 'left' }}
            onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)}>
            <div className="cresce">
              <div>{i.descricao ?? nomeCat(i.categoriaCartaoId)}</div>
              <div className="sub">
                {i.data.split('-').reverse().join('/')} · {nomeCat(i.categoriaCartaoId)}
                {i.totalParcelas > 1 ? ` · ${i.parcela}/${i.totalParcelas}` : ''}
              </div>
            </div>
            <span className="valor-gasto">{formatarBRL(i.valorCent)}</span>
          </button>
        ))}
        {fatura.itens.length === 0 && <p className="sub">Nenhum gasto nesta fatura.</p>}
      </div>
      <Sheet aberto={editando != null} onFechar={() => setEditando(null)} rotulo="Editar compra">
        {editando && <FormCompra cartao={cartao} compra={editando} onFechar={() => setEditando(null)} />}
      </Sheet>
    </div>
  );
}

export default function TelaCartao() {
  const { dados, boxSel, setAba } = useApp();
  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoes = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));
  if (cartoes.length === 0) {
    return (
      <div className="tela">
        <h2>Cartão</h2>
        <p className="sub">Nenhum cartão cadastrado para esta seleção.</p>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-start' }}
          onClick={() => setAba('ajustes')}>Cadastrar cartão</button>
      </div>
    );
  }
  return (
    <div className="tela">
      {cartoes.map((c) => <CartaoFatura key={c.id} cartao={c} />)}
    </div>
  );
}
