import { useMemo, useState } from 'react';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { projetarBoxes } from '../domain/projection';
import type { Lancamento } from '../domain/types';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import LancEditor from './LancEditor';

function dataBonita(d: string): string {
  const [ano, mes, dia] = d.split('-');
  const semana = new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${semana} ${dia}/${mes}/${ano}`;
}

export default function TelaFluxo() {
  const { dados, boxSel, hoje } = useApp();
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [diasAtras, setDiasAtras] = useState(14);
  const ids = dados ? boxIdsSelecionadas(dados, boxSel) : [];
  const ligados = dados ? cenariosLigados(dados) : new Set<string>();

  const serie = useMemo(
    () => dados ? projetarBoxes(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
      cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
    }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, boxSel],
  );
  if (!dados) return null;

  const inicioLista = addDias(hoje, -diasAtras);
  const porDia = new Map<string, Lancamento[]>();
  for (const l of dados.lancamentos) {
    if (!ids.includes(l.boxId) || l.data < inicioLista) continue;
    if (l.cenarioId && !ligados.has(l.cenarioId)) continue;
    const arr = porDia.get(l.data);
    if (arr) arr.push(l);
    else porDia.set(l.data, [l]);
  }
  const saldoPorDia = new Map(serie.map((s) => [s.data, s.saldoProjetado]));
  const dias = [...porDia.keys()].sort();
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo ?? 'gasto';

  return (
    <div className="tela">
      <h2>Fluxo</h2>
      <div className="card">
        <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
      </div>
      <div className="linha">
        <span className="sub">Mostrando desde {dataBonita(inicioLista)}</span>
        <button className="botao" onClick={() => setDiasAtras(diasAtras + 30)}>+30 dias atrás</button>
      </div>
      <div className="lista">
        {dias.map((dia) => (
          <div key={dia}>
            <div className="linha" style={{ padding: '10px 4px 4px', justifyContent: 'space-between' }}>
              <strong className={dia === hoje ? 'valor-ganho' : ''}>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
              <span className="sub">{formatarBRL(saldoPorDia.get(dia) ?? 0)}</span>
            </div>
            {porDia.get(dia)!.map((l) => (
              <button key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setEditando(l)}>
                <div className="cresce">
                  {nomeCat(l.categoriaId)}
                  {l.status === 'previsto' && <span className="badge" style={{ marginLeft: 6 }}>{l.cenarioId ? 'cenário' : 'previsto'}</span>}
                  {l.nota && <div className="sub">{l.nota}</div>}
                </div>
                <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {tipoCat(l.categoriaId) === 'ganho' ? '+' : '−'}{formatarBRL(Math.abs(l.valor))}
                </span>
              </button>
            ))}
          </div>
        ))}
        {dias.length === 0 && <p className="sub">Nenhum lançamento no período.</p>}
      </div>
      {editando && <LancEditor lanc={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
