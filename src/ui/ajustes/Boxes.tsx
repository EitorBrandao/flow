import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL } from '../../domain/money';
import { agoraISO, novoId, type Box } from '../../domain/types';
import { useApp } from '../../state/store';
import CampoValor from '../CampoValor';

function EditorBox({ box }: { box: Box }) {
  const { recarregar } = useApp();
  const [nome, setNome] = useState(box.nome);
  const [temSaldoProprio, setTemSaldoProprio] = useState(box.saldoInicial != null);
  const [magnitude, setMagnitude] = useState(Math.abs(box.saldoInicial ?? 0));
  const [negativo, setNegativo] = useState((box.saldoInicial ?? 0) < 0);
  const [data, setData] = useState(box.dataSaldoInicial ?? '');
  const uid = useId();

  async function salvar() {
    const saldoInicial = temSaldoProprio ? (negativo ? -magnitude : magnitude) : null;
    const dataSaldoInicial = temSaldoProprio ? (data || null) : null;
    await repo.salvarBox({
      ...box, nome: nome.trim() || box.nome,
      saldoInicial,
      dataSaldoInicial,
    });
    await recarregar();
  }

  return (
    <div className="linha">
      <div className="campo">
        <label htmlFor={`${uid}-nome`}>Nome</label>
        <input id={`${uid}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: 100 }} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-saldo-proprio`}>
          <input id={`${uid}-saldo-proprio`} type="checkbox" checked={temSaldoProprio} onChange={(e) => setTemSaldoProprio(e.target.checked)} />
          {' '}Esta box tem saldo próprio
        </label>
      </div>
      {temSaldoProprio && (
        <>
          <div className="campo" style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            <div>
              <label htmlFor={`${uid}-saldo`}>Saldo inicial</label>
              <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} />
            </div>
            <button type="button" className="botao" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)} style={{ padding: '8px 12px' }}>
              {negativo ? '−' : '+'}
            </button>
          </div>
          <div className="campo">
            <label htmlFor={`${uid}-data`}>Data do saldo</label>
            <input id={`${uid}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </>
      )}
      <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
    </div>
  );
}

export default function Boxes() {
  const { dados, recarregar } = useApp();
  const [nomeNova, setNomeNova] = useState('');
  const uid = useId();
  if (!dados) return null;

  async function criar() {
    if (!nomeNova.trim()) return;
    const agora = agoraISO();
    await repo.salvarBox({
      id: novoId(), nome: nomeNova.trim(), saldoInicial: 0, dataSaldoInicial: useApp.getState().hoje,
      criadoEm: agora, alteradoEm: agora,
    });
    await recarregar();
    setNomeNova('');
  }

  async function definirPadrao(id: string) {
    await repo.salvarConfig({ boxPadraoId: id });
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Boxes</h2>
      {dados.boxes.map((b) => (
        <div className="card" key={b.id}>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <strong>{b.nome}</strong>
            <span className="sub">
              {b.saldoInicial != null
                ? `${formatarBRL(b.saldoInicial)} em ${b.dataSaldoInicial}`
                : 'sem saldo próprio (compartilhada)'}
            </span>
            {dados.config.boxPadraoId === b.id ? (
              <span className="badge">padrão</span>
            ) : b.saldoInicial != null ? (
              <button className="botao" onClick={() => definirPadrao(b.id)}>Tornar padrão</button>
            ) : null}
          </div>
          <EditorBox box={b} />
        </div>
      ))}
      <div className="linha">
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor={`${uid}-novabox`}>Nova box</label>
          <input id={`${uid}-novabox`} placeholder="nome" value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={criar}>Criar</button>
      </div>
    </div>
  );
}
