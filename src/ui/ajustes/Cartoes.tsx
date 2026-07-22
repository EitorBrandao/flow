import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function Cartoes() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState(dados?.boxes.find((b) => b.saldoInicial != null)?.id ?? '');
  const [nome, setNome] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('28');
  const [diaVencimento, setDiaVencimento] = useState('5');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  const horizonte = dados.config.horizonteProjecao;
  const nomeBox = (id: string) => dados.boxes.find((b) => b.id === id)?.nome ?? '?';

  function clampDia(t: string): number {
    return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
  }

  function editar(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    setEditandoId(id); setBoxId(c.boxId); setNome(c.nome);
    setDiaFechamento(String(c.diaFechamento)); setDiaVencimento(String(c.diaVencimento));
  }

  async function salvar() {
    if (!nome.trim() || !boxId) return;
    const campos = {
      boxId, nome: nome.trim(), diaFechamento: clampDia(diaFechamento),
      diaVencimento: clampDia(diaVencimento),
    };
    if (editandoId) {
      const original = dados!.cartoes.find((c) => c.id === editandoId)!;
      await repo.salvarCartao({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarCartao(campos, horizonte);
    }
    setEditandoId(null); setNome('');
    await recarregar();
  }

  async function alternarAtivo(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    await repo.salvarCartao({ ...c, ativo: !c.ativo }, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>{editandoId ? 'Editar cartão' : 'Novo cartão'}</h2>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-box`}>Box do cartão</label>
          <select id={`${uid}-box`} value={boxId}
            onChange={(e) => setBoxId(e.target.value)}>
            {dados.boxes.filter((b) => b.saldoInicial != null).map((b) => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo cresce">
          <label htmlFor={`${uid}-nome`}>Nome do cartão</label>
          <input id={`${uid}-nome`} placeholder="ex.: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Dia de fechamento</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-vence`}>Dia de vencimento</label>
          <input id={`${uid}-vence`} type="number" min={1} max={31} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)} style={{ width: 64 }} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>
          {editandoId ? 'Salvar' : 'Criar'}
        </button>
      </div>

      <p className="rotulo-grupo">Cadastrados</p>
      <div className="lista">
        {dados.cartoes.map((c) => (
          <div className="item" key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
            <div className="cresce">
              {c.nome} <span className="badge">{nomeBox(c.boxId)}</span>
              <div className="sub">fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}</div>
            </div>
            <button className="botao" onClick={() => editar(c.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtivo(c.id)}>
              {c.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ))}
        {dados.cartoes.length === 0 && <p className="sub">Nenhum cartão cadastrado.</p>}
      </div>
    </div>
  );
}
