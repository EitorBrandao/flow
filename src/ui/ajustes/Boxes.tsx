import { Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarDataBR } from '../../domain/dates';
import { formatarBRL } from '../../domain/money';
import { agoraISO, novoId, type Box } from '../../domain/types';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';

interface CamposBox { nome: string; saldoInicial: number | null; dataSaldoInicial: string | null }

/** Campos de uma box, usados só para editar dentro do item — a criação usa apenas o nome. */
function FormBox({ inicial, onSalvo, onCancelar }: {
  inicial: CamposBox;
  onSalvo: (campos: CamposBox) => Promise<void>;
  onCancelar: () => void;
}) {
  const { hoje } = useApp();
  const [nome, setNome] = useState(inicial.nome);
  const [temSaldoProprio, setTemSaldoProprio] = useState(inicial.saldoInicial != null);
  const [magnitude, setMagnitude] = useState(Math.abs(inicial.saldoInicial ?? 0));
  const [negativo, setNegativo] = useState((inicial.saldoInicial ?? 0) < 0);
  // Box sem data ainda cai em hoje, que é a resposta certa em quase todo caso: o saldo que
  // a pessoa acabou de ler no app do banco é o de hoje. Quem quiser outra data, troca.
  const [data, setData] = useState(inicial.dataSaldoInicial ?? hoje);
  const uid = useId();

  async function salvar() {
    const saldoInicial = temSaldoProprio ? (negativo ? -magnitude : magnitude) : null;
    const dataSaldoInicial = temSaldoProprio ? (data || null) : null;
    await onSalvo({ nome: nome.trim() || inicial.nome, saldoInicial, dataSaldoInicial });
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-nome`}>Nome</label>
          <input id={`${uid}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-saldo-proprio`}>
          <input id={`${uid}-saldo-proprio`} type="checkbox" checked={temSaldoProprio} onChange={(e) => setTemSaldoProprio(e.target.checked)} />
          {' '}Esta box tem saldo próprio
        </label>
      </div>
      {temSaldoProprio && (
        <div className="form-linha">
          <div className="campo">
            <label htmlFor={`${uid}-saldo`}>Saldo inicial</label>
            <div className="linha">
              <button type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)}>
                {negativo ? '−' : '+'}
              </button>
              <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ flex: 1, minWidth: 0 }} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor={`${uid}-data`}>Data do saldo</label>
            <CampoData id={`${uid}-data`} value={data} onChange={setData} />
          </div>
        </div>
      )}
      <div className="form-botoes">
        <button className="botao" onClick={onCancelar}>Cancelar</button>
        <button className="botao botao-primario" onClick={salvar}>Salvar</button>
      </div>
    </>
  );
}

export default function Boxes() {
  const { dados, recarregar, setBoxSel } = useApp();
  const [nomeNova, setNomeNova] = useState('');
  const [aviso, setAviso] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;

  async function criar() {
    // Antes isto era um `return` mudo: clicar em Criar sem nome não fazia nada e não
    // explicava nada — quem estava criando a primeira box ficava sem saber o que faltava.
    if (!nomeNova.trim()) {
      setAviso('Dê um nome à box para criar.');
      return;
    }
    const agora = agoraISO();
    const id = novoId();
    await repo.salvarBox({
      id, nome: nomeNova.trim(), saldoInicial: 0, dataSaldoInicial: useApp.getState().hoje,
      criadoEm: agora, alteradoEm: agora,
    });
    await recarregar();
    // A box recém-criada passa a ser a selecionada: era o passo seguinte óbvio, e deixá-la
    // fora da seleção fazia a pessoa criar e não ver nada mudar no topo.
    setBoxSel(id);
    setNomeNova('');
    setAviso('');
  }

  async function atualizar(box: Box, campos: CamposBox) {
    await repo.salvarBox({ ...box, ...campos });
    setEditandoId(null);
    await recarregar();
  }

  async function definirPadrao(id: string) {
    await repo.salvarConfig({ boxPadraoId: id });
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Boxes</h2>
      {!editandoId && (
        <>
          <h2>Nova box</h2>
          <div className="form-linha">
            <div className="campo">
              <label htmlFor={`${uid}-novabox`}>Nome</label>
              <input id={`${uid}-novabox`} placeholder="nome" value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} />
            </div>
            <button className="botao botao-primario" onClick={criar}>Criar</button>
          </div>
          {aviso && <p className="aviso">{aviso}</p>}
        </>
      )}

      <div className="lista">
        {dados.boxes.map((b) => (
          editandoId === b.id ? (
            <div className="item item-coluna" key={b.id}>
              <FormBox
                inicial={{ nome: b.nome, saldoInicial: b.saldoInicial, dataSaldoInicial: b.dataSaldoInicial }}
                onSalvo={(campos) => atualizar(b, campos)}
                onCancelar={() => setEditandoId(null)}
              />
            </div>
          ) : (
            <div className="item" key={b.id}>
              <div className="cresce">
                <strong>{b.nome}</strong>
                <div className="sub">
                  {b.saldoInicial != null
                    ? `${formatarBRL(b.saldoInicial)}${b.dataSaldoInicial ? ` em ${formatarDataBR(b.dataSaldoInicial)}` : ''}`
                    : 'sem saldo próprio (compartilhada)'}
                </div>
              </div>
              {dados.config.boxPadraoId === b.id ? (
                <span className="badge">padrão</span>
              ) : b.saldoInicial != null ? (
                <button className="botao" onClick={() => definirPadrao(b.id)}>Tornar padrão</button>
              ) : null}
              <button className="botao" aria-label="Editar" onClick={() => setEditandoId(b.id)}><Pencil size={16} /></button>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
