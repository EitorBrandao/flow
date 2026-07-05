import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL, parseValorDigitado } from '../../domain/money';
import { agoraISO, novoId, type Box } from '../../domain/types';
import { useApp } from '../../state/store';

function EditorBox({ box }: { box: Box }) {
  const { recarregar } = useApp();
  const [nome, setNome] = useState(box.nome);
  const [saldo, setSaldo] = useState(box.saldoInicial != null ? (box.saldoInicial / 100).toFixed(2).replace('.', ',') : '');
  const [data, setData] = useState(box.dataSaldoInicial ?? '');
  const uid = useId();

  async function salvar() {
    const cents = saldo ? parseValorDigitado(saldo.replace('-', ''), { permitirZero: true }) : null;
    const negativo = saldo.trim().startsWith('-');
    await repo.salvarBox({
      ...box, nome: nome.trim() || box.nome,
      saldoInicial: cents == null ? null : (negativo ? -cents : cents),
      dataSaldoInicial: data || null,
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
        <label htmlFor={`${uid}-saldo`}>Saldo inicial</label>
        <input id={`${uid}-saldo`} placeholder="0,00" inputMode="decimal" value={saldo}
          onChange={(e) => setSaldo(e.target.value)} style={{ width: 110 }} />
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-data`}>Data do saldo</label>
        <input id={`${uid}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
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
