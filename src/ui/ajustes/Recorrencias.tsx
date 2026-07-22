import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { categoriasFaturaIds } from '../../domain/fatura';
import { formatarBRL } from '../../domain/money';
import type { TipoCategoria } from '../../domain/types';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorCategoria from '../SeletorCategoria';
import SeletorPills from '../SeletorPills';

export default function Recorrencias() {
  const { dados, hoje, recarregar } = useApp();
  const [boxId, setBoxId] = useState(
    dados?.boxes
      .filter((b) => b.saldoInicial != null)
      .sort((a, b) => b.nome.localeCompare(a.nome))
      .at(0)?.id ?? ''
  );
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [valor, setValor] = useState(0);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const recs = dados.recorrencias.filter((r) => !r.cenarioId && r.boxId === boxId);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo;
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const categoriasDaBox = dados.categorias
    .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id));

  function limparForm() {
    setValor(0); setCategoriaId(null); setDataInicio(hoje); setDiaDoMes('1'); setParcelas('');
  }

  function trocarBox(novoBoxId: string) {
    setBoxId(novoBoxId);
    setEditandoId(null);
    limparForm();
  }

  function trocarTipo(novoTipo: TipoCategoria) {
    setTipo(novoTipo);
    setCategoriaId(null);
  }

  function editar(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    setEditandoId(id);
    setTipo(tipoCat(rec.categoriaId) ?? 'gasto');
    setValor(rec.valor);
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
    if (valor <= 0 || categoriaId == null) return;
    const diaDoMesNum = Math.min(31, Math.max(1, Number(diaDoMes) || 1));
    const parcelasNum = parcelas ? Number(parcelas) : null;
    if (editandoId) {
      const original = recs.find((r) => r.id === editandoId)!;
      await repo.salvarRecorrencia({
        ...original, boxId, categoriaId, valor, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setEditandoId(null);
      limparForm();
    } else {
      await repo.salvarRecorrencia({
        boxId, categoriaId, valor, dataInicio,
        diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      }, dados!.config.horizonteProjecao);
      setValor(0); setParcelas('');
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

      <div className="campo">
        <label>Box</label>
        <SeletorPills
          opcoes={dados.boxes
            .filter((b) => b.saldoInicial != null)
            .sort((a, b) => b.nome.localeCompare(a.nome))
            .map((b) => ({ id: b.id, nome: b.nome }))}
          selecionadaId={boxId}
          onSelecionar={trocarBox}
        />
      </div>

      <h2>{editandoId ? 'Editar recorrência' : 'Nova recorrência'}</h2>
      <div className="campo">
        <label htmlFor={`${uid}-valor`}>Valor</label>
        <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 100 }} />
      </div>
      <div className="linha" role="radiogroup" aria-label="Tipo">
        <button
          className={`botao ${tipo === 'gasto' ? 'botao-primario' : ''}`}
          onClick={() => trocarTipo('gasto')}
        >Gasto</button>
        <button
          className={`botao ${tipo === 'ganho' ? 'botao-primario' : ''}`}
          onClick={() => trocarTipo('ganho')}
        >Ganho</button>
      </div>
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={categoriasDaBox} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
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

      <p className="rotulo-grupo">Nesta box</p>
      <div className="lista">
        {recs.map((r) => (
          <div className="item item-coluna" key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
            <div className="linha-topo linha-topo-2-1">
              <div className="cresce">
                <div className="sub">desde {r.dataInicio}</div>
                <div className="sub">todo dia {r.diaDoMes}, {r.parcelas == null ? 'sem fim' : `${r.parcelas}x`}</div>
              </div>
              <span className={tipoCat(r.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                {formatarBRL(r.valor)}
              </span>
            </div>
            <div className="acoes">
              <button className="botao" onClick={() => editar(r.id)}>Editar</button>
              <button className="botao" onClick={() => alternarAtiva(r.id)}>{r.ativa ? 'Pausar' : 'Ativar'}</button>
              <button className="botao botao-perigo" onClick={() => excluir(r.id)}>Excluir</button>
            </div>
          </div>
        ))}
        {recs.length === 0 && <p className="sub">Nenhuma recorrência nesta box.</p>}
      </div>
    </div>
  );
}
