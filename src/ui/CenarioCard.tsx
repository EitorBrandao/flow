import { useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR, mesAbreviado } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { itensDoCenario, primeiroMesNegativo, type ItemCenario, type LinhaMes } from '../domain/simulacao';
import type { Cenario, ID } from '../domain/types';
import { useApp } from '../state/store';
import FormItemCenario, { gravarItemNovo, type ValoresItem } from './FormItemCenario';
import ItemCenarioSheet from './ItemCenarioSheet';
import TabelaSimulacao from './TabelaSimulacao';

interface Props {
  cenario: Cenario;
  /** Resumo mensal do cenário sozinho (só ele ligado). */
  linhas: LinhaMes[];
  larguraCh: number;
  aberto: boolean;
  onAlternar: () => void;
  /** Box que recebe item novo (`boxIdEfetivo`); `null` = sem box "casa". */
  boxIdNovo: ID | null;
}

/** Card de um cenário no Simular: liga/desliga (checkbox), abre/fecha (resto do
 *  cabeçalho), e, aberto, mostra os itens, o impacto isolado, o formulário de item novo
 *  e as ações Tornar real / Excluir. */
export default function CenarioCard({ cenario, linhas, larguraCh, aberto, onAlternar, boxIdNovo }: Props) {
  const { dados, hoje, recarregar } = useApp();
  const [editando, setEditando] = useState<ItemCenario | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (!dados) return null;
  const itens = itensDoCenario(dados, cenario.id);
  const efeitoFinal = linhas.at(-1)?.dif ?? 0;
  const ultimoMes = linhas.at(-1)?.mes;
  const negativoEm = primeiroMesNegativo(linhas);
  const cat = (id: string) => dados.categorias.find((c) => c.id === id);

  async function alternarLigado() {
    await repo.salvarCenario({ ...cenario, ligado: !cenario.ligado });
    await recarregar();
  }
  async function tornarReal() {
    if (!window.confirm(`Converter "${cenario.nome}" em lançamentos reais?`)) return;
    await repo.converterCenarioEmReal(cenario.id);
    await recarregar();
  }
  async function excluir() {
    if (!window.confirm(`Excluir o cenário "${cenario.nome}" e seus itens?`)) return;
    await repo.excluirCenario(cenario.id);
    await recarregar();
  }
  async function adicionar(v: ValoresItem) {
    await gravarItemNovo(cenario.id, boxIdNovo!, v, dados!.config.horizonteProjecao);
    await recarregar();
    setFormKey((k) => k + 1); // formulário volta limpo
  }

  function linhaDoItem(item: ItemCenario) {
    if (item.repeticao === 'unica') {
      const l = item.lancamento;
      const c = cat(l.categoriaId);
      return {
        titulo: l.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `uma vez · ${formatarDataBR(l.data)}`,
        valor: formatarBRL(l.valor), classe: classeEfeito(efeitoNoSaldo(l.valor, c?.tipo ?? 'gasto')), estorno: l.valor < 0,
      };
    }
    const r = item.recorrencia;
    const c = cat(r.categoriaId);
    const classe = classeEfeito(efeitoNoSaldo(r.valor, c?.tipo ?? 'gasto'));
    return item.repeticao === 'parcelado'
      ? {
        titulo: r.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `${r.parcelas}x de ${formatarBRL(r.valor)} · a partir de ${formatarDataBR(r.dataInicio)}`,
        valor: formatarBRL(r.valor * (r.parcelas ?? 1)), classe, estorno: r.valor < 0,
      }
      : {
        titulo: r.nota || c?.nome || '?', categoria: c?.nome ?? '?',
        detalhe: `todo mês · a partir de ${formatarDataBR(r.dataInicio)}`,
        valor: `${formatarBRL(r.valor)}/mês`, classe, estorno: r.valor < 0,
      };
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="linha-topo">
        <input
          type="checkbox" checked={cenario.ligado} onChange={alternarLigado}
          aria-label={`Ligar ${cenario.nome}`} style={{ width: 22, height: 22 }}
        />
        <button
          type="button" className="cresce linha-topo" aria-expanded={aberto} onClick={onAlternar}
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0 }}
        >
          <span className="cresce">
            <strong>{cenario.nome}</strong>
            <span className="sub" style={{ display: 'block' }}>
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              {ultimoMes && <> · até {mesAbreviado(ultimoMes)}: <strong className={classeEfeito(efeitoFinal)}>{formatarBRL(efeitoFinal)}</strong></>}
              {negativoEm && <> · negativo em {mesAbreviado(negativoEm)}</>}
            </span>
          </span>
          <span className="sub" aria-hidden="true">{aberto ? '▲' : '▼'}</span>
        </button>
      </div>

      {aberto && (
        <div className="tela" style={{ marginTop: 14 }}>
          <p className="rotulo-grupo">Itens</p>
          <div className="lista">
            {itens.map((item) => {
              const d = linhaDoItem(item);
              return (
                <button
                  key={item.id} type="button" className="item" style={{ background: 'var(--surface2)', cursor: 'pointer' }}
                  onClick={() => setEditando(item)}
                >
                  <div className="cresce">
                    <div>
                      {d.titulo}
                      {d.estorno && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
                    <div className="sub">{d.categoria} · {d.detalhe}</div>
                  </div>
                  <span className={d.classe}>{d.valor}</span>
                </button>
              );
            })}
            {itens.length === 0 && <p className="sub">Nenhum item ainda.</p>}
          </div>

          <section aria-label="Impacto só deste cenário">
            <p className="rotulo-grupo">Impacto só deste cenário</p>
            <div style={{ margin: '0 -16px' }}>
              <TabelaSimulacao linhas={linhas} larguraCh={larguraCh} />
            </div>
          </section>

          <p className="rotulo-grupo">Novo item</p>
          {boxIdNovo == null ? (
            <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
          ) : (
            <FormItemCenario
              key={formKey} boxId={boxIdNovo} rotuloBotao="Adicionar ao cenário" onSalvar={adicionar}
              inicial={{ valor: 0, descricao: '', tipo: 'gasto', categoriaId: null, repeticao: 'unica', data: hoje, parcelas: 2 }}
            />
          )}

          <div className="acoes">
            <button className="botao" onClick={tornarReal}>Tornar real</button>
            <button className="botao botao-perigo" onClick={excluir}>Excluir cenário</button>
          </div>
        </div>
      )}

      {editando && <ItemCenarioSheet item={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
