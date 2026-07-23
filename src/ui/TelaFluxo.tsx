import { Suspense, lazy, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { projetarBoxes } from '../domain/projection';
import type { Lancamento } from '../domain/types';
import { boxIdsSelecionadas, cenariosLigados, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import CampoData from './CampoData';
import FaturaResumo from './FaturaResumo';
import LancEditor from './LancEditor';

const FluxoChartModal = lazy(() => import('./FluxoChartModal'));

function dataBonita(d: string): string {
  const [ano, mes, dia] = d.split('-');
  const semana = new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
  return `${semana} ${dia}/${mes}/${ano}`;
}

export default function TelaFluxo() {
  const { dados, boxSel, hoje } = useApp();
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [faturaSel, setFaturaSel] = useState<Lancamento | null>(null);
  const [graficoExpandido, setGraficoExpandido] = useState(false);
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
  const diasSet = new Set(porDia.keys());
  if (!filtroAtivo) diasSet.add(hoje);
  const dias = [...diasSet].sort();

  return (
    <div className="tela">
      {serie.length >= 2 ? (
        <button
          type="button" className="card grafico-expandido-abrir" aria-label="Expandir gráfico de saldo"
          onClick={() => setGraficoExpandido(true)}
        >
          <Maximize2 size={18} className="grafico-expandido-icone" aria-hidden="true" />
          <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
        </button>
      ) : (
        <div className="card">
          <BalanceChart serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0} />
        </div>
      )}
      <div className="linha">
        <input className="campo-busca" placeholder="Buscar por nota, categoria, data ou valor..." value={busca}
               onChange={(e) => { setBusca(e.target.value); if (e.target.value) setDataDe(''); }}
               style={{ flex: 1 }} />
      </div>
      <div className="linha">
        <CampoData id="fluxo-data-de" ariaLabel="Buscar por data" placeholder="Filtrar por data"
                   value={dataDe} ativo={dataAtiva}
                   onChange={(v) => { setDataDe(v); if (v) setBusca(''); }} />
        {periodoAtivo && (
          <CampoData id="fluxo-data-ate" ariaLabel="Até" placeholder="Até"
                     value={dataAte} ativo={dataAte.length > 0}
                     onChange={setDataAte} />
        )}
        <button className="botao" onClick={() => { setPeriodoAtivo((v) => !v); setDataAte(''); }}>
          {periodoAtivo ? 'Dia único' : 'Selecionar período'}
        </button>
        {filtroAtivo && (
          <button className="botao" onClick={() => { setBusca(''); setDataDe(''); setDataAte(''); setPeriodoAtivo(false); }}>Limpar</button>
        )}
      </div>
      {!dataAtiva && (
        <div className="linha">
          <span className="sub">Mostrando desde {dataBonita(inicioLista)}</span>
          <button className="botao" onClick={() => setDiasAtras(diasAtras + 30)}>+30 dias atrás</button>
        </div>
      )}
      <div className="lista lista-fluxo">
        {dias.map((dia) => (
          <div key={dia}>
            <div className={dia === hoje ? 'cabecalho-dia dia-hoje' : 'cabecalho-dia'}>
              <strong>{dataBonita(dia)}{dia === hoje ? ' · hoje' : ''}</strong>
              <span className="sub">
                <strong className={`total-dia ${(saldoPorDia.get(dia) ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                  {formatarBRL(saldoPorDia.get(dia) ?? 0)}
                </strong>
              </span>
            </div>
            {(porDia.get(dia) ?? []).map((l) => (
              <button key={l.id} className="item" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => (l.origem === 'cartao' ? setFaturaSel(l) : setEditando(l))}>
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
      {graficoExpandido && (
        <Suspense fallback={null}>
          <FluxoChartModal
            serie={serie} hoje={hoje} mostrarCenarios={ligados.size > 0}
            onFechar={() => setGraficoExpandido(false)}
          />
        </Suspense>
      )}
      {editando && <LancEditor lanc={editando} onFechar={() => setEditando(null)} />}
      {faturaSel && <FaturaResumo lanc={faturaSel} onFechar={() => setFaturaSel(null)} />}
    </div>
  );
}
