import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as repo from '../../db/repo';
import { bancosDaBox } from '../../domain/bancos';
import { boxIdEfetivo, useApp } from '../../state/store';

interface CamposCartao { nome: string; bancoId: string; diaFechamento: string; diaVencimento: string }
interface CamposCartaoSalvos { nome: string; bancoId: string | undefined; diaFechamento: number; diaVencimento: number }

function clampDia(t: string): number {
  return Math.min(31, Math.max(1, Math.round(Number(t) || 1)));
}

/** Campos de um cartão, usados para criar (no topo) e para editar (dentro do item). */
function FormCartao({ inicial, rotuloSalvar, onSalvo, onCancelar }: {
  inicial: CamposCartao;
  rotuloSalvar: 'Criar' | 'Salvar';
  onSalvo: (campos: CamposCartaoSalvos) => Promise<void>;
  onCancelar?: () => void;
}) {
  const { dados, boxSel } = useApp();
  const [nome, setNome] = useState(inicial.nome);
  const [bancoId, setBancoId] = useState(inicial.bancoId);
  const [diaFechamento, setDiaFechamento] = useState(inicial.diaFechamento);
  const [diaVencimento, setDiaVencimento] = useState(inicial.diaVencimento);
  const uid = useId();

  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;
  const bancos = dados && boxId ? bancosDaBox(dados.bancos, [boxId]) : [];

  async function salvar() {
    if (!nome.trim()) return;
    await onSalvo({
      nome: nome.trim(), bancoId: bancoId || undefined,
      diaFechamento: clampDia(diaFechamento), diaVencimento: clampDia(diaVencimento),
    });
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-nome`}>Nome do cartão</label>
          <input id={`${uid}-nome`} placeholder="ex.: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
      </div>
      {bancos.length > 0 && (
        <div className="form-linha">
          <div className="campo">
            <label htmlFor={`${uid}-banco`}>Banco</label>
            <select id={`${uid}-banco`} value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">— sem banco —</option>
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-fecha`}>Dia de fechamento</label>
          <input id={`${uid}-fecha`} type="number" min={1} max={31} value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-vence`}>Dia de vencimento</label>
          <input id={`${uid}-vence`} type="number" min={1} max={31} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)} />
        </div>
      </div>
      <div className="form-botoes">
        {onCancelar && <button className="botao" onClick={onCancelar}>Cancelar</button>}
        <button className="botao botao-primario" onClick={salvar}>{rotuloSalvar}</button>
      </div>
    </>
  );
}

export default function Cartoes() {
  const { dados, boxSel, recarregar } = useApp();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Muda a cada criação para o formulário do topo voltar vazio (remonta com `key`).
  const [versaoNova, setVersaoNova] = useState(0);
  // O formulário antigo não zerava os dias depois de criar — só nome e banco. Guardado à
  // parte porque o remount por `versaoNova` reinicia TODO o estado local do FormCartao.
  const [ultimosDias, setUltimosDias] = useState({ diaFechamento: '28', diaVencimento: '5' });
  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;

  useEffect(() => {
    setEditandoId(null);
    setUltimosDias({ diaFechamento: '28', diaVencimento: '5' });
  }, [boxId]);

  if (!dados) return null;
  if (boxId == null) {
    return (
      <div className="tela">
        <h2>Cartões</h2>
        <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
      </div>
    );
  }
  const horizonte = dados.config.horizonteProjecao;
  const cartoesDaBox = dados.cartoes.filter((c) => c.boxId === boxId);

  async function criar(campos: CamposCartaoSalvos) {
    await repo.salvarCartao({ boxId: boxId!, ...campos }, horizonte);
    setUltimosDias({ diaFechamento: String(campos.diaFechamento), diaVencimento: String(campos.diaVencimento) });
    setVersaoNova((v) => v + 1);
    await recarregar();
  }

  async function atualizar(id: string, campos: CamposCartaoSalvos) {
    const original = dados!.cartoes.find((c) => c.id === id)!;
    await repo.salvarCartao({ ...original, ...campos }, horizonte);
    setEditandoId(null);
    await recarregar();
  }

  async function alternarAtivo(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    await repo.salvarCartao({ ...c, ativo: !c.ativo }, horizonte);
    await recarregar();
  }

  async function alternarPermiteCompra(id: string) {
    const c = dados!.cartoes.find((x) => x.id === id)!;
    const novoPermite = c.permiteCompra === false; // estava bloqueado ⇒ passa a permitir
    await repo.salvarCartao({ ...c, permiteCompra: novoPermite }, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Cartões</h2>
      {!editandoId && (
        <>
          <h2>Novo cartão</h2>
          <FormCartao
            key={`${boxId}-${versaoNova}`}
            inicial={{ nome: '', bancoId: '', ...ultimosDias }}
            rotuloSalvar="Criar" onSalvo={criar}
          />
        </>
      )}

      <p className="rotulo-grupo">Cadastrados nesta box</p>
      <div className="lista">
        {cartoesDaBox.map((c) => (
          editandoId === c.id ? (
            <div className="item item-coluna" key={c.id}>
              <FormCartao
                inicial={{ nome: c.nome, bancoId: c.bancoId ?? '', diaFechamento: String(c.diaFechamento), diaVencimento: String(c.diaVencimento) }}
                rotuloSalvar="Salvar"
                onSalvo={(campos) => atualizar(c.id, campos)} onCancelar={() => setEditandoId(null)}
              />
            </div>
          ) : (
            <div className="item" key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
              <div className="cresce">
                {c.nome}
                <div className="sub">fecha dia {c.diaFechamento} · vence dia {c.diaVencimento}</div>
              </div>
              <button className="botao" aria-label="Editar" onClick={() => setEditandoId(c.id)}><Pencil size={16} /></button>
              <button className="botao" onClick={() => alternarAtivo(c.id)}>
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button className="botao" onClick={() => alternarPermiteCompra(c.id)}>
                {c.permiteCompra === false ? 'Permitir' : 'Bloquear'}
              </button>
            </div>
          )
        ))}
        {cartoesDaBox.length === 0 && <p className="sub">Nenhum cartão cadastrado nesta box.</p>}
      </div>
    </div>
  );
}
