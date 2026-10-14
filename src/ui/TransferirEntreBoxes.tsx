import { Fragment, useId, useState } from 'react';
import * as repo from '../db/repo';
import { bancosDaBox, bancoPadrao, saldoCalculadoBanco } from '../domain/bancos';
import { classeSaldo, formatarBRL, formatarSaldo } from '../domain/money';
import type { Banco, Box, Dados, ID, ISODate } from '../domain/types';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';

/** Saldo de um banco antes e depois da transferência. `null` é banco sem saldo informado. */
interface LinhaResumo { nome: string; antes: number | null; depois: number | null }

function SaldoResumo({ valor }: { valor: number | null }) {
  return valor == null
    ? <span>—</span>
    : <strong className={'total-dia ' + classeSaldo(valor)}>{formatarSaldo(valor)}</strong>;
}

/** Uma ponta do formulário: escolhe a box e, se ela tem bancos, o banco. */
function PontaForm({ rotulo, boxes, bancos, boxId, bancoId, onBox, onBanco, dados }: {
  rotulo: string; boxes: Box[]; bancos: Banco[]; boxId: ID; bancoId: ID | undefined;
  onBox: (id: ID) => void; onBanco: (id: ID) => void; dados: Dados;
}) {
  const uid = useId();
  const banco = bancos.find((b) => b.id === bancoId);
  const saldo = banco ? saldoCalculadoBanco(banco, dados) : null;
  return (
    <div className="campo">
      <label htmlFor={`${uid}-box`}>{rotulo}</label>
      <select id={`${uid}-box`} value={boxId} onChange={(e) => onBox(e.target.value)}>
        {boxes.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
      </select>
      {bancos.length > 0 && (
        <select aria-label={`Banco (${rotulo.toLowerCase()})`} value={bancoId ?? ''} onChange={(e) => onBanco(e.target.value)}>
          {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
      )}
      {banco && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginTop: 2 }}>
          <span className="sub">saldo</span>
          {saldo == null
            ? <span className="sub">não informado</span>
            : <strong className={'total-dia ' + classeSaldo(saldo)}>{formatarSaldo(saldo)}</strong>}
        </div>
      )}
    </div>
  );
}

/** Botão e formulário de transferência entre boxes (`repo.transferirEntreBoxes`), na aba
 *  Conferir da Hoje. Só aparece com duas ou mais boxes com saldo próprio: a `casa` fica de fora.
 *  Origem e destino iguais, ou valor zero, desabilitam a confirmação, com aviso. */
