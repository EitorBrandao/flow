import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { categoriasFaturaIds } from '../../domain/fatura';
import { formatarBRL, parseValorDigitado } from '../../domain/money';
import { useApp } from '../../state/store';

export default function Recorrencias() {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const recs = dados.recorrencias.filter((r) => !r.cenarioId);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const boxDe = (catId: string) => dados.categorias.find((c) => c.id === catId)?.boxId;
  const ocultas = categoriasFaturaIds(dados.cartoes);

  function limparForm() {
    setValor(''); setCategoriaId(''); setDataInicio(hoje); setDiaDoMes('1'); setParcelas('');
  }

  function editar(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    setEditandoId(id);
    setValor((rec.valor / 100).toFixed(2).replace('.', ','));
    setCategoriaId(rec.categoriaId);
    setDataInicio(rec.dataInicio);
    setDiaDoMes(String(rec.diaDoMes));
    setParcelas(rec.parcelas != null ? String(rec.parcelas) : '');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    limparForm();
  }

  async function salvar() {
    const cents = parseValorDigitado(valor);
    const boxId = boxDe(categoriaId);
    if (cents == null || !boxId) return;
    const diaDoMesNum = Math.min(31, Math.max(1, Number(diaDoMes) || 1));
    const parcelasNum = parcelas ? Number(parcelas) : null;
    if (editandoId) {
      const original = recs.find((r) => r.id === editandoId)!;
      await repo.salvarRecorrencia({
        ...original, boxId, categoriaId, valor: cents, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setEditandoId(null);
      limparForm();
    } else {
      await repo.salvarRecorrencia({
        boxId, categoriaId, valor: cents, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setValor(''); setParcelas('');
    }
    await recarregar();
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
              </div>
            </div>
            <span>{formatarBRL(r.valor)}</span>
            <button className="botao" onClick={() => editar(r.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtiva(r.id)}>{r.ativa ? 'Pausar' : 'Ativar'}</button>
            <button className="botao botao-perigo" onClick={() => excluir(r.id)}>Excluir</button>
          </div>
        ))}
        {recs.length === 0 && <p className="sub">Nenhuma recorrência.</p>}
      </div>
      <h2>{editandoId ? 'Editar recorrência' : 'Nova recorrência'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <input id={`${uid}-valor`} placeholder="0,00" inputMode="decimal" value={valor}
            onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-cat`}>Categoria</label>
          <select id={`${uid}-cat`} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">categoria…</option>
            {dados.categorias.filter((c) => !c.arquivada && !ocultas.has(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <input id={`${uid}-inicio`} type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-dia`}>Dia do mês</label>
          <input id={`${uid}-dia`} type="number" min={1} max={31} value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} placeholder="∞" value={parcelas}
            onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
        {editandoId && <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={cancelarEdicao}>Cancelar</button>}
      </div>
    </div>
  );
}
