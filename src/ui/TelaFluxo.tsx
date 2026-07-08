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
  const [busca, setBusca] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [periodoAtivo, setPeriodoAtivo] = useState(false);
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
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo ?? 'gasto';
  const q = busca.trim().toLowerCase();
  const buscaAtiva = q.length > 0;
  const dataAtiva = dataDe.length > 0;
  const filtroAtivo = buscaAtiva || dataAtiva;
  const [dataDeFiltro, dataAteFiltro] = periodoAtivo && dataAte
    ? (dataAte < dataDe ? [dataAte, dataDe] : [dataDe, dataAte])
    : [dataDe, dataDe];
  const bate = (l: Lancamento) => {
    if (l.nota && l.nota.toLowerCase().includes(q)) return true;
    if (nomeCat(l.categoriaId).toLowerCase().includes(q)) return true;
    if (dataBonita(l.data).toLowerCase().includes(q)) return true;
    return formatarBRL(Math.abs(l.valor)).toLowerCase().includes(q);
  };
  const porDia = new Map<string, Lancamento[]>();
  for (const l of dados.lancamentos) {
    if (!ids.includes(l.boxId)) continue;
    if (l.cenarioId && !ligados.has(l.cenarioId)) continue;
    if (dataAtiva) {
      if (l.data < dataDeFiltro || l.data > dataAteFiltro) continue;
    } else {
      if (l.data < inicioLista) continue;
      if (buscaAtiva && !bate(l)) continue;
    }
    const arr = porDia.get(l.data);
    if (arr) arr.push(l);
    else porDia.set(l.data, [l]);
  }
  const saldoPorDia = new Map(serie.map((s) => [s.data, s.saldoProjetado]));
  const dias = [...porDia.keys()].sort();

  return (
    <div className="tela">
      <h2>Fluxo</h2>
      <div className="card">
        <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
      </div>
      <div className="linha">
        <input className="campo-busca" placeholder="Buscar por nota, categoria, data ou valor..." value={busca}
               onChange={(e) => { setBusca(e.target.value); if (e.target.value) setDataDe(''); }}
               style={{ flex: 1 }} />
        <input className="campo-busca" type="date" aria-label="Buscar por data" value={dataDe}
               onChange={(e) => { setDataDe(e.target.value); if (e.target.value) setBusca(''); }} />
        {filtroAtivo && (
          <button className="botao" onClick={() => { setBusca(''); setDataDe(''); setDataAte(''); setPeriodoAtivo(false); }}>Limpar</button>
        )}
      </div>
      <div className="linha">
        {!periodoAtivo ? (
          <button className="botao" onClick={() => setPeriodoAtivo(true)}>Selecionar período</button>
        ) : (
          <>
            <input className="campo-busca" type="date" aria-label="Até" value={dataAte}
                   onChange={(e) => setDataAte(e.target.value)} />
            <button className="botao" onClick={() => { setPeriodoAtivo(false); setDataAte(''); }}>Dia único</button>
          </>
        )}
      </div>
      {!dataAtiva && (
        <div className="linha">
          <span className="sub">Mostrando desde {dataBonita(inicioLista)}</span>
          <button className="botao" onClick={() => setDiasAtras(diasAtras + 30)}>+30 dias atrás</button>
        </div>
      )}
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
        {dias.length === 0 && (
          <p className="sub">{filtroAtivo ? 'Nenhum resultado para a busca.' : 'Nenhum lançamento no período.'}</p>
        )}
      </div>
      {editando && <LancEditor lanc={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