export default function TransferirEntreBoxes({ dados, hoje }: { dados: Dados; hoje: ISODate }) {
  const { boxSel, recarregar } = useApp();
  const boxes = dados.boxes.filter((b) => b.saldoInicial != null);
  const [aberto, setAberto] = useState(false);
  const [origemId, setOrigemId] = useState<ID>('');
  const [destinoId, setDestinoId] = useState<ID>('');
  const [bancoOrigemId, setBancoOrigemId] = useState<ID | undefined>();
  const [bancoDestinoId, setBancoDestinoId] = useState<ID | undefined>();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState<ISODate>(hoje);
  const [sucesso, setSucesso] = useState<LinhaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const uid = useId();

  if (boxes.length < 2) return null;

  const bancosDe = (boxId: ID) => bancosDaBox(dados.bancos, [boxId]);
  const bancoInicial = (boxId: ID) => bancoPadrao(dados.bancos, boxId)?.id;

  function abrir() {
    const origem = boxes.find((b) => b.id === boxSel) ?? boxes[0];
    const destino = boxes.find((b) => b.id !== origem.id)!;
    setOrigemId(origem.id); setBancoOrigemId(bancoInicial(origem.id));
    setDestinoId(destino.id); setBancoDestinoId(bancoInicial(destino.id));
    setValor(0); setData(hoje); setErro(null); setSucesso(null); setAberto(true);
  }

  const origem = boxes.find((b) => b.id === origemId);
  const destino = boxes.find((b) => b.id === destinoId);
  const mesmaBox = origemId === destinoId;
  const podeConfirmar = valor > 0 && !mesmaBox && !!origem && !!destino
    && (bancosDe(origemId).length === 0 || !!bancoOrigemId)
    && (bancosDe(destinoId).length === 0 || !!bancoDestinoId);

  async function confirmar() {
    if (!podeConfirmar || !origem || !destino) return;
    const pontas = [
      { box: origem, bancoId: bancoOrigemId },
      { box: destino, bancoId: bancoDestinoId },
    ].map((p) => ({ ...p, banco: dados.bancos.find((b) => b.id === p.bancoId) }));
    const antes = pontas.map((p) => (p.banco ? saldoCalculadoBanco(p.banco, dados) : null));
    try {
      await repo.transferirEntreBoxes(
        { boxId: origem.id, bancoId: bancoOrigemId }, { boxId: destino.id, bancoId: bancoDestinoId }, valor, data,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível transferir.');
      return;
    }
    await recarregar();
    const atualizados = useApp.getState().dados ?? dados;
    const linhas: LinhaResumo[] = [];
    pontas.forEach((p, i) => {
      if (!p.banco) return;
      const atual = atualizados.bancos.find((b) => b.id === p.banco!.id) ?? p.banco;
      linhas.push({ nome: `${p.box.nome} · ${p.banco.nome}`, antes: antes[i], depois: saldoCalculadoBanco(atual, atualizados) });
    });
    setSucesso(linhas);
    setAberto(false);
  }

  if (sucesso) {
    return (
      <div className="item item-coluna" style={{ background: 'transparent', padding: 0 }}>
        <p className="aviso aviso-sucesso">Transferência feita ✓</p>
        {sucesso.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px 10px', alignItems: 'baseline' }}>
            <span />
            <span className="sub">antes</span>
            <span />
            <span className="sub">depois</span>
            {sucesso.map((r, i) => (
              <Fragment key={i}>
                <span className="sub">{r.nome}</span>
                <SaldoResumo valor={r.antes} />
                <span className="sub" aria-hidden="true">→</span>
                <SaldoResumo valor={r.depois} />
              </Fragment>
            ))}
          </div>
        )}
        <div className="acoes">
          <button className="botao botao-primario" onClick={() => setSucesso(null)}>Fechar</button>
        </div>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button className="botao" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={abrir}>
        Transferir entre boxes
      </button>
    );
  }

  return (
    <div className="item item-coluna" style={{ background: 'transparent', padding: 0, marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'start' }}>
        <PontaForm
          rotulo="De" boxes={boxes} bancos={bancosDe(origemId)} boxId={origemId} bancoId={bancoOrigemId} dados={dados}
          onBox={(id) => { setOrigemId(id); setBancoOrigemId(bancoInicial(id)); }} onBanco={setBancoOrigemId}
        />
        <span className="sub" style={{ paddingTop: 34 }} aria-hidden="true">→</span>
        <PontaForm
          rotulo="Para" boxes={boxes} bancos={bancosDe(destinoId)} boxId={destinoId} bancoId={bancoDestinoId} dados={dados}
          onBox={(id) => { setDestinoId(id); setBancoDestinoId(bancoInicial(id)); }} onBanco={setBancoDestinoId}
        />
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
      </div>
      {valor > 0 && origem && destino && !mesmaBox && (
        <p className="aviso">
          Isto não muda o saldo somado da casa. Muda o saldo de cada box: {origem.nome} −{formatarBRL(valor)} e {destino.nome} +{formatarBRL(valor)}.
        </p>
      )}
      <div className="acoes">
        <button className="botao botao-primario" disabled={!podeConfirmar} onClick={confirmar}>Confirmar transferência</button>
        <button className="botao" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
      {mesmaBox && <p className="aviso">Escolha duas boxes diferentes.</p>}
      {erro && <p className="aviso aviso-urgente">{erro}</p>}
    </div>
  );
}
