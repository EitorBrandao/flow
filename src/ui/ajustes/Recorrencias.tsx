import { useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL, parseValorDigitado } from '../../domain/money';
import { useApp } from '../../state/store';

export default function Recorrencias() {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  if (!dados) return null;
  const recs = dados.recorrencias.filter((r) => !r.cenarioId);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const boxDe = (catId: string) => dados.categorias.find((c) => c.id === catId)?.boxId;

  async function criar() {
    const cents = parseValorDigitado(valor);
    const boxId = boxDe(categoriaId);
    if (cents == null || !boxId) return;
    await repo.salvarRecorrencia({
      boxId, categoriaId, valor: cents, dataInicio,
      diaDoMes: Math.min(31, Math.max(1, Number(diaDoMes) || 1)),
      parcelas: parcelas ? Number(parcelas) : null,
    }, dados!.config.horizonteProjecao);
    await recarregar();
    setValor(''); setParcelas('');
  }

  async function alternarAtiva(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    await repo.salvarRecorrencia({ ...rec, ativa: !rec.ativa }, dados!.config.horizonteProjecao);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir a recorrência e seus previstos? (confirmados são mantidos)')) return;
    await repo.excluirRecorrencia(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Recorrências</h2>
      <div className="lista">
        {recs.map((r) => (
          <div className="item" key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
            <div className="cresce">
              {nomeCat(r.categoriaId)}{r.nota ? ` · ${r.nota}` : ''}
              <div className="sub">
                dia {r.diaDoMes} · {r.parcelas == null ? 'sem fim' : `${r.parcelas}x`} · desde {r.dataInicio}
                {r.origem === 'import' && <span className="badge" style={{ marginLeft: 6 }}>import</span>}
              </div>
            </div>
            <span>{formatarBRL(r.valor)}</span>
            <button className="botao" onClick={() => alternarAtiva(r.id)}>{r.ativa ? 'Pausar' : 'Ativar'}</button>
            <button className="botao botao-perigo" onClick={() => excluir(r.id)}>Excluir</button>
          </div>
        ))}
        {recs.length === 0 && <p className="sub">Nenhuma recorrência.</p>}
      </div>
      <h2>Nova recorrência</h2>
      <div className="linha">
        <input aria-label="Valor" placeholder="valor" inputMode="decimal" value={valor}
          onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        <select aria-label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {dados.categorias.filter((c) => !c.arquivada).map((c) => (
            <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
          ))}
        </select>
        <input aria-label="Início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <input aria-label="Dia do mês" type="number" min={1} max={31} value={diaDoMes}
          onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        <input aria-label="Parcelas" type="number" min={1} placeholder="∞" value={parcelas}
          onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
        <button className="botao botao-primario" onClick={criar}>Criar</button>
      </div>
    </div>
  );
}
