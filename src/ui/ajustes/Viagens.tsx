import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarDataBR } from '../../domain/dates';
import { viagensSobrepoem } from '../../domain/viagem';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';

export default function Viagens() {
  const { dados, recarregar } = useApp();
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const uid = useId();
  if (!dados) return null;

  const viagensOrdenadas = [...dados.viagens].sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1));

  function editar(id: string) {
    const v = dados!.viagens.find((x) => x.id === id)!;
    setEditandoId(id); setNome(v.nome); setDataInicio(v.dataInicio); setDataFim(v.dataFim);
    setAviso('');
  }

  function limpar() {
    setEditandoId(null); setNome(''); setDataInicio(''); setDataFim(''); setAviso('');
  }

  async function salvar() {
    if (!nome.trim() || !dataInicio || !dataFim) return;
    if (dataFim < dataInicio) {
      setAviso('A data final não pode ser anterior à data inicial.');
      return;
    }
    if (viagensSobrepoem(dados!.viagens, dataInicio, dataFim, editandoId ?? undefined)) {
      setAviso('Já existe uma viagem cadastrada nesse período.');
      return;
    }
    const campos = { nome: nome.trim(), dataInicio, dataFim };
    if (editandoId) await repo.atualizarViagem(editandoId, campos);
    else await repo.salvarViagem(campos);
    limpar();
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir esta viagem? Os lançamentos e compras marcados continuam existindo, só perdem a marcação de viagem.')) return;
    await repo.excluirViagem(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Viagens</h2>
      <h2>{editandoId ? 'Editar viagem' : 'Nova viagem'}</h2>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-nome`}>Nome</label>
          <input id={`${uid}-nome`} placeholder="ex.: Praia em janeiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Data inicial</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-fim`}>Data final</label>
          <CampoData id={`${uid}-fim`} value={dataFim} onChange={setDataFim} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>
          {editandoId ? 'Salvar' : 'Criar'}
        </button>
        {editandoId && <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={limpar}>Cancelar</button>}
      </div>

      <div className="lista">
        {viagensOrdenadas.map((v) => (
          <div className="item" key={v.id}>
            <div className="cresce">
              {v.nome}
              <div className="sub">{formatarDataBR(v.dataInicio)} – {formatarDataBR(v.dataFim)}</div>
            </div>
            <button className="botao" onClick={() => editar(v.id)}>Editar</button>
            <button className="botao botao-perigo" onClick={() => excluir(v.id)}>Excluir</button>
          </div>
        ))}
        {viagensOrdenadas.length === 0 && <p className="sub">Nenhuma viagem cadastrada.</p>}
      </div>
    </div>
  );
}
