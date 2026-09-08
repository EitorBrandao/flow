import { useId, useState } from 'react';
import * as repo from '../db/repo';
import { addMeses } from '../domain/dates';
import {
  ajustesDoCartao, calcularFaturas, datasFaturaDoMes, mesFaturaDaCompra, resumoPorCategoria, type Fatura,
} from '../domain/fatura';
import { formatarBRL } from '../domain/money';
import type { Cartao, CompraCartao } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import CampoValor from './CampoValor';
import FormCompra from './FormCompra';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';
import Sheet from './Sheet';

// NOTA DE PATCH (nível 1): o card de fatura ganhou 3 abas internas (Resumo/Lançamentos/
// Conferência) via `.pills` — cabeçalho da fatura (mês, total, fecha/vence) continua sempre
// visível fora das abas, igual antes.
type AbaCartao = 'resumo' | 'lancamentos' | 'conferencia';

function fmtDia(d: string): string {
  const [, m, dia] = d.split('-');
  return `${dia}/${m}`;
}

function BlocoConferencia({ cartao, mes, totalCent }: { cartao: Cartao; mes: string; totalCent: number }) {
  const { dados, recarregar } = useApp();
  const conf = dados?.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const [valor, setValor] = useState<number>(conf?.valorAppCent ?? 0);
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;

  async function salvar() {
    if (valor > 0) {
      await repo.salvarConferenciaFatura(cartao.id, mes, valor, conf?.usarValorApp ?? false, horizonte);
      await recarregar();
    }
  }

  async function remover() {
    if (conf) {
      await repo.removerConferenciaFatura(cartao.id, mes, horizonte);
      await recarregar();
      setValor(0);
    }
  }

  async function alternarUsar(usar: boolean) {
    if (!conf) return;
    await repo.salvarConferenciaFatura(cartao.id, mes, conf.valorAppCent, usar, horizonte);
    await recarregar();
  }

  const diff = conf != null ? conf.valorAppCent - totalCent : null;
  return (
    <div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valorapp`}>Valor no app do banco</label>
          <CampoValor
            id={`${uid}-valorapp`}
            valorCentavos={valor}
            onChange={setValor}
            style={{ width: 140 }}
          />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} aria-label="Salvar conferência" onClick={salvar}>Salvar</button>
        {conf && (
          <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} aria-label="Remover conferência" onClick={remover}>Remover</button>
        )}
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

/** Exceção pontual do dia de fechamento — mesmo idioma de `BlocoConferencia`, mas chaveada
 *  pelo mês CALENDÁRIO de fechamento (derivado de `fatura.dataFechamento`), não pelo mês de
 *  vencimento: é essa a chave que `AjusteFechamento` usa (ver docs/superpowers/specs/
 *  2026-09-02-ajuste-fechamento-fatura-design.md). */
function BlocoAjusteFechamento({ cartao, mesFechamento }: { cartao: Cartao; mesFechamento: string }) {
  const { dados, recarregar } = useApp();
  const existente = dados?.ajustesFechamento.find((a) => a.cartaoId === cartao.id && a.mes === mesFechamento);
  const [dia, setDia] = useState<string>(String(existente?.diaFechamento ?? cartao.diaFechamento));
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  async function salvar() {
    await repo.salvarAjusteFechamento(cartao.id, mesFechamento, clampDia(dia), horizonte);
    await recarregar();
  }

  async function remover() {
    if (existente) {
      await repo.removerAjusteFechamento(cartao.id, mesFechamento, horizonte);
      await recarregar();
      setDia(String(cartao.diaFechamento));
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Fechou dia</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={dia}
            onChange={(e) => setDia(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} aria-label="Salvar fechamento" onClick={salvar}>Salvar fechamento</button>
        {existente && (
          <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} aria-label="Remover fechamento" onClick={remover}>Remover fechamento</button>
        )}
      </div>
      <p className="sub" style={{ margin: '4px 0 0' }}>
        {existente
          ? `Este mês fechou dia ${existente.diaFechamento} em vez do padrão (dia ${cartao.diaFechamento}).`
          : `Padrão do cartão: dia ${cartao.diaFechamento}. Preencha só se este mês fechou num dia diferente.`}
      </p>
    </div>
  );
}

function CartaoFatura({ cartao }: { cartao: Cartao }) {
  const { dados, hoje } = useApp();
  const [mes, setMes] = useState(() =>
    mesFaturaDaCompra(cartao, hoje, ajustesDoCartao(dados?.ajustesFechamento ?? [], cartao.id)),
  );
  const [editando, setEditando] = useState<CompraCartao | null>(null);
  const [filtroCategoriaId, setFiltroCategoriaId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [pagando, setPagando] = useState(false);
  const [abaCartao, setAbaCartao] = useState<AbaCartao>('resumo');
  if (!dados) return null;

  const ajustes = ajustesDoCartao(dados.ajustesFechamento, cartao.id);
  const compras = dados.comprasCartao.filter((c) => c.cartaoId === cartao.id);
  const { dataFechamento, dataVencimento } = datasFaturaDoMes(cartao, mes, ajustes);
  const ate = dataVencimento > dados.config.horizonteProjecao ? dataVencimento : dados.config.horizonteProjecao;
  const fatura: Fatura = calcularFaturas(cartao, compras, ate, ajustes).find((f) => f.mes === mes)
    ?? { mes, dataFechamento, dataVencimento, itens: [], totalCent: 0 };
  // prefixo de 7 caracteres de um ISODate = mês calendário (mesma conta de `mesDe`, sem
  // precisar importar de dates.ts aqui) — é essa a chave que `AjusteFechamento.mes` indexa.
  const mesFechamento = fatura.dataFechamento.slice(0, 7);

  const nomeCat = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const resumo = resumoPorCategoria(fatura);

  const q = busca.trim().toLowerCase();
  const buscaAtiva = q.length > 0;
  const bate = (i: Fatura['itens'][number]) => {
    if (i.descricao && i.descricao.toLowerCase().includes(q)) return true;
    if (nomeCat(i.categoriaCartaoId).toLowerCase().includes(q)) return true;
    if (i.data.split('-').reverse().join('/').includes(q)) return true;
    return formatarBRL(i.valorCent).toLowerCase().includes(q);
  };
  const itensFiltrados = fatura.itens.filter((i) =>
    (!filtroCategoriaId || i.categoriaCartaoId === filtroCategoriaId) && (!buscaAtiva || bate(i)));

  const lancFatura = dados.lancamentos.find((l) => l.cartaoId === cartao.id && l.faturaMes === mes);

  // Ícone no rótulo da aba Conferência: dá pra saber se bate sem entrar na aba. Só aparece
  // depois que existe uma conferência salva — antes disso não há nada a sinalizar.
  const confAtual = dados.conferenciasFatura.find((c) => c.cartaoId === cartao.id && c.mes === mes);
  const diffConferencia = confAtual != null ? confAtual.valorAppCent - fatura.totalCent : null;

  const aVista = itensFiltrados.filter((i) => i.totalParcelas === 1).sort((a, b) => b.data.localeCompare(a.data));
  const parceladas = itensFiltrados.filter((i) => i.totalParcelas > 1).sort((a, b) => b.data.localeCompare(a.data));
  const mostrarGrupos = aVista.length > 0 && parceladas.length > 0;

  return (
    <div className="card">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <button className="botao" aria-label="Mês anterior" onClick={() => setMes(addMeses(mes, -1))}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <p className="sub" style={{ margin: 0 }}>{cartao.nome} · fatura {mes.split('-').reverse().join('/')}</p>
          <p className="saldo-grande negativo" style={{ margin: '4px 0' }}>{formatarBRL(fatura.totalCent)}</p>
          <p className="sub" style={{ margin: 0 }}>
            fecha {fmtDia(fatura.dataFechamento)} · vence {fmtDia(fatura.dataVencimento)}
          </p>
        </div>
        <button className="botao" aria-label="Mês seguinte" onClick={() => setMes(addMeses(mes, 1))}>›</button>
      </div>

      <div className="pills" style={{ marginTop: 12 }} role="tablist" aria-label="Seções da fatura">
        <button role="tab" aria-selected={abaCartao === 'resumo'} className={abaCartao === 'resumo' ? 'ativo' : ''} onClick={() => setAbaCartao('resumo')}>Resumo</button>
        <button role="tab" aria-selected={abaCartao === 'lancamentos'} className={abaCartao === 'lancamentos' ? 'ativo' : ''} onClick={() => setAbaCartao('lancamentos')}>Lançamentos</button>
        <button role="tab" aria-selected={abaCartao === 'conferencia'} className={abaCartao === 'conferencia' ? 'ativo' : ''} onClick={() => setAbaCartao('conferencia')}>
          Conferência{diffConferencia != null && (diffConferencia === 0 ? ' ✔️' : ' ⚠️')}
        </button>
      </div>

      {abaCartao === 'resumo' && (
        <div style={{ marginTop: 12 }}>
          {lancFatura && (
            <p className="sub" style={{ margin: 0 }}>
              {lancFatura.status === 'efetivo'
                ? `Pago: ${formatarBRL(lancFatura.valor)}`
                : `A pagar: ${formatarBRL(lancFatura.valor)}`}
              {' · '}
              <button className="botao-ver-mais" onClick={() => setPagando(true)}>
                {lancFatura.status === 'efetivo' ? 'corrigir ou parcelar' : 'paguei outro valor'}
              </button>
            </p>
          )}
          {resumo.length > 1 && (
            <div className="lista" style={{ marginTop: 8 }}>
              {resumo.map(([catId, cent]) => (
                <button
                  key={catId}
                  className={`botao${filtroCategoriaId === catId ? ' ativo' : ''}`}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left' }}
                  aria-pressed={filtroCategoriaId === catId}
                  onClick={() => {
                    setFiltroCategoriaId((v) => (v === catId ? null : catId));
                    setAbaCartao('lancamentos');
                  }}
                >
                  <span>{nomeCat(catId)}</span>
                  <strong className="valor-gasto">{formatarBRL(cent)}</strong>
                </button>
              ))}
            </div>
          )}
          {resumo.length === 0 && <p className="sub" style={{ marginTop: 8 }}>Nenhum gasto nesta fatura.</p>}
        </div>
      )}

      {abaCartao === 'lancamentos' && (
        <div style={{ marginTop: 12 }}>
          <div className="linha">
            <input
              className="campo-busca"
              placeholder="Buscar por descrição, categoria, data ou valor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <div className="lista" style={{ marginTop: 8 }}>
            {mostrarGrupos && <p className="rotulo-grupo">À vista</p>}
            {aVista.map((i) => (
              <ItemFaturaBotao key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCat}
                onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)} />
            ))}
            {mostrarGrupos && <p className="rotulo-grupo" style={{ marginTop: 6 }}>Parceladas</p>}
            {parceladas.map((i) => (
              <ItemFaturaBotao key={`${i.compraId}:${i.parcela}`} item={i} nomeCat={nomeCat}
                onClick={() => setEditando(compras.find((c) => c.id === i.compraId) ?? null)} />
            ))}
            {itensFiltrados.length === 0 && (
              <p className="sub">
                {fatura.itens.length === 0 ? 'Nenhum gasto nesta fatura.' : 'Nenhum lançamento encontrado.'}
              </p>
            )}
          </div>
        </div>
      )}

      {abaCartao === 'conferencia' && (
        <div style={{ marginTop: 12 }}>
          <BlocoConferencia key={`${cartao.id}:${mes}`} cartao={cartao} mes={mes} totalCent={fatura.totalCent} />
          <BlocoAjusteFechamento key={`${cartao.id}:${mesFechamento}`} cartao={cartao} mesFechamento={mesFechamento} />
        </div>
      )}

      <Sheet aberto={editando != null} onFechar={() => setEditando(null)} rotulo="Editar compra">
        {editando && <FormCompra cartao={cartao} compra={editando} onFechar={() => setEditando(null)} />}
      </Sheet>
      <PagamentoFaturaSheetModal
        lancamento={pagando ? lancFatura ?? null : null}
        totalFaturaCent={fatura.totalCent}
        onFechar={() => setPagando(false)}
      />
    </div>
  );
}

function ItemFaturaBotao({ item, nomeCat, onClick }: {
  item: Fatura['itens'][number]; nomeCat: (id: string) => string; onClick: () => void;
}) {
  return (
    <button className="item" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={onClick}>
      <div className="cresce">
        <div>{item.descricao ?? nomeCat(item.categoriaCartaoId)}</div>
        <div className="sub">
          {item.data.split('-').reverse().join('/')} · {nomeCat(item.categoriaCartaoId)}
          {item.totalParcelas > 1 ? ` · ${item.parcela}/${item.totalParcelas}` : ''}
        </div>
      </div>
      <span className="valor-gasto">{formatarBRL(item.valorCent)}</span>
    </button>
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
