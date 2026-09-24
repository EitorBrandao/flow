import { Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarDataBR } from '../../domain/dates';
import type { Viagem } from '../../domain/types';
import { viagensSobrepoem } from '../../domain/viagem';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';

interface CamposViagem { nome: string; dataInicio: string; dataFim: string }

/** Campos de uma viagem, usados para criar (no topo) e para editar (dentro do item). */
function FormViagem({ inicial, idExcluido, rotuloSalvar, onSalvo, onCancelar }: {
  inicial: CamposViagem;
  idExcluido?: string;
  rotuloSalvar: 'Criar' | 'Salvar';
  onSalvo: (campos: CamposViagem) => Promise<void>;
  onCancelar?: () => void;
}) {
  const { dados } = useApp();
  const [nome, setNome] = useState(inicial.nome);
  const [dataInicio, setDataInicio] = useState(inicial.dataInicio);
  const [dataFim, setDataFim] = useState(inicial.dataFim);
  const [aviso, setAviso] = useState('');
  const uid = useId();

  async function salvar() {
    if (!nome.trim() || !dataInicio || !dataFim) {
      setAviso('Preencha nome, início e fim para salvar.');
      return;
    }
    if (dataFim < dataInicio) {
      setAviso('A data final não pode ser anterior à data inicial.');
      return;
    }
    if (viagensSobrepoem(dados!.viagens, dataInicio, dataFim, idExcluido)) {
      setAviso('Já existe uma viagem cadastrada nesse período.');
      return;
    }
    setAviso('');
    await onSalvo({ nome: nome.trim(), dataInicio, dataFim });
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-nome`}>Nome</label>
          <input id={`${uid}-nome`} autoFocus={onCancelar != null} placeholder="ex.: Praia em janeiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Data inicial</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-fim`}>Data final</label>
          <CampoData id={`${uid}-fim`} value={dataFim} onChange={setDataFim} />
        </div>
      </div>
      <div className="form-botoes">
        {onCancelar && <button className="botao" onClick={onCancelar}>Cancelar</button>}
        <button className="botao botao-primario" onClick={salvar}>{rotuloSalvar}</button>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
    </>
  );
}

export default function Viagens() {
  const { dados, recarregar, hoje } = useApp();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Muda a cada criação para o formulário do topo voltar vazio (remonta com `key`).
  const [versaoNova, setVersaoNova] = useState(0);
  if (!dados) return null;

  const viagensOrdenadas: Viagem[] = [...dados.viagens].sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1));

  async function criar(campos: CamposViagem) {
    await repo.salvarViagem(campos);
    setVersaoNova((v) => v + 1);
    await recarregar();
  }

  async function atualizar(id: string, campos: CamposViagem) {
    await repo.atualizarViagem(id, campos);
    setEditandoId(null);
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
      {!editandoId && (
        <>
          <h2>Nova viagem</h2>
          <FormViagem key={versaoNova} inicial={{ nome: '', dataInicio: hoje, dataFim: hoje }} rotuloSalvar="Criar" onSalvo={criar} />
        </>
      )}

      <p className="rotulo-grupo">Cadastradas</p>
      <div className="lista">
        {viagensOrdenadas.map((v) => (
          editandoId === v.id ? (
            <div className="item item-coluna" key={v.id}>
              <FormViagem
                inicial={{ nome: v.nome, dataInicio: v.dataInicio, dataFim: v.dataFim }}
                idExcluido={v.id} rotuloSalvar="Salvar"
                onSalvo={(campos) => atualizar(v.id, campos)} onCancelar={() => setEditandoId(null)}
              />
            </div>
          ) : (
            <div className="item" key={v.id}>
              <div className="cresce">
                {v.nome}
                <div className="sub">{formatarDataBR(v.dataInicio)} – {formatarDataBR(v.dataFim)}</div>
              </div>
              <button className="botao" aria-label="Editar" onClick={() => setEditandoId(v.id)}><Pencil size={16} /></button>
              <button className="botao botao-perigo" onClick={() => excluir(v.id)}>Excluir</button>
            </div>
          )
        ))}
        {viagensOrdenadas.length === 0 && <p className="sub">Nenhuma viagem cadastrada.</p>}
      </div>
    </div>
  );
}
